import assert from "node:assert/strict";
import test from "node:test";
import {
  computeRecipeMacrosPer100g,
  inheritRecipeDietFlags,
  recipeGramsSumMessage,
  recipeKeyFromLabel,
  validateRecipeComponents,
  validateRecipeFrequency,
  validateRecipeInput,
  type RecipeCatalogFood,
} from "@/lib/admin/menu-recipe-validation";

const CATALOG: Record<string, RecipeCatalogFood> = {
  pasta_dry: {
    canonical_key: "pasta_dry",
    fdc_id: 168927,
    label_it: "Pasta di semola",
    is_active: true,
    is_meat: false,
    is_fish: false,
    is_animal_product: false,
    macro: { kcal: 370, carbs: 75, protein: 13, fat: 1.5 },
  },
  egg_whole: {
    canonical_key: "egg_whole",
    fdc_id: 171287,
    label_it: "Uova",
    is_active: true,
    is_meat: false,
    is_fish: false,
    is_animal_product: true,
    macro: { kcal: 143, carbs: 0.7, protein: 12.6, fat: 9.5 },
  },
  pork_belly_cured: {
    canonical_key: "pork_belly_cured",
    fdc_id: 168277,
    label_it: "Pancetta",
    is_active: true,
    is_meat: true,
    is_fish: false,
    is_animal_product: true,
    macro: { kcal: 450, carbs: 0, protein: 12, fat: 45 },
  },
  tuna_dead: {
    canonical_key: "tuna_dead",
    fdc_id: 1,
    label_it: "Tonno disattivato",
    is_active: false,
    is_meat: false,
    is_fish: true,
    is_animal_product: true,
    macro: { kcal: 100, carbs: 0, protein: 20, fat: 2 },
  },
  no_macro: {
    canonical_key: "no_macro",
    fdc_id: 2,
    label_it: "Senza macro",
    is_active: true,
    is_meat: false,
    is_fish: false,
    is_animal_product: false,
    macro: { kcal: null, carbs: null, protein: null, fat: null },
  },
};
const lookup = (k: string) => CATALOG[k] ?? null;
const macroLookup = (k: string) => CATALOG[k]?.macro ?? null;

const OK_BODY = {
  recipe_key: "pasta_alla_carbonara",
  label_it: "Pasta alla carbonara",
  frequency: "ROTATION",
  max_week: 2,
  components: [
    { position: 1, canonical_key: "pasta_dry", grams_per_100g: 35 },
    { position: 2, canonical_key: "egg_whole", grams_per_100g: 14 },
    { position: 3, canonical_key: "pork_belly_cured", grams_per_100g: 21 },
    { position: 4, is_neutral: true, grams_per_100g: 30 },
  ],
};

test("validateRecipeInput: caso completo ok, componenti normalizzati e fdc_id snapshot", () => {
  const r = validateRecipeInput(OK_BODY, lookup);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.recipe_key, "pasta_alla_carbonara");
  assert.equal(r.value.frequency, "ROTATION");
  assert.equal(r.value.max_week, 2);
  assert.equal(r.value.is_active, true);
  assert.equal(r.value.components.length, 4);
  assert.equal(r.value.components[0].fdc_id, 168927);
  assert.equal(r.value.components[0].label_it, "Pasta di semola");
  assert.equal(r.value.components[3].is_neutral, true);
  assert.equal(r.value.components[3].canonical_key, null);
  assert.equal(r.value.components[3].label_it, "Acqua / brodo neutro");
});

test("validateRecipeInput: somma 98 → errore che dice i grammi mancanti", () => {
  const body = {
    ...OK_BODY,
    components: [
      { position: 1, canonical_key: "pasta_dry", grams_per_100g: 35 },
      { position: 2, canonical_key: "egg_whole", grams_per_100g: 14 },
      { position: 3, canonical_key: "pork_belly_cured", grams_per_100g: 21 },
      { position: 4, is_neutral: true, grams_per_100g: 28 },
    ],
  };
  const r = validateRecipeInput(body, lookup);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.error, /mancano 2 g/);
  assert.match(r.error, /100 g/);
});

test("recipeGramsSumMessage: tolleranza [99,101] e messaggio per eccesso", () => {
  assert.equal(recipeGramsSumMessage(99), null);
  assert.equal(recipeGramsSumMessage(100), null);
  assert.equal(recipeGramsSumMessage(101), null);
  assert.match(recipeGramsSumMessage(103) ?? "", /3 g di troppo/);
  assert.match(recipeGramsSumMessage(98.5) ?? "", /mancano 1,5 g/);
});

test("validateRecipeComponents: componente senza alimento e non neutro → errore", () => {
  const r = validateRecipeComponents(
    [
      { position: 1, canonical_key: "pasta_dry", grams_per_100g: 50 },
      { position: 2, grams_per_100g: 50 },
    ],
    lookup,
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.error, /componente #2/);
  assert.match(r.error, /manca l'alimento/);
});

test("validateRecipeComponents: meno di 2 ingredienti reali → errore (il neutro non conta)", () => {
  const r = validateRecipeComponents(
    [
      { position: 1, canonical_key: "pasta_dry", grams_per_100g: 60 },
      { position: 2, is_neutral: true, grams_per_100g: 40 },
    ],
    lookup,
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.error, /almeno 2 ingredienti/);
});

test("validateRecipeComponents: alimento inesistente o disattivato → errore parlante", () => {
  const missing = validateRecipeComponents(
    [
      { position: 1, canonical_key: "pasta_dry", grams_per_100g: 50 },
      { position: 2, canonical_key: "ghost", grams_per_100g: 50 },
    ],
    lookup,
  );
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.match(missing.error, /"ghost" non esiste/);

  const inactive = validateRecipeComponents(
    [
      { position: 1, canonical_key: "pasta_dry", grams_per_100g: 50 },
      { position: 2, canonical_key: "tuna_dead", grams_per_100g: 50 },
    ],
    lookup,
  );
  assert.equal(inactive.ok, false);
  if (!inactive.ok) assert.match(inactive.error, /disattivato/);
});

test("validateRecipeComponents: position duplicata, grammi ≤0, neutro con alimento → errori", () => {
  const dup = validateRecipeComponents(
    [
      { position: 1, canonical_key: "pasta_dry", grams_per_100g: 50 },
      { position: 1, canonical_key: "egg_whole", grams_per_100g: 50 },
    ],
    lookup,
  );
  assert.equal(dup.ok, false);
  if (!dup.ok) assert.match(dup.error, /duplicata/);

  const zero = validateRecipeComponents(
    [
      { position: 1, canonical_key: "pasta_dry", grams_per_100g: 0 },
      { position: 2, canonical_key: "egg_whole", grams_per_100g: 100 },
    ],
    lookup,
  );
  assert.equal(zero.ok, false);
  if (!zero.ok) assert.match(zero.error, /> 0/);

  const neutralWithFood = validateRecipeComponents(
    [
      { position: 1, canonical_key: "pasta_dry", grams_per_100g: 50 },
      { position: 2, canonical_key: "egg_whole", grams_per_100g: 30 },
      { position: 3, canonical_key: "pasta_dry", is_neutral: true, grams_per_100g: 20 },
    ],
    lookup,
  );
  assert.equal(neutralWithFood.ok, false);
  if (!neutralWithFood.ok) assert.match(neutralWithFood.error, /neutro non può avere un alimento/);
});

test("validateRecipeInput: recipe_key non slug → errore; label mancante → errore", () => {
  const badKey = validateRecipeInput({ ...OK_BODY, recipe_key: "Pasta Carbonara" }, lookup);
  assert.equal(badKey.ok, false);
  if (!badKey.ok) assert.match(badKey.error, /snake_case/);
  const badKey2 = validateRecipeInput({ ...OK_BODY, recipe_key: "pasta__carbonara" }, lookup);
  assert.equal(badKey2.ok, false);
  const noLabel = validateRecipeInput({ ...OK_BODY, label_it: "  " }, lookup);
  assert.equal(noLabel.ok, false);
  if (!noLabel.ok) assert.match(noLabel.error, /label_it/);
});

test("validateRecipeFrequency: default COMMON, max_week 1-7 o vuoto", () => {
  const d = validateRecipeFrequency(undefined, "");
  assert.deepEqual(d, { ok: true, frequency: "COMMON", max_week: null });
  const bad = validateRecipeFrequency("WEEKLY", null);
  assert.equal(bad.ok, false);
  const badWeek = validateRecipeFrequency("COMMON", 9);
  assert.equal(badWeek.ok, false);
  const okWeek = validateRecipeFrequency("OCCASIONAL", "3");
  assert.deepEqual(okWeek, { ok: true, frequency: "OCCASIONAL", max_week: 3 });
});

test("computeRecipeMacrosPer100g: Σ ingredienti pesati, neutro a zero", () => {
  const r = computeRecipeMacrosPer100g(
    [
      { canonical_key: "pasta_dry", grams_per_100g: 50, is_neutral: false },
      { canonical_key: "egg_whole", grams_per_100g: 20, is_neutral: false },
      { canonical_key: null, grams_per_100g: 30, is_neutral: true },
    ],
    macroLookup,
  );
  // pasta: 370*0.5=185 kcal, 37.5 cho, 6.5 pro, 0.75 fat; uova: 143*0.2=28.6, 0.14, 2.52, 1.9
  assert.equal(Number(r.kcal.toFixed(2)), 213.6);
  assert.equal(Number(r.carbs.toFixed(2)), 37.64);
  assert.equal(Number(r.protein.toFixed(2)), 9.02);
  assert.equal(Number(r.fat.toFixed(2)), 2.65);
  assert.deepEqual(r.missing, []);
});

test("computeRecipeMacrosPer100g: alimento senza macro conta zero ed è segnalato", () => {
  const r = computeRecipeMacrosPer100g(
    [
      { canonical_key: "pasta_dry", grams_per_100g: 50, is_neutral: false },
      { canonical_key: "no_macro", grams_per_100g: 50, is_neutral: false },
    ],
    macroLookup,
  );
  assert.equal(r.kcal, 185);
  assert.deepEqual(r.missing, ["no_macro"]);
});

test("inheritRecipeDietFlags: basta un ingrediente con il flag", () => {
  const f = inheritRecipeDietFlags(
    [
      { canonical_key: "pasta_dry", is_neutral: false },
      { canonical_key: "pork_belly_cured", is_neutral: false },
      { canonical_key: null, is_neutral: true },
    ],
    (k) => CATALOG[k] ?? null,
  );
  assert.deepEqual(f, { is_meat: true, is_fish: false, is_animal_product: true });
});

test("recipeKeyFromLabel: slug snake_case senza accenti", () => {
  assert.equal(recipeKeyFromLabel("Pasta all'amatriciana  (ricca)"), "pasta_all_amatriciana_ricca");
  assert.equal(recipeKeyFromLabel("Risotto alla zucca è buono"), "risotto_alla_zucca_e_buono");
});
