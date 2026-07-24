# BLUEPRINT FINALE — VIRYA rework F1 (fondazioni DB + contratti L1/L2 + split orchestratore)

**Documento autosufficiente**: fusione di blueprint esecutivo + revisione adversariale. Chi implementa F1 parte da qui e solo da qui.

**Verifiche a triplo passaggio** (blueprint, revisione, fusione — tutte su prod 075d1d2d e repo `~/empathy`): ACL da `pg_proc.proacl`; body RPC (`generate_training_plan` 4-arg chiama la 6-arg; la custom chiama la **9-arg**; la custom NON fa delete); policy verbatim da `pg_policies`; `phases` dei 3 piani reali (formati `days` e `weeks`); 14 `adaptation_target` da `training_adaptation_rule`; `cron.job` (solo HTTP garmin/whoop, nessun job SQL sulle funzioni toccate); history migrazioni da `supabase_migrations.schema_migrations`.

**Esito revisione** — il revisore NON ha mai torto: tutte le prove ricontrollate in fusione reggono.
- **3 BLOCCANTI accolti**: collisione versione migrazione (esiste `supabase/migrations/20260724120000_nutrition_menu_foods_seed.sql`, e la history DB è driftata: il seed risulta applicato come `20260724101037`); righe legacy wizard scoperte dalle 3 protezioni L2 (verificato: `ViryaAnnualPlanOrchestrator.tsx:1441` scrive `type:"gym"`, `:1507,1575` `discipline.toLowerCase()`, `:1644` `sportTarget.sport.toLowerCase()` — plan_id null, marker `[VIRYA:]`); nessuna supersessione tra piani (verificato su DB: atleta 8933dda9 ha GIÀ 2 piani che col default diventano 2 `approved` concorrenti).
- **6 RILIEVI accolti** (F4 status-check in EF, F5 draft leggibile dall'atleta, F6 ingresso coach_wizard, F7 conteggio 13 non 9 — riverificato su DB: fasi 4+5+4=13, settimane 12+8+0=20 —, F8 chiamante RPC ignorato — riverificato: `app/api/training/engine/generate/route.ts:248,271` chiama `generate_training_session`/`fn_apply_operational_scaling` via admin client —, F9 known-gap continuità).
- **4 NIT decisi in fusione**: F10 ACCOLTO (claim corretto: costo zero, evita QA firmato su premessa falsa); F11 ACCOLTO (flag `replace` eliminato: un ramo in meno = un bug in meno, il delete-by-range è già idempotente); F12 ACCOLTO come documentazione (l'edit Builder STACCA la riga dal piano: preservare plan_id spaccerebbe una seduta editata per output del motore); F13 ACCOLTO in F2 (gate staff sul «Genera» del wizard: congela l'accumulo di righe legacy che alimenta il bloccante F2, costo un attributo).
- **Correzione al preambolo del blueprint**: il claim «gli UNICI chiamanti RPC sono generate-training-macro.ts:51 + il file morto» era FALSO — c'è anche `engine/generate/route.ts` (vivo, path Builder tecnico/lifestyle, service-role: il revoke non lo rompe ma il QA lo deve coprire, v. T3/T7).

Contesto invariato e verificato: i due cron (`app/api/onboarding/plan/cron/route.ts`, `app/api/nutrition/weekly-replan/cron/route.ts`) usano `createSupabaseAdminClient` (service-role); il wizard client NON chiama le RPC (costruisce righe client-side e POSTa su `/api/training/planned`, orchestratore `apps/web/modules/training/components/ViryaAnnualPlanOrchestrator.tsx:1666-1710`).

---

## A. MIGRAZIONE F1 — un file: `supabase/migrations/20260724170000_virya_f1_foundations.sql`

**[FIX F1-bloccante] Filename**: `20260724170000` (NON `20260724120000`, già preso dal seed nutrition; la history DB è inoltre driftata — il seed è registrato come `20260724101037` — quindi T1 annota la versione effettiva che l'MCP registra).

Decisioni interne alla migrazione, motivate:
1. **`status` default `'approved'`**: la RPC `generate_training_plan_custom` (viva, chiamata dai cron) inserisce senza status → le righe nuove nascono `approved` e il flusso headless attuale resta identico byte-per-byte. F2 passerà lo status esplicito. Verificato dalla revisione: insert a lista colonne esplicita, colonne nuove NOT NULL con default, SECURITY DEFINER owner postgres bypassa RLS → cron D3 non cambia di un byte.
2. **Normalizzazione `phases` jsonb: NÉ in-place NÉ colonna nuova — la forma normalizzata È `training_plan_mesocycle` + backfill.** Motivi: (a) 3 righe totali in prod; (b) il writer (`generate_training_plan_custom`) è vivo e scrive ancora `[{phase,weeks}]` — una riscrittura in-place creerebbe un TERZO formato col writer attivo; (c) i lettori nuovi leggono SOLO mesocicli+settimane; (d) quando F2 splitterà la RPC, `phases` smetterà di essere scritto e si dropperà in F4. Colonna DEPRECATA via `COMMENT`. Verificato: tutti i valori `phase` reali sono nel CHECK e weeks 1-4 ≤ 16 → il backfill non aborta.
3. **[NUOVO, fix F3-bloccante] Backfill supersessione**: per ogni atleta con più piani, tutti tranne il più recente (per `created_at`) diventano `archived`. Oggi riguarda solo 8933dda9 (2 piani → 1 archived). Senza questo, il default `'approved'` creerebbe piani approvati concorrenti. NESSUN indice unique parziale su (athlete_id, status): la RPC custom viva inserisce senza archiviare i precedenti e violerebbe l'indice rompendo il cron — l'invariante «un solo piano non-archived per atleta» si enforca in `proposeTrainingMacro` (F2, sezione D).
4. **REVOKE anche da `authenticated`, niente guard in-function**: chiamanti runtime = cron (admin client) + `engine/generate` route (admin client): il revoke non toglie nulla (proacl ha grant esplicito `service_role=X/postgres` su tutte e 5). Revoke da PUBLIC, anon, authenticated; resta service_role+postgres.
5. **DROP della 6-arg legacy TRASCINA `generate_training_plan(uuid,date,date,text)`**: la 6-arg è chiamata SOLO dal body della 4-arg, che ha zero chiamanti repo (grep: nessun `rpc("generate_training_plan")` senza `_custom`). Si droppano entrambe, prima la plan poi la week. La custom chiama la 9-arg: non toccata.
6. **`athlete_races` SENZA unique** su (athlete_id, race_date): due gare lo stesso giorno sono legittime (batteria+finale). Regola motore: «gara A di riferimento = prossima `priority='A'` futura per `race_date` asc». Indice `(athlete_id, race_date)`.
7. **RLS**: forma copiata verbatim dalle policy verificate (`athlete_alerts_*`, `planned_workouts platform_admin_all`; ruoli reali `coach`/`private`; `is_platform_admin()` esiste). **[FIX F5] le select_own dell'atleta filtrano `status in ('approved','active')`: l'atleta NON vede mai il draft** (coach-costruisce/atleta-riceve è un confine di policy, non un filtro UI). Coach: SELECT+UPDATE senza filtro status (deve revisionare il draft); INSERT/DELETE restano service-role+admin. `athlete_races`: pattern `access_scoped` ALL.
8. **Policy SELECT authenticated sulle 3 tabelle config `virya_*`**: fonte unica pattern/sequenze/pesi leggibile dal browser → la copia hardcoded client (`virya-microcycle-planner.ts:28-50`) morirà in F2/F4 senza API route nuove (DB-first). Le tabelle sono già RLS-enabled deny-all: la policy le apre in sola lettura.

```sql
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

-- 6c) training_plan_mesocycle: 4 policy IDENTICHE a _week (select_own CON il filtro
--     tp.status [F5], coach_read, coach_update, admin_all), sostituendo
--     training_plan_week.plan_id con training_plan_mesocycle.plan_id.
--     Nel file di migrazione vanno scritte PER ESTESO (qui omesse per brevità).

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
```

Nota apply: via MCP `apply_migration` su 075d1d2d; le sezioni sono idempotenti tranne `add constraint`/`create policy`/`create trigger` (la migrazione gira una volta sola, come da convenzione supabase/migrations). T1 annota la versione con cui l'MCP la registra (history già driftata).

---

## B. CONTRATTO L1 — lo scheletro che il coach revisiona

Vocabolario stimoli = **`adaptation_target` reali del DB** (14, da `training_adaptation_rule`, verificati due volte — la regex `goal_l` della 9-arg produce solo valori dentro questi 14): `hypertrophy_mixed | hypertrophy_myofibrillar | hypertrophy_sarcoplasmic | lactate_clearance | lactate_tolerance | max_strength | mitochondrial_density | mobility_capacity | movement_quality | neuromuscular_adaptation | power_output | recovery | skill_transfer | vo2_max_support`. Gli 8 chip UI `WeekObjectiveKey` (virya-annual-plan-kit.ts:27-35, tutti mappabili — verificato) diventano una MAPPA di presentazione → adaptation_target (es. `aerobico→mitochondrial_density`, `lattato→lactate_tolerance`, `forza→max_strength`, `sprint_agilita→neuromuscular_adaptation`, `recupero→recovery`); il contratto persiste SOLO gli enum, mai testo libero, mai `goal_text` regex.

```ts
// apps/web/lib/training/plan/plan-skeleton-types.ts (nuovo, F1-T5)
export type PlanPhase = "base"|"build"|"refine"|"peak"|"deload"|"second_peak";
export type PlanStatus = "draft"|"approved"|"active"|"archived";
export type AdaptationTarget =
  | "hypertrophy_mixed"|"hypertrophy_myofibrillar"|"hypertrophy_sarcoplasmic"
  | "lactate_clearance"|"lactate_tolerance"|"max_strength"|"mitochondrial_density"
  | "mobility_capacity"|"movement_quality"|"neuromuscular_adaptation"
  | "power_output"|"recovery"|"skill_transfer"|"vo2_max_support";

export type WeekStimulus = {
  primary: AdaptationTarget;               // stimolo dominante della settimana
  secondary: AdaptationTarget | null;
  maintenance: AdaptationTarget[];         // richiami (max 2)
  avoid: AdaptationTarget[];               // esclusioni esplicite (es. lactate_tolerance in base)
};
export type WeekFamilyMix = { aerobicPct: number; gymPct: number };  // v1: somma 100

export type PlanSkeletonWeek = {
  id: string;                              // training_plan_week.id
  weekStart: string;                       // week_start (ISO date, lunedì)
  phase: PlanPhase;                        // phase
  weekInPhase: number;                     // week_in_phase
  mesocycleSeq: number | null;             // via mesocycle_id → training_plan_mesocycle.seq
  hoursTarget: number | null;              // hours_target
  loadTarget: number;                      // budget_tss («Carico», etichetta VIRYA_LOAD_LABEL)
  sessionsTarget: number;                  // sessions
  stimulus: WeekStimulus;                  // objectives jsonb (shape sopra, chiavi snake_case in DB)
  familyMix: WeekFamilyMix;                // family_mix jsonb {aerobic_pct, gym_pct}
  coachNotes: string | null;               // coach_notes
  // runtime, NON persistito: da routine_config.week_plan (has_training per giorno);
  // la materializzazione lo rilegge live — fonte unica, niente snapshot che diverge
  availableDays?: number[];                // offset 0..6 dal weekStart (0 = lunedì)
};

export type PlanSkeletonMesocycle = {
  id: string; seq: number; phase: PlanPhase; label: string | null;
  weeks: number; loadWeeks: number; deloadWeeks: number;          // ratio carico:scarico (3:1)
  weeklyTssTarget: number | null; sessionsTarget: number | null;
  objective: string | null; notes: string | null;
};

export type PlanSkeleton = {
  id: string;                              // training_plan.id
  athleteId: string;                       // athlete_id
  name: string | null;                     // name
  status: PlanStatus;                      // status
  approvedBy: string | null;               // approved_by
  approvedAt: string | null;               // approved_at
  discipline: string;                      // discipline
  startDate: string; endDate: string;      // start_date / end_date
  goalEventDate: string | null;            // goal_event_date (ancora del taper, da gara A)
  mesocycles: PlanSkeletonMesocycle[];     // training_plan_mesocycle (order by seq)
  weeks: PlanSkeletonWeek[];               // training_plan_week (order by week_start)
};
```

Override coach = UPDATE diretti browser→Supabase (policy `*_coach_update` di F1) su: `training_plan_week.objectives/coach_notes/hours_target/budget_tss/sessions/family_mix` e `training_plan.name/goal_event_date/status`. Nessuna API route nuova (DB-first). L'`objectives` jsonb in DB usa chiavi snake_case: `{"primary":"mitochondrial_density","secondary":null,"maintenance":[],"avoid":[]}` — il default `'{}'` significa «derivare dagli stimoli di fase alla lettura» (mappa fase→stimoli di default nel modulo TS: le 20 settimane esistenti restano valide senza backfill). Nota di coerenza [F5]: l'atleta non vede lo skeleton in `draft` per policy, non per cortesia della UI.

---

## C. CONTRATTO L1→L2 — Edge Function di materializzazione

**Edge Function Supabase `materialize-training-week`** (decisione locked 1): bundle esbuild della catena TS Builder già isolata — `derive-virya-builder-instructions.ts` + `aerobic-virya-prescription` + `materialize-virya-aerobic-from-catalog.ts` + `materialize-virya-gym-builder-session.ts` + `starter-pack-aerobic-helpers.ts` + `pro2-session-contract.ts` — stesso pattern rollout del meal-plan (`generate-meal-plan`): deploy con SUPABASE_ACCESS_TOKEN, shadow→QA su utentetest prima del flip. Granularità = UNA settimana per invocazione (≤7 sedute: nessun rischio timeout). Config letta da tabelle DB a ogni invocazione (`virya_weekday_pattern`, `virya_role_sequence`, `virya_role_weight`, `training_preset`, `virya_archetype_catalog_match`, `virya_discipline_map`) = regolabile senza deploy; la copia hardcoded client di `virya-microcycle-planner.ts:28-50` NON entra nel bundle.

**[FIX F4+F11] Input MINIMO — la EF legge tutto dal DB, lo snapshot del chiamante è abolito:**
```ts
type MaterializeWeekInput = {
  planId: string;
  weekStart: string;                        // ISO, lunedì
};
```
- **Auth**: header service-role, OPPURE JWT coach verificato in-function contro `coach_athletes` sull'`athlete_id` del piano (letto dal DB, mai dall'input).
- **Gate status IN-FUNCTION [F4]**: la EF carica `training_plan` + `training_plan_week` per (planId, weekStart) con service key e RIFIUTA (`409 plan_not_approved`) se `status ∉ {approved, active}`. La precondizione non vive solo nel wrapper TS: un coach che invoca la EF direttamente NON può materializzare un draft. Fonte unica, zero drift da snapshot stantio.
- **Dati risolti in-function** (stesse fonti per tutti i chiamanti): `week` (phase, budget_tss, sessions, hours_target, objectives→stimulus con derivazione default se `'{}'`, family_mix); `discipline` da `training_plan`; **renderProfile REALE** da `physiological_profiles`+`athlete_profiles` (ftpW, hrMax, lt1W, lt2W, lt2Hr, speedRefKmh — MAI più FTP fisso 250 nelle kcal); **availability** da `routine_config.week_plan` (has_training→days 0..6), `athlete_profiles.training_max_session_minutes` (finalmente consumato), `training1_start_time`→preferredTimes→`contract.scheduledTime`.
- **[FIX F11] Niente flag `replace`**: la EF esegue SEMPRE il passo delete (sotto) — idempotenza strutturale, non opzionale.

Slot-plan: pattern giorni intersecato con `availability.days` (se il pattern chiede più giorni di quelli disponibili, i giorni disponibili VINCONO e le sedute si riducono — mai più 6-7 sedute a chi ne ha dichiarate 3); pesi/sequenze ruolo da tabelle; `familyMix` assegna gli slot per quota (gym negli slot quality se `stimulus.primary` è strength-like, altrimenti coda). **[F11] Assert esplicito: max 1 slot per famiglia per giorno** — violazione = errore nel result per quel giorno, MAI replace silenzioso (il replace-per-type di `insertSinglePlannedWorkout` mangerebbe il primo slot senza traccia).

**Passo delete (sempre, prima dell'insert) — 2 criteri [FIX F2-bloccante]:**
1. `DELETE FROM planned_workouts WHERE plan_id = $planId AND athlete_id = $athleteId AND date BETWEEN weekStart AND weekStart+6` — le righe del piano corrente (idempotenza).
2. `DELETE` delle righe **legacy wizard** nello stesso range: `plan_id IS NULL AND notes ILIKE marker [VIRYA:]` (stessa semantica del replaceTag di `POST /api/training/planned`). Senza questo, le righe wizard (verificato: `type:"gym"`/`discipline.toLowerCase()`, plan_id null) non sono coperte da NESSUNA protezione — né delete-by-plan_id, né replace-per-type (type ≠ `pro2_builder_*`), né skip-day — e la riga L2 entrerebbe ACCANTO alla legacy = doppio conteggio nutrizione.
Le righe **coach** (plan_id null, SENZA marker) non si toccano MAI; anzi: prima di inserire uno slot, la EF salta il giorno se vi esiste già una riga builder coach (plan_id null, type `pro2_builder_*`) — altrimenti il replace per-type la mangerebbe (insert-planned-workout.ts:73-89).

**Output** = righe `planned_workouts` scritte in-function con la semantica di `insertPlannedWorkoutRows` (fingerprint+replace per type, portata nel bundle), MAI `.insert()` nudo:
- **`type` canonico STABILE per-family (DECISO): `pro2_builder_aerobic` e `pro2_builder_strength`** (v1; `pro2_builder_technical`/`pro2_builder_lifestyle` riservati v2). È la convenzione libreria/preset (`contract-to-planned-row.ts:37`); il path motore `pro2_builder_${physiologicalTarget}` (`map-engine-session-to-planned.ts:40`) NON si usa in L2 — altrimenti il replace per-type non matcha e un re-publish crea DUE righe (fingerprint mai uguale per via di `sessionInterpretation.generatedAt`, `pro2-session-interpretation.ts:59` — instabilità confermata dalla revisione: la protezione vera è il delete-by-range, il fingerprint è solo cintura).
- **`plan_id`** valorizzato (colonna F1) — identità piano senza marker `[VIRYA:]`.
- **notes** = `"[PRO2_BUILDER_PLAN]" + JSON{v:1,family,discipline,sessionName,planId,weekStart,slotSeq}` + `\n` + `BUILDER_SESSION_JSON::…` via `serializePro2BuilderSessionContract`; contratto con `source:"builder"`, `renderProfile` reale, `scheduledTime` da preferredTimes, `summary` completo — per costruzione indistinguibile da una seduta Builder in Calendario/Oggi/Nutrizione/round-trip (pipeline preset G2: `buildStarterContractFromPreset` → scale → `contractToPlannedWorkoutRow`).
- **Guard ≤32k (DECISO: comprimere-poi-fallire, MAI troncare)**: se `notes` serializzate > 30000 char → 1° tentativo: rimuovere campi opzionali non strutturali (`blocks[].notes`, `mediaUrl`, `sessionInterpretation.coachPrompts/facilitationHints`) e ri-serializzare; se ancora > 30000 → la SEDUTA fallisce con errore esplicito nel result (`{day, error:"contract_too_large"}`), le altre sedute procedono. Un contratto troncato a metà JSON (bug attuale di `contract-to-planned-row.ts:31-33`, da fixare con lo stesso guard = T6) è corruzione silenziosa. I contratti da catalogo osservati sono 2-6k char: cintura, non percorso atteso.

---

## D. SPLIT ORCHESTRATORE — `generateAndPublishTrainingMacro` → propose + materialize

Choke point unico verificato: `generateAndPublishTrainingMacro` (`apps/web/lib/training/generate-training-macro.ts:36`) ha esattamente 2 chiamanti — cron D3 (`app/api/onboarding/plan/cron/route.ts:119`) e continuità (`lib/training/ensure-training-continuity.ts:64`).

```ts
// apps/web/lib/training/propose-training-macro.ts (F2)
export async function proposeTrainingMacro(db: SupabaseClient, args: {
  athleteId: string;
  startDate: string;                       // lunedì
  source: "onboarding_d3" | "continuity" | "coach_wizard";
  goalEventDate?: string | null;           // se assente: risolto da athlete_races (prossima priority='A' futura)
  discipline?: string | null;              // se assente: default 'cycling' finché non esiste athlete_sports (F4)
}): Promise<{ planId: string; status: "draft" | "approved" }>;
```
Dentro: (1) `deriveTrainingWeekParams` RESUSCITATO (`generate-training-week-headless.ts:104-123`, oggi zero chiamanti) → `sessions` da `training_days_per_week`, budget da sessioni, `training_max_session_minutes` in provenance; (2) `goalEventDate` da `athlete_races` → `buildMacroPhases({startDate, goalEventDate})` — il ramo goal-driven (`build-macro-phases.ts:33-54`), oggi irraggiungibile perché entrambi i caller passano null, si ACCENDE; (3) scrive `training_plan` + `training_plan_mesocycle` + `training_plan_week` (objectives derivati da fase→stimoli default, family_mix 100/0) e **NON genera sedute**; (4) **doppio ramo esplicito (decisione locked 2)**:
```ts
const hasCoach = await db.from("coach_athletes").select("athlete_id").eq("athlete_id", athleteId).limit(1);
const status = hasCoach.data?.length ? "draft" : "approved";   // senza coach → auto-approve immediato
// auto-approve: approved_at=now(), approved_by=null, inputs_provenance.approval='auto_no_coach'
```
(5) **[FIX F3-bloccante] Invariante «un solo piano non-archived per atleta», enforced QUI**: `proposeTrainingMacro` archivia in apertura ogni piano `approved|active|draft` precedente dell'atleta con range sovrapposto al nuovo. **All'approvazione** (coach o auto-approve): archivia ogni ALTRO piano `approved|active` dell'atleta + `DELETE FROM planned_workouts WHERE plan_id = <piano archiviato> AND date >= <start del piano nuovo>` (il passato materializzato resta come storia, il futuro del piano vecchio sparisce). Senza questa regola due piani sovrapposti materializzano ENTRAMBI: il delete della EF è scoped al plan_id corrente, e il problema è già reale in prod (atleta 8933dda9 con 2 piani; la RPC custom NON fa delete — verificato nel body). **Destino orfani (`on delete set null`)**: la cancellazione fisica di un piano fa PRIMA il delete esplicito delle sue righe `planned_workouts` (documentato: oggi lo faceva il delete-per-tag).

```ts
// apps/web/lib/training/materialize-training-macro.ts (F2/F3)
export async function materializeTrainingMacro(db: SupabaseClient, args: {
  planId: string;
  weeks: { mode: "runway"; minFutureWeeks: 3 } | { mode: "explicit"; weekStarts: string[] } | { mode: "all" };
}): Promise<{ materialized: string[]; skipped: string[]; errors: {weekStart: string; error: string}[] }>;
```
Per ogni settimana invoca la EF `materialize-training-week` (fetch con service key dal server, o invocazione dal client coach al click «Approva» — entrambi passano dalla STESSA EF, fonte unica). Il gate `status ∈ {approved, active}` vive DENTRO la EF [F4]: il wrapper può pre-verificare per UX ma il confine è in-function. Idempotente per settimana (delete-by-plan_id+range sempre attivo, F11). Incrementale di default (`runway`): materializza solo fino a coprire 3 settimane future — pattern da `ensureTrainingContinuity` (`MIN_FUTURE_WEEKS=3`, ensure-training-continuity.ts:16).

**[FIX F6] Ingresso coach_wizard**: F1 nega INSERT al coach su `training_plan` (giusto: i draft nascono dal motore) e le API route nuove sono vietate (DB-first) → `source:"coach_wizard"` entra da una **seconda Edge Function `propose-training-plan`** (deliverable F2, stessa forma auth di materialize: JWT coach verificato su `coach_athletes`), che invoca `proposeTrainingMacro` server-side. Senza questa dichiarazione F2 o inventava una API Next (vietata) o restava monca.

**Innesti nei 2 chiamanti:**
- **Cron D3** (`onboarding/plan/cron/route.ts:115-124`): sostituire la chiamata a `generateAndPublishTrainingMacro` con `const {planId, status} = await proposeTrainingMacro(...); if (status === "approved") await materializeTrainingMacro(db, {planId, weeks:{mode:"runway",...}})`. Atleta senza coach: comportamento attuale preservato al giorno esatto (D4 in calendario). Atleta con coach: piano in draft, badge/alert al coach, calendario vuoto finché non approva.
- **Continuità** (`ensure-training-continuity.ts:37-72`): due rami nuovi — (a) se esiste piano `approved|active` con settimane scheletro non ancora materializzate e runway < 21gg → `materializeTrainingMacro(planId, runway)` (consuma il piano esistente, NON ne crea uno nuovo); (b) se il piano è esaurito (ultima settimana scheletro < oggi+21gg) → `proposeTrainingMacro(source:"continuity")` col doppio ramo. **[FIX F9] KNOWN GAP dichiarato**: in F2 la continuità resta agganciata al cron nutrizione del martedì → un atleta SENZA nutrition_plan attivo non ha continuità training per tutta F2/F3. Accettato per tenere il perimetro F2 (un solo cron Vercel su Hobby); il fan-out in `/api/cron/daily` che chiude il gap è deliverable F4 NON negoziabile, e la riga va nella doc di F2.

**Regole di convivenza (esplicite, non accidentali):**
1. **Coach-planned sopprime auto-gen: SÌ, documentato.** La runway di `ensureTrainingContinuity` (`:45-59`) conta QUALUNQUE planned_workout, incluse le sedute coach: un coach che pianifica ≥3 settimane a mano spegne la proposta automatica. Promosso da accidentale a regola di prodotto («il coach domina il motore»), con commento nel codice e riga nella doc F2.
2. **`purgeViryaPlannedWorkoutsOnDay`** (chiamata da `/api/training/planned/insert/route.ts:39-47`): il criterio si estende da marker-in-notes a **`plan_id IS NOT NULL`** — un salvataggio Builder manuale su un giorno purga le righe L2 di quel giorno (Builder domina L2 sul giorno, invariante attuale preservata). I marker `[VIRYA:]` restano nel criterio finché esistono righe legacy (F4 li pensiona; nel frattempo la EF li purga per-settimana, sezione C).
3. **L2 non tocca mai righe coach senza `plan_id`** (skip-day, sezione C); le righe legacy CON marker sono invece purgabili (F2-fix, sezione C).
4. **[F12, deciso] Round-trip Builder su riga L2 = la seduta si STACCA dal piano.** Il coach apre una seduta L2 nel Builder e risalva → l'insert route purga e reinserisce senza plan_id: la riga diventa «coach» e lo scheletro non la reclama più. È coerente con «il coach domina» e con la regola 2; preservare plan_id spaccerebbe una seduta editata a mano per output del motore. Documentato nel codice dell'insert route; si riapre solo se il QA F3 mostra confusione reale.
5. **[F13, deciso] In F2 il bottone «Genera» del wizard vecchio va dietro gate staff (`platformAdminView`)**: il wizard resta vivo fino a F3 e ogni run accumula righe legacy senza plan_id (il carburante del bloccante F2). Congelarlo costa un attributo ed è reversibile.

---

## E. PIANO TASK F1 (solo F1 — invisibile agli utenti TRANNE T4, che ripara il deep-link onboarding) [F10]

| # | Task | File target | Stima |
|---|------|-------------|-------|
| T1 | **Migrazione F1** (DDL sezione A, completa delle policy 6c per esteso) + apply via MCP `apply_migration` su 075d1d2d. **Filename `20260724170000_virya_f1_foundations.sql`** (collisione col seed nutrition su `20260724120000` evitata); annotare la versione effettiva registrata (history driftata: il seed risulta come `20260724101037`) | `supabase/migrations/20260724170000_virya_f1_foundations.sql` | M |
| T2 | **Verifica post-migrazione** [numeri corretti F7, verificati su prod]: **13 mesocicli** backfillati (4+5+4 dai 3 piani, formati `days` e `weeks`); **20/20** `training_plan_week.mesocycle_id` NOT NULL, 0 orfani; **1 piano `archived`** (il più vecchio di 8933dda9) e nessun atleta con >1 piano non-archived; `proacl` delle 5 RPC senza anon/authenticated/PUBLIC; le due funzioni legacy assenti da `pg_proc` | query MCP `execute_sql` | S |
| T3 | **QA non-regressione headless**: dry-run cron D3 (GET senza `?run=true`), poi run reale su utentetest (athlete b0082091): la riga `training_plan` nasce `status='approved'` per default e `publishDbWorkoutsToCalendar` pubblica identico; `generate_training_plan_custom` ancora eseguibile via admin client post-revoke. **[F8] + smoke `POST /api/training/engine/generate` ramo DB-engine** (chiama `generate_training_session` e `fn_apply_operational_scaling` via admin client, `route.ts:248,271` — chiamante VIVO di funzioni revocate, va provato a runtime) | `app/api/onboarding/plan/cron/route.ts`, `app/api/training/engine/generate/route.ts` (nessuna modifica: solo esecuzione) | S |
| T4 | **Fix UI Profilo→Routine** per `training_days_per_week` / `training_max_session_minutes`: i campi sono GIÀ nel form state (`profile-form-state.ts:36-37`) e GIÀ round-trippano al save (`ProfilePageView.tsx:379-380, 533-534`) — manca SOLO il render: due input numerici (giorni 1-7, minuti step 15) in testa alla sezione Routine, sotto l'anchor `#routine`, ripara il deep-link onboarding rotto (`onboarding-completeness.ts:127-132`). Unico task F1 user-visible | `apps/web/modules/profile/views/sections/ProfileRoutineSection.tsx` (+ chiavi i18n `it/en.json`) | S |
| T5 | **Tipi TS L1 + mapper**: `PlanSkeleton*` (sezione B) + `planSkeletonFromRows`/`weekObjectivesFromJson` (con derivazione default fase→stimoli per `objectives='{}'`) + mappa `WeekObjectiveKey→AdaptationTarget` | `apps/web/lib/training/plan/plan-skeleton-types.ts` + `plan-skeleton-mappers.ts` (nuovi) | S |
| T6 | **Guard 32k condiviso** (igiene pre-L2): sostituire lo slice cieco di `contract-to-planned-row.ts:31-33` con compress-or-throw (strategia sezione C), estratto in helper riusabile dalla futura EF | `apps/web/lib/training/planned/notes-size-guard.ts` (nuovo) + `apps/web/lib/training/library/contract-to-planned-row.ts` | S |
| T7 | **Smoke RLS DB-first** dal browser: coach loggato SELECT `training_plan` del proprio atleta OK + UPDATE `coach_notes` OK; atleta SELECT own approved OK / **draft INVISIBILE [F5]** / altrui vuoto; authenticated SELECT `virya_weekday_pattern` OK; anon exec RPC → errore. **[F8] + conferma che il flusso Builder tecnico/lifestyle (engine route) funziona da UI post-revoke** | sessione QA (utentetest + account coach) | S |
| T8 | **Tipi generati Supabase**: se il repo usa i tipi generati, rigenerarli (`generate_typescript_types`) per le colonne/tabelle nuove | `apps/web` (dove vivono i tipi) | S |

Ordine: T1→T2→T3 (il DB prima, la prova che nulla si è rotto subito dopo), poi T4-T6 in parallelo, T7-T8 in coda.

**Escluso da F1 (perimetro F2/F3, già specificato sopra perché è spec, non backlog)**: UI gare in Profilo; `proposeTrainingMacro`/`materializeTrainingMacro` con supersessione F3; EF `materialize-training-week` (contratto sezione C) e **EF `propose-training-plan`** [F6]; gate staff sul «Genera» del wizard [F13]; container revisione L1 prop-driven; resurrezione `deriveTrainingWeekParams`; riga known-gap continuità nella doc F2 [F9].

**Rischi residui F1**: (1) revoke su `fn_pick_preset`/`fn_pick_block_exercises` sicuro solo se nessun client le chiama direttamente — grep: zero occorrenze fuori dai body SQL e da `engine/generate` (admin client); T3/T7 lo confermano a runtime; (2) constraint `training_plan_status_check` additiva su righe che hanno già il default → nessun failure; (3) le policy nuove su tabelle già RLS-enabled-deny-all ALLARGANO l'accesso da niente a scoped (lettura scoped + update coach, draft escluso per l'atleta), nessuna scrittura anonima possibile; (4) il backfill-archive tocca 1 sola riga oggi, ma va rieseguito idealmente a ridosso dell'apply se nel frattempo il cron crea piani nuovi (la query è idempotente per costruzione: archivia sempre tutti-tranne-il-più-recente).