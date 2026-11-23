-- Books of the historians for reading (Eusebius, Tacitus, Pliny, Suetonius...): one row per reading unit (a chapter, a letter or a block of a life), in the order of the work.
-- text is the public-domain English translation; text_pt is the Portuguese (machine) translation, filled by scripts/translate.
create table if not exists hist_works (
  id text primary key,
  author text not null,
  title text not null,
  edition text not null,
  note text not null default ''
);
create table if not exists hist_units (
  work text not null,
  ord int not null,
  part text not null default '',
  label text not null,
  title text not null default '',
  text text not null,
  text_pt text,
  title_pt text,
  primary key (work, ord)
);
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'app_reader') then
    grant select on hist_works, hist_units to app_reader;
  end if;
end $$;
