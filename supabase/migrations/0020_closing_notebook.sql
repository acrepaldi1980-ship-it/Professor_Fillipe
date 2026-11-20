-- Prompt 1.10: session closing (summary text, cards), notebook search and personal notes.
alter table session_closings add column if not exists summary text;
alter table session_closings add column if not exists topics text[] not null default '{}';
alter table notebook_items add column if not exists session_id uuid references sessions(id) on delete set null;
create index if not exists notebook_items_session on notebook_items (session_id);
create index if not exists review_cards_due on review_cards (user_id, due_at);
create unique index if not exists review_cards_unique on review_cards (user_id, session_id, question);
