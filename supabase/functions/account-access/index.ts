import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const TRIAL_DAYS = 14;
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

  const user = authData.user;
  const { data: settings, error: settingsError } = await server
    .from("product_settings")
    .select("billing_enabled,free_preview_enabled,free_preview_llm_monthly_limit,trial_days")
    .eq("singleton", true)
    .single();
  if (settingsError || !settings) return json(req, { error: "settings_unavailable" }, 503);

  let { data: access, error: accessError } = await server
    .from("user_access")
    .select("status,plan,is_admin,trial_started_at,trial_ends_at,subscribed_at,current_period_end,cancel_at_period_end,billing_interval")
    .eq("user_id", user.id)
    .maybeSingle();

  if (accessError) return json(req, { error: "access_unavailable" }, 503);
  if (!access) {
    const started = user.created_at || new Date().toISOString();
    const ends = new Date(new Date(started).getTime() + TRIAL_DAYS * 86400000).toISOString();
    const created = await server.from("user_access").upsert({
      user_id: user.id,
      trial_started_at: started,
      trial_ends_at: ends,
    }, { onConflict: "user_id" }).select("status,plan,is_admin,trial_started_at,trial_ends_at,subscribed_at,current_period_end,cancel_at_period_end,billing_interval").single();
    if (created.error || !created.data) return json(req, { error: "access_unavailable" }, 503);
    access = created.data;
  }

  const now = new Date();
  const trialEnd = new Date(access.trial_ends_at);
  let status = access.status;
  let plan = access.plan;
  if (!settings.free_preview_enabled && !access.is_admin && status === "trialing" && trialEnd <= now) {
    status = "active";
    plan = "basic";
  }

  await server.from("user_access").update({ status, plan, last_seen_at: now.toISOString() }).eq("user_id", user.id);

  const isPreview = Boolean(settings.free_preview_enabled);
  const isTrial = !isPreview && !access.is_admin && status === "trialing" && trialEnd > now;
  const effectivePlan = access.is_admin ? "owner" : ((isPreview || isTrial) ? "max" : (["basic", "pro", "max"].includes(plan) ? plan : "basic"));
  const { data: planData, error: planError } = effectivePlan === "owner"
    ? { data: null, error: null }
    : await server.from("billing_plans").select("code,name,platform_limit,llm_monthly_limit,monthly_price_usd,annual_monthly_price_usd,annual_price_usd").eq("code", effectivePlan).single();
  if (planError) return json(req, { error: "plan_unavailable" }, 503);

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { count, error: usageError } = await server
    .from("llm_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", monthStart)
    .in("status", ["started", "succeeded", "failed"]);

  if (usageError) return json(req, { error: "usage_unavailable" }, 503);
  const llmUsed = count || 0;
  const daysRemaining = isTrial ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)) : null;
  const llmLimit = access.is_admin || isTrial
    ? null
    : (isPreview ? Number(settings.free_preview_llm_monthly_limit) : planData?.llm_monthly_limit);

  return json(req, {
    is_admin: Boolean(access.is_admin),
    status: isPreview ? "preview" : status,
    plan: effectivePlan,
    stored_plan: plan,
    allowed: true,
    trial_started_at: access.trial_started_at,
    trial_ends_at: access.trial_ends_at,
    days_remaining: daysRemaining,
    subscribed_at: access.subscribed_at,
    current_period_end: access.current_period_end,
    cancel_at_period_end: Boolean(access.cancel_at_period_end),
    billing_interval: access.billing_interval,
    billing_enabled: Boolean(settings.billing_enabled),
    free_preview: isPreview,
    trial_days: settings.trial_days,
    platform_limit: isPreview || isTrial || access.is_admin ? null : planData?.platform_limit,
    llm_limit: llmLimit,
    llm_used: llmUsed,
    llm_remaining: llmLimit == null ? null : Math.max(0, llmLimit - llmUsed),
    prices: planData ? {
      monthly_usd: Number(planData.monthly_price_usd),
      annual_monthly_usd: Number(planData.annual_monthly_price_usd),
      annual_total_usd: Number(planData.annual_price_usd),
    } : null,
    server_time: now.toISOString(),
  });
});
