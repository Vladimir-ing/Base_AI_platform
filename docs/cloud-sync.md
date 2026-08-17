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
- Local saves are debounced and upserted atomically.
- Failed writes remain local and are retried when the browser returns online.
- Returning to the tab checks for a newer cloud copy when there are no unsynchronized local changes.
- Concurrent edits use last-write-wins behavior.

JSON export remains available as an independent backup and migration path.
