import type { SupabaseClient } from "@supabase/supabase-js";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { MEAL_SLOT_KEYS } from "@/lib/nutrition/intelligent-meal-plan-types";
import { fdcDescriptionToLabelIt } from "@/lib/nutrition/v2/fdc-food-label-it";

/**
 * Ruolo macro sintetico per la UI (colore/icona fallback quando manca l'immagine).
 * Allineato a `macroRoleFromDbFoodRole` di /api/nutrition/intelligent-meal-plan.
 */
export type TodayPlannedFoodMacroRole = "cho_heavy" | "protein" | "fat" | "veg" | "mixed";

export type TodayPlannedFood = {
  fdcId: number | null;
  label: string;
  grams: number;
  kcal: number;
  macroRole: TodayPlannedFoodMacroRole;
  imageUrl: string | null;
};

export type TodayPlannedMealSlot = {
  slot: MealSlotKey;
  slotOrder: number;
  /** Orario del pasto se il motore l'ha persistito su `meal.scheduled_time` (spesso null). */
  scheduledTime: string | null;
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  foods: TodayPlannedFood[];
};

type MealRow = {
  id: string;
  slot: string;
  slot_order: number | null;
  scheduled_time: string | null;
  kcal_target: number | null;
  carbs_g_target: number | null;
  protein_g_target: number | null;
  fat_g_target: number | null;
};

type MealItemRow = {
  meal_id: string;
  fdc_id: number | null;
  food_role: string | null;
  grams: number | null;
  kcal: number | null;
  carbs_g: number | null;
  protein_g: number | null;
  fat_g: number | null;
};

const MEAL_SLOT_KEY_SET = new Set<string>(MEAL_SLOT_KEYS);

function isMealSlotKey(s: string): s is MealSlotKey {
  return MEAL_SLOT_KEY_SET.has(s);
}

function macroRoleFromFoodRole(role: string | null): TodayPlannedFoodMacroRole {
  switch (role) {
    case "cho_complex":
    case "cho_simple":
      return "cho_heavy";
    case "protein_primary":
    case "protein_secondary":
      return "protein";
    case "fat":
    case "fat_condiment":
      return "fat";
    case "veg_condiment":
      return "veg";
    default:
      return "mixed";
  }
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeHhMm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
}

/**
 * Legge il piano pasti PERSISTITO dal motore DB (`nutrition_plan` → `meal` → `meal_item`)
 * per un atleta e una data, con nomi/immagini alimento da `fdc_food`.
 *
 * Richiede il client service-role: su queste tabelle non c'è policy RLS per l'utente
 * (stesso vincolo di /api/nutrition/intelligent-meal-plan). Ritorna `[]` se non esiste
 * un piano persistito per quel giorno — la vista Oggi ripiega sul solver macro.
 */
export async function loadTodayPersistedMeals(
  admin: SupabaseClient,
  athleteId: string,
  dateKey: string,
): Promise<TodayPlannedMealSlot[]> {
  const { data: planRow } = await admin
    .from("nutrition_plan")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("plan_date", dateKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const planId = planRow?.id ? String(planRow.id) : null;
  if (!planId) return [];

  const { data: mealRows } = await admin
    .from("meal")
    .select("id, slot, slot_order, scheduled_time, kcal_target, carbs_g_target, protein_g_target, fat_g_target")
    .eq("plan_id", planId)
    .order("slot_order", { ascending: true });
  const meals = (mealRows ?? []) as MealRow[];
  if (!meals.length) return [];

  const { data: itemRows } = await admin
    .from("meal_item")
    .select("meal_id, fdc_id, food_role, grams, kcal, carbs_g, protein_g, fat_g")
    .in(
      "meal_id",
      meals.map((m) => m.id),
    );
  const items = (itemRows ?? []) as MealItemRow[];

  const fdcIds = [
    ...new Set(items.map((i) => i.fdc_id).filter((id): id is number => typeof id === "number" && Number.isFinite(id))),
  ];
  const foodByFdc = new Map<number, { label: string; imageUrl: string | null }>();
  if (fdcIds.length) {
    const { data: foodRows } = await admin
      .from("fdc_food")
      .select("fdc_id, description, image_url")
      .in("fdc_id", fdcIds);
    for (const row of (foodRows ?? []) as Array<{ fdc_id: number; description: string | null; image_url: string | null }>) {
      if (row.description) {
        // Etichetta italiana come la pagina Nutrizione (stessa fonte, un solo sistema).
        foodByFdc.set(Number(row.fdc_id), {
          label: fdcDescriptionToLabelIt(row.description),
          imageUrl: typeof row.image_url === "string" && row.image_url.trim() !== "" ? row.image_url : null,
        });
      }
    }
  }

  const itemsByMeal = new Map<string, MealItemRow[]>();
  for (const it of items) {
    const list = itemsByMeal.get(it.meal_id) ?? [];
    list.push(it);
    itemsByMeal.set(it.meal_id, list);
  }

  const out: TodayPlannedMealSlot[] = [];
  for (const meal of meals) {
    if (!isMealSlotKey(meal.slot)) continue;
    const mealItems = itemsByMeal.get(meal.id) ?? [];
    const foods: TodayPlannedFood[] = mealItems.map((it) => {
      const fdcId = typeof it.fdc_id === "number" && Number.isFinite(it.fdc_id) ? it.fdc_id : null;
      const resolved = fdcId != null ? foodByFdc.get(fdcId) : undefined;
      return {
        fdcId,
        label: resolved?.label ?? (fdcId != null ? `Alimento FDC ${fdcId}` : "Alimento"),
        grams: Math.round(num(it.grams)),
        kcal: Math.round(num(it.kcal)),
        macroRole: macroRoleFromFoodRole(it.food_role),
        imageUrl: resolved?.imageUrl ?? null,
      };
    });
    // Macro reali del pasto = somma delle voci (fallback ai target del pasto se vuoto).
    const sum = mealItems.reduce(
      (acc, it) => {
        acc.kcal += num(it.kcal);
        acc.carbs += num(it.carbs_g);
        acc.protein += num(it.protein_g);
        acc.fat += num(it.fat_g);
        return acc;
      },
      { kcal: 0, carbs: 0, protein: 0, fat: 0 },
    );
    out.push({
      slot: meal.slot,
      slotOrder: typeof meal.slot_order === "number" ? meal.slot_order : out.length + 1,
      scheduledTime: normalizeHhMm(meal.scheduled_time),
      kcal: Math.round(mealItems.length ? sum.kcal : num(meal.kcal_target)),
      carbsG: Math.round(mealItems.length ? sum.carbs : num(meal.carbs_g_target)),
      proteinG: Math.round(mealItems.length ? sum.protein : num(meal.protein_g_target)),
      fatG: Math.round(mealItems.length ? sum.fat : num(meal.fat_g_target)),
      foods,
    });
  }
  return out;
}
