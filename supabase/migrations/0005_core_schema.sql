-- Core schema (spec 9.1, 9.2, 9.3 remaining, 9.4 non-P1) with Row Level Security on every table.
-- Sensitive columns (ministry_role, lenses) are stored encrypted by the application (FIELD_ENCRYPTION_KEY, AES-256-GCM)
-- as text; the database never sees the plaintext.

set check_function_bodies = off;

-- ---------- helpers ----------
create or replace function app_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where user_id = auth.uid()), 'anon')
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select app_role() = 'admin'
$$;

create or replace function is_reviewer() returns boolean
language sql stable security definer set search_path = public as $$
  select app_role() in ('admin', 'reviewer')
$$;

-- ---------- 9.1 users and profile ----------
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_name text,
  birth_date date,
  is_minor boolean not null default false,
  guardian_email text,
  timezone text not null default 'America/Sao_Paulo',
  locale text not null default 'pt-BR',
  study_experience text check (study_experience in ('starting','lt_2y','2_10y','gt_10y')),
  goals text[] not null default '{}',
  ministry_role_enc text,                       -- sensitive, encrypted by the app
  teaching_age_group text check (teaching_age_group in ('kids','teens','youth','adults','mixed')),
  daily_minutes int check (daily_minutes in (5,10,20,30,60)),
  preferred_formats text[] not null default '{}',
  first_topic text,
  level_score int check (level_score between 0 and 100),
  level text check (level in ('iniciante','intermediário','avançado')),
  ui_prefs jsonb not null default '{}',
  role text not null default 'student' check (role in ('student','church_admin','church_teacher','reviewer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lenses_enc text,                              -- sensitive, encrypted by the app
  main_version_id text references bible_versions(id),
  compare_version_ids text[] not null default '{}',
  disabled_work_ids text[] not null default '{}',
  voice_speed numeric(3,2) not null default 1.0 check (voice_speed between 0.8 and 1.3),
  voice_id text,
  captions boolean not null default true,
  text_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('terms','privacy','sensitive_religious','rehearsal_audio')),
  version text not null,
  granted boolean not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists consent_records_user on consent_records (user_id, kind);

-- ---------- 9.2 conversation and student content ----------
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('free','lesson','sermon','deep','rehearsal','review','immersive')),
  title text,
  topic text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  church_lesson_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sessions_user on sessions (user_id, started_at desc);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  role text not null check (role in ('user','teacher')),
  text text,
  speech text,
  structured jsonb,
  model text,
  tokens_in int,
  tokens_out int,
  cost_brl numeric(10,4),
  latency_ms int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists messages_session on messages (session_id, created_at);

create table if not exists message_citations (
  message_id uuid not null references messages(id) on delete cascade,
  type text not null check (type in ('bible','work')),
  ref text,
  version_id text,
  work_id text,
  chunk_id text,
  created_at timestamptz not null default now()
);
create index if not exists message_citations_msg on message_citations (message_id);

create table if not exists session_summaries (
  session_id uuid primary key references sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text not null,
  topics text[] not null default '{}',
  level_signal text check (level_signal in ('lower','same','higher')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists session_closings (
  session_id uuid primary key references sessions(id) on delete cascade,
  audio_url text,
  mind_map jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists review_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  question text not null,
  answer text not null,
  ref text,
  ease numeric(4,2) not null default 2.5,
  interval_days int not null default 1,
  due_at timestamptz not null default now(),
  repetitions int not null default 0,
  last_grade smallint check (last_grade in (1,3,5)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists review_cards_due on review_cards (user_id, due_at);

create table if not exists review_logs (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references review_cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  grade smallint not null check (grade in (1,3,5)),
  answered_at timestamptz not null default now()
);

create table if not exists notebook_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  content jsonb not null default '{}',
  tags text[] not null default '{}',
  book_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notebook_items_user on notebook_items (user_id, created_at desc);

create table if not exists bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  ref text not null,
  version_id text not null,
  note text,
  created_at timestamptz not null default now(),
  primary key (user_id, ref, version_id)
);

create table if not exists lesson_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  data jsonb not null default '{}',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sermon_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  definition text not null,
  enabled boolean not null default true,
  "order" int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sermon_outlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  sermon_type_id uuid references sermon_types(id),
  data jsonb not null default '{}',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists answer_flags (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  status text not null default 'open' check (status in ('open','correct','incorrect')),
  reviewer_id uuid references auth.users(id),
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Crisis events store NO text (spec 8.5.8): only that it happened.
create table if not exists pastoral_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now()
);

-- ---------- 9.3 knowledge base (remaining tables) ----------
create table if not exists original_words (
  ref text not null,
  position int not null,
  surface text not null,
  lemma text,
  strong text,
  morph text,
  translit text,
  gloss text,
  source text not null check (source in ('wlc','step_tahot','step_tagnt')),
  primary key (ref, position, source)
);

create table if not exists lexicon_entries (
  id text primary key,
  strong text,
  lemma text,
  language text not null,
  source text not null,
  definition text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lexicon_strong on lexicon_entries (strong);

create table if not exists cross_refs (
  from_ref text not null,
  to_ref text not null,
  votes int not null default 0,
  source text not null,
  primary key (from_ref, to_ref, source)
);

create table if not exists kg_entities (
  id text primary key,
  kind text not null check (kind in ('person','place','event','period','group')),
  name_pt text,
  name_en text not null,
  aliases text[] not null default '{}',
  description text,
  period text,
  refs text[] not null default '{}',
  place_coords point,
  source_ids jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kg_entities_aliases on kg_entities using gin (aliases);

create table if not exists kg_relations (
  from_id text not null references kg_entities(id) on delete cascade,
  to_id text not null references kg_entities(id) on delete cascade,
  relation text not null,
  refs text[] not null default '{}',
  primary key (from_id, to_id, relation)
);

create table if not exists map_routes (
  id text primary key,
  name text not null,
  era text,
  steps jsonb not null default '[]',
  sources text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists timelines (
  id text primary key,
  name text not null,
  events jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists models3d (
  id text primary key,
  name text not null,
  file_url text,
  light_file_url text,
  hotspots jsonb not null default '[]',
  license text,
  sources text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists illustrations (
  id uuid primary key default gen_random_uuid(),
  prompt_hash text not null unique,
  prompt text not null,
  url text,
  approved boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists own_notes (
  id uuid primary key default gen_random_uuid(),
  tradition text not null,
  book_code text,
  ref_range text,
  kind text not null check (kind in ('intro','pericope','article')),
  title text not null,
  body text not null,
  sources jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft','in_review','approved','published')),
  reviewer_id uuid references auth.users(id),
  originality_score numeric(4,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ingest_runs (
  id uuid primary key default gen_random_uuid(),
  work_id text references works(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  stats jsonb not null default '{}'
);

-- ---------- 9.4 business ----------
create table if not exists plans (
  id text primary key,
  name text not null,
  price_month numeric(10,2) not null default 0,
  price_year numeric(10,2),
  limits jsonb not null default '{}',
  features jsonb not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  church_id uuid,
  plan_id text not null references plans(id),
  status text not null check (status in ('trialing','active','past_due','suspended','canceled','expired')),
  provider text not null,
  provider_ref text,
  current_period_end timestamptz,
  trial_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user on subscriptions (user_id);

create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement text not null,
  source text not null check (source in ('asaas','apple','google','church','admin')),
  source_ref text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active','expired','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists entitlements_user on entitlements (user_id, status);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('web','ios','android')),
  push_token text,
  app_version text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists app_config (
  key text primary key,
  value jsonb not null,
  min_app_version text,
  updated_at timestamptz not null default now()
);

create table if not exists usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  voice_seconds int not null default 0,
  text_messages int not null default 0,
  illustrations int not null default 0,
  deep_calls int not null default 0,
  cost_brl numeric(10,4) not null default 0,
  primary key (user_id, day)
);

create table if not exists prompt_versions (
  id uuid primary key default gen_random_uuid(),
  layer text not null,
  content text not null,
  version int not null,
  active boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (layer, version)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  target text,
  created_at timestamptz not null default now()
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['profiles','preferences','consent_records','sessions','messages','session_summaries','session_closings','review_cards','notebook_items','lesson_plans','sermon_types','sermon_outlines','answer_flags','lexicon_entries','kg_entities','map_routes','timelines','models3d','illustrations','own_notes','plans','subscriptions','entitlements'] loop
    execute format('drop trigger if exists %I_updated on %I', t, t);
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- Row Level Security ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','preferences','consent_records','sessions','messages','message_citations','session_summaries','session_closings','review_cards','review_logs','notebook_items','bookmarks','lesson_plans','sermon_types','sermon_outlines','answer_flags','pastoral_events','original_words','lexicon_entries','cross_refs','kg_entities','kg_relations','map_routes','timelines','models3d','illustrations','own_notes','ingest_runs','plans','subscriptions','payment_events','entitlements','devices','app_config','usage_counters','prompt_versions','audit_logs'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Owner-only tables: the user reads and writes only their own rows.
do $$
declare t text;
begin
  foreach t in array array['profiles','preferences','consent_records','sessions','session_summaries','review_cards','review_logs','notebook_items','bookmarks','lesson_plans','sermon_outlines','devices'] loop
    execute format('drop policy if exists %I on %I', t || '_owner', t);
    execute format($f$create policy %I on %I for all to authenticated
      using (%s = (select auth.uid())) with check (%s = (select auth.uid()))$f$,
      t || '_owner', t, case when t = 'profiles' then 'user_id' else 'user_id' end, 'user_id');
  end loop;
end $$;

-- A user can never promote themselves: profiles.role is set only by the server (service role) or by the database owner.
create or replace function profiles_protect_role() returns trigger language plpgsql as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.role := 'student';
    elsif new.role is distinct from old.role then
      new.role := old.role;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_role on profiles;
create trigger profiles_protect_role before insert or update on profiles for each row execute function profiles_protect_role();

-- Messages and their children: reachable only through an owned session.
drop policy if exists messages_owner on messages;
create policy messages_owner on messages for all to authenticated
  using (exists (select 1 from sessions s where s.id = messages.session_id and s.user_id = (select auth.uid())))
  with check (exists (select 1 from sessions s where s.id = messages.session_id and s.user_id = (select auth.uid())));
drop policy if exists message_citations_owner on message_citations;
create policy message_citations_owner on message_citations for all to authenticated
  using (exists (select 1 from messages m join sessions s on s.id = m.session_id where m.id = message_citations.message_id and s.user_id = (select auth.uid())))
  with check (exists (select 1 from messages m join sessions s on s.id = m.session_id where m.id = message_citations.message_id and s.user_id = (select auth.uid())));
drop policy if exists session_closings_owner on session_closings;
create policy session_closings_owner on session_closings for all to authenticated
  using (exists (select 1 from sessions s where s.id = session_closings.session_id and s.user_id = (select auth.uid())))
  with check (exists (select 1 from sessions s where s.id = session_closings.session_id and s.user_id = (select auth.uid())));

-- Flags: the author reads and creates their own; reviewers read and decide on all.
drop policy if exists answer_flags_author on answer_flags;
create policy answer_flags_author on answer_flags for select to authenticated using (user_id = (select auth.uid()) or is_reviewer());
drop policy if exists answer_flags_insert on answer_flags;
create policy answer_flags_insert on answer_flags for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists answer_flags_review on answer_flags;
create policy answer_flags_review on answer_flags for update to authenticated using (is_reviewer()) with check (is_reviewer());

-- Crisis events: the app inserts for the user; nobody reads them through the API (metrics are server-side).
drop policy if exists pastoral_events_insert on pastoral_events;
create policy pastoral_events_insert on pastoral_events for insert to authenticated with check (user_id = (select auth.uid()));

-- Read-only to the owner (written by the server / webhooks).
drop policy if exists subscriptions_read on subscriptions;
create policy subscriptions_read on subscriptions for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists entitlements_read on entitlements;
create policy entitlements_read on entitlements for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists usage_counters_read on usage_counters;
create policy usage_counters_read on usage_counters for select to authenticated using (user_id = (select auth.uid()));

-- Reference content: readable by everyone signed in (and the catalogs by visitors); writes only by the server.
do $$
declare t text;
begin
  foreach t in array array['sermon_types','original_words','lexicon_entries','cross_refs','kg_entities','kg_relations','map_routes','timelines','models3d','plans'] loop
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)', t || '_read', t);
  end loop;
end $$;
drop policy if exists illustrations_read on illustrations;
create policy illustrations_read on illustrations for select to authenticated using (approved);
drop policy if exists own_notes_read on own_notes;
create policy own_notes_read on own_notes for select to authenticated using (status = 'published' or is_reviewer());
drop policy if exists own_notes_review on own_notes;
create policy own_notes_review on own_notes for update to authenticated using (is_reviewer()) with check (is_reviewer());
drop policy if exists app_config_read on app_config;
create policy app_config_read on app_config for select to anon, authenticated using (true);

-- Admin-only.
drop policy if exists prompt_versions_admin on prompt_versions;
create policy prompt_versions_admin on prompt_versions for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists audit_logs_admin on audit_logs;
create policy audit_logs_admin on audit_logs for select to authenticated using (is_admin());
drop policy if exists ingest_runs_admin on ingest_runs;
create policy ingest_runs_admin on ingest_runs for select to authenticated using (is_admin());
-- payment_events: no policy (server only).

-- ---------- seed ----------
insert into sermon_types (name, definition, "order") values
  ('Temático', 'Parte de um tema; as divisões vêm do tema, apoiadas em vários textos.', 1),
  ('Textual', 'Parte de um texto curto (1 a 3 versículos); as divisões vêm do próprio texto, o desenvolvimento pode buscar outros textos.', 2),
  ('Expositivo', 'Parte de uma passagem maior; as divisões e o desenvolvimento seguem o fluxo da passagem.', 3)
on conflict (name) do nothing;

insert into plans (id, name, price_month, price_year, limits, features) values
  ('free', 'Grátis', 0, null, '{"voice_minutes_day":15,"text_messages_day":20,"illustrations_day":2}', '{"sermon":false,"pdf_export":false}'),
  ('plus', 'Plus', 29.90, 287.00, '{"voice_minutes_day":120,"illustrations_day":10}', '{"sermon":false,"pdf_export":true}'),
  ('premium', 'Premium', 49.90, 479.00, '{"voice_minutes_day":240,"illustrations_day":30}', '{"sermon":true,"pdf_export":true,"trial_days":7}')
on conflict (id) do nothing;

insert into app_config (key, value, min_app_version) values
  ('min_version', '{"web":"0.0.0","ios":"0.0.0","android":"0.0.0"}', '0.0.0'),
  ('feature_flags', '{"immersive":false,"church_plan":false}', null)
on conflict (key) do nothing;
