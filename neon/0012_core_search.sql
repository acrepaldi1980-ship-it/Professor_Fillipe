-- The "core" search (28/11/2026): the Bible windows (Portuguese and English) and Easton's dictionary, moved from the Supabase search to Neon.
-- Why: on the free Supabase plan the first search call after a pause sometimes takes 3 to 6 s (5 of 12 measured), on Neon 0.53 s every time (docs/ARQUITETURA_ANALISE.md 7.3).
-- core_search is search_chunks (supabase/migrations/0003) unchanged except for its tables, so the ranking is the same: Bible windows and everything else keep their own
-- candidate lists, otherwise a dictionary entry would never reach the fusion step.
create table if not exists core_works (id text primary key, enabled boolean not null default true);
create table if not exists core_chunks (
  id text primary key,
  work_id text not null,
  text text not null,
  language text not null,
  title_path text,
  refs text[] not null default '{}',
  tradition text not null default 'general',
  kind text not null,
  license text not null,
  tokens int,
  embedding vector(384),
  tsv tsvector generated always as (
    case when language = 'pt' then to_tsvector('portuguese'::regconfig, coalesce(title_path,'') || ' ' || text)
         else to_tsvector('english'::regconfig, coalesce(title_path,'') || ' ' || text) end
  ) stored,
  title_key text generated always as (lower(trim(split_part(regexp_replace(coalesce(title_path, ''), '^.* > ', ''), ',', 1)))) stored
);
create index if not exists core_chunks_work on core_chunks (work_id);
create index if not exists core_chunks_refs on core_chunks using gin (refs);
create index if not exists core_chunks_tsv on core_chunks using gin (tsv);
create index if not exists core_chunks_title_key on core_chunks (title_key) where kind in ('dictionary', 'encyclopedia');

create or replace function core_search(
  q_embedding vector(384),
  q_text text,
  q_refs text[] default '{}',
  match_per_signal int default 40,
  allowed_work_ids text[] default null
)
returns table (id text, work_id text, text text, title_path text, refs text[], tradition text, kind text, language text, tokens int, rrf double precision, signals text[])
language sql stable as $$
  with eligible as (
    select c.id, c.work_id, c.text, c.title_path, c.refs, c.tradition, c.kind, c.language, c.tokens, c.embedding, c.tsv,
           (c.kind = 'bible_text') as is_bible
    from core_chunks c
    join core_works w on w.id = c.work_id and w.enabled
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

-- Dictionary entries titled exactly with one of the words (same as api_title_chunks on Supabase).
create or replace function core_titles(p_titles text[], p_limit int default 24)
returns table (id text, work_id text, text text, title_path text, refs text[], tradition text, kind text, language text, tokens int, rrf double precision, signals text[])
language sql stable as $$
  select c.id, c.work_id, c.text, c.title_path, c.refs, c.tradition, c.kind, c.language, c.tokens, 0.033::double precision, array['title']::text[]
  from core_chunks c
  join core_works w on w.id = c.work_id and w.enabled
  where c.kind in ('dictionary', 'encyclopedia') and c.title_key = any (select lower(t) from unnest(p_titles[1:40]) t)
  order by c.title_path, c.id
  limit least(greatest(p_limit, 1), 40)
$$;
