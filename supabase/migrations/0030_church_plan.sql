-- Prompt 2.2: Plano Igreja (spec 8.13, 9.4, J08). Prices D-24 (21/11/2026): 30 students R$ 199, 100 R$ 399, 300 R$ 699.
-- PRIVACY (the core rule of this module): the EBD teacher NEVER reads a student's conversation. No policy or function here exposes messages;
-- the teacher panel returns only aggregates and only when at least 5 students took part (and topics only when at least 3 of them share one).

-- ---- church plans (same `plans` table, editable in the admin) ----
insert into plans (id, name, price_month, price_year, limits, features) values
  ('church_30', 'Igreja até 30 alunos', 199, 1990, '{"students":30}', '{"church":true}'),
  ('church_100', 'Igreja até 100 alunos', 399, 3990, '{"students":100}', '{"church":true}'),
  ('church_300', 'Igreja até 300 alunos', 699, 6990, '{"students":300}', '{"church":true}')
on conflict (id) do update set name = excluded.name, price_month = excluded.price_month, price_year = excluded.price_year, limits = excluded.limits, features = excluded.features;

-- ---- tables ----
create table if not exists churches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  cnpj text,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  plan_id text not null default 'church_30' references plans(id),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  default_lenses text[] not null default '{}',
  default_version_id text,
  teacher_code text not null unique default ('T' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 9))),
  created_at timestamptz not null default now()
);
create table if not exists church_members (
  church_id uuid not null references churches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'teacher', 'student')),
  joined_at timestamptz not null default now(),
  primary key (church_id, user_id)
);
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(name) between 2 and 80),
  age_group text not null default 'adults' check (age_group in ('kids', 'teens', 'youth', 'adults', 'mixed')),
  invite_code text not null unique default ('C' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 9))),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists class_members (
  class_id uuid not null references classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create table if not exists church_lessons (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  title text not null check (length(title) between 2 and 160),
  ref text,
  lesson_date date not null default current_date,
  notes text check (length(notes) <= 2000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists class_members_user on class_members (user_id);
create index if not exists church_members_user on church_members (user_id);
create index if not exists lessons_class_date on church_lessons (class_id, lesson_date desc);

do $$ begin
  alter table sessions add constraint sessions_church_lesson_fk foreign key (church_lesson_id) references church_lessons(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---- row level security: reading only; every write goes through the functions below ----
alter table churches enable row level security;
alter table church_members enable row level security;
alter table classes enable row level security;
alter table class_members enable row level security;
alter table church_lessons enable row level security;

create or replace function church_role(p_church uuid) returns text language sql stable security definer set search_path = public as $$
  select role from church_members where church_id = p_church and user_id = auth.uid()
$$;
create or replace function is_class_teacher(p_class uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from classes c where c.id = p_class and (c.teacher_id = auth.uid() or church_role(c.church_id) = 'admin'))
$$;
create or replace function in_class(p_class uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_members where class_id = p_class and user_id = auth.uid()) or is_class_teacher(p_class)
$$;

drop policy if exists churches_read on churches;
create policy churches_read on churches for select to authenticated using (church_role(id) is not null);
drop policy if exists church_members_read on church_members;
create policy church_members_read on church_members for select to authenticated using (user_id = auth.uid() or church_role(church_id) = 'admin');
drop policy if exists classes_read on classes;
create policy classes_read on classes for select to authenticated using (in_class(id) or church_role(church_id) = 'admin');
drop policy if exists class_members_read on class_members;
create policy class_members_read on class_members for select to authenticated using (user_id = auth.uid() or is_class_teacher(class_id));
drop policy if exists lessons_read on church_lessons;
create policy lessons_read on church_lessons for select to authenticated using (in_class(class_id));
revoke insert, update, delete, truncate, references, trigger on churches, church_members, classes, class_members, church_lessons from authenticated;
revoke all on churches, church_members, classes, class_members, church_lessons from anon;

-- ---- entitlements for church members while the church subscription is active (source 'church') ----
-- teachers and the administrator get Premium (lesson planning, sermons); students get Plus (no message limit, PDF).
create or replace function church_sync_entitlements(p_church uuid) returns void language plpgsql security definer set search_path = public as $$
declare c churches; m record; ends timestamptz;
begin
  select * into c from churches where id = p_church;
  if not found then return; end if;
  select max(current_period_end) into ends from subscriptions where church_id = p_church and status in ('active', 'trialing', 'past_due', 'canceled');
  for m in select user_id, role from church_members where church_id = p_church loop
    update entitlements set status = 'revoked', updated_at = now() where user_id = m.user_id and source = 'church' and source_ref = p_church::text and status = 'active';
    if c.status = 'active' then
      insert into entitlements (user_id, entitlement, source, source_ref, expires_at) values (m.user_id, case when m.role = 'student' then 'plan:plus' else 'plan:premium' end, 'church', p_church::text, ends);
    end if;
  end loop;
end $$;
revoke all on function church_sync_entitlements(uuid) from public, anon, authenticated;

-- ---- functions the app calls (authenticated only) ----
create or replace function api_church_create(p_name text, p_plan text, p_cnpj text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if p_plan not in ('church_30', 'church_100', 'church_300') then raise exception 'invalid_plan'; end if;
  if (select count(*) from churches where admin_user_id = auth.uid()) >= 3 then raise exception 'too_many_churches'; end if;
  insert into churches (name, cnpj, admin_user_id, plan_id) values (trim(p_name), nullif(trim(p_cnpj), ''), auth.uid(), p_plan) returning id into cid;
  insert into church_members (church_id, user_id, role) values (cid, auth.uid(), 'admin');
  perform audit('church_created', cid::text, jsonb_build_object('plan', p_plan));
  return cid;
end $$;

create or replace function api_church_my() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'role', m.role, 'plan_id', c.plan_id, 'status', c.status,
    'student_limit', (select (limits->>'students')::int from plans where id = c.plan_id),
    'students', (select count(*) from church_members x where x.church_id = c.id and x.role = 'student'),
    'teacher_code', case when m.role = 'admin' then c.teacher_code end,
    'classes', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name, 'age_group', k.age_group, 'teacher_id', k.teacher_id, 'archived', k.archived,
       'invite_code', case when m.role in ('admin') or k.teacher_id = auth.uid() then k.invite_code end,
       'students', (select count(*) from class_members cm where cm.class_id = k.id),
       'mine', exists (select 1 from class_members cm where cm.class_id = k.id and cm.user_id = auth.uid()))
       order by k.created_at) from classes k where k.church_id = c.id and (m.role = 'admin' or k.teacher_id = auth.uid() or exists (select 1 from class_members cm where cm.class_id = k.id and cm.user_id = auth.uid()))), '[]'::jsonb)
  ) order by c.created_at), '[]'::jsonb) into r
  from church_members m join churches c on c.id = m.church_id where m.user_id = auth.uid();
  return r;
end $$;

create or replace function api_class_create(p_church uuid, p_name text, p_age text default 'adults', p_teacher uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare kid uuid; t uuid := coalesce(p_teacher, auth.uid());
begin
  if church_role(p_church) is distinct from 'admin' then raise exception 'forbidden'; end if;
  if not exists (select 1 from church_members where church_id = p_church and user_id = t and role in ('admin', 'teacher')) then raise exception 'teacher_not_in_church'; end if;
  insert into classes (church_id, teacher_id, name, age_group) values (p_church, t, trim(p_name), p_age) returning id into kid;
  return kid;
end $$;

-- A student joins with the class code (C...), a teacher with the church teacher code (T...). Returns what the screen must tell the person.
create or replace function api_church_join(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare c churches; k classes; lim int; n int; code text := upper(trim(p_code));
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if left(code, 1) = 'T' then
    select * into c from churches where teacher_code = code;
    if not found then raise exception 'invalid_code'; end if;
    insert into church_members (church_id, user_id, role) values (c.id, auth.uid(), 'teacher') on conflict (church_id, user_id) do nothing;
    perform church_sync_entitlements(c.id);
    return jsonb_build_object('role', 'teacher', 'church', c.name, 'church_id', c.id);
  end if;
  select * into k from classes where invite_code = code and not archived;
  if not found then raise exception 'invalid_code'; end if;
  select * into c from churches where id = k.church_id;
  select (limits->>'students')::int into lim from plans where id = c.plan_id;
  select count(*) into n from church_members where church_id = c.id and role = 'student';
  if n >= lim and not exists (select 1 from church_members where church_id = c.id and user_id = auth.uid()) then raise exception 'church_full'; end if;
  insert into church_members (church_id, user_id, role) values (c.id, auth.uid(), 'student') on conflict (church_id, user_id) do nothing;
  insert into class_members (class_id, user_id) values (k.id, auth.uid()) on conflict do nothing;
  perform church_sync_entitlements(c.id);
  return jsonb_build_object('role', 'student', 'church', c.name, 'class', k.name, 'church_id', c.id, 'class_id', k.id);
end $$;

create or replace function api_church_leave(p_church uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if church_role(p_church) = 'admin' then raise exception 'admin_cannot_leave'; end if;
  delete from class_members where user_id = auth.uid() and class_id in (select id from classes where church_id = p_church);
  update entitlements set status = 'revoked', updated_at = now() where user_id = auth.uid() and source = 'church' and source_ref = p_church::text and status = 'active';
  delete from church_members where church_id = p_church and user_id = auth.uid();
end $$;

create or replace function api_church_settings(p_church uuid, p_lenses text[], p_version text) returns void language plpgsql security definer set search_path = public as $$
begin
  if church_role(p_church) is distinct from 'admin' then raise exception 'forbidden'; end if;
  update churches set default_lenses = coalesce(p_lenses, '{}'), default_version_id = p_version where id = p_church;
end $$;

create or replace function api_lesson_publish(p_class uuid, p_title text, p_ref text, p_date date, p_notes text) returns uuid language plpgsql security definer set search_path = public as $$
declare lid uuid;
begin
  if not is_class_teacher(p_class) then raise exception 'forbidden'; end if;
  insert into church_lessons (class_id, title, ref, lesson_date, notes, created_by) values (p_class, trim(p_title), nullif(trim(p_ref), ''), coalesce(p_date, current_date), nullif(trim(p_notes), ''), auth.uid()) returning id into lid;
  return lid;
end $$;

create or replace function api_lesson_delete(p_lesson uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from church_lessons l where l.id = p_lesson and is_class_teacher(l.class_id)) then raise exception 'forbidden'; end if;
  delete from church_lessons where id = p_lesson;
end $$;

-- The lessons a person should see on the home screen: this week's (and the next days) of their classes.
create or replace function api_lessons_for_me() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'ref', l.ref, 'date', l.lesson_date, 'notes', l.notes, 'class', k.name, 'church', c.name, 'church_id', c.id) order by l.lesson_date), '[]'::jsonb)
  from church_lessons l join classes k on k.id = l.class_id join churches c on c.id = k.church_id
  where l.lesson_date between current_date - 3 and current_date + 10
    and exists (select 1 from class_members cm where cm.class_id = k.id and cm.user_id = auth.uid())
$$;

-- Teacher panel: AGGREGATES ONLY. Nothing here can return a message, a name next to an activity or a number under the privacy minimum.
create or replace function api_class_stats(p_class uuid, p_lesson uuid default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare total int; studied int; topics jsonb; lessons uuid[];
begin
  if not is_class_teacher(p_class) then raise exception 'forbidden'; end if;
  select count(*) into total from class_members where class_id = p_class;
  select array_agg(id) into lessons from church_lessons where class_id = p_class and (p_lesson is null or id = p_lesson) and lesson_date >= current_date - 30;
  select count(distinct s.user_id) into studied from sessions s join class_members cm on cm.user_id = s.user_id and cm.class_id = p_class where s.church_lesson_id = any(coalesce(lessons, '{}'));
  -- below 5 students taking part, no number is shown (a small group would identify people)
  if total < 5 or studied < 5 then
    return jsonb_build_object('members', total, 'enough', false, 'min', 5, 'studied', null, 'topics', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('topic', t.topic, 'students', t.n) order by t.n desc), '[]'::jsonb) into topics from (
    select topic, count(distinct s.user_id) n from sessions s join class_members cm on cm.user_id = s.user_id and cm.class_id = p_class
      join session_closings sc on sc.session_id = s.id, unnest(sc.topics) topic
     where s.church_lesson_id = any(coalesce(lessons, '{}')) group by topic having count(distinct s.user_id) >= 3 order by 2 desc limit 8) t;
  return jsonb_build_object('members', total, 'enough', true, 'min', 5, 'studied', studied, 'topics', topics);
end $$;

do $$ declare f text; begin
  foreach f in array array['api_church_create(text,text,text)', 'api_church_my()', 'api_class_create(uuid,text,text,uuid)', 'api_church_join(text)', 'api_church_leave(uuid)', 'api_church_settings(uuid,text[],text)', 'api_lesson_publish(uuid,text,text,date,text)', 'api_lesson_delete(uuid)', 'api_lessons_for_me()', 'api_class_stats(uuid,uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  revoke execute on function church_role(uuid), is_class_teacher(uuid), in_class(uuid) from public, anon;
end $$;
