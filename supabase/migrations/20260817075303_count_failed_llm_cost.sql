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
      when status in ('succeeded', 'failed') then coalesce(actual_cost_usd, estimated_cost_usd, 0)
      when status = 'started' then coalesce(estimated_cost_usd, 0)
      else 0
    end
  ), 0)
  into v_spent
  from public.llm_usage_events
  where budget_day = v_day
    and status in ('started', 'succeeded', 'failed');

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
