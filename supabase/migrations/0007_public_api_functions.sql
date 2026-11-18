-- The deployed app must NOT hold an account-level database token. These SECURITY DEFINER functions are the only
-- doors it uses besides Row Level Security: knowledge search, Bible verse lookup, anonymous feedback and
-- "delete my account". They expose nothing else, and every one validates its input.

-- Knowledge search (wraps search_chunks, which reads tables the visitor cannot read directly).
create or replace function api_search_chunks(
  q_embedding vector(384),
  q_text text,
  q_refs text[] default '{}',
  match_per_signal int default 40,
  allowed_work_ids text[] default null
)
returns table (id text, work_id text, text text, title_path text, refs text[], tradition text, kind text, language text,
               tokens int, rrf double precision, signals text[])
language sql stable security definer set search_path = public as $$
  select * from search_chunks(q_embedding, left(q_text, 500), q_refs[1:200], least(greatest(match_per_signal, 1), 60), allowed_work_ids)
$$;

-- Bible verses of an enabled version: by verse refs and/or whole chapters ("JHN.3").
create or replace function api_bible_verses(p_version text, p_refs text[] default '{}', p_chapters text[] default '{}')
returns table (version_id text, ref text, text text)
language sql stable security definer set search_path = public as $$
  select v.version_id, v.ref, v.text
  from bible_verses v
  join bible_versions bv on bv.id = v.version_id
  join works w on w.id = bv.work_id and w.enabled and w.review_status = 'approved'
  where v.version_id = p_version
    and (v.ref = any (p_refs[1:300]) or (v.book_code || '.' || v.chapter::text) = any (p_chapters[1:20]))
  order by v.book_code, v.chapter, v.verse
  limit 300
$$;

-- Anonymous prototype feedback.
create or replace function api_submit_feedback(p_rating int, p_comment text default null, p_session_ref text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_rating not between 1 and 5 then raise exception 'invalid_rating'; end if;
  insert into feedback (rating, comment, session_ref) values (p_rating, left(p_comment, 2000), left(p_session_ref, 100));
end $$;

-- A signed-in user deletes their own account; every user table cascades from auth.users (RF-M01-03).
create or replace function api_delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function api_search_chunks(vector, text, text[], int, text[]) from public;
revoke all on function api_bible_verses(text, text[], text[]) from public;
revoke all on function api_submit_feedback(int, text, text) from public;
revoke all on function api_delete_my_account() from public;
grant execute on function api_search_chunks(vector, text, text[], int, text[]) to anon, authenticated;
grant execute on function api_bible_verses(text, text[], text[]) to anon, authenticated;
grant execute on function api_submit_feedback(int, text, text) to anon, authenticated;
grant execute on function api_delete_my_account() to authenticated;
