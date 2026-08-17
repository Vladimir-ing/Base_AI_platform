create table public.product_settings (
  singleton boolean primary key default true,
  billing_enabled boolean not null default false,
  free_preview_enabled boolean not null default true,
  trial_days smallint not null default 14,
  updated_at timestamptz not null default now(),
  constraint product_settings_singleton_check check (singleton),
  constraint product_settings_trial_days_check check (trial_days between 0 and 90)
);

comment on table public.product_settings is 'Single server-managed product access switch. Free preview bypasses plan limits without deleting future pricing.';

insert into public.product_settings (singleton, billing_enabled, free_preview_enabled, trial_days)
values (true, false, true, 14);

alter table public.product_settings enable row level security;
revoke all on table public.product_settings from public, anon, authenticated;
grant select on table public.product_settings to authenticated;

create policy "Authenticated users can read product mode"
on public.product_settings
for select
to authenticated
using (true);

create trigger set_product_settings_updated_at
before update on public.product_settings
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
      settings.free_preview_enabled
      or access.is_admin
      or (access.status = 'trialing' and access.trial_ends_at > now())
      or plans.platform_limit is null
      or jsonb_array_length(coalesce(target_payload -> 'platforms', '[]'::jsonb)) <= plans.platform_limit
    from public.user_access as access
    cross join public.product_settings as settings
    left join public.billing_plans as plans
      on plans.code = case
        when access.status = 'trialing' and access.trial_ends_at <= now() then 'basic'
        when access.plan in ('basic', 'pro', 'max') then access.plan
        else 'basic'
      end
    where access.user_id = target_user_id and settings.singleton
  ), false);
$$;
