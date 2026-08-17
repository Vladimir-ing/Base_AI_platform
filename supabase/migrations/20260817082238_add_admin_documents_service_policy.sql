create policy admin_documents_service_role_select
on private.admin_documents
for select
to service_role
using (true);
