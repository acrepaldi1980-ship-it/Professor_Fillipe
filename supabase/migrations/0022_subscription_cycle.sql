-- The billing cycle (month or year) and the overdue date of a subscription: needed by the state machine (period length, 5-day grace).
alter table subscriptions add column if not exists cycle text not null default 'month' check (cycle in ('month','year'));
alter table subscriptions add column if not exists overdue_since timestamptz;

drop function if exists api_billing_subscription(text,uuid,text,text,text,text,timestamptz,timestamptz,timestamptz);
create or replace function api_billing_subscription(p_secret text, p_user uuid, p_plan text, p_status text, p_provider text, p_ref text, p_period_end timestamptz, p_trial_end timestamptz, p_canceled_at timestamptz, p_cycle text, p_overdue_since timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  insert into subscriptions (user_id, plan_id, status, provider, provider_ref, current_period_end, trial_end, canceled_at, cycle, overdue_since)
  values (p_user, p_plan, p_status, p_provider, p_ref, p_period_end, p_trial_end, p_canceled_at, p_cycle, p_overdue_since)
  on conflict (provider, provider_ref) where provider_ref is not null
  do update set plan_id = excluded.plan_id, status = excluded.status, current_period_end = excluded.current_period_end, trial_end = excluded.trial_end, canceled_at = excluded.canceled_at, cycle = excluded.cycle, overdue_since = excluded.overdue_since, updated_at = now()
  returning id into sid;
  return sid;
end $$;

drop function if exists api_billing_find_subscription(text,text,text);
create or replace function api_billing_find_subscription(p_secret text, p_provider text, p_ref text)
returns table (id uuid, user_id uuid, plan_id text, status text, current_period_end timestamptz, trial_end timestamptz, canceled_at timestamptz, cycle text, overdue_since timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  return query select s.id, s.user_id, s.plan_id, s.status, s.current_period_end, s.trial_end, s.canceled_at, s.cycle, s.overdue_since from subscriptions s where s.provider = p_provider and s.provider_ref = p_ref;
end $$;

revoke all on function api_billing_subscription(text,uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,text,timestamptz) from public;
revoke all on function api_billing_find_subscription(text,text,text) from public;
grant execute on function api_billing_subscription(text,uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,text,timestamptz) to anon, authenticated;
grant execute on function api_billing_find_subscription(text,text,text) to anon, authenticated;
