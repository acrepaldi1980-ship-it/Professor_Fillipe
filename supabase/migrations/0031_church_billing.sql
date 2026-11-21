-- Church subscription: the same `subscriptions` row (user = the church administrator) is linked to the church; when it is paid the church becomes
-- active and every member receives their access right (church_sync_entitlements); when it lapses the church is suspended and the rights end.
create or replace function api_billing_church_link(p_secret text, p_provider text, p_ref text, p_church uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  update subscriptions set church_id = p_church, updated_at = now() where provider = p_provider and provider_ref = p_ref;
end $$;

create or replace function api_billing_church_sync(p_secret text, p_provider text, p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s subscriptions; on_ boolean;
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  select * into s from subscriptions where provider = p_provider and provider_ref = p_ref;
  if not found or s.church_id is null then return jsonb_build_object('church', null); end if;
  on_ := s.status in ('active', 'trialing', 'past_due') or (s.status = 'canceled' and coalesce(s.current_period_end, now()) > now());
  update churches set status = case when on_ then 'active' else 'suspended' end where id = s.church_id;
  perform church_sync_entitlements(s.church_id);
  return jsonb_build_object('church', s.church_id, 'active', on_);
end $$;
revoke all on function api_billing_church_link(text, text, text, uuid) from public;
revoke all on function api_billing_church_sync(text, text, text) from public;
grant execute on function api_billing_church_link(text, text, text, uuid) to anon, authenticated;
grant execute on function api_billing_church_sync(text, text, text) to anon, authenticated;
