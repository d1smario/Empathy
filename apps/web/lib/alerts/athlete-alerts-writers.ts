import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteAthleteAlerts,
  deriveSleepTargetHours,
  evaluateSleepAlert,
  evaluateTrainingAlert,
  reconcileTrainingKinds,
  summarizePlanAdjustedAlert,
  upsertAthleteAlert,
  type PlanAdjustmentRowLike,
} from "@/lib/alerts/athlete-alerts";
import {
  mergedPayloadFromExportRow,
  wellnessDayKeyFromDeviceExportRow,
} from "@/lib/physiology/wellness-day-key-from-device-export";
import { dedupePlannedWorkoutDbRows } from "@/lib/training/planned/planned-workout-dedupe-fingerprint";
import { plannedRowsForDedupe } from "@/lib/training/planned-executed-window-query";

/**
 * Writer degli alert nei punti evento (server). Regola FAIL-SAFE: ogni funzione qui dentro
 * NON deve mai lanciare — un alert fallito non può rompere l'ingestione device / il run
 * nutrizione che l'ha innescato. Tutto in try/catch, errori solo a log.
 */

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * SONNO (evento): dopo l'ingest di righe sonno device per (atleta, giorno) valuta «sonno basso»
 * contro il target della routine (`athlete_profiles.routine_config`, fallback 8h) e upserta.
 * LIFECYCLE: il dato sonno è ARRIVATO → un eventuale `sleep_missing` del giorno è falso e viene
 * ritirato; se la valutazione è null (sonno sufficiente) viene ritirato anche un eventuale
 * `sleep_low` stale (es. sync parziale poi corretto al rialzo).
 */
export async function recordSleepLowAlertAfterIngest(
  db: SupabaseClient,
  input: { athleteId: string; date: string; sleepHours: number },
): Promise<void> {
  try {
    if (!input.athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return;
    const { data: profile } = await db
      .from("athlete_profiles")
      .select("routine_config")
      .eq("id", input.athleteId)
      .maybeSingle();
    const routineConfig =
      profile && typeof profile.routine_config === "object" && profile.routine_config !== null && !Array.isArray(profile.routine_config)
        ? (profile.routine_config as Record<string, unknown>)
        : null;
    const targetHours = deriveSleepTargetHours(routineConfig, input.date);
    const alert = evaluateSleepAlert({ sleepHours: input.sleepHours, targetHours });
    if (alert) {
      await upsertAthleteAlert(db, { athleteId: input.athleteId, date: input.date, kind: alert.kind, payload: alert.payload });
    }
    await deleteAthleteAlerts(db, {
      athleteId: input.athleteId,
      date: input.date,
      kinds: alert ? ["sleep_missing"] : ["sleep_missing", "sleep_low"],
    });
  } catch (e) {
    console.warn(`[athlete-alerts] sleep_low writer fallito (${input.athleteId} ${input.date}): ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * ESEGUITO (evento): dopo un insert/update di `executed_workouts` da sync device, confronta i
 * TOTALI del giorno (eseguito vs pianificato, TSS altrimenti durata) e RICONCILIA le due kind
 * training_over / training_under per (atleta, giorno): la kind valutata viene upsertata e l'altra
 * cancellata; valutazione null (ratio rientrato, es. 2ª seduta del giorno) → cancellate entrambe.
 * Dedup del pianificato: `dedupePlannedWorkoutDbRows` (fingerprint CANONICO della piattaforma,
 * lo stesso «pianificato del giorno» di Oggi/Nutrizione — vedi buildEffectiveDayTrainingContext):
 * due sedute identiche VERE convivono solo se hanno fingerprint diversi (orario nel contratto ecc.).
 *
 * LIMITI ACCETTATI (v1, casi limite documentati e NON gestiti):
 * - basis TSS mista: se solo ALCUNE righe executed hanno il TSS, `executedTss` somma solo quelle
 *   e sottostima l'eseguito rispetto al pianificato (possibile falso training_under);
 * - doppio provider sulla stessa attività (es. Garmin + Strava sullo stesso giro): due righe
 *   executed distinte → `executedMin`/`executedTss` raddoppiano (possibile falso training_over);
 * - collasso per type del dedupe canonico: il fingerprint di piattaforma tiene UNA sola riga
 *   builder per `type` al giorno (e le righe ops identiche condividono il fingerprint), quindi
 *   due sedute IDENTICHE dello stesso type pianificate davvero contano una volta → pianificato
 *   sottostimato (possibile falso training_over). È la stessa definizione di «pianificato del
 *   giorno» usata da Oggi/Nutrizione: limite ereditato, accettato per coerenza di piattaforma.
 */
export async function recordTrainingAlertAfterExecutedUpsert(
  db: SupabaseClient,
  input: { athleteId: string; date: string },
): Promise<void> {
  try {
    if (!input.athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return;
    const [{ data: plannedRows }, { data: executedRows }] = await Promise.all([
      db
        .from("planned_workouts")
        .select("id, date, type, duration_minutes, tss_target, kcal_target, notes, created_at")
        .eq("athlete_id", input.athleteId)
        .eq("date", input.date),
      db
        .from("executed_workouts")
        .select("duration_minutes, tss")
        .eq("athlete_id", input.athleteId)
        .eq("date", input.date),
    ]);

    let plannedTss = 0;
    let plannedMin = 0;
    let hasPlannedTss = false;
    for (const row of dedupePlannedWorkoutDbRows(plannedRowsForDedupe((plannedRows ?? []) as unknown[]))) {
      const dur = num(row.duration_minutes);
      const tss = num(row.tss_target);
      if (dur != null) plannedMin += dur;
      if (tss != null && tss > 0) {
        plannedTss += tss;
        hasPlannedTss = true;
      }
    }
    // Nessun pianificato → la valutazione sotto è null e il riconcilio ritira eventuali alert stale.

    let executedTss = 0;
    let executedMin = 0;
    let hasExecutedTss = false;
    for (const raw of (executedRows ?? []) as Array<Record<string, unknown>>) {
      const dur = num(raw.duration_minutes);
      const tss = num(raw.tss);
      if (dur != null) executedMin += dur;
      if (tss != null && tss > 0) {
        executedTss += tss;
        hasExecutedTss = true;
      }
    }

    const evaluation = evaluateTrainingAlert({
      plannedTss: hasPlannedTss ? plannedTss : null,
      executedTss: hasExecutedTss ? executedTss : null,
      plannedMin: plannedMin > 0 ? plannedMin : null,
      executedMin,
    });
    const { upsert, delete: staleKinds } = reconcileTrainingKinds(evaluation);
    if (upsert) {
      await upsertAthleteAlert(db, { athleteId: input.athleteId, date: input.date, kind: upsert.kind, payload: upsert.payload });
    }
    await deleteAthleteAlerts(db, { athleteId: input.athleteId, date: input.date, kinds: staleKinds });
  } catch (e) {
    console.warn(`[athlete-alerts] training writer fallito (${input.athleteId} ${input.date}): ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * SINGLE-OWNER di `plan_adjusted` (riconcilio POST-run): le run nutrizione (reintegro/riduzione)
 * scrivono SOLO sul loro dominio `nutrition_daily_adjustment`; l'alert viene riconciliato QUI, in
 * un unico passo dopo che entrambe hanno finito (niente race/flapping da scritture concorrenti
 * sulla stessa (atleta, giorno, plan_adjusted)). Legge lo stato del giorno (entrambe le kind):
 * almeno un adjustment ATTIVO → upsert con payload riassuntivo {kinds, reasons}; nessuno → delete.
 * FAIL-SAFE: mai throw.
 */
export async function reconcilePlanAdjustedAlert(
  db: SupabaseClient,
  input: { athleteId: string; date: string },
): Promise<void> {
  try {
    if (!input.athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return;
    const { data, error } = await db
      .from("nutrition_daily_adjustment")
      .select("kind, extra_kcal, extra_carbs_g, extra_water_ml, reason")
      .eq("athlete_id", input.athleteId)
      .eq("date", input.date);
    if (error) {
      console.warn(`[athlete-alerts] plan_adjusted reconcile (${input.athleteId} ${input.date}): lettura adjustment fallita: ${error.message}`);
      return;
    }
    const payload = summarizePlanAdjustedAlert((data ?? []) as PlanAdjustmentRowLike[]);
    if (payload) {
      await upsertAthleteAlert(db, { athleteId: input.athleteId, date: input.date, kind: "plan_adjusted", payload });
    } else {
      await deleteAthleteAlerts(db, { athleteId: input.athleteId, date: input.date, kinds: ["plan_adjusted"] });
    }
  } catch (e) {
    console.warn(
      `[athlete-alerts] plan_adjusted reconcile fallito (${input.athleteId} ${input.date}): ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Riga export sonno che è un NAP WHOOP (`whoop_sleep.nap === true`): il writer `sleep_low`
 * (whoop-pull-runner) ESCLUDE i nap → per coerenza un giorno con SOLO nap non conta come
 * «dato sonno arrivato» e non deve sopprimere `sleep_missing`.
 */
function isNapSleepExportRow(raw: Record<string, unknown>): boolean {
  try {
    const merged = mergedPayloadFromExportRow(raw);
    const whoopSleep =
      merged && typeof merged.whoop_sleep === "object" && merged.whoop_sleep !== null && !Array.isArray(merged.whoop_sleep)
        ? (merged.whoop_sleep as Record<string, unknown>)
        : null;
    return whoopSleep?.nap === true;
  } catch {
    return false;
  }
}

/**
 * FALLBACK (cron giornaliero): per gli atleti con un device che porta il sonno collegato
 * (WHOOP via `vendor_oauth_links`, Garmin via `garmin_athlete_links` — Strava/Wahoo/… non
 * inviano sonno e non contano), se al momento del run non esiste NESSUNA riga sonno in
 * `device_sync_exports` con giorno
 * logico = `date` (ieri), upserta `sleep_missing` con payload `{expected:true}`. Best-effort:
 * il giorno logico si ricava per riga via `wellnessDayKeyFromDeviceExportRow` (le righe WHOOP
 * hanno created_at dell'ora di pull, non della notte).
 */
export async function flagMissingSleepForDate(
  db: SupabaseClient,
  date: string,
): Promise<{ checked: number; flagged: number }> {
  const out = { checked: 0, flagged: 0 };
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return out;

    const [{ data: whoopLinks }, { data: garminLinks }] = await Promise.all([
      db.from("vendor_oauth_links").select("athlete_id").eq("vendor", "whoop").limit(500),
      db.from("garmin_athlete_links").select("athlete_id").limit(500),
    ]);
    const athleteIds = Array.from(
      new Set(
        [...((whoopLinks ?? []) as Array<Record<string, unknown>>), ...((garminLinks ?? []) as Array<Record<string, unknown>>)]
          .map((r) => String(r.athlete_id ?? ""))
          .filter(Boolean),
      ),
    );
    if (athleteIds.length === 0) return out;
    out.checked = athleteIds.length;

    // Finestra larga: dal giorno target in poi (il pull può arrivare il mattino dopo).
    const { data: sleepRows } = await db
      .from("device_sync_exports")
      .select("athlete_id, payload, created_at")
      .eq("domain", "sleep")
      .in("athlete_id", athleteIds)
      .gte("created_at", `${date}T00:00:00.000Z`)
      .limit(2000);

    const covered = new Set<string>();
    for (const raw of (sleepRows ?? []) as Array<Record<string, unknown>>) {
      const athleteId = String(raw.athlete_id ?? "");
      if (!athleteId || covered.has(athleteId)) continue;
      if (isNapSleepExportRow(raw)) continue; // solo nap ≠ sonno notturno (allineato al writer sleep_low)
      try {
        if (wellnessDayKeyFromDeviceExportRow(raw) === date) covered.add(athleteId);
      } catch {
        /* payload illeggibile → non copre */
      }
    }

    // SKIP se esiste già un alert sonno del giorno: sleep_low implica che il dato è ARRIVATO
    // (ed era basso) — flaggare «mancante» sarebbe contraddittorio.
    const { data: sleepLowRows } = await db
      .from("athlete_alerts")
      .select("athlete_id")
      .eq("kind", "sleep_low")
      .eq("date", date)
      .in("athlete_id", athleteIds)
      .limit(1000);
    for (const raw of (sleepLowRows ?? []) as Array<Record<string, unknown>>) {
      const athleteId = String(raw.athlete_id ?? "");
      if (athleteId) covered.add(athleteId);
    }

    for (const athleteId of athleteIds) {
      if (covered.has(athleteId)) continue;
      const res = await upsertAthleteAlert(db, {
        athleteId,
        date,
        kind: "sleep_missing",
        payload: { expected: true },
      });
      if (res.ok) out.flagged += 1;
    }
    return out;
  } catch (e) {
    console.warn(`[athlete-alerts] sleep_missing fallback fallito (${date}): ${e instanceof Error ? e.message : String(e)}`);
    return out;
  }
}
