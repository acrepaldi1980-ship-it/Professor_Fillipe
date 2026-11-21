-- Prompt 1.13: hardening found by scripts/rls-audit.mjs and rate limiting.

-- 1) Visitors (anon) never write tables directly: every public write goes through a SECURITY DEFINER function that validates it.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon;
-- signed-in users keep insert/update/delete (guarded by RLS) but not truncate/references/trigger
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

-- 2) Internal helpers and admin functions are not callable by visitors (admin ones also check the role inside).
do $$ declare f text; begin
  foreach f in array array['audit(text,text,jsonb)','billing_secret_ok(text)','api_usage_add(text,numeric)','api_illustration_get(text)','api_illustration_library(text[])','api_illustration_put(text,text,text,text,text,integer)','api_illustration_quota(integer)','api_publish_note(uuid,vector)','api_unpublish_note(uuid)','api_delete_my_account()','api_admin_works()','api_admin_set_work(text,boolean)','api_flagged_answers(text)','api_review_flag(uuid,text,text)','api_admin_users(text)','api_admin_user_payments(uuid)','api_admin_set_role(uuid,text)','api_admin_update_plan(text,numeric,numeric,jsonb,jsonb,boolean)','api_admin_update_sermon_type(uuid,text,text,boolean)','api_admin_new_prompt_version(text,text)','api_admin_activate_prompt(text,integer)','api_admin_prompts()','api_admin_audit()','api_admin_metrics()','api_admin_billing()','api_track(text,jsonb)'] loop
    execute format('revoke execute on function %s from anon, public', f);
  end loop;
  -- the audit helper and the secret check are only used inside other functions
  revoke execute on function audit(text, text, jsonb) from authenticated;
  revoke execute on function billing_secret_ok(text) from authenticated;
end $$;

-- 3) Rate limiting (per user and per hashed IP): fixed windows in a small table.
create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  n int not null default 1,
  primary key (key, window_start)
);
alter table rate_limits enable row level security; -- no policy: only the function below touches it

create or replace function api_rate_check(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare w timestamptz; c int;
begin
  if p_limit <= 0 or p_window_seconds <= 0 or length(p_key) > 120 then return false; end if;
  w := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into rate_limits (key, window_start, n) values (p_key, w, 1)
    on conflict (key, window_start) do update set n = rate_limits.n + 1 returning n into c;
  if random() < 0.01 then delete from rate_limits where window_start < now() - interval '1 day'; end if;
  return c <= p_limit;
end $$;
revoke all on function api_rate_check(text, int, int) from public;
grant execute on function api_rate_check(text, int, int) to anon, authenticated;

-- 4) Errors seen in production, without any user text: route, short code, count per hour (for the admin dashboard and alerts).
create table if not exists app_errors (
  route text not null,
  code text not null,
  hour timestamptz not null,
  n int not null default 1,
  primary key (route, code, hour)
);
alter table app_errors enable row level security;
drop policy if exists app_errors_admin on app_errors;
create policy app_errors_admin on app_errors for select to authenticated using (is_admin());
create or replace function api_log_error(p_route text, p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into app_errors (route, code, hour) values (left(p_route, 80), left(p_code, 60), date_trunc('hour', now()))
    on conflict (route, code, hour) do update set n = app_errors.n + 1;
end $$;
revoke all on function api_log_error(text, text) from public;
grant execute on function api_log_error(text, text) to anon, authenticated;

create or replace function api_admin_errors()
returns table (route text, code text, n bigint, last_hour timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return query select e.route, e.code, sum(e.n)::bigint, max(e.hour) from app_errors e where e.hour > now() - interval '24 hours' group by 1, 2 order by 3 desc limit 50;
end $$;
revoke all on function api_admin_errors() from public, anon;
grant execute on function api_admin_errors() to authenticated;
