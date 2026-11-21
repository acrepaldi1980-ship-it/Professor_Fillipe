-- Aprofundar (spec 8.7.4 + 8.18 research): the deep study document of a session, like lesson_plans and sermon_outlines.
create table if not exists deep_studies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id)
);
alter table deep_studies enable row level security;
drop policy if exists deep_studies_own on deep_studies;
create policy deep_studies_own on deep_studies for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke truncate, references, trigger on deep_studies from authenticated;
revoke all on deep_studies from anon;
