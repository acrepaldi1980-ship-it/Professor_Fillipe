-- Bible reader (spec 8.24, M24): reading state, what the student has read, reading plans, notes on verses, and a cache of verse explanations.
-- Personal data (what a person reads and writes is religious by nature): Row Level Security by user on every personal table.
create table if not exists reader_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version_id text not null,
  compare_version_id text,
  last_ref text,
  font_scale numeric(3,2) not null default 1.0 check (font_scale between 0.8 and 2.0),
  updated_at timestamptz not null default now()
);

create table if not exists bible_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  ref text not null check (ref ~ '^[0-9A-Z]{3}\.\d+\.\d+$'),
  book_code text generated always as (substr(ref, 1, 3)) stored,
  read_at timestamptz not null default now(),
  primary key (user_id, ref)
);
create index if not exists bible_reads_book on bible_reads (user_id, book_code);

create table if not exists reading_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  name text not null check (char_length(name) between 1 and 120),
  start_date date not null,
  schedule jsonb not null,
  done_days int[] not null default '{}',
  paused boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists reading_plans_user on reading_plans (user_id, created_at desc);

create table if not exists verse_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version_id text not null,
  ref_start text not null check (ref_start ~ '^[0-9A-Z]{3}\.\d+\.\d+$'),
  ref_end text not null check (ref_end ~ '^[0-9A-Z]{3}\.\d+\.\d+$'),
  book_code text generated always as (substr(ref_start, 1, 3)) stored,
  chapter int generated always as (split_part(ref_start, '.', 2)::int) stored,
  text text not null check (char_length(text) between 1 and 4000),
  context text check (context is null or char_length(context) <= 40),
  tags text[] not null default '{}',
  color text check (color is null or color in ('yellow','green','blue','pink','orange')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists verse_notes_user_book on verse_notes (user_id, book_code, chapter);
create index if not exists verse_notes_user_date on verse_notes (user_id, created_at desc);

-- Explanations of verses made by the teacher, kept per student (so a verse is not explained twice, and nobody can put text in front of another student).
create table if not exists verse_help (
  user_id uuid not null references auth.users(id) on delete cascade,
  version_id text not null,
  ref text not null,
  locale text not null default 'pt-BR',
  lens text not null default '',
  text text not null check (char_length(text) <= 6000),
  citations jsonb not null default '[]',
  created_at timestamptz not null default now(),
  primary key (user_id, version_id, ref, locale, lens)
);

-- How much of each book the student has read (one row per book; RLS applies: the function runs as the caller).
create or replace function reader_progress() returns table (book_code text, n bigint)
language sql stable security invoker set search_path = public as $$
  select b.book_code, count(*) from bible_reads b where b.user_id = auth.uid() group by b.book_code
$$;
revoke all on function reader_progress() from public, anon;
grant execute on function reader_progress() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['reader_state','bible_reads','reading_plans','verse_notes','verse_help'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_own', t);
    execute format('create policy %I on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_own', t);
    execute format('revoke truncate, references, trigger on %I from authenticated', t);
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;
