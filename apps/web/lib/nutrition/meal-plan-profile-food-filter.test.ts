import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAthleteAllergenClasses,
  buildMealPlanFoodDenyFragments,
  mapFoodPhrasesToAllergenClasses,
} from "@/lib/nutrition/meal-plan-profile-food-filter";
import {
  createAllergenFilterContext,
  isAllergenExcludedFdcId,
  type AllergenFoodInfo,
} from "@/lib/nutrition/v2/fdc-candidate-filter";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";

/**
 * Profilo REALE di produzione c2bd27ec-3261-45fb-a9ff-a6dc7e9bc908 (athlete_profiles,
 * letto il 08/09/2026): allergie ["Noci","nocciole","pesca","mela","paprika","sedano",
 * "kiwi"], intolleranze ["Lattosio"], food_exclusions null, dieta omnivore.
 */
const REAL_ALLERGIES = ["Noci", "nocciole", "pesca", "mela", "paprika", "sedano", "kiwi"];
const REAL_INTOLERANCES = ["Lattosio"];

/** Righe VERE di `nutrition_menu_foods` (allergen_classes/allergens_reviewed in prod). */
const MENU_ROWS: Array<[number, string, string[]]> = [
  [170585, "Frutta secca mista tostata", ["arachidi", "frutta_a_guscio"]],
  [2346392, "Pinoli", ["frutta_a_guscio"]],
  [2259792, "Latticello", ["latte"]],
  [169988, "Sedano", ["sedano"]],
  [2512378, "Grano saraceno", []],
  [170173, "Latte di cocco", []],
  [171413, "Olio EVO", []],
];

function menuIndex(): Map<number, AllergenFoodInfo> {
  return new Map<number, AllergenFoodInfo>(
    MENU_ROWS.map(([fdcId, , classes]) => [
      fdcId,
      { classes, reviewed: true } as AllergenFoodInfo,
    ]),
  );
}

function requestOf(p: Partial<Pick<IntelligentMealPlanRequest, "allergies" | "intolerances" | "foodExclusions">>) {
  return {
    allergies: p.allergies ?? null,
    intolerances: p.intolerances ?? null,
    foodExclusions: p.foodExclusions ?? null,
  };
}

// ── 1. Le esclusioni per GUSTO non sono allergie ─────────────────────────────────────

test("esclusioni per gusto: NON producono classi (niente fail-closed, niente famiglia intera)", () => {
  const classes = buildAthleteAllergenClasses(requestOf({ foodExclusions: ["noci", "latte di cocco"] }));
  assert.deepEqual(classes.allergyClasses, [], "il gusto non è un'allergia");
  assert.deepEqual(classes.exclusionClasses, [], "il gusto non arma nessuna classe");
  assert.deepEqual(classes.all, []);

  // Senza classi non c'è nemmeno contesto: il filtro per classi resta spento e
  // «Pinoli» (frutta a guscio) NON sparisce solo perché a uno non piacciono le noci.
  const ctx = createAllergenFilterContext({
    allergyClasses: classes.allergyClasses,
    exclusionClasses: classes.exclusionClasses,
    foodIndex: menuIndex(),
  });
  assert.equal(ctx, null, "nessuna dichiarazione clinica → contesto nullo, come prima");
  assert.equal(isAllergenExcludedFdcId(2346392, ctx), false, "Pinoli");
  assert.equal(isAllergenExcludedFdcId(999001, ctx), false, "cibo non classificato → dentro");
});

test("esclusioni per gusto: restano un filtro MORBIDO per etichetta (comportamento di prima)", () => {
  const fragments = buildMealPlanFoodDenyFragments({
    allergies: null,
    intolerances: null,
    foodExclusions: ["noci"],
    dietType: null,
    slots: [],
  } as unknown as IntelligentMealPlanRequest);
  assert.ok(fragments.includes("noci"), "l'etichetta «noci» resta esclusa per gusto");
});

test("allergie e intolleranze armano le classi anche quando ci sono esclusioni per gusto", () => {
  const classes = buildAthleteAllergenClasses(
    requestOf({
      allergies: REAL_ALLERGIES,
      intolerances: REAL_INTOLERANCES,
      foodExclusions: ["sesamo", "grano saraceno"],
    }),
  );
  assert.deepEqual(classes.allergyClasses, ["latte", "frutta_a_guscio", "sedano"]);
  assert.deepEqual(classes.exclusionClasses, []);
  assert.deepEqual(classes.all, ["latte", "frutta_a_guscio", "sedano"]);
});

// ── 2. Profilo reale: la protezione clinica non si tocca ─────────────────────────────

test("profilo reale c2bd27ec: continua a escludere frutta secca, pinoli e latticello", () => {
  const classes = buildAthleteAllergenClasses(
    requestOf({ allergies: REAL_ALLERGIES, intolerances: REAL_INTOLERANCES }),
  );
  assert.deepEqual(classes.allergyClasses, ["latte", "frutta_a_guscio", "sedano"]);
  const ctx = createAllergenFilterContext({
    allergyClasses: classes.allergyClasses,
    exclusionClasses: classes.exclusionClasses,
    foodIndex: menuIndex(),
  });
  assert.ok(ctx);
  assert.equal(ctx!.failClosed, true, "allergie dichiarate + catalogo esaminato → fail-closed");
  assert.equal(isAllergenExcludedFdcId(170585, ctx), true, "Frutta secca mista tostata");
  assert.equal(isAllergenExcludedFdcId(2346392, ctx), true, "Pinoli");
  assert.equal(isAllergenExcludedFdcId(2259792, ctx), true, "Latticello");
  assert.equal(isAllergenExcludedFdcId(169988, ctx), true, "Sedano");
  assert.equal(isAllergenExcludedFdcId(171413, ctx), false, "Olio EVO resta");
  assert.equal(isAllergenExcludedFdcId(999001, ctx), true, "non classificato → fuori (fail-closed)");
});

// ── 3. Falsi positivi del mapper, uno per uno ────────────────────────────────────────

test("mapper: «grano saraceno» non è glutine", () => {
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["grano saraceno"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["Farina di grano saraceno"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["grano turco"]), [], "granoturco = mais");
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["malto di riso"]), []);
  // ...ma il grano vero e il malto d'orzo sì.
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["grano"]), ["glutine"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["farina di grano"]), ["glutine"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["malto d'orzo"]), ["glutine"]);
});

test("mapper: le bevande vegetali non sono latte", () => {
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte di cocco"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte di riso"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte di avena"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte di mandorla"]), ["frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte di mandorle"]), ["frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte di soia"]), ["soia"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["yogurt di soia"]), ["soia"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["yogurt vegetale"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["panna vegetale"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["formaggio vegano"]), []);
  // ...ma il latte animale e i suoi derivati sì.
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte"]), ["latte"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte di capra"]), ["latte"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte vaccino"]), ["latte"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latticello"]), ["latte"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["yogurt greco"]), ["latte"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["Lattosio"]), ["latte"]);
});

test("mapper: burro di arachidi è arachidi, non latte", () => {
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["burro di arachidi"]), ["arachidi"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["burro d'arachidi"]), ["arachidi"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["burro di mandorle"]), ["frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["burro di cocco"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["burro"]), ["latte"]);
});

test("mapper: il cocco non è frutta a guscio (non è fra i 14 allergeni UE)", () => {
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["noce di cocco"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["noci di cocco"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["cocco"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["farina di cocco"]), []);
  // ...ma la frutta a guscio vera sì.
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["noci"]), ["frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["noci di macadamia"]), ["frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["noce del brasile"]), ["frutta_a_guscio"]);
});

test("mapper: «noce moscata» è una spezia, «pesca noce» è una pesca", () => {
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["noce moscata"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["noci moscate"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["pesca noce"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["pesche noci"]), []);
});

test("mapper: la riscrittura toglie solo la parola che inganna, non il resto della frase", () => {
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["burro di arachidi e latte"]), ["arachidi", "latte"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte di soia e noci"]), ["soia", "frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["grano saraceno e frumento"]), ["glutine"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["noce di cocco e mandorle"]), ["frutta_a_guscio"]);
});

test("mapper: «pesca» non è «pesce» (falso positivo storico del profilo reale)", () => {
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["pesca"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["pesche"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["mela", "kiwi", "paprika"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["pesce"]), ["pesce"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["Salmone"]), ["pesce"]);
});

// ── 4. Falsi positivi residui: il modificatore non è sempre dopo e adiacente ──────────

test("mapper: ordine INGLESE — «almond milk» non è latte", () => {
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["almond milk"]), ["frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["coconut milk"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["soy milk"]), ["soia"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["oat milk"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["rice milk"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["cashew milk"]), ["frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["soy yogurt"]), ["soia"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["almond butter"]), ["frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["peanut butter"]), ["arachidi"]);
  // ...ma il latte e il burro inglesi, da soli, restano latte.
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["milk"]), ["latte"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["butter"]), ["latte"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["goat milk"]), ["latte"]);
});

test("mapper: connettori mancanti e parole in mezzo", () => {
  // DECISIONE (8 set): «latte ALLE mandorle» resta latte. In italiano «di» compone e «alle»
  // insaporisce: il latte alle mandorle è latte vaccino aromatizzato, mentre il latte DI
  // mandorla non lo è. Prima qui si pretendeva ["frutta_a_guscio"], e per ottenerlo era stato
  // tolto il vincolo di posizione — con l'effetto di perdere anche «riso al latte».
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte alle mandorle"]), ["latte", "frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte agli anacardi"]), ["latte", "frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte alla mandorla"]), ["latte", "frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte di soia biologico"]), ["soia"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte vegetale di avena senza zuccheri"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["bevanda a base di mandorle"]), ["frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["yogurt magro di soia"]), ["soia"]);
});

test("mapper: «burro di cacao» e «burro di karité» non sono latte", () => {
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["burro di cacao"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["cocoa butter"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["burro di karité"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["shea butter"]), []);
  // Il cacao smentisce il GRASSO, non il latte: «latte al cacao» resta latte, ed è anche
  // quello che dice il catalogo (nutrition_menu_foods 168000 «Crema di cacao e nocciole»
  // porta `latte` fra le classi).
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte al cacao"]), ["latte"]);
});

test("mapper: ELENCO ≠ modificatore — «latte e mandorle» sono due allergeni", () => {
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte e mandorle"]), ["latte", "frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte, mandorle"]), ["latte", "frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte con mandorle"]), ["latte", "frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte/mandorle"]), ["latte", "frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["milk and almonds"]), ["latte", "frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["burro e noci"]), ["latte", "frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte di cocco e burro"]), ["latte"]);
  // ...mentre il modificatore, dentro la stessa voce, resta un modificatore.
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["latte di mandorle"]), ["frutta_a_guscio"]);
});

// ── 5. Il catalogo è la verità: nessun falso positivo sulle etichette vere ────────────

/**
 * Etichette VERE di `nutrition_menu_foods` (prod ggmpegwnzbrjkeiydwqu, lette l'08/09/2026
 * con `label_it ~* '(latt|burro|crema|panna|yogurt|formagg|milk|butter|cream|noc[ei]|
 * mandorl|cocco|soia|avena|cacao|semi|grano|malto)'`), con accanto le classi CURATE in
 * colonna. Le classi degli alimenti vengono da qui, non dal mapper: questa tabella serve
 * a verificare che il mapper, girato sulle stesse etichette, non accenda classi che il
 * catalogo NON ha — un falso positivo, oltre a togliere la famiglia, arma il fail-closed.
 */
const CATALOG_LABELS: Array<[string, string[]]> = [
  ["Burro", ["latte"]],
  ["Burro chiarificato", ["latte"]],
  ["Burro di arachidi", ["arachidi"]],
  ["Burro di mandorle", ["frutta_a_guscio"]],
  ["Crema di anacardi", ["frutta_a_guscio"]],
  ["Crema di riso", []],
  ["Crema di semi di girasole", []],
  ["Latte", ["latte"]],
  ["Latte di capra", ["latte"]],
  ["Latte di pecora", ["latte"]],
  ["Latte parzialmente scremato", ["latte"]],
  ["Latte scremato", ["latte"]],
  ["Latte di cocco", []],
  ["Latte di soia", ["soia"]],
  ["Latticello", ["latte"]],
  ["Lattuga romana", []],
  ["Lattuga iceberg", []],
  ["Fiocchi di latte", ["latte"]],
  ["Formaggio spalmabile", ["latte"]],
  ["Panna acida", ["latte"]],
  ["Panna fresca", ["latte"]],
  ["Yogurt bianco", ["latte"]],
  ["Yogurt greco intero", ["latte"]],
  ["Yogurt di capra", ["latte"]],
  ["Yogurt di soia", ["soia"]],
  ["Bevanda di mandorla senza zuccheri", ["frutta_a_guscio"]],
  ["Bevanda di riso", []],
  ["Mandorle", ["frutta_a_guscio"]],
  ["Noci", ["frutta_a_guscio"]],
  ["Noci macadamia", ["frutta_a_guscio"]],
  ["Noci del Brasile", ["frutta_a_guscio"]],
  ["Cocco", []],
  ["Olio di cocco", []],
  ["Semi di girasole", []],
  ["Semi di sesamo", ["sesamo"]],
  ["Olio di semi di lino", []],
  ["Grano saraceno", []],
  ["Farina di grano saraceno", []],
  ["Crusca di grano", ["glutine"]],
  ["Grano duro (in chicchi)", ["glutine"]],
  ["Soia", ["soia"]],
  ["Germogli di soia", ["soia"]],
];

test("catalogo reale: il mapper non accende MAI una classe che il catalogo non ha", () => {
  for (const [label, curated] of CATALOG_LABELS) {
    const got = mapFoodPhrasesToAllergenClasses([label]);
    const extra = got.filter((c) => !curated.includes(c));
    assert.deepEqual(extra, [], `«${label}»: classi in più rispetto al catalogo`);
  }
});

test("catalogo reale: sulle 42 etichette il mapper coincide con le classi curate", () => {
  const diverging = CATALOG_LABELS.filter(([label, curated]) => {
    const got = [...mapFoodPhrasesToAllergenClasses([label])].sort().join("+");
    return got !== [...curated].sort().join("+");
  }).map(([label]) => label);
  assert.deepEqual(diverging, []);
});

/**
 * Dove il catalogo sa PIÙ dell'etichetta il mapper resta indietro, ed è giusto così:
 * la ricetta industriale (latte e lecitina di soia nella crema al cacao) e le politiche
 * di catalogo (avena → glutine per contaminazione) stanno in `allergen_classes`, che è
 * la fonte usata dal filtro; il mapper legge solo le frasi dell'atleta. Congelato qui
 * perché è una divergenza VOLUTA, non un buco da chiudere allargando il mapper.
 */
test("catalogo reale: le divergenze note sono solo «catalogo più ricco», mai il contrario", () => {
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["Crema di cacao e nocciole"]), ["frutta_a_guscio"]);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["Bevanda di avena"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["Fiordilatte"]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["Granola"]), []);
});

// ── 6. La direzione pericolosa: il latte vero non si neutralizza mai ─────────────────

test("mapper: nessun falso NEGATIVO — il latte animale resta latte", () => {
  for (const phrase of [
    "latte semi-scremato",
    "latte semiscremato",
    "latte parzialmente scremato",
    "latte intero",
    "latte in polvere",
    "burro salato",
    "burro di malga",
    "formaggio di capra",
    "proteine del siero di latte",
    "panna da cucina",
    "mozzarella di bufala",
    "cioccolato al latte",
    "crema di latte",
    "milk",
    "butter",
  ]) {
    assert.deepEqual(mapFoodPhrasesToAllergenClasses([phrase]), ["latte"], `«${phrase}»`);
  }
});
