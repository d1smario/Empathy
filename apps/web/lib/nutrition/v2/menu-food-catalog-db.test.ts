import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadMenuFoodPools,
  mapMenuFoodRows,
  mealRolesHasV6,
  menuRotationKeyResolver,
  parseMenuFoodMealRoleRow,
  resetMenuFoodPoolsCacheForTests,
} from "@/lib/nutrition/v2/menu-food-catalog-db";

function menuRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    canonical_key: "rice_dry",
    fdc_id: 169756,
    label_it: "Riso",
    serving_basis: "dry_grams",
    pool_keys: ["lunch_carb"],
    rotation_key: "carb:riso",
    carb_family: "carb_starch",
    is_meat: false,
    is_fish: false,
    is_animal_product: false,
    sort_priority: 100,
    ...overrides,
  };
}

const macroRow = (fdcId: number, kcal = 360, carbs = 79, protein = 7, fat = 0.6) => ({
  fdc_id: fdcId,
  kcal_100g: kcal,
  carbs_100g: carbs,
  protein_100g: protein,
  fat_100g: fat,
});

test("mapMenuFoodRows: mapping righe DB → entry con macro, flag e pool multipli", () => {
  const pools = mapMenuFoodRows(
    [
      menuRow({ canonical_key: "pasta_dry", fdc_id: 1, label_it: "Pasta di semola", rotation_key: "carb:pasta", pool_keys: ["lunch_carb", "dinner_carb"] }),
      menuRow({ canonical_key: "chicken_breast", fdc_id: 2, label_it: "Petto di pollo", serving_basis: "dry_grams", pool_keys: ["lunch_pro"], rotation_key: "prot:pollo", carb_family: null, is_meat: true, is_animal_product: true }),
    ],
    [macroRow(1, 371, 75, 13, 1.5), macroRow(2, 165, 0, 31, 3.6)],
  );
  assert.ok(pools);
  const lunchCarb = pools!.get("lunch_carb")!;
  assert.equal(lunchCarb.length, 1);
  const pasta = lunchCarb[0]!;
  assert.equal(pasta.canonicalKey, "pasta_dry");
  assert.equal(pasta.labelIt, "Pasta di semola");
  assert.equal(pasta.servingBasis, "dry_grams");
  assert.equal(pasta.rotationKey, "carb:pasta");
  assert.equal(pasta.carbFamily, "carb_starch");
  assert.equal(pasta.fdcId, 1);
  assert.equal(pasta.kcalPer100g, 371);
  assert.equal(pasta.carbsPer100g, 75);
  assert.equal(pasta.proteinPer100g, 13);
  assert.equal(pasta.fatPer100g, 1.5);
  // Stesso oggetto in entrambi i pool dichiarati in pool_keys.
  assert.equal(pools!.get("dinner_carb")![0], pasta);
  const pollo = pools!.get("lunch_pro")![0]!;
  assert.equal(pollo.isMeat, true);
  assert.equal(pollo.isFish, false);
  assert.equal(pollo.isAnimalProduct, true);
  assert.equal(pollo.rotationKey, "prot:pollo");
  assert.equal(pollo.carbFamily, undefined);
});

test("mapMenuFoodRows: ordinamento deterministico sort_priority poi canonical_key", () => {
  const pools = mapMenuFoodRows(
    [
      menuRow({ canonical_key: "zzz_last", fdc_id: 1, sort_priority: 100 }),
      menuRow({ canonical_key: "aaa_first", fdc_id: 2, sort_priority: 100 }),
      menuRow({ canonical_key: "bbb_classic", fdc_id: 3, sort_priority: 50 }),
      menuRow({ canonical_key: "mmm_variety", fdc_id: 4, sort_priority: 300 }),
    ],
    [macroRow(1), macroRow(2), macroRow(3), macroRow(4)],
  );
  assert.deepEqual(
    pools!.get("lunch_carb")!.map((e) => e.canonicalKey),
    ["bbb_classic", "aaa_first", "zzz_last", "mmm_variety"],
  );
});

test("mapMenuFoodRows: righe senza macro o malformate escluse; tutto scartato → null", () => {
  const pools = mapMenuFoodRows(
    [
      menuRow({ canonical_key: "with_macro", fdc_id: 1 }),
      menuRow({ canonical_key: "no_macro", fdc_id: 999 }), // nessuna riga fdc → fuori
      menuRow({ canonical_key: null, fdc_id: 1 }), // canonical_key mancante → fuori
      menuRow({ canonical_key: "no_pools", fdc_id: 1, pool_keys: [] }), // nessun pool → fuori
    ],
    [macroRow(1)],
  );
  assert.deepEqual(pools!.get("lunch_carb")!.map((e) => e.canonicalKey), ["with_macro"]);

  assert.equal(mapMenuFoodRows([menuRow({ fdc_id: 999 })], [macroRow(1)]), null);
  assert.equal(mapMenuFoodRows([], []), null);
});

test("mapMenuFoodRows: serving_basis fuori contratto → default dry_grams", () => {
  const pools = mapMenuFoodRows([menuRow({ serving_basis: "cups" })], [macroRow(169756)]);
  assert.equal(pools!.get("lunch_carb")![0]!.servingBasis, "dry_grams");
});

type FakeResult = { data: unknown; error: unknown };

/** Client finto: menu e macro rispondono con i risultati dati; conta le chiamate per tabella. */
function fakeAdmin(menu: FakeResult, fdc: FakeResult, calls?: string[], roles?: FakeResult): SupabaseClient {
  return {
    from(table: string) {
      calls?.push(table);
      const result =
        table === "nutrition_menu_foods"
          ? menu
          : table === "nutrition_menu_food_meal_roles"
            ? (roles ?? { data: [], error: null })
            : fdc;
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.in = () => builder;
      builder.then = (resolve: (v: FakeResult) => void) => resolve(result);
      return builder;
    },
  } as unknown as SupabaseClient;
}

test("loadMenuFoodPools: query fallita o tabella vuota → null, mai throw", async () => {
  resetMenuFoodPoolsCacheForTests();
  assert.equal(await loadMenuFoodPools(fakeAdmin({ data: null, error: { message: "boom" } }, { data: [], error: null })), null);
  resetMenuFoodPoolsCacheForTests();
  assert.equal(await loadMenuFoodPools(fakeAdmin({ data: [], error: null }, { data: [], error: null })), null);
  resetMenuFoodPoolsCacheForTests();
  // Errore sulla query macro → null.
  assert.equal(
    await loadMenuFoodPools(fakeAdmin({ data: [menuRow({})], error: null }, { data: null, error: { message: "boom" } })),
    null,
  );
});

test("loadMenuFoodPools: successo + cache di processo (nessuna seconda query nel TTL)", async () => {
  resetMenuFoodPoolsCacheForTests();
  const calls: string[] = [];
  const admin = fakeAdmin({ data: [menuRow({})], error: null }, { data: [macroRow(169756)], error: null }, calls);
  const pools = await loadMenuFoodPools(admin);
  assert.ok(pools);
  assert.equal(pools!.get("lunch_carb")![0]!.canonicalKey, "rice_dry");
  const callsAfterFirst = calls.length;
  const again = await loadMenuFoodPools(admin);
  assert.equal(again, pools); // stesso oggetto dalla cache
  assert.equal(calls.length, callsAfterFirst); // nessun nuovo round-trip
  resetMenuFoodPoolsCacheForTests();
});

test("menuRotationKeyResolver: canonical → rotation key, undefined per chiavi ignote", () => {
  const pools = mapMenuFoodRows(
    [menuRow({ canonical_key: "rice_black", fdc_id: 1, rotation_key: "carb:riso" }), menuRow({ canonical_key: "no_family", fdc_id: 2, rotation_key: null })],
    [macroRow(1), macroRow(2)],
  )!;
  const resolve = menuRotationKeyResolver(pools);
  assert.equal(resolve("rice_black"), "carb:riso");
  assert.equal(resolve("no_family"), undefined);
  assert.equal(resolve("unknown_key"), undefined);
});

// ---- Grammatica di Mario: score/ruoli per pasto (nutrition_menu_food_meal_roles) ----

function roleRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    canonical_key: "rice_dry",
    // numeric PostgREST → stringhe: il parser deve accettarle.
    score_breakfast: "0",
    score_snack: "0",
    score_lunch: "10",
    score_dinner: "9",
    score_pre_workout: "8",
    score_post_workout: "9",
    role_breakfast: "NONE",
    role_snack: "EXCLUDE",
    role_lunch: "CHO_PRIMARY",
    role_dinner: "CHO_PRIMARY",
    macro_role: "CHO_PRIMARY",
    frequency: "COMMON",
    max_week: 7,
    prep_speed: 6,
    ...overrides,
  };
}

test("parseMenuFoodMealRoleRow: riga completa → score numerici, ruoli (EXCLUDE conservato), frequenza, tetti", () => {
  const parsed = parseMenuFoodMealRoleRow(roleRow({}));
  assert.ok(parsed);
  assert.equal(parsed!.canonicalKey, "rice_dry");
  assert.deepEqual(parsed!.mealRoles.scores, { breakfast: 0, snack: 0, lunch: 10, dinner: 9, preWorkout: 8, postWorkout: 9 });
  assert.deepEqual(parsed!.mealRoles.roles, { breakfast: "NONE", snack: "EXCLUDE", lunch: "CHO_PRIMARY", dinner: "CHO_PRIMARY" });
  assert.equal(parsed!.mealRoles.macroRole, "CHO_PRIMARY");
  assert.equal(parsed!.mealRoles.frequency, "COMMON");
  assert.equal(parsed!.mealRoles.maxWeek, 7);
  assert.equal(parsed!.mealRoles.prepSpeed, 6);
});

test("parseMenuFoodMealRoleRow: score null → 0, fuori range → clamp, ruolo ignoto → NONE, frequenza ignota → COMMON, max_week null", () => {
  const parsed = parseMenuFoodMealRoleRow(
    roleRow({ score_lunch: null, score_dinner: 12, score_snack: -1, role_lunch: "BOH", role_dinner: null, frequency: "weird", macro_role: "nope", max_week: null, prep_speed: null }),
  );
  assert.ok(parsed);
  assert.equal(parsed!.mealRoles.scores.lunch, 0);
  assert.equal(parsed!.mealRoles.scores.dinner, 10);
  assert.equal(parsed!.mealRoles.scores.snack, 0);
  assert.equal(parsed!.mealRoles.roles.lunch, "NONE");
  assert.equal(parsed!.mealRoles.roles.dinner, "NONE");
  assert.equal(parsed!.mealRoles.frequency, "COMMON");
  assert.equal(parsed!.mealRoles.macroRole, null);
  assert.equal(parsed!.mealRoles.maxWeek, null);
  assert.equal(parsed!.mealRoles.prepSpeed, null);
  // Senza canonical_key la riga è inutilizzabile.
  assert.equal(parseMenuFoodMealRoleRow(roleRow({ canonical_key: null })), null);
  assert.equal(parseMenuFoodMealRoleRow(null), null);
});

test("mapMenuFoodRows: mealRoles agganciati per canonical_key; alimento senza riga di score → mealRoles undefined", () => {
  const pools = mapMenuFoodRows(
    [menuRow({ canonical_key: "rice_dry", fdc_id: 1 }), menuRow({ canonical_key: "new_admin_food", fdc_id: 2 })],
    [macroRow(1), macroRow(2)],
    [roleRow({ canonical_key: "rice_dry" }), roleRow({ canonical_key: "orphan_key" })],
  );
  assert.ok(pools);
  const byKey = new Map(pools!.get("lunch_carb")!.map((e) => [e.canonicalKey, e]));
  assert.equal(byKey.get("rice_dry")!.mealRoles?.roles.lunch, "CHO_PRIMARY");
  assert.equal(byKey.get("rice_dry")!.mealRoles?.scores.lunch, 10);
  assert.equal(byKey.get("new_admin_food")!.mealRoles, undefined);
  // Firma a due argomenti (chiamanti esistenti) → nessun mealRoles, nessun errore.
  const legacy = mapMenuFoodRows([menuRow({})], [macroRow(169756)]);
  assert.equal(legacy!.get("lunch_carb")![0]!.mealRoles, undefined);
});

test("loadMenuFoodPools: legge nutrition_menu_food_meal_roles e aggancia; errore sulla tabella score → catalogo comunque caricato", async () => {
  resetMenuFoodPoolsCacheForTests();
  const calls: string[] = [];
  const pools = await loadMenuFoodPools(
    fakeAdmin({ data: [menuRow({})], error: null }, { data: [macroRow(169756)], error: null }, calls, { data: [roleRow({})], error: null }),
  );
  assert.ok(calls.includes("nutrition_menu_food_meal_roles"));
  assert.equal(pools!.get("lunch_carb")![0]!.mealRoles?.roles.snack, "EXCLUDE");
  resetMenuFoodPoolsCacheForTests();
  const withoutRoles = await loadMenuFoodPools(
    fakeAdmin({ data: [menuRow({})], error: null }, { data: [macroRow(169756)], error: null }, undefined, { data: null, error: { message: "relation missing" } }),
  );
  assert.ok(withoutRoles);
  assert.equal(withoutRoles!.get("lunch_carb")![0]!.mealRoles, undefined);
  resetMenuFoodPoolsCacheForTests();
});

// ---- Sistema ruoli v6 (colonne migrazione 20260820090000) ----

test("parseMenuFoodMealRoleRow: campi v6 letti e tollerati (ignoto → default), substitutes non-array → []", () => {
  const parsed = parseMenuFoodMealRoleRow(
    roleRow({
      breakfast_cho_role: "primary_complex",
      breakfast_protein_role: "SECONDARY_SAVOURY",
      breakfast_fat_role: "PRIMARY",
      main_meal_role: "FAT_CONDIMENT",
      snack_role: "FAST_CARB",
      mediterranean_priority: "LIMITED",
      substitution_group: "FAT_CONDIMENT",
      substitutes: ["olive_oil", "avocado", 42, ""],
    }),
  );
  assert.ok(parsed);
  const mr = parsed!.mealRoles;
  assert.equal(mr.breakfastChoRole, "PRIMARY_COMPLEX");
  assert.equal(mr.breakfastProteinRole, "SECONDARY_SAVOURY");
  assert.equal(mr.breakfastFatRole, "PRIMARY");
  assert.equal(mr.mainMealRole, "FAT_CONDIMENT");
  assert.equal(mr.snackRole, "FAST_CARB");
  assert.equal(mr.mediterraneanPriority, "LIMITED");
  assert.equal(mr.substitutionGroup, "FAT_CONDIMENT");
  assert.deepEqual(mr.substitutes, ["olive_oil", "avocado"]);
  assert.equal(mealRolesHasV6(mr), true);

  // Valori ignoti / colonne assenti (select v5) → default, mai throw, e hasV6 false.
  const v5only = parseMenuFoodMealRoleRow(roleRow({ breakfast_cho_role: "BOH", substitutes: "non-array" }));
  assert.ok(v5only);
  assert.equal(v5only!.mealRoles.breakfastChoRole, "NONE");
  assert.equal(v5only!.mealRoles.mainMealRole, "NONE");
  assert.equal(v5only!.mealRoles.mediterraneanPriority, "COMMON");
  assert.equal(v5only!.mealRoles.substitutionGroup, null);
  assert.deepEqual(v5only!.mealRoles.substitutes, []);
  assert.equal(mealRolesHasV6(v5only!.mealRoles), false, "default v6 = nessun dato v6: la grammatica resta sul v5");
});

/** Client finto con COD A: la prima select sulla tabella score fallisce 42703, la seconda risponde. */
function fakeAdminRolesQueue(menu: FakeResult, fdc: FakeResult, rolesQueue: FakeResult[], calls?: string[]): SupabaseClient {
  return {
    from(table: string) {
      calls?.push(table);
      const result =
        table === "nutrition_menu_foods"
          ? menu
          : table === "nutrition_menu_food_meal_roles"
            ? (rolesQueue.shift() ?? { data: [], error: null })
            : fdc;
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.in = () => builder;
      builder.then = (resolve: (v: FakeResult) => void) => resolve(result);
      return builder;
    },
  } as unknown as SupabaseClient;
}

test("loadMenuFoodPools: colonne v6 mancanti (42703) → retry sulla select v5, la grammatica NON si azzera", async () => {
  resetMenuFoodPoolsCacheForTests();
  const calls: string[] = [];
  const pools = await loadMenuFoodPools(
    fakeAdminRolesQueue(
      { data: [menuRow({})], error: null },
      { data: [macroRow(169756)], error: null },
      [
        { data: null, error: { code: "42703", message: 'column nutrition_menu_food_meal_roles.substitutes does not exist' } },
        { data: [roleRow({})], error: null },
      ],
      calls,
    ),
  );
  assert.ok(pools);
  const entry = pools!.get("lunch_carb")![0]!;
  assert.equal(entry.mealRoles?.roles.lunch, "CHO_PRIMARY", "mealRoles v5 caricati nonostante la colonna v6 mancante");
  assert.equal(calls.filter((t) => t === "nutrition_menu_food_meal_roles").length, 2, "una select piena + un retry v5");
  resetMenuFoodPoolsCacheForTests();
});

// ---- Sistema tier v9 (colonne migrazione 20260821090000) ----

test("parseMenuFoodMealRoleRow v9: campi letti quando presenti; chiave ASSENTE → undefined (mai default inventato)", () => {
  const parsed = parseMenuFoodMealRoleRow(
    roleRow({
      generative_tier: "core",
      default_enabled: false,
      selection_weight: 45,
      substitution_mode: "portion_equivalent",
      substitute_pool: "MAIN_PROTEIN",
    }),
  );
  assert.ok(parsed);
  const mr = parsed!.mealRoles;
  assert.equal(mr.generativeTier, "CORE");
  assert.equal(mr.defaultEnabled, false);
  assert.equal(mr.selectionWeight, 45);
  assert.equal(mr.substitutionMode, "PORTION_EQUIVALENT");
  assert.equal(mr.substitutePool, "MAIN_PROTEIN");

  // Riga SENZA colonne v9 (select degradata): i campi restano undefined — la
  // grammatica degrada al vocabolario v6/v5 per la entry, nessun VARIETY inventato.
  const v6only = parseMenuFoodMealRoleRow(roleRow({}));
  assert.equal(v6only!.mealRoles.generativeTier, undefined);
  assert.equal(v6only!.mealRoles.defaultEnabled, undefined);
  assert.equal("selectionWeight" in v6only!.mealRoles, false);

  // Valori fuori enum → come assenti (tolleranza: mai throw, mai valore inventato).
  const weird = parseMenuFoodMealRoleRow(roleRow({ generative_tier: "BOH", substitution_mode: "NOPE", default_enabled: "si" }));
  assert.equal(weird!.mealRoles.generativeTier, undefined);
  assert.equal(weird!.mealRoles.substitutionMode, undefined);
  assert.equal(weird!.mealRoles.defaultEnabled, undefined);
});

test("loadMenuFoodPools: retry a TRE stadi — 42703 sulle colonne v9 → select v6 (la v6 NON si perde), 42703 anche lì → v5", async () => {
  resetMenuFoodPoolsCacheForTests();
  const calls: string[] = [];
  const pools = await loadMenuFoodPools(
    fakeAdminRolesQueue(
      { data: [menuRow({})], error: null },
      { data: [macroRow(169756)], error: null },
      [
        { data: null, error: { code: "42703", message: "column nutrition_menu_food_meal_roles.generative_tier does not exist" } },
        { data: [roleRow({ breakfast_cho_role: "PRIMARY_COMPLEX", mediterranean_priority: "PRIMARY", substitution_group: "MAIN_COMPLEX_CARB" })], error: null },
      ],
      calls,
    ),
  );
  assert.ok(pools);
  const entry = pools!.get("lunch_carb")![0]!;
  assert.equal(entry.mealRoles?.substitutionGroup, "MAIN_COMPLEX_CARB", "la v6 sopravvive alla mancanza delle colonne v9");
  assert.equal(entry.mealRoles?.generativeTier, undefined);
  assert.equal(calls.filter((t) => t === "nutrition_menu_food_meal_roles").length, 2, "v9 fallita + v6 riuscita");
  resetMenuFoodPoolsCacheForTests();

  // Doppio 42703 (né v9 né v6): si arriva alla select v5, i ruoli v5 restano.
  const calls2: string[] = [];
  const pools2 = await loadMenuFoodPools(
    fakeAdminRolesQueue(
      { data: [menuRow({})], error: null },
      { data: [macroRow(169756)], error: null },
      [
        { data: null, error: { code: "42703", message: "column generative_tier does not exist" } },
        { data: null, error: { code: "42703", message: "column substitutes does not exist" } },
        { data: [roleRow({})], error: null },
      ],
      calls2,
    ),
  );
  assert.equal(pools2!.get("lunch_carb")![0]!.mealRoles?.roles.lunch, "CHO_PRIMARY");
  assert.equal(calls2.filter((t) => t === "nutrition_menu_food_meal_roles").length, 3, "v9 → v6 → v5");
  resetMenuFoodPoolsCacheForTests();
});
