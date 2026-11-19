-- A reviewer's account can be deleted (LGPD) without losing the note: the reviewer link is just cleared.
alter table own_notes drop constraint if exists own_notes_reviewer_id_fkey;
alter table own_notes add constraint own_notes_reviewer_id_fkey foreign key (reviewer_id) references auth.users(id) on delete set null;
