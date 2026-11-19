-- License review queue (spec 8.10.9): works that did NOT pass the license gate and are kept out of the base until a person decides.
create table if not exists library_review (
  id text primary key,
  title text not null,
  authors text,
  reason text not null,
  created_at timestamptz not null default now()
);
