alter table public.user_vaults
  add column revision bigint not null default 1,
  add constraint user_vaults_revision_positive check (revision > 0);

create or replace function public.save_user_vault(
  p_payload jsonb,
  p_schema_version smallint,
  p_expected_revision bigint
)
returns table (revision bigint, updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'invalid_expected_revision';
  end if;

  if p_expected_revision = 0 then
    return query
      insert into public.user_vaults (
        user_id,
        payload,
        schema_version,
        revision,
        updated_at
      )
      values (v_user_id, p_payload, p_schema_version, 1, now())
      on conflict (user_id) do nothing
      returning user_vaults.revision, user_vaults.updated_at;
  else
    return query
      update public.user_vaults
      set payload = p_payload,
          schema_version = p_schema_version,
          revision = user_vaults.revision + 1,
          updated_at = now()
      where user_id = v_user_id
        and revision = p_expected_revision
      returning user_vaults.revision, user_vaults.updated_at;
  end if;

  if not found then
    raise exception using errcode = '40001', message = 'vault_conflict';
  end if;
end;
$$;

revoke execute on function public.save_user_vault(jsonb, smallint, bigint)
  from public, anon;
grant execute on function public.save_user_vault(jsonb, smallint, bigint)
  to authenticated;
