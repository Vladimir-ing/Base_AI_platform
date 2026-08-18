# Cloud synchronization

The application keeps a local cache in `localStorage` and synchronizes one JSON vault per authenticated user with `public.user_vaults` in Supabase.

## Access model

- `user_id` is both the primary key and a foreign key to `auth.users.id`.
- RLS is enabled.
- `anon` has no table privileges.
- `authenticated` can select, insert, and update only the row where `user_id = auth.uid()`.
- Delete is not exposed to authenticated browser clients.
- The frontend uses the publishable key and the current user session. It never uses a secret or service-role key.

## Data and encryption

The complete application state is stored in the JSON `payload`. Passwords, API keys, and private notes remain AES-GCM encrypted by the existing browser vault before synchronization. Catalog descriptions and subscription fields are not encrypted.

The payload is limited to 5 MiB. `schema_version` allows future client migrations.

## Synchronization behavior

- On first sign-in, an existing local database is uploaded when no cloud row exists.
- When a cloud row exists, it is loaded into the local cache.
- Local saves are debounced.
- Every cloud row has a server-controlled `revision`.
- A save succeeds only when the browser sends the revision it most recently loaded.
- The database increments the revision and sets `updated_at` with server time in one atomic function call.
- A stale browser receives `vault_conflict`; it cannot silently overwrite newer data.
- The conflict dialog lets the user either load the current cloud copy or explicitly replace it with the local copy.
- Failed writes remain local and are retried when the browser returns online.
- Returning to the tab checks for a newer cloud revision when there are no unsynchronized local changes.

JSON export remains available as an independent backup and migration path.

## Deployment order

The migrations `20260817102409_add_user_vault_revisions.sql`, `20260817111254_fix_user_vault_revision_ambiguity.sql`, and `20260818022935_use_http_vault_conflict.sql` must be applied before the matching frontend is published. The second migration replaces the RPC body with explicit table aliases so PostgreSQL can distinguish table columns from `RETURNS TABLE` output variables. The third returns a stale revision as PostgREST `PT409` instead of a transaction-rollback SQLSTATE. Until all migrations exist in the target Supabase project, the frontend intentionally keeps changes local instead of falling back to an unsafe unconditional upsert.

After applying the migration, verify:

- a local unsynced copy only auto-saves on startup when its stored base revision still matches the cloud revision;
- if the cloud revision changed while the browser was closed, startup shows an explicit conflict instead of adopting the new revision and overwriting it;
- legacy dirty caches without a stored base revision also require an explicit conflict choice;

1. an existing user can load and save normally;
2. a new user creates revision `1`;
3. two browsers opened on the same account cannot silently overwrite one another;
4. choosing the cloud copy clears the local conflict without writing;
5. choosing the local copy performs a new revision-checked save;
6. different accounts remain isolated by RLS and the browser cache binding.
