-- Entry lookup by title (dictionaries): "Zacchaeus" must find the entry titled Zacchaeus at once, in every shard, without scanning the table.
-- title_key = last part of title_path, up to the first comma, lower case ("Smith's Bible Dictionary (1884) > Zacchaeus" -> "zacchaeus").
alter table chunks add column if not exists title_key text generated always as (lower(trim(split_part(regexp_replace(coalesce(title_path, ''), '^.* > ', ''), ',', 1)))) stored;
create index if not exists chunks_title_key on chunks (title_key) where kind in ('dictionary', 'encyclopedia');
create or replace function library_titles(p_titles text[], p_limit int default 24)
returns table (id text, work_id text, text text, title_path text, refs text[], tradition text, kind text, language text, tokens int, rrf double precision, signals text[])
language sql stable as $$
  select c.id, c.work_id, c.text, c.title_path, c.refs, c.tradition, c.kind, c.language, c.tokens, 0.033::double precision, array['title']::text[]
  from chunks c
  join library_works w on w.id = c.work_id and w.enabled
  where c.kind in ('dictionary', 'encyclopedia') and c.title_key = any (select lower(t) from unnest(p_titles[1:40]) t)
  order by c.title_path, c.id
  limit least(greatest(p_limit, 1), 40)
$$;
