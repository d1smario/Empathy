-- Inizio finestra piano (acquisto/attivazione). Fallback deterministico: created_at.
-- Sorgente della finestra onboarding dei cron M2 (mail) e M3 (generazione), al posto del
-- proxy created_at. Va scritto all'attivazione (webhook Stripe / flusso /access/plan).
-- Applicato in prod via MCP il 2026-07-11 (idempotente).
alter table public.athlete_profiles add column if not exists plan_started_at timestamptz;

comment on column public.athlete_profiles.plan_started_at is 'Inizio finestra piano (acquisto/attivazione). Fallback: created_at. Sorgente della finestra onboarding dei cron M2/M3.';
