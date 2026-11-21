-- referral_my_code: build the code from a uuid (gen_random_bytes lives in the extensions schema and is not on the function's search_path).
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
