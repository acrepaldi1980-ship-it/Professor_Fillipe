-- Prompt 1.5: the teacher's prompt layers are read from prompt_versions (active version); answer flags and session summaries.
create or replace function api_active_prompts()
returns table (layer text, content text, version int)
language sql stable security definer set search_path = public as $$
  select distinct on (layer) layer, content, version from prompt_versions where active order by layer, version desc
$$;
revoke all on function api_active_prompts() from public;
grant execute on function api_active_prompts() to anon, authenticated;

-- One active version per layer.
create unique index if not exists prompt_versions_one_active on prompt_versions (layer) where active;

-- Session summaries are written by the owner through the API (token of the user, RLS).
drop policy if exists session_summaries_owner on session_summaries;
create policy session_summaries_owner on session_summaries for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
