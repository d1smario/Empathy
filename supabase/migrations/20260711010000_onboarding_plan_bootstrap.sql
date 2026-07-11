-- Idempotenza del trigger D3 (/api/onboarding/plan/cron): un atleta genera il piano
-- (training + nutrizione) una sola volta. Scritto solo dalla cron service-role.
-- Applicato in prod via MCP il 2026-07-11; questo file lo versiona (idempotente).
create table if not exists public.onboarding_plan_bootstrap (
  athlete_id uuid primary key references public.athlete_profiles(id) on delete cascade,
  bootstrapped_at timestamptz not null default now(),
  training_ok boolean not null default false,
  nutrition_ok boolean not null default false,
  week_start date,
  plan_start date,
  note text
);

comment on table public.onboarding_plan_bootstrap is 'Idempotenza del trigger D3: un atleta genera il piano (training+nutrizione) una sola volta. Scritto solo dalla cron service-role.';

alter table public.onboarding_plan_bootstrap enable row level security;
-- Nessuna policy utente: accesso solo via service-role (cron).
