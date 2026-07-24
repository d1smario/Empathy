import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DB_ENGINE_NOTES_TAG,
  publishDbWorkoutsToCalendar,
  readDbEngineWorkouts,
} from "@/lib/training/db-engine/publish-db-workouts";
import { extractWorkoutIds } from "@/lib/training/generate-training-week-headless";
import { loadAthleteRenderProfile } from "@/lib/training/l2/athlete-render-profile";
import { loadBuilderEngineCatalogs } from "@/lib/training/l2/load-builder-engine-catalogs";
import {
  materializeWeekWithBuilderEngine,
  type BuilderEngineSkeletonWeek,
} from "@/lib/training/l2/materialize-week-builder-engine";
import {
  resolveTrainingL2Engine,
  type TrainingL2Engine,
} from "@/lib/training/l2/resolve-training-l2-engine";
import { loadViryaConfigFromDb } from "@/lib/training/l2/virya-db-config";
import {
  familyMixFromJson,
  weekObjectivesFromJson,
  coercePhase,
} from "@/lib/training/plan/plan-skeleton-mappers";
import { insertPlannedWorkoutRows } from "@/lib/training/planned/insert-planned-workout";
import { addDaysIso } from "@/lib/training/propose-training-macro";
import { VIRYA_NOTES_ILIKE_MARKER } from "@/lib/training/virya/virya-planned-notes";

/**
 * SPLIT proponi/materializza — metà «materializza» (VIRYA rework F2/F3, blueprint D).
 *
 * Trasforma lo scheletro L1 PERSISTITO in sedute `planned_workouts`, con DUE
 * motori dietro un commutatore (`resolveTrainingL2Engine`, F3):
 *
 * - `db` (DEFAULT, invariato): RPC `generate_training_week` con i parametri
 *   DELLA RIGA `training_plan_week` (budget_tss/sessions/phase dal DB, MAI
 *   ricalcolati) + publish via `publishDbWorkoutsToCalendar` taggando `plan_id`.
 * - `builder` (opt-in via env, shadow/QA): la catena TS del Builder in-process
 *   (`materializeWeekWithBuilderEngine`), che consuma gli edit coach dello
 *   scheletro (objectives/hours_target/budget/family_mix) e le tabelle config
 *   `virya_*` come fonte unica. La FUTURA Edge Function `materialize-training-week`
 *   importerà la STESSA funzione: qui cambia solo il runtime, mai il motore.
 *
 * Il gate `status ∈ {approved, active}` è verificato qui e vivrà anche
 * IN-FUNCTION nella EF [F4]: un draft non materializza MAI.
 *
 * IDEMPOTENZA PER SETTIMANA [F11]: prima di ogni insert si esegue SEMPRE il passo
 * delete (mai opzionale) — vedi `purgeWeekBeforeInsert` — identico per i due rami,
 * come identico è lo skip dei giorni con seduta Builder del coach.
 */

export type MaterializeWeeksMode =
  | {
      /** Incrementale (default dei cron): copre solo le prossime N settimane future. */
      mode: "runway";
      minFutureWeeks?: number;
    }
  | { mode: "explicit"; weekStarts: string[] }
  | { mode: "all" };

export type MaterializeTrainingMacroResult =
  | {
      ok: true;
      planId: string;
      /** weekStart delle settimane materializzate in questo giro. */
      materialized: string[];
      /** weekStart delle settimane scheletro fuori selezione (non è un errore). */
      skipped: string[];
      errors: Array<{ weekStart: string; error: string }>;
      /** Totale righe planned_workouts pubblicate. */
      publishedCount: number;
    }
  | { ok: false; error: string };

/**
 * Selezione settimane (pura, testabile). `runway`: solo le settimane non ancora
 * concluse il cui inizio cade entro `oggi + N*7` — pattern MIN_FUTURE_WEEKS di
 * `ensureTrainingContinuity`: si copre la pista minima, non si materializza
 * l'intero macro in un colpo (le settimane lontane restano revisionabili).
 */
export function selectWeekStartsToMaterialize(
  allWeekStarts: readonly string[],
  mode: MaterializeWeeksMode,
  todayIso: string,
): { selected: string[]; skipped: string[] } {
  const sorted = [...new Set(allWeekStarts.map((s) => s.slice(0, 10)))].sort();
  if (mode.mode === "all") return { selected: sorted, skipped: [] };
  if (mode.mode === "explicit") {
    const wanted = new Set(mode.weekStarts.map((s) => s.slice(0, 10)));
    const selected = sorted.filter((s) => wanted.has(s));
    return { selected, skipped: sorted.filter((s) => !wanted.has(s)) };
  }
  const minFuture = Math.max(1, Math.round(mode.minFutureWeeks ?? 3));
  const horizon = addDaysIso(todayIso.slice(0, 10), minFuture * 7);
  const selected = sorted.filter(
    (s) => addDaysIso(s, 6) >= todayIso.slice(0, 10) && s <= horizon,
  );
  return { selected, skipped: sorted.filter((s) => !selected.includes(s)) };
}

/** Marker righe legacy del flusso pre-split (publish db-engine senza plan_id). */
const DB_ENGINE_NOTES_ILIKE = `%${DB_ENGINE_NOTES_TAG}%`;

/**
 * Passo delete PRIMA dell'insert — SEMPRE eseguito [F11], 3 criteri (blueprint C):
 * 1. righe del piano corrente nel range (idempotenza strutturale del re-run);
 * 2. righe legacy WIZARD (plan_id null + marker `[VIRYA:]`): senza questo criterio
 *    non sono coperte da nessuna protezione e la riga L2 entrerebbe ACCANTO alla
 *    legacy = doppio conteggio nutrizione;
 * 3. righe legacy del VECCHIO flusso headless (plan_id null + marker
 *    `[EMPATHY_DB_ENGINE`): output motore pre-split, stessa semantica del criterio 2.
 * Le righe COACH (plan_id null, senza marker motore) non si toccano MAI.
 */
async function purgeWeekBeforeInsert(
  db: SupabaseClient,
  args: { planId: string; athleteId: string; weekStart: string; weekEnd: string },
): Promise<void> {
  const { planId, athleteId, weekStart, weekEnd } = args;
  const planScoped = await db
    .from("planned_workouts")
    .delete()
    .eq("athlete_id", athleteId)
    .eq("plan_id", planId)
    .gte("date", weekStart)
    .lte("date", weekEnd);
  if (planScoped.error) throw new Error(`purge piano: ${planScoped.error.message}`);

  for (const marker of [VIRYA_NOTES_ILIKE_MARKER, DB_ENGINE_NOTES_ILIKE]) {
    const legacy = await db
      .from("planned_workouts")
      .delete()
      .eq("athlete_id", athleteId)
      .is("plan_id", null)
      .ilike("notes", marker)
      .gte("date", weekStart)
      .lte("date", weekEnd);
    if (legacy.error) throw new Error(`purge legacy: ${legacy.error.message}`);
  }
}

/**
 * Giorni della settimana già occupati da una seduta BUILDER del coach
 * (plan_id null + type `pro2_builder_*`): L2 li SALTA — «il coach domina il
 * motore» sul giorno (blueprint D, regola 3). Senza skip, il replace per-type di
 * `insertSinglePlannedWorkout` potrebbe mangiare la riga coach.
 */
async function loadCoachBusyDates(
  db: SupabaseClient,
  args: { athleteId: string; weekStart: string; weekEnd: string },
): Promise<Set<string>> {
  const { data, error } = await db
    .from("planned_workouts")
    .select("date")
    .eq("athlete_id", args.athleteId)
    .is("plan_id", null)
    .ilike("type", "pro2\\_builder%")
    .gte("date", args.weekStart)
    .lte("date", args.weekEnd);
  if (error) throw new Error(`lettura giorni coach: ${error.message}`);
  return new Set(
    ((data ?? []) as Array<Record<string, unknown>>)
      .map((r) => String(r.date ?? "").slice(0, 10))
      .filter(Boolean),
  );
}

type SkeletonWeekRow = {
  id: string;
  week_start: string;
  phase: string;
  budget_tss: number;
  sessions: number;
  hours_target: number | string | null;
  objectives: unknown;
  family_mix: unknown;
};

export async function materializeTrainingMacro(
  db: SupabaseClient,
  args: {
    planId: string;
    weeks: MaterializeWeeksMode;
    todayIso?: string;
    /**
     * Motore L2 (F3). Assente → deciso da `resolveTrainingL2Engine(athleteId)`
     * (env TRAINING_L2_ENGINE / TRAINING_L2_BUILDER_ATHLETES, default 'db'):
     * approve route, cron e continuità passano dal resolver senza modifiche.
     */
    engine?: TrainingL2Engine;
  },
): Promise<MaterializeTrainingMacroResult> {
  const planId = args.planId.trim();
  if (!planId) return { ok: false, error: "materializeTrainingMacro: planId mancante" };
  const todayIso = (args.todayIso ?? new Date().toISOString()).slice(0, 10);

  const { data: planRow, error: planErr } = await db
    .from("training_plan")
    .select("id, athlete_id, discipline, status")
    .eq("id", planId)
    .maybeSingle();
  if (planErr) return { ok: false, error: `lettura piano: ${planErr.message}` };
  if (!planRow) return { ok: false, error: "plan_not_found" };
  const plan = planRow as { id: string; athlete_id: string; discipline: string | null; status: string | null };

  // Gate revisione: un draft non materializza MAI. In F3 questo stesso controllo
  // vivrà DENTRO la Edge Function [F4] così nemmeno un'invocazione diretta lo salta;
  // qui è il confine server-side del wrapper (chiamato solo con service-role).
  if (plan.status !== "approved" && plan.status !== "active") {
    return { ok: false, error: "plan_not_approved" };
  }

  const { data: weekRowsRaw, error: weekErr } = await db
    .from("training_plan_week")
    // objectives/family_mix/hours_target: consumati dal ramo builder (edit coach
    // dello scheletro); il ramo db li ignora e resta identico byte-per-byte.
    .select("id, week_start, phase, budget_tss, sessions, hours_target, objectives, family_mix")
    .eq("plan_id", planId)
    .order("week_start", { ascending: true });
  if (weekErr) return { ok: false, error: `lettura settimane: ${weekErr.message}` };
  const weekRows = ((weekRowsRaw ?? []) as SkeletonWeekRow[]).filter((w) =>
    /^\d{4}-\d{2}-\d{2}/.test(String(w.week_start ?? "")),
  );
  const byWeekStart = new Map(weekRows.map((w) => [String(w.week_start).slice(0, 10), w]));

  const { selected, skipped } = selectWeekStartsToMaterialize(
    weekRows.map((w) => String(w.week_start).slice(0, 10)),
    args.weeks,
    todayIso,
  );

  const errors: Array<{ weekStart: string; error: string }> = [];
  if (args.weeks.mode === "explicit") {
    for (const requested of args.weeks.weekStarts) {
      const key = requested.slice(0, 10);
      if (!byWeekStart.has(key)) errors.push({ weekStart: key, error: "week_not_in_skeleton" });
    }
  }

  // Commutatore F3: il motore si decide UNA volta per piano (mai per settimana,
  // niente settimane miste). Default 'db' — il ramo builder è opt-in via env.
  const engine = args.engine ?? resolveTrainingL2Engine(plan.athlete_id);
  if (engine === "builder") {
    const builder = await materializeSelectedWeeksWithBuilderEngine(db, {
      planId,
      athleteId: plan.athlete_id,
      discipline: plan.discipline ?? "cycling",
      selected,
      byWeekStart,
      errors,
    });
    return {
      ok: true,
      planId,
      materialized: builder.materialized,
      skipped,
      errors,
      publishedCount: builder.publishedCount,
    };
  }

  // goal_text identico al comportamento di oggi (obiettivi liberi del profilo):
  // gli stimoli STRUTTURATI della settimana restano negli objectives L1; il loro
  // consumo diretto è materia del motore builder (sopra) e della EF F3.
  const { data: profileRow } = await db
    .from("athlete_profiles")
    .select("goals")
    .eq("id", plan.athlete_id)
    .maybeSingle();
  const goals = Array.isArray((profileRow as { goals?: unknown } | null)?.goals)
    ? ((profileRow as { goals: unknown[] }).goals.filter((g): g is string => typeof g === "string"))
    : [];
  const goalText = goals.join(", ");

  const materialized: string[] = [];
  let publishedCount = 0;

  for (const weekStart of selected) {
    const week = byWeekStart.get(weekStart);
    if (!week) continue; // impossibile per costruzione, difensivo
    const weekEnd = addDaysIso(weekStart, 6);
    try {
      await purgeWeekBeforeInsert(db, { planId, athleteId: plan.athlete_id, weekStart, weekEnd });
      const coachBusyDates = await loadCoachBusyDates(db, { athleteId: plan.athlete_id, weekStart, weekEnd });

      // Parametri DALLA riga scheletro (fonte unica, eventualmente già rifinita dal coach).
      const { data: rpcData, error: rpcErr } = await db.rpc("generate_training_week", {
        p_athlete_id: plan.athlete_id,
        p_week_start: weekStart,
        p_discipline: plan.discipline ?? "cycling",
        p_sessions: Math.max(1, Math.round(Number(week.sessions) || 1)),
        p_weekly_tss: Math.max(0, Math.round(Number(week.budget_tss) || 0)),
        p_phase: String(week.phase ?? "base"),
        p_family: "aerobic",
        p_chips: [],
        p_goal_text: goalText,
      });
      if (rpcErr) throw new Error(`generate_training_week: ${rpcErr.message}`);
      const workoutIds = extractWorkoutIds(rpcData);
      if (workoutIds.length === 0) throw new Error("generate_training_week non ha restituito workout");

      const details = await readDbEngineWorkouts(db, workoutIds);
      const publishable = details.filter((d) => !coachBusyDates.has(d.workout.date));
      const publish = await publishDbWorkoutsToCalendar(db, publishable, { planId });
      publishedCount += publish.publishedIds.length;
      materialized.push(weekStart);

      // workout_count > 0 = settimana materializzata: segnale letto dalla continuità
      // per distinguere «scheletro da consumare» da «piano esaurito».
      const { error: countErr } = await db
        .from("training_plan_week")
        .update({ workout_count: publish.publishedIds.length })
        .eq("id", week.id);
      if (countErr) errors.push({ weekStart, error: `workout_count: ${countErr.message}` });
    } catch (e) {
      errors.push({ weekStart, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { ok: true, planId, materialized, skipped, errors, publishedCount };
}

function asFiniteOrNull(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * Ramo BUILDER del commutatore F3: stessa orchestrazione del ramo db
 * (purge SEMPRE prima [F11], skip giorni con seduta Builder del coach,
 * workout_count come segnale per la continuità), motore diverso.
 *
 * Config VIRYA, profilo render REALE e cataloghi si caricano UNA volta per piano
 * e si passano alla funzione PURA `materializeWeekWithBuilderEngine` — la stessa
 * che la Edge Function `materialize-training-week` importerà dal bundle. Se la
 * config `virya_*` manca, il giro FALLISCE esplicito (mai fallback silenzioso al
 * motore db: maschererebbe un errore di config proprio durante il QA).
 */
async function materializeSelectedWeeksWithBuilderEngine(
  db: SupabaseClient,
  args: {
    planId: string;
    athleteId: string;
    discipline: string;
    selected: string[];
    byWeekStart: Map<string, SkeletonWeekRow>;
    errors: Array<{ weekStart: string; error: string }>;
  },
): Promise<{ materialized: string[]; publishedCount: number }> {
  const { planId, athleteId, discipline, selected, byWeekStart, errors } = args;
  const materialized: string[] = [];
  let publishedCount = 0;
  if (!selected.length) return { materialized, publishedCount };

  let shared: {
    config: Awaited<ReturnType<typeof loadViryaConfigFromDb>>;
    profile: Awaited<ReturnType<typeof loadAthleteRenderProfile>>;
    catalogs: Awaited<ReturnType<typeof loadBuilderEngineCatalogs>>;
  };
  try {
    const [config, profile] = await Promise.all([
      loadViryaConfigFromDb(db),
      loadAthleteRenderProfile(db, athleteId),
    ]);
    // Il catalogo gym si carica solo se almeno una settimana selezionata ha quota
    // gym: per i piani 100/0 (default F2) il giro resta a due query in meno.
    const includeGym = selected.some((weekStart) => {
      const week = byWeekStart.get(weekStart);
      return week ? familyMixFromJson(week.family_mix).gymPct > 0 : false;
    });
    const catalogs = await loadBuilderEngineCatalogs(db, { discipline, includeGym });
    shared = { config, profile, catalogs };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    for (const weekStart of selected) {
      errors.push({ weekStart, error: `builder_engine_setup: ${message}` });
    }
    return { materialized, publishedCount };
  }

  for (const weekStart of selected) {
    const week = byWeekStart.get(weekStart);
    if (!week) continue; // impossibile per costruzione, difensivo
    const weekEnd = addDaysIso(weekStart, 6);
    try {
      await purgeWeekBeforeInsert(db, { planId, athleteId, weekStart, weekEnd });
      const coachBusyDates = await loadCoachBusyDates(db, { athleteId, weekStart, weekEnd });

      const phase = coercePhase(week.phase);
      const skeletonWeek: BuilderEngineSkeletonWeek = {
        weekStart,
        phase,
        loadTarget: Math.max(0, Math.round(Number(week.budget_tss) || 0)),
        sessionsTarget: Math.max(1, Math.round(Number(week.sessions) || 1)),
        hoursTarget: asFiniteOrNull(week.hours_target),
        // Edit coach dello scheletro: stimoli espliciti (o derivati dalla fase se
        // '{}') e quota famiglie — stessi mapper difensivi del contratto L1.
        stimulus: weekObjectivesFromJson(week.objectives, phase),
        familyMix: familyMixFromJson(week.family_mix),
        // Disponibilità LIVE dalla routine (fonte unica, mai snapshot): riletta a
        // ogni giro dal loader profilo.
        availableDays: shared.profile.availableDays,
      };

      const result = materializeWeekWithBuilderEngine({
        planId,
        athleteId,
        discipline,
        week: skeletonWeek,
        profile: shared.profile,
        config: shared.config,
        catalogs: shared.catalogs,
      });
      for (const slotError of result.errors) {
        errors.push({ weekStart, error: `${slotError.date}: ${slotError.error}` });
      }

      // Skip-day coach identico al ramo db: L2 non tocca mai i giorni con una
      // seduta Builder senza plan_id (il coach domina il motore sul giorno).
      const publishable = result.rows.filter((row) => !coachBusyDates.has(row.date));
      const inserted = await insertPlannedWorkoutRows(db, publishable);
      publishedCount += inserted.ids.length;
      materialized.push(weekStart);

      // workout_count > 0 = settimana materializzata: segnale letto dalla
      // continuità per distinguere «scheletro da consumare» da «piano esaurito».
      const { error: countErr } = await db
        .from("training_plan_week")
        .update({ workout_count: inserted.ids.length })
        .eq("id", week.id);
      if (countErr) errors.push({ weekStart, error: `workout_count: ${countErr.message}` });
    } catch (e) {
      errors.push({ weekStart, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { materialized, publishedCount };
}
