-- Keep a longer reason (kind + the provider's short message) so the admin panel shows why an endpoint is paused.
create or replace function api_llm_set_cooldown(p_secret text, p_id text, p_seconds int, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  if length(p_id) > 200 or p_seconds < 1 or p_seconds > 86400 then return; end if;
  insert into llm_cooldowns (id, until_at, reason) values (p_id, now() + make_interval(secs => p_seconds), left(p_reason, 160))
    on conflict (id) do update set until_at = greatest(llm_cooldowns.until_at, excluded.until_at), reason = excluded.reason, updated_at = now();
  if random() < 0.02 then delete from llm_cooldowns where until_at < now() - interval '1 day'; end if;
end $$;
revoke all on function api_llm_set_cooldown(text, text, int, text) from public;
grant execute on function api_llm_set_cooldown(text, text, int, text) to anon, authenticated;
