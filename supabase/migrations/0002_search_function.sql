-- Hybrid retrieval (spec 8.10.4): exact references + semantic (pgvector) + keyword (full text), fused with
-- Reciprocal Rank Fusion (k = 60). Authority/lens weights are applied afterwards in TypeScript (lib/knowledge/search.ts).

create or replace function search_chunks(
  q_embedding vector(384),
  q_text text,
  q_refs text[] default '{}',
  match_per_signal int default 40,
  allowed_work_ids text[] default null
)
returns table (
  id text,
  work_id text,
  text text,
  title_path text,
  refs text[],
  tradition text,
  kind text,
  language text,
  tokens int,
  rrf double precision,
  signals text[]
)
language sql stable as $$
  with eligible as (
    select c.id, c.work_id, c.text, c.title_path, c.refs, c.tradition, c.kind, c.language, c.tokens, c.embedding, c.tsv
    from chunks c
    join works w on w.id = c.work_id and w.enabled and w.review_status = 'approved'
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
      select e.id,
             ts_rank(e.tsv, case when e.language = 'pt' then websearch_to_tsquery('portuguese', q_text)
                                 else websearch_to_tsquery('english', q_text) end) as score
      from eligible e
      where e.tsv @@ case when e.language = 'pt' then websearch_to_tsquery('portuguese', q_text)
                          else websearch_to_tsquery('english', q_text) end
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
    ) s
    group by id
  )
  select e.id, e.work_id, e.text, e.title_path, e.refs, e.tradition, e.kind, e.language, e.tokens, f.rrf, f.signals
  from fused f join eligible e on e.id = f.id
  order by f.rrf desc
  limit match_per_signal;
$$;
