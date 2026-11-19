-- Prompt 1.4: own Pentecostal notes (spec 8.11): review workflow, reviewer comments, originality report and publication to search.

alter table own_notes add column if not exists originality_report jsonb;
alter table own_notes add column if not exists model text;
alter table own_notes add column if not exists rewrite_count int not null default 0;
create unique index if not exists own_notes_unique on own_notes (tradition, kind, coalesce(book_code, ''), coalesce(ref_range, ''), title);

create table if not exists own_note_comments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references own_notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
alter table own_note_comments enable row level security;
drop policy if exists own_note_comments_read on own_note_comments;
create policy own_note_comments_read on own_note_comments for select to authenticated using (is_reviewer());
drop policy if exists own_note_comments_insert on own_note_comments;
create policy own_note_comments_insert on own_note_comments for insert to authenticated with check (is_reviewer() and user_id = (select auth.uid()));

-- Admins create and delete notes (the generator runs with the admin's token); reviewers only update (policy from 0005).
drop policy if exists own_notes_insert on own_notes;
create policy own_notes_insert on own_notes for insert to authenticated with check (is_admin());
drop policy if exists own_notes_delete on own_notes;
create policy own_notes_delete on own_notes for delete to authenticated using (is_admin() and status <> 'published');

-- Legal status moves. Reviewers: draft -> in_review -> approved (or back to draft). Only admins publish and unpublish.
create or replace function own_notes_guard() returns trigger language plpgsql as $$
declare r text := app_role();
begin
  if auth.uid() is null then return new; end if; -- server / database owner
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft'     and new.status = 'in_review') or
      (old.status = 'in_review' and new.status in ('approved', 'draft')) or
      (old.status = 'approved'  and new.status in ('in_review', 'published') ) or
      (old.status = 'published' and new.status = 'draft')
    ) then raise exception 'illegal_status_move'; end if;
    if new.status in ('published') or old.status = 'published' then
      if r <> 'admin' then raise exception 'only_admin_publishes'; end if;
    end if;
    if new.status = 'approved' then new.reviewer_id := auth.uid(); end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists own_notes_guard_trg on own_notes;
create trigger own_notes_guard_trg before update on own_notes for each row execute function own_notes_guard();

-- Published notes enter the search as tradition 'pentecostal', kind 'own_notes' (layer 3 under the Pentecostal lens).
create or replace function api_publish_note(p_note uuid, p_embedding vector(384))
returns void language plpgsql security definer set search_path = public as $$
declare n own_notes%rowtype;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into n from own_notes where id = p_note;
  if not found or n.status <> 'published' then raise exception 'note_not_published'; end if;
  insert into works (id, title, authors, language, kind, tradition, license, credit_text, pub_year, enabled, review_status)
  values ('own_notes_pentecostal', 'Notas de Estudo Pentecostais (conteúdo próprio do app)', array['Professor Filipe (equipe do app)'], 'pt', 'own_notes', 'pentecostal', 'licensed',
          'Conteúdo original do app, revisado pelo conselho teológico', extract(year from now())::int, true, 'approved')
  on conflict (id) do update set enabled = true, review_status = 'approved';
  insert into chunks (id, work_id, text, language, title_path, refs, tradition, kind, license, tokens, embedding)
  values ('own_notes_pentecostal:' || n.id, 'own_notes_pentecostal', n.body, 'pt', n.title, coalesce(public.note_refs(n.ref_range), '{}'), 'pentecostal', 'own_notes', 'licensed',
          greatest(1, char_length(n.body) / 4), p_embedding)
  on conflict (id) do update set text = excluded.text, title_path = excluded.title_path, refs = excluded.refs, tokens = excluded.tokens, embedding = excluded.embedding, updated_at = now();
end $$;

create or replace function api_unpublish_note(p_note uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  delete from chunks where id = 'own_notes_pentecostal:' || p_note;
end $$;

-- ref_range is stored as canonical refs separated by commas (e.g. "ACT.2.1,ACT.2.2"); an empty range gives no refs.
create or replace function note_refs(p text) returns text[] language sql immutable as $$
  select case when p is null or p = '' then '{}'::text[] else string_to_array(p, ',') end
$$;

revoke all on function api_publish_note(uuid, vector) from public;
revoke all on function api_unpublish_note(uuid) from public;
grant execute on function api_publish_note(uuid, vector) to authenticated;
grant execute on function api_unpublish_note(uuid) to authenticated;
