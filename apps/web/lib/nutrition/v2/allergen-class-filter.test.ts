import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLERGEN_CLASS_TOKENS,
  buildAthleteAllergenClasses,
  mapFoodPhrasesToAllergenClasses,
  normalizeAllergenClassList,
  normalizeAllergenClassToken,
} from "@/lib/nutrition/meal-plan-profile-food-filter";
import {
  createAllergenFilterContext,
  filterFdcCandidates,
  isAllergenExcludedFdcId,
  isAllergenExcludedInfo,
  type AllergenFoodInfo,
} from "@/lib/nutrition/v2/fdc-candidate-filter";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";

/**
 * Profilo REALE di produzione c2bd27ec-3261-45fb-a9ff-a6dc7e9bc908 (athlete_profiles):
 * allergie ["Noci","nocciole","pesca","mela","paprika","sedano","kiwi"],
 * intolleranze ["Lattosio"], food_exclusions null, dieta omnivore.
 */
const REAL_ALLERGIES = ["Noci", "nocciole", "pesca", "mela", "paprika", "sedano", "kiwi"];
const REAL_INTOLERANCES = ["Lattosio"];

test("mapper: le frasi vere del profilo c2bd27ec → latte + frutta_a_guscio + sedano", () => {
  const classes = mapFoodPhrasesToAllergenClasses([...REAL_ALLERGIES, ...REAL_INTOLERANCES]);
  assert.deepEqual(classes, ["latte", "frutta_a_guscio", "sedano"]);
});

test("mapper: «pesca»/«mela»/«kiwi»/«paprika» NON producono classi (niente falsi positivi)", () => {
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["pesca"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["pesche"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["mela", "kiwi", "paprika"]), []);
  // ...ma il pesce vero sì.
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["pesce"]), ["pesce"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["Salmone"]), ["pesce"]);
});

test("mapper: casi veri di produzione, IT ed EN, anche in una sola stringa", () => {
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["Noci, nocciole"]), ["frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["frutta a guscio"]), ["frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["tree nuts"]), ["frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["crostacei"]), ["crostacei"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["Lattosio"]), ["latte"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["lactose"]), ["latte"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["shellfish"]), ["crostacei"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["Cozze"]), ["molluschi"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["glutine"]), ["glutine"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["celiachia"]), ["glutine"]);
});

test("mapper: arachidi ≠ frutta a guscio; «burro di arachidi» non è latte", () => {
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["peanut"]), ["arachidi"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["burro di arachidi"]), ["arachidi"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["burro"]), ["latte"]);
});

test("mapper: vocabolario CHIUSO — nessuna classe fuori dai 14 token", () => {
  assert.equal(ALLERGEN_CLASS_TOKENS.length, 14);
  const all = mapFoodPhrasesToAllergenClasses([
    "glutine", "crostacei", "uova", "pesce", "arachidi", "soia", "latte",
    "frutta a guscio", "sedano", "senape", "sesamo", "solfiti", "lupini", "molluschi",
  ]);
  assert.deepEqual([...all].sort(), [...ALLERGEN_CLASS_TOKENS].sort());
  assert.equal(normalizeAllergenClassToken("Frutta a guscio"), "frutta_a_guscio");
  assert.equal(normalizeAllergenClassToken("FRUTTA_A_GUSCIO"), "frutta_a_guscio");
  assert.equal(normalizeAllergenClassToken("banane"), null);
  assert.deepEqual(normalizeAllergenClassList(["latte", "banane", "latte", null]), ["latte"]);
});

test("buildAthleteAllergenClasses: solo allergie e intolleranze diventano classi", () => {
  const c = buildAthleteAllergenClasses({
    allergies: REAL_ALLERGIES,
    intolerances: REAL_INTOLERANCES,
    foodExclusions: ["sesamo"],
  });
  assert.deepEqual(c.allergyClasses, ["latte", "frutta_a_guscio", "sedano"]);
  // L'esclusione per gusto NON arma una classe: resta il filtro morbido per etichetta
  // (buildMealPlanFoodDenyFragments), altrimenti sparirebbe l'intera famiglia.
  assert.deepEqual(c.exclusionClasses, []);
  assert.deepEqual(c.all, ["latte", "frutta_a_guscio", "sedano"]);
});

// ── Decisione sul candidato ──────────────────────────────────────────────────────────

const reviewed = (classes: string[]): AllergenFoodInfo =>
  ({ classes, reviewed: true }) as AllergenFoodInfo;
const notReviewed = (classes: string[] = []): AllergenFoodInfo =>
  ({ classes, reviewed: false }) as AllergenFoodInfo;

function realAthleteContext() {
  const classes = buildAthleteAllergenClasses({
    allergies: REAL_ALLERGIES,
    intolerances: REAL_INTOLERANCES,
    foodExclusions: null,
  });
  return createAllergenFilterContext({
    allergyClasses: classes.allergyClasses,
    exclusionClasses: classes.exclusionClasses,
    foodIndex: new Map<number, AllergenFoodInfo>([
      [170585, reviewed(["frutta_a_guscio"])], // Frutta secca mista tostata
      [2346392, reviewed(["frutta_a_guscio"])], // Pinoli
      [2259792, reviewed(["latte"])], // Latticello
      [169988, reviewed(["sedano"])], // Sedano
      [171413, reviewed([])], // Olio EVO — esaminato, nessuna classe
      [169705, reviewed(["glutine"])], // Fiocchi d'avena — classe che l'atleta tollera
      [999001, notReviewed()], // mai esaminato
    ]),
  });
}

test("decisione a: il cibo porta una classe non tollerata → ESCLUSO", () => {
  const ctx = realAthleteContext();
  assert.ok(ctx);
  assert.equal(isAllergenExcludedFdcId(170585, ctx), true, "Frutta secca mista tostata");
  assert.equal(isAllergenExcludedFdcId(2346392, ctx), true, "Pinoli");
  assert.equal(isAllergenExcludedFdcId(2259792, ctx), true, "Latticello");
  assert.equal(isAllergenExcludedFdcId(169988, ctx), true, "Sedano");
});

test("decisione b: fail-closed — cibo mai esaminato o sconosciuto → ESCLUSO", () => {
  const ctx = realAthleteContext();
  assert.equal(ctx!.failClosed, true);
  assert.equal(isAllergenExcludedFdcId(999001, ctx), true, "allergens_reviewed = false");
  assert.equal(isAllergenExcludedFdcId(424242, ctx), true, "fdcId fuori dall'indice");
  assert.equal(isAllergenExcludedFdcId(null, ctx), true, "candidato senza fdcId");
});

test("decisione c: cibo esaminato con classi tollerate → AMMESSO", () => {
  const ctx = realAthleteContext();
  assert.equal(isAllergenExcludedFdcId(171413, ctx), false, "Olio EVO");
  assert.equal(isAllergenExcludedFdcId(169705, ctx), false, "Fiocchi d'avena (glutine tollerato)");
});

test("decisione d: atleta senza dichiarazioni → contesto null, niente cambia", () => {
  const classes = buildAthleteAllergenClasses({ allergies: [], intolerances: null, foodExclusions: null });
  assert.deepEqual(classes.all, []);
  const ctx = createAllergenFilterContext({
    allergyClasses: classes.allergyClasses,
    exclusionClasses: classes.exclusionClasses,
    foodIndex: new Map([[999001, notReviewed()]]),
  });
  assert.equal(ctx, null);
  assert.equal(isAllergenExcludedFdcId(999001, ctx), false);
  assert.equal(isAllergenExcludedInfo(notReviewed(), ctx), false);
});

test("fail-closed NON armato dalle sole esclusioni (preferenza, non allergia)", () => {
  const ctx = createAllergenFilterContext({
    allergyClasses: [],
    exclusionClasses: ["sesamo"],
    foodIndex: new Map<number, AllergenFoodInfo>([
      [1, reviewed(["sesamo"])],
      [2, notReviewed()],
    ]),
  });
  assert.ok(ctx);
  assert.equal(ctx!.failClosed, false);
  assert.equal(isAllergenExcludedFdcId(1, ctx), true, "classe esclusa → fuori comunque");
  assert.equal(isAllergenExcludedFdcId(2, ctx), false, "non esaminato → dentro (nessuna allergia)");
});

test("guardia rollout: catalogo senza NESSUNA riga esaminata → fail-closed spento", () => {
  const ctx = createAllergenFilterContext({
    allergyClasses: ["latte"],
    foodIndex: new Map<number, AllergenFoodInfo>([[1, notReviewed()], [2, notReviewed()]]),
  });
  assert.ok(ctx);
  assert.equal(ctx!.failClosed, false, "senza fonte di classificazione bloccare tutto svuoterebbe il piano");
  assert.equal(isAllergenExcludedFdcId(1, ctx), false);
});

test("filterFdcCandidates: allergeni prima, deny per sottostringa come rete secondaria", () => {
  const hit = (fdcId: number, description: string): FdcFoodBrowseHit =>
    ({
      fdcId,
      description,
      kcalPer100g: 100,
      proteinPer100g: 5,
      carbsPer100g: 10,
      fatPer100g: 2,
      tags: {
        mealCourse: [], foodFamily: [], macroDominant: [], slotFit: [], dietProfile: [],
        dietExclude: [], mealRole: [], aminoProfile: [], nutrientDensity: [], classifierVersion: "test",
      },
      tagSource: "db",
    }) as FdcFoodBrowseHit;

  const ctx = realAthleteContext();
  const out = filterFdcCandidates(
    [hit(2346392, "Pinoli"), hit(2259792, "Latticello"), hit(999001, "Crema di semi"), hit(171413, "Olio EVO")],
    ["noci", "nocciole"],
    ctx,
  );
  assert.deepEqual(out.map((c) => c.description), ["Olio EVO"]);

  // Senza contesto allergeni resta ESATTAMENTE il comportamento di oggi (il difetto):
  // "Pinoli" e "Latticello" non contengono nessuno dei frammenti e passano.
  const legacy = filterFdcCandidates(
    [hit(2346392, "Pinoli"), hit(2259792, "Latticello"), hit(999001, "Crema di semi"), hit(171413, "Olio EVO")],
    ["noci", "nocciole"],
  );
  assert.deepEqual(legacy.map((c) => c.description), ["Pinoli", "Latticello", "Crema di semi", "Olio EVO"]);
});
