-- Prompt 1.11: plans, subscriptions, payment events, entitlements, usage meter (spec 8.12, 10.6.4). D-01 prices confirmed 21/11/2026.
-- The deployed app holds no account-level token. The payment webhook and the billing code write through SECURITY DEFINER functions that
-- check a server secret (BILLING_SERVER_SECRET, only its SHA-256 lives in app_config). Plan checks read ONLY `entitlements`.

create extension if not exists pgcrypto with schema extensions;

-- ---- plans (editable without code) ----
insert into plans (id, name, price_month, price_year, limits, features) values
  ('free', 'Grátis', 0, null,
   '{"voice_minutes_day":15,"text_messages_day":20,"illustrations_day":2,"lessons_month":1,"deepen_month":3}',
   '{"sermon":false,"pdf_export":false,"deepen":"basic","trial_days":0}'),
  ('plus', 'Plus', 29.90, 287.00,
   '{"voice_minutes_day":120,"text_messages_day":null,"illustrations_day":10,"lessons_month":null,"deepen_month":null}',
   '{"sermon":false,"pdf_export":true,"deepen":"basic","trial_days":0}'),
  ('premium', 'Premium', 49.90, 479.00,
   '{"voice_minutes_day":240,"text_messages_day":null,"illustrations_day":30,"lessons_month":null,"deepen_month":null}',
   '{"sermon":true,"pdf_export":true,"deepen":"full","trial_days":7}')
on conflict (id) do update set name = excluded.name, price_month = excluded.price_month, price_year = excluded.price_year, limits = excluded.limits, features = excluded.features, updated_at = now();
drop policy if exists plans_read on plans;
create policy plans_read on plans for select to anon, authenticated using (active);

-- ---- server secret ----
create or replace function billing_secret_ok(p_secret text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_config where key = 'billing_secret_hash' and (value #>> '{}') = encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex'))
$$;
revoke all on function billing_secret_ok(text) from public;

-- ---- webhooks: idempotent event log ----
create or replace function api_billing_event(p_secret text, p_provider text, p_type text, p_key text, p_payload jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare inserted int;
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  insert into payment_events (provider, event_type, payload, idempotency_key) values (p_provider, p_type, p_payload, p_key) on conflict (idempotency_key) do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1; -- false: already seen, nothing to do
end $$;

create or replace function api_billing_processed(p_secret text, p_key text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  update payment_events set processed_at = now() where idempotency_key = p_key;
end $$;

-- ---- subscriptions ----
create unique index if not exists subscriptions_provider_ref on subscriptions (provider, provider_ref) where provider_ref is not null;

create or replace function api_billing_subscription(p_secret text, p_user uuid, p_plan text, p_status text, p_provider text, p_ref text, p_period_end timestamptz, p_trial_end timestamptz, p_canceled_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  insert into subscriptions (user_id, plan_id, status, provider, provider_ref, current_period_end, trial_end, canceled_at)
  values (p_user, p_plan, p_status, p_provider, p_ref, p_period_end, p_trial_end, p_canceled_at)
  on conflict (provider, provider_ref) where provider_ref is not null
  do update set plan_id = excluded.plan_id, status = excluded.status, current_period_end = excluded.current_period_end, trial_end = excluded.trial_end, canceled_at = excluded.canceled_at, updated_at = now()
  returning id into sid;
  return sid;
end $$;

create or replace function api_billing_find_subscription(p_secret text, p_provider text, p_ref text)
returns table (id uuid, user_id uuid, plan_id text, status text, current_period_end timestamptz, trial_end timestamptz, canceled_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  return query select s.id, s.user_id, s.plan_id, s.status, s.current_period_end, s.trial_end, s.canceled_at from subscriptions s where s.provider = p_provider and s.provider_ref = p_ref;
end $$;

-- ---- entitlements: the only thing plan checks read ----
create or replace function api_entitlement_grant(p_secret text, p_user uuid, p_entitlement text, p_source text, p_ref text, p_expires timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  -- one active entitlement per (user, entitlement, source): granting again renews it
  update entitlements set status = 'active', expires_at = p_expires, source_ref = p_ref, updated_at = now()
   where user_id = p_user and entitlement = p_entitlement and source = p_source and status <> 'revoked';
  if not found then
    insert into entitlements (user_id, entitlement, source, source_ref, expires_at) values (p_user, p_entitlement, p_source, p_ref, p_expires);
  end if;
end $$;

create or replace function api_entitlement_revoke(p_secret text, p_user uuid, p_entitlement text, p_source text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  update entitlements set status = 'revoked', updated_at = now() where user_id = p_user and entitlement = p_entitlement and source = p_source and status = 'active';
end $$;

-- ---- usage meter (the student's own token) ----
create or replace function api_usage_add(p_kind text, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  insert into usage_counters (user_id, day) values (auth.uid(), current_date) on conflict (user_id, day) do nothing;
  if p_kind = 'voice_seconds' then update usage_counters set voice_seconds = voice_seconds + p_amount::int where user_id = auth.uid() and day = current_date;
  elsif p_kind = 'text_messages' then update usage_counters set text_messages = text_messages + p_amount::int where user_id = auth.uid() and day = current_date;
  elsif p_kind = 'deep_calls' then update usage_counters set deep_calls = deep_calls + p_amount::int where user_id = auth.uid() and day = current_date;
  elsif p_kind = 'cost_brl' then update usage_counters set cost_brl = cost_brl + p_amount where user_id = auth.uid() and day = current_date;
  else raise exception 'unknown_kind'; end if;
end $$;

-- ---- admin dashboard numbers (admins only) ----
create or replace function api_admin_billing()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'by_plan_status', coalesce((select jsonb_agg(x) from (select plan_id, status, count(*)::int n from subscriptions group by 1, 2 order by 1, 2) x), '[]'),
    'mrr_brl', coalesce((select sum(case when s.status in ('active','past_due') then p.price_month else 0 end) from subscriptions s join plans p on p.id = s.plan_id), 0),
    'canceled_30d', (select count(*)::int from subscriptions where canceled_at > now() - interval '30 days'),
    'users', (select count(*)::int from profiles),
    'ai_cost_30d_brl', coalesce((select sum(cost_brl) from usage_counters where day > current_date - 30), 0),
    'ai_cost_per_user', coalesce((select jsonb_agg(x) from (select user_id, round(sum(cost_brl)::numeric, 2) cost, sum(text_messages)::int messages from usage_counters where day > current_date - 30 group by 1 order by 2 desc limit 20) x), '[]')
  ) into r;
  return r;
end $$;

revoke all on function api_billing_event(text,text,text,text,jsonb) from public;
revoke all on function api_billing_processed(text,text) from public;
revoke all on function api_billing_subscription(text,uuid,text,text,text,text,timestamptz,timestamptz,timestamptz) from public;
revoke all on function api_billing_find_subscription(text,text,text) from public;
revoke all on function api_entitlement_grant(text,uuid,text,text,text,timestamptz) from public;
revoke all on function api_entitlement_revoke(text,uuid,text,text) from public;
revoke all on function api_usage_add(text,numeric) from public;
revoke all on function api_admin_billing() from public;
grant execute on function api_billing_event(text,text,text,text,jsonb) to anon, authenticated;
grant execute on function api_billing_processed(text,text) to anon, authenticated;
grant execute on function api_billing_subscription(text,uuid,text,text,text,text,timestamptz,timestamptz,timestamptz) to anon, authenticated;
grant execute on function api_billing_find_subscription(text,text,text) to anon, authenticated;
grant execute on function api_entitlement_grant(text,uuid,text,text,text,timestamptz) to anon, authenticated;
grant execute on function api_entitlement_revoke(text,uuid,text,text) to anon, authenticated;
grant execute on function api_usage_add(text,numeric) to authenticated;
grant execute on function api_admin_billing() to authenticated;
