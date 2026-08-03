-- Il platform admin non vedeva NESSUN alert: su `athlete_alerts` esistono solo
-- select_own / coach_read / update_own / update_coach (20260715230000). Per un admin
-- (role='private', is_platform_admin=true, ZERO righe in coach_athletes) entrambe le
-- policy di SELECT sono false → 0 righe. Effetto pratico: la strip alert già montata in
-- scope atleta (`/admin/utenti/[userId]/today` → TodayAlertsStrip) restituiva sempre
-- lista vuota e si auto-nascondeva, in silenzio e senza errore.
--
-- Qui si aggiunge il taglio «l'admin vede tutto» con la stessa forma canonica delle altre
-- tabelle (training_plan_admin_all, athlete_races_admin_all, questionnaire_answers_admin_all):
-- `public.is_platform_admin()` (STABLE SECURITY DEFINER, legge app_user_profiles).
--
-- PERCHÉ **NON** `for all` (a differenza delle tabelle citate): la 20260715230000 chiude
-- dichiarando l'invariante «INSERT/DELETE: NESSUNA policy → possibili solo via service-role».
-- Gli alert hanno un SINGLE OWNER di scrittura (lib/alerts/athlete-alerts-writers.ts, che gira
-- server-side nei punti evento e riconcilia le kind): un `for all` aprirebbe insert/delete dal
-- browser e permetterebbe di fabbricare o cancellare alert scavalcando il riconcilio. Quindi
-- due policy separate e nient'altro.
--
-- PERCHÉ anche UPDATE e non solo SELECT: senza di essa l'admin vedrebbe gli alert ma il
-- pulsante «segna letto» (update di read_at, usato sia da TodayAlertsStrip sia dalla nuova
-- lista /admin/alert) fallirebbe con errore visibile — una lista di alert non archiviabile
-- resta rumore permanente. Il rischio è nullo: il grant di colonna della 20260715230000
-- (`revoke update … ; grant update (read_at) to authenticated`) limita comunque la scrittura
-- alla sola colonna read_at, quindi payload/kind/date restano intoccabili dal client.

drop policy if exists athlete_alerts_admin_read on public.athlete_alerts;
create policy athlete_alerts_admin_read on public.athlete_alerts
  for select using (public.is_platform_admin());

drop policy if exists athlete_alerts_admin_update on public.athlete_alerts;
create policy athlete_alerts_admin_update on public.athlete_alerts
  for update using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Stesso identico buco su `nutrition_daily_adjustment` (20260711030000 + 20260715220000):
-- select_own + coach_read, nessuna policy admin. In scope atleta la card «Compensazione di
-- oggi» è quindi invisibile all'admin, e l'alert `plan_adjusted` rimanderebbe a un dettaglio
-- vuoto. Solo SELECT: le compensazioni le scrive il loop adattivo lato server, il client admin
-- deve leggerle, non modificarle.
drop policy if exists nutrition_daily_adjustment_admin_read on public.nutrition_daily_adjustment;
create policy nutrition_daily_adjustment_admin_read on public.nutrition_daily_adjustment
  for select using (public.is_platform_admin());
