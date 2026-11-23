-- Search in Portuguese: chunks with language = 'pt' (the machine translation of Josephus and of the historians) get their own keyword branch,
-- using the Portuguese text-search configuration. The old five-argument function is replaced (two overloads would make calls ambiguous).
-- A Portuguese question is a sentence, not a list of keywords: the branch matches ANY of its stems (stop words removed) and ranks by how many match.
drop function if exists library_search(vector, text, text[], int, text[]);
create or replace function library_search(
  q_embedding vector(384),
  q_text text,
  q_refs text[] default '{}',
  match_per_signal int default 40,
  allowed_work_ids text[] default null
)
returns table (id text, work_id text, text text, title_path text, refs text[], tradition text, kind text, language text,
               tokens int, rrf double precision, signals text[])
language sql stable as $$
  with eligible as (
    select c.id, c.work_id, c.text, c.title_path, c.refs, c.tradition, c.kind, c.language, c.tokens, c.embedding, c.tsv
    from chunks c
    join library_works w on w.id = c.work_id and w.enabled
    where allowed_work_ids is null or c.work_id = any (allowed_work_ids)
  ),
  exact as (
    select e.id, row_number() over (order by cardinality(array(select unnest(e.refs) intersect select unnest(q_refs))) desc, e.id) as rnk
    from eligible e
    where cardinality(q_refs) > 0 and e.refs && q_refs
    limit match_per_signal
  ),
  semantic as (
    select e.id, row_number() over (order by e.embedding <=> q_embedding) as rnk
    from eligible e
    where e.embedding is not null
    order by e.embedding <=> q_embedding
    limit match_per_signal
  ),
  keyword as (
    select k.id, row_number() over (order by k.score desc) as rnk
    from (
      select e.id, ts_rank(e.tsv, websearch_to_tsquery('english', q_text)) as score
      from eligible e
      where e.language <> 'pt' and e.tsv @@ websearch_to_tsquery('english', q_text)
    ) k
    order by k.score desc
    limit match_per_signal
  ),
  pt_query as (
    select to_tsquery('simple', string_agg(quote_literal(l), ' | ')) as q
    from unnest(tsvector_to_array(to_tsvector('portuguese', coalesce(q_text, '')))) as l
  ),
  keyword_pt as (
    select k.id, row_number() over (order by k.score desc) as rnk
    from (
      select e.id, ts_rank(e.tsv, p.q) as score
      from eligible e, pt_query p
      where p.q is not null and e.language = 'pt' and e.tsv @@ p.q
    ) k
    order by k.score desc
    limit match_per_signal
  ),
  fused as (
    select id, sum(1.0 / (60 + rnk)) as rrf, array_agg(sig) as signals
    from (
      select id, rnk, 'exact' as sig from exact
      union all select id, rnk, 'semantic' from semantic
      union all select id, rnk, 'keyword' from keyword
      union all select id, rnk, 'keyword' from keyword_pt
    ) s
    group by id
  )
  select e.id, e.work_id, e.text, e.title_path, e.refs, e.tradition, e.kind, e.language, e.tokens, f.rrf, f.signals
  from fused f join eligible e on e.id = f.id
  order by f.rrf desc
  limit match_per_signal;
$$;
grant execute on function library_search(vector, text, text[], int, text[]) to app_reader;
