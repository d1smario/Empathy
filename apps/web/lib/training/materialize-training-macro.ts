import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DB_ENGINE_NOTES_TAG,
  publishDbWorkoutsToCalendar,
  readDbEngineWorkouts,
} from "@/lib/training/db-engine/publish-db-workouts";
import { extractWorkoutIds } from "@/lib/training/generate-training-week-headless";
import { addDaysIso } from "@/lib/training/propose-training-macro";
import { VIRYA_NOTES_ILIKE_MARKER } from "@/lib/training/virya/virya-planned-notes";

/**
 * SPLIT proponi/materializza — metà «materializza» (VIRYA rework F2, blueprint sezione D).
 *
 * Trasforma lo scheletro L1 PERSISTITO in sedute `planned_workouts`: per ogni
 * settimana selezionata invoca la RPC `generate_training_week` con i parametri
 * DELLA RIGA `training_plan_week` (budget_tss/sessions/phase dal DB, MAI
 * ricalcolati) e pubblica via `publishDbWorkoutsToCalendar` taggando `plan_id`.
 *
 * Il motore resta quello di oggi (RPC Postgres + publish canonico): il port a
 * Edge Function `materialize-training-week` è F3 — quando arriverà, questo modulo
 * diventerà il wrapper che la invoca per-settimana, e il gate status vivrà
 * IN-FUNCTION [F4]. Qui il gate `status ∈ {approved, active}` è comunque
 * verificato: un draft non materializza MAI.
 *
 * IDEMPOTENZA PER SETTIMANA [F11]: prima di ogni insert si esegue SEMPRE il passo
 * delete (mai opzionale) — vedi `purgeWeekBeforeInsert`.
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
};

export async function materializeTrainingMacro(
  db: SupabaseClient,
  args: { planId: string; weeks: MaterializeWeeksMode; todayIso?: string },
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
    .select("id, week_start, phase, budget_tss, sessions")
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

  // goal_text identico al comportamento di oggi (obiettivi liberi del profilo):
  // gli stimoli STRUTTURATI della settimana restano negli objectives L1; il loro
  // consumo diretto dal motore è materia della EF F3, non di questo wrapper.
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
