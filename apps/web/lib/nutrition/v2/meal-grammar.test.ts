/**
 * Grammatica dei pasti (Mario v5 + sistema ruoli v6) nel compositore V2 — test PURI su
 * un catalogo finto. Copre: gate; B01/B02 a colazione; score 0 = filtro secco; max_week;
 * ricette come matrice mista (item con componenti, macro = Σ ingredienti, ingrediente
 * vietato → ricetta vietata); persist = ingredienti uno per riga con Σ kcal = item; off
 * bit-identico; shadow/on decisi dal gate (servito ≠ registrato); riparazione giro 1:
 * mai USDA grezzo sotto grammatica (raw pool NON vuoti), B02 dalla frutta di snack_cho,
 * regola 7 filtrata, semantica max_week di famiglia.
 *
 * SEZIONE v6 (in coda): filtri per asse (B01/B06/B07, M02/M03, S01/S03), ordinamento a
 * chiavi mediterranean_priority+score (B03/M04), quarta riga FAT_CONDIMENT (M01) con
 * skip a pasto già ricco (D02-v1), tetto dolci B05, sostituzioni R01/R02, degradazione
 * v5 per entry senza dati v6. Le fixture v5 restano: sono il caso «dati v5, codice v6».
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { DailyNutritionRequirementsV2, MealPlanV2ComposedSlot, MealPlanV2DietSlotBudget } from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import { composeMealPlanV2, type FdcPoolMap } from "@/lib/nutrition/v2/compose-meal-plan-v2";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import { pickStapleForPool, mealRotationStaplesFromComposedItems } from "@/lib/nutrition/v2/fdc-staple-registry";
import type { MenuFoodEntry, MenuFoodMealRoles, MenuFoodPoolMap } from "@/lib/nutrition/v2/menu-food-catalog-db";
import type { MenuRecipe } from "@/lib/nutrition/v2/menu-recipe-catalog-db";
import {
  breakfastSecondaryMenuEntries,
  buildMealGrammarProvenance,
  chooseRecipeForSlot,
  GRAMMAR_BREAKFAST_SWEETS_MAX_WEEK,
  GRAMMAR_D02_FISH_DINNER_BONUS,
  GRAMMAR_SHAKE_POWDER_MAX_G,
  GRAMMAR_SHAKE_POWDER_MIN_G,
  grammarD02FishBonus,
  grammarOrderingKeys,
  grammarPenaltyForEntry,
  isBreakfastSweetEntry,
  isProteinShakeFamily,
  menuFoodEntryIndex,
  recipeCandidatesForMeal,
  recipeLever,
  recipeRank,
  resolveMealGrammarMode,
  scaleRecipe,
  substituteGramsByKcal,
  substituteGramsForMode,
  weekBreakfastSweetsCount,
  weekHasFish,
} from "@/lib/nutrition/v2/meal-grammar";
import { pendingMealItemRowsFromProduction } from "@/lib/nutrition/v2/persist-v2-plan-to-db";
import type { MealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";

// ── Catalogo finto ──────────────────────────────────────────────────────────────────

type RoleSpec = Partial<MenuFoodMealRoles["roles"]>;
type ScoreSpec = Partial<MenuFoodMealRoles["scores"]>;

function roles(
  r: RoleSpec,
  s: ScoreSpec,
  // `extra` accetta anche i campi v6 (breakfastChoRole, mainMealRole, substitutionGroup…):
  // assenti = fixture v5 pura (mealRolesHasV6 false → la grammatica usa il vocabolario v5).
  extra?: Partial<Omit<MenuFoodMealRoles, "roles" | "scores">>,
): MenuFoodMealRoles {
  return {
    roles: { breakfast: "NONE", snack: "NONE", lunch: "NONE", dinner: "NONE", ...r },
    scores: { breakfast: 0, snack: 0, lunch: 0, dinner: 0, preWorkout: 0, postWorkout: 0, ...s },
    macroRole: null,
    frequency: "COMMON",
    maxWeek: null,
    prepSpeed: null,
    ...extra,
  };
}

let nextFdc = 100;
function food(
  canonicalKey: string,
  labelIt: string,
  macro: { kcal: number; cho: number; pro: number; fat: number },
  mealRoles: MenuFoodMealRoles | undefined,
  extra?: Partial<MenuFoodEntry>,
): MenuFoodEntry {
  nextFdc += 1;
  return {
    canonicalKey,
    labelIt,
    servingBasis: "dry_grams",
    fdcId: nextFdc,
    kcalPer100g: macro.kcal,
    carbsPer100g: macro.cho,
    proteinPer100g: macro.pro,
    fatPer100g: macro.fat,
    isMeat: false,
    isFish: false,
    isAnimalProduct: false,
    mealRoles,
    ...extra,
  };
}

const MAIN = { lunch: "CHO_PRIMARY", dinner: "CHO_PRIMARY" } as const;
const MAIN_S = { lunch: 10, dinner: 10 } as const;

const oat = food("oat_dry", "Fiocchi d'avena", { kcal: 380, cho: 66, pro: 13, fat: 7 }, roles({ breakfast: "CHO_PRIMARY" }, { breakfast: 10 }, { macroRole: "CHO_PRIMARY" }), { rotationKey: "breakfast:oat" });
const bread = food("bread_white", "Pane", { kcal: 270, cho: 50, pro: 9, fat: 3 }, roles({ breakfast: "CHO_PRIMARY", snack: "CHO_PRIMARY" }, { breakfast: 9, snack: 8 }, { macroRole: "CHO_PRIMARY" }), { rotationKey: "breakfast:bread" });
const banana = food("banana", "Banana", { kcal: 89, cho: 23, pro: 1, fat: 0.3 }, roles({ breakfast: "CHO_SECONDARY", snack: "CHO_SECONDARY" }, { breakfast: 8, snack: 10 }, { macroRole: "CHO_SECONDARY", prepSpeed: 10 }), { rotationKey: "cho:banana" });
const yogurt = food("yogurt_greek", "Yogurt greco", { kcal: 60, cho: 4, pro: 10, fat: 0.5 }, roles({ breakfast: "PRO_PRIMARY", snack: "PRO_PRIMARY" }, { breakfast: 10, snack: 10 }, { macroRole: "PRO_PRIMARY", prepSpeed: 10 }), { rotationKey: "breakfast:yogurt", isAnimalProduct: true });
const almonds = food("almonds_raw", "Mandorle", { kcal: 580, cho: 20, pro: 21, fat: 50 }, roles({ breakfast: "FAT_COMPLEMENT", snack: "PRO_SECONDARY" }, { breakfast: 10, snack: 8 }, { macroRole: "FAT_PRIMARY", prepSpeed: 10 }), { rotationKey: "fat:mandorla" });
const pasta = food("pasta_dry", "Pasta di semola", { kcal: 350, cho: 71, pro: 12, fat: 1.5 }, roles({ breakfast: "EXCLUDE", ...MAIN }, { breakfast: 0, ...MAIN_S }, { macroRole: "CHO_PRIMARY" }), { rotationKey: "carb:pasta", carbFamily: "pasta" });
const rice = food("rice_dry", "Riso", { kcal: 360, cho: 79, pro: 7, fat: 0.6 }, roles(MAIN, MAIN_S, { macroRole: "CHO_PRIMARY" }), { rotationKey: "carb:riso", carbFamily: "riso" });
const junkZero = food("aaa_junk", "Cereale vietato a pranzo", { kcal: 360, cho: 79, pro: 7, fat: 0.6 }, roles({ lunch: "CHO_PRIMARY", dinner: "CHO_PRIMARY" }, { lunch: 0, dinner: 0 }, { macroRole: "CHO_PRIMARY" }), { rotationKey: "carb:junk" });
const chicken = food("chicken_breast", "Petto di pollo", { kcal: 110, cho: 0, pro: 23, fat: 1.2 }, roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, MAIN_S, { macroRole: "PRO_PRIMARY", maxWeek: 2 }), { rotationKey: "prot:pollo", isMeat: true });
const cod = food("cod_raw", "Merluzzo", { kcal: 82, cho: 0, pro: 18, fat: 0.7 }, roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, MAIN_S, { macroRole: "PRO_PRIMARY" }), { rotationKey: "prot:pesce", isFish: true });
const egg = food("egg_whole", "Uova", { kcal: 143, cho: 0.7, pro: 12.6, fat: 9.5 }, roles({ breakfast: "PRO_PRIMARY", lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, { breakfast: 10, ...MAIN_S }, { macroRole: "PRO_PRIMARY" }), { rotationKey: "breakfast:egg", isAnimalProduct: true });
const guanciale = food("pork_belly_cured", "Guanciale", { kcal: 655, cho: 0, pro: 12, fat: 69 }, roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, MAIN_S, { macroRole: "FAT_PRIMARY", frequency: "OCCASIONAL" }), { rotationKey: "prot:pancetta", isMeat: true });
const pecorino = food("pecorino_romano", "Pecorino", { kcal: 387, cho: 3.6, pro: 32, fat: 27 }, roles({ snack: "PRO_SECONDARY" }, { snack: 6 }, { macroRole: "MIXED" }), { rotationKey: "prot:formaggio_stagionato", isAnimalProduct: true });
const tomatoes = food("tomatoes_canned", "Pomodori pelati", { kcal: 24, cho: 4.5, pro: 1.2, fat: 0.2 }, roles({ lunch: "FIBER_MICRO_PRIMARY", dinner: "FIBER_MICRO_PRIMARY" }, MAIN_S, { macroRole: "FIBER_MICRO" }), { rotationKey: "veg:pomodori" });
const zucchini = food("zucchini_raw", "Zucchine", { kcal: 17, cho: 3, pro: 1.2, fat: 0.3 }, roles({ lunch: "FIBER_VEG", dinner: "FIBER_VEG" }, MAIN_S, { macroRole: "FIBER_MICRO" }), { rotationKey: "veg:zucchine" });
const lentils = food("lentils_cooked", "Lenticchie", { kcal: 116, cho: 20, pro: 9, fat: 0.4 }, roles({ lunch: "PRO_SECONDARY", dinner: "PRO_SECONDARY" }, MAIN_S, { macroRole: "PRO_SECONDARY" }), { rotationKey: "prot:legumi" });
const noRoles = food("zzz_admin_new", "Alimento nuovo senza score", { kcal: 100, cho: 0, pro: 22, fat: 1 }, undefined, { rotationKey: "prot:nuovo" });

function pools(): MenuFoodPoolMap {
  return new Map<string, MenuFoodEntry[]>([
    ["breakfast_cho", [oat, bread, banana, pasta]],
    ["breakfast_pro", [yogurt, egg]],
    ["breakfast_fat", [almonds]],
    ["lunch_carb", [junkZero, pasta, rice]],
    ["lunch_pro", [chicken, cod, egg, guanciale, lentils]],
    ["lunch_veg", [tomatoes, zucchini]],
    ["dinner_carb", [junkZero, pasta, rice]],
    ["dinner_pro", [chicken, cod, egg, guanciale, lentils]],
    ["dinner_veg", [tomatoes, zucchini]],
    ["snack_cho", [banana, bread]],
    ["snack_pro", [yogurt, almonds, pecorino]],
  ]);
}

const carbonara: MenuRecipe = {
  id: "r1",
  recipeKey: "pasta_alla_carbonara",
  labelIt: "Pasta alla carbonara",
  note: null,
  frequency: "COMMON",
  maxWeek: null,
  components: [
    { position: 1, canonicalKey: "pasta_dry", fdcId: pasta.fdcId, labelIt: "Pasta di semola", gramsPer100g: 35, isNeutral: false },
    { position: 2, canonicalKey: "egg_whole", fdcId: egg.fdcId, labelIt: "Uova", gramsPer100g: 14, isNeutral: false },
    { position: 3, canonicalKey: "pecorino_romano", fdcId: pecorino.fdcId, labelIt: "Pecorino", gramsPer100g: 8, isNeutral: false },
    { position: 4, canonicalKey: "pork_belly_cured", fdcId: guanciale.fdcId, labelIt: "Guanciale", gramsPer100g: 13, isNeutral: false },
    { position: 5, canonicalKey: null, fdcId: null, labelIt: "Acqua / brodo neutro", gramsPer100g: 30, isNeutral: true },
  ],
};
const risoPomodoro: MenuRecipe = {
  id: "r2",
  recipeKey: "riso_al_pomodoro",
  labelIt: "Riso al pomodoro",
  note: null,
  frequency: "COMMON",
  maxWeek: null,
  components: [
    { position: 1, canonicalKey: "rice_dry", fdcId: rice.fdcId, labelIt: "Riso", gramsPer100g: 30, isNeutral: false },
    { position: 2, canonicalKey: "tomatoes_canned", fdcId: tomatoes.fdcId, labelIt: "Pomodori pelati", gramsPer100g: 30, isNeutral: false },
    { position: 3, canonicalKey: null, fdcId: null, labelIt: "Acqua / brodo neutro", gramsPer100g: 40, isNeutral: true },
  ],
};

const requirements = { energy: { mealsKcal: 2400 } } as DailyNutritionRequirementsV2;

function slots(): MealPlanV2DietSlotBudget[] {
  return [
    { key: "breakfast", label: "Colazione", pct: 25, kcal: 600, carbs: 80, protein: 30, fat: 18 },
    { key: "lunch", label: "Pranzo", pct: 40, kcal: 950, carbs: 120, protein: 50, fat: 26 },
    { key: "dinner", label: "Cena", pct: 35, kcal: 850, carbs: 100, protein: 48, fat: 24 },
  ];
}

function req(planDate: string, overrides?: Partial<IntelligentMealPlanRequest>): IntelligentMealPlanRequest {
  return {
    athleteId: "ath-grammar",
    planDate,
    dietType: null,
    intolerances: null,
    allergies: null,
    foodExclusions: null,
    foodPreferences: null,
    supplements: null,
    aggregateInhibitors: null,
    pathwayTimingLines: [],
    trainingDayLines: [],
    routineDigest: null,
    contextLines: [],
    mealPlanSolverMeta: { dailyMealsKcalTotal: 2400, integrationLeverLines: [] },
    slots: [],
    ...overrides,
  } as IntelligentMealPlanRequest;
}

const emptyPools: FdcPoolMap = new Map();

function compose(planDate: string, opts?: { grammar?: boolean; recipes?: MenuRecipe[]; deny?: string[]; week?: Record<string, number>; request?: Partial<IntelligentMealPlanRequest> }) {
  return composeMealPlanV2(requirements, slots(), emptyPools, {
    denyFragments: opts?.deny ?? [],
    weeklyStapleCounts: opts?.week,
    request: req(planDate, opts?.request),
    menuFoodPools: pools(),
    ...(opts?.grammar ? { mealGrammar: { enabled: true, recipes: opts.recipes ?? [] } } : {}),
  });
}

const DATES = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);

// ── Gate ─────────────────────────────────────────────────────────────────────────────

test("gate: default shadow; off/on espliciti; allowlist accende on per singolo atleta solo in shadow", () => {
  assert.equal(resolveMealGrammarMode({}, "a"), "shadow");
  assert.equal(resolveMealGrammarMode({ NUTRITION_MEAL_GRAMMAR_MODE: "boh" }, "a"), "shadow");
  assert.equal(resolveMealGrammarMode({ NUTRITION_MEAL_GRAMMAR_MODE: " OFF " }, "a"), "off");
  assert.equal(resolveMealGrammarMode({ NUTRITION_MEAL_GRAMMAR_MODE: "on" }, "a"), "on");
  assert.equal(resolveMealGrammarMode({ NUTRITION_MEAL_GRAMMAR_ATHLETES: "x, a" }, "a"), "on");
  assert.equal(resolveMealGrammarMode({ NUTRITION_MEAL_GRAMMAR_ATHLETES: "x" }, "a"), "shadow");
  assert.equal(resolveMealGrammarMode({ NUTRITION_MEAL_GRAMMAR_MODE: "off", NUTRITION_MEAL_GRAMMAR_ATHLETES: "a" }, "a"), "off");
});

// ── A. Filtro secco ──────────────────────────────────────────────────────────────────

test("filtro: score 0 / EXCLUDE / ruolo non ammesso / max_week → esclusi; frequenza = penalità; senza score → passa", () => {
  const lunch = { meal: "lunch" as const, allowedRoles: new Set(["CHO_PRIMARY" as const]) };
  assert.equal(grammarPenaltyForEntry(junkZero, lunch, 0), null, "score 0 → fuori");
  assert.equal(grammarPenaltyForEntry(pasta, { meal: "breakfast" }, 0), null, "EXCLUDE a colazione → fuori (B05)");
  assert.equal(grammarPenaltyForEntry(chicken, lunch, 0), null, "PRO_PRIMARY non ammesso nel pool carb");
  assert.equal(grammarPenaltyForEntry(pasta, lunch, 0), 0);
  assert.equal(grammarPenaltyForEntry(chicken, { meal: "lunch" }, 1), 0);
  assert.equal(grammarPenaltyForEntry(chicken, { meal: "lunch" }, 2), null, "max_week 2 raggiunto");
  assert.equal(grammarPenaltyForEntry(guanciale, { meal: "lunch" }, 0), 400, "OCCASIONAL = penalità, non esclusione");
  assert.equal(grammarPenaltyForEntry(noRoles, lunch, 0), 0, "alimento senza riga di score passa");
  assert.equal(grammarPenaltyForEntry(banana, { meal: "snack", prepSpeedMin: 7 }, 0), 0);
  assert.equal(grammarPenaltyForEntry(pecorino, { meal: "snack", prepSpeedMin: 7 }, 0), 0, "prep_speed null → passa");
});

test("un alimento con score 0 a pranzo NON entra a pranzo (grammatica), mentre senza grammatica può entrare", () => {
  const withoutGrammar = new Set<string>();
  const withGrammar = new Set<string>();
  for (let seed = 0; seed < 12; seed += 1) {
    const a = pickStapleForPool({ poolKey: "lunch_carb", seed, menuEntries: [junkZero, pasta, rice] });
    if (a) withoutGrammar.add(a.entry.canonicalKey);
    const b = pickStapleForPool({
      poolKey: "lunch_carb",
      seed,
      menuEntries: [junkZero, pasta, rice],
      grammar: { meal: "lunch", allowedRoles: new Set(["CHO_PRIMARY"]) },
    });
    if (b) withGrammar.add(b.entry.canonicalKey);
  }
  assert.ok(withoutGrammar.has("aaa_junk"), "senza grammatica il cibo a score 0 è pescabile");
  assert.ok(!withGrammar.has("aaa_junk"), "con la grammatica non entra mai");
  assert.ok(withGrammar.has("pasta_dry") && withGrammar.has("rice_dry"));
});

test("max_week rispettato su 7 giorni: il pollo (max_week 2) esce al massimo 2 volte", () => {
  const week: Record<string, number> = {};
  let chickenDays = 0;
  for (const date of DATES.slice(0, 7)) {
    const plan = compose(date, { grammar: true, week: { ...week } });
    const items = plan.flatMap((s) => s.items);
    if (items.some((it) => it.canonicalKey === "chicken_breast")) chickenDays += 1;
    for (const k of mealRotationStaplesFromComposedItems(items)) week[k] = (week[k] ?? 0) + 1;
  }
  assert.ok(chickenDays <= 2, `pollo in ${chickenDays} giorni`);
  assert.ok(chickenDays > 0, "il pollo resta pescabile finché sotto il tetto");
});

// NOTA v6: dal sistema v6 (decisione 3, regola B03) l'ordinamento è a CHIAVI (tier
// mediterranean_priority → score del pasto → rotazione), non più penalità sottrattiva;
// per le entry senza dati v6 il tier viene dalla frequenza v5 — stesso esito atteso qui.
test("frequenza OCCASIONAL abbassa la priorità: a parità il COMMON vince, ma l'OCCASIONAL resta pescabile", () => {
  const entries = [guanciale, cod];
  for (let seed = 0; seed < 6; seed += 1) {
    const p = pickStapleForPool({ poolKey: "lunch_pro", seed, menuEntries: entries, grammar: { meal: "lunch" } });
    assert.equal(p?.entry.canonicalKey, "cod_raw");
  }
  const only = pickStapleForPool({ poolKey: "lunch_pro", seed: 0, menuEntries: [guanciale], grammar: { meal: "lunch" } });
  assert.equal(only?.entry.canonicalKey, "pork_belly_cured");
});

// ── B01/B02 colazione ────────────────────────────────────────────────────────────────

// NOTA v6: questo test usa fixture SENZA dati v6 → esercita il percorso di DEGRADAZIONE
// (vocabolario v5, com'era prima della regola B01 v6). Il comportamento con dati v6
// (filtro PRIMARY_COMPLEX, split 80-85/10-15, gerarchia B03) è nella sezione v6 in coda.
test("colazione B01/B02: CHO_PRIMARY copre 80-90% dei CHO strutturali, PRO da PRO_PRIMARY, niente pasta", () => {
  for (const date of DATES.slice(0, 10)) {
    const plan = compose(date, { grammar: true });
    const b = plan.find((s) => s.slot === "breakfast")!;
    const primary = b.items.filter((it) => it.foodRole === "cho_complex");
    const secondary = b.items.filter((it) => it.foodRole === "cho_simple");
    assert.equal(primary.length, 1, `${date}: una CHO primaria`);
    assert.equal(secondary.length, 1, `${date}: una CHO secondaria`);
    assert.equal(secondary[0]!.canonicalKey, "banana");
    assert.ok(!b.items.some((it) => it.canonicalKey === "pasta_dry"), "B05: niente pasta a colazione");
    const choP = primary[0]!.choG;
    const choS = secondary[0]!.choG;
    const share = choP / (choP + choS);
    assert.ok(share >= 0.78 && share <= 0.92, `${date}: quota primaria ${share.toFixed(2)}`);
    const pro = b.items.find((it) => it.foodRole === "protein_primary");
    assert.ok(pro && ["yogurt_greek", "egg_whole"].includes(pro.canonicalKey!), "B03");
    // Il totale CHO dello slot resta il target (la grammatica cambia QUALI cibi, non QUANTO).
    assert.ok(Math.abs(b.totals.choG - 80) <= 8, `${date}: CHO slot ${b.totals.choG}`);
  }
});

// ── B. Ricette ───────────────────────────────────────────────────────────────────────

test("leva della ricetta: matrice CHO → primo; piatto proteico (cotoletta) → secondo, il primo resta", () => {
  assert.equal(recipeLever({ cho: 26.5, pro: 10.6, fat: 8.8 }), "cho", "carbonara");
  assert.equal(recipeLever({ cho: 6.6, pro: 15.6, fat: 10.8 }), "protein", "cotoletta di pollo");
  const cotoletta: MenuRecipe = {
    id: "r4",
    recipeKey: "cotoletta_di_pollo",
    labelIt: "Cotoletta di pollo",
    note: null,
    components: [
      { position: 1, canonicalKey: "chicken_breast", fdcId: chicken.fdcId, labelIt: "Petto di pollo", gramsPer100g: 60, isNeutral: false },
      { position: 2, canonicalKey: "tomatoes_canned", fdcId: tomatoes.fdcId, labelIt: "Pomodori", gramsPer100g: 8, isNeutral: false },
      { position: 3, canonicalKey: "bread_white", fdcId: bread.fdcId, labelIt: "Pane", gramsPer100g: 12, isNeutral: false },
      { position: 4, canonicalKey: "pecorino_romano", fdcId: pecorino.fdcId, labelIt: "Pecorino", gramsPer100g: 8, isNeutral: false },
      { position: 5, canonicalKey: null, fdcId: null, labelIt: "Acqua / brodo neutro", gramsPer100g: 12, isNeutral: true },
    ],
  };
  let found = 0;
  for (const date of DATES) {
    const plan = compose(date, { grammar: true, recipes: [cotoletta] });
    for (const s of plan) {
      const it = s.items.find((x) => x.recipe?.recipeKey === "cotoletta_di_pollo");
      if (!it) continue;
      found += 1;
      assert.ok(s.items.some((x) => x.foodRole === "cho_complex"), `${date}: con la cotoletta il primo resta`);
      assert.ok(!s.items.some((x) => x.foodRole === "protein_primary"), `${date}: nessun secondo in più`);
      const target = slots().find((b) => b.key === s.slot)!;
      assert.ok(Math.abs(s.totals.choG - target.carbs) <= 12, `${date}: CHO ${s.totals.choG} vs ${target.carbs}`);
    }
  }
  assert.ok(found >= 3, `cotolette in 30 giorni: ${found}`);
});

test("candidate ricetta: risolte sugli ingredienti del catalogo, macro/100 g = Σ ingredienti, neutro a zero", () => {
  const idx = menuFoodEntryIndex(pools());
  const cands = recipeCandidatesForMeal({ recipes: [carbonara, risoPomodoro], entryIndex: idx, meal: "lunch" });
  assert.deepEqual(cands.map((c) => c.recipe.recipeKey), ["pasta_alla_carbonara", "riso_al_pomodoro"]);
  const c = cands[0]!;
  assert.equal(c.ingredients.length, 4, "il componente neutro non è un ingrediente");
  const expKcal = 0.35 * 350 + 0.14 * 143 + 0.08 * 387 + 0.13 * 655;
  assert.ok(Math.abs(c.per100.kcal - expKcal) < 0.2, `${c.per100.kcal} vs ${expKcal}`);
  const scaled = scaleRecipe(c, 300);
  assert.equal(scaled.components.length, 4);
  assert.equal(scaled.components[0]!.grams, 105);
  const sum = scaled.components.reduce((s, x) => s + x.kcal, 0);
  assert.ok(Math.abs(scaled.totals.kcal - sum) < 0.11);
  assert.equal(scaled.components[3]!.foodRole, "fat");
});

test("ricetta con ingrediente vietato → non scelta (deny sull'ingrediente; dieta vegetariana; dieta pescetariana)", () => {
  const idx = menuFoodEntryIndex(pools());
  const deny = recipeCandidatesForMeal({ recipes: [carbonara], entryIndex: idx, meal: "lunch", denyFragments: ["guanciale"] });
  assert.equal(deny.length, 0);
  const veg = recipeCandidatesForMeal({ recipes: [carbonara, risoPomodoro], entryIndex: idx, meal: "lunch", dietType: "vegetarian" });
  assert.deepEqual(veg.map((c) => c.recipe.recipeKey), ["riso_al_pomodoro"]);
  // Anche dentro il compositore: mai carbonara per un vegetariano, su 30 giorni.
  for (const date of DATES) {
    const plan = compose(date, { grammar: true, recipes: [carbonara, risoPomodoro], request: { dietType: "vegetarian" } });
    assert.ok(!plan.some((s) => s.items.some((it) => it.recipe?.recipeKey === "pasta_alla_carbonara")), date);
  }
});

test("ricetta non eleggibile al pasto: ingredienti tutti EXCLUDE/NONE a pranzo → fuori", () => {
  const smoothie: MenuRecipe = {
    id: "r3",
    recipeKey: "smoothie",
    labelIt: "Smoothie",
    note: null,
    components: [
      { position: 1, canonicalKey: "yogurt_greek", fdcId: yogurt.fdcId, labelIt: "Yogurt", gramsPer100g: 60, isNeutral: false },
      { position: 2, canonicalKey: "banana", fdcId: banana.fdcId, labelIt: "Banana", gramsPer100g: 40, isNeutral: false },
    ],
  };
  const idx = menuFoodEntryIndex(pools());
  assert.equal(recipeCandidatesForMeal({ recipes: [smoothie], entryIndex: idx, meal: "lunch" }).length, 0);
});

test("ricetta scelta → UN item con componenti, macro = Σ ingredienti, ingredienti registrati come usati, contorno/proteina per V02", () => {
  let found = 0;
  for (const date of DATES) {
    const plan = compose(date, { grammar: true, recipes: [carbonara, risoPomodoro] });
    const recipeItems = plan.flatMap((s) => s.items.filter((it) => it.recipe).map((it) => ({ slot: s.slot, it, s })));
    assert.ok(recipeItems.length <= 1, `${date}: al massimo una ricetta al giorno`);
    for (const { slot, it, s } of recipeItems) {
      found += 1;
      assert.ok(slot === "lunch" || slot === "dinner", "ricette solo nei pasti principali");
      assert.equal(it.fdcId, 0);
      assert.equal(it.foodRole, "composite_dish");
      assert.equal(it.rotationKey, `recipe:${it.recipe!.recipeKey}`);
      const comps = it.recipe!.components;
      assert.ok(comps.length >= 2 && !comps.some((c) => c.canonicalKey === null), "solo ingredienti veri, niente neutro");
      const sumKcal = comps.reduce((a, c) => a + c.kcal, 0);
      const sumG = comps.reduce((a, c) => a + c.grams, 0);
      assert.ok(Math.abs(sumKcal - it.kcal) < 0.11, `${date}: kcal item ${it.kcal} vs Σ ${sumKcal}`);
      assert.ok(sumG < it.grams, "il neutro sposta il peso ma non compare");
      assert.ok(it.grams >= 150 && it.grams % 10 === 0);
      // Tetto: la ricetta copre AL MASSIMO l'intero slot.
      const target = slots().find((b) => b.key === slot)!;
      assert.ok(it.kcal <= target.kcal + 1, `${date}: ricetta ${it.kcal} > slot ${target.kcal}`);
      // V02: niente doppia CHO (la ricetta È il primo); ingredienti non ripetuti nel giorno.
      assert.ok(!s.items.some((x) => x !== it && x.foodRole === "cho_complex"), "nessun secondo primo");
      const dayKeys = plan.flatMap((x) => x.items.map((y) => y.canonicalKey)).filter(Boolean);
      for (const c of comps) assert.ok(!dayKeys.includes(c.canonicalKey), `${date}: ${c.canonicalKey} ripetuto`);
      if (it.recipe!.recipeKey === "pasta_alla_carbonara") {
        assert.ok(s.items.some((x) => x.foodRole === "veg_condiment"), "carbonara senza verdura → contorno aggiunto (L03)");
      } else {
        assert.ok(!s.items.some((x) => x.foodRole === "veg_condiment"), "riso al pomodoro ha già la sua verdura");
        assert.ok(s.items.some((x) => x.foodRole === "protein_primary"), "riso al pomodoro povero di proteine → fonte PRO aggiunta");
      }
      // Slot totale entro il target kcal (+10%): la matrice mista non fa esplodere il pasto.
      assert.ok(s.totals.kcal <= target.kcal * 1.1, `${date}: slot ${s.totals.kcal} vs ${target.kcal}`);
    }
  }
  assert.ok(found >= 5, `ricette trovate in 30 giorni: ${found}`);
});

test("rotazione ricette: la memoria settimanale `recipe:*` evita la stessa ricetta e limita il totale a settimana", () => {
  const week: Record<string, number> = {};
  const used: string[] = [];
  for (const date of DATES.slice(0, 14)) {
    const plan = compose(date, { grammar: true, recipes: [carbonara, risoPomodoro], week: { ...week } });
    const items = plan.flatMap((s) => s.items);
    for (const it of items) if (it.recipe) used.push(it.recipe.recipeKey);
    for (const k of mealRotationStaplesFromComposedItems(items)) week[k] = (week[k] ?? 0) + 1;
  }
  const recipeKeys = Object.keys(week).filter((k) => k.startsWith("recipe:"));
  assert.ok(recipeKeys.length > 0, "le ricette contano nella memoria settimanale");
  assert.ok(used.length <= 3, `ricette in 14 giorni con memoria cumulata: ${used.length}`);
});

// ── Persist: ingredienti uno per riga, Σ kcal = item ─────────────────────────────────

test("persist: la ricetta diventa N righe-ingrediente con recipe_key, fdc_id veri e Σ kcal = kcal item", () => {
  const plan = DATES.map((d) => compose(d, { grammar: true, recipes: [carbonara, risoPomodoro] })).find((p) =>
    p.some((s) => s.items.some((it) => it.recipe)),
  )!;
  const production = {
    engine: "nutrition_v2",
    algorithmVersion: "nutrition_meal_plan_v2_production",
    taxonomyVersion: "test",
    requirements,
    dietMealSlotBudgets: slots(),
    composedMealPlan: plan,
  } as MealPlanV2Production;
  const rows = pendingMealItemRowsFromProduction(production);
  const slot = plan.find((s) => s.items.some((it) => it.recipe))!;
  const item = slot.items.find((it) => it.recipe)!;
  const recipeRows = rows.filter((r) => r.slot === slot.slot && r.recipeKey === item.recipe!.recipeKey);
  assert.equal(recipeRows.length, item.recipe!.components.length);
  assert.ok(recipeRows.every((r) => r.fdcId != null && r.fdcId > 0 && r.canonicalKey));
  assert.equal(recipeRows.reduce((s, r) => s + r.kcal, 0), Math.round(item.kcal), "Σ kcal righe = kcal item (payload)");
  // Le altre voci dello slot restano righe singole, senza recipe_key.
  const other = rows.filter((r) => r.slot === slot.slot && !r.recipeKey);
  assert.equal(other.length, slot.items.length - 1);
  assert.equal(rows.filter((r) => r.slot === slot.slot).length, slot.items.length - 1 + item.recipe!.components.length);
});

// ── E. off bit-identico; shadow/on ───────────────────────────────────────────────────

test("off: senza opzione (o enabled=false) la composizione è BIT-IDENTICA a prima", () => {
  for (const date of DATES.slice(0, 7)) {
    const legacy = compose(date);
    const disabled = composeMealPlanV2(requirements, slots(), emptyPools, {
      denyFragments: [],
      request: req(date),
      menuFoodPools: pools(),
      mealGrammar: { enabled: false, recipes: [carbonara] },
    });
    assert.equal(JSON.stringify(disabled), JSON.stringify(legacy));
    assert.ok(!legacy.some((s) => s.items.some((it) => it.foodRole || it.recipe)), "nessun campo nuovo sugli item storici");
  }
});

test("shadow non cambia il servito, on lo cambia — e la provenienza registra il confronto", () => {
  const date = DATES[3]!;
  const legacy = compose(date);
  const grammar = compose(date, { grammar: true, recipes: [carbonara, risoPomodoro] });
  assert.notEqual(JSON.stringify(grammar), JSON.stringify(legacy), "in on il piatto cambia (almeno la B02 a colazione)");
  // Emula la scelta del builder di produzione: shadow serve `legacy`, on serve `grammar`.
  const serve = (mode: "shadow" | "on") => (mode === "on" ? grammar : legacy);
  assert.equal(JSON.stringify(serve("shadow")), JSON.stringify(legacy));
  assert.equal(JSON.stringify(serve("on")), JSON.stringify(grammar));
  const prov = buildMealGrammarProvenance({ mode: "shadow", applied: false, before: legacy, after: grammar, recipesAvailable: 2 });
  assert.equal(prov.engine, "meal_grammar_v1");
  assert.equal(prov.applied, false);
  assert.ok(prov.changedSlots >= 1);
  const b = prov.slots.find((s) => s.key === "breakfast")!;
  assert.ok(b.changed && b.before && b.after && b.after.items.length === b.before.items.length + 1);
  // I target dello slot restano quelli: la grammatica cambia QUALI cibi, non QUANTO — le
  // leve del solver (CHO, PRO) chiudono sul target come prima. (Le kcal a pranzo/cena
  // dipendono dal grasso della fonte proteica scelta: l'assemblaggio storico non ha una
  // leva grassi nei pasti principali, e questo lavoro non la aggiunge.)
  for (const s of prov.slots) {
    if (!s.after) continue;
    const target = slots().find((b) => b.key === s.key)!;
    assert.ok(Math.abs(s.after.choG - target.carbs) <= 10, `${s.key}: CHO ${s.after.choG} vs ${target.carbs}`);
    assert.ok(Math.abs(s.after.proG - target.protein) <= 8, `${s.key}: PRO ${s.after.proG} vs ${target.protein}`);
  }
});

test("mealRotationStaplesFromComposedItems: la ricetta (senza canonical_key) conta con la sua rotation key", () => {
  const items: MealPlanV2ComposedSlot["items"] = [
    { fdcId: 0, description: "Pasta alla carbonara", grams: 300, kcal: 700, choG: 80, proG: 30, fatG: 28, rotationKey: "recipe:pasta_alla_carbonara" },
    { fdcId: 5, description: "Zucchine", grams: 120, kcal: 20, choG: 3, proG: 1, fatG: 0, canonicalKey: "zucchini_raw", rotationKey: "veg:zucchine" },
  ];
  assert.deepEqual(mealRotationStaplesFromComposedItems(items).sort(), ["recipe:pasta_alla_carbonara", "veg:zucchine"]);
});

// ── Riparazione giro 1: mai il pool USDA grezzo sotto grammatica; B02 dalla frutta;
//    regola 7 filtrata; semantica max_week ────────────────────────────────────────────

function rawHit(id: number, desc: string, kcal: number, cho: number, pro: number, fat = 2): FdcFoodBrowseHit {
  return {
    fdcId: id,
    description: desc,
    kcalPer100g: kcal,
    proteinPer100g: pro,
    carbsPer100g: cho,
    fatPer100g: fat,
    tags: {
      mealCourse: [],
      foodFamily: [],
      macroDominant: [],
      slotFit: ["breakfast", "lunch", "dinner"],
      dietProfile: ["mediterranean"],
      dietExclude: [],
      mealRole: [],
      aminoProfile: [],
      nutrientDensity: [],
      classifierVersion: "test",
    },
    tagSource: "db",
  };
}

/** Pool USDA grezzi NON vuoti per tutti gli slot: è il caso di prod, non `emptyPools`. */
function rawPools(): FdcPoolMap {
  const cho = [rawHit(9001, "Cereals ready-to-eat, KELLOGG'S FROOT LOOPS", 380, 87, 5, 3), rawHit(9002, "Rice, white, cooked", 130, 28, 2.7, 0.3)];
  const pro = [rawHit(9003, "Chicken, broilers or fryers, breast, meat only, cooked", 165, 0, 31, 3.6)];
  const veg = [rawHit(9004, "Broccoli, cooked", 35, 7, 2.4, 0.4)];
  const fat = [rawHit(9005, "Oil, olive", 884, 0, 0, 100)];
  return new Map<string, FdcFoodBrowseHit[]>([
    ["breakfast_cho", cho],
    ["breakfast_pro", pro],
    ["breakfast_fat", fat],
    ["lunch_carb", cho],
    ["lunch_pro", pro],
    ["lunch_veg", veg],
    ["dinner_carb", cho],
    ["dinner_pro", pro],
    ["dinner_veg", veg],
    ["snack_cho", cho],
    ["snack_pro", pro],
  ]);
}

const honey = food("honey", "Miele", { kcal: 304, cho: 82, pro: 0.3, fat: 0 }, roles({ breakfast: "CHO_SECONDARY" }, { breakfast: 6 }, { macroRole: "CHO_SECONDARY", frequency: "ROTATION" }), { rotationKey: "breakfast:miele" });
const apple = food("apple_raw", "Mela", { kcal: 52, cho: 14, pro: 0.3, fat: 0.2 }, roles({ breakfast: "CHO_SECONDARY", snack: "CHO_SECONDARY" }, { breakfast: 7, snack: 10 }, { macroRole: "CHO_SECONDARY", prepSpeed: 10 }), { rotationKey: "cho:mela" });
const snackNoScore = food("zzz_snack_new", "Barretta nuova senza score", { kcal: 400, cho: 60, pro: 8, fat: 12 }, undefined, { rotationKey: "cho:barretta" });

function composeWith(menu: MenuFoodPoolMap, raw: FdcPoolMap, date: string, opts?: { grammar?: boolean; week?: Record<string, number>; diagnostics?: string[]; slots?: MealPlanV2DietSlotBudget[]; request?: Partial<IntelligentMealPlanRequest> }) {
  return composeMealPlanV2(requirements, opts?.slots ?? slots(), raw, {
    denyFragments: [],
    weeklyStapleCounts: opts?.week,
    request: req(date, opts?.request),
    menuFoodPools: menu,
    ...(opts?.grammar ? { mealGrammar: { enabled: true, recipes: [], diagnostics: opts.diagnostics } } : {}),
  });
}

/** Ogni item servito sotto grammatica viene dal catalogo (canonical_key) o è una ricetta: mai USDA grezzo. */
function assertNoRawItems(plan: MealPlanV2ComposedSlot[], label: string) {
  for (const s of plan) {
    for (const it of s.items) {
      assert.ok(it.canonicalKey || it.recipe, `${label} — ${s.slot}: «${it.description}» (fdc ${it.fdcId}) è un alimento USDA grezzo`);
    }
  }
}

test("rilievo 1 (B02): breakfast_cho esaurito da rotazione + raw pool NON vuoto → niente Froot Loops, linea B02 saltata e flag", () => {
  const menu = new Map<string, MenuFoodEntry[]>([
    ...pools(),
    ["breakfast_cho", [oat, honey]],
    ["snack_cho", [bread]],
  ]);
  const legacy = composeWith(menu, rawPools(), DATES[0]!, { week: { "breakfast:miele": 3 } });
  const diagnostics: string[] = [];
  const plan = composeWith(menu, rawPools(), DATES[0]!, { grammar: true, week: { "breakfast:miele": 3 }, diagnostics });
  const b = plan.find((s) => s.slot === "breakfast")!;
  assert.ok(!b.items.some((it) => /FROOT|KELLOGG/i.test(it.description)), "nessun alimento USDA nella colazione");
  assert.ok(!b.items.some((it) => it.foodRole === "cho_simple"), "la linea B02 facoltativa salta");
  assert.ok(diagnostics.includes("optional_line_skipped:breakfast:breakfast_cho"), `flag mancante: ${diagnostics.join(",")}`);
  assert.equal(b.items.length, legacy.find((s) => s.slot === "breakfast")!.items.length, "colazione = B01 + PRO + FAT come la storica");
  assertNoRawItems(plan, "on");
});

test("rilievo 2 (B02): la frutta di snack_cho con ruolo colazione CHO_SECONDARY è la fonte secondaria; miele ROTATION resta rotazione", () => {
  const menu = new Map<string, MenuFoodEntry[]>([
    ...pools(),
    ["breakfast_cho", [oat, honey]],
    ["snack_cho", [apple, snackNoScore, bread]],
  ]);
  const union = breakfastSecondaryMenuEntries(menu).map((e) => e.canonicalKey);
  assert.deepEqual(union, ["oat_dry", "honey", "apple_raw"], "unione: breakfast_cho + solo CHO_SECONDARY esplicite di snack_cho (mai il cibo senza score)");
  let appleDays = 0;
  let honeyDays = 0;
  for (const date of DATES.slice(0, 10)) {
    const plan = composeWith(menu, rawPools(), date, { grammar: true });
    const b = plan.find((s) => s.slot === "breakfast")!;
    const sec = b.items.filter((it) => it.foodRole === "cho_simple");
    assert.equal(sec.length, 1, `${date}: una linea B02`);
    if (sec[0]!.canonicalKey === "apple_raw") appleDays += 1;
    if (sec[0]!.canonicalKey === "honey") honeyDays += 1;
    assertNoRawItems(plan, date);
  }
  assert.equal(appleDays, 10, `la mela COMMON vince sempre sul miele ROTATION (mela ${appleDays}, miele ${honeyDays})`);
});

test("rilievo 1 (lunch_pro): pool proteico svuotato dai tetti + raw pool NON vuoto → ripiego dal catalogo (tetto rotazione allentato), mai USDA; esaurito del tutto → linea saltata", () => {
  // Solo due fonti proteiche, entrambe alla ROTATION_MAX (3): la settimana le ha già esaurite.
  const menu = new Map<string, MenuFoodEntry[]>([...pools(), ["lunch_pro", [cod, egg]], ["dinner_pro", [cod, egg]]]);
  const week = { "prot:pesce": 3, "breakfast:egg": 3 };
  const diagnostics: string[] = [];
  const plan = composeWith(menu, rawPools(), DATES[1]!, { grammar: true, week, diagnostics });
  const lunch = plan.find((s) => s.slot === "lunch")!;
  const pro = lunch.items.find((it) => it.foodRole === "protein_primary");
  assert.ok(pro && ["cod_raw", "egg_whole"].includes(pro.canonicalKey!), `la proteina viene dal catalogo: ${pro?.description}`);
  assert.ok(diagnostics.some((f) => f.startsWith("week_caps_relaxed:lunch:lunch_pro")), `flag: ${diagnostics.join(",")}`);
  assertNoRawItems(plan, "relaxed");

  // Il max_week ESPLICITO di Mario resta duro anche nel ripiego: pollo (max_week 2) già a 2
  // → pool davvero esaurito → linea saltata + flag, e comunque niente USDA.
  const menu2 = new Map<string, MenuFoodEntry[]>([...pools(), ["lunch_pro", [chicken]], ["dinner_pro", [chicken]]]);
  const diag2: string[] = [];
  const plan2 = composeWith(menu2, rawPools(), DATES[1]!, { grammar: true, week: { "prot:pollo": 2 }, diagnostics: diag2 });
  const lunch2 = plan2.find((s) => s.slot === "lunch")!;
  assert.ok(!lunch2.items.some((it) => it.foodRole === "protein_primary"), "nessuna linea proteica");
  assert.ok(diag2.includes("pool_exhausted:lunch:lunch_pro"), `flag: ${diag2.join(",")}`);
  assertNoRawItems(plan2, "exhausted");
});

test("senza grammatica il rawPool resta il fallback storico (bit-identico): stesso pool esaurito → alimento USDA come prima", () => {
  const menu = new Map<string, MenuFoodEntry[]>([...pools(), ["lunch_pro", [chicken]], ["dinner_pro", [chicken]]]);
  const legacy = composeWith(menu, rawPools(), DATES[1]!, { week: { "prot:pollo": 3 } });
  const lunch = legacy.find((s) => s.slot === "lunch")!;
  assert.ok(lunch.items.some((it) => !it.canonicalKey && /Chicken, broilers/.test(it.description)), "storico: USDA grezzo quando il catalogo è esaurito");
  // Off bit-identico anche con raw pool NON vuoti (il caso di prod, non solo `emptyPools`).
  for (const date of DATES.slice(0, 7)) {
    const a = composeWith(pools(), rawPools(), date, { week: { "prot:pollo": 3, "breakfast:oat": 3 } });
    const b = composeMealPlanV2(requirements, slots(), rawPools(), {
      denyFragments: [],
      weeklyStapleCounts: { "prot:pollo": 3, "breakfast:oat": 3 },
      request: req(date),
      menuFoodPools: pools(),
      mealGrammar: { enabled: false, recipes: [carbonara] },
    });
    assert.equal(JSON.stringify(a), JSON.stringify(b), `${date}: off ≠ storico con raw pool`);
  }
});

test("rilievo 3 (regola 7): con CHO ≥130 g il pane secondario (score 0 a pranzo nei dati) NON entra sotto grammatica; senza grammatica entra", () => {
  const heavy: MealPlanV2DietSlotBudget[] = [
    { key: "breakfast", label: "Colazione", pct: 20, kcal: 600, carbs: 80, protein: 30, fat: 18 },
    { key: "lunch", label: "Pranzo", pct: 45, kcal: 1300, carbs: 190, protein: 55, fat: 30 },
    { key: "dinner", label: "Cena", pct: 35, kcal: 850, carbs: 100, protein: 48, fat: 24 },
  ];
  let breadLegacyDays = 0;
  for (const date of DATES.slice(0, 10)) {
    const legacy = composeWith(pools(), rawPools(), date, { slots: heavy });
    const lunchL = legacy.find((s) => s.slot === "lunch")!;
    if (lunchL.items.some((it) => it.canonicalKey === "bread_white")) breadLegacyDays += 1;
    const on = composeWith(pools(), rawPools(), date, { grammar: true, slots: heavy });
    const lunchOn = on.find((s) => s.slot === "lunch")!;
    assert.ok(!lunchOn.items.some((it) => it.canonicalKey === "bread_white"), `${date}: pane a pranzo (score 0) sotto grammatica`);
    assert.ok(!lunchOn.items.some((it) => it.canonicalKey === "aaa_junk"), `${date}: score 0 mai a pranzo, nemmeno nei giorni pesanti`);
    assertNoRawItems(on, date);
  }
  assert.ok(breadLegacyDays > 0, "controprova: la regola 7 storica aggiunge il pane nei giorni pesanti");
});

test("rilievo 4 (max_week): il conteggio è di FAMIGLIA (limite superiore, mai più permissivo): fratello di rotation_key a 2 → max_week 2 scatta", () => {
  const twin = food("chicken_thigh", "Coscia di pollo", { kcal: 180, cho: 0, pro: 20, fat: 10 }, roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, MAIN_S, { macroRole: "PRO_PRIMARY", maxWeek: 2 }), { rotationKey: "prot:pollo", isMeat: true });
  // La memoria persistita conosce solo la famiglia `prot:pollo` (R01): 2 usi = tetto raggiunto per entrambi.
  assert.equal(grammarPenaltyForEntry(twin, { meal: "lunch" }, 2), null);
  assert.equal(grammarPenaltyForEntry(chicken, { meal: "lunch" }, 2), null);
  assert.equal(grammarPenaltyForEntry(chicken, { meal: "lunch" }, 1), 0);
  const p = pickStapleForPool({ poolKey: "lunch_pro", seed: 0, menuEntries: [chicken, twin, cod], grammar: { meal: "lunch" }, dayCtx: { weekStapleCounts: { "prot:pollo": 2 } } });
  assert.equal(p?.entry.canonicalKey, "cod_raw");
  // Il ripiego relaxWeekCaps allenta SOLO il tetto di rotazione nostro, non il max_week di Mario.
  const relaxed = pickStapleForPool({ poolKey: "lunch_pro", seed: 0, menuEntries: [chicken, twin, cod], grammar: { meal: "lunch", relaxWeekCaps: true }, dayCtx: { weekStapleCounts: { "prot:pollo": 2, "prot:pesce": 3 } } });
  assert.equal(relaxed?.entry.canonicalKey, "cod_raw");
});

// ── Riparazione giro 2: gli ingredienti portano i loro vincoli settimanali DENTRO la ricetta ──

test("rilievo A: la ricetta NON scavalca il max_week dei suoi ingredienti (pancetta a 2 → carbonara fuori)", () => {
  const idx = menuFoodEntryIndex(pools());
  // Il pick semplice blocca il guanciale/pancetta al terzo uso settimanale…
  const pancettaCapped = food("pork_belly_cured", "Guanciale", { kcal: 655, cho: 0, pro: 12, fat: 69 },
    roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, MAIN_S, { macroRole: "FAT_PRIMARY", frequency: "OCCASIONAL", maxWeek: 2 }),
    { rotationKey: "prot:pancetta", isMeat: true });
  idx.set("pork_belly_cured", pancettaCapped);
  const week = { "prot:pancetta": 2, pork_belly_cured: 2 };
  assert.equal(grammarPenaltyForEntry(pancettaCapped, { meal: "lunch" }, 2), null, "pick semplice: bloccato a max_week");
  // …e la ricetta che lo contiene deve essere bloccata allo stesso modo, non passargli di sponda.
  const cands = recipeCandidatesForMeal({ recipes: [carbonara, risoPomodoro], entryIndex: idx, meal: "lunch", weekStapleCounts: week });
  assert.deepEqual(cands.map((c) => c.recipe.recipeKey), ["riso_al_pomodoro"], "carbonara esclusa: la pancetta è al tetto");
  // Sotto il tetto la carbonara torna eleggibile.
  const under = recipeCandidatesForMeal({ recipes: [carbonara, risoPomodoro], entryIndex: idx, meal: "lunch", weekStapleCounts: { "prot:pancetta": 1 } });
  assert.ok(under.some((c) => c.recipe.recipeKey === "pasta_alla_carbonara"));
});

test("rilievo A-bis: anche il tetto di FAMIGLIA (ROTATION_MAX_WEEK_USES) di un ingrediente blocca la ricetta", () => {
  const idx = menuFoodEntryIndex(pools());
  // pasta_dry ha rotationKey carb:pasta nella fixture: famiglia già usata ROTATION_MAX_WEEK_USES volte.
  const pastaEntry = idx.get("pasta_dry")!;
  assert.ok(pastaEntry.rotationKey, "la fixture pasta deve avere una famiglia");
  const week = { [pastaEntry.rotationKey!]: 99 };
  const cands = recipeCandidatesForMeal({ recipes: [carbonara, risoPomodoro], entryIndex: idx, meal: "lunch", weekStapleCounts: week });
  assert.ok(!cands.some((c) => c.recipe.recipeKey === "pasta_alla_carbonara"), "carbonara fuori: la famiglia pasta è al tetto");
});

test("rilievo B: la memoria in-memory conta ANCHE gli ingredienti della ricetta (come il percorso DB)", () => {
  const items: MealPlanV2ComposedSlot["items"] = [
    {
      fdcId: 0, description: "Pasta alla carbonara", grams: 300, kcal: 700, choG: 80, proG: 30, fatG: 28,
      rotationKey: "recipe:pasta_alla_carbonara",
      components: [
        { canonicalKey: "pasta_dry", rotationKey: "carb:pasta", labelIt: "Pasta di semola", grams: 105, kcal: 367, choG: 75, proG: 13, fatG: 1.5, fdcId: 1, foodRole: "cho" },
        { canonicalKey: "pork_belly_cured", rotationKey: "prot:pancetta", labelIt: "Guanciale", grams: 39, kcal: 255, choG: 0, proG: 5, fatG: 27, fdcId: 4, foodRole: "fat" },
      ],
    } as MealPlanV2ComposedSlot["items"][number],
  ];
  const keys = mealRotationStaplesFromComposedItems(items).sort();
  assert.deepEqual(keys, ["carb:pasta", "prot:pancetta", "recipe:pasta_alla_carbonara"],
    "la carbonara del lunedì è pasta e pancetta anche per il martedì");
});

// ── Riparazione giro 2 (osservazione del verificatore): ricetta CHO + complemento V02 → il
//    pasto resta DENTRO il target, il secondo non si somma sopra ────────────────────────

test("ricetta a leva CHO + complemento proteico: il pasto resta entro il target (nessun +20-38%)", () => {
  // Il riso al pomodoro è povero di proteine → V02 aggiunge sempre una fonte PRO.
  // Prima del fix: ricetta risolta a TUTTO lo slot + pesce sopra → slot a +20-38%.
  let checked = 0;
  for (const date of DATES) {
    const plan = compose(date, { grammar: true, recipes: [risoPomodoro] });
    for (const s of plan) {
      const rec = s.items.find((it) => it.recipe?.recipeKey === "riso_al_pomodoro");
      if (!rec) continue;
      const pro = s.items.find((x) => x.foodRole === "protein_primary");
      if (!pro) continue;
      checked += 1;
      const target = slots().find((b) => b.key === s.slot)!;
      // Il complemento c'è E il totale sta dentro il target (+5% di tolleranza del solver a step).
      assert.ok(s.totals.kcal <= target.kcal * 1.05, `${date} ${s.slot}: ${s.totals.kcal} vs target ${target.kcal}`);
      // La ricetta ha lasciato spazio al secondo: non occupa più l'intero slot.
      assert.ok(rec.kcal <= target.kcal * 0.75, `${date}: la ricetta (${rec.kcal}) non lascia spazio al secondo su ${target.kcal}`);
    }
  }
  assert.ok(checked >= 3, `casi ricetta+complemento osservati in 30 giorni: ${checked}`);
});

// ── D02 (SOFT): a cena, settimana senza pesce → il pesce sale in cima; con pesce già in
//    memoria il bonus si spegne; mai a pranzo; mai sopra i verdetti ────────────────────

test("D02: bonus pesce solo a CENA e solo finché la settimana è senza pesce", () => {
  assert.equal(grammarD02FishBonus(cod, { meal: "dinner" }, {}), GRAMMAR_D02_FISH_DINNER_BONUS);
  assert.equal(grammarD02FishBonus(cod, { meal: "dinner" }, { "prot:pesce": 1 }), 0, "pesce già in settimana → niente bonus");
  assert.equal(grammarD02FishBonus(cod, { meal: "lunch" }, {}), 0, "D02 vive sotto CENA");
  assert.equal(grammarD02FishBonus(chicken, { meal: "dinner" }, {}), 0, "non è pesce");
  assert.equal(weekHasFish({ "prot:pesce_azzurro": 2 }), true);
  assert.equal(weekHasFish({ "prot:pollo": 3 }), false);
});

test("D02 nel pick: cena a settimana vuota → il merluzzo batte il pollo; con pesce già servito → torna la rotazione normale", () => {
  const entries = [chicken, cod, egg];
  const empty = pickStapleForPool({ poolKey: "dinner_pro", seed: 3, menuEntries: entries, grammar: { meal: "dinner" }, dayCtx: { weekStapleCounts: {} } });
  assert.equal(empty?.entry.canonicalKey, "cod_raw", "settimana senza pesce: D02 porta il pesce in cima");
  const withFish = pickStapleForPool({ poolKey: "dinner_pro", seed: 3, menuEntries: entries, grammar: { meal: "dinner" }, dayCtx: { weekStapleCounts: { "prot:pesce": 1 } } });
  assert.notEqual(withFish?.entry.canonicalKey, undefined);
  // Il bonus NON scavalca i verdetti: merluzzo con dieta vegetariana resta fuori.
  const veg = pickStapleForPool({ poolKey: "dinner_pro", seed: 3, menuEntries: entries, grammar: { meal: "dinner" }, dayCtx: { weekStapleCounts: {} }, dietType: "vegetarian" });
  assert.notEqual(veg?.entry.canonicalKey, "cod_raw", "vegetariano: il pesce non entra nemmeno con D02");
});


// ── frequency / max_week della RICETTA (pannello admin): verdetto e preferenza ─────────

test("max_week della ricetta è un verdetto: a 1 uso settimanale con max_week 1 la ricetta non è più candidata", () => {
  const idx = menuFoodEntryIndex(pools());
  const pizzaLike: MenuRecipe = { ...risoPomodoro, id: "r9", recipeKey: "riso_raro", labelIt: "Riso raro", maxWeek: 1 };
  const fresh = recipeCandidatesForMeal({ recipes: [pizzaLike], entryIndex: idx, meal: "lunch", weekStapleCounts: {} });
  assert.equal(fresh.length, 1);
  const used = recipeCandidatesForMeal({ recipes: [pizzaLike], entryIndex: idx, meal: "lunch", weekStapleCounts: { "recipe:riso_raro": 1 } });
  assert.equal(used.length, 0, "già servita una volta, max_week 1 → fuori");
});

test("frequency della ricetta: a parità di conteggio la COMMON precede la ROTATION che precede la OCCASIONAL, e il tier del sorteggio non le mescola", () => {
  const idx = menuFoodEntryIndex(pools());
  const common: MenuRecipe = { ...risoPomodoro, id: "c1", recipeKey: "riso_comune", labelIt: "Riso comune", frequency: "COMMON" };
  const rot: MenuRecipe = { ...risoPomodoro, id: "c2", recipeKey: "riso_rotazione", labelIt: "Riso rotazione", frequency: "ROTATION" };
  const occ: MenuRecipe = { ...risoPomodoro, id: "c3", recipeKey: "riso_occasionale", labelIt: "Riso occasionale", frequency: "OCCASIONAL" };
  const cands = recipeCandidatesForMeal({ recipes: [occ, rot, common], entryIndex: idx, meal: "lunch", weekStapleCounts: {} });
  assert.deepEqual(cands.map((c) => c.recipe.recipeKey), ["riso_comune", "riso_rotazione", "riso_occasionale"]);
  // Su molti seed, con tutte a zero, esce SEMPRE la COMMON: le altre non sono nel tier.
  let picked = new Set<string>();
  for (let seed = 0; seed < 60; seed += 1) {
    const c = chooseRecipeForSlot({ candidates: cands, seed, slotKey: "lunch", weekStapleCounts: {}, recipeAlreadyToday: false });
    if (c) picked.add(c.recipe.recipeKey);
  }
  assert.deepEqual([...picked], ["riso_comune"], `tier mescolato: ${[...picked].join(",")}`);
  // Quando la COMMON è già stata servita, il tier passa alla ROTATION (weekCount 0 < 1).
  picked = new Set();
  for (let seed = 0; seed < 60; seed += 1) {
    const c2 = recipeCandidatesForMeal({ recipes: [occ, rot, common], entryIndex: idx, meal: "lunch", weekStapleCounts: { "recipe:riso_comune": 1 } });
    const c = chooseRecipeForSlot({ candidates: c2, seed, slotKey: "lunch", weekStapleCounts: { "recipe:riso_comune": 1 }, recipeAlreadyToday: false });
    if (c) picked.add(c.recipe.recipeKey);
  }
  assert.deepEqual([...picked], ["riso_rotazione"]);
});

// ═══ SISTEMA RUOLI v6 (file Mario v6, GENERATIVE_RULES_V2) ═════════════════════════════
// Catalogo finto con ENTRAMBI i vocabolari (come il DB dopo la migrazione 20260820090100:
// colonne v5 intatte, colonne v6 valorizzate): dove confliggono deve vincere la v6.

const oat6 = food("oat6", "Avena", { kcal: 380, cho: 66, pro: 13, fat: 7 }, roles({ breakfast: "CHO_PRIMARY" }, { breakfast: 10 }, { breakfastChoRole: "PRIMARY_COMPLEX", mediterraneanPriority: "PRIMARY", substitutionGroup: "BREAKFAST_COMPLEX_CARB" }), { rotationKey: "breakfast:oat6" });
const bread6 = food("bread6", "Pane bianco", { kcal: 270, cho: 50, pro: 9, fat: 3 }, roles({ breakfast: "CHO_PRIMARY" }, { breakfast: 10 }, { breakfastChoRole: "PRIMARY_COMPLEX", mediterraneanPriority: "PRIMARY", substitutionGroup: "BREAD_BASED_CARB" }), { rotationKey: "breakfast:bread6" });
const apple6 = food("apple6", "Mela", { kcal: 52, cho: 14, pro: 0.3, fat: 0.2 }, roles({ breakfast: "CHO_SECONDARY", snack: "CHO_SECONDARY" }, { breakfast: 7, snack: 9 }, { breakfastChoRole: "SECONDARY_SIMPLE", snackRole: "FAST_CARB", mediterraneanPriority: "COMMON", substitutionGroup: "FRUIT", prepSpeed: 10 }));
const sweet6 = food("sweet6", "Cornetto", { kcal: 410, cho: 45, pro: 8, fat: 22 }, roles({ breakfast: "CHO_SECONDARY" }, { breakfast: 6 }, { breakfastChoRole: "SECONDARY_MIXED", mediterraneanPriority: "OCCASIONAL", substitutionGroup: "BREAKFAST_SWEET_OCCASIONAL", frequency: "OCCASIONAL" }), { rotationKey: "breakfast:cornetto6" });
const yog6 = food("yog6", "Yogurt greco", { kcal: 60, cho: 4, pro: 10, fat: 0.5 }, roles({ breakfast: "PRO_PRIMARY", snack: "PRO_PRIMARY" }, { breakfast: 10, snack: 9 }, { breakfastProteinRole: "PRIMARY", snackRole: "FAST_PROTEIN", mediterraneanPriority: "PRIMARY", substitutionGroup: "BREAKFAST_PROTEIN_DAIRY", prepSpeed: 10 }), { isAnimalProduct: true });
// B06: la v5 direbbe PRO_PRIMARY con score 8, la v6 dice NONE (i formaggi NON sono
// proteina di colazione): il divieto è nei DATI e la v6 vince.
const ricotta6 = food("ricotta6", "Ricotta", { kcal: 140, cho: 3, pro: 11, fat: 9 }, roles({ breakfast: "PRO_PRIMARY" }, { breakfast: 8 }, { breakfastProteinRole: "NONE", mainMealRole: "SECONDARY_PROTEIN", mediterraneanPriority: "COMMON", substitutionGroup: "CHEESE_PROTEIN" }), { isAnimalProduct: true });
const nuts6 = food("nuts6", "Mandorle", { kcal: 580, cho: 20, pro: 21, fat: 50 }, roles({ breakfast: "FAT_COMPLEMENT", snack: "PRO_SECONDARY" }, { breakfast: 10, snack: 9 }, { breakfastFatRole: "PRIMARY", snackRole: "FAST_FAT_PRO", mediterraneanPriority: "PRIMARY", substitutionGroup: "BREAKFAST_FAT_NUTS", prepSpeed: 10 }));
const seeds6 = food("seeds6", "Semi di chia", { kcal: 486, cho: 42, pro: 17, fat: 31 }, roles({ breakfast: "FAT_COMPLEMENT" }, { breakfast: 6 }, { breakfastFatRole: "SECONDARY", mediterraneanPriority: "COMMON", substitutionGroup: "BREAKFAST_FAT_SEEDS", prepSpeed: 10 }));
// M04: i valori sono ESATTAMENTE quelli della regola nei dati v6 (EVO 10, avocado 8,
// altri oli 4/LIMITED): l'ordinamento tier+score fa la gerarchia, zero hardcode.
const evo6 = food("evo6", "Olio EVO", { kcal: 884, cho: 0, pro: 0, fat: 100 }, roles({}, { lunch: 10, dinner: 10 }, { mainMealRole: "FAT_CONDIMENT", mediterraneanPriority: "COMMON", substitutionGroup: "FAT_CONDIMENT" }));
const avoc6 = food("avoc6", "Avocado", { kcal: 160, cho: 9, pro: 2, fat: 15 }, roles({}, { lunch: 8, dinner: 8 }, { mainMealRole: "FAT_CONDIMENT", mediterraneanPriority: "COMMON", substitutionGroup: "FAT_CONDIMENT" }));
const oilseed6 = food("oilseed6", "Olio di semi", { kcal: 884, cho: 0, pro: 0, fat: 100 }, roles({}, { lunch: 4, dinner: 4 }, { mainMealRole: "FAT_CONDIMENT", mediterraneanPriority: "LIMITED", substitutionGroup: "FAT_CONDIMENT" }));
const pasta6 = food("pasta6", "Pasta", { kcal: 350, cho: 71, pro: 12, fat: 1.5 }, roles({ lunch: "CHO_PRIMARY", dinner: "CHO_PRIMARY" }, { lunch: 10, dinner: 10, snack: 0 }, { mainMealRole: "PRIMARY_COMPLEX_CARB", snackRole: "LOW", mediterraneanPriority: "PRIMARY", substitutionGroup: "MAIN_COMPLEX_CARB" }), { rotationKey: "carb:pasta6", carbFamily: "pasta" });
const rice6 = food("rice6", "Riso", { kcal: 360, cho: 79, pro: 7, fat: 0.6 }, roles({ lunch: "CHO_PRIMARY", dinner: "CHO_PRIMARY" }, { lunch: 10, dinner: 10 }, { mainMealRole: "PRIMARY_COMPLEX_CARB", mediterraneanPriority: "PRIMARY", substitutionGroup: "MAIN_COMPLEX_CARB" }), { rotationKey: "carb:rice6", carbFamily: "riso" });
const potato6 = food("potato6", "Patate", { kcal: 77, cho: 17, pro: 2, fat: 0.1 }, roles({ lunch: "CHO_PRIMARY", dinner: "CHO_PRIMARY" }, { lunch: 9, dinner: 9 }, { mainMealRole: "SECONDARY_CARB", mediterraneanPriority: "COMMON", substitutionGroup: "MAIN_COMPLEX_CARB" }), { rotationKey: "carb:potato6" });
const chicken6 = food("chicken6", "Pollo", { kcal: 110, cho: 0, pro: 23, fat: 1.2 }, roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, { lunch: 10, dinner: 10 }, { mainMealRole: "PRIMARY_PROTEIN", mediterraneanPriority: "COMMON", substitutionGroup: "WHITE_MEAT" }), { rotationKey: "prot:pollo6", isMeat: true });
const cod6 = food("cod6", "Merluzzo", { kcal: 82, cho: 0, pro: 18, fat: 0.7 }, roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, { lunch: 10, dinner: 10 }, { mainMealRole: "PRIMARY_PROTEIN", mediterraneanPriority: "COMMON", substitutionGroup: "FISH_LEAN" }), { rotationKey: "prot:pesce6", isFish: true });
const mackerel6 = food("mackerel6", "Sgombro", { kcal: 305, cho: 0, pro: 19, fat: 25 }, roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, { lunch: 9, dinner: 9 }, { mainMealRole: "PRIMARY_PROTEIN", mediterraneanPriority: "ROTATION", substitutionGroup: "FISH_FATTY" }), { rotationKey: "prot:sgombro6", isFish: true });
const legumes6 = food("legumes6", "Lenticchie", { kcal: 116, cho: 20, pro: 9, fat: 0.4 }, roles({ lunch: "PRO_SECONDARY", dinner: "PRO_SECONDARY" }, { lunch: 9, dinner: 9 }, { mainMealRole: "PRIMARY_OR_SECONDARY_PROTEIN", mediterraneanPriority: "PRIMARY", substitutionGroup: "PLANT_PROTEIN" }));
const veg6 = food("veg6", "Zucchine", { kcal: 17, cho: 3, pro: 1.2, fat: 0.3 }, roles({ lunch: "FIBER_VEG", dinner: "FIBER_VEG" }, { lunch: 10, dinner: 10 }, { mainMealRole: "FIBER_SIDE", mediterraneanPriority: "PRIMARY", substitutionGroup: "VEGETABLE" }));
// S03: score_spuntino > 0 ma snack_role LOW — solo il ruolo v6 lo esclude (la v5 lo farebbe entrare).
const butter6 = food("butter6", "Burro", { kcal: 717, cho: 0, pro: 0.9, fat: 81 }, roles({ snack: "PRO_SECONDARY" }, { snack: 3 }, { snackRole: "LOW", mediterraneanPriority: "LIMITED", substitutionGroup: "ANIMAL_FAT", prepSpeed: 10 }));

function v6Pools(): MenuFoodPoolMap {
  return new Map<string, MenuFoodEntry[]>([
    // bread6 prima di oat6: senza il tiebreak B03 la rotazione a seed 0 partirebbe dal pane.
    ["breakfast_cho", [bread6, oat6, sweet6]],
    ["breakfast_pro", [ricotta6, yog6]],
    ["breakfast_fat", [seeds6, nuts6]],
    ["lunch_carb", [pasta6, rice6, potato6]],
    ["lunch_pro", [chicken6, cod6, legumes6]],
    ["lunch_veg", [veg6]],
    ["dinner_carb", [pasta6, rice6, potato6]],
    ["dinner_pro", [chicken6, cod6, legumes6]],
    ["dinner_veg", [veg6]],
    ["snack_cho", [apple6, pasta6]],
    ["snack_pro", [yog6, nuts6, butter6]],
    // Pool «virtuale» solo per far entrare i condimenti nell'entryIndex (in prod stanno
    // in un pool reale del catalogo, es. breakfast_fat): la linea M01 pesca per ruolo.
    ["main_fat", [evo6, avoc6, oilseed6]],
  ]);
}

test("v6 filtro per asse: la v6 VINCE sul v5 (B06 ricotta fuori colazione); entry senza dati v6 degrada al v5", () => {
  const bproFilter = { meal: "breakfast" as const, allowedRoles: new Set(["PRO_PRIMARY" as const]), v6: { axis: "breakfast_protein" as const, allowed: new Set(["PRIMARY"]) } };
  // ricotta6: v5 direbbe PRO_PRIMARY/8 (passa), v6 dice NONE → fuori.
  assert.equal(grammarPenaltyForEntry(ricotta6, bproFilter, 0), null, "B06: la v6 vince sul v5");
  assert.equal(grammarPenaltyForEntry(yog6, bproFilter, 0), 0);
  // Entry v5 pura (yogurt della fixture storica, senza dati v6): stesso filtro → vocabolario v5.
  assert.equal(grammarPenaltyForEntry(yogurt, bproFilter, 0), 0, "degradazione: dati v5 + codice v6 non svuota nulla");
  // S03: burro LOW con score 3 — il v5 lo farebbe entrare, il ruolo v6 lo esclude.
  const snackFilter = { meal: "snack" as const, v6: { axis: "snack" as const, allowed: new Set(["FAST_CARB", "FAST_PROTEIN", "FAST_FAT_PRO", "MEDIUM"]) } };
  assert.equal(grammarPenaltyForEntry(butter6, snackFilter, 0), null, "S03: LOW fuori per ruolo, non per score");
  assert.equal(grammarPenaltyForEntry(nuts6, snackFilter, 0), 0);
});

test("v6 B05: tetto dolci cumulato sul marcatore SECONDARY_MIXED (il max_week per-alimento non basta)", () => {
  assert.equal(isBreakfastSweetEntry(sweet6), true);
  assert.equal(isBreakfastSweetEntry(apple6), false);
  const idx = menuFoodEntryIndex(v6Pools());
  assert.equal(weekBreakfastSweetsCount(idx, { "breakfast:cornetto6": 2 }), 2);
  assert.equal(weekBreakfastSweetsCount(idx, {}), 0);
  const f = { meal: "breakfast" as const, sweetsWeekCount: GRAMMAR_BREAKFAST_SWEETS_MAX_WEEK };
  assert.equal(grammarPenaltyForEntry(sweet6, f, 0), null, "al tetto il dolce esce");
  assert.equal(grammarPenaltyForEntry(sweet6, { meal: "breakfast", sweetsWeekCount: 1 }, 0), 400, "sotto il tetto resta OCCASIONAL (penalità v5 = solo contratto della funzione)");
  assert.equal(grammarPenaltyForEntry(apple6, f, 0), 0, "il tetto vale solo per i dolci marcati");
});

test("v6 colazione (B01/B02/B03/B06/B07): assi v6 + ordinamento tier/score/gruppo", () => {
  for (const date of DATES.slice(0, 10)) {
    const plan = composeWith(v6Pools(), rawPools(), date, { grammar: true });
    const b = plan.find((s) => s.slot === "breakfast")!;
    const primary = b.items.filter((it) => it.foodRole === "cho_complex");
    const secondary = b.items.filter((it) => it.foodRole === "cho_simple");
    // B01: solo PRIMARY_COMPLEX come base; B03: a parità di priority/score (cereali e
    // pane sono ENTRAMBI PRIMARY/10 nei dati) il substitution_group fa il tiebreak.
    assert.equal(primary.length, 1, `${date}: una CHO primaria`);
    assert.equal(primary[0]!.canonicalKey, "oat6", `${date}: cereali prima del pane (B03)`);
    // B02: quota semplice; la frutta COMMON vince sul dolce OCCASIONAL (tier).
    assert.equal(secondary.length, 1, `${date}: una CHO secondaria`);
    assert.equal(secondary[0]!.canonicalKey, "apple6");
    // Split B01/B02 dentro la forbetta 80-85 ± 5pp.
    const share = primary[0]!.choG / (primary[0]!.choG + secondary[0]!.choG);
    assert.ok(share >= 0.75 && share <= 0.9, `${date}: quota primaria ${share.toFixed(2)}`);
    // B06: yogurt (PRIMARY), MAI ricotta (NONE in v6 nonostante il v5 PRO_PRIMARY 8).
    const pro = b.items.find((it) => it.foodRole === "protein_primary");
    assert.equal(pro?.canonicalKey, "yog6", `${date}: B06`);
    // B07: frutta oleosa (PRIMARY) prima dei semi (SECONDARY).
    const fat = b.items.find((it) => it.foodRole === "fat");
    assert.equal(fat?.canonicalKey, "nuts6", `${date}: B07`);
  }
});

test("v6 B07: pool PRIMARY svuotato (deny mandorle) → ripiego sui SECONDARY (semi)", () => {
  const plan = composeMealPlanV2(requirements, slots(), rawPools(), {
    denyFragments: ["nuts6"],
    request: req(DATES[0]!),
    menuFoodPools: v6Pools(),
    mealGrammar: { enabled: true, recipes: [] },
  });
  const b = plan.find((s) => s.slot === "breakfast")!;
  const fat = b.items.find((it) => it.foodRole === "fat");
  assert.equal(fat?.canonicalKey, "seeds6");
});

test("v6 M01/M04: pranzo e cena hanno la QUARTA riga FAT_CONDIMENT — EVO preferenziale, 5-20 g, contata nei totali, riusabile a cena", () => {
  for (const date of DATES.slice(0, 8)) {
    const plan = composeWith(v6Pools(), rawPools(), date, { grammar: true });
    for (const slotKey of ["lunch", "dinner"] as const) {
      const s = plan.find((x) => x.slot === slotKey)!;
      const fats = s.items.filter((it) => it.foodRole === "fat");
      assert.equal(fats.length, 1, `${date} ${slotKey}: una linea condimento`);
      // M04: EVO (COMMON, score 10) batte avocado (COMMON, 8) e olio di semi (LIMITED, 4).
      assert.equal(fats[0]!.canonicalKey, "evo6", `${date} ${slotKey}: EVO preferenziale`);
      assert.ok(fats[0]!.grams >= 5 && fats[0]!.grams <= 20 && fats[0]!.grams % 5 === 0, `${date} ${slotKey}: ${fats[0]!.grams} g`);
      // Il condimento è CONTATO nelle macro del pasto (i totali sono la Σ degli item).
      const sumFat = s.items.reduce((a, it) => a + it.fatG, 0);
      assert.ok(Math.abs(sumFat - s.totals.fatG) < 0.5, `${date} ${slotKey}: totali coerenti`);
      // Lo slot non esplode: il solver riequilibra dentro il target (+15% di tolleranza).
      const target = slots().find((b) => b.key === slotKey)!;
      assert.ok(s.totals.kcal <= target.kcal * 1.15, `${date} ${slotKey}: ${s.totals.kcal} vs ${target.kcal}`);
    }
  }
});

test("v6 M01 skip (D02-v1): proteina già grassa (sgombro) copre il target → niente olio aggiunto + flag", () => {
  // Solo a pranzo: a cena lo sgombro è già «usato oggi» e il pool proteico salta —
  // il comportamento del condimento a cena in quel caso non è l'oggetto del test.
  const menu = new Map<string, MenuFoodEntry[]>([...v6Pools(), ["lunch_pro", [mackerel6]]]);
  const diagnostics: string[] = [];
  const plan = composeWith(menu, rawPools(), DATES[2]!, { grammar: true, diagnostics });
  const lunch = plan.find((x) => x.slot === "lunch")!;
  assert.equal(lunch.items.find((it) => it.foodRole === "protein_primary")?.canonicalKey, "mackerel6");
  assert.ok(!lunch.items.some((it) => it.foodRole === "fat"), "lunch: nessun condimento su pasto già ricco");
  assert.ok(diagnostics.includes("fat_condiment_skipped:lunch"), `flag mancante: ${diagnostics.join(",")}`);
  // Controprova: la cena (proteina magra) il condimento lo ha.
  const dinner = plan.find((x) => x.slot === "dinner")!;
  assert.ok(dinner.items.some((it) => it.foodRole === "fat"), "dinner magra: condimento presente");
});

test("v6 M02: PRIMARY_COMPLEX_CARB esauriti dalla rotazione → alternativa SECONDARY_CARB (patate), senza uscire dall'ontologia", () => {
  const week = { "carb:pasta6": 3, "carb:rice6": 3 };
  const plan = composeWith(v6Pools(), rawPools(), DATES[1]!, { grammar: true, week });
  const lunch = plan.find((s) => s.slot === "lunch")!;
  const cho = lunch.items.find((it) => it.foodRole === "cho_complex");
  assert.equal(cho?.canonicalKey, "potato6", "M02: patate come alternativa, mai USDA");
});

test("v6 M03: dieta vegana svuota i PRIMARY_PROTEIN → legumi (PRIMARY_OR_SECONDARY_PROTEIN) come fonte", () => {
  // Due fonti vegetali così anche la cena (dedupe giornaliero) ha la sua alternativa.
  const tofu6 = food("tofu6", "Tofu", { kcal: 76, cho: 1.9, pro: 8, fat: 4.8 }, roles({ lunch: "PRO_SECONDARY", dinner: "PRO_SECONDARY" }, { lunch: 8, dinner: 8 }, { mainMealRole: "PRIMARY_OR_SECONDARY_PROTEIN", mediterraneanPriority: "COMMON", substitutionGroup: "PLANT_PROTEIN" }));
  const menu = new Map<string, MenuFoodEntry[]>([
    ...v6Pools(),
    ["lunch_pro", [chicken6, cod6, legumes6, tofu6]],
    ["dinner_pro", [chicken6, cod6, legumes6, tofu6]],
  ]);
  const plan = composeWith(menu, rawPools(), DATES[3]!, { grammar: true, request: { dietType: "vegan" } });
  const seen: string[] = [];
  for (const slotKey of ["lunch", "dinner"] as const) {
    const s = plan.find((x) => x.slot === slotKey)!;
    const pro = s.items.find((it) => it.foodRole === "protein_primary");
    assert.ok(pro && ["legumes6", "tofu6"].includes(pro.canonicalKey!), `${slotKey}: fonte vegetale, mai carne/pesce`);
    seen.push(pro!.canonicalKey!);
  }
  assert.equal(new Set(seen).size, 2, "pranzo e cena ruotano le due fonti vegetali");
});

test("v6 S01/S03: lo spuntino pesca solo FAST_* (pasta LOW/score 0 mai; burro LOW mai nonostante score 3)", () => {
  const snackSlots: MealPlanV2DietSlotBudget[] = [
    { key: "snack_am", label: "Spuntino", pct: 10, kcal: 250, carbs: 30, protein: 15, fat: 8 },
  ];
  for (const date of DATES.slice(0, 6)) {
    const plan = composeWith(v6Pools(), rawPools(), date, { grammar: true, slots: snackSlots });
    const s = plan[0]!;
    assert.ok(!s.items.some((it) => it.canonicalKey === "pasta6"), `${date}: S03 niente pasti completi`);
    assert.ok(!s.items.some((it) => it.canonicalKey === "butter6"), `${date}: S03 LOW fuori per ruolo`);
    const cho = s.items.find((it) => it.foodRole === "cho_simple");
    assert.equal(cho?.canonicalKey, "apple6", `${date}: S02 frutta`);
  }
});

test("v6 B02/B04/B05 nel compositore: il dolce entra SOLO come linea secondaria e il tetto settimanale lo spegne", () => {
  // Senza frutta disponibile il dolce è l'unica quota secondaria: entra accanto alla
  // primaria (B04: mai da solo), finché il conteggio settimanale non raggiunge il tetto.
  const menu = new Map<string, MenuFoodEntry[]>([...v6Pools(), ["snack_cho", []]]);
  const fresh = composeWith(menu, rawPools(), DATES[4]!, { grammar: true });
  const bFresh = fresh.find((s) => s.slot === "breakfast")!;
  const sec = bFresh.items.filter((it) => it.foodRole === "cho_simple");
  assert.equal(sec.length, 1);
  assert.equal(sec[0]!.canonicalKey, "sweet6", "senza frutta il dolce copre la quota B02");
  assert.ok(bFresh.items.some((it) => it.foodRole === "cho_complex"), "B04: sempre accanto a una PRIMARY_COMPLEX");
  const diagnostics: string[] = [];
  const capped = composeWith(menu, rawPools(), DATES[4]!, { grammar: true, week: { "breakfast:cornetto6": GRAMMAR_BREAKFAST_SWEETS_MAX_WEEK }, diagnostics });
  const bCapped = capped.find((s) => s.slot === "breakfast")!;
  assert.ok(!bCapped.items.some((it) => it.foodRole === "cho_simple"), "B05: al tetto la linea dolce salta");
  assert.ok(diagnostics.includes("optional_line_skipped:breakfast:breakfast_cho"), diagnostics.join(","));
});

test("v6 R01: nel re-pick il sostituto preferito è lo stesso substitution_group, poi i substitutes espliciti in ordine", () => {
  const sameGroup = food("samegroup6", "Nasello", { kcal: 90, cho: 0, pro: 19, fat: 1 }, roles({ lunch: "PRO_PRIMARY" }, { lunch: 9 }, { mainMealRole: "PRIMARY_PROTEIN", mediterraneanPriority: "COMMON", substitutionGroup: "FISH_LEAN" }));
  const listed = food("listed6", "Orata", { kcal: 100, cho: 0, pro: 20, fat: 2 }, roles({ lunch: "PRO_PRIMARY" }, { lunch: 9 }, { mainMealRole: "PRIMARY_PROTEIN", mediterraneanPriority: "COMMON", substitutionGroup: "GENERIC_PROTEIN" }));
  const other = food("other6", "Tacchino", { kcal: 105, cho: 0, pro: 22, fat: 1.5 }, roles({ lunch: "PRO_PRIMARY" }, { lunch: 10 }, { mainMealRole: "PRIMARY_PROTEIN", mediterraneanPriority: "PRIMARY", substitutionGroup: "WHITE_MEAT" }), { isMeat: true });
  const substituteFor = { substitutionGroup: "FISH_LEAN", substitutes: ["listed6"] };
  // Senza preferenza vincerebbe `other6` (tier PRIMARY, score 10): con substituteFor
  // vince PRIMA il gruppo, poi la lista esplicita — mai la sola convenienza di punteggio.
  const first = pickStapleForPool({ poolKey: "lunch_pro", seed: 0, menuEntries: [other, listed, sameGroup], grammar: { meal: "lunch", substituteFor } });
  assert.equal(first?.entry.canonicalKey, "samegroup6");
  const second = pickStapleForPool({ poolKey: "lunch_pro", seed: 0, menuEntries: [other, listed], grammar: { meal: "lunch", substituteFor } });
  assert.equal(second?.entry.canonicalKey, "listed6");
  const third = pickStapleForPool({ poolKey: "lunch_pro", seed: 0, menuEntries: [other], grammar: { meal: "lunch", substituteFor } });
  assert.equal(third?.entry.canonicalKey, "other6", "esauriti gruppo e lista, resta il pool con ruolo ammesso");
});

test("v6 R02: grammatura del sostituto a parità di kcal (grams × kcal_orig / kcal_sost)", () => {
  // 100 g di pasta (350 kcal/100g) sostituiti con lenticchie (116 kcal/100g) → 301,7 g.
  assert.equal(substituteGramsByKcal(100, 350, 116), 301.7);
  assert.equal(substituteGramsByKcal(80, 270, 270), 80);
  // Input degeneri: mai NaN/Infinity, si tengono i grammi originali.
  assert.equal(substituteGramsByKcal(100, 350, 0), 100);
  assert.equal(substituteGramsByKcal(0, 350, 116), 0);
});

test("v6 B01 verifica in provenienza: quota primaria fuori forbetta → flag b01_share_out (verifica, non correzione)", () => {
  // choOther = CHO delle linee NON cho_complex/cho_simple (latte/yogurt): la regola
  // dice «80-85% dei CHO del pasto», quindi il denominatore è s.totals.choG.
  const mkSlot = (choP: number, choS: number, choOther = 0): MealPlanV2ComposedSlot => ({
    slot: "breakfast",
    labelIt: "Colazione",
    targetKcal: 600,
    items: [
      { fdcId: 1, description: "Avena", grams: 80, kcal: 300, choG: choP, proG: 10, fatG: 5, foodRole: "cho_complex" },
      { fdcId: 2, description: "Mela", grams: 100, kcal: 52, choG: choS, proG: 0.3, fatG: 0.2, foodRole: "cho_simple" },
      ...(choOther > 0
        ? [{ fdcId: 3, description: "Yogurt greco", grams: 250, kcal: 145, choG: choOther, proG: 22.5, fatG: 4.8, foodRole: "protein_primary" as const }]
        : []),
    ],
    totals: { kcal: 352 + (choOther > 0 ? 145 : 0), choG: choP + choS + choOther, proG: 10.3 + (choOther > 0 ? 22.5 : 0), fatG: 5.2 + (choOther > 0 ? 4.8 : 0) },
  });
  const out = buildMealGrammarProvenance({ mode: "shadow", applied: false, before: [], after: [mkSlot(50, 30)], recipesAvailable: 0 });
  assert.ok(out.flags.some((f) => f.startsWith("b01_share_out:breakfast:")), out.flags.join(","));
  const ok = buildMealGrammarProvenance({ mode: "shadow", applied: false, before: [], after: [mkSlot(68, 12)], recipesAvailable: 0 });
  assert.ok(!ok.flags.some((f) => f.startsWith("b01_share_out")), ok.flags.join(","));
  // Caso del finding: 50,5 g complessi + 10,5 g semplici + 9 g dallo yogurt → quota
  // reale 50,5/70 = 72% (< 75%, fuori). Il vecchio denominatore (choP+choS) avrebbe
  // detto 50,5/61 = 83% e NON avrebbe flaggato.
  const hidden = buildMealGrammarProvenance({ mode: "shadow", applied: false, before: [], after: [mkSlot(50.5, 10.5, 9)], recipesAvailable: 0 });
  assert.ok(hidden.flags.some((f) => f.startsWith("b01_share_out:breakfast:72")), hidden.flags.join(","));
  // Stessa ripartizione ma senza CHO nascosta nella proteina → 50,5/61 = 83%, dentro.
  const clean = buildMealGrammarProvenance({ mode: "shadow", applied: false, before: [], after: [mkSlot(50.5, 10.5)], recipesAvailable: 0 });
  assert.ok(!clean.flags.some((f) => f.startsWith("b01_share_out")), clean.flags.join(","));
});

// ═══ SISTEMA TIER v9 (file Mario v9: CORE-first + shake proteici) ══════════════════════
// Catalogo finto con TUTTI e tre i vocabolari (v5+v6+v9), come il DB dopo la migrazione
// 20260821090100: il tier v9 è la PRIMA chiave d'ordinamento, EXCLUDE_DEFAULT/disabled
// sono verdetti, VARIETY è contingentata a 1 per pasto.

const corePasta9 = food("pasta9", "Pasta", { kcal: 350, cho: 71, pro: 12, fat: 1.5 }, roles({ lunch: "CHO_PRIMARY", dinner: "CHO_PRIMARY" }, { lunch: 8, dinner: 8 }, { mainMealRole: "PRIMARY_COMPLEX_CARB", mediterraneanPriority: "COMMON", substitutionGroup: "MAIN_COMPLEX_CARB", generativeTier: "CORE", defaultEnabled: true }), { rotationKey: "carb:pasta9", carbFamily: "pasta" });
// VARIETY con score PIÙ ALTO e priorità v6 MIGLIORE (PRIMARY), messo PRIMO nel pool:
// senza il tier v9 vincerebbe lui per ordinamento v6 e rotazione.
const varietyAmaranth9 = food("amaranth9", "Amaranto", { kcal: 371, cho: 65, pro: 14, fat: 7 }, roles({ lunch: "CHO_PRIMARY", dinner: "CHO_PRIMARY" }, { lunch: 10, dinner: 10 }, { mainMealRole: "PRIMARY_COMPLEX_CARB", mediterraneanPriority: "PRIMARY", substitutionGroup: "MAIN_COMPLEX_CARB", generativeTier: "VARIETY", defaultEnabled: true }), { rotationKey: "carb:amaranth9" });
const excluded9 = food("sprouts9", "Germogli di soia", { kcal: 30, cho: 5, pro: 3, fat: 0.5 }, roles({ lunch: "FIBER_VEG", dinner: "FIBER_VEG" }, { lunch: 10, dinner: 10 }, { mainMealRole: "FIBER_SIDE", mediterraneanPriority: "PRIMARY", substitutionGroup: "VEGETABLE", generativeTier: "EXCLUDE_DEFAULT", defaultEnabled: true }));
const disabledOil9 = food("sunfloweroil9", "Olio di girasole", { kcal: 884, cho: 0, pro: 0, fat: 100 }, roles({}, { lunch: 4, dinner: 4 }, { mainMealRole: "FAT_CONDIMENT", mediterraneanPriority: "LIMITED", substitutionGroup: "FAT_CONDIMENT", generativeTier: "VARIETY", defaultEnabled: false }));
const varietyBeef9 = food("beef9", "Manzo raro", { kcal: 150, cho: 0, pro: 22, fat: 6 }, roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, { lunch: 10, dinner: 10 }, { mainMealRole: "PRIMARY_PROTEIN", mediterraneanPriority: "COMMON", substitutionGroup: "RED_MEAT", generativeTier: "VARIETY" }), { rotationKey: "prot:beef9", isMeat: true });
const varietyVeg9 = food("radish9", "Rapanelli", { kcal: 16, cho: 3.4, pro: 0.7, fat: 0.1 }, roles({ lunch: "FIBER_VEG", dinner: "FIBER_VEG" }, { lunch: 10, dinner: 10 }, { mainMealRole: "FIBER_SIDE", mediterraneanPriority: "PRIMARY", substitutionGroup: "VEGETABLE", generativeTier: "VARIETY" }), { rotationKey: "veg:radish9" });
const coreVeg9 = food("zucchine9", "Zucchine", { kcal: 17, cho: 3, pro: 1.2, fat: 0.3 }, roles({ lunch: "FIBER_VEG", dinner: "FIBER_VEG" }, { lunch: 9, dinner: 9 }, { mainMealRole: "FIBER_SIDE", mediterraneanPriority: "COMMON", substitutionGroup: "VEGETABLE", generativeTier: "CORE" }), { rotationKey: "veg:zucchine9" });

test("v9 tier: CORE è la PRIMA chiave d'ordinamento — batte score più alto, priorità v6 migliore e rotazione", () => {
  for (let seed = 0; seed < 10; seed += 1) {
    const p = pickStapleForPool({ poolKey: "lunch_carb", seed, menuEntries: [varietyAmaranth9, corePasta9], grammar: { meal: "lunch" } });
    assert.equal(p?.entry.canonicalKey, "pasta9", `seed ${seed}: il CORE vince sempre`);
  }
  // Senza il pasta CORE il VARIETY resta pescabile (tier = ordinamento, non verdetto).
  const only = pickStapleForPool({ poolKey: "lunch_carb", seed: 0, menuEntries: [varietyAmaranth9], grammar: { meal: "lunch" } });
  assert.equal(only?.entry.canonicalKey, "amaranth9");
});

test("v9 verdetti: EXCLUDE_DEFAULT e default_enabled=false non entrano MAI da soli (P01)", () => {
  assert.equal(grammarPenaltyForEntry(excluded9, { meal: "lunch" }, 0), null, "EXCLUDE_DEFAULT → verdetto");
  assert.equal(grammarPenaltyForEntry(disabledOil9, { meal: "lunch" }, 0), null, "disabled → verdetto");
  const p = pickStapleForPool({ poolKey: "lunch_veg", seed: 0, menuEntries: [excluded9, coreVeg9], grammar: { meal: "lunch" } });
  assert.equal(p?.entry.canonicalKey, "zucchine9");
  const none = pickStapleForPool({ poolKey: "lunch_veg", seed: 0, menuEntries: [excluded9], grammar: { meal: "lunch" } });
  assert.equal(none, null, "pool di soli esclusi → nessun pick, mai l'escluso");
});

test("v9 scale miste dichiarate: un v9 VARIETY (rank 3) precede un v6 LIMITED (rank 4)", () => {
  const v6Limited = oilseed6; // LIMITED senza tier v9
  const kV9 = grammarOrderingKeys(varietyAmaranth9, { meal: "lunch" });
  const kV6 = grammarOrderingKeys(v6Limited, { meal: "lunch" });
  assert.equal(kV9.tier, 3);
  assert.equal(kV6.tier, 4);
  assert.ok(kV9.tier < kV6.tier, "comportamento fissato: scala v9 e scala v6 convivono nel campo tier");
});

test("v9 V7-03: massimo UN alimento VARIETY per pasto — il secondo pick VARIETY dello slot è verdetto", () => {
  const menu = new Map<string, MenuFoodEntry[]>([
    ["lunch_carb", [corePasta9]],
    ["lunch_pro", [varietyBeef9]],
    ["lunch_veg", [varietyVeg9, coreVeg9]],
    ["dinner_carb", [corePasta9]],
    ["dinner_pro", [varietyBeef9]],
    ["dinner_veg", [varietyVeg9, coreVeg9]],
    ["breakfast_cho", [oat6]],
    ["breakfast_pro", [yog6]],
    ["breakfast_fat", [nuts6]],
    ["snack_cho", [apple6]],
    ["snack_pro", [yog6]],
  ]);
  for (const date of DATES.slice(0, 6)) {
    const plan = composeWith(menu, rawPools(), date, { grammar: true });
    const lunch = plan.find((s) => s.slot === "lunch")!;
    const pro = lunch.items.find((it) => it.foodRole === "protein_primary");
    assert.equal(pro?.canonicalKey, "beef9", `${date}: il primo VARIETY dello slot entra`);
    const veg = lunch.items.find((it) => it.foodRole === "veg_condiment");
    assert.equal(veg?.canonicalKey, "zucchine9", `${date}: il secondo VARIETY (rapanelli) è bloccato, entra il CORE`);
    const varietyCount = lunch.items.filter((it) => ["beef9", "radish9", "amaranth9"].includes(it.canonicalKey ?? "")).length;
    assert.ok(varietyCount <= 1, `${date}: ${varietyCount} VARIETY nello slot`);
  }
  // Contorno con SOLO VARIETY: la linea salta (flag), mai un secondo VARIETY.
  const menu2 = new Map(menu);
  menu2.set("lunch_veg", [varietyVeg9]);
  const diagnostics: string[] = [];
  const plan2 = composeWith(menu2, rawPools(), DATES[0]!, { grammar: true, diagnostics });
  const lunch2 = plan2.find((s) => s.slot === "lunch")!;
  assert.ok(!lunch2.items.some((it) => it.canonicalKey === "radish9"), "niente secondo VARIETY");
  assert.ok(diagnostics.some((f) => f === "pool_exhausted:lunch:lunch_veg"), diagnostics.join(","));
});

test("v9 V7-01: core_share misurata nei flag (provenienza), mai forzata", () => {
  const menu = new Map<string, MenuFoodEntry[]>([
    ["lunch_carb", [corePasta9]],
    ["lunch_pro", [varietyBeef9]],
    ["lunch_veg", [coreVeg9]],
    ["dinner_carb", [corePasta9]],
    ["dinner_pro", [varietyBeef9]],
    ["dinner_veg", [coreVeg9]],
    ["breakfast_cho", [oat6]],
    ["breakfast_pro", [yog6]],
    ["breakfast_fat", [nuts6]],
    ["snack_cho", [apple6]],
    ["snack_pro", [yog6]],
  ]);
  const diagnostics: string[] = [];
  composeWith(menu, rawPools(), DATES[0]!, { grammar: true, diagnostics });
  const lunchShare = diagnostics.find((f) => f.startsWith("core_share:lunch:"));
  assert.ok(lunchShare, `flag core_share mancante: ${diagnostics.join(",")}`);
  // pasta CORE + manzo VARIETY + zucchine CORE = 2/3 → 67.
  assert.equal(lunchShare, "core_share:lunch:67");
  // Fixture v6 (nessun tier): NESSUN flag core_share — si misura solo ciò che è classificato.
  const diagV6: string[] = [];
  composeWith(v6Pools(), rawPools(), DATES[0]!, { grammar: true, diagnostics: diagV6 });
  assert.ok(!diagV6.some((f) => f.startsWith("core_share:")), diagV6.join(","));
});

test("v9 V7-R01: nei re-pick di sostituzione entrano SOLO CORE/ROTATION (le entry senza tier degradano al v6)", () => {
  const substituteFor = { substitutionGroup: "MAIN_COMPLEX_CARB", substitutes: [] };
  assert.equal(grammarPenaltyForEntry(varietyAmaranth9, { meal: "lunch", substituteFor }, 0), null, "VARIETY fuori dai sostituti automatici");
  assert.equal(grammarPenaltyForEntry(corePasta9, { meal: "lunch", substituteFor }, 0), 0, "CORE resta sostituto valido");
  // Entry v6 pura (senza tier): nessun verdetto v9, comportamento v6 invariato.
  assert.equal(grammarPenaltyForEntry(pasta6, { meal: "lunch", substituteFor }, 0), 0);
});

test("v9 substituteGramsForMode: PORTION = stessi grammi, ENERGY/assente = kcal-equivalenza", () => {
  assert.equal(substituteGramsForMode("PORTION_EQUIVALENT", 120, 17, 16), 120);
  assert.equal(substituteGramsForMode("ENERGY_EQUIVALENT", 100, 350, 116), 301.7);
  assert.equal(substituteGramsForMode(null, 100, 350, 116), 301.7);
  assert.equal(substituteGramsForMode(undefined, 80, 270, 270), 80);
});

// ── Ricette v9: tier/famiglia/meals + shake proteici ─────────────────────────────────

const almondDrink9 = food("almond_drink_unsweetened", "Bevanda di mandorla", { kcal: 15, cho: 0.34, pro: 0.55, fat: 1.22 }, roles({}, { breakfast: 6, snack: 7 }, { macroRole: "MIXED", generativeTier: "ROTATION", defaultEnabled: true, prepSpeed: 10 }), { rotationKey: "breakfast:latte9" });
const whey9 = food("whey_protein_powder", "Proteine whey in polvere", { kcal: 385, cho: 18, pro: 66.7, fat: 5.13 }, roles({}, { breakfast: 8, snack: 9 }, { macroRole: "PRO_PRIMARY", generativeTier: "ROTATION", defaultEnabled: false, prepSpeed: 10 }));

const shake9: MenuRecipe = {
  id: "s9",
  recipeKey: "shake_whey_mandorla",
  labelIt: "Shake whey e mandorla",
  note: null,
  frequency: "ROTATION",
  maxWeek: 3,
  family: "PROTEIN_SHAKE_LIGHT",
  tier: "ROTATION",
  selectionWeight: 30,
  meals: ["breakfast", "snack"],
  components: [
    { position: 1, canonicalKey: "whey_protein_powder", fdcId: whey9.fdcId, labelIt: "Proteine whey in polvere", gramsPer100g: 10.71, isNeutral: false },
    { position: 2, canonicalKey: "almond_drink_unsweetened", fdcId: almondDrink9.fdcId, labelIt: "Bevanda di mandorla", gramsPer100g: 89.29, isNeutral: false },
  ],
};

function v9ShakePools(): MenuFoodPoolMap {
  return new Map<string, MenuFoodEntry[]>([
    ...v6Pools(),
    // Pool virtuale per l'entryIndex delle ricette (P01: whey disabled → mai standalone).
    ["shake_ing", [whey9, almondDrink9]],
  ]);
}

test("v9 P01 dentro le ricette: l'ingrediente disabled NON uccide la ricetta shake (verdetto solo sui pick standalone)", () => {
  const idx = menuFoodEntryIndex(v9ShakePools());
  const cands = recipeCandidatesForMeal({ recipes: [shake9], entryIndex: idx, meal: "breakfast" });
  assert.equal(cands.length, 1, "lo shake resta candidabile a colazione nonostante la polvere disabled");
  // …ma la stessa polvere non entra MAI come alimento a sé.
  const p = pickStapleForPool({ poolKey: "breakfast_pro", seed: 0, menuEntries: [whey9], grammar: { meal: "breakfast" } });
  assert.equal(p, null);
});

test("v9 meals esplicita: lo shake è candidabile a colazione/spuntino e MAI a pranzo/cena; le legacy senza meals mai a colazione", () => {
  const idx = menuFoodEntryIndex(v9ShakePools());
  assert.equal(recipeCandidatesForMeal({ recipes: [shake9], entryIndex: idx, meal: "lunch" }).length, 0);
  assert.equal(recipeCandidatesForMeal({ recipes: [shake9], entryIndex: idx, meal: "snack" }).length, 1);
  // Ricetta LEGACY (senza colonna meals): a colazione non entra per omissione.
  const idxLegacy = menuFoodEntryIndex(pools());
  assert.equal(recipeCandidatesForMeal({ recipes: [carbonara], entryIndex: idxLegacy, meal: "breakfast" }).length, 0);
});

test("v9 P04: lo shake a colazione RIMPIAZZA la linea proteica primaria; CHO complesso e B02 restano; polvere ancorata 20-35 g", () => {
  let found = 0;
  for (const date of DATES) {
    const diagnostics: string[] = [];
    const plan = composeMealPlanV2(requirements, slots(), rawPools(), {
      denyFragments: [],
      request: req(date),
      menuFoodPools: v9ShakePools(),
      mealGrammar: { enabled: true, recipes: [shake9], diagnostics },
    });
    for (const s of plan) {
      const it = s.items.find((x) => x.recipe?.recipeKey === "shake_whey_mandorla");
      if (!it) continue;
      found += 1;
      assert.equal(s.slot, "breakfast", `${date}: lo shake vive solo negli slot dichiarati`);
      assert.ok(!s.items.some((x) => x.foodRole === "protein_primary"), `${date}: P04 — la proteina primaria è rimpiazzata`);
      assert.ok(s.items.some((x) => x.foodRole === "cho_complex"), `${date}: il CHO complesso resta`);
      // P02: la polvere è ancorata alla forbice, il liquido assorbe il resto.
      const powder = it.recipe!.components.find((c) => c.canonicalKey === "whey_protein_powder")!;
      assert.ok(
        powder.grams >= GRAMMAR_SHAKE_POWDER_MIN_G && powder.grams <= GRAMMAR_SHAKE_POWDER_MAX_G,
        `${date}: polvere ${powder.grams} g fuori [20, 35]`,
      );
      // Totali = Σ componenti anche con l'ancora.
      const sumKcal = it.recipe!.components.reduce((a, c) => a + c.kcal, 0);
      assert.ok(Math.abs(sumKcal - it.kcal) < 0.11, `${date}: kcal item ${it.kcal} vs Σ ${sumKcal}`);
      assert.ok(diagnostics.some((f) => f.startsWith("shake_powder_anchored:breakfast:")), diagnostics.join(","));
    }
    // La polvere non compare MAI come item standalone (P01).
    for (const s of plan) {
      assert.ok(!s.items.some((x) => !x.recipe && x.canonicalKey === "whey_protein_powder"), `${date}: polvere standalone`);
    }
  }
  assert.ok(found >= 3, `shake serviti in 30 giorni: ${found}`);
});

test("v9 contatori separati: lo shake del mattino NON brucia la ricetta di pranzo/cena (e viceversa)", () => {
  const risoPollo9: MenuRecipe = {
    id: "rp9",
    recipeKey: "riso_pollo9",
    labelIt: "Riso pollo",
    note: null,
    frequency: "COMMON",
    maxWeek: null,
    family: "RICE",
    tier: "CORE",
    meals: ["lunch", "dinner"],
    components: [
      { position: 1, canonicalKey: "rice6", fdcId: rice6.fdcId, labelIt: "Riso", gramsPer100g: 45, isNeutral: false },
      { position: 2, canonicalKey: "chicken6", fdcId: chicken6.fdcId, labelIt: "Pollo", gramsPer100g: 40, isNeutral: false },
      { position: 3, canonicalKey: null, fdcId: null, labelIt: "Acqua / brodo neutro", gramsPer100g: 15, isNeutral: true },
    ],
  };
  let both = 0;
  for (const date of DATES) {
    const plan = composeMealPlanV2(requirements, slots(), rawPools(), {
      denyFragments: [],
      request: req(date),
      menuFoodPools: v9ShakePools(),
      mealGrammar: { enabled: true, recipes: [shake9, risoPollo9] },
    });
    const hasShake = plan.some((s) => s.slot === "breakfast" && s.items.some((x) => x.recipe?.recipeKey === "shake_whey_mandorla"));
    const hasMain = plan.some((s) => (s.slot === "lunch" || s.slot === "dinner") && s.items.some((x) => x.recipe?.recipeKey === "riso_pollo9"));
    if (hasShake && hasMain) both += 1;
  }
  assert.ok(both >= 1, `nessun giorno con shake E ricetta principale in 30 giorni: i contatori non sono separati`);
});

test("v9 tetto per FAMIGLIA: una lasagna in settimana blocca TUTTE le varianti lasagne; le altre famiglie no", () => {
  const idx = menuFoodEntryIndex(pools());
  const mkLasagna = (n: string): MenuRecipe => ({
    ...risoPomodoro,
    id: n,
    recipeKey: n,
    labelIt: n,
    family: "LASAGNE",
    tier: "ROTATION",
    meals: ["lunch", "dinner"],
    maxWeek: 2,
  });
  const lasA = mkLasagna("lasagne_a");
  const lasB = mkLasagna("lasagne_b");
  const pastaFam: MenuRecipe = { ...risoPomodoro, id: "pf", recipeKey: "pasta_fam", labelIt: "Pasta fam", family: "PASTA", tier: "CORE", meals: ["lunch", "dinner"] };
  const fresh = recipeCandidatesForMeal({ recipes: [lasA, lasB, pastaFam], entryIndex: idx, meal: "lunch", weekStapleCounts: {} });
  assert.deepEqual(fresh.map((c) => c.recipe.recipeKey).sort(), ["lasagne_a", "lasagne_b", "pasta_fam"]);
  const afterOne = recipeCandidatesForMeal({ recipes: [lasA, lasB, pastaFam], entryIndex: idx, meal: "lunch", weekStapleCounts: { "recipe:lasagne_a": 1 } });
  assert.deepEqual(afterOne.map((c) => c.recipe.recipeKey), ["pasta_fam"], "famiglia LASAGNE al tetto (1): entrambe le varianti fuori, PASTA (senza tetto famiglia) resta");
});

test("v9 rank ricette: il tier vince sulla frequency (CORE/OCCASIONAL prima di ROTATION/COMMON) e il sorteggio usa lo stesso rank", () => {
  const idx = menuFoodEntryIndex(pools());
  const coreOcc: MenuRecipe = { ...risoPomodoro, id: "t1", recipeKey: "riso_core", labelIt: "Riso core", frequency: "OCCASIONAL", tier: "CORE", meals: ["lunch", "dinner"] };
  const rotCommon: MenuRecipe = { ...risoPomodoro, id: "t2", recipeKey: "riso_rot", labelIt: "Riso rot", frequency: "COMMON", tier: "ROTATION", meals: ["lunch", "dinner"] };
  assert.equal(recipeRank(coreOcc), 0);
  assert.equal(recipeRank(rotCommon), 1);
  const cands = recipeCandidatesForMeal({ recipes: [rotCommon, coreOcc], entryIndex: idx, meal: "lunch", weekStapleCounts: {} });
  assert.deepEqual(cands.map((c) => c.recipe.recipeKey), ["riso_core", "riso_rot"]);
  const picked = new Set<string>();
  for (let seed = 0; seed < 60; seed += 1) {
    const c = chooseRecipeForSlot({ candidates: cands, seed, slotKey: "lunch", weekStapleCounts: {}, recipeAlreadyToday: false });
    if (c) picked.add(c.recipe.recipeKey);
  }
  assert.deepEqual([...picked], ["riso_core"], "il sorteggio non mescola i rank");
});

test("v9 scaleRecipe: ancora della polvere SOLO per le famiglie proteiche, totali = Σ componenti", () => {
  assert.equal(isProteinShakeFamily("PROTEIN_SHAKE_LIGHT"), true);
  assert.equal(isProteinShakeFamily("PROTEIN_CREAM"), true);
  assert.equal(isProteinShakeFamily("PLANT_PROTEIN_SHAKE"), true);
  assert.equal(isProteinShakeFamily("PASTA"), false);
  assert.equal(isProteinShakeFamily(null), false);
  const idx = menuFoodEntryIndex(v9ShakePools());
  const cand = recipeCandidatesForMeal({ recipes: [shake9], entryIndex: idx, meal: "breakfast" })[0]!;
  // 350 g: la polvere naive sarebbe 37,5 g → ancorata a 35, il liquido assorbe la differenza.
  const big = scaleRecipe(cand, 350);
  const bigPowder = big.components.find((c) => c.canonicalKey === "whey_protein_powder")!;
  assert.equal(bigPowder.grams, 35);
  const bigTotalG = big.components.reduce((a, c) => a + c.grams, 0);
  assert.ok(Math.abs(bigTotalG - 350) < 0.3, `totale ${bigTotalG} ≠ 350`);
  assert.ok(Math.abs(big.totals.kcal - big.components.reduce((a, c) => a + c.kcal, 0)) < 0.11);
  // 150 g: naive 16,1 g → ancorata a 20, il liquido si stringe.
  const small = scaleRecipe(cand, 150);
  const smallPowder = small.components.find((c) => c.canonicalKey === "whey_protein_powder")!;
  assert.equal(smallPowder.grams, 20);
  const smallTotalG = small.components.reduce((a, c) => a + c.grams, 0);
  assert.ok(Math.abs(smallTotalG - 150) < 0.3, `totale ${smallTotalG} ≠ 150`);
  // Ricetta NON proteica (carbonara, family assente): scala proporzionale come prima.
  const idxL = menuFoodEntryIndex(pools());
  const carb = recipeCandidatesForMeal({ recipes: [carbonara], entryIndex: idxL, meal: "lunch" })[0]!;
  assert.equal(scaleRecipe(carb, 300).components[0]!.grams, 105);
});

test("v9 off bit-identico: i campi v9 sul catalogo NON toccano il path off (grammatica spenta)", () => {
  // Stesse fixture v5, clonate CON i campi v9 valorizzati: il path off deve produrre
  // esattamente la stessa composizione (i campi nuovi vivono solo dietro ctx.grammar).
  const withV9 = (): MenuFoodPoolMap => {
    const out = new Map<string, MenuFoodEntry[]>();
    for (const [k, list] of pools()) {
      out.set(
        k,
        list.map((e) => ({
          ...e,
          mealRoles: e.mealRoles
            ? { ...e.mealRoles, generativeTier: "VARIETY" as const, defaultEnabled: true, selectionWeight: 10, substitutionMode: null, substitutePool: null }
            : undefined,
        })),
      );
    }
    return out;
  };
  for (const date of DATES.slice(0, 7)) {
    const legacy = composeMealPlanV2(requirements, slots(), rawPools(), {
      denyFragments: [],
      request: req(date),
      menuFoodPools: pools(),
    });
    const v9off = composeMealPlanV2(requirements, slots(), rawPools(), {
      denyFragments: [],
      request: req(date),
      menuFoodPools: withV9(),
      mealGrammar: { enabled: false, recipes: [shake9] },
    });
    assert.equal(JSON.stringify(v9off), JSON.stringify(legacy), `${date}: off con dati v9 ≠ storico`);
  }
});
