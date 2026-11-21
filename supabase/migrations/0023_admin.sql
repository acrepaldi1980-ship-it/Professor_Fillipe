-- Prompt 1.12: administration (spec 8.14), analytics events (15.1) and audit trail. Every admin function checks the role in the database
-- (is_admin / is_reviewer) and writes audit_logs. Admins never read conversations: flagged answers show only the answer under review.

-- ---- audit ----
alter table audit_logs add column if not exists details jsonb;
create or replace function audit(p_action text, p_target text, p_details jsonb default null) returns void language sql security definer set search_path = public as $$
  insert into audit_logs (actor_id, action, target, details) values (auth.uid(), p_action, left(p_target, 200), p_details)
$$;
revoke all on function audit(text, text, jsonb) from public;

-- ---- analytics events (no sensitive data: names and small scalar props) ----
create table if not exists analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_event on analytics_events (event, created_at desc);
create index if not exists analytics_events_user on analytics_events (user_id, created_at desc);
alter table analytics_events enable row level security;
drop policy if exists analytics_events_admin on analytics_events;
create policy analytics_events_admin on analytics_events for select to authenticated using (is_admin());

create or replace function api_track(p_event text, p_props jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare clean jsonb := '{}'; k text; v jsonb;
begin
  if auth.uid() is null then return; end if;
  if p_event not in ('signup_completed','consent_sensitive_granted','interview_completed','config_completed','first_lesson_started','session_started','turn_completed','visual_opened','session_closed','card_reviewed','lesson_plan_exported','sermon_outline_exported','limit_reached','checkout_started','subscription_activated','subscription_canceled','answer_flagged') then return; end if;
  -- only short scalar props (numbers, booleans, short strings): never free text
  for k, v in select * from jsonb_each(coalesce(p_props, '{}')) loop
    if jsonb_typeof(v) in ('number','boolean') or (jsonb_typeof(v) = 'string' and length(v #>> '{}') <= 40) then clean := clean || jsonb_build_object(left(k, 30), v); end if;
  end loop;
  insert into analytics_events (user_id, event, props) values (auth.uid(), p_event, clean);
end $$;

-- ---- works (spec 8.14 "Obras") ----
create or replace function api_admin_works()
returns table (id text, title text, authors text[], kind text, tradition text, license text, language text, enabled boolean, review_status text, chunk_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return query select w.id, w.title, w.authors, w.kind, w.tradition, w.license, w.language, w.enabled, w.review_status, (select count(*) from chunks c where c.work_id = w.id) from works w order by w.kind, w.title limit 1500;
end $$;

create or replace function api_admin_set_work(p_id text, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update works set enabled = p_enabled, updated_at = now() where id = p_id and review_status = 'approved';
  perform audit(case when p_enabled then 'work_enabled' else 'work_disabled' end, p_id);
end $$;

-- ---- flagged answers (spec 8.14): the answer under review, with the question for context, nothing else of the conversation ----
create or replace function api_flagged_answers(p_status text default 'open')
returns table (flag_id uuid, message_id uuid, reason text, status text, created_at timestamptz, question text, answer text, citations jsonb, reviewer_note text, audit_sample boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_reviewer() then raise exception 'forbidden'; end if;
  return query
    select f.id, f.message_id, f.reason, f.status, f.created_at,
           (select left(u.text, 500) from messages u where u.session_id = m.session_id and u.role = 'user' and u.created_at <= m.created_at order by u.created_at desc limit 1),
           left(m.text, 3000), m.structured -> 'citations', f.reviewer_note, (f.reason = 'audit_sample')
      from answer_flags f join messages m on m.id = f.message_id
     where (p_status = 'all' or f.status = p_status)
     order by f.created_at desc limit 200;
end $$;

create or replace function api_review_flag(p_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_reviewer() then raise exception 'forbidden'; end if;
  if p_status not in ('open','correct','incorrect') then raise exception 'invalid_status'; end if;
  update answer_flags set status = p_status, reviewer_note = left(p_note, 1000), reviewer_id = auth.uid(), updated_at = now() where id = p_id;
  perform audit('flag_reviewed', p_id::text, jsonb_build_object('status', p_status));
end $$;

-- ---- users and subscriptions (no conversations) ----
create or replace function api_admin_users(p_q text default '')
returns table (user_id uuid, email text, name text, role text, level text, created_at timestamptz, plan text, sub_status text, last_day date, messages_30d bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return query
    select p.user_id, u.email::text, coalesce(p.preferred_name, p.display_name), p.role, p.level, p.created_at,
           coalesce((select substring(e.entitlement from 6) from entitlements e where e.user_id = p.user_id and e.status = 'active' and (e.expires_at is null or e.expires_at > now()) and e.entitlement like 'plan:%' order by case e.entitlement when 'plan:premium' then 1 else 2 end limit 1), 'free'),
           (select s.status from subscriptions s where s.user_id = p.user_id order by s.created_at desc limit 1),
           (select max(c.day) from usage_counters c where c.user_id = p.user_id),
           coalesce((select sum(c.text_messages) from usage_counters c where c.user_id = p.user_id and c.day > current_date - 30), 0)::bigint
      from profiles p join auth.users u on u.id = p.user_id
     where p_q = '' or u.email ilike '%' || p_q || '%' or coalesce(p.preferred_name, p.display_name, '') ilike '%' || p_q || '%'
     order by p.created_at desc limit 100;
end $$;

create or replace function api_admin_user_payments(p_user uuid)
returns table (at timestamptz, provider text, event_type text, ref text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return query select e.created_at, e.provider, e.event_type, coalesce(e.payload #>> '{payment,subscription}', e.payload ->> 'ref')
    from payment_events e where exists (select 1 from subscriptions s where s.user_id = p_user and s.provider_ref = coalesce(e.payload #>> '{payment,subscription}', e.payload ->> 'ref')) order by e.created_at desc limit 50;
end $$;

create or replace function api_admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_role not in ('student','reviewer') then raise exception 'invalid_role'; end if; -- admins are made in the database only
  if p_user = auth.uid() then raise exception 'not_yourself'; end if;
  update profiles set role = p_role where user_id = p_user and role <> 'admin';
  perform audit('role_changed', p_user::text, jsonb_build_object('role', p_role));
end $$;

-- ---- settings: plans, sermon types, prompts ----
create or replace function api_admin_update_plan(p_id text, p_price_month numeric, p_price_year numeric, p_limits jsonb, p_features jsonb, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update plans set price_month = p_price_month, price_year = p_price_year, limits = p_limits, features = p_features, active = p_active, updated_at = now() where id = p_id;
  perform audit('plan_updated', p_id, jsonb_build_object('price_month', p_price_month, 'price_year', p_price_year));
end $$;

create or replace function api_admin_update_sermon_type(p_id uuid, p_name text, p_definition text, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update sermon_types set name = p_name, definition = p_definition, enabled = p_enabled, updated_at = now() where id = p_id;
  perform audit('sermon_type_updated', p_id::text);
end $$;

create or replace function api_admin_new_prompt_version(p_layer text, p_content text)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_layer not in ('identity','mode_free') then raise exception 'invalid_layer'; end if;
  select coalesce(max(version), 0) + 1 into v from prompt_versions where layer = p_layer;
  insert into prompt_versions (layer, content, version, active, created_by) values (p_layer, p_content, v, false, auth.uid());
  perform audit('prompt_version_created', p_layer || ':' || v);
  return v;
end $$;

-- Activating (or reverting to) a version: the teacher uses it from the next turn (cache of 1 minute).
create or replace function api_admin_activate_prompt(p_layer text, p_version int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from prompt_versions where layer = p_layer and version = p_version) then raise exception 'not_found'; end if;
  update prompt_versions set active = false where layer = p_layer and active;
  update prompt_versions set active = true where layer = p_layer and version = p_version;
  perform audit('prompt_activated', p_layer || ':' || p_version);
end $$;

create or replace function api_admin_prompts()
returns table (layer text, version int, active boolean, created_at timestamptz, content text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return query select v.layer, v.version, v.active, v.created_at, v.content from prompt_versions v order by v.layer, v.version desc;
end $$;

create or replace function api_admin_audit()
returns table (at timestamptz, actor uuid, action text, target text, details jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return query select a.created_at, a.actor_id, a.action, a.target, a.details from audit_logs a order by a.created_at desc limit 100;
end $$;

-- ---- evals (the average score shown on the dashboard) ----
create table if not exists eval_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  model text,
  summary jsonb not null
);
alter table eval_runs enable row level security;
drop policy if exists eval_runs_admin on eval_runs;
create policy eval_runs_admin on eval_runs for select to authenticated using (is_admin());

-- ---- metrics (spec 15.2) ----
create or replace function api_admin_metrics()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'users', (select count(*) from profiles),
    'dau', (select count(distinct user_id) from usage_counters where day = current_date and (text_messages > 0 or voice_seconds > 0)),
    'mau', (select count(distinct user_id) from usage_counters where day > current_date - 30 and (text_messages > 0 or voice_seconds > 0)),
    'interview_completion', (select round(100.0 * count(*) filter (where level is not null) / nullif(count(*), 0), 1) from profiles),
    'sessions_per_user_week', (select round(count(*)::numeric / greatest(1, (select count(*) from profiles)) / 4.0, 2) from sessions where started_at > now() - interval '28 days'),
    'retention', jsonb_build_object(
      'd1', (select round(100.0 * count(*) filter (where exists (select 1 from usage_counters c where c.user_id = p.user_id and c.day = (p.created_at::date + 1))) / nullif(count(*), 0), 1) from profiles p where p.created_at < now() - interval '1 day'),
      'd7', (select round(100.0 * count(*) filter (where exists (select 1 from usage_counters c where c.user_id = p.user_id and c.day = (p.created_at::date + 7))) / nullif(count(*), 0), 1) from profiles p where p.created_at < now() - interval '7 days'),
      'd30', (select round(100.0 * count(*) filter (where exists (select 1 from usage_counters c where c.user_id = p.user_id and c.day = (p.created_at::date + 30))) / nullif(count(*), 0), 1) from profiles p where p.created_at < now() - interval '30 days')),
    'conversion_pct', (select round(100.0 * count(distinct user_id) filter (where status in ('active','past_due','canceled')) / nullif((select count(*) from profiles), 0), 2) from subscriptions),
    'voice_latency_ms', (select jsonb_build_object('median', percentile_cont(0.5) within group (order by latency_ms), 'p95', percentile_cont(0.95) within group (order by latency_ms)) from messages where role = 'teacher' and latency_ms is not null and created_at > now() - interval '30 days'),
    'answers_30d', (select count(*) from messages where role = 'teacher' and created_at > now() - interval '30 days'),
    'flagged_rate_pct', (select round(100.0 * (select count(*) from answer_flags where reason is distinct from 'audit_sample' and created_at > now() - interval '30 days') / nullif((select count(*) from messages where role = 'teacher' and created_at > now() - interval '30 days'), 0), 2)),
    'flags_open', (select count(*) from answer_flags where status = 'open'),
    'last_eval', (select jsonb_build_object('ran_at', ran_at, 'summary', summary) from eval_runs order by ran_at desc limit 1),
    'events_7d', coalesce((select jsonb_agg(x) from (select event, count(*)::int n from analytics_events where created_at > now() - interval '7 days' group by 1 order by 2 desc) x), '[]')
  ) into r;
  return r;
end $$;

do $$ declare f text; begin
  foreach f in array array['api_track(text,jsonb)','api_admin_works()','api_admin_set_work(text,boolean)','api_flagged_answers(text)','api_review_flag(uuid,text,text)','api_admin_users(text)','api_admin_user_payments(uuid)','api_admin_set_role(uuid,text)','api_admin_update_plan(text,numeric,numeric,jsonb,jsonb,boolean)','api_admin_update_sermon_type(uuid,text,text,boolean)','api_admin_new_prompt_version(text,text)','api_admin_activate_prompt(text,int)','api_admin_prompts()','api_admin_audit()','api_admin_metrics()'] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
