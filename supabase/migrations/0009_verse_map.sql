-- Versification mapping (spec 8.10.5): verse numbers that differ between traditions, mapped to the English (KJV) numbering.
-- Source: STEPBible TVTMS (Tyndale House, CC BY 4.0). Only verses whose number differs are stored.
create table if not exists verse_map (
  tradition text not null check (tradition in ('heb','lat','grc')),
  ref text not null,
  eng_ref text not null,
  primary key (tradition, ref)
);
create index if not exists verse_map_eng on verse_map (tradition, eng_ref);
alter table verse_map enable row level security;
drop policy if exists verse_map_read on verse_map;
create policy verse_map_read on verse_map for select to anon, authenticated using (true);
