-- The works of Flavius Josephus (30 books in four works) in Whiston's public-domain translation, structured for reading: sections numbered the way scholars cite them
-- (Ant. 18.3.3). The search chunks of the same text live in `chunks` (works jos_ant, jos_war, jos_life, jos_apion).
create table if not exists josephus_sections (
  work text not null,
  book int not null,
  chapter int not null,
  n int not null,
  text text not null,
  primary key (work, book, chapter, n)
);
create table if not exists josephus_chapters (
  work text not null,
  book int not null,
  chapter int not null,
  title text not null default '',
  primary key (work, book, chapter)
);
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'app_reader') then
    grant select on josephus_sections, josephus_chapters to app_reader;
  end if;
end $$;
