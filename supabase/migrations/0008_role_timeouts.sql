-- Knowledge search runs as the anon/authenticated roles through restricted functions; the default 3s/8s statement
-- timeouts are too short for the first (cold) hybrid search. 15s keeps a safety net without cutting real searches.
alter role anon set statement_timeout = '15s';
alter role authenticated set statement_timeout = '15s';
notify pgrst, 'reload config';
