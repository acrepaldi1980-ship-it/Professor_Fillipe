-- Notifications (spec 8.15, Prompt 2.7): preferences per student and the functions the hourly sender uses (protected by the server secret, like billing).
create table if not exists notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  hour int not null default 19 check (hour between 7 and 21),
  tz text not null default 'America/Sao_Paulo',
  kinds jsonb not null default '{"review":true,"path":true,"lesson":true,"trial":true}',
  lang text not null default 'pt-BR',
  last_sent_at timestamptz,
  last_kind text,
  updated_at timestamptz not null default now()
);
alter table notification_prefs enable row level security;
drop policy if exists notification_prefs_own on notification_prefs;
create policy notification_prefs_own on notification_prefs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke truncate, references, trigger on notification_prefs from authenticated;
revoke all on notification_prefs from anon;

alter table devices enable row level security;
drop policy if exists devices_own on devices;
create policy devices_own on devices for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke truncate, references, trigger on devices from authenticated;
revoke all on devices from anon;
create unique index if not exists devices_user_token on devices (user_id, push_token) where push_token is not null;

-- Everything the sender needs about each student who turned reminders on and has a device, in one call.
create or replace function api_notify_candidates(p_secret text)
returns table (user_id uuid, tz text, hour int, kinds jsonb, lang text, last_sent_at timestamptz, devices jsonb, due_cards int, paths jsonb, lesson_title text, trial_end timestamptz, last_study_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  return query
    select p.user_id, p.tz, p.hour, p.kinds, p.lang, p.last_sent_at,
      (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'token', d.push_token, 'platform', d.platform)), '[]'::jsonb) from devices d where d.user_id = p.user_id and d.push_token is not null),
      (select count(*)::int from review_cards c where c.user_id = p.user_id and c.due_at <= now()),
      (select coalesce(jsonb_agg(jsonb_build_object('path_id', pp.path_id, 'done_days', pp.done_days)), '[]'::jsonb) from path_progress pp where pp.user_id = p.user_id and pp.completed_at is null),
      (select l.title from church_lessons l join class_members cm on cm.class_id = l.class_id where cm.user_id = p.user_id and l.lesson_date between current_date - 6 and current_date + 1 order by l.lesson_date desc, l.created_at desc limit 1),
      (select s.trial_end from subscriptions s where s.user_id = p.user_id and s.status = 'trialing' order by s.trial_end desc limit 1),
      (select max(m.created_at) from messages m join sessions se on se.id = m.session_id where se.user_id = p.user_id and m.role = 'user')
    from notification_prefs p
    where p.enabled and exists (select 1 from devices d where d.user_id = p.user_id and d.push_token is not null);
end $$;

create or replace function api_notify_mark(p_secret text, p_user uuid, p_kind text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  update notification_prefs set last_sent_at = now(), last_kind = p_kind where user_id = p_user;
end $$;

create or replace function api_notify_drop_device(p_secret text, p_device uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  delete from devices where id = p_device;
end $$;
do $$ declare f text; begin
  foreach f in array array['api_notify_candidates(text)','api_notify_mark(text,uuid,text)','api_notify_drop_device(text,uuid)'] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
