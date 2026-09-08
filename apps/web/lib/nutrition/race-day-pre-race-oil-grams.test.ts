/**
 * P3 — L'OLIO del protocollo pre-gara: «15-20 g di olio», in GRAMMI, con UN solo numero.
 *
 * Tre difetti misurati sui dati veri (piani gara 20/09/2026, Milesi 04968274… e gli altri
 * tre atleti del protocollo):
 *
 *  1. ROTAZIONE ASSENTE — il grana ruota 15/16/17/18/19/20 col seed del giorno, l'olio era
 *     inchiodato a `oliveOilG: 15`. Due voci dello STESSO protocollo, scritte nella stessa
 *     riga («grana 15-20 g, olio 15-20 g»), che si comportavano in modo diverso.
 *
 *  2. UNITÀ SBAGLIATA — la voce era servita in millilitri («15 ml olio EVO»). 15 ml di EVO
 *     pesano 13,8 g: sotto il minimo del protocollo, −1,2 g di grasso, e la bilancia di
 *     cucina pesa in grammi, non misura volumi.
 *
 *  3. DUE KCAL PER UN PIATTO — `approxKcal` valeva 141 (16 ml × 8,84) mentre i `nutrients`
 *     della stessa riga ne dichiaravano 122 (13,8 g × 8,84). Un piatto, un numero.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRacePreLunchDayContext,
  composeRacePreLunchMainMeal,
  RACE_DAY_PRE_RACE_LUNCH_PROTOCOL,
  type RacePreLunchDayContext,
} from "@/lib/nutrition/race-day-pre-race-lunch";
import { nutrientsForMealPlanItem } from "@/lib/nutrition/canonical-food-composition";
import { mediterraneanMealToV2Items } from "@/lib/nutrition/v2/v2-mediterranean-meal-adapter";
import { portionHintIt } from "@/lib/nutrition/v2/compose-meal-plan-v2";
import { MEAL_SLOT_ASSEMBLY } from "@/lib/nutrition/v2/meal-slot-assembly-spec";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";

/** Gli atleti veri su cui il difetto è stato misurato. */
const ATLETI: readonly { readonly nome: string; readonly kg: number }[] = [
  { nome: "Milesi 04968274", kg: 73 },
  { nome: "e9e8dc46 (95 kg)", kg: 95 },
  { nome: "bfacf0d5", kg: 67 },
  { nome: "edae0861", kg: 66 },
];

/** Budget di slot generoso: il protocollo è fisso e non lo insegue. */
const FAT_SLOT_BUDGET = { kcal: 1800, carbsG: 260, proteinG: 80, fatG: 50 };

const SEEDS = [0, 1, 2, 3, 4, 5, 6, 7, 11, 42, 1234567, 0x811c9dc5] as const;

function raceCtxFor(
  weightKg: number,
  activeSlots?: readonly ("breakfast" | "lunch" | "dinner")[],
): RacePreLunchDayContext {
  const ctx = buildRacePreLunchDayContext({
    weightKg,
    planDate: "2026-09-20", // domenica di gara
    routineConfig: {
      week_plan: {
        Sun: { day_mode: "race", training1_start_time: "13:30", training1_duration_minutes: 180 },
      },
    },
    plannedSessions: [{ duration_minutes: 180, type: "race", notes: "Gara" }],
    activeMealSlots: activeSlots ?? ["breakfast", "lunch", "dinner"],
  });
  assert.ok(ctx, "contesto pre-gara atteso sul giorno gara");
  return ctx!;
}

type OilItem = { name: string; portionHint: string; approxKcal: number };

function oilItemFor(weightKg: number, seed: number, ctx?: RacePreLunchDayContext): OilItem {
  const raceCtx = ctx ?? raceCtxFor(weightKg);
  const meal = composeRacePreLunchMainMeal(raceCtx.mealSlot, FAT_SLOT_BUDGET, seed, raceCtx);
  const oil = meal.items.find((i) => /olio/i.test(i.name));
  assert.ok(oil, `voce olio attesa fra: ${meal.items.map((i) => i.name).join(" | ")}`);
  return oil!;
}

/** Grammi dichiarati dalla riga servita («17 g olio EVO» → 17). Mai da un volume. */
function gramsFromOilLine(portionHint: string): number {
  const g = portionHint.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
  assert.ok(g, `la riga dell'olio deve dire i grammi: «${portionHint}»`);
  return parseFloat(g![1].replace(",", "."));
}

test("P3 · l'olio ruota 15-20 g col seed, come il grana — e copre tutto l'intervallo", () => {
  const visti = new Set<number>();
  for (const { nome, kg } of ATLETI) {
    for (const seed of SEEDS) {
      const oil = oilItemFor(kg, seed);
      const g = gramsFromOilLine(oil.portionHint);
      assert.ok(
        Number.isInteger(g) && g >= 15 && g <= 20,
        `${nome} seed ${seed}: olio ${g} g fuori dal protocollo 15-20 g — «${oil.portionHint}»`,
      );
      visti.add(g);
    }
  }
  assert.deepEqual(
    [...visti].sort((a, b) => a - b),
    [15, 16, 17, 18, 19, 20],
    `l'olio deve ruotare su tutto l'intervallo, visti: ${[...visti].sort((a, b) => a - b).join(", ")}`,
  );
});

test("P3 · olio e grana: stessa regola, stesso seed, due voci indipendenti", () => {
  // Il protocollo dichiara i due intervalli nello stesso modo: la struttura della regola
  // deve essere la stessa, non un numero fisso da una parte e un intervallo dall'altra.
  assert.deepEqual(RACE_DAY_PRE_RACE_LUNCH_PROTOCOL.oliveOilG, { min: 15, max: 20 });
  assert.deepEqual(RACE_DAY_PRE_RACE_LUNCH_PROTOCOL.granaPadanoG, { min: 15, max: 20 });

  const ctx = raceCtxFor(73);
  const coppie = SEEDS.map((seed) => {
    const meal = composeRacePreLunchMainMeal(ctx.mealSlot, FAT_SLOT_BUDGET, seed, ctx);
    const grana = meal.items.find((i) => /grana/i.test(i.name))!;
    const oil = meal.items.find((i) => /olio/i.test(i.name))!;
    return [gramsFromOilLine(grana.portionHint), gramsFromOilLine(oil.portionHint)] as const;
  });
  // Deterministico: stesso seed → stessi grammi.
  for (const seed of SEEDS) {
    assert.equal(gramsFromOilLine(oilItemFor(73, seed, ctx).portionHint), gramsFromOilLine(oilItemFor(73, seed, ctx).portionHint));
  }
  // …e non una copia carbone del grana: due voci dello stesso protocollo, non una sola.
  assert.ok(
    coppie.some(([g, o]) => g !== o),
    `olio e grana non devono essere la stessa estrazione: ${coppie.map(([g, o]) => `${g}/${o}`).join(" ")}`,
  );
});

test("P3 · la voce olio è servita in GRAMMI: nessun millilitro nella riga", () => {
  for (const { nome, kg } of ATLETI) {
    for (const seed of SEEDS) {
      const oil = oilItemFor(kg, seed);
      assert.doesNotMatch(
        oil.portionHint,
        /\bml\b/i,
        `${nome} seed ${seed}: la riga dell'olio parla di millilitri — «${oil.portionHint}»`,
      );
      assert.match(oil.portionHint, /\bg\b/, `${nome} seed ${seed}: «${oil.portionHint}»`);
    }
  }
});

test("P3 · un piatto, un numero: approxKcal = nutrients.kcal, e i grassi sono i grammi serviti", () => {
  for (const { nome, kg } of ATLETI) {
    for (const seed of SEEDS) {
      const oil = oilItemFor(kg, seed);
      const g = gramsFromOilLine(oil.portionHint);
      const { nutrients, compositionKey } = nutrientsForMealPlanItem(oil);
      assert.equal(compositionKey, "olive_oil", `${nome} seed ${seed}: ${compositionKey}`);

      const dove = `${nome} seed ${seed} · «${oil.portionHint}»`;
      assert.ok(
        Math.abs(oil.approxKcal - nutrients.kcal) <= 1,
        `${dove}: approxKcal ${oil.approxKcal} ≠ nutrients.kcal ${nutrients.kcal}`,
      );
      // 100 g di EVO = 100 g di grasso: i grassi devono essere i grammi serviti.
      assert.ok(
        Math.abs(nutrients.fatG - g) <= 0.2,
        `${dove}: ${g} g di olio portano ${nutrients.fatG} g di grasso`,
      );
      assert.equal(nutrients.carbsG, 0, `${dove}: l'olio non ha carboidrati`);
      assert.equal(nutrients.proteinG, 0, `${dove}: l'olio non ha proteine`);
      // …e le kcal sono quelle dei grammi serviti, non di un volume convertito.
      assert.ok(
        Math.abs(oil.approxKcal - g * 8.84) <= 1,
        `${dove}: ${g} g × 8,84 = ${Math.round(g * 8.84)} kcal, servite ${oil.approxKcal}`,
      );
    }
  }
});

test("P3 · anche la riga che arriva al payload dice grammi (colazione e pranzo)", () => {
  // È `mapItem` (map-v2-plan-to-v1-response) a ri-scrivere la porzione con `portionHintIt`,
  // usando il ruolo POSIZIONALE dello slot: a colazione l'indice 2 è `fat`, a pranzo
  // `veg_condiment`. Il protocollo passa da entrambi (gara mattutina → colazione).
  for (const slotKey of ["breakfast", "lunch"] as const) {
    const ctx = raceCtxFor(73, slotKey === "breakfast" ? ["breakfast"] : ["lunch", "dinner"]);
    assert.equal(ctx.mealSlot, slotKey as MealSlotKey);
    for (const seed of [0, 3, 7]) {
      const meal = composeRacePreLunchMainMeal(ctx.mealSlot, FAT_SLOT_BUDGET, seed, ctx);
      const v2 = mediterraneanMealToV2Items(meal).find((i) => /olio/i.test(i.description))!;
      const roles = MEAL_SLOT_ASSEMBLY[slotKey];
      const spec = roles[2] ?? roles[roles.length - 1]!;
      const served = portionHintIt(v2.description, v2.grams, spec, v2.servingBasis);
      assert.doesNotMatch(served, /\bml\b/i, `${slotKey} seed ${seed}: payload «${served}»`);
      assert.equal(
        gramsFromOilLine(served),
        gramsFromOilLine(meal.items.find((i) => /olio/i.test(i.name))!.portionHint),
        `${slotKey} seed ${seed}: il payload deve servire gli stessi grammi del protocollo — «${served}»`,
      );
    }
  }
});

test("P3 · nessun effetto sull'olio del percorso generativo normale (basis ml del catalogo)", () => {
  // La riga di condimento del solver V2 viaggia con `servingBasis: "ml"` dalla staple
  // registry: quella NON è materia di questo intervento e deve restare identica.
  const fat = MEAL_SLOT_ASSEMBLY.breakfast[2]!;
  assert.equal(portionHintIt("Olio EVO", 20, fat, "ml"), "20 ml olio EVO");
  const vegCondiment = MEAL_SLOT_ASSEMBLY.lunch[2]!;
  assert.equal(portionHintIt("Olio EVO", 20, vegCondiment, "ml"), "20 ml Olio EVO");
});
