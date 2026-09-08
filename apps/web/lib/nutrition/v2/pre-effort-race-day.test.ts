/**
 * GIORNO GARA — la decisione di Mario dell'8 settembre 2026 e la gerarchia fra le due regole.
 *
 * A) «Nel giorno della gara la colazione falla rimanere pulita», a QUALUNQUE ora parta la
 *    gara. In gara la Regola 2 (niente fermentati né fibre prima dello sforzo) vale su TUTTI
 *    i pasti che precedono la partenza, anche su quelli fuori dalla finestra di 3 h.
 *    Nei giorni di ALLENAMENTO la finestra a tempo resta: chi si allena alle 18 tiene lo
 *    yogurt a colazione.
 *
 * B) REGOLA 1 BATTE REGOLA 2 sul pasto pre-gara. Il protocollo pre-gara di Mario prescrive
 *    il grana padano, che è un formaggio a lunga stagionatura, cioè un fermentato: le due
 *    regole si contraddicono su quel piatto e la precedenza è del protocollo.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { DailyNutritionRequirementsV2, MealPlanV2DietSlotBudget } from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  buildRacePreLunchDayContext,
  type RacePreLunchDayContext,
} from "@/lib/nutrition/race-day-pre-race-lunch";
import { composeMealPlanV2, type FdcPoolMap } from "@/lib/nutrition/v2/compose-meal-plan-v2";
import {
  buildMenuFoodFiberFermentedIndex,
  type MenuFoodEntry,
  type MenuFoodPoolMap,
} from "@/lib/nutrition/v2/menu-food-catalog-db";
import {
  buildPreEffortFilterContext,
  preEffortSlotsFromTimes,
} from "@/lib/nutrition/v2/pre-effort-food-filter";

// ── Catalogo VERO ridotto (fdcId e fibre da prod, letti l'8 set 2026) ─────────────────

type Fixture = {
  canonicalKey: string;
  labelIt: string;
  fdcId: number;
  poolKeys: string[];
  kcal: number;
  cho: number;
  pro: number;
  fat: number;
  isFermented?: boolean;
  isWholegrain?: boolean;
  fiberPer100g?: number | null;
};

const CATALOG: Fixture[] = [
  { canonicalKey: "oat_dry", labelIt: "Fiocchi d'avena", fdcId: 169705, poolKeys: ["breakfast_cho"],
    kcal: 389, cho: 68.2, pro: 16.9, fat: 6.9, isFermented: false, fiberPer100g: 9.4 },
  { canonicalKey: "bread_whole_wheat", labelIt: "Pane integrale", fdcId: 172686, poolKeys: ["breakfast_cho"],
    kcal: 254, cho: 51.4, pro: 12.3, fat: 3.5, isFermented: false, isWholegrain: true, fiberPer100g: 6.0 },
  { canonicalKey: "corn_flakes", labelIt: "Corn flakes", fdcId: 173029, poolKeys: ["breakfast_cho"],
    kcal: 357, cho: 88.0, pro: 7.5, fat: 0.4, isFermented: false, fiberPer100g: 2.7 },
  { canonicalKey: "puffed_rice", labelIt: "Riso soffiato", fdcId: 173032, poolKeys: ["breakfast_cho"],
    kcal: 392, cho: 89.8, pro: 6.3, fat: 1.4, isFermented: false, fiberPer100g: 1.7 },
  { canonicalKey: "rusk_toast", labelIt: "Fette biscottate", fdcId: 174928, poolKeys: ["breakfast_cho"],
    kcal: 407, cho: 72.3, pro: 13.5, fat: 7.0, isFermented: false, fiberPer100g: null },
  { canonicalKey: "yogurt_greek", labelIt: "Yogurt greco", fdcId: 170903, poolKeys: ["breakfast_pro"],
    kcal: 97, cho: 3.9, pro: 9.0, fat: 5.0, isFermented: true, fiberPer100g: 0 },
  { canonicalKey: "kefir", labelIt: "Kefir", fdcId: 2259793, poolKeys: ["breakfast_pro"],
    kcal: 63, cho: 4.5, pro: 3.8, fat: 3.3, isFermented: true, fiberPer100g: 0 },
  { canonicalKey: "milk_semi_skimmed", labelIt: "Latte parzialmente scremato", fdcId: 746773,
    poolKeys: ["breakfast_pro"], kcal: 50, cho: 4.8, pro: 3.3, fat: 2.0, isFermented: false, fiberPer100g: null },
  { canonicalKey: "egg_whole", labelIt: "Uova", fdcId: 172183, poolKeys: ["breakfast_pro"],
    kcal: 143, cho: 0.7, pro: 12.6, fat: 9.5, isFermented: false, fiberPer100g: 0 },
  { canonicalKey: "olive_oil", labelIt: "Olio extravergine d'oliva", fdcId: 171413,
    poolKeys: ["breakfast_fat"], kcal: 884, cho: 0, pro: 0, fat: 100, isFermented: false, fiberPer100g: 0 },
];

const FERMENTATI = ["Yogurt greco", "Kefir"];
const INTEGRALI = ["Fiocchi d'avena", "Pane integrale"];

function buildPools(withFacts = true): MenuFoodPoolMap {
  const pools: MenuFoodPoolMap = new Map();
  for (const f of CATALOG) {
    const entry = {
      canonicalKey: f.canonicalKey,
      labelIt: f.labelIt,
      servingBasis: "dry_grams",
      fdcId: f.fdcId,
      kcalPer100g: f.kcal,
      carbsPer100g: f.cho,
      proteinPer100g: f.pro,
      fatPer100g: f.fat,
      isMeat: false,
      isFish: false,
      isAnimalProduct: ["yogurt_greek", "kefir", "milk_semi_skimmed", "egg_whole"].includes(f.canonicalKey),
      ...(withFacts
        ? {
            isFermented: f.isFermented ?? false,
            isWholegrain: f.isWholegrain ?? false,
            fiberPer100g: f.fiberPer100g ?? null,
          }
        : {}),
    } as unknown as MenuFoodEntry;
    for (const key of f.poolKeys) pools.set(key, [...(pools.get(key) ?? []), entry]);
  }
  return pools;
}

/**
 * Giornata SENZA seduta (ratio ≈ 1,35): così l'unica cosa che può accendere la Regola 2 è
 * la GARA. Se la colazione esce pulita, è per la gara e non per il carico.
 */
const REQUIREMENTS_LEGGERE = {
  energy: { bmrKcal: 1700, lifestyleKcal: 600, trainingKcal: 0, mealsKcal: 2200 },
} as DailyNutritionRequirementsV2;

const BREAKFAST: MealPlanV2DietSlotBudget = {
  key: "breakfast", label: "Colazione", pct: 25, kcal: 700, carbs: 100, protein: 30, fat: 18,
};
const LUNCH: MealPlanV2DietSlotBudget = {
  key: "lunch", label: "Pranzo", pct: 40, kcal: 1100, carbs: 160, protein: 50, fat: 28,
};
const DINNER: MealPlanV2DietSlotBudget = {
  key: "dinner", label: "Cena", pct: 35, kcal: 900, carbs: 120, protein: 45, fat: 25,
};

/** 2026-09-20 è una domenica: la routine mette la gara lì. */
const PLAN_DATES = ["2026-09-20", "2026-09-27", "2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25", "2026-11-01"];

function raceCtx(startTime: string): RacePreLunchDayContext {
  const ctx = buildRacePreLunchDayContext({
    weightKg: 73,
    planDate: "2026-09-20",
    routineConfig: {
      week_plan: {
        Sun: { day_mode: "race", training1_start_time: startTime, training1_duration_minutes: 180 },
      },
    },
    plannedSessions: [{ duration_minutes: 180, type: "race", notes: "Gara" }],
    activeMealSlots: ["breakfast", "lunch", "dinner"],
  });
  assert.ok(ctx, `contesto pre-gara atteso per partenza ${startTime}`);
  return ctx!;
}

function request(input: {
  planDate: string;
  times: Record<string, string>;
  racePreLunch?: RacePreLunchDayContext | null;
}): IntelligentMealPlanRequest {
  return {
    athleteId: "04968274-b796-4dd7-a992-69994d516c61",
    planDate: input.planDate,
    dietType: "omnivore",
    allergies: [],
    intolerances: [],
    foodExclusions: null,
    contextLines: [],
    slots: Object.entries(input.times).map(([slot, scheduledTimeLocal]) => ({
      slot,
      labelIt: slot,
      scheduledTimeLocal,
    })),
    ...(input.racePreLunch ? { racePreLunch: input.racePreLunch } : {}),
  } as unknown as IntelligentMealPlanRequest;
}

/** Etichette servite a colazione sulla settimana (la rotazione gira col seme atleta+data). */
function breakfastLabels(input: {
  times: Record<string, string>;
  racePreLunch?: RacePreLunchDayContext | null;
  trainingStartMinutes?: number | null;
  withFacts?: boolean;
}): string[] {
  const menuFoodPools = buildPools(input.withFacts ?? true);
  const out: string[] = [];
  for (const planDate of PLAN_DATES) {
    const composed = composeMealPlanV2(REQUIREMENTS_LEGGERE, [BREAKFAST, LUNCH, DINNER], new Map() as FdcPoolMap, {
      request: request({ planDate, times: input.times, racePreLunch: input.racePreLunch ?? null }),
      menuFoodPools,
      trainingStartMinutes: input.trainingStartMinutes ?? null,
    });
    for (const item of composed.find((s) => s.slot === "breakfast")!.items) out.push(item.description);
  }
  return out;
}

// ── A) La decisione di Mario: in gara conta «prima della partenza», non «entro 3 h» ────

test("gara alle 13:30: la colazione delle 08:00 è pulita anche se è a 5 h e mezza dalla partenza", () => {
  const ctx = raceCtx("13:30");
  assert.equal(ctx.mealSlot, "lunch", "con la gara alle 13:30 il pasto a protocollo è il pranzo");
  const served = breakfastLabels({
    // Il pranzo prende l'orario del protocollo (3 h prima), come fa l'enrich di giorno gara.
    times: { breakfast: "08:00", lunch: ctx.lunchTimeLocal, dinner: "20:00" },
    racePreLunch: ctx,
  });
  assert.ok(served.length > 0, "la colazione deve comunque essere composta");
  for (const forbidden of [...FERMENTATI, ...INTEGRALI]) {
    assert.ok(
      !served.includes(forbidden),
      `«${forbidden}» servito a colazione nel giorno della gara: ${[...new Set(served)].join(", ")}`,
    );
  }
});

test("finestra: in gara TUTTI i pasti prima della partenza, in allenamento solo quelli entro 3 h", () => {
  const times = { breakfast: "08:00", lunch: "10:30", snack_pm: "16:30", dinner: "20:00" } as const;
  const gara = preEffortSlotsFromTimes({
    effortStartMinutes: null,
    raceStartMinutes: 13 * 60 + 30,
    mealTimesBySlot: { ...times },
  });
  assert.deepEqual([...gara].sort(), ["breakfast", "lunch"], "in gara la colazione delle 8 entra comunque");

  const allenamento = preEffortSlotsFromTimes({
    effortStartMinutes: 13 * 60 + 30,
    mealTimesBySlot: { ...times },
  });
  assert.deepEqual([...allenamento], ["lunch"], "in allenamento la colazione delle 8 resta fuori dalla finestra");
});

test("giorno di allenamento alle 18:00: la colazione resta invariata (yogurt compreso)", () => {
  const times = { breakfast: "08:00", lunch: "13:00", dinner: "20:00" };
  const conRegola = breakfastLabels({ times, trainingStartMinutes: 18 * 60 });
  const senzaFatti = breakfastLabels({ times, trainingStartMinutes: 18 * 60, withFacts: false });
  assert.deepEqual(conRegola, senzaFatti, "colazione a 10 h dallo sforzo: nessun cambiamento");

  /**
   * IL CONTRASTO, senza il quale questo test non può cadere.
   *
   * L'asserzione qui sopra da sola è vacua: dice «la colazione non cambia», e se
   * qualcuno cancellasse del tutto la finestra pre-sforzo la colazione non
   * cambierebbe comunque — il test resterebbe verde proprio mentre la regola muore.
   * Provato con una mutazione (`preEffortSlotsFromTimes` che ritorna sempre l'insieme
   * vuoto): sopravviveva. Serve quindi la prova che la finestra ESISTE e che è
   * l'orario a spostarla: stesso atleta, stessa colazione, seduta anticipata alle
   * 09:00 → la colazione ENTRA fra gli slot ristretti.
   */
  const alle18 = preEffortSlotsFromTimes({ effortStartMinutes: [18 * 60], raceStartMinutes: null, mealTimesBySlot: times });
  const alle9 = preEffortSlotsFromTimes({ effortStartMinutes: [9 * 60], raceStartMinutes: null, mealTimesBySlot: times });
  assert.equal(alle18.has("breakfast"), false, "seduta alle 18: la colazione è fuori finestra");
  assert.equal(alle9.has("breakfast"), true, "seduta alle 9: la colazione è dentro la finestra");
});

// ── B) R1 > R2 sul pasto pre-gara ─────────────────────────────────────────────────────

function filterFor(ctx: RacePreLunchDayContext, times: Record<string, string>) {
  return buildPreEffortFilterContext({
    requirements: REQUIREMENTS_LEGGERE,
    request: request({ planDate: "2026-09-20", times, racePreLunch: ctx }),
    trainingStartMinutes: null,
    foodIndex: buildMenuFoodFiberFermentedIndex(buildPools()),
  });
}

test("R1 vince su R2: il pasto a protocollo esce dagli slot ristretti, gli ALTRI restano dentro", () => {
  // Gara alle 13:30 → protocollo sul pranzo (10:30). La colazione delle 08:00 precede la
  // partenza e resta sotto R2; il pranzo a protocollo no.
  const ctx = raceCtx("13:30");
  assert.equal(ctx.mealSlot, "lunch");
  const filter = filterFor(ctx, { breakfast: "08:00", lunch: ctx.lunchTimeLocal, dinner: "20:00" });
  assert.ok(filter, "giorno gara: la Regola 2 deve valere");
  assert.ok(
    filter!.slots.has("breakfast"),
    `la colazione del giorno gara deve restare sotto R2: ${[...filter!.slots].join(", ")}`,
  );
  assert.ok(
    !filter!.slots.has("lunch"),
    `il pasto a protocollo non deve passare dal filtro R2: ${[...filter!.slots].join(", ")}`,
  );
  assert.equal(filter!.raceProtocolSlotExempt, "lunch");
  assert.match(filter!.why, /r1_protocollo_esente:lunch/);
});

test("R1 vince su R2: gara al mattino, l'unico pasto prima della partenza è il protocollo → niente da filtrare", () => {
  // Gara alle 10:00 → protocollo sulla colazione (07:00), e prima della partenza non c'è
  // altro. Tolto il protocollo l'insieme è vuoto: contesto `null`, cioè no-op esplicito —
  // il compositore si comporta esattamente come senza la regola.
  const ctx = raceCtx("10:00");
  assert.equal(ctx.mealSlot, "breakfast");
  const filter = filterFor(ctx, { breakfast: ctx.lunchTimeLocal, lunch: "13:00", dinner: "20:00" });
  assert.equal(filter, null, `atteso no-op, ottenuto slot ristretti: ${filter ? [...filter.slots].join(", ") : ""}`);
});

test("R1 vince su R2: gara al mattino, il pre-gara resta a 3 voci col grana padano", () => {
  const ctx = raceCtx("10:00");
  assert.equal(ctx.mealSlot, "breakfast", "con la gara alle 10 il pasto a protocollo è la colazione");
  const composed = composeMealPlanV2(REQUIREMENTS_LEGGERE, [BREAKFAST, LUNCH, DINNER], new Map() as FdcPoolMap, {
    request: request({
      planDate: "2026-09-20",
      times: { breakfast: ctx.lunchTimeLocal, lunch: "13:00", dinner: "20:00" },
      racePreLunch: ctx,
    }),
    menuFoodPools: buildPools(),
  });
  const names = composed.find((s) => s.slot === "breakfast")!.items.map((i) => i.description);
  assert.equal(names.length, 3, `protocollo a 3 voci atteso, ottenuto: ${names.join(" | ")}`);
  assert.ok(names.some((n) => /Pasta|Riso/i.test(n)), names.join(" | "));
  assert.ok(names.some((n) => /Grana/i.test(n)), `il grana del protocollo è sparito: ${names.join(" | ")}`);
  assert.ok(names.some((n) => /Olio/i.test(n)), names.join(" | "));
});
