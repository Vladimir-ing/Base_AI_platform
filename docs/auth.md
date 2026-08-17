# Supabase Auth

The static GitHub Pages application uses Supabase email/password authentication.

## Project

- Project ref: `hjbsrcreekzmrpplmrng`
- Client: `@supabase/supabase-js` `2.112.3`
- Browser credentials: project URL and publishable key only
- Secret/service-role keys must never be added to this repository

## Routes

- `login.html`: sign in, sign up, password recovery, and password update
- `ai-platforms.html`: protected application route
- `index.html`: redirects to the protected application route

The route guard validates the current user with Supabase before loading `assets/app.js`. Missing or invalid sessions are redirected to `login.html`. Signing out removes the local browser session.

## Required dashboard URL configuration

In **Authentication → URL Configuration**, set:

- Site URL: `https://vladimir-ing.github.io/Base_AI_platform/`
- Redirect URLs:
  - `https://vladimir-ing.github.io/Base_AI_platform/ai-platforms.html`
  - `https://vladimir-ing.github.io/Base_AI_platform/login.html`

Email/password authentication is enabled by default on hosted projects. Email confirmation is enabled by default and should remain enabled.

## Security boundary

GitHub Pages is static hosting. The guard controls the application experience, but HTML and JavaScript assets remain publicly downloadable. Sensitive server operations must validate Supabase JWTs, and user data moved to Postgres must use RLS policies based on `auth.uid()`.
