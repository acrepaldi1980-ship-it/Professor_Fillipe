-- Multi-provider LLM gateway: shared cooldowns (all serverless instances stop hitting a rate-limited key at once) and hourly metrics.
-- Writes go through functions protected by the server secret (the anon key is public, so it must never be able to change these tables).
create table if not exists llm_cooldowns (
  id text primary key,
  until_at timestamptz not null,
  reason text not null default '',
  updated_at timestamptz not null default now()
);
create table if not exists llm_stats_hourly (
  id text not null,
  hour timestamptz not null,
  calls int not null default 0,
  ok int not null default 0,
  rate_limited int not null default 0,
  quota int not null default 0,
  auth_errors int not null default 0,
  other_errors int not null default 0,
  ms_total bigint not null default 0,
  primary key (id, hour)
);
alter table llm_cooldowns enable row level security;
alter table llm_stats_hourly enable row level security;
drop policy if exists llm_stats_admin on llm_stats_hourly;
create policy llm_stats_admin on llm_stats_hourly for select to authenticated using (is_admin());

create or replace function api_llm_cooldowns(p_secret text)
returns table (id text, until_ms bigint) language plpgsql stable security definer set search_path = public as $$
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  return query select c.id, (extract(epoch from c.until_at) * 1000)::bigint from llm_cooldowns c where c.until_at > now();
end $$;

create or replace function api_llm_set_cooldown(p_secret text, p_id text, p_seconds int, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  if length(p_id) > 200 or p_seconds < 1 or p_seconds > 86400 then return; end if;
  insert into llm_cooldowns (id, until_at, reason) values (p_id, now() + make_interval(secs => p_seconds), left(p_reason, 40))
    on conflict (id) do update set until_at = greatest(llm_cooldowns.until_at, excluded.until_at), reason = excluded.reason, updated_at = now();
  if random() < 0.02 then delete from llm_cooldowns where until_at < now() - interval '1 day'; end if;
end $$;

create or replace function api_llm_record(p_secret text, p_id text, p_ok boolean, p_kind text, p_ms int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  if length(p_id) > 200 then return; end if;
  insert into llm_stats_hourly (id, hour, calls, ok, rate_limited, quota, auth_errors, other_errors, ms_total)
  values (p_id, date_trunc('hour', now()), 1, case when p_ok then 1 else 0 end, case when p_kind = 'rate_limit' then 1 else 0 end, case when p_kind = 'quota' then 1 else 0 end, case when p_kind = 'auth' then 1 else 0 end,
          case when not p_ok and p_kind not in ('rate_limit', 'quota', 'auth') then 1 else 0 end, greatest(p_ms, 0))
  on conflict (id, hour) do update set calls = llm_stats_hourly.calls + 1, ok = llm_stats_hourly.ok + excluded.ok, rate_limited = llm_stats_hourly.rate_limited + excluded.rate_limited,
    quota = llm_stats_hourly.quota + excluded.quota, auth_errors = llm_stats_hourly.auth_errors + excluded.auth_errors, other_errors = llm_stats_hourly.other_errors + excluded.other_errors, ms_total = llm_stats_hourly.ms_total + excluded.ms_total;
end $$;

-- Admin view: per endpoint in the last 24 h and who is cooling down now.
create or replace function api_admin_llm()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'endpoints', coalesce((select jsonb_agg(x order by x->>'id') from (select jsonb_build_object('id', id, 'calls', sum(calls), 'ok', sum(ok), 'rate_limited', sum(rate_limited), 'quota', sum(quota), 'auth', sum(auth_errors), 'errors', sum(other_errors), 'avg_ms', case when sum(calls) > 0 then (sum(ms_total) / sum(calls))::int else 0 end) x from llm_stats_hourly where hour > now() - interval '24 hours' group by id) q), '[]'::jsonb),
    'cooling', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'seconds', greatest(0, extract(epoch from until_at - now())::int), 'reason', reason)) from llm_cooldowns where until_at > now()), '[]'::jsonb)
  ) into r;
  return r;
end $$;

revoke all on function api_llm_cooldowns(text) from public;
revoke all on function api_llm_set_cooldown(text, text, int, text) from public;
revoke all on function api_llm_record(text, text, boolean, text, int) from public;
revoke all on function api_admin_llm() from public, anon;
grant execute on function api_llm_cooldowns(text) to anon, authenticated;
grant execute on function api_llm_set_cooldown(text, text, int, text) to anon, authenticated;
grant execute on function api_llm_record(text, text, boolean, text, int) to anon, authenticated;
grant execute on function api_admin_llm() to authenticated;
revoke truncate, references, trigger on llm_cooldowns, llm_stats_hourly from authenticated;
revoke all on llm_cooldowns, llm_stats_hourly from anon;
