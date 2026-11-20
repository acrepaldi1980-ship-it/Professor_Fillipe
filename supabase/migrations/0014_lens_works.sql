-- Prompt 1.5: ids of the enabled works of given traditions, so a student's lens can drive a dedicated search.
create or replace function api_lens_works(p_traditions text[])
returns table (id text)
language sql stable security definer set search_path = public as $$
  select w.id from works w
  where w.enabled and w.review_status = 'approved' and w.tradition = any (p_traditions[1:5])
    and w.kind in ('commentary', 'theology', 'study_notes', 'own_notes', 'encyclopedia', 'dictionary', 'history')
$$;
revoke all on function api_lens_works(text[]) from public;
grant execute on function api_lens_works(text[]) to anon, authenticated;
