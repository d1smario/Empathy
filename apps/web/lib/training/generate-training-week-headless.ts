import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarTrainingVolume } from "@/lib/training/calendar-training-volume";
import {
  publishDbWorkoutsToCalendar,
  readDbEngineWorkouts,
  type PublishDbWorkoutsResult,
} from "@/lib/training/db-engine/publish-db-workouts";

/**
 * Generatore training HEADLESS (Decisione A: Empathy genera in automatico).
 *
 * Compone i pezzi già esistenti — nessun port di Virya client-side:
 *   1. RPC Postgres `generate_training_week` → crea i workout db-engine (tabella `workout`)
 *   2. `readDbEngineWorkouts` → dettagli (blocchi + esercizi)
 *   3. `publishDbWorkoutsToCalendar` → materializza in `planned_workouts` (percorso canonico
 *      con dedupe-fingerprint + clamp → IDEMPOTENTE: ri-eseguire non duplica).
 *
 * Così la generazione training vive nel DB (RPC) esattamente come la nutrizione (Edge V2).
 */

export type GenerateTrainingWeekParams = {
  athleteId: string;
  /** Lunedì (o primo giorno) della settimana da generare, YYYY-MM-DD. */
  weekStart: string;
  discipline: string;
  sessions: number;
  weeklyTss: number;
  phase: string;
  family?: string;
  chips?: string[];
  goalText?: string;
};

export type GenerateTrainingWeekResult = {
  ok: true;
  workoutIds: string[];
  publish: PublishDbWorkoutsResult;
};

/**
 * Normalizza il ritorno SETOF uuid della RPC (array di stringhe o di oggetti).
 * Esportata: `materializeTrainingMacro` invoca la stessa RPC per-settimana e deve
 * decodificarne il ritorno con la stessa tolleranza di formato.
 */
export function extractWorkoutIds(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  const out: string[] = [];
  for (const el of data) {
    if (typeof el === "string") {
      out.push(el);
    } else if (el && typeof el === "object") {
      const v = (el as Record<string, unknown>).generate_training_week ?? Object.values(el)[0];
      if (typeof v === "string") out.push(v);
    }
  }
  return out.filter(Boolean);
}

export async function generateAndPublishTrainingWeek(
  db: SupabaseClient,
  params: GenerateTrainingWeekParams,
): Promise<GenerateTrainingWeekResult | { ok: false; error: string }> {
  // 1. Genera i workout nel DB (overload a 9 argomenti → disambiguato dai nomi).
  const { data, error } = await db.rpc("generate_training_week", {
    p_athlete_id: params.athleteId,
    p_week_start: params.weekStart,
    p_discipline: params.discipline,
    p_sessions: params.sessions,
    p_weekly_tss: params.weeklyTss,
    p_phase: params.phase,
    p_family: params.family ?? "aerobic",
    p_chips: params.chips ?? [],
    p_goal_text: params.goalText ?? "",
  });
  if (error) return { ok: false, error: `generate_training_week: ${error.message}` };

  const workoutIds = extractWorkoutIds(data);
  if (workoutIds.length === 0) {
    return { ok: false, error: "generate_training_week non ha restituito workout" };
  }

  // 2. Leggi i dettagli db-engine e 3. pubblica su planned_workouts (idempotente).
  const details = await readDbEngineWorkouts(db, workoutIds);
  const publish = await publishDbWorkoutsToCalendar(db, details);

  return { ok: true, workoutIds, publish };
}

/* ── Derivazione dei parametri dal profilo atleta (onboarding completato) ── */

export type AthleteTrainingParamsInput = {
  training_days_per_week?: number | null;
  training_max_session_minutes?: number | null;
  goals?: unknown;
  /** `athlete_profiles.routine_config` (jsonb): `week_plan[Mon..Sun].has_training` è la dichiarazione per-giorno. */
  routine_config?: unknown;
};

/** Parametri RPC + ore/settimana stimate (seed per `training_plan_week.hours_target`). */
export type DerivedTrainingWeekParams = Omit<GenerateTrainingWeekParams, "athleteId"> & {
  hoursTarget: number | null;
};

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Numero positivo o `null`: serve a distinguere «non dichiarato» da «dichiarato basso». */
function positiveNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

const WEEK_PLAN_DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Conta i giorni allenabili dichiarati in `routine_config.week_plan` (`has_training`,
 * stessa coercizione stringa/bool della UI Profilo: assente = true). Ritorna null se
 * il week_plan non esiste o non dichiara nessun giorno: in quel caso NON è una
 * dichiarazione «zero allenamenti» ma un profilo senza routine compilata.
 */
function countWeekPlanTrainingDays(routineConfig: unknown): number | null {
  const weekPlan = asRecord(asRecord(routineConfig)?.week_plan);
  if (!weekPlan) return null;
  let seen = false;
  let count = 0;
  for (const key of WEEK_PLAN_DAY_KEYS) {
    const day = asRecord(weekPlan[key]);
    if (!day) continue;
    seen = true;
    if (String(day.has_training ?? true) === "true") count += 1;
  }
  return seen ? count : null;
}

/**
 * Dai dati di routine dell'atleta ai parametri della RPC. Deterministico.
 * RESUSCITATA dal rework VIRYA (blueprint D.1): è la fonte unica dei parametri
 * settimana per `proposeTrainingMacro` — prima era morta (zero chiamanti).
 *
 * ── TRE FONTI, e la legge che le combina ──
 * Le fonti, dalla più autorevole alla meno:
 *   3. il CALENDARIO del coach (`planned_workouts`, via `observeCalendarTrainingVolume`) —
 *      un FATTO: sedute già scritte, con giorno e durata;
 *   2. `routine_config.week_plan` — una dichiarazione per-giorno («il martedì mi alleno»);
 *   1. `training_days_per_week` / `training_max_session_minutes` — una dichiarazione
 *      aggregata, il ripiego per l'atleta senza coach.
 *
 * LEGGE UNICA: **il calendario può solo AGGIUNGERE prova, mai toglierne.** Il che, in
 * pratica, è un `max` fra il termine dichiarato e quello osservato.
 * Il perché è un'asimmetria di prova, non una preferenza estetica:
 *  - «il coach ha scritto 5 giorni» dimostra che l'atleta ne fa ALMENO 5;
 *  - «il coach ne ha scritto 1» NON dimostra che l'atleta ne fa 1: è indistinguibile da
 *    una settimana che il coach non ha ancora finito di compilare.
 * È la stessa asimmetria già accettata per le settimane a zero sedute («non toccata» ≠
 * «non si allena»), estesa con coerenza alle settimane rade — e la stessa forma che ha il
 * gate dei requisiti, che è un OR. Conseguenza voluta e verificabile: questa modifica NON
 * PUÒ rimpicciolire il piano di nessuno rispetto a prima, può solo allargarlo dove il
 * calendario lo dimostra.
 *
 * Perché serviva: questi parametri NON dimensionano la settimana osservata, ne fanno il
 * SEED DI TUTTO IL MACROCICLO (`proposeTrainingMacro` → `buildPlanWeekSeeds`, 8-24
 * settimane). Lasciare che il calendario vincesse «secco» significava far dettare mesi di
 * piano a una singola seduta: verificato su prod, l'atleta 8535ad63 ha oggi 1 solo
 * giorno-seduta nella finestra e sarebbe passato a `sessions` 1 e `weeklyTss` 95.
 * Il contrappeso «massimo fra le settimane con sedute» che vive nell'osservatore protegge
 * solo se almeno un'altra settimana è programmata piena; quando il coach ha messo poche
 * sedute sparse non fa nulla. Questo `max` sì.
 *
 * Il TETTO dichiarato resta comunque un tetto (richiesta esplicita del proprietario):
 * `maxSessionMinutes` = il PIÙ RESTRITTIVO fra `training_max_session_minutes` e il picco
 * osservato in calendario. Se l'atleta dice «oltre 90′ non riesco», una seduta da 120′
 * scritta dal coach non cancella il suo limite: un cap è un'affermazione sull'ATLETA e
 * resta vera finché è lui a cambiarla. Clamp finale 20..240′.
 *
 * MONTE-ORE: `hoursTarget` = il maggiore fra il termine dichiarato
 * (`sessioniDichiarate × minutiDichiarati`, identico a prima di questa modifica) e quello
 * osservato (`giorniInCalendario × minuti MEDI per giorno`, col tetto applicato).
 * La media per giorno, non il picco: `sessions × picco` moltiplica l'outlier e gonfia il
 * monte-ore oltre il calendario che dovrebbe onorare (misurato su prod: +49% per
 * 1a0a63b8, +70% per 8933dda9), e `l2/materialize-week-builder-engine.ts` SCALA le durate
 * delle sedute su `hoursTarget` — l'errore finirebbe dritto nelle sedute generate.
 *
 * Il resto invariato: weeklyTss = ~95 TSS per seduta (proxy di carico base; il coach potrà
 * rifinire), discipline default "cycling" (finché non esiste un campo sport dedicato).
 */
export function deriveTrainingWeekParams(
  profile: AthleteTrainingParamsInput | null,
  weekStart: string,
  opts?: {
    discipline?: string;
    phase?: string;
    /** FONTE 3: volume osservato in `planned_workouts` (null = calendario muto). */
    calendar?: CalendarTrainingVolume | null;
  },
): DerivedTrainingWeekParams {
  // ── termine DICHIARATO: esattamente ciò che questa funzione produceva prima della
  //    fonte 3. Resta il pavimento, così il calendario non può far regredire nessuno.
  const fromWeekPlan = countWeekPlanTrainingDays(profile?.routine_config);
  const declaredSessions =
    fromWeekPlan != null && fromWeekPlan >= 1
      ? Math.min(7, fromWeekPlan)
      : clampInt(profile?.training_days_per_week, 1, 7, 4);

  // ── termine OSSERVATO: giorni allenabili della settimana più carica in calendario.
  const observedSessions = Math.min(7, Math.max(0, Math.round(opts?.calendar?.daysPerWeek ?? 0)));

  const sessions = Math.max(declaredSessions, observedSessions);

  // Cap per-seduta: il più restrittivo fra dichiarato e picco osservato (vedi sopra).
  const declaredMax = positiveNum(profile?.training_max_session_minutes);
  const calendarMax = positiveNum(opts?.calendar?.maxSessionMinutes);
  const chosenMax =
    declaredMax != null && calendarMax != null
      ? Math.min(declaredMax, calendarMax)
      : (declaredMax ?? calendarMax);
  const maxSessionMinutes = clampInt(chosenMax, 20, 240, 75);

  // ── monte-ore: max fra dichiarato e osservato, in MINUTI settimanali.
  //    Dichiarato = il valore storico (sessioni dichiarate × minuti dichiarati/default).
  //    Osservato = i minuti della settimana PIÙ CARICA davvero presente in calendario.
  //
  //    NON `giorni × minuti medi per giorno`: quello incrocia un MASSIMO (i giorni, presi
  //    sulla settimana di picco) con una MEDIA sull'intera finestra di 4 settimane, e il
  //    prodotto non corrisponde a nessuna settimana esistente. Con 6 giorni da 60′ nella
  //    settimana vicina più un lungo da 180′ in ciascuna delle 3 successive — la forma
  //    tipica di un coach che dettaglia solo la settimana prossima — uscivano 10,0 h contro
  //    le 6,0 h davvero programmate. Sui dati di oggi non si vedeva perché 8 atleti su 10
  //    hanno una sola settimana compilata, e lì media e picco coincidono per costruzione.
  //
  //    Il tetto per-seduta resta e continua a mordere: un atleta capato a 60′ non può avere
  //    una settimana da 7×90′ nemmeno se il coach gliel'ha scritta.
  //    `clampInt` sul campo GREZZO (non su `declaredMax`) è voluto: è la stessa riga di
  //    prima della fonte 3, quindi a calendario muto il risultato è identico al bit.
  const declaredWeeklyMinutes =
    declaredSessions * clampInt(profile?.training_max_session_minutes, 20, 240, 75);
  const maxWeeklyMinutes = positiveNum(opts?.calendar?.maxWeeklyMinutes);
  const observedWeeklyMinutes =
    observedSessions >= 1 && maxWeeklyMinutes != null
      ? Math.min(maxWeeklyMinutes, observedSessions * maxSessionMinutes)
      : 0;
  const weeklyMinutes = Math.max(declaredWeeklyMinutes, observedWeeklyMinutes);

  const goals = Array.isArray(profile?.goals)
    ? (profile?.goals as unknown[]).filter((g): g is string => typeof g === "string")
    : [];
  return {
    weekStart,
    discipline: opts?.discipline ?? "cycling",
    sessions,
    weeklyTss: sessions * 95,
    phase: opts?.phase ?? "base",
    family: "aerobic",
    chips: [],
    goalText: goals.join(", "),
    hoursTarget: Math.round((weeklyMinutes / 60) * 10) / 10,
  };
}
