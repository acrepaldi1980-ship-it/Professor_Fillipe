-- Shared cache of the teacher's checked answers (free performance work). Holds no personal data: the key is a hash, the student's name is a placeholder.
create table if not exists answer_cache (
  key text primary key,
  response jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists answer_cache_created on answer_cache (created_at);
