-- Knowledge base (spec 9.3 / 8.10). Plain Postgres + pgvector, portable across providers.
-- Embedding dimension 384 = multilingual-e5-small (D-09).

create extension if not exists vector;
create extension if not exists unaccent;

create table if not exists works (
  id text primary key,
  title text not null,
  authors text[] not null default '{}',
  translators text[] not null default '{}',
  author_death_years int[] not null default '{}',
  pub_year int,
  language text not null,
  kind text not null check (kind in ('bible_text','study_notes','encyclopedia','dictionary','lexicon','commentary','theology','history','archaeology','geodata','philosophy','academic_article','own_notes')),
  tradition text not null default 'general' check (tradition in ('pentecostal','baptist','reformed','wesleyan','lutheran','anabaptist','dispensational','catholic','orthodox','patristic','jewish','general')),
  license text not null check (license in ('public_domain','cc0','cc_by','cc_by_sa','licensed')),
  credit_text text,
  source_url text,
  collected_at timestamptz,
  file_hash text,
  enabled boolean not null default false,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bible_versions (
  id text primary key,
  work_id text not null references works(id) on delete cascade,
  name text not null,
  abbreviation text not null,
  language text not null,
  audience text not null default 'general' check (audience in ('general','beginner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bible_verses (
  version_id text not null references bible_versions(id) on delete cascade,
  ref text not null,            -- e.g. JHN.3.16
  book_code text not null,
  chapter int not null,
  verse int not null,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (version_id, ref)
);
create index if not exists bible_verses_lookup on bible_verses (version_id, book_code, chapter, verse);

create table if not exists chunks (
  id text primary key,          -- deterministic: <work_id>:<n>, so ingestion is idempotent
  work_id text not null references works(id) on delete cascade,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chunks_work on chunks (work_id);
create index if not exists chunks_refs on chunks using gin (refs);
create index if not exists chunks_tsv on chunks using gin (tsv);
create index if not exists chunks_embedding on chunks using hnsw (embedding vector_cosine_ops);

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['works','bible_versions','bible_verses','chunks'] loop
    execute format('drop trigger if exists %I_updated on %I', t, t);
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- Row Level Security: the app reads this data through the server (secret key).
-- Only the public catalog (enabled works, Bible text) is readable by anon, for the "Fontes e licenças" page.
alter table works enable row level security;
alter table bible_versions enable row level security;
alter table bible_verses enable row level security;
alter table chunks enable row level security;

drop policy if exists works_public_read on works;
create policy works_public_read on works for select using (enabled and review_status = 'approved');
drop policy if exists bible_versions_public_read on bible_versions;
create policy bible_versions_public_read on bible_versions for select
  using (exists (select 1 from works w where w.id = bible_versions.work_id and w.enabled and w.review_status = 'approved'));
drop policy if exists bible_verses_public_read on bible_verses;
create policy bible_verses_public_read on bible_verses for select
  using (exists (select 1 from bible_versions v join works w on w.id = v.work_id
                 where v.id = bible_verses.version_id and w.enabled and w.review_status = 'approved'));
-- chunks: no anon policy (server only).
