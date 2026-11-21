-- Admins must see hidden (inactive) models too, so they can edit or re-activate them without uploading the file again.
drop policy if exists models3d_read on models3d;
create policy models3d_read on models3d for select to anon, authenticated using (active or is_admin());
