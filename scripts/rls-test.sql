-- Proves Row Level Security: user A cannot see or change user B's data. Runs in one transaction and rolls back.
do $t$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  sess_b uuid := gen_random_uuid();
  msg_b uuid := gen_random_uuid();
  n int;
  r jsonb := '[]'::jsonb;
  role_after text;
begin
  insert into auth.users (id, aud, role, email) values (a, 'authenticated', 'authenticated', 'rls-a@example.test'), (b, 'authenticated', 'authenticated', 'rls-b@example.test');
  insert into profiles (user_id, display_name) values (a, 'A'), (b, 'B');
  insert into sessions (id, user_id, mode) values (sess_b, b, 'free');
  insert into messages (id, session_id, role, text) values (msg_b, sess_b, 'user', 'segredo de B');
  insert into review_cards (user_id, question, answer) values (b, 'q', 'a');
  insert into entitlements (user_id, entitlement, source) values (b, 'premium', 'admin');
  insert into payment_events (provider, event_type, payload, idempotency_key) values ('asaas', 't', '{}', gen_random_uuid()::text);
  insert into audit_logs (actor_id, action) values (b, 'x');

  -- act as user A
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;

  select count(*) into n from profiles;                                  r := r || jsonb_build_object('name','A sees only own profile','pass', n = 1);
  select count(*) into n from profiles where user_id = b;                r := r || jsonb_build_object('name','A cannot read B profile','pass', n = 0);
  select count(*) into n from sessions where user_id = b;                r := r || jsonb_build_object('name','A cannot read B sessions','pass', n = 0);
  select count(*) into n from messages where id = msg_b;                 r := r || jsonb_build_object('name','A cannot read B messages','pass', n = 0);
  select count(*) into n from review_cards where user_id = b;            r := r || jsonb_build_object('name','A cannot read B review cards','pass', n = 0);
  select count(*) into n from entitlements where user_id = b;            r := r || jsonb_build_object('name','A cannot read B entitlements','pass', n = 0);
  select count(*) into n from payment_events;                            r := r || jsonb_build_object('name','A cannot read payment events','pass', n = 0);
  select count(*) into n from audit_logs;                                r := r || jsonb_build_object('name','A cannot read audit logs','pass', n = 0);
  select count(*) into n from chunks;                                    r := r || jsonb_build_object('name','A cannot read raw knowledge chunks','pass', n = 0);
  select count(*) into n from plans;                                     r := r || jsonb_build_object('name','A can read plans (public catalog)','pass', n > 0);

  begin
    insert into sessions (user_id, mode) values (b, 'free');
    r := r || jsonb_build_object('name','A cannot create a session as B','pass', false);
  exception when others then
    r := r || jsonb_build_object('name','A cannot create a session as B','pass', true);
  end;

  update sessions set title = 'hack' where id = sess_b;
  get diagnostics n = row_count;                                         r := r || jsonb_build_object('name','A cannot edit B session','pass', n = 0);

  update profiles set role = 'admin' where user_id = a;
  select role into role_after from profiles where user_id = a;           r := r || jsonb_build_object('name','A cannot promote self to admin','pass', role_after = 'student');

  -- anonymous visitor
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  select count(*) into n from profiles;                                  r := r || jsonb_build_object('name','anon cannot read profiles','pass', n = 0);
  select count(*) into n from chunks;                                    r := r || jsonb_build_object('name','anon cannot read chunks','pass', n = 0);
  select count(*) into n from app_config;                                r := r || jsonb_build_object('name','anon can read app_config','pass', n > 0);
  reset role;

  raise exception 'RLS_RESULT:%', r::text;
end
$t$;
