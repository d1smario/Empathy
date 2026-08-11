-- Traccia durevole degli eventi di piattaforma (`empathy_events`).
--
-- PERCHÉ QUESTO FILE: la tabella ESISTE GIÀ in produzione (ggmpegwnzbrjkeiydwqu) ma non
-- compare in nessuna migration del repo — quindi un ambiente ricreato da zero non l'avrebbe,
-- e la traccia del cron settimanale (`nutrition.weekly_replan.run` /
-- `nutrition.weekly_replan.athlete`) cadrebbe silenziosamente (la scrittura è best-effort).
-- Tutto qui è IF NOT EXISTS: su produzione è un no-op, serve solo alla parità degli ambienti.
--
-- Motivazione della traccia: la ritenzione dei log runtime Vercel su questo progetto è di
-- circa UN'ORA. Un cron notturno che fallisce non lascia niente di consultabile la mattina.
-- Una riga qui sopravvive e si legge con:
--   select created_at, payload from empathy_events
--    where event_type like 'nutrition.weekly_replan%' order by created_at desc limit 50;

-- `gen_random_uuid()` e non `uuid_generate_v4()` come in produzione: sono equivalenti nel
-- risultato, ma il primo è in pgcrypto/core e non richiede l'estensione uuid-ossp — che
-- nessuna migration di questo repo abilita. Siccome il file serve proprio all'ambiente
-- ricreato da zero, non deve dipendere da un'estensione che nessuno accende. Su produzione
-- il create è un no-op, quindi il default esistente resta quello che c'è già.
create table if not exists public.empathy_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  athlete_id uuid references public.athlete_profiles(id) on delete set null,
  payload jsonb,
  created_at timestamptz default now()
);

-- L'interrogazione tipica è «gli ultimi eventi di questo tipo»: senza indice diventa
-- un seq scan man mano che la tabella cresce.
create index if not exists empathy_events_type_created_idx
  on public.empathy_events (event_type, created_at desc);

alter table public.empathy_events enable row level security;

-- Le scritture del cron passano dal client service-role, che bypassa la RLS.
-- Lettura: platform admin su tutto, atleta/coach solo sulle righe del proprio atleta.
--
-- ATTENZIONE per chi aggiungerà eventi: la seconda policy apre in lettura all'atleta (e al
-- suo coach) TUTTE le righe con `athlete_id` valorizzato, payload compreso. Le tracce del
-- cron portano messaggi d'errore grezzi di motore e DB, quindi `lib/observability/
-- empathy-event-trace.ts` scrive di proposito `athlete_id = null` e mette l'atleta dentro il
-- payload: così restano solo-admin. Valorizzare quella colonna = renderle visibili all'atleta.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'empathy_events' and policyname = 'platform_admin_all') then
    create policy platform_admin_all on public.empathy_events
      for all using (is_platform_admin()) with check (is_platform_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'empathy_events' and policyname = 'empathy_events_select_scoped') then
    create policy empathy_events_select_scoped on public.empathy_events
      for select using (
        athlete_id is not null
        and exists (
          select 1 from public.app_user_profiles aup
          where aup.user_id = (select auth.uid())
            and (
              (aup.role = 'private' and aup.athlete_id = empathy_events.athlete_id)
              or (aup.role = 'coach' and exists (
                    select 1 from public.coach_athletes ca
                    where ca.coach_user_id = (select auth.uid()) and ca.athlete_id = empathy_events.athlete_id))
            )
        )
      );
  end if;
end $$;
