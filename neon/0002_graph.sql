-- Knowledge graph (spec 8.10.7): people, places, events, groups and their relations. Public reference data (Neon, D-20).
create table if not exists kg_entities (
  id text primary key,
  kind text not null check (kind in ('person','place','event','period','group')),
  name_pt text,
  name_en text not null,
  aliases text[] not null default '{}',
  description text,
  period text,
  refs text[] not null default '{}',
  place_coords point,
  source_ids jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kg_entities_aliases on kg_entities using gin (aliases);
create index if not exists kg_entities_kind on kg_entities (kind);
create index if not exists kg_entities_name on kg_entities (lower(name_en));
create table if not exists kg_relations (
  from_id text not null references kg_entities(id) on delete cascade,
  to_id text not null references kg_entities(id) on delete cascade,
  relation text not null,
  refs text[] not null default '{}',
  primary key (from_id, to_id, relation)
);
create index if not exists kg_relations_to on kg_relations (to_id);
