-- Prompt 1.8: guided modes (lesson, sermon, deepen). The session keeps the mode setup (age group, minutes, text, sermon type...).
alter table sessions add column if not exists context jsonb not null default '{}';

-- D-06 (20/11/2026): the "explicativo" sermon explains a concept or doctrine.
insert into sermon_types (name, definition, "order") values
  ('Explicativo', 'Parte de uma pergunta ou doutrina ("O que é a graça?"). As divisões respondem em ordem: o que é, de onde vem na Bíblia, o que muda na vida; cada divisão se apoia em textos de vários lugares.', 4)
on conflict (name) do update set definition = excluded.definition, "order" = excluded."order";

create unique index if not exists lesson_plans_session on lesson_plans (session_id) where session_id is not null;
create unique index if not exists sermon_outlines_session on sermon_outlines (session_id) where session_id is not null;

-- Sermon types are public reference data.
drop policy if exists sermon_types_read on sermon_types;
create policy sermon_types_read on sermon_types for select to anon, authenticated using (enabled);
