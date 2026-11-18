-- Balanced retrieval: Bible windows are far more numerous than dictionary/commentary chunks, so each signal
-- (semantic, keyword) keeps its best candidates separately for Bible text and for everything else.
-- Otherwise a dictionary entry such as "Barnabas" never reaches the fusion step.

create or replace function search_chunks(
  q_embedding vector(384),
  q_text text,
  q_refs text[] default '{}',
  match_per_signal int default 40,
  allowed_work_ids text[] default null
)
returns table (
  id text, work_id text, text text, title_path text, refs text[], tradition text, kind text, language text,
  tokens int, rrf double precision, signals text[]
)
language sql stable as $$
  with eligible as (
    select c.id, c.work_id, c.text, c.title_path, c.refs, c.tradition, c.kind, c.language, c.tokens, c.embedding, c.tsv,
           (c.kind = 'bible_text') as is_bible
    from chunks c
    join works w on w.id = c.work_id and w.enabled and w.review_status = 'approved'
    where allowed_work_ids is null or c.work_id = any (allowed_work_ids)
  ),
  exact as (
    select id, row_number() over (partition by is_bible order by overlap desc, id) as rnk
    from (
      select e.id, e.is_bible, cardinality(array(select unnest(e.refs) intersect select unnest(q_refs))) as overlap
      from eligible e
      where cardinality(q_refs) > 0 and e.refs && q_refs
    ) x
  ),
  semantic as (
    select id, rnk from (
      select e.id, row_number() over (partition by e.is_bible order by e.embedding <=> q_embedding) as rnk
      from eligible e where e.embedding is not null
    ) s where rnk <= match_per_signal / 2
  ),
  keyword as (
    select id, rnk from (
      select k.id, row_number() over (partition by k.is_bible order by k.score desc) as rnk
      from (
        select e.id, e.is_bible,
               ts_rank(e.tsv, case when e.language = 'pt' then websearch_to_tsquery('portuguese', q_text)
                                   else websearch_to_tsquery('english', q_text) end) as score
        from eligible e
        where e.tsv @@ case when e.language = 'pt' then websearch_to_tsquery('portuguese', q_text)
                            else websearch_to_tsquery('english', q_text) end
      ) k
    ) s where rnk <= match_per_signal / 2
  ),
  fused as (
    select id, sum(1.0 / (60 + rnk)) as rrf, array_agg(sig) as signals
    from (
      select id, rnk, 'exact' as sig from exact where rnk <= match_per_signal / 2
      union all select id, rnk, 'semantic' from semantic
      union all select id, rnk, 'keyword' from keyword
    ) s
    group by id
  )
  select e.id, e.work_id, e.text, e.title_path, e.refs, e.tradition, e.kind, e.language, e.tokens, f.rrf, f.signals
  from fused f join eligible e on e.id = f.id
  order by f.rrf desc
  limit match_per_signal * 2;
$$;
