create table public.user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'trialing',
  plan text not null default 'trial',
  is_admin boolean not null default false,
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  subscribed_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_access_status_check check (status in ('trialing', 'active', 'expired', 'past_due', 'canceled')),
  constraint user_access_plan_check check (char_length(plan) between 1 and 80),
  constraint user_access_trial_dates_check check (trial_ends_at >= trial_started_at)
);

comment on table public.user_access is 'Server-managed account access, trial, subscription and admin state.';
comment on column public.user_access.is_admin is 'Server-managed flag. Never derived from user-editable metadata.';

create table public.llm_usage_events (
  id bigint generated always as identity primary key,
  request_id uuid not null default gen_random_uuid() unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null,
  model text not null,
  input_tokens bigint,
  output_tokens bigint,
  total_tokens bigint,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint llm_usage_status_check check (status in ('started', 'succeeded', 'failed', 'denied')),
  constraint llm_usage_input_tokens_check check (input_tokens is null or input_tokens >= 0),
  constraint llm_usage_output_tokens_check check (output_tokens is null or output_tokens >= 0),
  constraint llm_usage_total_tokens_check check (total_tokens is null or total_tokens >= 0),
  constraint llm_usage_error_code_check check (error_code is null or char_length(error_code) <= 120)
);

comment on table public.llm_usage_events is 'Server-only LLM request and token accounting; contains no prompts or vault content.';

create index llm_usage_events_user_created_idx on public.llm_usage_events (user_id, created_at desc);
create index llm_usage_events_created_idx on public.llm_usage_events (created_at desc);

alter table public.user_access enable row level security;
alter table public.llm_usage_events enable row level security;

revoke all on table public.user_access from public, anon, authenticated;
revoke all on table public.llm_usage_events from public, anon, authenticated;
revoke all on sequence public.llm_usage_events_id_seq from public, anon, authenticated;
grant select on table public.user_access to authenticated;

create policy "Users can read own access"
on public.user_access
for select
to authenticated
using ((select auth.uid()) = user_id);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_user_access_updated_at
before update on public.user_access
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_access (user_id, trial_started_at, trial_ends_at)
  values (new.id, new.created_at, new.created_at + interval '14 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_user_access() from public, anon, authenticated;

create trigger on_auth_user_created_access
after insert on auth.users
for each row execute function private.handle_new_user_access();

insert into public.user_access (user_id, trial_started_at, trial_ends_at)
select id, created_at, created_at + interval '14 days'
from auth.users
on conflict (user_id) do nothing;
