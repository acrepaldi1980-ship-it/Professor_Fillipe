-- Prompt 1.5: contrast search needs the works of all the other traditions at once (up to 10).
create or replace function api_lens_works(p_traditions text[])
returns table (id text)
language sql stable security definer set search_path = public as $$
  select w.id from works w
  where w.enabled and w.review_status = 'approved' and w.tradition = any (p_traditions[1:10])
    and w.kind in ('commentary', 'theology', 'study_notes', 'own_notes', 'encyclopedia', 'dictionary', 'history')
$$;
