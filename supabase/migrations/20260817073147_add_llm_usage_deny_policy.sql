create policy "No direct client access to LLM usage"
on public.llm_usage_events
for all
to authenticated
using (false)
with check (false);
