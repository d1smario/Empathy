-- Audit lato admin (2026-06-28). Applicato in prod via MCP.
-- Le tabelle del pipeline di ingest Garmin portano segreti vendor (user_access_token OAuth
-- live, payload webhook grezzi + token_fingerprints, puntatori storage + estratti FIT) ma la
-- migration 078 (platform_admin_all su ogni tabella RLS) le aveva rese leggibili dall'admin
-- via browser → un platform-admin poteva raccogliere i token OAuth Garmin di tutti gli atleti
-- dalla propria sessione. Le riportiamo nel confine service-role (RLS on + zero policy), come
-- garmin_athlete_links / vendor_oauth_links / stripe_webhook_events (denylist canonica).
-- Reader nel codice = tutti service-role (garmin-pull-runner, push handler, follow-up queue,
-- script); i rollup admin usano una RPC server-side. Nessun path browser/UI → zero regressione.

drop policy if exists platform_admin_all on public.garmin_pull_jobs;
drop policy if exists platform_admin_all on public.garmin_push_receipts;
drop policy if exists platform_admin_all on public.garmin_pull_binary_objects;
