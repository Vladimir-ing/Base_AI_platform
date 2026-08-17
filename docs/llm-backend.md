# Secure LLM backend

The AI-base assistant can use a Supabase Edge Function as a server-side proxy to OpenAI. The browser never receives the OpenAI API key.

## Deployed function

- Supabase project: `VLV-Solomon`
- Function: `ai-base-assistant`
- Endpoint: `https://opndjkjfdlhjyuqwyyer.supabase.co/functions/v1/ai-base-assistant`

## Required Supabase Edge Function secrets

Open Supabase Dashboard → Edge Functions → Secrets and add:

- `OPENAI_API_KEY` — an OpenAI Platform API key.
- `ASSISTANT_SHARED_SECRET` — a long random value known only to you. Use at least 32 random characters.
- `OPENAI_MODEL` — optional. Defaults to `gpt-5.6`.

Do not commit real secret values to GitHub.

## Browser connection

Open the site → `✦ Помощник` → enter the value of `ASSISTANT_SHARED_SECRET` into `Ключ подключения к LLM` → `Подключить LLM`.

The connection key is stored only in `sessionStorage`, so it is removed when the browser tab/session is closed. It is not written to the application's `localStorage` database.

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

If the Edge Function is unavailable, not configured, rejects the connection key, times out, or the OpenAI request fails, the UI automatically falls back to the existing local assistant.

## Server behavior

The Edge Function:

- validates `x-assistant-key` against `ASSISTANT_SHARED_SECRET`;
- restricts CORS to the GitHub Pages origin plus localhost development origins;
- limits question and catalog sizes;
- calls the OpenAI Responses API server-side with `store: false`;
- returns answer text plus a small list of platform ids so the UI can render clickable recommendations.
