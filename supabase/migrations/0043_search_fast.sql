-- Fast hybrid search (Prompt: teacher speed). The old search_chunks ranked every chunk with window functions and spilled to disk: ~6 s per question on the
-- production database. This version asks the HNSW index for the nearest chunks (limit 200), uses the GIN indexes for words and references, and only then
-- keeps the chunks of enabled and approved works. Same arguments and same output as search_chunks; the old function stays for comparison.
create or replace function search_chunks_fast(
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
language plpgsql stable as $$
#variable_conflict use_column
declare
  n int := greatest(match_per_signal / 2, 1);
  tsq_pt tsquery := websearch_to_tsquery('portuguese', coalesce(q_text, ''));
  tsq_en tsquery := websearch_to_tsquery('english', coalesce(q_text, ''));
begin
  perform set_config('hnsw.ef_search', '200', true);
  return query
  with ok as (
    select w.id from works w
    where w.enabled and w.review_status = 'approved' and (allowed_work_ids is null or w.id = any (allowed_work_ids))
  ),
  exact as (
    select x.id, row_number() over (partition by x.is_bible order by x.overlap desc, x.id) as rnk
    from (
      select c.id, (c.kind = 'bible_text') as is_bible,
             cardinality(array(select unnest(c.refs) intersect select unnest(q_refs))) as overlap
      from chunks c join ok on ok.id = c.work_id
      where cardinality(q_refs) > 0 and c.refs && q_refs
    ) x
  ),
  sem_cand as (
    (select c.id, c.work_id, c.kind, c.embedding <=> q_embedding as dist
       from chunks c where allowed_work_ids is null and c.embedding is not null
       order by c.embedding <=> q_embedding limit 200)
    union all
    (select c.id, c.work_id, c.kind, c.embedding <=> q_embedding as dist
       from chunks c where allowed_work_ids is not null and c.work_id = any (allowed_work_ids) and c.embedding is not null
       order by c.embedding <=> q_embedding limit 200)
  ),
  semantic as (
    select s.id, s.rnk from (
      select sc.id, row_number() over (partition by (sc.kind = 'bible_text') order by sc.dist) as rnk
      from sem_cand sc join ok on ok.id = sc.work_id
    ) s where s.rnk <= n
  ),
  kw as (
    select k.id, row_number() over (partition by k.is_bible order by k.score desc) as rnk from (
      select c.id, (c.kind = 'bible_text') as is_bible, ts_rank(c.tsv, tsq_pt) as score
        from chunks c join ok on ok.id = c.work_id where c.language = 'pt' and c.tsv @@ tsq_pt
      union all
      select c.id, (c.kind = 'bible_text') as is_bible, ts_rank(c.tsv, tsq_en) as score
        from chunks c join ok on ok.id = c.work_id where c.language <> 'pt' and c.tsv @@ tsq_en
    ) k
  ),
  keyword as (select kw.id, kw.rnk from kw where kw.rnk <= n),
  fused as (
    select s.id, sum(1.0 / (60 + s.rnk)) as rrf, array_agg(s.sig) as signals
    from (
      select exact.id, exact.rnk, 'exact' as sig from exact where exact.rnk <= n
      union all select semantic.id, semantic.rnk, 'semantic' from semantic
      union all select keyword.id, keyword.rnk, 'keyword' from keyword
    ) s
    group by s.id
  )
  select c.id, c.work_id, c.text, c.title_path, c.refs, c.tradition, c.kind, c.language, c.tokens, f.rrf::double precision, f.signals
  from fused f join chunks c on c.id = f.id
  order by f.rrf desc
  limit match_per_signal * 2;
end $$;

create or replace function api_search_chunks_fast(
  q_embedding vector(384), q_text text, q_refs text[] default '{}', match_per_signal int default 40, allowed_work_ids text[] default null
)
returns table (id text, work_id text, text text, title_path text, refs text[], tradition text, kind text, language text,
               tokens int, rrf double precision, signals text[])
language sql stable security definer set search_path = public as $$
  select * from search_chunks_fast(q_embedding, left(q_text, 500), q_refs[1:200], least(greatest(match_per_signal, 1), 60), allowed_work_ids)
$$;
revoke all on function api_search_chunks_fast(vector, text, text[], int, text[]) from public;
grant execute on function api_search_chunks_fast(vector, text, text[], int, text[]) to anon, authenticated;
