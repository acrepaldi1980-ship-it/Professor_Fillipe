-- Prompt 1.9 (D-05): illustrations generated on demand, cached by prompt hash and shared (the image is stored in the row, webp ~50 KB).
alter table illustrations add column if not exists image_b64 text;
alter table illustrations add column if not exists mime text not null default 'image/webp';
alter table illustrations add column if not exists alt text;
alter table illustrations add column if not exists style_version int not null default 1;

create or replace function api_illustration_get(p_hash text)
returns table (mime text, image_b64 text, alt text, approved boolean)
language sql stable security definer set search_path = public as $$
  select i.mime, i.image_b64, i.alt, i.approved from illustrations i where i.prompt_hash = p_hash and i.image_b64 is not null
$$;

-- Approved library first: an approved illustration whose tags match is reused instead of generating a new one.
create or replace function api_illustration_library(p_tags text[])
returns table (prompt_hash text, alt text)
language sql stable security definer set search_path = public as $$
  select i.prompt_hash, i.alt from illustrations i where i.approved and i.image_b64 is not null and i.tags && p_tags order by i.created_at limit 1
$$;

create or replace function api_illustration_put(p_hash text, p_prompt text, p_image text, p_mime text, p_alt text, p_style int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if length(p_image) > 600000 then raise exception 'image_too_large'; end if;
  insert into illustrations (prompt_hash, prompt, image_b64, mime, alt, style_version)
  values (p_hash, left(p_prompt, 1000), p_image, p_mime, left(p_alt, 300), p_style)
  on conflict (prompt_hash) do update set image_b64 = coalesce(illustrations.image_b64, excluded.image_b64), alt = coalesce(illustrations.alt, excluded.alt), updated_at = now();
end $$;

-- Daily limit per student (usage_counters). Returns true when the student may generate one more.
create or replace function api_illustration_quota(p_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return false; end if;
  insert into usage_counters (user_id, day, illustrations) values (auth.uid(), current_date, 0) on conflict (user_id, day) do nothing;
  select illustrations into n from usage_counters where user_id = auth.uid() and day = current_date for update;
  if n >= p_limit then return false; end if;
  update usage_counters set illustrations = illustrations + 1 where user_id = auth.uid() and day = current_date;
  return true;
end $$;

revoke all on function api_illustration_get(text) from public;
revoke all on function api_illustration_library(text[]) from public;
revoke all on function api_illustration_put(text, text, text, text, text, int) from public;
revoke all on function api_illustration_quota(int) from public;
grant execute on function api_illustration_get(text) to authenticated;
grant execute on function api_illustration_library(text[]) to authenticated;
grant execute on function api_illustration_put(text, text, text, text, text, int) to authenticated;
grant execute on function api_illustration_quota(int) to authenticated;
