-- Daily job (pg_cron): applies the time-based subscription transitions of lib/payments/state.ts `tick` in the database,
-- so the stored status matches reality even if nobody opens the app. Access itself already ends by entitlements.expires_at.
create extension if not exists pg_cron;

create or replace function billing_daily_tick()
returns table (suspended int, expired int) language plpgsql security definer set search_path = public as $$
declare s int; e int;
begin
  -- past_due for more than 5 days of grace -> suspended (back to Free)
  update subscriptions set status = 'suspended', updated_at = now()
   where status = 'past_due' and overdue_since is not null and overdue_since + interval '5 days' <= now();
  get diagnostics s = row_count;
  -- trial or canceled period over -> expired
  update subscriptions set status = 'expired', updated_at = now()
   where status in ('trialing', 'canceled') and current_period_end is not null and current_period_end <= now();
  get diagnostics e = row_count;
  -- access rights of suspended/expired subscriptions end now
  update entitlements en set status = 'expired', updated_at = now()
   where en.status = 'active' and en.source_ref is not null
     and exists (select 1 from subscriptions su where su.provider_ref = en.source_ref and su.user_id = en.user_id and su.status in ('suspended', 'expired'));
  return query select s, e;
end $$;
revoke all on function billing_daily_tick() from public, anon, authenticated;

select cron.unschedule('billing-daily-tick') where exists (select 1 from cron.job where jobname = 'billing-daily-tick');
select cron.schedule('billing-daily-tick', '10 6 * * *', 'select billing_daily_tick()');
