-- The app's own content (kind own_notes) asked by its title ("Dilúvio: O corvo e a pomba"): an exact title phrase beats loosely related library passages.
-- Compares without accents and case; only the few hundred own_notes rows are scanned.
create or replace function library_phrase_titles(p_phrase text, p_limit int default 6)
returns table (id text, work_id text, text text, title_path text, refs text[], tradition text, kind text, language text, tokens int, rrf double precision, signals text[])
language sql stable as $$
  select c.id, c.work_id, c.text, c.title_path, c.refs, c.tradition, c.kind, c.language, c.tokens, 0.2::double precision, array['title','phrase']::text[]
  from chunks c
  join library_works w on w.id = c.work_id and w.enabled
  where c.kind = 'own_notes'
    and translate(lower(regexp_replace(regexp_replace(c.title_path, '^.* > ', ''), ' \(tela:.*$', '')), 'áàâãäéèêíìîóòôõöúùûüç', 'aaaaaeeeiiiooooouuuuc')
        = translate(lower(trim(p_phrase)), 'áàâãäéèêíìîóòôõöúùûüç', 'aaaaaeeeiiiooooouuuuc')
  order by c.id
  limit least(greatest(p_limit, 1), 12)
$$;
