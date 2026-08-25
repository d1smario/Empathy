import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadMenuRecipes,
  mapMenuRecipeRows,
  resetMenuRecipesCacheForTests,
} from "@/lib/nutrition/v2/menu-recipe-catalog-db";

const R1 = "11111111-1111-4111-8111-111111111111";
const R2 = "22222222-2222-4222-8222-222222222222";

function recipeRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return { id: R1, recipe_key: "pizza_margherita", label_it: "Pizza Margherita", note: null, ...overrides };
}

function comp(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    recipe_id: R1,
    position: 1,
    canonical_key: "bread_white",
    fdc_id: 174925,
    label_it: "Pane",
    // numeric PostgREST → stringa.
    grams_per_100g: "45",
    is_neutral: false,
    ...overrides,
  };
}

/** Pizza Margherita di Mario: 6 componenti, l'ultimo neutro, somma 100. */
const pizzaComponents = [
  comp({ position: 1 }),
  comp({ position: 2, canonical_key: "tomatoes_canned", fdc_id: 170138, label_it: "Pomodori pelati", grams_per_100g: "20" }),
  comp({ position: 3, canonical_key: "mozzarella", fdc_id: 170847, label_it: "Mozzarella", grams_per_100g: "18" }),
  comp({ position: 4, canonical_key: "olive_oil", fdc_id: 171413, label_it: "Olio EVO", grams_per_100g: "4" }),
  comp({ position: 5, canonical_key: "parmigiano_reggiano", fdc_id: 170848, label_it: "Parmigiano Reggiano", grams_per_100g: "3" }),
  comp({ position: 6, canonical_key: null, fdc_id: null, label_it: "Acqua / brodo neutro", grams_per_100g: "10", is_neutral: true }),
];

test("mapMenuRecipeRows: ricetta valida → componenti ordinati per position, neutro con canonicalKey null", () => {
  const logs: string[] = [];
  // Componenti passati in disordine: l'ordine deve venire da position.
  const recipes = mapMenuRecipeRows([recipeRow({})], [...pizzaComponents].reverse(), (m) => logs.push(m));
  assert.equal(recipes.length, 1);
  assert.equal(logs.length, 0);
  const pizza = recipes[0]!;
  assert.equal(pizza.recipeKey, "pizza_margherita");
  assert.equal(pizza.labelIt, "Pizza Margherita");
  assert.deepEqual(
    pizza.components.map((c) => c.position),
    [1, 2, 3, 4, 5, 6],
  );
  assert.equal(pizza.components[0]!.canonicalKey, "bread_white");
  assert.equal(pizza.components[0]!.gramsPer100g, 45);
  assert.equal(pizza.components[0]!.fdcId, 174925);
  const neutral = pizza.components[5]!;
  assert.equal(neutral.isNeutral, true);
  assert.equal(neutral.canonicalKey, null);
  assert.equal(neutral.fdcId, null);
  assert.equal(neutral.gramsPer100g, 10);
  assert.equal(
    pizza.components.reduce((a, c) => a + c.gramsPer100g, 0),
    100,
  );
});

test("mapMenuRecipeRows: somma grammi fuori [99, 101] → ricetta scartata con log", () => {
  const logs: string[] = [];
  const recipes = mapMenuRecipeRows(
    [recipeRow({}), recipeRow({ id: R2, recipe_key: "porridge_rotto" })],
    [
      ...pizzaComponents,
      comp({ recipe_id: R2, position: 1, canonical_key: "oat_dry", grams_per_100g: "50" }),
      comp({ recipe_id: R2, position: 2, canonical_key: "banana", grams_per_100g: "30" }),
    ],
    (m) => logs.push(m),
  );
  assert.deepEqual(
    recipes.map((r) => r.recipeKey),
    ["pizza_margherita"],
  );
  assert.equal(logs.length, 1);
  assert.match(logs[0]!, /porridge_rotto/);
  assert.match(logs[0]!, /80\.00/);
  // Dentro la tolleranza (99.5) passa.
  const ok = mapMenuRecipeRows(
    [recipeRow({ id: R2, recipe_key: "quasi_cento" })],
    [comp({ recipe_id: R2, position: 1, grams_per_100g: "99.5" })],
    () => {},
  );
  assert.equal(ok.length, 1);
});

test("mapMenuRecipeRows: componente non neutro senza canonical_key → ricetta scartata; nessun componente → scartata", () => {
  const logs: string[] = [];
  const recipes = mapMenuRecipeRows(
    [recipeRow({}), recipeRow({ id: R2, recipe_key: "senza_componenti" })],
    [comp({ position: 1, canonical_key: null, grams_per_100g: "100", is_neutral: false })],
    (m) => logs.push(m),
  );
  assert.equal(recipes.length, 0);
  assert.equal(logs.length, 2);
  assert.match(logs.find((l) => l.includes("pizza_margherita"))!, /senza canonical_key/);
  assert.match(logs.find((l) => l.includes("senza_componenti"))!, /nessun componente/);
});

test("mapMenuRecipeRows: ordine deterministico per recipe_key", () => {
  const recipes = mapMenuRecipeRows(
    [recipeRow({ id: R2, recipe_key: "zuppa" }), recipeRow({ id: R1, recipe_key: "arrosto" })],
    [comp({ recipe_id: R2, grams_per_100g: "100" }), comp({ recipe_id: R1, grams_per_100g: "100" })],
    () => {},
  );
  assert.deepEqual(
    recipes.map((r) => r.recipeKey),
    ["arrosto", "zuppa"],
  );
});

type FakeResult = { data: unknown; error: unknown };

/**
 * Il finto client IMITA IL TETTO DI RIGHE di PostgREST: `range(from, to)` ritaglia i dati
 * e non restituisce mai più di `pageCap` righe per risposta. Senza questa fedeltà il test
 * non avrebbe potuto vedere il guasto del 25 ago — 1.239 componenti in tabella, 1.000
 * restituiti, 59 ricette senza ingredienti e scartate in silenzio.
 */
function fakeAdmin(
  recipes: FakeResult,
  components: FakeResult,
  calls?: string[],
  pageCap = 1000,
): SupabaseClient {
  return {
    from(table: string) {
      calls?.push(table);
      const result = table === "nutrition_recipes" ? recipes : components;
      const builder: Record<string, unknown> = {};
      let from = 0;
      let to = Number.MAX_SAFE_INTEGER;
      const slice = (): FakeResult => {
        if (!Array.isArray(result.data)) return result;
        const rows = result.data as unknown[];
        const end = Math.min(to + 1, from + pageCap, rows.length);
        return { data: rows.slice(from, Math.max(from, end)), error: result.error };
      };
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.in = () => builder;
      builder.order = () => builder;
      builder.range = (a: number, b: number) => {
        from = a;
        to = b;
        return builder;
      };
      builder.then = (resolve: (v: FakeResult) => void) => resolve(slice());
      return builder;
    },
  } as unknown as SupabaseClient;
}

test("loadMenuRecipes: i componenti si paginano — oltre il tetto di righe NESSUNA ricetta perde gli ingredienti", async () => {
  // Il guasto vero del 25 ago 2026, in piccolo: il tetto di PostgREST tronca la risposta
  // SENZA errore, e le ricette in coda restano senza componenti — quindi scartate, in
  // silenzio, mentre i piani continuano a generarsi. In produzione: 1.239 componenti in
  // tabella, 1.000 restituiti, 59 ricette su 308 sparite dal menù.
  resetMenuRecipesCacheForTests();
  const N = 25; // ricette, 4 componenti l'una = 100 righe totali
  const CAP = 10; // tetto di pagina finto: 10 pagine da riempire
  const ids = Array.from({ length: N }, (_, i) => `3${String(i).padStart(7, "0")}-3333-4333-8333-333333333333`);
  const recipeRows = ids.map((id, i) => recipeRow({ id, recipe_key: `ricetta_${String(i).padStart(2, "0")}` }));
  const componentRows = ids.flatMap((id) => [
    comp({ recipe_id: id, position: 1, canonical_key: "pasta_dry", grams_per_100g: "40" }),
    comp({ recipe_id: id, position: 2, canonical_key: "tuna_canned_water", grams_per_100g: "25" }),
    comp({ recipe_id: id, position: 3, canonical_key: "tomato_raw", grams_per_100g: "30" }),
    comp({ recipe_id: id, position: 4, canonical_key: "olive_oil", grams_per_100g: "5" }),
  ]);
  const recipes = await loadMenuRecipes(
    fakeAdmin({ data: recipeRows, error: null }, { data: componentRows, error: null }, undefined, CAP),
  );
  assert.ok(recipes, "senza paginazione qui si otterrebbe null o un elenco monco");
  assert.equal(recipes!.length, N, "tutte le ricette devono conservare i propri ingredienti");
  for (const r of recipes!) assert.equal(r.components.length, 4, `${r.recipeKey}: componenti persi`);
});

test("loadMenuRecipes: errore o tabella vuota → null, mai throw; successo → ricette + cache", async () => {
  resetMenuRecipesCacheForTests();
  assert.equal(await loadMenuRecipes(fakeAdmin({ data: null, error: { message: "boom" } }, { data: [], error: null })), null);
  resetMenuRecipesCacheForTests();
  assert.equal(await loadMenuRecipes(fakeAdmin({ data: [], error: null }, { data: [], error: null })), null);
  resetMenuRecipesCacheForTests();
  assert.equal(await loadMenuRecipes(fakeAdmin({ data: [recipeRow({})], error: null }, { data: null, error: { message: "boom" } })), null);
  resetMenuRecipesCacheForTests();
  const calls: string[] = [];
  const admin = fakeAdmin({ data: [recipeRow({})], error: null }, { data: pizzaComponents, error: null }, calls);
  const recipes = await loadMenuRecipes(admin);
  assert.ok(recipes);
  assert.equal(recipes!.length, 1);
  const callsAfterFirst = calls.length;
  assert.equal(await loadMenuRecipes(admin), recipes);
  assert.equal(calls.length, callsAfterFirst);
  resetMenuRecipesCacheForTests();
});

// ---- Colonne v9 (family/tier/selection_weight/meals, migrazione 20260821090000) ----

test("mapMenuRecipeRows v9: family/tier/selection_weight/meals letti; meals malformato → default lunch+dinner; colonna ASSENTE → campo assente", () => {
  const recipes = mapMenuRecipeRows(
    [recipeRow({ family: "PROTEIN_SHAKE_LIGHT", tier: "rotation", selection_weight: 30, meals: ["breakfast", "snack", "boh", 42] })],
    pizzaComponents,
  );
  const r = recipes[0]!;
  assert.equal(r.family, "PROTEIN_SHAKE_LIGHT");
  assert.equal(r.tier, "ROTATION");
  assert.equal(r.selectionWeight, 30);
  assert.deepEqual(r.meals, ["breakfast", "snack"], "meals filtrata sui 4 valori ammessi");

  // meals presente ma vuota/malformata → default lunch+dinner (coerente col default DB).
  const malformed = mapMenuRecipeRows([recipeRow({ meals: "non-array" })], pizzaComponents)[0]!;
  assert.deepEqual(malformed.meals, ["lunch", "dinner"]);
  const emptyArr = mapMenuRecipeRows([recipeRow({ meals: [] })], pizzaComponents)[0]!;
  assert.deepEqual(emptyArr.meals, ["lunch", "dinner"]);

  // Riga LEGACY (colonna meals proprio assente): il campo NON esiste — l'eleggibilità
  // resta la deduzione dagli ingredienti, mai un lunch+dinner inventato dal parser.
  const legacy = mapMenuRecipeRows([recipeRow({})], pizzaComponents)[0]!;
  assert.equal("meals" in legacy, false);
  assert.equal("family" in legacy, false);
  assert.equal(legacy.tier, undefined);
});

test("loadMenuRecipes: retry a TRE stadi — 42703 sulle colonne v9 → select frequency/max_week (che NON si perdono)", async () => {
  resetMenuRecipesCacheForTests();
  const queue: Array<{ data: unknown; error: unknown }> = [
    { data: null, error: { code: "42703", message: "column nutrition_recipes.meals does not exist" } },
    { data: [recipeRow({ frequency: "OCCASIONAL", max_week: 1 })], error: null },
  ];
  const calls: string[] = [];
  const admin = {
    from(table: string) {
      calls.push(table);
      const result =
        table === "nutrition_recipes" ? (queue.shift() ?? { data: [], error: null }) : { data: pizzaComponents, error: null };
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.in = () => builder;
      // La paginazione dei loader chiama order/range: il finto client deve conoscerli,
      // altrimenti il degrado a stadi non viene esercitato ma solo fatto esplodere.
      builder.order = () => builder;
      // range VERO anche qui: un finto client che lo ignora farebbe rileggere al loader
      // le stesse righe a ogni giro, e il test misurerebbe un guasto suo, non del codice.
      let from = 0;
      builder.range = (a: number) => {
        from = a;
        return builder;
      };
      builder.then = (resolve: (v: unknown) => void) => {
        const r = result as { data: unknown; error: unknown };
        resolve(Array.isArray(r.data) ? { data: (r.data as unknown[]).slice(from), error: r.error } : r);
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  const recipes = await loadMenuRecipes(admin);
  assert.ok(recipes);
  assert.equal(recipes![0]!.frequency, "OCCASIONAL", "frequency sopravvive alla mancanza delle colonne v9");
  assert.equal(recipes![0]!.maxWeek, 1);
  assert.equal(recipes![0]!.tier, undefined);
  assert.equal(calls.filter((t) => t === "nutrition_recipes").length, 3, "v9 fallita + stadio v6 riuscito + pagina di chiusura (paginazione)");
  resetMenuRecipesCacheForTests();
});

// ---- Colonna v11 (template_meta jsonb, migrazione 20260822090000) ----

test("mapMenuRecipeRows v11: template_meta parsato (NONE→null); tutto-null/malformato → null; colonna ASSENTE → campo assente", () => {
  const meta = {
    primary_carb_family: "OATS",
    protein_base_family: "DAIRY_MILK",
    fruit_family: "NONE",
    fat_addon_family: null,
    variant_group: "V10_EXISTING",
    standard_serving_g: 435,
  };
  const r = mapMenuRecipeRows([recipeRow({ template_meta: meta })], pizzaComponents)[0]!;
  assert.deepEqual(r.templateMeta, {
    primaryCarbFamily: "OATS",
    proteinBaseFamily: "DAIRY_MILK",
    fruitFamily: null,
    fatAddonFamily: null,
    variantGroup: "V10_EXISTING",
    standardServingG: 435,
  });
  // Ricetta non-template: colonna presente ma null → templateMeta null (percorso non-template).
  const plain = mapMenuRecipeRows([recipeRow({ template_meta: null })], pizzaComponents)[0]!;
  assert.equal(plain.templateMeta, null);
  // Jsonb malformato o con soli NONE → null, mai un template inventato.
  const junk = mapMenuRecipeRows([recipeRow({ template_meta: "not-an-object" })], pizzaComponents)[0]!;
  assert.equal(junk.templateMeta, null);
  const allNone = mapMenuRecipeRows(
    [recipeRow({ template_meta: { primary_carb_family: "NONE", variant_group: "" } })],
    pizzaComponents,
  )[0]!;
  assert.equal(allNone.templateMeta, null);
  // Riga LEGACY (colonna assente): il campo NON esiste.
  const legacy = mapMenuRecipeRows([recipeRow({})], pizzaComponents)[0]!;
  assert.equal("templateMeta" in legacy, false);
});

test("loadMenuRecipes: 42703 su template_meta → stadio v9 (family/tier/meals NON si perdono)", async () => {
  resetMenuRecipesCacheForTests();
  const queue: Array<{ data: unknown; error: unknown }> = [
    { data: null, error: { code: "42703", message: "column nutrition_recipes.template_meta does not exist" } },
    { data: [recipeRow({ family: "PIZZA", tier: "CORE", selection_weight: 10, meals: ["lunch"], frequency: "COMMON", max_week: 2 })], error: null },
  ];
  const calls: string[] = [];
  const admin = {
    from(table: string) {
      calls.push(table);
      const result =
        table === "nutrition_recipes" ? (queue.shift() ?? { data: [], error: null }) : { data: pizzaComponents, error: null };
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.in = () => builder;
      // La paginazione dei loader chiama order/range: il finto client deve conoscerli,
      // altrimenti il degrado a stadi non viene esercitato ma solo fatto esplodere.
      builder.order = () => builder;
      // range VERO anche qui: un finto client che lo ignora farebbe rileggere al loader
      // le stesse righe a ogni giro, e il test misurerebbe un guasto suo, non del codice.
      let from = 0;
      builder.range = (a: number) => {
        from = a;
        return builder;
      };
      builder.then = (resolve: (v: unknown) => void) => {
        const r = result as { data: unknown; error: unknown };
        resolve(Array.isArray(r.data) ? { data: (r.data as unknown[]).slice(from), error: r.error } : r);
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  const recipes = await loadMenuRecipes(admin);
  assert.ok(recipes);
  assert.equal(recipes![0]!.family, "PIZZA", "le colonne v9 sopravvivono alla mancanza di template_meta");
  assert.deepEqual(recipes![0]!.meals, ["lunch"]);
  assert.equal("templateMeta" in recipes![0]!, false, "campo assente sullo stadio senza colonna");
  assert.equal(calls.filter((t) => t === "nutrition_recipes").length, 3, "stadio v11 fallito + stadio v9 riuscito + pagina di chiusura (paginazione)");
  resetMenuRecipesCacheForTests();
});
