-- Pagina Nutrizione READ-FIRST (decisione proprietario 8 ago): il piano PERSISTITO è la
-- verità; la generazione è un EVENTO (prima volta, ripianificazione settimanale, azioni
-- esplicite), non un effetto collaterale dell'apertura pagina.
--
-- 1) `response_payload`: la risposta V1-mappata COMPLETA della generazione (la stessa
--    `result.body` che la pagina renderizza: slots, solverBasis, nutrientRollup,
--    mealRotationStaples, …). Le righe magre meal/meal_item restano per i lettori
--    esistenti (Oggi, bioenergetica); la pagina Nutrizione rilegge QUESTO payload.
--    Righe vecchie (pre-migration) hanno payload NULL → la pagina genera UNA volta e
--    il persist scrive il payload: self-healing.
-- 2) Policy RLS di SELECT su nutrition_plan per l'atleta proprietario e per il suo
--    coach: prima esisteva SOLO platform_admin_all, quindi il browser dell'atleta non
--    poteva leggere il proprio piano. Stesso pattern canonico di athlete_alerts
--    (20260715230000) / nutrition_daily_adjustment (20260711030000 + 20260715220000):
--    own via app_user_profiles, coach via coach_athletes.
-- SOLO nutrition_plan, SOLO select: meal e meal_item restano chiusi (il payload basta
-- alla pagina; scritture sempre e solo service-role).

alter table public.nutrition_plan add column if not exists response_payload jsonb;

comment on column public.nutrition_plan.response_payload is
  'Risposta V1-mappata completa della generazione (result.body renderizzato dalla pagina Nutrizione). Scritta solo via service-role dai tre percorsi di generazione (Edge Function, route Next, headless/cron). NULL su piani pre-migration: la pagina degrada a UNA generazione e si auto-ripara.';

alter table public.nutrition_plan enable row level security;

-- SELECT own: stesso pattern di athlete_alerts_select_own (20260715230000).
drop policy if exists nutrition_plan_select_own on public.nutrition_plan;
create policy nutrition_plan_select_own on public.nutrition_plan
  for select using (
    athlete_id in (select athlete_id from public.app_user_profiles where user_id = auth.uid())
  );

-- SELECT coach: stesso pattern di athlete_alerts_coach_read (20260715230000),
-- link via coach_athletes.
drop policy if exists nutrition_plan_coach_read on public.nutrition_plan;
create policy nutrition_plan_coach_read on public.nutrition_plan
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
            and ca.athlete_id = nutrition_plan.athlete_id
        )
    )
  );

-- INSERT/UPDATE/DELETE: NESSUNA policy nuova → scritture solo via service-role (bypass RLS).
