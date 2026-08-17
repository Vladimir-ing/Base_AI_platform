import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const ALLOWED_ORIGINS = new Set([
  "https://vladimir-ing.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://vladimir-ing.github.io",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

function clients() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
  const publishableKey = publishableKeys.default || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serverKey = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  return {
    auth: createClient(url, publishableKey, options),
    server: createClient(url, serverKey, options),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json(req, { error: "unauthorized" }, 401);

  const { auth, server } = clients();
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user) return json(req, { error: "unauthorized" }, 401);

  const { data: adminAccess, error: adminError } = await server
    .from("user_access")
    .select("is_admin")
    .eq("user_id", authData.user.id)
    .single();
  if (adminError || !adminAccess?.is_admin) return json(req, { error: "forbidden" }, 403);

  const authUsers: any[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const listed = await server.auth.admin.listUsers({ page, perPage: 1000 });
    if (listed.error) return json(req, { error: "users_unavailable" }, 503);
    authUsers.push(...listed.data.users);
    if (listed.data.users.length < 1000) break;
  }

  const [accessResult, usageResult, plansResult, settingsResult, adminReadmeResult] = await Promise.all([
    server.from("user_access").select("user_id,status,plan,is_admin,trial_started_at,trial_ends_at,subscribed_at,current_period_end,cancel_at_period_end,billing_interval,last_seen_at,created_at"),
    server.from("llm_usage_events").select("user_id,status,total_tokens,estimated_cost_usd,actual_cost_usd,budget_day,created_at").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    server.from("billing_plans").select("code,name,platform_limit,llm_monthly_limit,monthly_price_usd,annual_monthly_price_usd,annual_price_usd,sort_order").eq("is_active", true).order("sort_order"),
    server.from("product_settings").select("billing_enabled,free_preview_enabled,free_preview_llm_monthly_limit,trial_days,llm_input_usd_per_million,llm_output_usd_per_million,llm_max_output_tokens,updated_at").eq("singleton", true).single(),
    server.rpc("get_admin_document", { p_slug: "readme" }),
  ]);
  if (accessResult.error || usageResult.error || plansResult.error || settingsResult.error || adminReadmeResult.error) return json(req, { error: "dashboard_unavailable" }, 503);

  const now = Date.now();
  const accessByUser = new Map((accessResult.data || []).map((row: any) => [row.user_id, row]));
  const usageByUser = new Map<string, { requests: number; tokens: number; cost: number }>();
  const todayUtc = new Date().toISOString().slice(0, 10);
  let llmCostToday = 0;
  for (const row of usageResult.data || []) {
    if (row.status === "denied") continue;
    const current = usageByUser.get(row.user_id) || { requests: 0, tokens: 0, cost: 0 };
    const cost = Number(row.status === "started"
      ? (row.estimated_cost_usd || 0)
      : (row.actual_cost_usd ?? row.estimated_cost_usd ?? 0));
    current.requests += 1;
    current.tokens += Number(row.total_tokens || 0);
    current.cost += cost;
    usageByUser.set(row.user_id, current);
    if (row.budget_day === todayUtc && ["started", "succeeded", "failed"].includes(row.status)) llmCostToday += cost;
  }

  const users = authUsers.map((user: any) => {
    const access: any = accessByUser.get(user.id) || {};
    const expiredTrial = access.status === "trialing" && access.trial_ends_at && new Date(access.trial_ends_at).getTime() <= now;
    const usage = usageByUser.get(user.id) || { requests: 0, tokens: 0, cost: 0 };
    return {
      id: user.id,
      email: user.email || "",
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      status: settingsResult.data.free_preview_enabled ? "preview" : (expiredTrial ? "active" : (access.status || "missing")),
      plan: access.is_admin ? "owner" : (settingsResult.data.free_preview_enabled ? "max (preview)" : (expiredTrial ? "basic" : (access.plan || "—"))),
      is_admin: Boolean(access.is_admin),
      trial_started_at: access.trial_started_at || null,
      trial_ends_at: access.trial_ends_at || null,
      subscribed_at: access.subscribed_at || null,
      current_period_end: access.current_period_end || null,
      cancel_at_period_end: Boolean(access.cancel_at_period_end),
      billing_interval: access.billing_interval || null,
      last_seen_at: access.last_seen_at || null,
      llm_requests_30d: usage.requests,
      llm_tokens_30d: usage.tokens,
      llm_cost_30d_usd: usage.cost,
    };
  }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const activeSince = (days: number) => users.filter((u: any) => {
    const date = u.last_seen_at || u.last_sign_in_at;
    return date && new Date(date).getTime() >= now - days * 86400000;
  }).length;
  const statuses = users.reduce((acc: Record<string, number>, user: any) => {
    acc[user.status] = (acc[user.status] || 0) + 1;
    return acc;
  }, {});
  const llm30 = Array.from(usageByUser.values()).reduce((acc, item) => ({
    requests: acc.requests + item.requests,
    tokens: acc.tokens + item.tokens,
    cost: acc.cost + item.cost,
  }), { requests: 0, tokens: 0, cost: 0 });
  return json(req, {
    generated_at: new Date().toISOString(),
    summary: {
      total_users: users.length,
      active_7d: activeSince(7),
      active_30d: activeSince(30),
      statuses,
      llm_requests_30d: llm30.requests,
      llm_tokens_30d: llm30.tokens,
      llm_cost_30d_usd: llm30.cost,
      llm_cost_today_usd: llmCostToday,
    },
    plans: plansResult.data || [],
    settings: settingsResult.data,
    admin_readme: adminReadmeResult.data || "",
    users,
  });
});
