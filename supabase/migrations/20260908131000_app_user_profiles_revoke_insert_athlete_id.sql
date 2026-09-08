-- TEMPO 2 di 2 — chiude la via diretta anche su INSERT.
--
-- ⚠️ NON APPLICARE PRIMA DEL DEPLOY del commit che toglie `athlete_id: null` dal payload
-- del seed in apps/web/lib/auth/bootstrap-app-user-profile.ts. Con il codice vecchio in
-- produzione questa migrazione rompe OGNI nuova registrazione: il seed elenca la colonna,
-- e senza il grant l'insert fallisce con 42501. Verificato in transazione abortita:
--   seed col payload NUOVO (senza athlete_id) -> OK
--   seed col payload VECCHIO (con athlete_id) -> BLOCCATO 42501
--
-- Chi resta scoperto fino ad allora: solo un utente autenticato che NON abbia ancora una
-- riga profilo (in produzione erano 2 account) può inserirsela con l'athlete_id di un
-- altro. Chi la riga ce l'ha già è fermato dal tempo 1.

revoke insert on public.app_user_profiles from anon, authenticated;

grant insert (user_id, role, platform_coach_status, preferred_locale, preferred_units, first_name, last_name)
  on public.app_user_profiles to anon, authenticated;
