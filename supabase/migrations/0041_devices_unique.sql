-- A plain unique index (not partial) so a device can be registered with an upsert on (user_id, push_token); nulls stay distinct.
drop index if exists devices_user_token;
create unique index devices_user_token on devices (user_id, push_token);
