-- TEMPO 1 di 2 — chiude la via diretta su UPDATE.  [APPLICATA in prod l'8 set 2026]
--
-- `anon` e `authenticated` avevano INSERT e UPDATE su tutte e 11 le colonne di
-- app_user_profiles. Poiché 101 policy RLS su 54 tabelle usano
-- `app_user_profiles.athlete_id` come identità dell'atleta, e il browser legge quelle
-- tabelle DIRETTAMENTE via PostgREST (architettura DB-first), riscriversi quel campo
-- dava accesso ai dati di un altro atleta senza passare da nessun gate applicativo.
-- Riprodotto in transazione abortita: `update app_user_profiles set athlete_id = <altro>`
-- scriveva 1 riga, e la lettura di quell'atleta passava da 0 a 1 riga.
--
-- Perché SOLO UPDATE, e non anche INSERT: il seed del bootstrap in produzione elenca
-- ancora `athlete_id: null` nel payload, e revocare l'INSERT prima che il codice nuovo
-- sia deployato romperebbe OGNI nuova registrazione (provato: 42501). La revoca
-- dell'INSERT sta nella migrazione gemella ...131000, da applicare DOPO il deploy.
--
-- Nessuna scrittura lato client si rompe: tutti gli usi di app_user_profiles nei
-- componenti sono `select`, ogni scrittura passa da una rotta server col client
-- service_role (esente dai grant di anon/authenticated).

revoke update on public.app_user_profiles from anon, authenticated;

grant update (role, platform_coach_status, preferred_locale, preferred_units, first_name, last_name)
  on public.app_user_profiles to anon, authenticated;

comment on column public.app_user_profiles.athlete_id is
  'Collegamento identità → atleta. NON scrivibile da anon/authenticated: è la chiave di '
  'autorizzazione letta da 101 policy RLS. La scrive solo il bootstrap con service_role.';
