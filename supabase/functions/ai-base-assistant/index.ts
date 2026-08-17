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
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://vladimir-ing.github.io";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("OPENAI_API_KEY") || "";
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-5.6";

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return json(req, { error: "unauthorized" }, 401);
  }

  const publishableKeyNames = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
  const publishableKeyName = publishableKeyNames.default || "";
  const publishableKey = (publishableKeyName && Deno.env.get(publishableKeyName)) ||
    Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return json(req, { error: "unauthorized" }, 401);
  }

  if (!apiKey) return json(req, { error: "backend_not_configured" }, 503);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid_json" }, 400);
  }

  const query = cleanString(body?.query, 1200);
  const rawPlatforms = Array.isArray(body?.platforms) ? body.platforms.slice(0, 120) : [];
  if (!query) return json(req, { error: "empty_query" }, 400);

  const platforms = rawPlatforms.map((p: any) => ({
    id: cleanString(p?.id, 120),
    name: cleanString(p?.name, 160),
    category: cleanString(p?.category, 120),
    status: cleanString(p?.status, 80),
    purpose: cleanString(p?.purpose, 900),
    strengths: cleanString(p?.strengths, 1200),
    tips: Array.isArray(p?.tips) ? p.tips.slice(0, 8).map((x: unknown) => cleanString(x, 500)) : [],
    tags: Array.isArray(p?.tags) ? p.tags.slice(0, 20).map((x: unknown) => cleanString(x, 80)) : [],
    rating: Number(p?.rating || 0),
    usage: cleanString(p?.usage, 80),
    pinned: Boolean(p?.pinned),
    plan: {
      tier: cleanString(p?.plan?.tier, 120),
      price: Number(p?.plan?.price || p?.plan?.cost || 0),
      currency: cleanString(p?.plan?.currency, 16),
      period: cleanString(p?.plan?.period, 60),
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

  let upstream: Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input,
        store: false,
      }),
    });
  } catch {
    return json(req, { error: "upstream_unreachable" }, 502);
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return json(req, { error: "openai_error", status: upstream.status }, 502);
  }

  const text = extractOutputText(data);
  if (!text) return json(req, { error: "empty_model_response" }, 502);

  const marker = /\n?RECOMMENDED_IDS:\s*([^\n]+)/i.exec(text);
  const ids = marker && marker[1].trim().toLowerCase() !== "none"
    ? marker[1].split(",").map((x: string) => x.trim()).filter(Boolean).slice(0, 5)
    : [];
  const answer = marker ? text.replace(marker[0], "").trim() : text.trim();
  const knownIds = new Set(platforms.map((p: any) => p.id));

  return json(req, {
    answer,
    recommended_ids: ids.filter((id: string) => knownIds.has(id)),
    model,
  });
});
