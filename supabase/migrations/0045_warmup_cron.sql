-- Keeps the app's search warm: every 4 minutes, from 07h to 23h in Brasília (10h-02h UTC), the database calls /api/v1/warmup (embedding model, Neon, Supabase,
-- voice model). GitHub's schedule alone ran every few hours, so the first question after idle time took 7-9 s and could come back empty.
-- NOT applied yet: it needs the owner's approval (it makes the production database call the public site on a schedule).
create extension if not exists pg_net;
select cron.unschedule('app-warmup') where exists (select 1 from cron.job where jobname = 'app-warmup');
select cron.schedule('app-warmup', '*/4 10-23,0-1 * * *', $$select net.http_get('https://professor-filipe.vercel.app/api/v1/warmup', timeout_milliseconds := 60000)$$);
