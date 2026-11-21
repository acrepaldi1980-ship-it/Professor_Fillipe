-- Guided paths and study streak (Prompt 2.7).
create table if not exists path_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id text not null,
  started_at timestamptz not null default now(),
  done_days int[] not null default '{}',
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, path_id)
);
alter table path_progress enable row level security;
drop policy if exists path_progress_own on path_progress;
create policy path_progress_own on path_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke truncate, references, trigger on path_progress from authenticated;
revoke all on path_progress from anon;

-- Milestones reached (a streak of N days, a finished path): shown once, kept to avoid repeating the celebration.
create table if not exists user_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  reached_at timestamptz not null default now(),
  seen boolean not null default false,
  unique (user_id, kind)
);
alter table user_milestones enable row level security;
drop policy if exists user_milestones_own on user_milestones;
create policy user_milestones_own on user_milestones for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke truncate, references, trigger on user_milestones from authenticated;
revoke all on user_milestones from anon;

-- Days on which the student studied: a day with at least one message of theirs, in their time zone. Only their own rows (row level security applies).
create or replace function study_days(p_tz text default 'America/Sao_Paulo')
returns table (day date) language sql stable set search_path = public as $$
  select distinct ((m.created_at at time zone (case when exists (select 1 from pg_timezone_names z where z.name = p_tz) then p_tz else 'America/Sao_Paulo' end))::date) as day
    from messages m join sessions s on s.id = m.session_id
   where s.user_id = auth.uid() and m.role = 'user' and m.created_at > now() - interval '400 days'
   order by 1 desc;
$$;
revoke all on function study_days(text) from public, anon;
grant execute on function study_days(text) to authenticated;
