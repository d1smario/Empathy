-- Registro di ciò che è stato fatto in palestra, serie per serie.
--
-- Perché: la scheda arrivava all'atleta e lì finiva. Non esisteva nessuna tabella per dire
-- «questa l'ho fatta, con questo carico»: zero dei 2.814 allenamenti eseguiti era collegato a
-- una seduta con esercizi, e il peso da mettere sul bilanciere restava nullo su 1.185 delle
-- 1.189 prescrizioni salvate, perché il pianificatore non lo conosce e nessuno lo digitava.
--
-- Questa tabella chiude il cerchio in due sensi: registra l'esecuzione, e il carico che
-- l'atleta scrive diventa lo storico su cui il coach può prescrivere la volta dopo.
--
-- L'aggancio è `block_id`: l'identificatore del blocco dentro il contratto Builder salvato
-- nelle note della pianificata. È stabile e non dipende dal nome dell'esercizio, che può
-- essere tradotto o riscritto.

create table if not exists public.executed_exercise_sets (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles(id) on delete cascade,
  date date not null,
  planned_workout_id uuid references public.planned_workouts(id) on delete set null,
  /** Blocco del contratto Builder a cui la serie si riferisce. */
  block_id text not null,
  catalog_exercise_id text,
  exercise_name text not null,
  set_index smallint not null,
  reps smallint,
  weight_kg numeric(6, 2),
  /** false = serie saltata dichiarata tale (diverso da «riga assente», che è «non risposto»). */
  done boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Limiti di plausibilità: un refuso non deve entrare come dato.
  constraint executed_exercise_sets_set_index_ck check (set_index between 1 and 50),
  constraint executed_exercise_sets_reps_ck check (reps is null or (reps >= 0 and reps <= 1000)),
  constraint executed_exercise_sets_weight_ck check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 1000)),
  constraint executed_exercise_sets_name_ck check (length(btrim(exercise_name)) > 0)
);

-- Una riga per serie: risalvare la stessa serie aggiorna, non duplica.
create unique index if not exists executed_exercise_sets_unique_set
  on public.executed_exercise_sets (athlete_id, date, block_id, set_index);

create index if not exists executed_exercise_sets_athlete_date
  on public.executed_exercise_sets (athlete_id, date desc);

create index if not exists executed_exercise_sets_planned
  on public.executed_exercise_sets (planned_workout_id)
  where planned_workout_id is not null;

alter table public.executed_exercise_sets enable row level security;

-- Stesso perimetro di `executed_workouts`: l'atleta sui propri dati, il coach solo sugli
-- atleti che gli sono legati da una riga, l'amministratore su tutto.
drop policy if exists executed_exercise_sets_access_scoped on public.executed_exercise_sets;
create policy executed_exercise_sets_access_scoped
  on public.executed_exercise_sets
  as permissive for all
  to authenticated
  using (
    exists (
      select 1 from public.app_user_profiles aup
      where aup.user_id = (select auth.uid())
        and (
          (aup.role = 'private' and aup.athlete_id = executed_exercise_sets.athlete_id)
          or (aup.role = 'coach' and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = (select auth.uid())
              and ca.athlete_id = executed_exercise_sets.athlete_id
          ))
        )
    )
  )
  with check (
    exists (
      select 1 from public.app_user_profiles aup
      where aup.user_id = (select auth.uid())
        and (
          (aup.role = 'private' and aup.athlete_id = executed_exercise_sets.athlete_id)
          or (aup.role = 'coach' and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = (select auth.uid())
              and ca.athlete_id = executed_exercise_sets.athlete_id
          ))
        )
    )
  );

drop policy if exists platform_admin_all on public.executed_exercise_sets;
create policy platform_admin_all
  on public.executed_exercise_sets
  as permissive for all
  using (is_platform_admin())
  with check (is_platform_admin());

-- Solo `authenticated`: `anon` non ha niente da fare qui. (Su executed_workouts il grant ad
-- anon esiste per ragioni storiche; non lo replichiamo.)
grant select, insert, update, delete on public.executed_exercise_sets to authenticated;

-- I default dello schema concedono tutto ad `anon` su ogni tabella nuova: qui non serve.
-- La RLS lo fermerebbe comunque (senza auth.uid() nessuna policy passa), ma il permesso in
-- meno è una difesa in più che non costa niente.
revoke all on public.executed_exercise_sets from anon;

-- ── Chi ha registrato la serie ──────────────────────────────────────────────────────────
-- Il carico scritto qui diventa lo storico su cui il coach prescriverà la volta dopo: se a
-- scriverlo è il coach stesso, il cerchio si chiude su sé stesso e chi legge non se ne accorge.
-- Con questa colonna resta scritto se quel numero l'ha messo chi ha sollevato o chi guardava.
--
-- Il ruolo NON è dichiarato liberamente dal client: la policy lo confronta con quello che il
-- richiedente è davvero. Un coach non può scrivere «athlete».
alter table public.executed_exercise_sets
  add column if not exists recorded_by_user_id uuid,
  add column if not exists recorded_by_role text not null default 'athlete';

alter table public.executed_exercise_sets
  drop constraint if exists executed_exercise_sets_recorded_by_role_ck;
alter table public.executed_exercise_sets
  add constraint executed_exercise_sets_recorded_by_role_ck
  check (recorded_by_role in ('athlete', 'coach', 'admin'));

drop policy if exists executed_exercise_sets_access_scoped on public.executed_exercise_sets;
create policy executed_exercise_sets_access_scoped
  on public.executed_exercise_sets
  as permissive for all
  to authenticated
  using (
    exists (
      select 1 from public.app_user_profiles aup
      where aup.user_id = (select auth.uid())
        and (
          (aup.role = 'private' and aup.athlete_id = executed_exercise_sets.athlete_id)
          or (aup.role = 'coach' and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = (select auth.uid())
              and ca.athlete_id = executed_exercise_sets.athlete_id
          ))
        )
    )
  )
  with check (
    recorded_by_user_id = (select auth.uid())
    and exists (
      select 1 from public.app_user_profiles aup
      where aup.user_id = (select auth.uid())
        and (
          (
            aup.role = 'private'
            and aup.athlete_id = executed_exercise_sets.athlete_id
            and executed_exercise_sets.recorded_by_role = 'athlete'
          )
          or (
            aup.role = 'coach'
            and executed_exercise_sets.recorded_by_role = 'coach'
            and exists (
              select 1 from public.coach_athletes ca
              where ca.coach_user_id = (select auth.uid())
                and ca.athlete_id = executed_exercise_sets.athlete_id
            )
          )
        )
    )
  );

drop policy if exists platform_admin_all on public.executed_exercise_sets;
create policy platform_admin_all
  on public.executed_exercise_sets
  as permissive for all
  using (is_platform_admin())
  with check (is_platform_admin() and recorded_by_role = 'admin');
