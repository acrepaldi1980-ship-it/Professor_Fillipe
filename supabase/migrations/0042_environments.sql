-- Immersive environments published from /admin (Prompt 3.4): the package (data) plus its GLB files in a public bucket, downloaded on demand,
-- so a new environment reaches every student without a new version of the app.
create table if not exists environments (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{2,39}$'),
  title text not null,
  data jsonb not null,
  status text not null default 'draft' check (status in ('draft','published')),
  size_bytes integer not null default 0,
  reports jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table environments enable row level security;
drop policy if exists environments_read on environments;
create policy environments_read on environments for select to anon, authenticated using (status = 'published' or is_admin());
revoke insert, update, delete, truncate, references, trigger on environments from anon, authenticated;
grant select on environments to anon, authenticated;

create or replace function api_admin_set_environment(p_id text, p_title text, p_data jsonb, p_status text, p_size int, p_reports jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  insert into environments (id, title, data, status, size_bytes, reports) values (p_id, p_title, p_data, p_status, p_size, p_reports)
  on conflict (id) do update set title = excluded.title, data = excluded.data, status = excluded.status, size_bytes = excluded.size_bytes, reports = excluded.reports, updated_at = now();
  perform audit(case when p_status = 'published' then 'environment_published' else 'environment_saved' end, p_id);
end $$;
create or replace function api_admin_delete_environment(p_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  delete from environments where id = p_id;
  perform audit('environment_deleted', p_id);
end $$;

insert into storage.buckets (id, name, public) values ('environments', 'environments', true) on conflict (id) do update set public = true;
drop policy if exists environments_files_admin on storage.objects;
create policy environments_files_admin on storage.objects for all to authenticated using (bucket_id = 'environments' and is_admin()) with check (bucket_id = 'environments' and is_admin());
