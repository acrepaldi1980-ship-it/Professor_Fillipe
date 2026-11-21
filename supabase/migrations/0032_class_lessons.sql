-- The teacher's own list of published lessons for a class (a teacher is not a class member, so api_lessons_for_me does not show them).
create or replace function api_class_lessons(p_class uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_class_teacher(p_class) then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'ref', l.ref, 'date', l.lesson_date, 'notes', l.notes) order by l.lesson_date desc) from church_lessons l where l.class_id = p_class), '[]'::jsonb);
end $$;
revoke execute on function api_class_lessons(uuid) from public, anon;
grant execute on function api_class_lessons(uuid) to authenticated;
