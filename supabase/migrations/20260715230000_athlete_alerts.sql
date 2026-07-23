-- Alert event-driven per atleta: «gli alert sono di quando arrivano, non di quando guardi l'app».
-- Scritti SOLO dal server (service-role) nei punti evento (ingest sonno device, executed workout
-- da sync, compensazioni nutrizione, fallback cron sonno mancante). Idempotenti per
-- (athlete_id, date, kind): il payload si aggiorna, created_at resta quello del primo evento.
create table if not exists public.athlete_alerts (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null,
  kind text not null check (kind in ('sleep_low', 'training_over', 'training_under', 'plan_adjusted', 'sleep_missing')),
  date date not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz null,
  unique (athlete_id, date, kind)
);

comment on table public.athlete_alerts is 'Alert event-driven per atleta (sonno basso/mancante, allenamento sopra/sotto pianificato, piano nutrizione modificato). Insert/update payload solo via service-role nei punti evento; client (atleta/coach) leggono e marcano read_at.';

create index if not exists idx_athlete_alerts_athlete_created
  on public.athlete_alerts (athlete_id, created_at desc);

alter table public.athlete_alerts enable row level security;

-- SELECT own: stesso pattern di nutrition_daily_adjustment_select_own (20260711030000).
drop policy if exists athlete_alerts_select_own on public.athlete_alerts;
create policy athlete_alerts_select_own on public.athlete_alerts
  for select using (
    athlete_id in (select athlete_id from public.app_user_profiles where user_id = auth.uid())
  );

-- SELECT coach: stesso pattern di nutrition_daily_adjustment_coach_read (20260715220000),
-- link via coach_athletes.
drop policy if exists athlete_alerts_coach_read on public.athlete_alerts;
create policy athlete_alerts_coach_read on public.athlete_alerts
  for select using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = (select auth.uid())
        and aup.role = 'coach'
        and exists (
          select 1
          from public.coach_athletes ca
          where ca.coach_user_id = (select auth.uid())
            and ca.athlete_id = athlete_alerts.athlete_id
        )
    )
  );

-- UPDATE own e coach: la riga deve restare dell'atleta / di un atleta del coach (with check).
-- La restrizione «SOLO read_at» è a livello di colonna (grant sotto): RLS filtra le righe,
-- il grant colonna impedisce di toccare payload/kind/date dagli utenti autenticati.
drop policy if exists athlete_alerts_update_own on public.athlete_alerts;
create policy athlete_alerts_update_own on public.athlete_alerts
  for update using (
    athlete_id in (select athlete_id from public.app_user_profiles where user_id = auth.uid())
  ) with check (
    athlete_id in (select athlete_id from public.app_user_profiles where user_id = auth.uid())
  );

drop policy if exists athlete_alerts_update_coach on public.athlete_alerts;
create policy athlete_alerts_update_coach on public.athlete_alerts
  for update using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = (select auth.uid())
        and aup.role = 'coach'
        and exists (
          select 1
          from public.coach_athletes ca
          where ca.coach_user_id = (select auth.uid())
            and ca.athlete_id = athlete_alerts.athlete_id
        )
    )
  ) with check (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = (select auth.uid())
        and aup.role = 'coach'
        and exists (
          select 1
          from public.coach_athletes ca
          where ca.coach_user_id = (select auth.uid())
            and ca.athlete_id = athlete_alerts.athlete_id
        )
    )
  );

-- UPDATE consentito SOLO su read_at per i ruoli client (grant a livello colonna).
revoke update on public.athlete_alerts from anon, authenticated;
grant update (read_at) on public.athlete_alerts to authenticated;

-- INSERT/DELETE: NESSUNA policy → possibili solo via service-role (bypass RLS).
