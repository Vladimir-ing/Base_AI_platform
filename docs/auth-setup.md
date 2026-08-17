# AI CORE — Supabase Auth setup

## Что уже реализовано

- `Get Started` → `auth.html?mode=signup`
- `Sign In` → `auth.html?mode=signin`
- Email + password registration via `supabase.auth.signUp()`
- Email + password login via `supabase.auth.signInWithPassword()`
- Existing session → dashboard
- No session → auth screen when Supabase config is active
- Sign Out → landing page
- RU / EN auth UI

## 1. Publishable key

Open Supabase Dashboard → Project Settings / API Keys and copy the project's **publishable key** (`sb_publishable_...`).

Set it in:

`assets/supabase-config.js`

Replace:

`PASTE_SB_PUBLISHABLE_KEY_HERE`

Do **not** put a service role key or secret key in browser code.

Current project URL configured in the repository:

`https://hjbsrcreekzmrpplmrng.supabase.co`

## 2. Auth URL configuration

In Supabase Dashboard → Authentication → URL Configuration set production Site URL to:

`https://vladimir-ing.github.io/Base_AI_platform/`

Add this exact Redirect URL:

`https://vladimir-ing.github.io/Base_AI_platform/ai-platforms.html`

For local development, add only the localhost URLs actually used during testing.

## 3. Email provider

Email/password auth must be enabled in Authentication → Sign In / Providers.

If email confirmation is enabled, a new user receives a confirmation email and is sent to the allowed dashboard redirect after confirmation.

## 4. Security boundary

Frontend may contain only the Supabase project URL and publishable key. Never expose `service_role`, `sb_secret_...`, OpenAI API keys, or other server secrets.

## 5. Current fail-open behavior

Until the placeholder publishable key is replaced, the existing dashboard remains accessible. This avoids locking the current owner out while Supabase connection/configuration is incomplete.

After a valid publishable key is configured, unauthenticated direct access to `ai-platforms.html` redirects to `auth.html?mode=signin`.
