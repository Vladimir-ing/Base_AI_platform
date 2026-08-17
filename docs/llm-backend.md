# Secure LLM backend

The AI-base assistant can use a Supabase Edge Function as a server-side proxy to OpenAI. The browser never receives the OpenAI API key.

## Deployed function

- Supabase project: `Vladimir-ing's Project`
- Function: `ai-base-assistant`
- Endpoint: `https://hjbsrcreekzmrpplmrng.supabase.co/functions/v1/ai-base-assistant`

## Required Supabase Edge Function secrets

Open Supabase Dashboard → Edge Functions → Secrets and add:

- `OPENAI_API_KEY` — an OpenAI Platform API key.
- `OPENAI_MODEL` — optional. Defaults to `gpt-5.6`.

Do not commit real secret values to GitHub.

## Browser connection

The browser sends the current Supabase access token automatically. There is no separate LLM connection key in the interface. The Edge Function rejects requests without a valid authenticated user.

## Data sent to the LLM

Only a sanitized projection of platform records is sent:

- id and name;
- category and status;
- purpose and strengths;
- tips and tags;
- rating and usage frequency;
- pinned flag;
- plan tier, price, currency, period and renewal date.

The request does **not** include account login, authentication method, password, API key, encrypted secret payload, private secret notes, or vault state.

## Failure behavior

If the Edge Function is unavailable, not configured, rejects the user session, times out, or the OpenAI request fails, the UI automatically falls back to the existing local assistant.

## Server behavior

The Edge Function:

- requires a valid Supabase access token and verifies the user server-side;
- restricts CORS to the GitHub Pages origin plus localhost development origins;
- limits question and catalog sizes;
- calls the OpenAI Responses API server-side with `store: false`;
- returns answer text plus a small list of platform ids so the UI can render clickable recommendations.
- records request status and token counts for admin statistics, but never stores the question, answer, catalog payload, login, or secret;
- reads the server-managed product mode and plan. During free preview, all authenticated users have product-level unlimited access; future Basic and Pro monthly limits are already defined but disabled.
