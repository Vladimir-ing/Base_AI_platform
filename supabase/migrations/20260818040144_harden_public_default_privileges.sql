-- Future public objects must be exposed deliberately. Existing grants and RLS
-- policies are unchanged; migrations that add API objects must grant access
-- explicitly to the roles that need it.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on functions from public, anon, authenticated, service_role;
