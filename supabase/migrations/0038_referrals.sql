-- Referral (Prompt 2.7): whoever refers a friend earns days of Premium; the friend earns days too. The reward is granted only after the friend
-- actually studies (at least 2 different days), and a student can earn at most 8 rewards, so a code on its own gets nobody anything.
alter table entitlements drop constraint if exists entitlements_source_check;
alter table entitlements add constraint entitlements_source_check check (source in ('asaas','apple','google','church','admin','referral'));

create table if not exists referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null,
  status text not null default 'pending' check (status in ('pending','rewarded','capped')),
  created_at timestamptz not null default now(),
  rewarded_at timestamptz
);
create index if not exists referrals_referrer on referrals (referrer_id, status);
alter table referral_codes enable row level security;
alter table referrals enable row level security;
drop policy if exists referral_codes_own on referral_codes;
create policy referral_codes_own on referral_codes for select to authenticated using (user_id = auth.uid());
drop policy if exists referrals_parties on referrals;
create policy referrals_parties on referrals for select to authenticated using (referrer_id = auth.uid() or referred_id = auth.uid());
revoke all on referral_codes, referrals from anon;
revoke insert, update, delete, truncate, references, trigger on referral_codes, referrals from authenticated;

-- The student's own code (created on first use).
create or replace function referral_my_code() returns text language plpgsql security definer set search_path = public as $$
declare c text; n int := 0;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  select code into c from referral_codes where user_id = auth.uid();
  if c is not null then return c; end if;
  loop
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7));
    begin
      insert into referral_codes (user_id, code) values (auth.uid(), c);
      return c;
    exception when unique_violation then
      n := n + 1; if n > 8 then raise; end if;
      select code into c from referral_codes where user_id = auth.uid();
      if c is not null then return c; end if;
    end;
  end loop;
end $$;

-- A new student arrives through a code. Only recent accounts, never one's own code, only once.
create or replace function referral_claim(p_code text) returns text language plpgsql security definer set search_path = public as $$
declare r uuid; created timestamptz;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  select user_id into r from referral_codes where code = upper(trim(p_code));
  if r is null then return 'invalid'; end if;
  if r = auth.uid() then return 'own_code'; end if;
  if exists (select 1 from referrals where referred_id = auth.uid()) then return 'already_referred'; end if;
  select created_at into created from auth.users where id = auth.uid();
  if created < now() - interval '14 days' then return 'too_late'; end if;
  insert into referrals (referrer_id, referred_id, code) values (r, auth.uid(), upper(trim(p_code)));
  return 'ok';
end $$;

-- Called by the referred student: when they have studied on 2 different days, both receive 7 days of Premium (the referrer up to 8 times).
create or replace function referral_settle() returns jsonb language plpgsql security definer set search_path = public as $$
declare r referrals; n int; rewarded int;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  select * into r from referrals where referred_id = auth.uid() and status = 'pending';
  if not found then return jsonb_build_object('settled', false); end if;
  select count(*) into n from study_days();
  if n < 2 then return jsonb_build_object('settled', false, 'days_needed', 2 - n); end if;
  select count(*) into rewarded from referrals where referrer_id = r.referrer_id and status = 'rewarded';
  if rewarded >= 8 then
    update referrals set status = 'capped' where id = r.id;
    -- the friend still gets their days
    insert into entitlements (user_id, entitlement, source, source_ref, expires_at) values (auth.uid(), 'plan:premium', 'referral', 'ref:' || r.id::text, now() + interval '7 days');
    return jsonb_build_object('settled', true, 'friend_days', 7, 'referrer_days', 0);
  end if;
  update referrals set status = 'rewarded', rewarded_at = now() where id = r.id;
  insert into entitlements (user_id, entitlement, source, source_ref, expires_at) values
    (r.referrer_id, 'plan:premium', 'referral', 'ref:' || r.id::text, now() + interval '7 days'),
    (auth.uid(), 'plan:premium', 'referral', 'ref:' || r.id::text, now() + interval '7 days');
  return jsonb_build_object('settled', true, 'friend_days', 7, 'referrer_days', 7);
end $$;

create or replace function referral_status() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', (select code from referral_codes where user_id = auth.uid()),
    'pending', (select count(*) from referrals where referrer_id = auth.uid() and status = 'pending'),
    'rewarded', (select count(*) from referrals where referrer_id = auth.uid() and status = 'rewarded'),
    'days_earned', 7 * (select count(*) from referrals where referrer_id = auth.uid() and status = 'rewarded'),
    'max_rewards', 8,
    'referred_by_pending', exists (select 1 from referrals where referred_id = auth.uid() and status = 'pending')
  );
$$;
do $$ declare f text; begin
  foreach f in array array['referral_my_code()','referral_claim(text)','referral_settle()','referral_status()'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
