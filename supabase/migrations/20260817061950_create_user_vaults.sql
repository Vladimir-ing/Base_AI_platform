create table public.user_vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  schema_version smallint not null default 1,
  updated_at timestamptz not null default now(),
  constraint user_vaults_payload_is_object
    check (jsonb_typeof(payload) = 'object'),
  constraint user_vaults_payload_size
    check (octet_length(payload::text) <= 5 * 1024 * 1024),
  constraint user_vaults_schema_version_positive
    check (schema_version > 0)
);

comment on table public.user_vaults is
  'One cloud-synchronized AI platform vault per authenticated user. Secret fields remain browser-encrypted inside payload.';

alter table public.user_vaults enable row level security;

revoke all on table public.user_vaults from public, anon;
grant select, insert, update on table public.user_vaults to authenticated;

create policy "Users can read their own vault"
on public.user_vaults
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own vault"
on public.user_vaults
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own vault"
on public.user_vaults
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
