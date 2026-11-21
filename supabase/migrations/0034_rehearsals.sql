-- Ensaio do sermão (spec 8.7.5, RF-M02-03): the transcript, metrics and feedback of each rehearsal of a sermon outline.
-- The audio is NOT stored unless the preacher opts in (then it goes to a private bucket, one folder per user).
create table if not exists rehearsals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  outline_id uuid references sermon_outlines(id) on delete set null,
  transcript text not null default '',
  metrics jsonb not null default '{}'::jsonb,
  feedback jsonb not null default '{}'::jsonb,
  audio_url text,
  duration_s integer not null default 0,
  analysis_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists rehearsals_session_idx on rehearsals (session_id, created_at);
alter table rehearsals enable row level security;
drop policy if exists rehearsals_own on rehearsals;
create policy rehearsals_own on rehearsals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke truncate, references, trigger on rehearsals from authenticated;
revoke all on rehearsals from anon;

insert into storage.buckets (id, name, public) values ('rehearsals', 'rehearsals', false) on conflict (id) do update set public = false;
drop policy if exists rehearsals_audio_own on storage.objects;
create policy rehearsals_audio_own on storage.objects for all to authenticated
  using (bucket_id = 'rehearsals' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'rehearsals' and (storage.foldername(name))[1] = auth.uid()::text);
