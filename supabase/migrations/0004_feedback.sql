-- Prototype feedback (Prompt 0.2): one rating and an optional comment at the end of a conversation.
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  session_ref text
);
-- Server-only table: no policy for anon/authenticated; the API route writes with the service role.
alter table feedback enable row level security;
