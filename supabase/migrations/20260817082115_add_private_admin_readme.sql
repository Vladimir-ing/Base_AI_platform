create table private.admin_documents (
  slug text primary key,
  content text not null,
  updated_at timestamptz not null default now(),
  constraint admin_documents_slug_check check (slug ~ '^[a-z0-9_-]{1,80}$')
);

alter table private.admin_documents enable row level security;

revoke all on table private.admin_documents from public, anon, authenticated;
grant usage on schema private to service_role;
grant select on table private.admin_documents to service_role;

create or replace function public.get_admin_document(p_slug text)
returns text
language sql
security invoker
set search_path = ''
stable
as $$
  select content
  from private.admin_documents
  where slug = p_slug
$$;

revoke all on function public.get_admin_document(text) from public, anon, authenticated;
grant execute on function public.get_admin_document(text) to service_role;

comment on table private.admin_documents
is 'Private operational documentation returned only by an authenticated admin Edge Function.';

comment on function public.get_admin_document(text)
is 'Reads one private admin document. Callable only by the server role.';
