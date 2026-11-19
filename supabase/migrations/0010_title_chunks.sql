-- Dictionary/encyclopedia entries by exact title ("Barnabas", "Ark"): the semantic and keyword signals can miss the entry
-- of the very word the student asked about when many Bible windows mention it, so the search also looks the title up.
create or replace function api_title_chunks(p_titles text[], p_limit int default 24)
returns table (id text, work_id text, text text, title_path text, refs text[], tradition text, kind text, language text,
               tokens int, rrf double precision, signals text[])
language sql stable security definer set search_path = public as $$
  select c.id, c.work_id, c.text, c.title_path, c.refs, c.tradition, c.kind, c.language, c.tokens,
         0.033::double precision as rrf, array['title']::text[] as signals
  from chunks c
  join works w on w.id = c.work_id and w.enabled and w.review_status = 'approved'
  where c.kind in ('dictionary','encyclopedia')
    and lower(split_part(c.title_path, ',', 1)) = any (select lower(t) from unnest(p_titles[1:40]) t)
  order by c.title_path, c.id
  limit least(greatest(p_limit, 1), 40)
$$;
revoke all on function api_title_chunks(text[], int) from public;
grant execute on function api_title_chunks(text[], int) to anon, authenticated;
