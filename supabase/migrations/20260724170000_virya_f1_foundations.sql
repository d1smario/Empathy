-- =============================================================================
-- VIRYA rework F1 — fondazioni: scheletro L1 approvabile, gare, sicurezza RPC
-- Invisibile agli utenti (tranne T4, che ripara il deep-link onboarding).
-- =============================================================================

-- 0) Trigger updated_at (nessuna convenzione esiste in public: creata qui;
--    verificato: niente moddatetime, nessuna set_updated_at preesistente)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- 1) training_plan: stato, approvazione, identità, gara obiettivo
alter table public.training_plan
  add column if not exists status text not null default 'approved',
  add column if not exists approved_by uuid,             -- auth user id; niente FK dura su auth.users
  add column if not exists approved_at timestamptz,
  add column if not exists name text,
  add column if not exists goal_event_date date,
  add column if not exists updated_at timestamptz not null default now();

alter table public.training_plan
  add constraint training_plan_status_check
  check (status in ('draft','approved','active','archived'));

-- 1b) [F3] Supersessione retroattiva: un solo piano non-archived per atleta.
--     Oggi: 8933dda9 ha 2 piani -> il più vecchio diventa archived.
update public.training_plan tp
   set status = 'archived'
 where exists (select 1 from public.training_plan tp2
               where tp2.athlete_id = tp.athlete_id
                 and tp2.id <> tp.id
                 and tp2.created_at > tp.created_at);

comment on column public.training_plan.phases is
  'DEPRECATO (F1 VIRYA): fonte normalizzata = training_plan_mesocycle. Due formati storici: db_plan_v1 [{days,phase,sessions,weeklyTss,startOffset}], db_plan_custom_v1 [{phase,weeks}]. Non aggiungere lettori.';

create trigger trg_training_plan_updated_at
  before update on public.training_plan
  for each row execute function public.set_updated_at();

-- 2) training_plan_mesocycle (nuova): la forma normalizzata di phases
create table public.training_plan_mesocycle (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null references public.training_plan(id) on delete cascade,
  seq               int  not null,                                  -- ordinale nel piano (1-based)
  phase             text not null check (phase in ('base','build','refine','peak','deload','second_peak')),
  label             text,                                           -- es. 'Mesociclo 2 · Costruzione'
  weeks             int  not null check (weeks between 1 and 16),
  load_weeks        int  not null default 3 check (load_weeks between 1 and 6),    -- ratio carico:scarico
  deload_weeks      int  not null default 1 check (deload_weeks between 0 and 2),  -- (es. 3:1)
  weekly_tss_target int,                                            -- seed budget; null = default fase
  sessions_target   int,
  objective         text,                                           -- macroObjective del PhasePlan
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (plan_id, seq)
);
create index training_plan_mesocycle_plan on public.training_plan_mesocycle (plan_id, seq);
create trigger trg_training_plan_mesocycle_updated_at
  before update on public.training_plan_mesocycle
  for each row execute function public.set_updated_at();

-- Backfill dei 3 piani esistenti, normalizzando ENTRAMBI i formati phases
-- Atteso (verificato su prod): 13 mesocicli (4+5+4), NON 9.
insert into public.training_plan_mesocycle (plan_id, seq, phase, weeks, weekly_tss_target, sessions_target)
select tp.id,
       ph.ord::int,
       ph.elem->>'phase',
       coalesce((ph.elem->>'weeks')::int,
                greatest(1, round((ph.elem->>'days')::numeric / 7))::int),
       (ph.elem->>'weeklyTss')::int,
       (ph.elem->>'sessions')::int
from public.training_plan tp,
     lateral jsonb_array_elements(tp.phases) with ordinality ph(elem, ord)
where jsonb_typeof(tp.phases) = 'array' and jsonb_array_length(tp.phases) > 0;

-- 3) training_plan_week: campi di revisione coach
alter table public.training_plan_week
  add column if not exists objectives   jsonb not null default '{}'::jsonb,  -- shape: contratto L1 (stimoli espliciti)
  add column if not exists coach_notes  text,
  add column if not exists hours_target numeric(5,1),
  add column if not exists family_mix   jsonb not null default '{"aerobic_pct":100,"gym_pct":0}'::jsonb,
  add column if not exists mesocycle_id uuid references public.training_plan_mesocycle(id) on delete set null,
  add column if not exists updated_at   timestamptz not null default now();  -- audit revisione

create trigger trg_training_plan_week_updated_at
  before update on public.training_plan_week
  for each row execute function public.set_updated_at();

-- Backfill mesocycle_id: aggancia le settimane esistenti al mesociclo per posizione
-- Atteso (verificato su prod): 20/20 settimane agganciate (12+8; il 3° piano ha 0 settimane).
with ranked_weeks as (
  select w.id, w.plan_id, w.phase,
         row_number() over (partition by w.plan_id order by w.week_start) as wpos
  from public.training_plan_week w
), meso_ranges as (
  select m.id as meso_id, m.plan_id, m.phase, m.seq,
         1 + coalesce(sum(m2.weeks) filter (where m2.seq < m.seq), 0) as w_from,
         coalesce(sum(m2.weeks) filter (where m2.seq < m.seq), 0) + m.weeks as w_to
  from public.training_plan_mesocycle m
  left join public.training_plan_mesocycle m2 on m2.plan_id = m.plan_id
  group by m.id, m.plan_id, m.phase, m.seq, m.weeks
)
update public.training_plan_week w
   set mesocycle_id = mr.meso_id
  from ranked_weeks rw
  join meso_ranges mr on mr.plan_id = rw.plan_id and rw.wpos between mr.w_from and mr.w_to
 where w.id = rw.id and w.mesocycle_id is null;

-- 4) athlete_races (nuova) — campi da RacePlan + GoalTargets (virya-annual-plan-kit.ts:129-144)
create table public.athlete_races (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.athlete_profiles(id) on delete cascade,
  name        text not null,
  race_date   date not null,
  priority    text not null default 'B' check (priority in ('A','B','C')),
  race_type   text not null default 'goal' check (race_type in ('warmup','test','goal','milestone')),
  sport       text,                               -- etichetta sport/disciplina (es. 'Ciclismo')
  target      jsonb not null default '{}'::jsonb, -- GoalTargets: {distanceKm,durationMin,speedAvgKmh,powerAvgW,elevationM,workKj}
  target_note text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- NESSUNA unique (athlete_id, race_date): due gare lo stesso giorno sono legittime.
-- Regola motore: gara A di riferimento = prossima priority='A' futura per race_date asc.
create index athlete_races_athlete_date on public.athlete_races (athlete_id, race_date);
create trigger trg_athlete_races_updated_at
  before update on public.athlete_races
  for each row execute function public.set_updated_at();

-- 5) planned_workouts: identità piano (pensiona i marker [VIRYA:]/[EMPATHY_DB_ENGINE] nelle notes)
alter table public.planned_workouts
  add column if not exists plan_id uuid references public.training_plan(id) on delete set null;
create index if not exists idx_planned_workouts_plan
  on public.planned_workouts (plan_id) where plan_id is not null;
-- oggi esiste solo idx su (athlete_id): questo copre dedupe/purge/range per giorno
create index if not exists idx_planned_workouts_athlete_date
  on public.planned_workouts (athlete_id, date);

-- 6) RLS — forma verbatim da athlete_alerts_* / planned_workouts (pg_policies verificate)
alter table public.training_plan            enable row level security;
alter table public.training_plan_week       enable row level security;
alter table public.training_plan_mesocycle  enable row level security;
alter table public.athlete_races            enable row level security;

-- 6a) training_plan: atleta SELECT own SOLO approved/active [F5]; coach SELECT+UPDATE; admin ALL
create policy training_plan_select_own on public.training_plan
  for select using (
    status in ('approved','active')            -- [F5] l'atleta non vede MAI il draft
    and athlete_id in (select app_user_profiles.athlete_id
                       from public.app_user_profiles
                       where app_user_profiles.user_id = auth.uid())
  );
create policy training_plan_coach_read on public.training_plan
  for select using (
    exists (select 1 from public.app_user_profiles aup
            where aup.user_id = (select auth.uid()) and aup.role = 'coach'
              and exists (select 1 from public.coach_athletes ca
                          where ca.coach_user_id = (select auth.uid())
                            and ca.athlete_id = training_plan.athlete_id))
  );
create policy training_plan_coach_update on public.training_plan
  for update using (
    exists (select 1 from public.app_user_profiles aup
            where aup.user_id = (select auth.uid()) and aup.role = 'coach'
              and exists (select 1 from public.coach_athletes ca
                          where ca.coach_user_id = (select auth.uid())
                            and ca.athlete_id = training_plan.athlete_id))
  ) with check (
    exists (select 1 from public.app_user_profiles aup
            where aup.user_id = (select auth.uid()) and aup.role = 'coach'
              and exists (select 1 from public.coach_athletes ca
                          where ca.coach_user_id = (select auth.uid())
                            and ca.athlete_id = training_plan.athlete_id))
  );
create policy training_plan_admin_all on public.training_plan
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- 6b) training_plan_week: stesso schema, qual via EXISTS sul piano padre;
--     la select_own eredita il filtro status DENTRO l'EXISTS [F5]
create policy training_plan_week_select_own on public.training_plan_week
  for select using (
    exists (select 1 from public.training_plan tp
            where tp.id = training_plan_week.plan_id
              and tp.status in ('approved','active')   -- [F5]
              and tp.athlete_id in (select app_user_profiles.athlete_id
                                    from public.app_user_profiles
                                    where app_user_profiles.user_id = auth.uid()))
  );
create policy training_plan_week_coach_read on public.training_plan_week
  for select using (
    exists (select 1 from public.training_plan tp
            join public.coach_athletes ca on ca.athlete_id = tp.athlete_id
            join public.app_user_profiles aup on aup.user_id = (select auth.uid()) and aup.role = 'coach'
            where tp.id = training_plan_week.plan_id
              and ca.coach_user_id = (select auth.uid()))
  );
create policy training_plan_week_coach_update on public.training_plan_week
  for update using (
    exists (select 1 from public.training_plan tp
            join public.coach_athletes ca on ca.athlete_id = tp.athlete_id
            join public.app_user_profiles aup on aup.user_id = (select auth.uid()) and aup.role = 'coach'
            where tp.id = training_plan_week.plan_id
              and ca.coach_user_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.training_plan tp
            join public.coach_athletes ca on ca.athlete_id = tp.athlete_id
            join public.app_user_profiles aup on aup.user_id = (select auth.uid()) and aup.role = 'coach'
            where tp.id = training_plan_week.plan_id
              and ca.coach_user_id = (select auth.uid()))
  );
create policy training_plan_week_admin_all on public.training_plan_week
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- 6c) training_plan_mesocycle: 4 policy identiche a _week (select_own CON il filtro
--     tp.status [F5], coach_read, coach_update, admin_all)
create policy training_plan_mesocycle_select_own on public.training_plan_mesocycle
  for select using (
    exists (select 1 from public.training_plan tp
            where tp.id = training_plan_mesocycle.plan_id
              and tp.status in ('approved','active')   -- [F5]
              and tp.athlete_id in (select app_user_profiles.athlete_id
                                    from public.app_user_profiles
                                    where app_user_profiles.user_id = auth.uid()))
  );
create policy training_plan_mesocycle_coach_read on public.training_plan_mesocycle
  for select using (
    exists (select 1 from public.training_plan tp
            join public.coach_athletes ca on ca.athlete_id = tp.athlete_id
            join public.app_user_profiles aup on aup.user_id = (select auth.uid()) and aup.role = 'coach'
            where tp.id = training_plan_mesocycle.plan_id
              and ca.coach_user_id = (select auth.uid()))
  );
create policy training_plan_mesocycle_coach_update on public.training_plan_mesocycle
  for update using (
    exists (select 1 from public.training_plan tp
            join public.coach_athletes ca on ca.athlete_id = tp.athlete_id
            join public.app_user_profiles aup on aup.user_id = (select auth.uid()) and aup.role = 'coach'
            where tp.id = training_plan_mesocycle.plan_id
              and ca.coach_user_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.training_plan tp
            join public.coach_athletes ca on ca.athlete_id = tp.athlete_id
            join public.app_user_profiles aup on aup.user_id = (select auth.uid()) and aup.role = 'coach'
            where tp.id = training_plan_mesocycle.plan_id
              and ca.coach_user_id = (select auth.uid()))
  );
create policy training_plan_mesocycle_admin_all on public.training_plan_mesocycle
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- 6d) athlete_races: pattern access_scoped di planned_workouts (ALL: atleta own + coach) + admin
create policy athlete_races_access_scoped on public.athlete_races
  for all to authenticated using (
    exists (select 1 from public.app_user_profiles aup
            where aup.user_id = (select auth.uid())
              and ((aup.role = 'private' and aup.athlete_id = athlete_races.athlete_id)
                or (aup.role = 'coach' and exists (
                      select 1 from public.coach_athletes ca
                      where ca.coach_user_id = (select auth.uid())
                        and ca.athlete_id = athlete_races.athlete_id))))
  ) with check (
    exists (select 1 from public.app_user_profiles aup
            where aup.user_id = (select auth.uid())
              and ((aup.role = 'private' and aup.athlete_id = athlete_races.athlete_id)
                or (aup.role = 'coach' and exists (
                      select 1 from public.coach_athletes ca
                      where ca.coach_user_id = (select auth.uid())
                        and ca.athlete_id = athlete_races.athlete_id))))
  );
create policy athlete_races_admin_all on public.athlete_races
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- 6e) Config Virya leggibile dal client (fonte unica DB-first: uccide la copia
--     hardcoded in virya-microcycle-planner.ts:28-50 senza API route nuove)
create policy virya_weekday_pattern_read on public.virya_weekday_pattern
  for select to authenticated using (true);
create policy virya_role_sequence_read on public.virya_role_sequence
  for select to authenticated using (true);
create policy virya_role_weight_read on public.virya_role_weight
  for select to authenticated using (true);

-- 7) Sicurezza RPC: EXECUTE solo a service_role (proacl verificate: oggi PUBLIC+anon+authenticated;
--    grant esplicito service_role=X/postgres presente su tutte -> cron e engine-route intatti)
revoke execute on function public.generate_training_plan_custom(uuid,date,jsonb,text,text,text[],text) from public, anon, authenticated;
revoke execute on function public.generate_training_week(uuid,date,text,integer,numeric,text,text,text[],text) from public, anon, authenticated;
revoke execute on function public.generate_training_session(uuid,date,text,text,integer,text,integer,integer,text[],text) from public, anon, authenticated;
revoke execute on function public.fn_pick_preset(text,text,integer) from public, anon, authenticated;
revoke execute on function public.fn_pick_block_exercises(text,text,text,text,text[],text,integer) from public, anon, authenticated;

-- 8) DROP legacy. La 6-arg è chiamata SOLO dal body di generate_training_plan(uuid,date,date,text),
--    che ha zero chiamanti repo. La custom viva usa la 9-arg (verificato nel body).
drop function if exists public.generate_training_plan(uuid,date,date,text);
drop function if exists public.generate_training_week(uuid,date,text,integer,numeric,text);
