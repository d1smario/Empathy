/**
 * Ruoli e punteggi per pasto di un alimento del menù (`nutrition_menu_food_meal_roles`):
 * validazione PURA del body admin + default «dai pool» per gli alimenti senza riga di score.
 *
 * PERCHÉ un modulo a parte, senza Supabase né React: la stessa funzione è usata dalla
 * API (PATCH/POST /api/admin/menu-foods) e testata da sola; i set di valori ammessi sono
 * IDENTICI ai CHECK del DB e a quelli che il loader del motore
 * (`lib/nutrition/v2/menu-food-catalog-db.ts`, `parseMenuFoodMealRoleRow`) riconosce: la
 * UI non deve poter scrivere nulla che il motore poi scarterebbe in silenzio (il test
 * confronta i set).
 */

export const MENU_FOOD_MEAL_ROLES = [
  "CHO_PRIMARY",
  "CHO_SECONDARY",
  "PRO_PRIMARY",
  "PRO_SECONDARY",
  "FAT_COMPLEMENT",
  "FIBER_VEG",
  "FIBER_MICRO_PRIMARY",
  "MIXED",
  "COMPOSITE_MAIN",
  "EXCLUDE",
  "NONE",
] as const;
export type MenuFoodMealRoleValue = (typeof MENU_FOOD_MEAL_ROLES)[number];

export const MENU_FOOD_MACRO_ROLES = [
  "CHO_PRIMARY",
  "CHO_SECONDARY",
  "PRO_PRIMARY",
  "PRO_SECONDARY",
  "FAT_PRIMARY",
  "FIBER_MICRO",
  "MIXED",
  "PRO_FAT_MIXED",
] as const;
export type MenuFoodMacroRoleValue = (typeof MENU_FOOD_MACRO_ROLES)[number];

export const MENU_FOOD_FREQUENCIES = ["COMMON", "ROTATION", "OCCASIONAL"] as const;
export type MenuFoodFrequencyValue = (typeof MENU_FOOD_FREQUENCIES)[number];

const MEAL_ROLE_SET: ReadonlySet<string> = new Set(MENU_FOOD_MEAL_ROLES);
const MACRO_ROLE_SET: ReadonlySet<string> = new Set(MENU_FOOD_MACRO_ROLES);
const FREQUENCY_SET: ReadonlySet<string> = new Set(MENU_FOOD_FREQUENCIES);

/** I 4 pasti con un ruolo di composizione (pre/post workout hanno solo lo score). */
export const MENU_FOOD_ROLE_MEALS = ["breakfast", "snack", "lunch", "dinner"] as const;
export type MenuFoodRoleMealKey = (typeof MENU_FOOD_ROLE_MEALS)[number];

/** Shape canonica (colonne DB, senza canonical_key/source_version/updated_at). */
export type MenuFoodMealRolesInput = {
  score_breakfast: number;
  score_snack: number;
  score_lunch: number;
  score_dinner: number;
  score_pre_workout: number;
  score_post_workout: number;
  role_breakfast: MenuFoodMealRoleValue;
  role_snack: MenuFoodMealRoleValue;
  role_lunch: MenuFoodMealRoleValue;
  role_dinner: MenuFoodMealRoleValue;
  macro_role: MenuFoodMacroRoleValue;
  frequency: MenuFoodFrequencyValue;
  max_week: number | null;
  prep_speed: number | null;
};

export const MENU_FOOD_SCORE_FIELDS = [
  "score_breakfast",
  "score_snack",
  "score_lunch",
  "score_dinner",
  "score_pre_workout",
  "score_post_workout",
] as const;
export const MENU_FOOD_ROLE_FIELDS = ["role_breakfast", "role_snack", "role_lunch", "role_dinner"] as const;

export type MealRolesValidation =
  | { ok: true; value: MenuFoodMealRolesInput }
  | { ok: false; error: string };

function toNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Score 0-10 con al più UNA cifra decimale (colonna numeric(3,1)): arrotondiamo noi a
 * 0,1 così «7,25» non viene rifiutato dal DB con un errore criptico ma diventa 7,3.
 */
function parseScore(field: string, v: unknown): { n: number } | { error: string } {
  const n = toNumber(v);
  if (n == null) return { error: `${field}: deve essere un numero 0-10.` };
  if (n < 0 || n > 10) return { error: `${field}: fuori intervallo (0-10), ricevuto ${n}.` };
  return { n: Math.round(n * 10) / 10 };
}

/**
 * Valida l'oggetto `meal_roles` di un body admin. Tutti i campi score/ruolo/macro_role/
 * frequency sono OBBLIGATORI (è un upsert della riga intera: un upsert parziale
 * azzererebbe via default ciò che non è passato, meglio rifiutare che sorprendere);
 * max_week e prep_speed sono null-abili. Ruoli e frequenza sono case-insensitive in
 * ingresso ma normalizzati in MAIUSCOLO (come i CHECK).
 */
export function validateMenuFoodMealRoles(raw: unknown): MealRolesValidation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "meal_roles: deve essere un oggetto." };
  }
  const r = raw as Record<string, unknown>;
  const out: Partial<MenuFoodMealRolesInput> = {};

  for (const field of MENU_FOOD_SCORE_FIELDS) {
    const parsed = parseScore(field, r[field]);
    if ("error" in parsed) return { ok: false, error: parsed.error };
    out[field] = parsed.n;
  }

  for (const field of MENU_FOOD_ROLE_FIELDS) {
    const v = typeof r[field] === "string" ? r[field].trim().toUpperCase() : "";
    if (!MEAL_ROLE_SET.has(v)) {
      return { ok: false, error: `${field}: "${String(r[field])}" non è un ruolo valido.` };
    }
    out[field] = v as MenuFoodMealRoleValue;
  }

  const macro = typeof r.macro_role === "string" ? r.macro_role.trim().toUpperCase() : "";
  if (!MACRO_ROLE_SET.has(macro)) {
    return { ok: false, error: `macro_role: "${String(r.macro_role)}" non è un ruolo macro valido.` };
  }
  out.macro_role = macro as MenuFoodMacroRoleValue;

  const freq = typeof r.frequency === "string" ? r.frequency.trim().toUpperCase() : "";
  if (!FREQUENCY_SET.has(freq)) {
    return { ok: false, error: `frequency: "${String(r.frequency)}" non valida (COMMON|ROTATION|OCCASIONAL).` };
  }
  out.frequency = freq as MenuFoodFrequencyValue;

  // max_week: intero 1-7 oppure null ("" dalla UI = null).
  if (r.max_week == null || r.max_week === "") {
    out.max_week = null;
  } else {
    const n = toNumber(r.max_week);
    if (n == null || !Number.isInteger(n) || n < 1 || n > 7) {
      return { ok: false, error: `max_week: deve essere un intero 1-7 o vuoto, ricevuto ${String(r.max_week)}.` };
    }
    out.max_week = n;
  }

  // prep_speed: intero 0-10 oppure null.
  if (r.prep_speed == null || r.prep_speed === "") {
    out.prep_speed = null;
  } else {
    const n = toNumber(r.prep_speed);
    if (n == null || !Number.isInteger(n) || n < 0 || n > 10) {
      return { ok: false, error: `prep_speed: deve essere un intero 0-10 o vuoto, ricevuto ${String(r.prep_speed)}.` };
    }
    out.prep_speed = n;
  }

  return { ok: true, value: out as MenuFoodMealRolesInput };
}

/**
 * Default «ragionevoli» per un alimento SENZA riga di score, derivati dai pool del
 * catalogo. Regola decisa col proprietario: i pool coperti danno ruolo+score 10 al pasto
 * corrispondente; i pasti NON coperti da alcun pool → EXCLUDE / 0 (l'alimento non entra).
 * La mappa pool→ruolo riflette la moda osservata sui 492 alimenti di Mario v5
 * (lunch_veg/dinner_veg → FIBER_MICRO_PRIMARY, breakfast_fat → FAT_COMPLEMENT, ecc.).
 * Il macro_role è il primo pool in ordine di «forza» (pro > carb/cho > fat > veg).
 * Funzione PURA: stessa uscita per stessi pool, qualunque sia l'ordine in ingresso.
 */
export function defaultMealRolesFromPools(poolKeys: readonly string[]): MenuFoodMealRolesInput {
  const pools = new Set(poolKeys);
  const out: MenuFoodMealRolesInput = {
    score_breakfast: 0,
    score_snack: 0,
    score_lunch: 0,
    score_dinner: 0,
    score_pre_workout: 0,
    score_post_workout: 0,
    role_breakfast: "EXCLUDE",
    role_snack: "EXCLUDE",
    role_lunch: "EXCLUDE",
    role_dinner: "EXCLUDE",
    macro_role: "MIXED",
    frequency: "COMMON",
    max_week: null,
    prep_speed: null,
  };

  // Per pasto: primo pool «vincente» in ordine di priorità (pro batte carb batte fat/veg).
  const assign = (
    meal: MenuFoodRoleMealKey,
    candidates: readonly [pool: string, role: MenuFoodMealRoleValue][],
  ) => {
    for (const [pool, role] of candidates) {
      if (pools.has(pool)) {
        out[`role_${meal}`] = role;
        out[`score_${meal}`] = 10;
        return;
      }
    }
  };
  assign("breakfast", [
    ["breakfast_pro", "PRO_PRIMARY"],
    ["breakfast_cho", "CHO_PRIMARY"],
    ["breakfast_fat", "FAT_COMPLEMENT"],
  ]);
  assign("snack", [
    ["snack_pro", "PRO_PRIMARY"],
    ["snack_cho", "CHO_PRIMARY"],
  ]);
  assign("lunch", [
    ["lunch_pro", "PRO_PRIMARY"],
    ["lunch_carb", "CHO_PRIMARY"],
    ["lunch_veg", "FIBER_MICRO_PRIMARY"],
  ]);
  assign("dinner", [
    ["dinner_pro", "PRO_PRIMARY"],
    ["dinner_carb", "CHO_PRIMARY"],
    ["dinner_veg", "FIBER_MICRO_PRIMARY"],
  ]);

  // Macro role dominante dai pool (stessa gerarchia).
  const hasAny = (...keys: string[]) => keys.some((k) => pools.has(k));
  if (hasAny("lunch_pro", "dinner_pro", "breakfast_pro", "snack_pro")) out.macro_role = "PRO_PRIMARY";
  else if (hasAny("lunch_carb", "dinner_carb", "breakfast_cho")) out.macro_role = "CHO_PRIMARY";
  else if (hasAny("snack_cho")) out.macro_role = "CHO_SECONDARY";
  else if (hasAny("breakfast_fat")) out.macro_role = "FAT_PRIMARY";
  else if (hasAny("lunch_veg", "dinner_veg")) out.macro_role = "FIBER_MICRO";

  return out;
}
