alter table public.product_settings
  add column daily_llm_budget_usd numeric(8, 4) not null default 1.0000,
  add column llm_input_usd_per_million numeric(10, 4) not null default 5.0000,
  add column llm_output_usd_per_million numeric(10, 4) not null default 30.0000,
  add column llm_max_output_tokens integer not null default 1200,
  add constraint product_settings_daily_llm_budget_check check (daily_llm_budget_usd > 0 and daily_llm_budget_usd <= 10000),
  add constraint product_settings_llm_input_price_check check (llm_input_usd_per_million > 0),
  add constraint product_settings_llm_output_price_check check (llm_output_usd_per_million > 0),
  add constraint product_settings_llm_max_output_check check (llm_max_output_tokens between 128 and 8192);

alter table public.llm_usage_events
  add column budget_day date,
  add column estimated_cost_usd numeric(14, 8),
  add column actual_cost_usd numeric(14, 8),
  add constraint llm_usage_estimated_cost_check check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  add constraint llm_usage_actual_cost_check check (actual_cost_usd is null or actual_cost_usd >= 0);

update public.llm_usage_events
set budget_day = (created_at at time zone 'UTC')::date
where budget_day is null;

alter table public.llm_usage_events
  alter column budget_day set default ((now() at time zone 'UTC')::date),
  alter column budget_day set not null;

create index llm_usage_events_budget_day_status_idx
on public.llm_usage_events (budget_day, status)
include (estimated_cost_usd, actual_cost_usd);

grant select, insert, update on table public.llm_usage_events to service_role;
grant usage, select on sequence public.llm_usage_events_id_seq to service_role;

create or replace function public.reserve_llm_daily_budget(
  p_user_id uuid,
  p_model text,
  p_estimated_cost_usd numeric
)
returns table (
  allowed boolean,
  usage_id bigint,
  spent_before_usd numeric,
  budget_usd numeric,
  remaining_usd numeric
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'UTC')::date;
  v_budget numeric;
  v_spent numeric;
  v_usage_id bigint;
begin
  if p_user_id is null or p_model is null or p_estimated_cost_usd is null or p_estimated_cost_usd <= 0 then
    raise exception 'Invalid LLM budget reservation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('llm-daily-budget:' || v_day::text, 0));

  select daily_llm_budget_usd
  into v_budget
  from public.product_settings
  where singleton;

  if v_budget is null then
    raise exception 'LLM daily budget is not configured';
  end if;

  select coalesce(sum(
    case
      when status = 'succeeded' then coalesce(actual_cost_usd, estimated_cost_usd, 0)
      when status = 'started' then coalesce(estimated_cost_usd, 0)
      else 0
    end
  ), 0)
  into v_spent
  from public.llm_usage_events
  where budget_day = v_day
    and status in ('started', 'succeeded');

  if v_spent + p_estimated_cost_usd > v_budget then
    return query select false, null::bigint, v_spent, v_budget, greatest(v_budget - v_spent, 0);
    return;
  end if;

  insert into public.llm_usage_events (
    user_id, status, model, budget_day, estimated_cost_usd
  ) values (
    p_user_id, 'started', left(p_model, 120), v_day, p_estimated_cost_usd
  )
  returning id into v_usage_id;

  return query select true, v_usage_id, v_spent, v_budget, greatest(v_budget - v_spent - p_estimated_cost_usd, 0);
end;
$$;

revoke all on function public.reserve_llm_daily_budget(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.reserve_llm_daily_budget(uuid, text, numeric) to service_role;

comment on function public.reserve_llm_daily_budget(uuid, text, numeric)
is 'Atomically reserves estimated OpenAI cost against the global UTC daily budget. Callable only with the server role.';
