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

function cleanString(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function extractOutputText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  const chunks: string[] = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === "output_text" && typeof part?.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

function tokenCostUsd(inputTokens: number, outputTokens: number, inputRate: number, outputRate: number) {
  const longContext = inputTokens > 272000;
  const effectiveInputRate = inputRate * (longContext ? 2 : 1);
  const effectiveOutputRate = outputRate * (longContext ? 1.5 : 1);
  return (inputTokens * effectiveInputRate + outputTokens * effectiveOutputRate) / 1_000_000;
}

function nextUtcDayIso() {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

async function markUsage(server: any, id: number | null, values: Record<string, unknown>) {
  if (id != null) await server.from("llm_usage_events").update(values).eq("id", id);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("OPENAI_API_KEY") || "";
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-5.6";
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json(req, { error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
  const publishableKey = publishableKeys.default || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serverKey = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const supabase = createClient(url, publishableKey, options);
  const server = createClient(url, serverKey, options);

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json(req, { error: "unauthorized" }, 401);
  const userId = authData.user.id;

  const { data: access, error: accessError } = await server
    .from("user_access")
    .select("status,plan,is_admin,trial_started_at,trial_ends_at")
    .eq("user_id", userId)
    .single();
  if (accessError || !access) return json(req, { error: "access_unavailable" }, 503);

  const { data: settings, error: settingsError } = await server
    .from("product_settings")
    .select("free_preview_enabled,free_preview_llm_monthly_limit,daily_llm_budget_usd,llm_input_usd_per_million,llm_output_usd_per_million,llm_max_output_tokens")
    .eq("singleton", true)
    .single();
  if (settingsError || !settings) return json(req, { error: "settings_unavailable" }, 503);

  const now = new Date();
  const isPreview = Boolean(settings.free_preview_enabled);
  const trialActive = !isPreview && !access.is_admin && access.status === "trialing" && new Date(access.trial_ends_at) > now;
  let effectivePlan = access.is_admin ? "owner" : ((isPreview || trialActive) ? "max" : (["basic", "pro", "max"].includes(access.plan) ? access.plan : "basic"));
  if (!isPreview && !access.is_admin && access.status === "trialing" && !trialActive) {
    effectivePlan = "basic";
    await server.from("user_access").update({ status: "active", plan: "basic", last_seen_at: now.toISOString() }).eq("user_id", userId);
  }

  let llmRemaining: number | null = null;
  if (!access.is_admin && !trialActive) {
    let monthlyLimit: number | null = isPreview ? Number(settings.free_preview_llm_monthly_limit) : null;
    if (!isPreview) {
      const { data: planData, error: planError } = await server
        .from("billing_plans").select("llm_monthly_limit").eq("code", effectivePlan).single();
      if (planError || !planData) return json(req, { error: "plan_unavailable" }, 503);
      monthlyLimit = planData.llm_monthly_limit;
    }
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { count, error: countError } = await server
      .from("llm_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart)
      .in("status", ["started", "succeeded", "failed"]);
    if (countError) return json(req, { error: "usage_unavailable" }, 503);
    const used = count || 0;
    if (monthlyLimit != null && used >= monthlyLimit) {
      const errorCode = isPreview ? "preview_llm_limit" : "plan_llm_limit";
      await server.from("llm_usage_events").insert({ user_id: userId, status: "denied", model, error_code: errorCode });
      return json(req, { error: errorCode, llm_remaining: 0 }, 429);
    }
    llmRemaining = monthlyLimit == null ? null : monthlyLimit - used - 1;
  }

  if (!apiKey) return json(req, { error: "backend_not_configured" }, 503);

  let body: any;
  try { body = await req.json(); }
  catch { return json(req, { error: "invalid_json" }, 400); }

  const query = cleanString(body?.query, 1200);
  const rawPlatforms = Array.isArray(body?.platforms) ? body.platforms.slice(0, 120) : [];
  if (!query) return json(req, { error: "empty_query" }, 400);

  const platforms = rawPlatforms.map((p: any) => ({
    id: cleanString(p?.id, 120), name: cleanString(p?.name, 160),
    category: cleanString(p?.category, 120), status: cleanString(p?.status, 80),
    purpose: cleanString(p?.purpose, 900), strengths: cleanString(p?.strengths, 1200),
    tips: Array.isArray(p?.tips) ? p.tips.slice(0, 8).map((x: unknown) => cleanString(x, 500)) : [],
    tags: Array.isArray(p?.tags) ? p.tags.slice(0, 20).map((x: unknown) => cleanString(x, 80)) : [],
    rating: Number(p?.rating || 0), usage: cleanString(p?.usage, 80), pinned: Boolean(p?.pinned),
    plan: {
      tier: cleanString(p?.plan?.tier, 120), price: Number(p?.plan?.price || p?.plan?.cost || 0),
      currency: cleanString(p?.plan?.currency, 16), period: cleanString(p?.plan?.period, 60),
      renewsOn: cleanString(p?.plan?.renewsOn || p?.plan?.renewal, 40),
    },
  }));

  const instructions = [
    "Ты — помощник по личной базе AI-инструментов пользователя.",
    "Отвечай по-русски, кратко и практично.",
    "Используй только данные из переданного каталога. Не выдумывай характеристики, цены или факты, которых нет в данных.",
    "Если данных недостаточно, прямо скажи об этом.",
    "Для рекомендаций учитывай статус, рейтинг, частоту использования, назначение, сильные стороны и стоимость.",
    "Не предлагай автоматически отменять подписки: формулируй как кандидатов на проверку.",
    "В конце отдельной строкой выведи RECOMMENDED_IDS: и через запятую до 5 id реально упомянутых карточек. Если рекомендаций нет — RECOMMENDED_IDS: none.",
  ].join("\n");
  const input = `${instructions}\n\nВОПРОС:\n${query}\n\nКАТАЛОГ:\n${JSON.stringify(platforms)}`;

  const inputRate = Number(settings.llm_input_usd_per_million);
  const outputRate = Number(settings.llm_output_usd_per_million);
  const maxOutputTokens = Number(settings.llm_max_output_tokens);
  const estimatedInputTokens = Math.ceil(input.length / 2);
  const estimatedCostUsd = Number((tokenCostUsd(
    estimatedInputTokens,
    maxOutputTokens,
    inputRate,
    outputRate,
  ) * 1.15).toFixed(8));

  const reservation = await server.rpc("reserve_llm_daily_budget", {
    p_user_id: userId,
    p_model: model,
    p_estimated_cost_usd: estimatedCostUsd,
  });
  const reserved = Array.isArray(reservation.data) ? reservation.data[0] : reservation.data;
  if (reservation.error || !reserved) return json(req, { error: "budget_unavailable" }, 503);
  if (!reserved.allowed) {
    return json(req, {
      error: "daily_budget_exhausted",
      budget_usd: Number(reserved.budget_usd),
      remaining_usd: Number(reserved.remaining_usd),
      resets_at: nextUtcDayIso(),
    }, 429);
  }
  const usageId = Number(reserved.usage_id);

  let upstream: Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input,
        store: false,
        max_output_tokens: maxOutputTokens,
        reasoning: { effort: "low" },
      }),
    });
  } catch {
    await markUsage(server, usageId, { status: "failed", error_code: "upstream_unreachable", actual_cost_usd: 0, completed_at: new Date().toISOString() });
    return json(req, { error: "upstream_unreachable" }, 502);
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    await markUsage(server, usageId, { status: "failed", error_code: `openai_${upstream.status}`, actual_cost_usd: 0, completed_at: new Date().toISOString() });
    return json(req, { error: "openai_error", status: upstream.status }, 502);
  }

  const inputTokens = Number(data?.usage?.input_tokens || 0);
  const outputTokens = Number(data?.usage?.output_tokens || 0);
  const totalTokens = Number(data?.usage?.total_tokens || inputTokens + outputTokens);
  const actualCostUsd = Number(tokenCostUsd(inputTokens, outputTokens, inputRate, outputRate).toFixed(8));
  const text = extractOutputText(data);
  if (!text) {
    await markUsage(server, usageId, { status: "failed", error_code: "empty_model_response", input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: totalTokens, actual_cost_usd: actualCostUsd, completed_at: new Date().toISOString() });
    return json(req, { error: "empty_model_response" }, 502);
  }

  const marker = /\n?RECOMMENDED_IDS:\s*([^\n]+)/i.exec(text);
  const ids = marker && marker[1].trim().toLowerCase() !== "none"
    ? marker[1].split(",").map((x: string) => x.trim()).filter(Boolean).slice(0, 5) : [];
  const answer = marker ? text.replace(marker[0], "").trim() : text.trim();
  const knownIds = new Set(platforms.map((p: any) => p.id));
  await markUsage(server, usageId, {
    status: "succeeded", input_tokens: inputTokens, output_tokens: outputTokens,
    total_tokens: totalTokens, actual_cost_usd: actualCostUsd, completed_at: new Date().toISOString(),
  });

  return json(req, {
    answer,
    recommended_ids: ids.filter((id: string) => knownIds.has(id)),
    model,
    llm_remaining: llmRemaining,
    daily_budget_remaining_usd: Math.max(0, Number(reserved.budget_usd) - Number(reserved.spent_before_usd) - actualCostUsd),
  });
});
