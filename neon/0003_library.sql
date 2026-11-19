-- Library of public-domain works (history, commentary, theology, philosophy): searchable chunks live here (Neon, D-20),
-- because the Supabase free database has no room left. Same shape and same hybrid search as the Supabase `chunks`.
create extension if not exists vector;
create table if not exists library_works (
  id text primary key,
  enabled boolean not null default true
);
create table if not exists chunks (
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
  created_at timestamptz not null default now()
);
create index if not exists chunks_work on chunks (work_id);
create index if not exists chunks_refs on chunks using gin (refs);
create index if not exists chunks_tsv on chunks using gin (tsv);
create index if not exists chunks_embedding on chunks using hnsw (embedding vector_cosine_ops);

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
