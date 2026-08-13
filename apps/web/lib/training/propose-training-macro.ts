import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMacroPhases, macroTotalWeeks, type MacroPhase } from "@/lib/training/build-macro-phases";
import { deriveTrainingWeekParams } from "@/lib/training/generate-training-week-headless";
import { loadCalendarTrainingVolume } from "@/lib/training/load-calendar-training-volume";
import { PHASE_DEFAULT_STIMULUS } from "@/lib/training/plan/plan-skeleton-mappers";
import type { PlanPhase } from "@/lib/training/plan/plan-skeleton-types";

/**
 * SPLIT proponi/materializza — metà «proponi» (VIRYA rework F2, blueprint sezione D).
 *
 * `proposeTrainingMacro` scrive SOLO lo scheletro L1 (`training_plan` +
 * `training_plan_mesocycle` + `training_plan_week`) e NON genera sedute: la
 * materializzazione è un passo separato (`materializeTrainingMacro`) così il
 * doppio ramo coach/no-coach può fermarsi al draft senza toccare il calendario.
 *
 * DOPPIO RAMO (decisione locked 2):
 * - atleta SENZA coach (nessuna riga `coach_athletes`) → status 'approved' con
 *   auto-approve (`approved_at=now`, `approved_by=null`,
 *   `inputs_provenance.approval='auto_no_coach'`): il flusso headless di oggi.
 * - atleta CON coach → status 'draft' e STOP: il coach revisiona e approva
 *   (POST /api/training/plan/approve), solo allora si materializza.
 *
 * GARA A: se il chiamante non passa `goalEventDate`, la si risolve da
 * `athlete_races` — prossima gara `priority='A'` futura per `race_date` asc
 * (regola del blueprint A.6; nessuna unique su (athlete_id, race_date): due gare
 * lo stesso giorno sono legittime). Con la gara, `buildMacroPhases` accende
 * FINALMENTE il ramo goal-driven (refine+peak sulla gara), finora irraggiungibile
 * perché entrambi i chiamanti passavano null.
 */

/* ── date helpers (UTC, condivisi col materializzatore) ── */

function isoUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Aggiunge `days` a una data ISO (YYYY-MM-DD) in UTC — stessa aritmetica di ensure-training-continuity. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoUTC(d);
}

/**
 * UUID applicativo generato client-side: evita il round-trip `.insert().select()`
 * per recuperare gli id di mesocicli/settimane (servono per gli agganci
 * `mesocycle_id` prima ancora dell'insert). Fallback v4 per ambienti senza WebCrypto.
 */
function genUuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    const v = ch === "x" ? r : (r % 4) + 8;
    return v.toString(16);
  });
}

/* ── scelta gara A (pura, testabile) ── */

export type AthleteRaceRow = {
  id?: string | null;
  name?: string | null;
  race_date?: string | null;
  priority?: string | null;
};

export type GoalRacePick = { name: string | null; raceDate: string };

/**
 * Gara A di riferimento = prossima `priority='A'` con `race_date` FUTURA
 * (>= fromIso, la gara del giorno stesso è ancora un obiettivo valido) per
 * `race_date` ascendente. B/C ignorate: sono tappe, non l'ancora del taper.
 */
export function pickGoalRace(races: readonly AthleteRaceRow[], fromIso: string): GoalRacePick | null {
  const candidates = (Array.isArray(races) ? races : [])
    .filter((r) => (r?.priority ?? "") === "A")
    .map((r) => ({
      name: typeof r.name === "string" && r.name.trim() ? r.name.trim() : null,
      raceDate: typeof r.race_date === "string" ? r.race_date.slice(0, 10) : "",
    }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.raceDate) && r.raceDate >= fromIso.slice(0, 10))
    .sort((a, b) => a.raceDate.localeCompare(b.raceDate));
  return candidates[0] ?? null;
}

/* ── espansione fasi → seed settimane (pura, testabile) ── */

export type PlanWeekSeed = {
  weekStart: string;
  phase: PlanPhase;
  weekInPhase: number;
  /** 1-based: indice della fase nel macro = seq del mesociclo padre. */
  mesocycleSeq: number;
  budgetTss: number;
  sessions: number;
  hoursTarget: number | null;
};

/**
 * Fattori di fase sul budget settimanale: SEED che il coach rifinisce in revisione,
 * non una periodizzazione «vera» — servono solo a non proporre uno scarico a pieno
 * carico o un taper identico a una settimana build.
 */
const PHASE_BUDGET_FACTOR: Record<PlanPhase, number> = {
  base: 1,
  build: 1,
  refine: 0.9,
  peak: 0.7,
  deload: 0.6,
  second_peak: 0.7,
};

export function buildPlanWeekSeeds(
  phases: readonly MacroPhase[],
  startDate: string,
  base: { weeklyTss: number; sessions: number; hoursTarget: number | null },
): PlanWeekSeed[] {
  const seeds: PlanWeekSeed[] = [];
  let weekIndex = 0;
  phases.forEach((ph, phaseIndex) => {
    const weeks = Math.max(1, Math.round(ph.weeks));
    const factor = PHASE_BUDGET_FACTOR[ph.phase] ?? 1;
    for (let w = 0; w < weeks; w += 1) {
      seeds.push({
        weekStart: addDaysIso(startDate, weekIndex * 7),
        phase: ph.phase,
        weekInPhase: w + 1,
        mesocycleSeq: phaseIndex + 1,
        budgetTss: Math.max(0, Math.round(base.weeklyTss * factor)),
        sessions: base.sessions,
        hoursTarget:
          base.hoursTarget != null ? Math.round(base.hoursTarget * factor * 10) / 10 : null,
      });
      weekIndex += 1;
    }
  });
  return seeds;
}

/* ── supersessione (invariante «un solo piano non-archived per atleta») ── */

/**
 * Archivia i piani non-archived dell'atleta (tranne `keepPlanId`) e cancella le
 * loro righe `planned_workouts` FUTURE (`date >= fromDateIso`): il passato
 * materializzato resta come storia, il futuro del piano vecchio sparisce.
 *
 * L'invariante vive QUI e non come indice unique parziale in DB: la RPC
 * `generate_training_plan_custom` (viva, chiamata dal vecchio flusso) inserisce
 * senza archiviare i precedenti e violerebbe l'indice rompendo il cron
 * (blueprint A.3). Riusata sia da `proposeTrainingMacro` (in apertura) sia
 * dall'endpoint di approvazione (cintura anti-concorrenza).
 */
export async function archiveSupersededPlans(
  db: SupabaseClient,
  athleteId: string,
  opts: { keepPlanId?: string | null; fromDateIso: string },
): Promise<{ ok: true; archivedPlanIds: string[] } | { ok: false; error: string }> {
  let query = db.from("training_plan").select("id").eq("athlete_id", athleteId).neq("status", "archived");
  if (opts.keepPlanId) query = query.neq("id", opts.keepPlanId);
  const { data, error } = await query;
  if (error) return { ok: false, error: `supersessione (lettura piani): ${error.message}` };

  const ids = ((data ?? []) as Array<Record<string, unknown>>)
    .map((r) => String(r.id ?? ""))
    .filter(Boolean);
  if (ids.length === 0) return { ok: true, archivedPlanIds: [] };

  const { error: archiveErr } = await db.from("training_plan").update({ status: "archived" }).in("id", ids);
  if (archiveErr) return { ok: false, error: `supersessione (archive): ${archiveErr.message}` };

  // Il delete esplicito PRIMA che i piani diventino orfani logici: la FK di
  // planned_workouts.plan_id è `on delete set null`, quindi nessuno lo farebbe per noi.
  const { error: purgeErr } = await db
    .from("planned_workouts")
    .delete()
    .eq("athlete_id", athleteId)
    .in("plan_id", ids)
    .gte("date", opts.fromDateIso);
  if (purgeErr) return { ok: false, error: `supersessione (purge futuro): ${purgeErr.message}` };

  return { ok: true, archivedPlanIds: ids };
}

/* ── proposta ── */

export type ProposeSource = "onboarding_d3" | "continuity" | "coach_wizard";

export type ProposeTrainingMacroArgs = {
  athleteId: string;
  /** Lunedì di partenza del piano, YYYY-MM-DD. */
  startDate: string;
  source: ProposeSource;
  /**
   * Gara obiettivo: `undefined` = risolvi da athlete_races (gara A futura);
   * `null` = esplicitamente senza gara (open-ended).
   */
  goalEventDate?: string | null;
  /** Se assente: default 'cycling' finché non esiste athlete_sports (F4). */
  discipline?: string | null;
  /**
   * Giorno «oggi» per osservare il calendario del coach (FONTE 3 del volume).
   * Iniettabile solo per i test; in produzione si usa la data corrente UTC.
   */
  todayIso?: string;
};

export type ProposeTrainingMacroResult =
  | {
      ok: true;
      planId: string;
      status: "draft" | "approved";
      goalEventDate: string | null;
      weekCount: number;
      archivedPlanIds: string[];
    }
  | { ok: false; error: string };

export async function proposeTrainingMacro(
  db: SupabaseClient,
  args: ProposeTrainingMacroArgs,
): Promise<ProposeTrainingMacroResult> {
  const athleteId = args.athleteId.trim();
  const startDate = args.startDate.trim().slice(0, 10);
  if (!athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false, error: "proposeTrainingMacro: athleteId o startDate non validi" };
  }

  // 1) Profilo routine → parametri settimana (deriveTrainingWeekParams resuscitata:
  //    sessions da week_plan/training_days_per_week, ore da training_max_session_minutes).
  //    …più la FONTE 3, il calendario già scritto dal coach.
  //
  //    ANCORA = OGGI, non `startDate`. Sembra controintuitivo — si sta dimensionando la
  //    settimana che parte da `startDate` — ma questi parametri sono il seed dell'INTERO
  //    macrociclo (8-24 settimane, vedi buildPlanWeekSeeds sotto), quindi la domanda non è
  //    «cosa c'è in quella settimana» ma «che volume programma davvero il coach di questo
  //    atleta». E la risposta vive nel presente programmato, non in una settimana futura
  //    che per definizione non è ancora stata scritta: nel ramo CONTINUITÀ
  //    (`ensure-training-continuity.ts`) `startDate` è il lunedì DOPO l'ultima seduta
  //    pianificata, quindi la finestra ancorata lì sarebbe vuota per costruzione e la
  //    fonte 3 sarebbe nata morta proprio dove il calendario è più ricco.
  //    Ancorata a oggi invece la copre tutta, e si può dimostrare: la continuità propone
  //    solo quando la runway è più corta di MIN_FUTURE_WEEKS = 3 settimane, quindi ogni
  //    seduta pianificata cade dentro le 4 settimane osservate da oggi.
  //    Effetto collaterale utile: il gate di onboarding osserva la stessa finestra
  //    ancorata a oggi, quindi «sono pronto» e «quanto è grande il mio piano» rispondono
  //    alla stessa domanda invece di divergere.
  const { data: profile, error: profileErr } = await db
    .from("athlete_profiles")
    .select("training_days_per_week, training_max_session_minutes, goals, routine_config")
    .eq("id", athleteId)
    .maybeSingle();
  if (profileErr) return { ok: false, error: `lettura profilo: ${profileErr.message}` };
  const todayIso = args.todayIso?.trim().slice(0, 10) || isoUTC(new Date());
  const calendar = await loadCalendarTrainingVolume(db, athleteId, todayIso);
  const derived = deriveTrainingWeekParams(
    (profile ?? null) as Parameters<typeof deriveTrainingWeekParams>[0],
    startDate,
    { discipline: args.discipline?.trim() || undefined, calendar },
  );

  // 2) Gara A → ancora del taper. La query resta larga (tutte le gare dell'atleta,
  //    sono poche) e la REGOLA è nella funzione pura pickGoalRace: testabile e
  //    indipendente da come il DB ordina.
  let goalRace: GoalRacePick | null = null;
  if (args.goalEventDate === undefined) {
    const { data: raceRows, error: raceErr } = await db
      .from("athlete_races")
      .select("name, race_date, priority")
      .eq("athlete_id", athleteId);
    if (raceErr) return { ok: false, error: `lettura gare: ${raceErr.message}` };
    goalRace = pickGoalRace((raceRows ?? []) as AthleteRaceRow[], startDate);
  } else if (args.goalEventDate) {
    goalRace = { name: null, raceDate: args.goalEventDate.slice(0, 10) };
  }
  const goalEventDate = goalRace?.raceDate ?? null;

  // 3) Doppio ramo: la presenza del coach decide lo stato di nascita del piano.
  const { data: coachRows, error: coachErr } = await db
    .from("coach_athletes")
    .select("athlete_id")
    .eq("athlete_id", athleteId)
    .limit(1);
  if (coachErr) return { ok: false, error: `lettura coach: ${coachErr.message}` };
  const hasCoach = (coachRows ?? []).length > 0;
  const status: "draft" | "approved" = hasCoach ? "draft" : "approved";

  // 4) Supersessione PRIMA dell'insert (invariante un-solo-piano-non-archived).
  //    Se un passo successivo fallisce l'atleta resta temporaneamente senza piano
  //    attivo: accettato, il prossimo giro di cron ri-propone (idempotente).
  const superseded = await archiveSupersededPlans(db, athleteId, { fromDateIso: startDate });
  if (!superseded.ok) return superseded;

  // 5) Scheletro: fasi (goal-driven se c'è la gara) → mesocicli → settimane.
  const phases = buildMacroPhases({ startDate, goalEventDate });
  const totalWeeks = macroTotalWeeks(phases);
  const endDate = addDaysIso(startDate, totalWeeks * 7 - 1);
  const weekSeeds = buildPlanWeekSeeds(phases, startDate, {
    weeklyTss: derived.weeklyTss,
    sessions: derived.sessions,
    hoursTarget: derived.hoursTarget,
  });

  const planId = genUuid();
  const nowIso = new Date().toISOString();
  const { error: planErr } = await db.from("training_plan").insert({
    id: planId,
    athlete_id: athleteId,
    discipline: derived.discipline,
    start_date: startDate,
    end_date: endDate,
    status,
    name: goalRace?.name ? `Preparazione ${goalRace.name}` : `Blocco allenamento dal ${startDate}`,
    goal_event_date: goalEventDate,
    // Auto-approve solo senza coach: approved_by=null distingue l'automatismo
    // da un'approvazione umana (che scrive l'auth user id del coach).
    approved_at: status === "approved" ? nowIso : null,
    approved_by: null,
    algorithm_version: "db_plan_skeleton_v1",
    inputs_provenance: {
      source: args.source,
      approval: status === "approved" ? "auto_no_coach" : "pending_coach",
      derived: {
        sessions: derived.sessions,
        weekly_tss: derived.weeklyTss,
        hours_target: derived.hoursTarget,
        training_days_per_week: (profile as { training_days_per_week?: number | null } | null)?.training_days_per_week ?? null,
        training_max_session_minutes:
          (profile as { training_max_session_minutes?: number | null } | null)?.training_max_session_minutes ?? null,
      },
    },
  });
  if (planErr) return { ok: false, error: `insert training_plan: ${planErr.message}` };

  // Cleanup su fallimento parziale: il piano cascade-cancella mesocicli e settimane.
  const rollback = async (step: string, message: string): Promise<ProposeTrainingMacroResult> => {
    await db.from("training_plan").delete().eq("id", planId);
    return { ok: false, error: `${step}: ${message}` };
  };

  const mesocycleIdBySeq = new Map<number, string>();
  const mesocycleRows = phases.map((ph, index) => {
    const id = genUuid();
    mesocycleIdBySeq.set(index + 1, id);
    const stimulus = PHASE_DEFAULT_STIMULUS[ph.phase];
    return {
      id,
      plan_id: planId,
      seq: index + 1,
      phase: ph.phase,
      weeks: Math.max(1, Math.round(ph.weeks)),
      weekly_tss_target: Math.max(0, Math.round(derived.weeklyTss * (PHASE_BUDGET_FACTOR[ph.phase] ?? 1))),
      sessions_target: derived.sessions,
      // macroObjective = stimolo primario di fase: SOLO enum AdaptationTarget, mai testo libero.
      objective: stimulus.primary,
    };
  });
  const { error: mesoErr } = await db.from("training_plan_mesocycle").insert(mesocycleRows);
  if (mesoErr) return rollback("insert training_plan_mesocycle", mesoErr.message);

  const weekRows = weekSeeds.map((seed) => ({
    id: genUuid(),
    plan_id: planId,
    week_start: seed.weekStart,
    phase: seed.phase,
    week_in_phase: seed.weekInPhase,
    budget_tss: seed.budgetTss,
    sessions: seed.sessions,
    hours_target: seed.hoursTarget,
    // Stimoli ESPLICITI da PHASE_DEFAULT_STIMULUS (contratto B): il coach li revisiona
    // come enum, non deve interpretare un '{}' che «significa default».
    objectives: PHASE_DEFAULT_STIMULUS[seed.phase],
    family_mix: { aerobic_pct: 100, gym_pct: 0 },
    mesocycle_id: mesocycleIdBySeq.get(seed.mesocycleSeq) ?? null,
    // 0 = settimana non ancora materializzata: è il segnale che la continuità usa
    // per «consumare» lo scheletro senza proporre un piano nuovo.
    workout_count: 0,
  }));
  const { error: weekErr } = await db.from("training_plan_week").insert(weekRows);
  if (weekErr) return rollback("insert training_plan_week", weekErr.message);

  return {
    ok: true,
    planId,
    status,
    goalEventDate,
    weekCount: weekSeeds.length,
    archivedPlanIds: superseded.archivedPlanIds,
  };
}
