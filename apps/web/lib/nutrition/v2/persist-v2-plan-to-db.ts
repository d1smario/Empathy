import type { SupabaseClient } from "@supabase/supabase-js";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { fdcIdForCanonicalKey } from "@/lib/nutrition/canonical-food-fdc-aliases";
import type { MealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";
import { MEAL_SLOT_ASSEMBLY } from "@/lib/nutrition/v2/meal-slot-assembly-spec";

/**
 * Persiste il piano V2 (compositore deterministico) nelle tabelle canoniche
 * `nutrition_plan` → `meal` → `meal_item`, così che siano l'UNICA fonte di verità
 * letta sia dalla pagina Nutrizione sia dalla vista Oggi (loadTodayPersistedMeals).
 *
 * Il motore V2 è deterministico per (atleta, data) — seed dalla plan_date — quindi
 * ricomporre e ripersistere produce lo stesso piano: qui facciamo REPLACE (delete
 * a cascata + insert) per il giorno. Richiede il client service-role (RLS senza
 * policy utente su queste tabelle). Best-effort: l'errore non deve rompere la POST.
 */
export type PersistV2PlanResult = { ok: true; planId: string } | { ok: false; error: string };

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function persistV2PlanToDb(
  admin: SupabaseClient,
  athleteId: string,
  planDate: string,
  production: MealPlanV2Production,
  opts?: { hydrationMlTarget?: number | null; goal?: string | null },
): Promise<PersistV2PlanResult> {
  const slots = production.composedMealPlan.filter((s) => s.items.length > 0);
  if (slots.length === 0) return { ok: false, error: "Piano V2 senza pasti da persistere" };

  // REPLACE per data: la cascata pulisce meal/meal_item collegati.
  const { error: delErr } = await admin
    .from("nutrition_plan")
    .delete()
    .eq("athlete_id", athleteId)
    .eq("plan_date", planDate);
  if (delErr) return { ok: false, error: `delete piano: ${delErr.message}` };

  const planTotals = slots.reduce(
    (acc, s) => {
      acc.kcal += num(s.totals.kcal);
      acc.cho += num(s.totals.choG);
      acc.pro += num(s.totals.proG);
      acc.fat += num(s.totals.fatG);
      return acc;
    },
    { kcal: 0, cho: 0, pro: 0, fat: 0 },
  );

  const { data: planRow, error: planErr } = await admin
    .from("nutrition_plan")
    .insert({
      athlete_id: athleteId,
      plan_date: planDate,
      algorithm_version: production.algorithmVersion,
      goal: opts?.goal ?? null,
      meal_count: slots.length,
      kcal_target: Math.round(planTotals.kcal),
      carbs_g_target: Math.round(planTotals.cho),
      protein_g_target: Math.round(planTotals.pro),
      fat_g_target: Math.round(planTotals.fat),
      hydration_ml_target: opts?.hydrationMlTarget ?? null,
    })
    .select("id")
    .single();
  if (planErr || !planRow?.id) return { ok: false, error: `insert piano: ${planErr?.message ?? "no id"}` };
  const planId = String(planRow.id);

  // Insert pasti (uno per slot) e mappa slot → meal_id.
  const mealPayload = slots.map((s, idx) => ({
    plan_id: planId,
    slot: s.slot,
    slot_order: idx + 1,
    kcal_target: Math.round(num(s.totals.kcal)),
    carbs_g_target: Math.round(num(s.totals.choG)),
    protein_g_target: Math.round(num(s.totals.proG)),
    fat_g_target: Math.round(num(s.totals.fatG)),
  }));
  const { data: mealRows, error: mealErr } = await admin.from("meal").insert(mealPayload).select("id, slot");
  if (mealErr || !mealRows?.length) return { ok: false, error: `insert pasti: ${mealErr?.message ?? "no rows"}` };
  const mealIdBySlot = new Map<string, string>();
  for (const row of mealRows as Array<{ id: string; slot: string }>) mealIdBySlot.set(row.slot, String(row.id));

  // Insert voci (cibi reali con fdc_id, ruolo alimentare, grammi, macro).
  const itemPayload: Array<Record<string, unknown>> = [];
  for (const s of slots) {
    const mealId = mealIdBySlot.get(s.slot);
    if (!mealId) continue;
    const roles = MEAL_SLOT_ASSEMBLY[s.slot as MealSlotKey] ?? [];
    s.items.forEach((it, i) => {
      const fdcId = it.fdcId > 0 ? it.fdcId : it.canonicalKey ? fdcIdForCanonicalKey(it.canonicalKey) : null;
      if (!fdcId || fdcId <= 0) return; // meal_item.fdc_id è obbligatorio
      const foodRole = roles[i]?.foodRole ?? roles[roles.length - 1]?.foodRole ?? "cho_simple";
      itemPayload.push({
        meal_id: mealId,
        fdc_id: fdcId,
        food_role: foodRole,
        grams: Math.round(num(it.grams)),
        kcal: Math.round(num(it.kcal)),
        carbs_g: num(it.choG),
        protein_g: num(it.proG),
        fat_g: num(it.fatG),
      });
    });
  }
  if (itemPayload.length > 0) {
    const { error: itemErr } = await admin.from("meal_item").insert(itemPayload);
    if (itemErr) return { ok: false, error: `insert voci: ${itemErr.message}` };
  }

  return { ok: true, planId };
}
