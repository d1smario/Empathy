import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyNutritionRequirementsV2, MealPlanV2DietSlotBudget } from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import { composeMealPlanV2, type FdcPoolMap } from "@/lib/nutrition/v2/compose-meal-plan-v2";
import { resolveSessionStartMinutes } from "@/lib/nutrition/v2/day-engine-integration";
import {
  loadMenuFoodPools,
  mapMenuFoodRows,
  type MenuFoodPoolMap,
  resetMenuFoodPoolsCacheForTests,
} from "@/lib/nutrition/v2/menu-food-catalog-db";
import type { MenuFoodFiberFermentedInfo } from "@/lib/nutrition/v2/menu-food-fiber-fermented";
import {
  buildPreEffortFilterContext,
  isPreEffortExcludedFood,
  preEffortIndexEvidence,
  preEffortSlotsFromTimes,
} from "@/lib/nutrition/v2/pre-effort-food-filter";

/**
 * REGOLA 2 di Mario — i DUE BUCHI della copertura, cioè del percorso che decide QUANDO la
 * regola si applica. Non riguardano il verdetto sul singolo alimento (quello è coperto da
 * compose-meal-plan-v2-pre-effort.test.ts), ma i casi in cui la regola non veniva
 * nemmeno interrogata.
 *
 *  BUCO 1 — senza catalogo la regola si spegneva DA SOLA. L'indice fermentato/fibra nasce
 *    solo dai pool del catalogo; quando il motore ricade sull'allowlist cablata l'indice è
 *    vuoto, nessun alimento risulta fermentato o integrale, e la regola non escludeva più
 *    niente. Misurato prima della chiusura, settimana con seduta alle 07:00 e catalogo
 *    assente: pane integrale, yogurt greco, pane di segale, kefir, granola a colazione.
 *    Lo stesso buco ha TRE varianti, e la terza è la più insidiosa: il catalogo risponde,
 *    ma la select è ricaduta su uno stadio DEGRADATO (ambiente senza le migrazioni
 *    20260908150000/160000) e le due colonne della Regola 2 non arrivano. Prima della
 *    chiusura la riga rispondeva «non fermentata, non integrale» — un verdetto su una
 *    colonna che nessuno aveva letto — e lo yogurt tornava nel piatto pre-sforzo. Qui il
 *    caso si prova facendo girare `loadMenuFoodPools` sulla SCALA DI RETRY VERA, non su una
 *    fixture costruita a mano: un test che non può cadere è peggio di nessun test.
 *
 *  BUCO 2 — solo la PRIMA seduta ancorava la finestra. Chi si allena due volte (routine
 *    `has_training2` + `training2_start_time`: 3 atleti in prod) restava scoperto sul pasto
 *    che precede la seconda.
 */

// ── Fixture: catalogo VERO ridotto (fdcId e fibre da prod, letti l'8 set 2026) ────────

type Fixture = {
  canonicalKey: string;
  labelIt: string;
  fdcId: number;
  poolKeys: string[];
  kcal: number;
  cho: number;
  pro: number;
  fat: number;
  isFermented: boolean;
  isWholegrain?: boolean;
  fiberPer100g: number | null;
};

const CATALOG: Fixture[] = [
  { canonicalKey: "oat_dry", labelIt: "Fiocchi d'avena", fdcId: 169705, poolKeys: ["breakfast_cho"],
    kcal: 389, cho: 68.2, pro: 16.9, fat: 6.9, isFermented: false, isWholegrain: true, fiberPer100g: 9.4 },
  { canonicalKey: "corn_flakes", labelIt: "Corn flakes", fdcId: 173029, poolKeys: ["breakfast_cho"],
    kcal: 357, cho: 88.0, pro: 7.5, fat: 0.4, isFermented: false, fiberPer100g: 2.7 },
  { canonicalKey: "rusk_toast", labelIt: "Fette biscottate", fdcId: 174928, poolKeys: ["breakfast_cho", "snack_cho"],
    kcal: 407, cho: 72.3, pro: 13.5, fat: 7.0, isFermented: false, fiberPer100g: null },
  { canonicalKey: "yogurt_greek", labelIt: "Yogurt greco", fdcId: 170903, poolKeys: ["breakfast_pro", "snack_pro"],
    kcal: 97, cho: 3.9, pro: 9.0, fat: 5.0, isFermented: true, fiberPer100g: 0 },
  { canonicalKey: "milk_semi_skimmed", labelIt: "Latte parzialmente scremato", fdcId: 746773,
    poolKeys: ["breakfast_pro", "snack_pro"], kcal: 50, cho: 4.8, pro: 3.3, fat: 2.0, isFermented: false, fiberPer100g: null },
  { canonicalKey: "olive_oil", labelIt: "Olio extravergine d'oliva", fdcId: 171413,
    poolKeys: ["breakfast_fat"], kcal: 884, cho: 0, pro: 0, fat: 100, isFermented: false, fiberPer100g: 0 },
];

/**
 * Righe come le consegna PostgREST. `facts: false` = la select è ricaduta sullo stadio
 * DEGRADATO (ambiente senza le migrazioni 20260908150000/160000): le due colonne della
 * Regola 2 non ci sono, e le CHIAVI non compaiono proprio sulla riga. È la forma vera, non
 * una fixture di comodo: `loadMenuFoodPools` la produce ogni volta che PostgREST risponde
 * 42703 (lo prova il test «la scala di retry produce davvero righe mute» più sotto).
 */
function menuRows(facts: boolean, assenti: readonly string[] = []): Record<string, unknown>[] {
  return CATALOG.map((f) => {
    const row: Record<string, unknown> = {
      canonical_key: f.canonicalKey,
      fdc_id: f.fdcId,
      label_it: f.labelIt,
      serving_basis: "dry_grams",
      pool_keys: f.poolKeys,
      rotation_key: null,
      carb_family: null,
      is_meat: false,
      is_fish: false,
      is_animal_product: ["yogurt_greek", "milk_semi_skimmed"].includes(f.canonicalKey),
      sort_priority: 100,
      ...(facts ? { is_fermented: f.isFermented, is_wholegrain: f.isWholegrain ?? false } : {}),
    };
    for (const col of assenti) delete row[col];
    return row;
  });
}

function macroRows(): Record<string, unknown>[] {
  return CATALOG.map((f) => ({
    fdc_id: f.fdcId,
    kcal_100g: f.kcal,
    carbs_100g: f.cho,
    protein_100g: f.pro,
    fat_100g: f.fat,
    fiber_100g: f.fiberPer100g,
  }));
}

/** Pool costruiti dal MAPPING VERO del loader, non a mano: stessa forma della produzione. */
function buildPools(facts: boolean): MenuFoodPoolMap {
  const pools = mapMenuFoodRows(menuRows(facts), macroRows());
  assert.ok(pools, "fixture non mappabile");
  return pools;
}

/** Voce d'indice completa: i campi non passati sono «nessuna risposta». */
function info(partial: Partial<MenuFoodFiberFermentedInfo>): MenuFoodFiberFermentedInfo {
  const fiberPer100g = partial.fiberPer100g ?? null;
  return {
    classified: partial.classified ?? true,
    fermented: partial.fermented ?? false,
    wholegrain: partial.wholegrain ?? false,
    fiberPer100g,
    fiberBasis: fiberPer100g == null ? null : (partial.fiberBasis ?? "dry_grams"),
    overFiberThreshold: partial.overFiberThreshold ?? partial.highFiber ?? false,
    highFiber: partial.highFiber ?? false,
  };
}

/** Giornata PESANTE di Mario: ratio (1700+600+2600)/1700 ≈ 2,9 ≥ 2,15. */
const INTENSO = {
  energy: { bmrKcal: 1700, lifestyleKcal: 600, trainingKcal: 2600, mealsKcal: 3800 },
} as DailyNutritionRequirementsV2;
/** Giornata senza seduta: ratio ≈ 1,35 → la regola non scatta. */
const NORMALE = {
  energy: { bmrKcal: 1700, lifestyleKcal: 600, trainingKcal: 0, mealsKcal: 2200 },
} as DailyNutritionRequirementsV2;

const breakfast: MealPlanV2DietSlotBudget = {
  key: "breakfast", label: "Colazione", pct: 25, kcal: 700, carbs: 100, protein: 30, fat: 18,
};
const snackPm: MealPlanV2DietSlotBudget = {
  key: "snack_pm", label: "Spuntino pomeriggio", pct: 10, kcal: 300, carbs: 45, protein: 12, fat: 8,
};

const PLAN_DATES = Array.from({ length: 7 }, (_, i) => `2026-09-${String(7 + i).padStart(2, "0")}`);

function request(planDate: string, slots: { slot: string; labelIt: string; scheduledTimeLocal: string }[]) {
  return {
    athleteId: "04968274-b796-4dd7-a992-69994d516c61",
    planDate,
    dietType: "omnivore",
    allergies: [],
    intolerances: [],
    foodExclusions: null,
    slots,
  } as unknown as IntelligentMealPlanRequest;
}

const COLAZIONE_PRESTO = [
  { slot: "breakfast", labelIt: "Colazione", scheduledTimeLocal: "06:30" },
  { slot: "lunch", labelIt: "Pranzo", scheduledTimeLocal: "13:00" },
];

/** Etichette servite in uno slot lungo la settimana, come le vedrebbe l'atleta. */
function servedLabels(opts: {
  requirements: DailyNutritionRequirementsV2;
  budget: MealPlanV2DietSlotBudget;
  slots: { slot: string; labelIt: string; scheduledTimeLocal: string }[];
  trainingStartMinutes: number | readonly number[] | null;
  menuFoodPools?: MenuFoodPoolMap | null;
}): string[] {
  const out: string[] = [];
  for (const planDate of PLAN_DATES) {
    const composed = composeMealPlanV2(opts.requirements, [opts.budget], new Map() as FdcPoolMap, {
      request: request(planDate, opts.slots),
      menuFoodPools: opts.menuFoodPools ?? null,
      trainingStartMinutes: opts.trainingStartMinutes,
    });
    for (const item of composed[0]!.items) out.push(item.description);
  }
  return out;
}

// ── BUCO 1: fail-closed ──────────────────────────────────────────────────────────────

/**
 * Gli alimenti che l'allowlist cablata metteva nel piatto prima della chiusura. Le
 * etichette sono quelle vere del registry (`STAPLE_ALLOWLIST_BY_POOL`).
 */
const VIETATI_ALLOWLIST = [
  "Yogurt greco", "Yogurt bianco", "Kefir", "Pane integrale", "Pane di segale",
  "Fiocchi d'avena", "Granola", "Crackers integrali",
];

test("BUCO 1 — catalogo assente: la regola non si spegne, niente fermentati né integrali", () => {
  const served = servedLabels({
    requirements: INTENSO,
    budget: breakfast,
    slots: COLAZIONE_PRESTO,
    trainingStartMinutes: 7 * 60,
    menuFoodPools: null, // ← il motore ricade sull'allowlist cablata
  });
  for (const vietato of VIETATI_ALLOWLIST) {
    assert.ok(
      !served.includes(vietato),
      `«${vietato}» servito prima di una seduta intensa col catalogo giù: ${[...new Set(served)].join(", ")}`,
    );
  }
});

/**
 * La scala di retry di `loadMenuFoodPools` è a QUATTRO stadi: base+allergeni+fermentati+
 * integrali → base+allergeni+fermentati → base+allergeni → base. Questo client finto si
 * comporta come PostgREST su un ambiente senza le due colonne della Regola 2: 42703 finché
 * la select le chiede, e righe SENZA quelle chiavi quando smette di chiederle.
 */
function fakeAdminSenzaColonneRegola2(assenti: string[], calls?: string[]): SupabaseClient {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      let selected = "";
      builder.select = (cols: string) => {
        selected = cols;
        calls?.push(`${table}:${cols}`);
        return builder;
      };
      builder.eq = () => builder;
      builder.in = () => builder;
      builder.then = (resolve: (v: { data: unknown[] | null; error: unknown }) => void) => {
        if (table === "nutrition_menu_foods") {
          const chieste = assenti.filter((c) => selected.includes(c));
          if (chieste.length > 0) {
            return resolve({
              data: null,
              error: { code: "42703", message: `column nutrition_menu_foods.${chieste[0]} does not exist` },
            });
          }
          // Le colonne che l'ambiente NON ha spariscono dalla riga: è ciò che fa PostgREST.
          return resolve({ data: menuRows(true, assenti), error: null });
        }
        if (table === "nutrition_menu_food_meal_roles") return resolve({ data: [], error: null });
        return resolve({ data: macroRows(), error: null });
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

test("BUCO 1 — la scala di retry produce davvero righe MUTE (non «non fermentate»)", async () => {
  resetMenuFoodPoolsCacheForTests();
  const calls: string[] = [];
  const pools = await loadMenuFoodPools(fakeAdminSenzaColonneRegola2(["is_fermented", "is_wholegrain"], calls));
  resetMenuFoodPoolsCacheForTests();
  assert.ok(pools, "il catalogo deve arrivare comunque: la regola non può rompere la generazione");
  // Tre tentativi sul menù: con entrambe le colonne, con la sola `is_fermented`, senza.
  const menuCalls = calls.filter((c) => c.startsWith("nutrition_menu_foods:"));
  assert.equal(menuCalls.length, 3, `scala di retry inattesa: ${menuCalls.join(" | ")}`);
  const yogurt = pools!.get("breakfast_pro")!.find((e) => e.canonicalKey === "yogurt_greek")!;
  // IL PUNTO: la riga NON dice «non fermentata». Non dice niente.
  assert.equal(yogurt.isFermented, undefined, "colonna assente letta come «non fermentato»: fail-open");
  assert.equal(yogurt.isWholegrain, undefined, "colonna assente letta come «non integrale»: fail-open");
});

test("BUCO 1 — catalogo che non sa rispondere (colonne assenti): stesso fail-closed", async () => {
  resetMenuFoodPoolsCacheForTests();
  // I pool arrivano dalla SELECT DEGRADATA VERA, non da una fixture costruita a mano.
  const pools = await loadMenuFoodPools(fakeAdminSenzaColonneRegola2(["is_fermented", "is_wholegrain"]));
  resetMenuFoodPoolsCacheForTests();
  const muto = servedLabels({
    requirements: INTENSO,
    budget: breakfast,
    slots: COLAZIONE_PRESTO,
    trainingStartMinutes: 7 * 60,
    menuFoodPools: pools,
  });
  assert.ok(
    !muto.includes("Yogurt greco") && !muto.includes("Fiocchi d'avena"),
    `indice muto: passa comunque roba non classificata: ${[...new Set(muto)].join(", ")}`,
  );

  // …e la stessa cosa vale con la sola `is_wholegrain` mancante: mezza risposta non è una
  // risposta, e i cereali integrali NON si riconoscono dalla fibra (riso integrale: 1,6).
  resetMenuFoodPoolsCacheForTests();
  const soloFermentati = await loadMenuFoodPools(fakeAdminSenzaColonneRegola2(["is_wholegrain"]));
  resetMenuFoodPoolsCacheForTests();
  assert.ok(soloFermentati);
  const mezzo = servedLabels({
    requirements: INTENSO,
    budget: breakfast,
    slots: COLAZIONE_PRESTO,
    trainingStartMinutes: 7 * 60,
    menuFoodPools: soloFermentati,
  });
  assert.ok(
    !mezzo.includes("Yogurt greco") && !mezzo.includes("Fiocchi d'avena"),
    `mezza classificazione trattata come completa: ${[...new Set(mezzo)].join(", ")}`,
  );

  // Il fail-closed è ARMATO dalle prove, non dal numero di righe: un indice pieno di righe
  // che non rispondono vale quanto un indice vuoto.
  const evidence = preEffortIndexEvidence(
    new Map([[1, info({})]]),
  );
  assert.equal(evidence.entries, 1);
  assert.equal(evidence.usable, false);
});

test("BUCO 1 — il contesto dichiara il ramo fail-closed (per la traccia su empathy_events)", () => {
  const conCatalogo = buildPreEffortFilterContext({
    requirements: INTENSO,
    request: request(PLAN_DATES[0]!, COLAZIONE_PRESTO),
    trainingStartMinutes: 7 * 60,
    foodIndex: new Map([
      [170903, info({ fermented: true, fiberPer100g: 0 })],
      [169705, info({ fiberPer100g: 9.4, highFiber: true })],
    ]),
  });
  assert.equal(conCatalogo?.sourceUnavailable, false);
  assert.deepEqual(conCatalogo?.evidence, {
    entries: 2,
    fermented: 1,
    wholegrain: 0,
    fiberMeasured: 2,
    usable: true,
  });

  const senzaCatalogo = buildPreEffortFilterContext({
    requirements: INTENSO,
    request: request(PLAN_DATES[0]!, COLAZIONE_PRESTO),
    trainingStartMinutes: 7 * 60,
    foodIndex: new Map(),
  });
  assert.equal(senzaCatalogo?.sourceUnavailable, true);
  assert.match(senzaCatalogo!.why, /fail_closed:catalogo/);
});

test("BUCO 1 — il fail-closed NON tocca gli altri giorni: piano identico a oggi", () => {
  // Giorno non intenso, catalogo giù: nessuna finestra, nessuna esclusione.
  const normale = servedLabels({
    requirements: NORMALE,
    budget: breakfast,
    slots: COLAZIONE_PRESTO,
    trainingStartMinutes: 7 * 60,
    menuFoodPools: null,
  });
  assert.ok(normale.includes("Yogurt greco") || normale.includes("Yogurt bianco"));

  // Giorno intenso ma seduta alle 18:00: la colazione è a 11 h dallo sforzo.
  const seraIntenso = servedLabels({
    requirements: INTENSO,
    budget: breakfast,
    slots: COLAZIONE_PRESTO,
    trainingStartMinutes: 18 * 60,
    menuFoodPools: null,
  });
  assert.deepEqual(seraIntenso, normale, "fuori finestra il piano deve restare quello di oggi");
});

test("BUCO 1 — «non classificato» non è «fibra non misurata»: latte e fette biscottate restano", () => {
  // Mario lascia esplicitamente disponibili latte e cereali classici. Una riga del catalogo
  // senza fibra misurata UNA risposta ce l'ha: non deve cadere col fail-closed.
  const pools = buildPools(true);
  const ctx = buildPreEffortFilterContext({
    requirements: INTENSO,
    request: request(PLAN_DATES[0]!, COLAZIONE_PRESTO),
    trainingStartMinutes: 7 * 60,
    foodIndex: new Map(
      CATALOG.map((f) => [
        f.fdcId,
        info({
          fermented: f.isFermented,
          fiberPer100g: f.fiberPer100g,
          highFiber: (f.fiberPer100g ?? 0) >= 4.5,
        }),
      ]),
    ),
  });
  assert.ok(ctx);
  const restriction = { foodIndex: ctx!.foodIndex, why: ctx!.why };
  const senzaFibra = (pools.get("breakfast_pro") ?? []).filter((e) => e.canonicalKey === "milk_semi_skimmed");
  assert.equal(senzaFibra.length, 1);
  assert.equal(isPreEffortExcludedFood(senzaFibra[0], restriction, senzaFibra[0]!.fdcId), false);
  const fette = (pools.get("breakfast_cho") ?? []).filter((e) => e.canonicalKey === "rusk_toast");
  assert.equal(isPreEffortExcludedFood(fette[0], restriction, fette[0]!.fdcId), false);
  // E il fermentato cade comunque.
  const yogurt = (pools.get("breakfast_pro") ?? []).filter((e) => e.canonicalKey === "yogurt_greek");
  assert.equal(isPreEffortExcludedFood(yogurt[0], restriction, yogurt[0]!.fdcId), true);
});

// ── BUCO 2: tutte le sedute del giorno ───────────────────────────────────────────────

/** Routine VERA dell'atleta c2bd27ec (prod): martedì 10:00 + 18:00. */
const ROUTINE_DOPPIA = {
  week_plan: {
    Tue: {
      has_training: true, training1_start_time: "10:00", training1_duration_minutes: 150,
      has_training2: true, training2_start_time: "18:00", training2_duration_minutes: 45,
      breakfast_time: "08:15", lunch_time: "12:30", afternoon_snack_time: "16:30", dinner_time: "19:30",
    },
  },
};
const MARTEDI = "2026-09-08";

test("BUCO 2 — resolveSessionStartMinutes vede la seconda seduta, non solo la prima", () => {
  assert.deepEqual(
    resolveSessionStartMinutes({ routineConfig: ROUTINE_DOPPIA, planDate: MARTEDI, plannedDurationsMin: [150, 45] }),
    [600, 1080],
  );
  // Il flag del giorno è il cancello: senza `has_training2` l'orario di default "18:00"
  // che il Profilo scrive a tutti non deve inventare una seduta serale.
  assert.deepEqual(
    resolveSessionStartMinutes({
      routineConfig: {
        week_plan: { Tue: { has_training: true, training1_start_time: "10:00", training2_start_time: "18:00" } },
      },
      planDate: MARTEDI,
      plannedDurationsMin: [150],
    }),
    [600],
  );
  // Giorno senza sedute: lista vuota, no-op esplicito.
  assert.deepEqual(
    resolveSessionStartMinutes({ routineConfig: ROUTINE_DOPPIA, planDate: "2026-09-09", plannedDurationsMin: [] }),
    [],
  );
});

test("BUCO 2 — la finestra copre ogni seduta: lo spuntino delle 16:30 è pre-sforzo", () => {
  const times = { breakfast: "08:15", lunch: "12:30", snack_pm: "16:30", dinner: "19:30" } as const;
  const starts = resolveSessionStartMinutes({
    routineConfig: ROUTINE_DOPPIA,
    planDate: MARTEDI,
    plannedDurationsMin: [150, 45],
  });
  assert.deepEqual(
    [...preEffortSlotsFromTimes({ effortStartMinutes: starts, mealTimesBySlot: { ...times } })].sort(),
    ["breakfast", "snack_pm"],
  );
});

test("BUCO 2 — lo spuntino che precede la seconda seduta perde i fermentati", () => {
  const slots = [
    { slot: "breakfast", labelIt: "Colazione", scheduledTimeLocal: "08:15" },
    { slot: "lunch", labelIt: "Pranzo", scheduledTimeLocal: "12:30" },
    { slot: "snack_pm", labelIt: "Spuntino pomeriggio", scheduledTimeLocal: "16:30" },
    { slot: "dinner", labelIt: "Cena", scheduledTimeLocal: "19:30" },
  ];
  const pools = buildPools(true);
  const soloPrima = servedLabels({
    requirements: INTENSO, budget: snackPm, slots, trainingStartMinutes: 600, menuFoodPools: pools,
  });
  const tutteLeSedute = servedLabels({
    requirements: INTENSO, budget: snackPm, slots, trainingStartMinutes: [600, 1080], menuFoodPools: pools,
  });
  assert.ok(
    soloPrima.includes("Yogurt greco"),
    `il buco non è riproducibile: con la sola prima seduta lo spuntino serviva ${[...new Set(soloPrima)].join(", ")}`,
  );
  assert.ok(
    !tutteLeSedute.includes("Yogurt greco"),
    `yogurt a 90 min dalla seconda seduta: ${[...new Set(tutteLeSedute)].join(", ")}`,
  );
});

test("NON REGRESSIONE — senza giorni intensi né gara la composizione è identica bit a bit", () => {
  // A/B vero: stesso giorno, stesso catalogo, una volta col contesto DERIVATO e una volta
  // con la regola spenta a mano (`preEffort: null`). Se il giorno non è intenso il contesto
  // nasce null, quindi ogni filtro esce alla prima riga e i due piani devono coincidere —
  // non solo nelle etichette: grammi, macro e totali.
  const pools = buildPools(true);
  for (const planDate of PLAN_DATES) {
    const req = request(planDate, COLAZIONE_PRESTO);
    const conRegola = composeMealPlanV2(NORMALE, [breakfast], new Map() as FdcPoolMap, {
      request: req, menuFoodPools: pools, trainingStartMinutes: [7 * 60, 18 * 60],
    });
    const senzaRegola = composeMealPlanV2(NORMALE, [breakfast], new Map() as FdcPoolMap, {
      request: req, menuFoodPools: pools, trainingStartMinutes: [7 * 60, 18 * 60], preEffort: null,
    });
    assert.deepEqual(conRegola, senzaRegola, `giorno non intenso ${planDate}: la regola ha cambiato il piano`);
  }
});
