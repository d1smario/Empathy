-- Log idempotente delle mail giornaliere di onboarding (una per atleta + giorno).
-- Scritto solo dalla cron service-role (/api/onboarding/email/cron). Applicato in prod
-- via MCP il 2026-07-11; questo file lo versiona (idempotente).
create table if not exists public.onboarding_email_log (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles(id) on delete cascade,
  day_index smallint not null,
  status text not null default 'sent',
  message_id text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (athlete_id, day_index)
);

comment on table public.onboarding_email_log is 'Log idempotente delle mail giornaliere di onboarding (una per atleta+giorno). Scritto solo dalla cron service-role.';

alter table public.onboarding_email_log enable row level security;
-- Nessuna policy utente: accesso solo via service-role (cron). RLS attivo blocca il resto.
