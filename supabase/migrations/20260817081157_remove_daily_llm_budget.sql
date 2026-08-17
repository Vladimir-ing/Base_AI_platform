drop function if exists public.reserve_llm_daily_budget(uuid, text, numeric);

alter table public.product_settings
  drop constraint if exists product_settings_daily_llm_budget_check,
  drop column if exists daily_llm_budget_usd;

create or replace function public.start_llm_usage_event(
  p_user_id uuid,
  p_model text,
  p_estimated_cost_usd numeric,
  p_monthly_limit integer default null
)
returns table (
  allowed boolean,
  usage_id bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  v_used integer;
  v_usage_id bigint;
begin
  if p_user_id is null or p_model is null or p_estimated_cost_usd is null or p_estimated_cost_usd <= 0 then
    raise exception 'Invalid LLM usage event';
  end if;
  if p_monthly_limit is not null and p_monthly_limit < 1 then
    raise exception 'Invalid monthly LLM limit';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('llm-monthly-user:' || p_user_id::text || ':' || v_month_start::text, 0));

  if p_monthly_limit is not null then
    select count(*)::integer
    into v_used
    from public.llm_usage_events
    where user_id = p_user_id
      and created_at >= v_month_start
      and status in ('started', 'succeeded', 'failed');

    if v_used >= p_monthly_limit then
      return query select false, null::bigint;
      return;
    end if;
  end if;

  insert into public.llm_usage_events (user_id, status, model, estimated_cost_usd)
  values (p_user_id, 'started', left(p_model, 120), p_estimated_cost_usd)
  returning id into v_usage_id;

  return query select true, v_usage_id;
end;
$$;

revoke all on function public.start_llm_usage_event(uuid, text, numeric, integer) from public, anon, authenticated;
grant execute on function public.start_llm_usage_event(uuid, text, numeric, integer) to service_role;

comment on function public.start_llm_usage_event(uuid, text, numeric, integer)
is 'Atomically enforces a per-user UTC monthly request limit and starts a technical usage event. Callable only with the server role.';
