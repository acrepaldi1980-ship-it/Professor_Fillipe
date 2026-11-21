-- Analytics for events that arrive without the student's token (payment webhooks): written with the server secret.
create or replace function api_billing_track(p_secret text, p_user uuid, p_event text, p_props jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not billing_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  if p_event not in ('subscription_activated','subscription_canceled') then return; end if;
  insert into analytics_events (user_id, event, props) values (p_user, p_event, coalesce(p_props, '{}'));
end $$;
revoke all on function api_billing_track(text,uuid,text,jsonb) from public;
grant execute on function api_billing_track(text,uuid,text,jsonb) to anon, authenticated;
