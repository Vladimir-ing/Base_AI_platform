create table public.billing_plans (
  code text primary key,
  name text not null,
  platform_limit integer,
  llm_monthly_limit integer,
  monthly_price_usd numeric(8, 2) not null,
  annual_monthly_price_usd numeric(8, 2) not null,
  annual_price_usd numeric(8, 2) not null,
  sort_order smallint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_plans_code_check check (code in ('basic', 'pro', 'max')),
  constraint billing_plans_name_check check (char_length(name) between 1 and 80),
  constraint billing_plans_platform_limit_check check (platform_limit is null or platform_limit > 0),
  constraint billing_plans_llm_limit_check check (llm_monthly_limit is null or llm_monthly_limit > 0),
  constraint billing_plans_prices_check check (
    monthly_price_usd >= 0 and annual_monthly_price_usd >= 0 and annual_price_usd >= 0
  )
);

comment on table public.billing_plans is 'Public product plan limits and USD prices. Null limit means product-level unlimited.';

insert into public.billing_plans
  (code, name, platform_limit, llm_monthly_limit, monthly_price_usd, annual_monthly_price_usd, annual_price_usd, sort_order)
values
  ('basic', 'Basic', 10, 20, 0, 0, 0, 10),
  ('pro', 'Pro', 50, 200, 6, 5, 60, 20),
  ('max', 'Max', null, null, 12, 10, 120, 30);

alter table public.billing_plans enable row level security;
revoke all on table public.billing_plans from public, anon, authenticated;
grant select on table public.billing_plans to anon, authenticated;

create policy "Anyone can read active billing plans"
on public.billing_plans
for select
to anon, authenticated
using (is_active);

alter table public.user_access
  add column billing_interval text,
  add constraint user_access_billing_interval_check check (billing_interval is null or billing_interval in ('month', 'year'));

create trigger set_billing_plans_updated_at
before update on public.billing_plans
for each row execute function private.set_updated_at();

create or replace function private.vault_platforms_within_limit(target_user_id uuid, target_payload jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      access.is_admin
      or (access.status = 'trialing' and access.trial_ends_at > now())
      or plans.platform_limit is null
      or jsonb_array_length(coalesce(target_payload -> 'platforms', '[]'::jsonb)) <= plans.platform_limit
    from public.user_access as access
    left join public.billing_plans as plans
      on plans.code = case
        when access.status = 'trialing' and access.trial_ends_at <= now() then 'basic'
        when access.plan in ('basic', 'pro', 'max') then access.plan
        else 'basic'
      end
    where access.user_id = target_user_id
  ), false);
$$;

revoke all on function private.vault_platforms_within_limit(uuid, jsonb) from public, anon;
grant execute on function private.vault_platforms_within_limit(uuid, jsonb) to authenticated;

drop policy "Users can create their own vault" on public.user_vaults;
create policy "Users can create their own vault"
on public.user_vaults
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and private.vault_platforms_within_limit(user_id, payload)
);

drop policy "Users can update their own vault" on public.user_vaults;
create policy "Users can update their own vault"
on public.user_vaults
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and private.vault_platforms_within_limit(user_id, payload)
);
