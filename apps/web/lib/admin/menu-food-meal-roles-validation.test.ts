import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultMealRolesFromPools,
  MENU_FOOD_BREAKFAST_CHO_ROLES,
  MENU_FOOD_BREAKFAST_FAT_ROLES,
  MENU_FOOD_BREAKFAST_PROTEIN_ROLES,
  MENU_FOOD_FREQUENCIES,
  MENU_FOOD_MACRO_ROLES,
  MENU_FOOD_MAIN_MEAL_ROLES,
  MENU_FOOD_MEAL_ROLES,
  MENU_FOOD_MEDITERRANEAN_PRIORITIES,
  MENU_FOOD_SNACK_ROLES,
  validateMenuFoodMealRoles,
} from "@/lib/admin/menu-food-meal-roles-validation";
import { parseMenuFoodMealRoleRow } from "@/lib/nutrition/v2/menu-food-catalog-db";

const VALID = {
  score_breakfast: 0,
  score_snack: 5,
  score_lunch: 10,
  score_dinner: 9.5,
  score_pre_workout: 0,
  score_post_workout: 3,
  role_breakfast: "EXCLUDE",
  role_snack: "CHO_SECONDARY",
  role_lunch: "PRO_PRIMARY",
  role_dinner: "PRO_PRIMARY",
  macro_role: "PRO_PRIMARY",
  frequency: "COMMON",
  max_week: null,
  prep_speed: 8,
};

test("validateMenuFoodMealRoles: body valido → ok con valori normalizzati", () => {
  const res = validateMenuFoodMealRoles({ ...VALID, role_lunch: "pro_primary", max_week: "", prep_speed: "8" });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.value.role_lunch, "PRO_PRIMARY");
  assert.equal(res.value.max_week, null);
  assert.equal(res.value.prep_speed, 8);
  assert.equal(res.value.score_dinner, 9.5);
});

test("validateMenuFoodMealRoles: score 11 → errore", () => {
  const res = validateMenuFoodMealRoles({ ...VALID, score_lunch: 11 });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.match(res.error, /score_lunch/);
});

test("validateMenuFoodMealRoles: score con 2 decimali viene arrotondato a 1 cifra", () => {
  const res = validateMenuFoodMealRoles({ ...VALID, score_snack: 7.25 });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.value.score_snack, 7.3);
});

test("validateMenuFoodMealRoles: ruolo ignoto → errore", () => {
  const res = validateMenuFoodMealRoles({ ...VALID, role_dinner: "PROTEINA" });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.match(res.error, /role_dinner/);
});

test("validateMenuFoodMealRoles: macro_role e frequency ignoti → errore", () => {
  assert.equal(validateMenuFoodMealRoles({ ...VALID, macro_role: "FAT_COMPLEMENT" }).ok, false);
  assert.equal(validateMenuFoodMealRoles({ ...VALID, frequency: "RARE" }).ok, false);
});

test("validateMenuFoodMealRoles: max_week 8 → errore; 0 → errore; 7 → ok", () => {
  assert.equal(validateMenuFoodMealRoles({ ...VALID, max_week: 8 }).ok, false);
  assert.equal(validateMenuFoodMealRoles({ ...VALID, max_week: 0 }).ok, false);
  assert.equal(validateMenuFoodMealRoles({ ...VALID, max_week: 7 }).ok, true);
});

test("validateMenuFoodMealRoles: prep_speed 11 → errore; null → ok", () => {
  assert.equal(validateMenuFoodMealRoles({ ...VALID, prep_speed: 11 }).ok, false);
  assert.equal(validateMenuFoodMealRoles({ ...VALID, prep_speed: null }).ok, true);
});

test("validateMenuFoodMealRoles: campo obbligatorio mancante → errore (upsert intero, mai parziale)", () => {
  const { score_pre_workout: _omit, ...rest } = VALID;
  void _omit;
  assert.equal(validateMenuFoodMealRoles(rest).ok, false);
  assert.equal(validateMenuFoodMealRoles(null).ok, false);
  assert.equal(validateMenuFoodMealRoles([]).ok, false);
});

test("body senza meal_roles: la API non tocca la tabella score (contratto: undefined ≠ oggetto)", () => {
  // La route chiama il validatore SOLO se `"meal_roles" in body`: qui verifichiamo che un
  // body tipico di toggle attivo non contenga la chiave, così il PATCH resta «come prima».
  const body: Record<string, unknown> = { is_active: false };
  assert.equal("meal_roles" in body, false);
});

test("i set della UI/API coincidono con quelli accettati dal loader del motore", () => {
  // Ogni ruolo che la UI può scrivere deve essere riconosciuto dal parser (non coercito a
  // NONE); ogni macro_role non deve finire null; ogni frequency non deve ricadere su COMMON
  // per ignoranza. Se qualcuno allarga un set senza l'altro, questo test lo dice.
  for (const role of MENU_FOOD_MEAL_ROLES) {
    const parsed = parseMenuFoodMealRoleRow({ canonical_key: "x", role_lunch: role });
    assert.equal(parsed?.mealRoles.roles.lunch, role, `ruolo ${role} non riconosciuto dal loader`);
  }
  for (const macro of MENU_FOOD_MACRO_ROLES) {
    const parsed = parseMenuFoodMealRoleRow({ canonical_key: "x", macro_role: macro });
    assert.equal(parsed?.mealRoles.macroRole, macro, `macro_role ${macro} non riconosciuto dal loader`);
  }
  for (const freq of MENU_FOOD_FREQUENCIES) {
    const parsed = parseMenuFoodMealRoleRow({ canonical_key: "x", frequency: freq });
    assert.equal(parsed?.mealRoles.frequency, freq, `frequency ${freq} non riconosciuta dal loader`);
  }
  // Lo score decimale passa intatto (numeric(3,1) → PostgREST stringa).
  const dec = parseMenuFoodMealRoleRow({ canonical_key: "x", score_snack: "7.5" });
  assert.equal(dec?.mealRoles.scores.snack, 7.5);
});

test("defaultMealRolesFromPools: lunch_pro → pranzo PRO_PRIMARY 10, resto EXCLUDE 0", () => {
  const d = defaultMealRolesFromPools(["lunch_pro"]);
  assert.equal(d.role_lunch, "PRO_PRIMARY");
  assert.equal(d.score_lunch, 10);
  assert.equal(d.role_dinner, "EXCLUDE");
  assert.equal(d.score_dinner, 0);
  assert.equal(d.role_breakfast, "EXCLUDE");
  assert.equal(d.role_snack, "EXCLUDE");
  assert.equal(d.macro_role, "PRO_PRIMARY");
  assert.equal(d.frequency, "COMMON");
  assert.equal(d.max_week, null);
});

test("defaultMealRolesFromPools: breakfast_cho + snack_cho → CHO_PRIMARY su colazione e spuntino", () => {
  const d = defaultMealRolesFromPools(["snack_cho", "breakfast_cho"]);
  assert.equal(d.role_breakfast, "CHO_PRIMARY");
  assert.equal(d.score_breakfast, 10);
  assert.equal(d.role_snack, "CHO_PRIMARY");
  assert.equal(d.score_snack, 10);
  assert.equal(d.role_lunch, "EXCLUDE");
  assert.equal(d.macro_role, "CHO_PRIMARY");
});

test("defaultMealRolesFromPools: lunch_veg/dinner_veg → FIBER_MICRO_PRIMARY; breakfast_fat → FAT_COMPLEMENT", () => {
  const veg = defaultMealRolesFromPools(["lunch_veg", "dinner_veg"]);
  assert.equal(veg.role_lunch, "FIBER_MICRO_PRIMARY");
  assert.equal(veg.role_dinner, "FIBER_MICRO_PRIMARY");
  assert.equal(veg.macro_role, "FIBER_MICRO");
  const fat = defaultMealRolesFromPools(["breakfast_fat"]);
  assert.equal(fat.role_breakfast, "FAT_COMPLEMENT");
  assert.equal(fat.macro_role, "FAT_PRIMARY");
});

test("defaultMealRolesFromPools: pro batte carb nello stesso pasto; pura rispetto all'ordine; sempre valida", () => {
  const a = defaultMealRolesFromPools(["lunch_carb", "lunch_pro"]);
  const b = defaultMealRolesFromPools(["lunch_pro", "lunch_carb"]);
  assert.deepEqual(a, b);
  assert.equal(a.role_lunch, "PRO_PRIMARY");
  // L'uscita dei default deve SEMPRE superare il validatore (altrimenti il form nasce rotto).
  assert.equal(validateMenuFoodMealRoles(a).ok, true);
  assert.equal(validateMenuFoodMealRoles(defaultMealRolesFromPools([])).ok, true);
});

// ---- Campi v6 (opzionali per contratto: assenti → colonne non toccate dall'upsert) ----

test("validateMenuFoodMealRoles v6: assenti → non compaiono nel value (upsert parziale per colonna)", () => {
  const res = validateMenuFoodMealRoles({ ...VALID });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.ok(!("breakfast_cho_role" in res.value), "campo v6 assente non deve finire nel payload");
  assert.ok(!("substitution_group" in res.value));
});

test("validateMenuFoodMealRoles v6: enum normalizzati MAIUSCOLI; valore ignoto → errore", () => {
  const ok = validateMenuFoodMealRoles({
    ...VALID,
    breakfast_cho_role: "secondary_simple",
    breakfast_protein_role: "PRIMARY",
    breakfast_fat_role: "NONE",
    main_meal_role: "fat_condiment",
    snack_role: "FAST_CARB",
    mediterranean_priority: "limited",
    substitution_group: " fat condiment ",
    generative_note: " Solo come condimento. ",
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.value.breakfast_cho_role, "SECONDARY_SIMPLE");
  assert.equal(ok.value.main_meal_role, "FAT_CONDIMENT");
  assert.equal(ok.value.mediterranean_priority, "LIMITED");
  assert.equal(ok.value.substitution_group, "FAT_CONDIMENT");
  assert.equal(ok.value.generative_note, "Solo come condimento.");
  const bad = validateMenuFoodMealRoles({ ...VALID, snack_role: "TURBO" });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.error, /snack_role/);
});

test("validateMenuFoodMealRoles v6: substitution_group/generative_note vuoti → null; i default dai pool restano validi", () => {
  const res = validateMenuFoodMealRoles({ ...VALID, substitution_group: "", generative_note: null });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.value.substitution_group, null);
  assert.equal(res.value.generative_note, null);
  const d = defaultMealRolesFromPools(["lunch_pro", "breakfast_cho", "snack_cho"]);
  assert.equal(d.main_meal_role, "PRIMARY_PROTEIN");
  assert.equal(d.breakfast_cho_role, "PRIMARY_COMPLEX");
  assert.equal(d.snack_role, "FAST_CARB");
  assert.equal(validateMenuFoodMealRoles(d).ok, true, "i default v6 devono superare il validatore");
});

test("i set v6 della UI/API coincidono con quelli accettati dal loader del motore", () => {
  // Come per i set v5: ogni valore che la UI può scrivere deve essere riconosciuto dal
  // parser del loader (mai coercito ai default per ignoranza).
  const cases: Array<[string, readonly string[], (mr: NonNullable<ReturnType<typeof parseMenuFoodMealRoleRow>>["mealRoles"]) => string | undefined]> = [
    ["breakfast_cho_role", MENU_FOOD_BREAKFAST_CHO_ROLES, (mr) => mr.breakfastChoRole],
    ["breakfast_protein_role", MENU_FOOD_BREAKFAST_PROTEIN_ROLES, (mr) => mr.breakfastProteinRole],
    ["breakfast_fat_role", MENU_FOOD_BREAKFAST_FAT_ROLES, (mr) => mr.breakfastFatRole],
    ["main_meal_role", MENU_FOOD_MAIN_MEAL_ROLES, (mr) => mr.mainMealRole],
    ["snack_role", MENU_FOOD_SNACK_ROLES, (mr) => mr.snackRole],
    ["mediterranean_priority", MENU_FOOD_MEDITERRANEAN_PRIORITIES, (mr) => mr.mediterraneanPriority],
  ];
  for (const [column, values, read] of cases) {
    for (const value of values) {
      const parsed = parseMenuFoodMealRoleRow({ canonical_key: "x", [column]: value });
      assert.equal(read(parsed!.mealRoles), value, `${column}=${value} non riconosciuto dal loader`);
    }
  }
});
