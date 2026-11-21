-- Catalog of 3D models managed from /admin (Prompt 2.6): the owner adds models (GLB file + metadata + hotspots) without touching the code.
-- Models built in code (lib/visuals/models3d*.ts) keep working; this table holds the uploaded ones.
alter table models3d add column if not exists alt text not null default '';
alter table models3d add column if not exists note text not null default '';
alter table models3d add column if not exists theme text not null default 'Outros';
alter table models3d add column if not exists refs text[] not null default '{}';
alter table models3d add column if not exists camera jsonb not null default '[4,3,6]';
alter table models3d add column if not exists active boolean not null default true;
alter table models3d add column if not exists size_bytes integer;

alter table models3d enable row level security;
drop policy if exists models3d_read on models3d;
create policy models3d_read on models3d for select to anon, authenticated using (active);
revoke insert, update, delete, truncate, references, trigger on models3d from anon, authenticated;
grant select on models3d to anon, authenticated;

create or replace function api_admin_models()
returns setof models3d language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return query select * from models3d order by name;
end $$;

create or replace function api_admin_set_model(p_id text, p_name text, p_alt text, p_note text, p_theme text, p_refs text[], p_camera jsonb, p_hotspots jsonb, p_license text, p_sources text[], p_file_url text, p_size int, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  insert into models3d (id, name, alt, note, theme, refs, camera, hotspots, license, sources, file_url, size_bytes, active)
  values (p_id, p_name, p_alt, p_note, p_theme, p_refs, p_camera, p_hotspots, p_license, p_sources, p_file_url, p_size, p_active)
  on conflict (id) do update set name = excluded.name, alt = excluded.alt, note = excluded.note, theme = excluded.theme, refs = excluded.refs, camera = excluded.camera,
    hotspots = excluded.hotspots, license = excluded.license, sources = excluded.sources, file_url = coalesce(excluded.file_url, models3d.file_url),
    size_bytes = coalesce(excluded.size_bytes, models3d.size_bytes), active = excluded.active, updated_at = now();
  perform audit('model3d_saved', p_id);
end $$;

create or replace function api_admin_delete_model(p_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  delete from models3d where id = p_id;
  perform audit('model3d_deleted', p_id);
end $$;

-- GLB files: public read (the models are not personal data), written only by admins.
insert into storage.buckets (id, name, public) values ('models3d', 'models3d', true) on conflict (id) do update set public = true;
drop policy if exists models3d_files_admin on storage.objects;
create policy models3d_files_admin on storage.objects for all to authenticated using (bucket_id = 'models3d' and is_admin()) with check (bucket_id = 'models3d' and is_admin());
