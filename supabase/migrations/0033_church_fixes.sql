-- Fix: the topic column of the stats query was ambiguous with sessions.topic. Also: the daily job closes churches whose plan lapsed.
create or replace function api_class_stats(p_class uuid, p_lesson uuid default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare total int; studied int; tops jsonb; lessons uuid[];
begin
  if not is_class_teacher(p_class) then raise exception 'forbidden'; end if;
  select count(*) into total from class_members where class_id = p_class;
  select array_agg(id) into lessons from church_lessons where class_id = p_class and (p_lesson is null or id = p_lesson) and lesson_date >= current_date - 30;
  select count(distinct s.user_id) into studied from sessions s join class_members cm on cm.user_id = s.user_id and cm.class_id = p_class where s.church_lesson_id = any(coalesce(lessons, '{}'));
  -- below 5 students taking part, no number is shown (a small group would identify people)
  if total < 5 or studied < 5 then
    return jsonb_build_object('members', total, 'enough', false, 'min', 5, 'studied', null, 'topics', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('topic', q.name, 'students', q.n) order by q.n desc), '[]'::jsonb) into tops from (
    select tp.name, count(distinct s.user_id) n from sessions s join class_members cm on cm.user_id = s.user_id and cm.class_id = p_class
      join session_closings sc on sc.session_id = s.id cross join lateral unnest(sc.topics) as tp(name)
     where s.church_lesson_id = any(coalesce(lessons, '{}')) group by tp.name having count(distinct s.user_id) >= 3 order by 2 desc limit 8) q;
  return jsonb_build_object('members', total, 'enough', true, 'min', 5, 'studied', studied, 'topics', tops);
end $$;

create or replace function billing_daily_tick()
returns table (suspended int, expired int) language plpgsql security definer set search_path = public as $$
declare s int; e int; ch uuid;
begin
  update subscriptions set status = 'suspended', updated_at = now() where status = 'past_due' and overdue_since is not null and overdue_since + interval '5 days' <= now();
  get diagnostics s = row_count;
  update subscriptions set status = 'expired', updated_at = now() where status in ('trialing', 'canceled') and current_period_end is not null and current_period_end <= now();
  get diagnostics e = row_count;
  update entitlements en set status = 'expired', updated_at = now()
   where en.status = 'active' and en.source_ref is not null
     and exists (select 1 from subscriptions su where su.provider_ref = en.source_ref and su.user_id = en.user_id and su.status in ('suspended', 'expired'));
  -- churches whose subscription lapsed: suspend them and end the rights of every member
  for ch in select c.id from churches c where c.status = 'active' and exists (select 1 from subscriptions su where su.church_id = c.id)
      and not exists (select 1 from subscriptions su where su.church_id = c.id and (su.status in ('active', 'trialing', 'past_due') or (su.status = 'canceled' and coalesce(su.current_period_end, now()) > now()))) loop
    update churches set status = 'suspended' where id = ch;
    perform church_sync_entitlements(ch);
  end loop;
  return query select s, e;
end $$;
revoke all on function billing_daily_tick() from public, anon, authenticated;
