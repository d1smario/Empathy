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
  meal?: Array<{ meal_item?: Array<{ canonical_key?: unknown; recipe_key?: unknown }> | null }> | null;
};

/** Prefisso chiave rotazione ricette (grammatica dei pasti) — stesso di meal-grammar.ts. */
const RECIPE_ROTATION_PREFIX = "recipe:";

/**
 * Conteggi staple della settimana ISO di `planDate` dal DB (escluso `planDate` stesso).
 * Best-effort: qualsiasi errore → `{}` (la generazione non deve rompersi).
 * `opts.resolveRotationKey` (dal catalogo nutrition_menu_foods): le righe `meal_item`
 * portano solo canonical_key, e per i cibi NUOVI del catalogo la costante hardcoded non
 * conosce la rotation key — senza resolver conterebbero come chiave singola invece che
 * come famiglia (es. carb:riso).
 */
export async function loadWeeklyStapleCountsFromDb(
  db: SupabaseClient,
  athleteId: string,
  planDate: string,
  opts?: { resolveRotationKey?: (canonicalKey: string) => string | undefined },
): Promise<Record<string, number>> {
  try {
    const { start, end } = isoWeekRangeForDate(planDate);
    const query = (cols: string) =>
      db
        .from("nutrition_plan")
        .select(`plan_date, meal(meal_item(${cols}))`)
        .eq("athlete_id", athleteId)
        .gte("plan_date", start)
        .lte("plan_date", end)
        .neq("plan_date", planDate);
    // `recipe_key` (grammatica dei pasti): le righe-ingrediente di una ricetta portano la
    // ricetta madre, che conta come famiglia settimanale a sé (`recipe:<key>`). Cintura
    // rollout: se la colonna non è ancora migrata, si rilegge senza (memoria come prima).
    let { data, error } = await query("canonical_key, recipe_key");
    if (error && /recipe_key/i.test(error.message ?? "")) {
      ({ data, error } = await query("canonical_key"));
    }
    if (error || !Array.isArray(data)) return {};

    const counts: Record<string, number> = {};
    for (const row of data as WeekPlanRow[]) {
      const meals = Array.isArray(row?.meal) ? row.meal : [];
      const items = meals.flatMap((m) => (Array.isArray(m?.meal_item) ? m.meal_item : []));
      const dayKeys = new Set(
        mealRotationStaplesFromComposedItems(
          items.map((it) => ({ canonicalKey: typeof it?.canonical_key === "string" ? it.canonical_key : null })),
          opts?.resolveRotationKey,
        ),
      );
      for (const it of items) {
        if (typeof it?.recipe_key === "string" && it.recipe_key.trim()) {
          dayKeys.add(`${RECIPE_ROTATION_PREFIX}${it.recipe_key.trim()}`);
        }
      }
      for (const k of dayKeys) counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}
