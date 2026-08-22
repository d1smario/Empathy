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
  isAnchoredPowderEntry,
  isBreakfastSweetEntry,
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
  // R-D (v11, decisione del proprietario): il denominatore è la somma CHO delle SOLE
  // linee a ruolo glucidico (cho_complex + cho_simple + frutta), NON il CHO totale del
  // pasto — la regola di Mario ripartisce la BASE glucidica della colazione e il
  // lattosio di latte/yogurt (choOther) non c'entra: col totale a denominatore uno
  // yogurt zuccherino flaggava colazioni perfettamente a regola. Forbetta invariata
  // [0,75, 0,90].
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
  // R-D: il lattosio dello yogurt (choOther = 9 g su una linea protein_primary) NON
  // entra nel denominatore — la quota resta 50,5/61 = 83% (dentro), CON o SENZA
  // yogurt. (Prima di R-D il denominatore era s.totals.choG: lo stesso pasto veniva
  // flaggato a 72% per colpa di CHO che la regola di Mario non governa.)
  const hidden = buildMealGrammarProvenance({ mode: "shadow", applied: false, before: [], after: [mkSlot(50.5, 10.5, 9)], recipesAvailable: 0 });
  assert.ok(!hidden.flags.some((f) => f.startsWith("b01_share_out")), hidden.flags.join(","));
  const clean = buildMealGrammarProvenance({ mode: "shadow", applied: false, before: [], after: [mkSlot(50.5, 10.5)], recipesAvailable: 0 });
  assert.ok(!clean.flags.some((f) => f.startsWith("b01_share_out")), clean.flags.join(","));
  // Fuori forbetta sulla BASE glucidica → flagga anche in presenza di choOther: la
  // verifica non è stata spenta, ha solo il denominatore giusto (50/80 = 63%).
  const still = buildMealGrammarProvenance({ mode: "shadow", applied: false, before: [], after: [mkSlot(50, 30, 9)], recipesAvailable: 0 });
  assert.ok(still.flags.some((f) => f.startsWith("b01_share_out:breakfast:")), still.flags.join(","));
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

test("v9/v11 scaleRecipe: ancora della polvere per COMPONENTE (V11_G01, family-agnostica), totali = Σ componenti", () => {
  // Predicato componente (fix V11_G01): polvere = marcatore P01 (disabled) + PRO_PRIMARY
  // + densità proteica ≥ 40 g/100. Il vecchio gate sul NOME famiglia mancava i template
  // v11 con polvere fuori dalle famiglie *PROTEIN* (PORRIDGE, SWEET_FAST).
  assert.equal(isAnchoredPowderEntry(whey9), true);
  assert.equal(isAnchoredPowderEntry(almondDrink9), false, "liquido enabled: niente marcatore");
  // In prod default_enabled=false lo portano anche oli e germogli: NON sono polveri.
  const oil11 = food("sesame_oil", "Olio di sesamo", { kcal: 884, cho: 0, pro: 0, fat: 100 }, roles({}, { breakfast: 4, snack: 4 }, { macroRole: "FAT_PRIMARY", generativeTier: "ROTATION", defaultEnabled: false, prepSpeed: 10 }));
  const sprout11 = food("alfalfa_sprouts", "Germogli di erba medica", { kcal: 23, cho: 2.1, pro: 3.99, fat: 0.69 }, roles({}, { breakfast: 2, snack: 2 }, { macroRole: "PRO_PRIMARY", generativeTier: "ROTATION", defaultEnabled: false, prepSpeed: 5 }));
  assert.equal(isAnchoredPowderEntry(oil11), false, "olio marcato P01: FAT_PRIMARY, non polvere");
  assert.equal(isAnchoredPowderEntry(sprout11), false, "germoglio PRO_PRIMARY marcato: densità 3,99 sotto soglia");
  // Polvere più «leggera» in prod: soy_protein_powder 47,6 g/100 — deve passare la soglia.
  const soy11 = food("soy_protein_powder", "Proteine di soia in polvere", { kcal: 338, cho: 20, pro: 47.6, fat: 1.2 }, roles({}, { breakfast: 7, snack: 8 }, { macroRole: "PRO_PRIMARY", generativeTier: "ROTATION", defaultEnabled: false, prepSpeed: 10 }));
  assert.equal(isAnchoredPowderEntry(soy11), true);

  const idxV11 = menuFoodEntryIndex(new Map<string, MenuFoodEntry[]>([...v9ShakePools(), ["v11_ing", [oil11, soy11]]]));
  const cand = recipeCandidatesForMeal({ recipes: [shake9], entryIndex: idxV11, meal: "breakfast" })[0]!;
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

  // V11_G01 (regressione del buco): family PORRIDGE — SENZA «PROTEIN» nel nome, come
  // EMP_RECIPE_210 — con whey dentro: l'ancora si applica lo stesso.
  const porridge11: MenuRecipe = { ...shake9, id: "p11", recipeKey: "porridge_whey_v11", labelIt: "Porridge con whey", family: "PORRIDGE" };
  const pCand = recipeCandidatesForMeal({ recipes: [porridge11], entryIndex: idxV11, meal: "breakfast" })[0]!;
  const pBig = scaleRecipe(pCand, 350);
  assert.equal(pBig.components.find((c) => c.canonicalKey === "whey_protein_powder")!.grams, 35, "family PORRIDGE: whey ancorata a 35 (prima del fix scalava a 37,5)");
  assert.ok(Math.abs(pBig.components.reduce((a, c) => a + c.grams, 0) - 350) < 0.3);
  // family SWEET_FAST (EMP_RECIPE_249/250) con proteine di soia: idem.
  const sweetFast11: MenuRecipe = {
    ...shake9,
    id: "sf11",
    recipeKey: "latte_soia_proteine_v11",
    labelIt: "Latte, proteine e frutta",
    family: "SWEET_FAST",
    components: [
      { position: 1, canonicalKey: "soy_protein_powder", fdcId: soy11.fdcId, labelIt: "Proteine di soia in polvere", gramsPer100g: 10.71, isNeutral: false },
      { position: 2, canonicalKey: "almond_drink_unsweetened", fdcId: almondDrink9.fdcId, labelIt: "Bevanda di mandorla", gramsPer100g: 89.29, isNeutral: false },
    ],
  };
  const sfCand = recipeCandidatesForMeal({ recipes: [sweetFast11], entryIndex: idxV11, meal: "snack" })[0]!;
  const sfSmall = scaleRecipe(sfCand, 150);
  assert.equal(sfSmall.components.find((c) => c.canonicalKey === "soy_protein_powder")!.grams, 20, "family SWEET_FAST: soia ancorata a 20 su spuntino piccolo (prima del fix scendeva a 16,1)");

  // Controprova: componente marcato P01 che NON è polvere (olio) → scala proporzionale,
  // l'ancora NON scatta (a 150 g l'olio naive è 15 g e resta 15, non spinto a 20).
  const oilRecipe11: MenuRecipe = {
    ...shake9,
    id: "o11",
    recipeKey: "bevanda_olio_v11",
    labelIt: "Bevanda con olio",
    family: "SWEET_FAST",
    components: [
      { position: 1, canonicalKey: "sesame_oil", fdcId: oil11.fdcId, labelIt: "Olio di sesamo", gramsPer100g: 10, isNeutral: false },
      { position: 2, canonicalKey: "almond_drink_unsweetened", fdcId: almondDrink9.fdcId, labelIt: "Bevanda di mandorla", gramsPer100g: 90, isNeutral: false },
    ],
  };
  const oilCand = recipeCandidatesForMeal({ recipes: [oilRecipe11], entryIndex: idxV11, meal: "breakfast" })[0]!;
  assert.equal(scaleRecipe(oilCand, 150).components.find((c) => c.canonicalKey === "sesame_oil")!.grams, 15, "olio marcato P01: nessuna ancora");

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

// ═══ SISTEMA TEMPLATE v11 (file Mario v11: colazioni/spuntini template-first) ══════════
// Catalogo finto con dati v6+v9 e ricette-TEMPLATE con template_meta (come il DB dopo le
// migrazioni 20260822*): V10_B01/B02 (il template occupa gli slot che copre), V10_S01
// (frutta solo side per CHO residuo), V10_G01 (template-first sistematico), D3
// (rotazione tier → gruppo-variante → protein_base), regole R-A..R-D del proprietario.

import {
  GRAMMAR_SNACK_PRO_EGG_MAX_G,
  GRAMMAR_SNACK_PRO_MAX_G,
  chooseRecipeForSlot as chooseRecipeForSlotV11,
  isSnackFruitSideEntry,
  lineDroppableBelowMinServed,
  recipeOwnsCarb,
  snackFruitSideEntries,
} from "@/lib/nutrition/v2/meal-grammar";
import type { MenuRecipeTemplateMeta } from "@/lib/nutrition/v2/menu-recipe-catalog-db";

const milk11 = food("milk_semi_skimmed", "Latte parzialmente scremato", { kcal: 46, cho: 5, pro: 3.3, fat: 1.5 }, roles({ breakfast: "PRO_PRIMARY", snack: "PRO_PRIMARY" }, { breakfast: 9, snack: 8 }, { breakfastProteinRole: "PRIMARY", snackRole: "FAST_PROTEIN", mediterraneanPriority: "PRIMARY", substitutionGroup: "BREAKFAST_PROTEIN_DAIRY", generativeTier: "CORE", defaultEnabled: true, prepSpeed: 10 }), { rotationKey: "breakfast:latte11", isAnimalProduct: true, servingBasis: "ml" });
const bread11 = food("bread_rye11", "Pane di segale", { kcal: 259, cho: 48, pro: 8.5, fat: 3.3 }, roles({ breakfast: "CHO_PRIMARY", snack: "CHO_PRIMARY" }, { breakfast: 9, snack: 8 }, { breakfastChoRole: "PRIMARY_COMPLEX", snackRole: "FAST_CARB", mediterraneanPriority: "PRIMARY", substitutionGroup: "BREAD_BASED_CARB", generativeTier: "CORE", prepSpeed: 10 }), { rotationKey: "breakfast:bread11" });
const bresaola11 = food("bresaola11", "Bresaola", { kcal: 151, cho: 0.4, pro: 32, fat: 2.6 }, roles({ snack: "PRO_SECONDARY" }, { snack: 8 }, { snackRole: "FAST_PROTEIN", mediterraneanPriority: "ROTATION", substitutionGroup: "CURED_LEAN", generativeTier: "ROTATION", prepSpeed: 10 }), { rotationKey: "prot:bresaola11", isMeat: true });
const grana11 = food("grana11", "Grana Padano", { kcal: 392, cho: 0, pro: 33, fat: 28 }, roles({ snack: "PRO_SECONDARY" }, { snack: 7 }, { snackRole: "FAST_FAT_PRO", mediterraneanPriority: "COMMON", substitutionGroup: "CHEESE_PROTEIN", generativeTier: "ROTATION", prepSpeed: 10 }), { rotationKey: "prot:grana11", isAnimalProduct: true });
const egg11 = food("egg_whole", "Uova", { kcal: 143, cho: 0.7, pro: 12.6, fat: 9.5 }, roles({ snack: "PRO_SECONDARY" }, { snack: 8 }, { snackRole: "MEDIUM", mediterraneanPriority: "COMMON", substitutionGroup: "EGG_PROTEIN", prepSpeed: 8 }), { rotationKey: "breakfast:egg11", isAnimalProduct: true });

function template(
  id: string,
  key: string,
  meal: "breakfast" | "snack",
  family: string,
  tier: "CORE" | "ROTATION",
  meta: Partial<MenuRecipeTemplateMeta>,
  comps: Array<[MenuFoodEntry | null, number]>,
): MenuRecipe {
  return {
    id,
    recipeKey: key,
    labelIt: key.replace(/_/g, " "),
    note: null,
    frequency: "COMMON",
    maxWeek: 3,
    family,
    tier,
    selectionWeight: 100,
    meals: [meal],
    templateMeta: {
      primaryCarbFamily: null,
      proteinBaseFamily: null,
      fruitFamily: null,
      fatAddonFamily: null,
      variantGroup: null,
      standardServingG: null,
      ...meta,
    },
    components: comps.map(([e, g], i) =>
      e
        ? { position: i + 1, canonicalKey: e.canonicalKey, fdcId: e.fdcId, labelIt: e.labelIt, gramsPer100g: g, isNeutral: false }
        : { position: i + 1, canonicalKey: null, fdcId: null, labelIt: "Acqua / brodo neutro", gramsPer100g: g, isNeutral: true },
    ),
  };
}

const bowl11 = template("v11a", "bowl_avena_latte_mela_mandorle", "breakfast", "CEREAL_BOWL", "CORE",
  { primaryCarbFamily: "OATS", proteinBaseFamily: "DAIRY_MILK", fruitFamily: "APPLE", fatAddonFamily: "NUTS", variantGroup: "VG_BOWL", standardServingG: 435 },
  [[oat6, 16], [milk11, 57], [apple6, 23], [nuts6, 4]]);
const porridge11 = template("v11b", "porridge_avena_latte", "breakfast", "PORRIDGE", "CORE",
  { primaryCarbFamily: "OATS", proteinBaseFamily: "DAIRY_MILK", variantGroup: "VG_PORRIDGE" },
  [[oat6, 22], [milk11, 78]]);
const yogBowl11 = template("v11c", "bowl_yogurt_avena_mela", "breakfast", "YOGURT_BOWL", "CORE",
  { primaryCarbFamily: "OATS", proteinBaseFamily: "YOGURT", fruitFamily: "APPLE", variantGroup: "VG_YOG" },
  [[oat6, 15], [yog6, 62], [apple6, 23]]);
const savoury11 = template("v11s1", "pane_segale_bresaola_grana", "snack", "SAVOURY_FAST", "CORE",
  { primaryCarbFamily: "BREAD", proteinBaseFamily: "SAVOURY_PROTEIN", fatAddonFamily: "CHEESE", variantGroup: "VG_SAV" },
  [[bread11, 45], [bresaola11, 35], [grana11, 10], [null, 10]]);
const sweet11 = template("v11s2", "yogurt_mela_mandorle", "snack", "SWEET_FAST", "CORE",
  { primaryCarbFamily: "MIXED", proteinBaseFamily: "YOGURT", fruitFamily: "APPLE", fatAddonFamily: "NUTS", variantGroup: "VG_SWEET" },
  [[yog6, 70], [apple6, 22], [nuts6, 8]]);

/** Pool v6 + un pool virtuale per mettere gli ingredienti v11 nell'entryIndex delle ricette. */
function v11Pools(): MenuFoodPoolMap {
  return new Map<string, MenuFoodEntry[]>([...v6Pools(), ["v11_ing", [milk11, bread11, bresaola11, grana11]]]);
}

test("v11 D2: il template di colazione OCCUPA cho+pro (V10_B02) — con frutta e grasso propri niente linee separate; sistematico, ogni giorno", () => {
  for (const date of DATES.slice(0, 10)) {
    const diagnostics: string[] = [];
    const plan = composeMealPlanV2(requirements, slots(), rawPools(), {
      denyFragments: [],
      request: req(date),
      menuFoodPools: v11Pools(),
      mealGrammar: { enabled: true, recipes: [bowl11], diagnostics },
    });
    const b = plan.find((s) => s.slot === "breakfast")!;
    const rec = b.items.find((it) => it.recipe?.recipeKey === "bowl_avena_latte_mela_mandorle");
    assert.ok(rec, `${date}: template-first è SISTEMATICO (niente roll 1/3): il template c'è ogni giorno`);
    assert.ok(!b.items.some((it) => it.foodRole === "cho_complex"), `${date}: la linea CHO separata è soppressa`);
    assert.ok(!b.items.some((it) => it.foodRole === "protein_primary"), `${date}: la linea proteica separata è soppressa`);
    assert.ok(!b.items.some((it) => it.foodRole === "fat"), `${date}: fat_addon_family=NUTS → niente linea grassi in più`);
    assert.ok(!b.items.some((it) => it.foodRole === "cho_simple"), `${date}: fruit_family=APPLE → niente B02 in più`);
    assert.ok(diagnostics.some((f) => f.startsWith("template_first:breakfast:")), diagnostics.join(","));
    // Il target dello slot governa la porzione: il template non sfora le kcal dello slot.
    const target = slots().find((s) => s.key === "breakfast")!;
    assert.ok(rec!.kcal <= target.kcal + 1, `${date}: ${rec!.kcal} vs ${target.kcal}`);
  }
});

test("v11 D2: template SENZA frutta/grasso propri → la linea grassi e la B02 si AGGIUNGONO (solo quelle)", () => {
  const plan = composeMealPlanV2(requirements, slots(), rawPools(), {
    denyFragments: [],
    request: req(DATES[0]!),
    menuFoodPools: v11Pools(),
    mealGrammar: { enabled: true, recipes: [porridge11] },
  });
  const b = plan.find((s) => s.slot === "breakfast")!;
  assert.ok(b.items.some((it) => it.recipe?.recipeKey === "porridge_avena_latte"));
  assert.ok(!b.items.some((it) => it.foodRole === "cho_complex"), "CHO separata soppressa");
  assert.ok(!b.items.some((it) => it.foodRole === "protein_primary"), "PRO separata soppressa");
  const fat = b.items.find((it) => it.foodRole === "fat");
  assert.equal(fat?.canonicalKey, "nuts6", "fat_addon assente → linea grassi aggiunta (B07)");
  const b02 = b.items.find((it) => it.foodRole === "cho_simple");
  assert.equal(b02?.canonicalKey, "apple6", "fruit assente → quota B02 aggiunta (frutta COMMON)");
});

test("v11 D2 fallback: template vietato (deny su un ingrediente) → colazione a LINEE come oggi, mai vuota", () => {
  for (const date of DATES.slice(0, 5)) {
    const plan = composeMealPlanV2(requirements, slots(), rawPools(), {
      denyFragments: ["latte"],
      request: req(date),
      menuFoodPools: v11Pools(),
      mealGrammar: { enabled: true, recipes: [bowl11, porridge11] },
    });
    const b = plan.find((s) => s.slot === "breakfast")!;
    assert.ok(!b.items.some((it) => it.recipe), `${date}: nessun template (il latte è vietato)`);
    assert.ok(b.items.some((it) => it.foodRole === "cho_complex"), `${date}: fallback a linee — CHO presente`);
    assert.ok(b.items.some((it) => it.foodRole === "protein_primary"), `${date}: fallback a linee — PRO presente`);
  }
});

test("v11 D2 fallback: tetti settimanali esauriti (famiglia avena a 3) → nessuna candidata, colazione a linee non-avena", () => {
  const week = { "breakfast:oat6": 3 };
  const plan = composeMealPlanV2(requirements, slots(), rawPools(), {
    denyFragments: [],
    weeklyStapleCounts: week,
    request: req(DATES[1]!),
    menuFoodPools: v11Pools(),
    mealGrammar: { enabled: true, recipes: [bowl11, porridge11, yogBowl11] },
  });
  const b = plan.find((s) => s.slot === "breakfast")!;
  assert.ok(!b.items.some((it) => it.recipe), "tutti i template sono a base avena: fuori per il tetto di famiglia dell'ingrediente");
  assert.ok(b.items.length > 0, "mai colazione vuota");
  assert.ok(b.items.some((it) => it.foodRole === "cho_complex" && it.canonicalKey !== "oat6"), "CHO da un'altra famiglia");
});

const snackSlot = (carbs: number): MealPlanV2DietSlotBudget => ({ key: "snack_am", label: "Spuntino", pct: 10, kcal: 250, carbs, protein: 20, fat: 8 });

test("v11 D2/V10_S01: spuntino template-led — frutta SOLO come side per CHO residuo ≥ 15 g, dimensionata sul residuo", () => {
  // Template salato denso: il tetto kcal ferma la ricetta a ~110 g → CHO residuo ~21 g → side.
  const diagnostics: string[] = [];
  const plan = composeMealPlanV2(requirements, [snackSlot(45)], rawPools(), {
    denyFragments: [],
    request: req(DATES[2]!),
    menuFoodPools: v11Pools(),
    mealGrammar: { enabled: true, recipes: [savoury11], diagnostics },
  });
  const s = plan[0]!;
  const rec = s.items.find((it) => it.recipe?.recipeKey === "pane_segale_bresaola_grana");
  assert.ok(rec, "il template salato copre lo spuntino");
  assert.ok(!s.items.some((it) => it.foodRole === "protein_secondary"), "V10_S01: niente pairing proteico casuale accanto al template");
  const fruit = s.items.find((it) => it.foodRole === "cho_simple");
  assert.equal(fruit?.canonicalKey, "apple6", "side di frutta per chiudere i CHO");
  assert.ok(diagnostics.includes("fruit_side_added:snack_am"), diagnostics.join(","));
  // Residuo sotto soglia → NESSUN side (il template basta).
  const diag2: string[] = [];
  const plan2 = composeMealPlanV2(requirements, [snackSlot(25)], rawPools(), {
    denyFragments: [],
    request: req(DATES[2]!),
    menuFoodPools: v11Pools(),
    mealGrammar: { enabled: true, recipes: [savoury11], diagnostics: diag2 },
  });
  const s2 = plan2[0]!;
  assert.ok(s2.items.some((it) => it.recipe), "template presente");
  assert.ok(!s2.items.some((it) => it.foodRole === "cho_simple"), "residuo < 15 g → niente frutta side");
  assert.ok(!diag2.includes("fruit_side_added:snack_am"), diag2.join(","));
});

test("v11 D2: marcatore frutta-side (V10_S01) — solo la frutta di snack_cho, mai pane/gallette FAST_CARB", () => {
  assert.equal(isSnackFruitSideEntry(apple6), true, "frutta: FAST_CARB + SECONDARY_SIMPLE");
  assert.equal(isSnackFruitSideEntry(bread11), false, "pane: FAST_CARB ma non quota semplice");
  assert.equal(isSnackFruitSideEntry(banana), true, "fixture v5: CHO_SECONDARY allo spuntino");
  const entries = snackFruitSideEntries(new Map([["snack_cho", [apple6, bread11, pasta6]]]));
  assert.deepEqual(entries.map((e) => e.canonicalKey), ["apple6"]);
});

test("v11 D2: dedupe giornaliero PER RICETTA (non per ingrediente): colazione e due spuntini template lo stesso giorno, mai lo stesso template due volte", () => {
  const daySlots: MealPlanV2DietSlotBudget[] = [
    { key: "breakfast", label: "Colazione", pct: 25, kcal: 600, carbs: 80, protein: 30, fat: 18 },
    { key: "snack_am", label: "Spuntino", pct: 10, kcal: 250, carbs: 30, protein: 15, fat: 8 },
    { key: "snack_pm", label: "Merenda", pct: 10, kcal: 250, carbs: 30, protein: 15, fat: 8 },
  ];
  for (const date of DATES.slice(0, 6)) {
    const plan = composeMealPlanV2(requirements, daySlots, rawPools(), {
      denyFragments: [],
      request: req(date),
      menuFoodPools: v11Pools(),
      mealGrammar: { enabled: true, recipes: [yogBowl11, savoury11, sweet11] },
    });
    const recipesByKeySlot = plan.flatMap((s) => s.items.filter((it) => it.recipe).map((it) => ({ slot: s.slot, key: it.recipe!.recipeKey })));
    const bKeys = recipesByKeySlot.filter((r) => r.slot === "breakfast");
    const sKeys = recipesByKeySlot.filter((r) => r.slot !== "breakfast");
    assert.equal(bKeys.length, 1, `${date}: la colazione ha il suo template (yogurt bowl usa lo yogurt…)`);
    assert.equal(sKeys.length, 2, `${date}: …e ANCHE i due spuntini hanno il loro (T5: lo yogurt della colazione non li affama)`);
    const keys = recipesByKeySlot.map((r) => r.key);
    assert.equal(new Set(keys).size, keys.length, `${date}: mai lo stesso template due volte al giorno`);
  }
});

test("v11 D3: ordinamento template — tier PRIMA del conteggio; conteggio di GRUPPO-VARIANTE; weekCount della ricetta come affinamento", () => {
  const idx = menuFoodEntryIndex(v11Pools());
  const coreA1 = { ...porridge11, id: "d3a1", recipeKey: "d3_core_a1", labelIt: "Core A1", templateMeta: { ...porridge11.templateMeta!, variantGroup: "VG_A" } };
  const coreA2 = { ...porridge11, id: "d3a2", recipeKey: "d3_core_a2", labelIt: "Core A2", templateMeta: { ...porridge11.templateMeta!, variantGroup: "VG_A" } };
  const coreB = { ...porridge11, id: "d3b", recipeKey: "d3_core_b", labelIt: "Core B", templateMeta: { ...porridge11.templateMeta!, variantGroup: "VG_B" } };
  const rotC = { ...porridge11, id: "d3c", recipeKey: "d3_rot_c", labelIt: "Rot C", tier: "ROTATION" as const, templateMeta: { ...porridge11.templateMeta!, variantGroup: "VG_C" } };
  // Il gruppo A è già stato servito (via A1): TUTTO il gruppo A retrocede, il CORE del
  // gruppo B viene prima; la ROTATION resta ULTIMA anche a conteggio zero (tier prima
  // del conteggio — il pasto standard CORE precede le rotazioni).
  const cands = recipeCandidatesForMeal({ recipes: [coreA1, coreA2, coreB, rotC], entryIndex: idx, meal: "breakfast", weekStapleCounts: { "recipe:d3_core_a1": 1 } });
  assert.deepEqual(cands.map((c) => c.recipe.recipeKey), ["d3_core_b", "d3_core_a2", "d3_core_a1", "d3_rot_c"],
    "B (gruppo a 0) < A2 (gruppo a 1, ricetta a 0) < A1 (gruppo a 1, ricetta a 1) < ROTATION");
});

test("v11 D3/V11_B02: tie-break protein_base_family — la base NON usata di recente viene prima (settimana e giorno)", () => {
  const idx = menuFoodEntryIndex(v11Pools());
  const milkBased = { ...porridge11, id: "pb1", recipeKey: "pb_milk", labelIt: "PB milk", templateMeta: { ...porridge11.templateMeta!, variantGroup: "VG_PB" } };
  const yogBased = { ...yogBowl11, id: "pb2", recipeKey: "pb_yog", labelIt: "PB yog", templateMeta: { ...yogBowl11.templateMeta!, variantGroup: "VG_PB" } };
  // Senza memoria: parità totale → ordine per chiave (pb_milk < pb_yog).
  const fresh = recipeCandidatesForMeal({ recipes: [yogBased, milkBased], entryIndex: idx, meal: "breakfast", weekStapleCounts: {} });
  assert.deepEqual(fresh.map((c) => c.recipe.recipeKey), ["pb_milk", "pb_yog"]);
  // La colazione di OGGI ha già usato DAIRY_MILK → lo yogurt passa davanti (day set).
  const day = recipeCandidatesForMeal({ recipes: [yogBased, milkBased], entryIndex: idx, meal: "breakfast", weekStapleCounts: {}, dayUsedProteinBaseFamilies: new Set(["DAIRY_MILK"]) });
  assert.deepEqual(day.map((c) => c.recipe.recipeKey), ["pb_yog", "pb_milk"]);
});

test("v11 D3/V10_G01: `systematic` salta roll 1/3 e budget settimanale (V10_G02: resta solo il max-ripetizioni)", () => {
  const idx = menuFoodEntryIndex(v11Pools());
  const week = { "recipe:pane_segale_bresaola_grana": 1, "recipe:yogurt_mela_mandorle": 2 };
  const cands = recipeCandidatesForMeal({ recipes: [savoury11, sweet11], entryIndex: idx, meal: "snack", weekStapleCounts: week });
  assert.ok(cands.length > 0);
  let systematicPicks = 0;
  let rolledPicks = 0;
  for (let seed = 0; seed < 30; seed += 1) {
    const sys = chooseRecipeForSlotV11({ candidates: cands, seed, slotKey: "snack_am", weekStapleCounts: week, recipeAlreadyToday: false, weeklyCapRecipes: [savoury11, sweet11], systematic: true });
    if (sys) systematicPicks += 1;
    const rolled = chooseRecipeForSlotV11({ candidates: cands, seed, slotKey: "snack_am", weekStapleCounts: week, recipeAlreadyToday: false, weeklyCapRecipes: [savoury11, sweet11] });
    if (rolled) rolledPicks += 1;
  }
  assert.equal(systematicPicks, 30, "sistematico: il template si tenta SEMPRE (budget da 3 già pieno ignorato)");
  assert.equal(rolledPicks, 0, "senza systematic il budget settimanale (3) blocca tutto: il vecchio percorso resta contingentato");
});

test("v11 D4 R-A: la ricetta con fonte CHO dichiarata (patate SECONDARY_CARB) POSSIEDE il carb — leva cho, linea CHO soppressa, flag", () => {
  const polloPatate: MenuRecipe = {
    id: "ra1",
    recipeKey: "bocconcini_pollo_patate",
    labelIt: "Bocconcini di pollo con patate",
    note: null,
    frequency: "COMMON",
    maxWeek: null,
    family: "CHICKEN_DISH",
    tier: "CORE",
    meals: ["lunch", "dinner"],
    components: [
      { position: 1, canonicalKey: "chicken6", fdcId: chicken6.fdcId, labelIt: "Pollo", gramsPer100g: 55, isNeutral: false },
      { position: 2, canonicalKey: "potato6", fdcId: potato6.fdcId, labelIt: "Patate", gramsPer100g: 35, isNeutral: false },
      { position: 3, canonicalKey: null, fdcId: null, labelIt: "Acqua / brodo neutro", gramsPer100g: 10, isNeutral: true },
    ],
  };
  const idx = menuFoodEntryIndex(v6Pools());
  const cand = recipeCandidatesForMeal({ recipes: [polloPatate], entryIndex: idx, meal: "lunch" })[0]!;
  // In macro la ricetta è proteica (quota kcal-CHO < 30%): senza R-A entrerebbe come
  // «secondo» e la pasta resterebbe — due fonti CHO nello stesso piatto.
  assert.equal(recipeLever(cand.per100), "protein", "controprova: il criterio macro direbbe protein");
  assert.equal(recipeOwnsCarb(cand), true, "R-A: le patate (SECONDARY_CARB) sono una fonte CHO dichiarata");
  // Fixture v5 (senza ruoli v6): R-A non scatta, decide il criterio macro come prima.
  const idxV5 = menuFoodEntryIndex(pools());
  const candV5 = recipeCandidatesForMeal({ recipes: [carbonara], entryIndex: idxV5, meal: "lunch" })[0]!;
  assert.equal(recipeOwnsCarb(candV5), false, "degradazione: dati v5 → nessun possesso dichiarato");
  let found = 0;
  for (const date of DATES) {
    const diagnostics: string[] = [];
    const plan2 = composeMealPlanV2(requirements, slots(), rawPools(), {
      denyFragments: [],
      request: req(date),
      menuFoodPools: v6Pools(),
      mealGrammar: { enabled: true, recipes: [polloPatate], diagnostics },
    });
    for (const s of plan2) {
      const it = s.items.find((x) => x.recipe?.recipeKey === "bocconcini_pollo_patate");
      if (!it) continue;
      found += 1;
      assert.ok(!s.items.some((x) => x !== it && x.foodRole === "cho_complex"), `${date} ${s.slot}: R-A — nessuna linea CHO accanto alla ricetta che possiede il carb`);
      assert.ok(diagnostics.some((f) => f.startsWith(`recipe_owns_carb:${s.slot}:`)), diagnostics.join(","));
    }
  }
  assert.ok(found >= 3, `casi R-A osservati in 30 giorni: ${found}`);
});

test("v11 D4 R-B: nessuna linea servita sotto 12 g — predicato (esenzioni: fat, fixed, ricette) e invariante sul composto", () => {
  assert.equal(lineDroppableBelowMinServed({ spec: { lever: "cho" } }, 11), true);
  assert.equal(lineDroppableBelowMinServed({ spec: { lever: "protein" } }, 11.9), true);
  assert.equal(lineDroppableBelowMinServed({ spec: { lever: "cho" } }, 12), false, "alla soglia si serve");
  assert.equal(lineDroppableBelowMinServed({ spec: { lever: "fat" } }, 5), false, "condimenti esenti (5-20 g di olio sono normali)");
  assert.equal(lineDroppableBelowMinServed({ spec: { lever: "fixed" } }, 10), false, "linee a grammi fissi esenti");
  assert.equal(lineDroppableBelowMinServed({ spec: { lever: "cho" }, recipe: {} }, 10), false, "ricette esenti (proporzioni del piatto)");
  // Invariante: su 10 giorni composti sotto grammatica nessun item non-esente sotto 12 g.
  for (const date of DATES.slice(0, 10)) {
    const plan = composeWith(v6Pools(), rawPools(), date, { grammar: true });
    for (const s of plan) {
      for (const it of s.items) {
        if (it.recipe || it.foodRole === "fat") continue;
        assert.ok(it.grams >= 12, `${date} ${s.slot}: «${it.description}» servito a ${it.grams} g`);
      }
    }
  }
});

test("v11 D4 R-C: tetto porzione proteica dello spuntino — 150 g (120 per le uova); senza grammatica resta il maxG storico", () => {
  const bigProteinSnack: MealPlanV2DietSlotBudget[] = [
    { key: "snack_am", label: "Spuntino", pct: 12, kcal: 300, carbs: 20, protein: 30, fat: 8 },
  ];
  const menuYog = new Map<string, MenuFoodEntry[]>([...v6Pools(), ["snack_pro", [yog6]]]);
  const legacy = composeWith(menuYog, rawPools(), DATES[3]!, { slots: bigProteinSnack });
  const legacyPro = legacy[0]!.items.find((it) => /yogurt/i.test(it.description))!;
  assert.equal(Math.round(legacyPro.grams), 200, "storico: il solver spinge lo yogurt al maxG di spec (200 g)");
  const on = composeWith(menuYog, rawPools(), DATES[3]!, { grammar: true, slots: bigProteinSnack });
  const onPro = on[0]!.items.find((it) => it.foodRole === "protein_secondary")!;
  assert.equal(Math.round(onPro.grams), GRAMMAR_SNACK_PRO_MAX_G, "R-C: clamp a 150 g, il solver compensa sulle altre linee");
  const menuEgg = new Map<string, MenuFoodEntry[]>([...v6Pools(), ["snack_pro", [egg11]]]);
  const onEgg = composeWith(menuEgg, rawPools(), DATES[3]!, { grammar: true, slots: bigProteinSnack });
  const eggPro = onEgg[0]!.items.find((it) => it.foodRole === "protein_secondary")!;
  assert.equal(eggPro.canonicalKey, "egg_whole");
  assert.equal(Math.round(eggPro.grams), GRAMMAR_SNACK_PRO_EGG_MAX_G, "R-C: uova a 120 g (≈2 uova)");
});

// ═══ FIX QA 24-30 AGO (varietà: corn flakes 3/7, avocado 6/13, complemento doppio) ═════
// Quattro fix, tutti SOLO sotto grammatica: (1) weekBucket dentro il tier
// dell'ordinamento; (2) condimento M01 esente dal blocco «già usato oggi»; (3) rotazione
// template sulla BASE (primary_carb_family), non sul variant_group di lotto; (4) R-A
// esteso alla proteina (ricetta che possiede il secondo → niente complemento V02).

import {
  GRAMMAR_TEMPLATE_BASE_MAX_WEEK,
  compareGrammarOrderingKeys,
  recipeOwnsProtein,
  templateBaseWeekCounts,
  templateRotationBase,
} from "@/lib/nutrition/v2/meal-grammar";

// Il caso di Mario: CORE di pranzo/cena quasi tutti a score 10/10 — prima del fix
// pareggiavano su tier e score e decideva il seed offset (fino a ~500 punti), che domina
// la penalità settimanale (80-120): la memoria «già usato» non ordinava.
const chickenQ = food("chicken_q", "Pollo QA", { kcal: 110, cho: 0, pro: 23, fat: 1.2 }, roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, { lunch: 10, dinner: 10 }, { mainMealRole: "PRIMARY_PROTEIN", mediterraneanPriority: "COMMON", substitutionGroup: "WHITE_MEAT", generativeTier: "CORE" }), { rotationKey: "prot:polloQ", isMeat: true });
const beefQ = food("beef_q", "Manzo QA", { kcal: 125, cho: 0, pro: 22, fat: 4 }, roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, { lunch: 10, dinner: 10 }, { mainMealRole: "PRIMARY_PROTEIN", mediterraneanPriority: "COMMON", substitutionGroup: "RED_MEAT", generativeTier: "CORE" }), { rotationKey: "prot:manzoQ", isMeat: true });
const turkeyQ = food("turkey_q", "Tacchino QA", { kcal: 105, cho: 0, pro: 24, fat: 1 }, roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, { lunch: 10, dinner: 10 }, { mainMealRole: "PRIMARY_PROTEIN", mediterraneanPriority: "COMMON", substitutionGroup: "WHITE_MEAT", generativeTier: "CORE" }), { rotationKey: "prot:tacchinoQ", isMeat: true });
const porkQ = food("pork_q", "Maiale QA", { kcal: 140, cho: 0, pro: 21, fat: 6 }, roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, { lunch: 10, dinner: 10 }, { mainMealRole: "PRIMARY_PROTEIN", mediterraneanPriority: "COMMON", substitutionGroup: "RED_MEAT", generativeTier: "CORE" }), { rotationKey: "prot:maialeQ", isMeat: true });
const lambRotQ = food("lamb_q", "Agnello QA", { kcal: 200, cho: 0, pro: 20, fat: 13 }, roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, { lunch: 10, dinner: 10 }, { mainMealRole: "PRIMARY_PROTEIN", mediterraneanPriority: "ROTATION", substitutionGroup: "RED_MEAT", generativeTier: "ROTATION" }), { rotationKey: "prot:agnelloQ", isMeat: true });
const beefQ8 = { ...beefQ, mealRoles: { ...beefQ.mealRoles!, scores: { ...beefQ.mealRoles!.scores, lunch: 8, dinner: 8 } } };

test("QA fix 1: weekBucket ordina DENTRO il tier — dopo il tier, prima dello score; cap a ROTATION_MAX; a parità di uso decide lo score", () => {
  const lunch = { meal: "lunch" as const };
  // Il bucket è il conteggio di FAMIGLIA (max canonical/rotation), cappato a 3.
  assert.equal(grammarOrderingKeys(chickenQ, lunch, { "prot:polloQ": 99 }).weekBucket, 3);
  assert.equal(grammarOrderingKeys(chickenQ, lunch, { chicken_q: 2 }).weekBucket, 2, "conta anche la canonical key");
  assert.equal(grammarOrderingKeys(chickenQ, lunch, {}).weekBucket, 0);
  // CASO PRIMA ROTTO: due CORE a score 10 — quello usato in settimana va DOPO.
  const fresh = grammarOrderingKeys(beefQ, lunch, { "prot:polloQ": 1 });
  const used = grammarOrderingKeys(chickenQ, lunch, { "prot:polloQ": 1 });
  assert.ok(compareGrammarOrderingKeys(fresh, used) < 0, "il meno usato viene prima, a parità di tier e score");
  // Lo score resta la gerarchia A PARITÀ di uso (bucket uguale → score 10 batte 8).
  const w = { "prot:polloQ": 1, "prot:manzoQ": 1 };
  assert.ok(compareGrammarOrderingKeys(grammarOrderingKeys(chickenQ, lunch, w), grammarOrderingKeys(beefQ8, lunch, w)) < 0);
  // CASO CHE NON CAMBIA: il tier decide chi può entrare — CORE usato 3 volte batte ROTATION mai usata.
  const coreUsed = grammarOrderingKeys(chickenQ, lunch, { "prot:polloQ": 3 });
  const rotFresh = grammarOrderingKeys(lambRotQ, lunch, {});
  assert.ok(compareGrammarOrderingKeys(coreUsed, rotFresh) < 0, "familiarità (tier) prima della varietà (bucket)");
});

test("QA fix 1 nel pick: il CORE già servito in settimana non vince più per seed offset; a contatori vuoti la rotazione a seed resta", () => {
  const entries = [chickenQ, beefQ, turkeyQ, porkQ];
  // CASO PRIMA ROTTO: pollo a 1 uso, gli altri a 0 → su NESSUN seed il pollo torna
  // (prima il seed offset — fino a 500 punti — dominava la penalità 80 e lo riproponeva).
  const winners = new Set<string>();
  for (let seed = 0; seed < 40; seed += 1) {
    const p = pickStapleForPool({ poolKey: "lunch_pro", seed, menuEntries: entries, grammar: { meal: "lunch" }, dayCtx: { weekStapleCounts: { "prot:polloQ": 1 } } });
    assert.notEqual(p?.entry.canonicalKey, "chicken_q", `seed ${seed}: il pollo già usato è tornato`);
    winners.add(p!.entry.canonicalKey);
  }
  assert.equal(winners.size, 3, "gli altri tre CORE ruotano col seed dentro il bucket 0");
  // CASO CHE NON CAMBIA: settimana vuota → bucket tutti 0 → decide il seed come prima.
  const freshWinners = new Set<string>();
  for (let seed = 0; seed < 8; seed += 1) {
    const p = pickStapleForPool({ poolKey: "lunch_pro", seed, menuEntries: entries, grammar: { meal: "lunch" }, dayCtx: { weekStapleCounts: {} } });
    freshWinners.add(p!.entry.canonicalKey);
  }
  assert.equal(freshWinners.size, 4, "a contatori vuoti tutti pescabili (rotazione per data intatta)");
});

test("QA fix 2: condimento M01 esente dal blocco «già usato oggi» — l'EVO delle ricette del giorno non regala il pick all'avocado", () => {
  const condimentFilter = { meal: "lunch" as const, v6: { axis: "main" as const, allowed: new Set(["FAT_CONDIMENT"]) } };
  const dayWithEvo = { weekStapleCounts: {}, dayUsedCanonicalKeys: new Set(["evo6"]) };
  // CASO PRIMA ROTTO: EVO in dayUsedCanonicalKeys+usedFdcIds (registrato da una ricetta)
  // → senza esenzione prendeva -5000/-4000 e vinceva SEMPRE avocado.
  const blocked = pickStapleForPool({ poolKey: "main_fat", seed: 0, menuEntries: [evo6, avoc6, oilseed6], grammar: condimentFilter, dayCtx: dayWithEvo, usedFdcIds: new Set([evo6.fdcId]) });
  assert.equal(blocked?.entry.canonicalKey, "avoc6", "senza ignoreUsedToday il blocco resta (pick normali invariati)");
  const exempt = pickStapleForPool({ poolKey: "main_fat", seed: 0, menuEntries: [evo6, avoc6, oilseed6], grammar: { ...condimentFilter, ignoreUsedToday: true }, dayCtx: dayWithEvo, usedFdcIds: new Set([evo6.fdcId]) });
  assert.equal(exempt?.entry.canonicalKey, "evo6", "col fix l'EVO vince per tier/score (M04)");
});

test("QA fix 1×2: nel pick condimento il weekBucket è neutro — l'EVO resta quotidiano anche a memoria settimanale satura e tier in parità", () => {
  // Stesso filtro del pick condimento vero: relaxWeekCaps + ignoreUsedToday (senza il
  // primo, l'EVO a 6 usi cadrebbe sul tetto settimanale -5000 prima dell'ordinamento).
  const condimentFilter = { meal: "lunch" as const, v6: { axis: "main" as const, allowed: new Set(["FAT_CONDIMENT"]) }, relaxWeekCaps: true, ignoreUsedToday: true };
  // evo6/avoc6 sono ENTRAMBI COMMON senza generative_tier (il fallback v6): senza la
  // neutralizzazione, weekBucket(EVO)>0 vs 0 dell'avocado deciderebbe PRIMA dello score
  // e il condimento tornerebbe all'avocado a giorni alterni — il guasto del fix 2,
  // reintrodotto a livello settimana dalla chiave del fix 1.
  const satura = { weekStapleCounts: { evo6: 6 } };
  for (let seed = 0; seed < 8; seed += 1) {
    const p = pickStapleForPool({ poolKey: "main_fat", seed, menuEntries: [evo6, avoc6, oilseed6], grammar: condimentFilter, dayCtx: satura });
    assert.equal(p?.entry.canonicalKey, "evo6", `seed ${seed}: EVO quotidiano anche a bucket saturo (M04 non dipende dai dati)`);
  }
  // CASO CHE NON CAMBIA: fuori dal condimento (niente ignoreUsedToday) il bucket ordina.
  assert.ok(grammarOrderingKeys(evo6, { meal: "lunch" }, { evo6: 6 }).weekBucket > 0, "il bucket resta attivo per i pick normali");
});

test("QA fix 2 nel compositore: ricetta con EVO fra gli ingredienti → il condimento del pasto resta EVO; con EVO escluso (deny) l'avocado resta possibile", () => {
  const pastaOlio: MenuRecipe = {
    id: "qa_f2",
    recipeKey: "pasta_pomodoro_evo_qa",
    labelIt: "Pasta alle zucchine e olio EVO",
    note: null,
    frequency: "COMMON",
    maxWeek: null,
    components: [
      { position: 1, canonicalKey: "pasta6", fdcId: pasta6.fdcId, labelIt: "Pasta", gramsPer100g: 40, isNeutral: false },
      { position: 2, canonicalKey: "veg6", fdcId: veg6.fdcId, labelIt: "Zucchine", gramsPer100g: 25, isNeutral: false },
      { position: 3, canonicalKey: "evo6", fdcId: evo6.fdcId, labelIt: "Olio EVO", gramsPer100g: 2, isNeutral: false },
      { position: 4, canonicalKey: null, fdcId: null, labelIt: "Acqua / brodo neutro", gramsPer100g: 33, isNeutral: true },
    ],
  };
  let found = 0;
  for (const date of DATES) {
    const plan = composeMealPlanV2(requirements, slots(), rawPools(), {
      denyFragments: [],
      request: req(date),
      menuFoodPools: v6Pools(),
      mealGrammar: { enabled: true, recipes: [pastaOlio] },
    });
    for (const s of plan) {
      if (!s.items.some((it) => it.recipe?.recipeKey === "pasta_pomodoro_evo_qa")) continue;
      const fat = s.items.find((it) => it.foodRole === "fat");
      if (!fat) continue; // pasto già ricco: la linea si salta, non è l'oggetto del test
      found += 1;
      assert.equal(fat.canonicalKey, "evo6", `${date} ${s.slot}: l'EVO della ricetta regalava il condimento all'avocado`);
    }
  }
  assert.ok(found >= 3, `casi ricetta-con-EVO osservati in 30 giorni: ${found}`);
  // CASO CHE NON CAMBIA: EVO escluso (deny/dieta) → l'avocado resta il condimento.
  const denyEvo = composeMealPlanV2(requirements, slots(), rawPools(), {
    denyFragments: ["evo6"],
    request: req(DATES[0]!),
    menuFoodPools: v6Pools(),
    mealGrammar: { enabled: true, recipes: [] },
  });
  const lunchFat = denyEvo.find((s) => s.slot === "lunch")!.items.find((it) => it.foodRole === "fat");
  assert.equal(lunchFat?.canonicalKey, "avoc6", "avocado possibile quando l'EVO è escluso");
});

// Fix 3: nel file di Mario variant_group è l'etichetta del LOTTO ("V10_EXISTING" /
// "V11_EXPANDED"), non la base: tutti i corn flakes condividono primary_carb_family
// CORN_FLAKES ma gruppi di lotto diversi → prima del fix nessuna rotazione reale.
const cornflakesQ = food("cornflakes_q", "Corn flakes QA", { kcal: 380, cho: 84, pro: 7, fat: 1 }, roles({ breakfast: "CHO_PRIMARY" }, { breakfast: 9 }, { breakfastChoRole: "PRIMARY_COMPLEX", mediterraneanPriority: "COMMON", substitutionGroup: "BREAKFAST_COMPLEX_CARB", generativeTier: "CORE" }), { rotationKey: "breakfast:cerealiQ" });
const cfLatteQ = template("qa_cf1", "cf_latte_qa", "breakfast", "CEREAL_BOWL", "CORE",
  { primaryCarbFamily: "CORN_FLAKES", proteinBaseFamily: "DAIRY_MILK", variantGroup: "V10_EXISTING" },
  [[cornflakesQ, 20], [milk11, 80]]);
const cfYogQ = template("qa_cf2", "cf_yogurt_qa", "breakfast", "CEREAL_BOWL", "CORE",
  { primaryCarbFamily: "CORN_FLAKES", proteinBaseFamily: "YOGURT", variantGroup: "V11_EXPANDED" },
  [[cornflakesQ, 25], [yog6, 70], [null, 5]]);
const oatPorridgeQ = template("qa_cf3", "porridge_oats_qa", "breakfast", "PORRIDGE", "CORE",
  { primaryCarbFamily: "OATS", proteinBaseFamily: "DAIRY_MILK", variantGroup: "V10_EXISTING" },
  [[oat6, 22], [milk11, 78]]);

function qaTemplatePools(): MenuFoodPoolMap {
  return new Map<string, MenuFoodEntry[]>([...v11Pools(), ["qa_cf_ing", [cornflakesQ]]]);
}

test("QA fix 3: rotazione template sulla BASE (primary_carb_family), non sul variant_group di lotto", () => {
  const idx = menuFoodEntryIndex(qaTemplatePools());
  // Conteggio per base = Σ dei recipe:<key> delle ricette con la stessa base.
  const counts = templateBaseWeekCounts([cfLatteQ, cfYogQ, oatPorridgeQ], { "recipe:cf_latte_qa": 1, "recipe:cf_yogurt_qa": 1 });
  assert.equal(counts.get("CORN_FLAKES"), 2);
  assert.equal(counts.get("OATS") ?? 0, 0);
  // CASO PRIMA ROTTO: corn flakes serviti ieri (cf_latte_qa) → col variant_group di
  // lotto la de-preferenza colpiva cf_latte E il porridge (stesso lotto V10_EXISTING)
  // e riproponeva cf_yogurt (lotto V11_EXPANDED): corn flakes di nuovo. Con la base:
  // il porridge (OATS a 0) viene PRIMA di entrambi i corn flakes.
  const cands = recipeCandidatesForMeal({ recipes: [cfLatteQ, cfYogQ, oatPorridgeQ], entryIndex: idx, meal: "breakfast", weekStapleCounts: { "recipe:cf_latte_qa": 1 } });
  assert.deepEqual(cands.map((c) => c.recipe.recipeKey), ["porridge_oats_qa", "cf_yogurt_qa", "cf_latte_qa"]);
  // VERDETTO: base già servita GRAMMAR_TEMPLATE_BASE_MAX_WEEK (2) volte → TUTTI i
  // template di quella base fuori, qualunque sia la variante/il lotto.
  const capped = recipeCandidatesForMeal({ recipes: [cfLatteQ, cfYogQ, oatPorridgeQ], entryIndex: idx, meal: "breakfast", weekStapleCounts: { "recipe:cf_latte_qa": 1, "recipe:cf_yogurt_qa": 1 } });
  assert.deepEqual(capped.map((c) => c.recipe.recipeKey), ["porridge_oats_qa"], `tetto base a ${GRAMMAR_TEMPLATE_BASE_MAX_WEEK}`);
  // Livello GIORNO: base servita OGGI (set dayUsedTemplateBases) → de-preferenza subito.
  const day = recipeCandidatesForMeal({ recipes: [cfLatteQ, cfYogQ, oatPorridgeQ], entryIndex: idx, meal: "breakfast", weekStapleCounts: {}, dayUsedTemplateBases: new Set(["CORN_FLAKES"]) });
  assert.equal(day[0]!.recipe.recipeKey, "porridge_oats_qa");
  // Null-safe: template senza template_meta → nessun verdetto, bucket 0, nessun errore.
  const noMeta: MenuRecipe = { ...oatPorridgeQ, id: "qa_cf4", recipeKey: "no_meta_qa", templateMeta: null };
  const withNoMeta = recipeCandidatesForMeal({ recipes: [cfLatteQ, noMeta], entryIndex: idx, meal: "breakfast", weekStapleCounts: { "recipe:cf_latte_qa": 2 } });
  assert.deepEqual(withNoMeta.map((c) => c.recipe.recipeKey), ["no_meta_qa"], "senza meta niente verdetto base; il cf al tetto esce");
  // CASO CHE NON CAMBIA: senza memoria settimanale né giorno l'ordine resta tier→chiave.
  const fresh = recipeCandidatesForMeal({ recipes: [cfLatteQ, cfYogQ, oatPorridgeQ], entryIndex: idx, meal: "breakfast", weekStapleCounts: {} });
  assert.deepEqual(fresh.map((c) => c.recipe.recipeKey), ["cf_latte_qa", "cf_yogurt_qa", "porridge_oats_qa"], "a memoria vuota decide la chiave (tutti CORE, bucket 0)");
});

test("QA fix 3 nel compositore: colazione a base corn flakes → lo spuntino template evita la stessa base lo stesso giorno", () => {
  const snackCornQ = template("qa_cf5", "snack_corn_qa", "snack", "SWEET_FAST", "CORE",
    { primaryCarbFamily: "CORN_FLAKES", proteinBaseFamily: "YOGURT", variantGroup: "V10_EXISTING" },
    [[cornflakesQ, 30], [yog6, 70]]);
  const daySlots: MealPlanV2DietSlotBudget[] = [
    { key: "breakfast", label: "Colazione", pct: 25, kcal: 600, carbs: 80, protein: 30, fat: 18 },
    { key: "snack_am", label: "Spuntino", pct: 10, kcal: 250, carbs: 30, protein: 15, fat: 8 },
  ];
  for (const date of DATES.slice(0, 6)) {
    const plan = composeMealPlanV2(requirements, daySlots, rawPools(), {
      denyFragments: [],
      request: req(date),
      menuFoodPools: qaTemplatePools(),
      mealGrammar: { enabled: true, recipes: [cfLatteQ, snackCornQ, sweet11] },
    });
    const b = plan.find((s) => s.slot === "breakfast")!;
    assert.ok(b.items.some((it) => it.recipe?.recipeKey === "cf_latte_qa"), `${date}: colazione corn flakes`);
    const snack = plan.find((s) => s.slot === "snack_am")!;
    const snackRecipe = snack.items.find((it) => it.recipe)?.recipe?.recipeKey;
    assert.equal(snackRecipe, "yogurt_mela_mandorle", `${date}: lo spuntino evita la base CORN_FLAKES del giorno`);
  }
});

test("QA fix 4 (R-A proteina): la ricetta primaria che contiene la proteina vera POSSIEDE il secondo — niente complemento V02", () => {
  // Macro da petto di tacchino COTTO (30 g pro/100, come il turkey_breast di prod): il
  // piatto della fixture arriva a 9,4 g pro/100 — sopra il pavimento di densità, come il
  // riso_tacchino_e_carote reale (9,44 in prod).
  const turkeyQ4 = food("turkey_q4", "Tacchino QA4", { kcal: 135, cho: 0, pro: 30, fat: 1 }, roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, { lunch: 9, dinner: 9 }, { mainMealRole: "PRIMARY_PROTEIN", mediterraneanPriority: "COMMON", substitutionGroup: "WHITE_MEAT" }), { rotationKey: "prot:tacchino_q4", isMeat: true });
  const risoTacchino: MenuRecipe = {
    id: "qa_f4",
    recipeKey: "riso_tacchino_carote_qa",
    labelIt: "Riso, tacchino e carote",
    note: null,
    frequency: "COMMON",
    maxWeek: null,
    meals: ["lunch", "dinner"],
    components: [
      { position: 1, canonicalKey: "rice6", fdcId: rice6.fdcId, labelIt: "Riso", gramsPer100g: 28, isNeutral: false },
      { position: 2, canonicalKey: "turkey_q4", fdcId: turkeyQ4.fdcId, labelIt: "Tacchino", gramsPer100g: 24, isNeutral: false },
      { position: 3, canonicalKey: "veg6", fdcId: veg6.fdcId, labelIt: "Zucchine", gramsPer100g: 20, isNeutral: false },
      { position: 4, canonicalKey: null, fdcId: null, labelIt: "Acqua / brodo neutro", gramsPer100g: 28, isNeutral: true },
    ],
  };
  const qaPools = new Map<string, MenuFoodEntry[]>([...v6Pools(), ["qa_f4_ing", [turkeyQ4]]]);
  const idx = menuFoodEntryIndex(qaPools);
  const cand = recipeCandidatesForMeal({ recipes: [risoTacchino], entryIndex: idx, meal: "lunch" })[0]!;
  assert.equal(recipeOwnsProtein(cand), true, "tacchino PRIMARY_PROTEIN a 24 g/100 → la ricetta possiede la proteina");
  // CASI CHE NON CAMBIANO: componente proteico sotto quota (uovo 14 g/100 nella
  // carbonara) o assente (riso al pomodoro) → il complemento V02 resta dovuto.
  const idxV5 = menuFoodEntryIndex(pools());
  assert.equal(recipeOwnsProtein(recipeCandidatesForMeal({ recipes: [carbonara], entryIndex: idxV5, meal: "lunch" })[0]!), false, "uovo a 14 g/100 < 15: legante, non secondo");
  assert.equal(recipeOwnsProtein(recipeCandidatesForMeal({ recipes: [risoPomodoro], entryIndex: idxV5, meal: "lunch" })[0]!), false);
  // VERIFICA AVVERSARIALE (22 ago): due controesempi presi dal catalogo di prod.
  // 1) pasta/lasagne al ragù — manzo-condimento a ESATTAMENTE 15,00 g/100: la quota è
  //    STRETTA (>), il ragù non è un secondo anche in un piatto denso (lasagne_al_ragu
  //    in prod sta a 10,8 g pro/100: la densità da sola passerebbe).
  const beefRagu = food("beef_ragu_q4", "Manzo macinato (ragù)", { kcal: 250, cho: 0, pro: 26, fat: 15 }, roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, { lunch: 9, dinner: 9 }, { mainMealRole: "PRIMARY_PROTEIN", macroRole: "PRO_PRIMARY", mediterraneanPriority: "COMMON", substitutionGroup: "RED_MEAT" }), { rotationKey: "prot:manzo_q4", isMeat: true });
  const besciamellaQ4 = food("besciamella_q4", "Besciamella e formaggio", { kcal: 180, cho: 6, pro: 25, fat: 7 }, roles({ lunch: "PRO_SECONDARY", dinner: "PRO_SECONDARY" }, { lunch: 6, dinner: 6 }, { mainMealRole: "SECONDARY_PROTEIN", macroRole: "PRO_SECONDARY", mediterraneanPriority: "COMMON", substitutionGroup: "CHEESE_PROTEIN" }), { rotationKey: "prot:besciamella_q4", isAnimalProduct: true });
  const lasagneRagu: MenuRecipe = {
    id: "qa_f4_ragu",
    recipeKey: "lasagne_al_ragu_qa",
    labelIt: "Lasagne al ragù",
    note: null,
    frequency: "COMMON",
    maxWeek: null,
    meals: ["lunch", "dinner"],
    components: [
      { position: 1, canonicalKey: "rice6", fdcId: rice6.fdcId, labelIt: "Sfoglia", gramsPer100g: 28, isNeutral: false },
      { position: 2, canonicalKey: "beef_ragu_q4", fdcId: beefRagu.fdcId, labelIt: "Ragù di manzo", gramsPer100g: 15, isNeutral: false },
      { position: 3, canonicalKey: "besciamella_q4", fdcId: besciamellaQ4.fdcId, labelIt: "Besciamella e formaggio", gramsPer100g: 22, isNeutral: false },
      { position: 4, canonicalKey: "veg6", fdcId: veg6.fdcId, labelIt: "Verdure", gramsPer100g: 15, isNeutral: false },
      { position: 5, canonicalKey: null, fdcId: null, labelIt: "Acqua / brodo neutro", gramsPer100g: 20, isNeutral: true },
    ],
  };
  // 2) cozze al pomodoro con pane — la cozza È il secondo per ruolo (45 g/100 > 15) ma
  //    il piatto è DILUITO (~7 g pro/100 come i 7,21 di prod): sotto il pavimento di
  //    densità NON possiede, il complemento resta dovuto.
  const musselsQ4 = food("mussels_q4", "Cozze", { kcal: 86, cho: 4, pro: 12, fat: 2.2 }, roles({ lunch: "PRO_PRIMARY", dinner: "PRO_PRIMARY" }, { lunch: 8, dinner: 8 }, { mainMealRole: "PRIMARY_PROTEIN", macroRole: "PRO_PRIMARY", mediterraneanPriority: "PRIMARY", substitutionGroup: "SEAFOOD" }), { rotationKey: "prot:cozze_q4", isFish: true });
  const cozzePane: MenuRecipe = {
    id: "qa_f4_cozze",
    recipeKey: "cozze_pomodoro_pane_qa",
    labelIt: "Cozze al pomodoro con pane",
    note: null,
    frequency: "COMMON",
    maxWeek: null,
    meals: ["lunch", "dinner"],
    components: [
      { position: 1, canonicalKey: "rice6", fdcId: rice6.fdcId, labelIt: "Pane", gramsPer100g: 20, isNeutral: false },
      { position: 2, canonicalKey: "mussels_q4", fdcId: musselsQ4.fdcId, labelIt: "Cozze", gramsPer100g: 45, isNeutral: false },
      { position: 3, canonicalKey: "veg6", fdcId: veg6.fdcId, labelIt: "Pomodoro", gramsPer100g: 20, isNeutral: false },
      { position: 4, canonicalKey: null, fdcId: null, labelIt: "Acqua / brodo neutro", gramsPer100g: 15, isNeutral: true },
    ],
  };
  const idxAdv = menuFoodEntryIndex(new Map<string, MenuFoodEntry[]>([...qaPools, ["qa_f4_adv", [beefRagu, besciamellaQ4, musselsQ4]]]));
  assert.equal(recipeOwnsProtein(recipeCandidatesForMeal({ recipes: [lasagneRagu], entryIndex: idxAdv, meal: "lunch" })[0]!), false, "manzo del ragù a 15,00 esatti: quota stretta, il complemento V02 resta dovuto");
  assert.equal(recipeOwnsProtein(recipeCandidatesForMeal({ recipes: [cozzePane], entryIndex: idxAdv, meal: "lunch" })[0]!), false, "cozze 45 g/100 ma piatto a ~7 g pro/100: sotto il pavimento di densità");
  // Nel compositore: dove la ricetta entra come primo, NESSUNA linea proteica accanto + flag.
  let found = 0;
  for (const date of DATES) {
    const diagnostics: string[] = [];
    const plan = composeMealPlanV2(requirements, slots(), rawPools(), {
      denyFragments: [],
      request: req(date),
      menuFoodPools: qaPools,
      mealGrammar: { enabled: true, recipes: [risoTacchino], diagnostics },
    });
    for (const s of plan) {
      const it = s.items.find((x) => x.recipe?.recipeKey === "riso_tacchino_carote_qa");
      if (!it) continue;
      found += 1;
      assert.ok(!s.items.some((x) => x.foodRole === "protein_primary"), `${date} ${s.slot}: complemento V02 accanto a una ricetta che ha già il tacchino`);
      assert.ok(diagnostics.some((f) => f.startsWith(`recipe_owns_protein:${s.slot}:riso_tacchino_carote_qa`)), diagnostics.join(","));
    }
  }
  assert.ok(found >= 3, `casi ricetta-con-proteina osservati in 30 giorni: ${found}`);
  // Controprova compositore: il riso al pomodoro (senza proteina propria) CONSERVA il
  // complemento e non emette il flag (il comportamento V02 storico non cambia).
  let complemented = 0;
  for (const date of DATES.slice(0, 15)) {
    const diagnostics: string[] = [];
    const plan = composeMealPlanV2(requirements, slots(), emptyPools, {
      denyFragments: [],
      request: req(date),
      menuFoodPools: pools(),
      mealGrammar: { enabled: true, recipes: [risoPomodoro], diagnostics },
    });
    assert.ok(!diagnostics.some((f) => f.startsWith("recipe_owns_protein:")), diagnostics.join(","));
    for (const s of plan) {
      if (s.items.some((x) => x.recipe) && s.items.some((x) => x.foodRole === "protein_primary")) complemented += 1;
    }
  }
  assert.ok(complemented >= 1, "il complemento V02 resta per le ricette senza proteina propria");
});

// ═══ VERIFICA AVVERSARIALE 22 AGO (fix c-bis: MIXED catch-all; fix 4-bis: legumi) ══════

test("QA fix c-bis: MIXED è il catch-all degli spuntini, non una base — niente verdetto, bucket 0, niente de-preferenza giorno", () => {
  // Nei dati v11 MIXED raggruppa 22/27 template spuntino senza base glucidica comune
  // (smoothie, yogurt+frutta, panino con bresaola): trattarla come base ruotabile col
  // tetto duro 2/sett spegneva il percorso template a metà settimana.
  const mixedMilk = template("qacb1", "latte_mela_noci_qa", "snack", "SWEET_FAST", "CORE",
    { primaryCarbFamily: "MIXED", proteinBaseFamily: "DAIRY_MILK", variantGroup: "VG_MIX2" },
    [[milk11, 70], [apple6, 20], [nuts6, 10]]);
  const paninoMixed = template("qacb2", "pane_bresaola_qa_mixed", "snack", "SAVOURY_FAST", "CORE",
    { primaryCarbFamily: "MIXED", proteinBaseFamily: "SAVOURY_PROTEIN", variantGroup: "VG_SAV_M" },
    [[bread11, 45], [bresaola11, 40], [null, 15]]);
  assert.equal(templateRotationBase(sweet11), null, "MIXED = senza base ai fini della rotazione");
  assert.equal(templateRotationBase(savoury11), "BREAD", "le basi reali restano basi");
  // Il conteggio per base NON conta MIXED (le basi reali sì).
  const counts = templateBaseWeekCounts([sweet11, mixedMilk, savoury11], {
    "recipe:yogurt_mela_mandorle": 1,
    "recipe:latte_mela_noci_qa": 1,
    "recipe:pane_segale_bresaola_grana": 1,
  });
  assert.equal(counts.has("MIXED"), false);
  assert.equal(counts.get("BREAD"), 1);
  // CASO PRIMA ROTTO: 2 MIXED già serviti in settimana → col verdetto sulla base TUTTI
  // i 22 MIXED (panino compreso) sparivano dal percorso template. Ora restano candidati,
  // tutti a bucket 0.
  const idx = menuFoodEntryIndex(v11Pools());
  const after2Mixed = recipeCandidatesForMeal({
    recipes: [sweet11, mixedMilk, paninoMixed],
    entryIndex: idx,
    meal: "snack",
    weekStapleCounts: { "recipe:yogurt_mela_mandorle": 1, "recipe:latte_mela_noci_qa": 1 },
  });
  assert.equal(after2Mixed.length, 3, "nessun verdetto base sui MIXED");
  for (const c of after2Mixed) assert.equal(c.templateOrdering!.baseCount, 0, `${c.recipe.recipeKey}: bucket 0`);
  // Difensivo: «MIXED» nel set del giorno (non dovrebbe più entrarci) non retrocede nulla.
  const dayMixed = recipeCandidatesForMeal({
    recipes: [sweet11, mixedMilk, paninoMixed],
    entryIndex: idx,
    meal: "snack",
    weekStapleCounts: {},
    dayUsedTemplateBases: new Set(["MIXED"]),
  });
  for (const c of dayMixed) assert.equal(c.templateOrdering!.baseCount, 0);
  // CASO CHE NON CAMBIA: una base REALE al tetto (BREAD a 2) resta verdetto.
  const breadCapped = recipeCandidatesForMeal({
    recipes: [savoury11, paninoMixed],
    entryIndex: idx,
    meal: "snack",
    weekStapleCounts: { "recipe:pane_segale_bresaola_grana": GRAMMAR_TEMPLATE_BASE_MAX_WEEK },
  });
  assert.deepEqual(breadCapped.map((c) => c.recipe.recipeKey), ["pane_bresaola_qa_mixed"], "BREAD al tetto esce, il MIXED resta");
});

test("QA fix 4-bis: PRIMARY_OR_SECONDARY_PROTEIN (legumi, ripiego vegano L02) NON possiede il secondo", () => {
  // riso_piselli_e_parmigiano: 8,4 g pro/100 (11% kcal proteiche) — «possedeva» la
  // proteina via piselli e sopprimeva un complemento che il solver non può compensare.
  const peasQ4 = food("peas_q4", "Piselli QA", { kcal: 81, cho: 14, pro: 5.4, fat: 0.4 }, roles({ lunch: "PRO_SECONDARY", dinner: "PRO_SECONDARY" }, { lunch: 8, dinner: 8 }, { mainMealRole: "PRIMARY_OR_SECONDARY_PROTEIN", macroRole: "PRO_SECONDARY", mediterraneanPriority: "PRIMARY", substitutionGroup: "PLANT_PROTEIN" }));
  const risoPiselli: MenuRecipe = {
    id: "qa_f4b",
    recipeKey: "riso_piselli_parmigiano_qa",
    labelIt: "Riso, piselli e parmigiano",
    note: null,
    frequency: "COMMON",
    maxWeek: null,
    meals: ["lunch", "dinner"],
    components: [
      { position: 1, canonicalKey: "rice6", fdcId: rice6.fdcId, labelIt: "Riso", gramsPer100g: 28, isNeutral: false },
      { position: 2, canonicalKey: "peas_q4", fdcId: peasQ4.fdcId, labelIt: "Piselli", gramsPer100g: 28, isNeutral: false },
      { position: 3, canonicalKey: "grana11", fdcId: grana11.fdcId, labelIt: "Parmigiano", gramsPer100g: 6, isNeutral: false },
      { position: 4, canonicalKey: null, fdcId: null, labelIt: "Acqua / brodo neutro", gramsPer100g: 38, isNeutral: true },
    ],
  };
  const qaPools = new Map<string, MenuFoodEntry[]>([...v11Pools(), ["qa_f4b_ing", [peasQ4]]]);
  const idx = menuFoodEntryIndex(qaPools);
  const cand = recipeCandidatesForMeal({ recipes: [risoPiselli], entryIndex: idx, meal: "lunch" })[0]!;
  assert.equal(recipeOwnsProtein(cand), false, "i piselli (28 g/100, PRIMARY_OR_SECONDARY_PROTEIN) non sono il secondo: il complemento V02 resta dovuto");
  // Verifica avversariale 22 ago: anche promuovendo i piselli a macro_role PRO_PRIMARY,
  // il piatto resta DILUITO (~5,5 g pro/100 < pavimento 9) → NON possiede comunque: un
  // piatto a quella densità sottoserve il target proteico qualunque sia il ruolo.
  const peasPrimary = { ...peasQ4, mealRoles: { ...peasQ4.mealRoles!, macroRole: "PRO_PRIMARY" as const } };
  const idxPrimary = menuFoodEntryIndex(new Map<string, MenuFoodEntry[]>([...v11Pools(), ["qa_f4b_ing", [peasPrimary]]]));
  const candPrimary = recipeCandidatesForMeal({ recipes: [risoPiselli], entryIndex: idxPrimary, meal: "lunch" })[0]!;
  assert.equal(recipeOwnsProtein(candPrimary), false, "PRO_PRIMARY ma piatto diluito (~5,5 g pro/100): sotto il pavimento di densità il complemento resta dovuto");
  // CASI CHE ISOLANO LE DUE CONDIZIONI su un piatto DENSO (tempeh 19 g pro/100 al 45%
  // del piatto → ~10,7 g pro/100, sopra il pavimento):
  //  a) mainMealRole PRIMARY_OR_SECONDARY_PROTEIN + macro_role PRO_SECONDARY → il ruolo
  //     NON basta nemmeno con la densità a posto (il predicato di ruolo è isolato);
  //  b) macro_role PRO_PRIMARY → possiede: il ripiego vegano (L02) resta percorribile
  //     quando la proteina vegetale è DAVVERO la proteina del piatto.
  const tempehQ4 = food("tempeh_q4", "Tempeh", { kcal: 195, cho: 8, pro: 19, fat: 11 }, roles({ lunch: "PRO_SECONDARY", dinner: "PRO_SECONDARY" }, { lunch: 8, dinner: 8 }, { mainMealRole: "PRIMARY_OR_SECONDARY_PROTEIN", macroRole: "PRO_SECONDARY", mediterraneanPriority: "COMMON", substitutionGroup: "PLANT_PROTEIN" }), { rotationKey: "prot:tempeh_q4" });
  const risoTempeh: MenuRecipe = {
    id: "qa_f4c",
    recipeKey: "riso_tempeh_qa",
    labelIt: "Riso e tempeh",
    note: null,
    frequency: "COMMON",
    maxWeek: null,
    meals: ["lunch", "dinner"],
    components: [
      { position: 1, canonicalKey: "rice6", fdcId: rice6.fdcId, labelIt: "Riso", gramsPer100g: 28, isNeutral: false },
      { position: 2, canonicalKey: "tempeh_q4", fdcId: tempehQ4.fdcId, labelIt: "Tempeh", gramsPer100g: 45, isNeutral: false },
      { position: 3, canonicalKey: "veg6", fdcId: veg6.fdcId, labelIt: "Zucchine", gramsPer100g: 12, isNeutral: false },
      { position: 4, canonicalKey: null, fdcId: null, labelIt: "Acqua / brodo neutro", gramsPer100g: 15, isNeutral: true },
    ],
  };
  const idxTempeh = menuFoodEntryIndex(new Map<string, MenuFoodEntry[]>([...v11Pools(), ["qa_f4c_ing", [tempehQ4]]]));
  const candTempeh = recipeCandidatesForMeal({ recipes: [risoTempeh], entryIndex: idxTempeh, meal: "lunch" })[0]!;
  assert.equal(recipeOwnsProtein(candTempeh), false, "piatto denso ma ruolo PRIMARY_OR_SECONDARY_PROTEIN/PRO_SECONDARY: non possiede");
  const tempehPrimary = { ...tempehQ4, mealRoles: { ...tempehQ4.mealRoles!, macroRole: "PRO_PRIMARY" as const } };
  const idxTempehPrimary = menuFoodEntryIndex(new Map<string, MenuFoodEntry[]>([...v11Pools(), ["qa_f4c_ing", [tempehPrimary]]]));
  const candTempehPrimary = recipeCandidatesForMeal({ recipes: [risoTempeh], entryIndex: idxTempehPrimary, meal: "lunch" })[0]!;
  assert.equal(recipeOwnsProtein(candTempehPrimary), true, "macro_role PRO_PRIMARY su un piatto denso: il legume/vegetale-proteina possiede il secondo");
});
