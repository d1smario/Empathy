-- Il coach legge le compensazioni (reintegro/riduzione) dei SUOI atleti.
-- Pattern identico alle policy *_access_scoped di planned/executed_workouts
-- (link via coach_athletes). Prima la tabella era select_own soltanto: la card
-- «Compensazione di oggi» era invisibile al coach in vista scoped e l'alert
-- «piano modificato» lato coach non aveva accesso ai dati.
create policy nutrition_daily_adjustment_coach_read
on public.nutrition_daily_adjustment
for select
using (
  exists (
    select 1
    from public.app_user_profiles aup
    where aup.user_id = (select auth.uid())
      and aup.role = 'coach'
      and exists (
        select 1
        from public.coach_athletes ca
        where ca.coach_user_id = (select auth.uid())
          and ca.athlete_id = nutrition_daily_adjustment.athlete_id
      )
  )
);
