-- Reference database (Neon): data that is looked up by reference and never holds personal data (hybrid architecture, D-20).
-- Same shapes as the Supabase tables; access is read-only for the app (role app_reader).
create table if not exists original_words (
  ref text not null,
  position int not null,
  surface text not null,
  lemma text,
  strong text,
  morph text,
  translit text,
  gloss text,
  source text not null check (source in ('wlc','step_tahot','step_tagnt')),
  primary key (ref, position, source)
);
create table if not exists lexicon_entries (
  id text primary key,
  strong text,
  lemma text,
  language text not null,
  source text not null,
  definition text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lexicon_strong on lexicon_entries (strong);
create table if not exists cross_refs (
  from_ref text not null,
  to_ref text not null,
  votes int not null default 0,
  source text not null,
  primary key (from_ref, to_ref, source)
);
create table if not exists verse_map (
  tradition text not null check (tradition in ('heb','lat','grc')),
  ref text not null,
  eng_ref text not null,
  primary key (tradition, ref)
);
create index if not exists verse_map_eng on verse_map (tradition, eng_ref);
