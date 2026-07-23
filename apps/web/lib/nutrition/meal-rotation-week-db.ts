import type { SupabaseClient } from "@supabase/supabase-js";
import { mealRotationStaplesFromComposedItems } from "@/lib/nutrition/v2/fdc-staple-registry";

/**
 * Memoria settimanale SERVER-SIDE per la rotazione staple: legge dal DB i canonical_key
 * dei `meal_item` già persistiti nella settimana ISO di `planDate` per l'atleta
 * (nutrition_plan → meal → meal_item), escluso il giorno in rigenerazione, e li aggrega
 * in conteggi per chiave rotation (es. carb:pasta) — stessa semantica della cache
 * localStorage client (`meal-rotation-week-cache`): 1 occorrenza per (giorno, chiave).
 * Così anche i path headless (Edge Function senza cache client, cron, replan) generano
 * con la memoria della settimana invece che a memoria zero.
 */

/** Range settimana ISO (lunedì → domenica) della data piano, in ISO YYYY-MM-DD. */
export function isoWeekRangeForDate(isoDate: string): { start: string; end: string } {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return { start: isoDate, end: isoDate };
  const dayNr = (d.getUTCDay() + 6) % 7; // 0 = lunedì
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - dayNr);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = (x: Date) =>
    `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}

/** Fusione conteggi (client + DB): per ogni chiave vince il MAX — mai doppio conteggio. */
export function mergeWeeklyStapleCounts(
  ...sources: Array<Record<string, number> | undefined>
): Record<string, number> | undefined {
  const out: Record<string, number> = {};
  for (const src of sources) {
    if (!src) continue;
    for (const [k, v] of Object.entries(src)) {
      if (typeof k !== "string" || !k || k.length > 72) continue;
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
      const n = Math.min(21, Math.floor(v));
      if (n > (out[k] ?? 0)) out[k] = n;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

type WeekPlanRow = {
  plan_date?: unknown;
  meal?: Array<{ meal_item?: Array<{ canonical_key?: unknown }> | null }> | null;
};

/**
 * Conteggi staple della settimana ISO di `planDate` dal DB (escluso `planDate` stesso).
 * Best-effort: qualsiasi errore → `{}` (la generazione non deve rompersi).
 */
export async function loadWeeklyStapleCountsFromDb(
  db: SupabaseClient,
  athleteId: string,
  planDate: string,
): Promise<Record<string, number>> {
  try {
    const { start, end } = isoWeekRangeForDate(planDate);
    const { data, error } = await db
      .from("nutrition_plan")
      .select("plan_date, meal(meal_item(canonical_key))")
      .eq("athlete_id", athleteId)
      .gte("plan_date", start)
      .lte("plan_date", end)
      .neq("plan_date", planDate);
    if (error || !Array.isArray(data)) return {};

    const counts: Record<string, number> = {};
    for (const row of data as WeekPlanRow[]) {
      const meals = Array.isArray(row?.meal) ? row.meal : [];
      const items = meals.flatMap((m) => (Array.isArray(m?.meal_item) ? m.meal_item : []));
      const dayKeys = mealRotationStaplesFromComposedItems(
        items.map((it) => ({ canonicalKey: typeof it?.canonical_key === "string" ? it.canonical_key : null })),
      );
      for (const k of dayKeys) counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}
