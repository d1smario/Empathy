import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Alert event-driven per atleta («gli alert sono di quando arrivano, non di quando guardi l'app»).
 * Questo file è la LOGICA PURA + l'upsert idempotente: nessun import server-only, testabile con
 * `tsx --test`. I punti evento (ingest device, sync executed, compensazioni nutrizione, cron)
 * usano i writer in `athlete-alerts-writers.ts`.
 */

export type AlertKind = "sleep_low" | "training_over" | "training_under" | "plan_adjusted" | "sleep_missing";

export type AthleteAlertRow = {
  id: string;
  athlete_id: string;
  kind: AlertKind;
  date: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
};

export type AlertEvaluation = { kind: AlertKind; payload: Record<string, unknown> };

/** Le due kind di training riconciliate insieme: al più UNA può essere vera per (atleta, giorno). */
export const TRAINING_ALERT_KINDS: readonly AlertKind[] = ["training_over", "training_under"];

/** Target sonno quando la routine non lo esprime (o è illeggibile). */
export const DEFAULT_SLEEP_TARGET_HOURS = 8;

/** Sonno «basso» sotto questa frazione del target (0.8 → sotto l'80%). */
export const SLEEP_LOW_RATIO = 0.8;

/** Eseguito oltre il 130% del pianificato → training_over. */
export const TRAINING_OVER_RATIO = 1.3;

/** Eseguito sotto il 70% del pianificato → training_under. */
export const TRAINING_UNDER_RATIO = 0.7;

function finiteNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function hhmmToMinutes(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Stessa mappa giorni di `routine_config.week_plan` (vedi build-today-events / profile-page-kit). */
function isoDateToWeekDayKey(isoDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return labels[d.getUTCDay()] ?? null;
}

/**
 * Target ore di sonno dalla routine del profilo (`athlete_profiles.routine_config`):
 * `week_plan[dayKey].night_time → wake_time` (override per-giorno) con fallback alle chiavi
 * globali `sleep_time` / `wake_time` — stessa derivazione di `build-today-events`.
 * Finestra a cavallo di mezzanotte gestita; se illeggibile → {@link DEFAULT_SLEEP_TARGET_HOURS}.
 */
export function deriveSleepTargetHours(
  routineConfig: Record<string, unknown> | null | undefined,
  isoDate?: string | null,
): number {
  const cfg = asRecord(routineConfig);
  if (!cfg) return DEFAULT_SLEEP_TARGET_HOURS;

  const dayKey = isoDate ? isoDateToWeekDayKey(isoDate) : null;
  const weekPlan = asRecord(cfg.week_plan);
  const dayRoutine = dayKey ? asRecord(weekPlan?.[dayKey]) : null;

  const sleepMin = hhmmToMinutes(dayRoutine?.night_time) ?? hhmmToMinutes(cfg.sleep_time);
  const wakeMin = hhmmToMinutes(dayRoutine?.wake_time) ?? hhmmToMinutes(cfg.wake_time);
  if (sleepMin == null || wakeMin == null) return DEFAULT_SLEEP_TARGET_HOURS;

  const diffMin = (wakeMin - sleepMin + 24 * 60) % (24 * 60);
  if (diffMin <= 0) return DEFAULT_SLEEP_TARGET_HOURS;
  return Number((diffMin / 60).toFixed(2));
}

/**
 * Sonno basso: ore dormite sotto {@link SLEEP_LOW_RATIO} del target.
 * `targetHours` assente/invalido → fallback {@link DEFAULT_SLEEP_TARGET_HOURS}.
 * Senza ore dormite misurate non c'è alert (il «manca il dato» è `sleep_missing`, dal cron).
 */
export function evaluateSleepAlert(input: {
  sleepHours: number | null | undefined;
  targetHours?: number | null;
}): AlertEvaluation | null {
  const sleepHours = finiteNum(input.sleepHours);
  if (sleepHours == null || sleepHours < 0) return null;

  const targetRaw = finiteNum(input.targetHours);
  const targetHours = targetRaw != null && targetRaw > 0 ? targetRaw : DEFAULT_SLEEP_TARGET_HOURS;

  const thresholdHours = Number((targetHours * SLEEP_LOW_RATIO).toFixed(2));
  if (sleepHours >= thresholdHours) return null;

  return {
    kind: "sleep_low",
    payload: {
      sleep_hours: Number(sleepHours.toFixed(2)),
      target_hours: targetHours,
      threshold_hours: thresholdHours,
      ratio: Number((sleepHours / targetHours).toFixed(2)),
    },
  };
}

/**
 * Confronto eseguito vs pianificato del giorno: TSS se entrambi presenti, altrimenti durata.
 * Nessun pianificato (né TSS né minuti) → nessun alert (giorno libero: allenarsi non è un'anomalia).
 * ratio > {@link TRAINING_OVER_RATIO} → training_over; ratio < {@link TRAINING_UNDER_RATIO} → training_under.
 */
export function evaluateTrainingAlert(input: {
  plannedTss?: number | null;
  executedTss?: number | null;
  plannedMin?: number | null;
  executedMin?: number | null;
}): AlertEvaluation | null {
  const plannedTss = finiteNum(input.plannedTss);
  const executedTss = finiteNum(input.executedTss);
  const plannedMin = finiteNum(input.plannedMin);
  const executedMin = finiteNum(input.executedMin);

  let basis: "tss" | "duration";
  let planned: number;
  let executed: number;

  if (plannedTss != null && plannedTss > 0 && executedTss != null && executedTss >= 0) {
    basis = "tss";
    planned = plannedTss;
    executed = executedTss;
  } else if (plannedMin != null && plannedMin > 0 && executedMin != null && executedMin >= 0) {
    basis = "duration";
    planned = plannedMin;
    executed = executedMin;
  } else {
    return null;
  }

  const ratio = executed / planned;
  const kind: AlertKind | null =
    ratio > TRAINING_OVER_RATIO ? "training_over" : ratio < TRAINING_UNDER_RATIO ? "training_under" : null;
  if (!kind) return null;

  return {
    kind,
    payload: {
      basis,
      planned: Number(planned.toFixed(1)),
      executed: Number(executed.toFixed(1)),
      ratio: Number(ratio.toFixed(2)),
    },
  };
}

/** Riga (parziale) di `nutrition_daily_adjustment` per il riconcilio di `plan_adjusted`. */
export type PlanAdjustmentRowLike = {
  kind?: unknown;
  extra_kcal?: unknown;
  extra_carbs_g?: unknown;
  extra_water_ml?: unknown;
  reason?: unknown;
};

/** Adjustment ATTIVO = almeno uno tra kcal/carboidrati/acqua diverso da zero (riduzione = kcal negative). */
export function hasActiveAdjustment(row: PlanAdjustmentRowLike): boolean {
  for (const v of [row.extra_kcal, row.extra_carbs_g, row.extra_water_ml]) {
    const n = finiteNum(v);
    if (n != null && n !== 0) return true;
  }
  return false;
}

/**
 * SINGLE-OWNER di `plan_adjusted`: dato lo stato COMPLETO di `nutrition_daily_adjustment` del
 * giorno (entrambe le kind), produce il payload riassuntivo dell'alert se almeno un adjustment
 * è attivo, altrimenti `null` (→ l'alert va ritirato). Logica pura, testabile senza DB.
 */
export function summarizePlanAdjustedAlert(rows: PlanAdjustmentRowLike[]): Record<string, unknown> | null {
  const active = rows.filter(hasActiveAdjustment);
  if (active.length === 0) return null;
  const kinds = Array.from(
    new Set(active.map((r) => (typeof r.kind === "string" ? r.kind.trim() : "")).filter(Boolean)),
  ).sort();
  // sort: payload deterministico a parità di righe (l'ordine dal DB non è garantito).
  const reasons = Array.from(
    new Set(active.map((r) => (typeof r.reason === "string" ? r.reason.trim() : "")).filter(Boolean)),
  ).sort();
  return { kinds, reasons };
}

/**
 * Riconcilio LIFECYCLE delle kind di training per (atleta, giorno): a ogni valutazione dei totali
 * del giorno, la kind valutata (se c'è) va upsertata e L'ALTRA cancellata (transizione under→over);
 * valutazione null (ratio rientrato) → cancellate ENTRAMBE (la 2ª seduta del giorno può far
 * rientrare il ratio della 1ª). Logica pura, testabile senza DB.
 */
export function reconcileTrainingKinds(evaluation: AlertEvaluation | null): {
  upsert: AlertEvaluation | null;
  delete: AlertKind[];
} {
  if (!evaluation) return { upsert: null, delete: [...TRAINING_ALERT_KINDS] };
  return { upsert: evaluation, delete: TRAINING_ALERT_KINDS.filter((k) => k !== evaluation.kind) };
}

/**
 * Scrittura idempotente dell'alert: upsert su (athlete_id, date, kind) che aggiorna SOLO il
 * payload (created_at resta quello del primo evento — non è nella riga passata). MAI throw:
 * un alert non deve rompere l'ingestione che l'ha generato; errori → log e ritorna.
 */
export async function upsertAthleteAlert(
  db: SupabaseClient,
  input: { athleteId: string; date: string; kind: AlertKind; payload: Record<string, unknown> },
): Promise<{ ok: boolean }> {
  try {
    const { error } = await db.from("athlete_alerts").upsert(
      {
        athlete_id: input.athleteId,
        date: input.date,
        kind: input.kind,
        payload: input.payload,
      },
      { onConflict: "athlete_id,date,kind" },
    );
    if (error) {
      console.warn(`[athlete-alerts] upsert ${input.kind} ${input.athleteId} ${input.date} fallito: ${error.message}`);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.warn(
      `[athlete-alerts] upsert ${input.kind} ${input.athleteId} ${input.date} eccezione: ${e instanceof Error ? e.message : String(e)}`,
    );
    return { ok: false };
  }
}

/**
 * RITIRO degli alert quando la condizione rientra: delete su (athlete_id, date) per le `kinds`
 * passate. Stessa regola FAIL-SAFE dell'upsert — MAI throw: un ritiro fallito non deve rompere
 * l'ingestione/il run che l'ha innescato; errori → log e ritorna.
 */
export async function deleteAthleteAlerts(
  db: SupabaseClient,
  input: { athleteId: string; date: string; kinds: AlertKind[] },
): Promise<{ ok: boolean }> {
  try {
    if (input.kinds.length === 0) return { ok: true };
    const { error } = await db
      .from("athlete_alerts")
      .delete()
      .eq("athlete_id", input.athleteId)
      .eq("date", input.date)
      .in("kind", input.kinds);
    if (error) {
      console.warn(`[athlete-alerts] delete ${input.kinds.join(",")} ${input.athleteId} ${input.date} fallito: ${error.message}`);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.warn(
      `[athlete-alerts] delete ${input.kinds.join(",")} ${input.athleteId} ${input.date} eccezione: ${e instanceof Error ? e.message : String(e)}`,
    );
    return { ok: false };
  }
}
