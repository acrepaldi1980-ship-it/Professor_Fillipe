-- Personalised study path (Module 2 of the teacher's guide): one plan per student, regenerated on the weekly review.
create table if not exists personal_paths (
  user_id uuid primary key references auth.users(id) on delete cascade,
  request jsonb not null,
  plan jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now()
);
alter table personal_paths enable row level security;
drop policy if exists personal_paths_own on personal_paths;
create policy personal_paths_own on personal_paths for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke truncate, references, trigger on personal_paths from authenticated;
revoke all on personal_paths from anon;
