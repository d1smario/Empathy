/**
 * P1 — I macro PERSISTITI (`meal_item`, la fonte che legge «Oggi») devono venire dalla
 * COMPOSIZIONE dell'alimento, non da una ripartizione percentuale delle kcal per ruolo.
 *
 * Difetto misurato sui dati veri (Milesi 04968274…, 20/09/2026): Riso 275 g crudi,
 * `response_payload` 220 g CHO (da fdc:169756), `meal_item.carbs_g` 180,7 → 2,48 g/kg
 * invece dei 3 g/kg del protocollo. Stessa origine: 6,3 g di carboidrati in 15 g di olio
 * EVO e 4-5 g di carboidrati nel grana.
 *
 * Qui si misura il numero che finisce DAVVERO in `meal_item`, cioè le righe prodotte da
 * `pendingMealItemRowsFromProduction` — la stessa selezione che usa `persistV2PlanToDb`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { MealPlanV2ComposedSlot } from "@empathy/contracts";
import {
  buildRacePreLunchDayContext,
  composeRacePostRecoveryMeal,
  composeRacePreLunchMainMeal,
  type RacePreLunchDayContext,
} from "@/lib/nutrition/race-day-pre-race-lunch";
import { mediterraneanMealToV2Items } from "@/lib/nutrition/v2/v2-mediterranean-meal-adapter";
import {
  pendingMealItemRowsFromProduction,
  type PendingMealItemRow,
} from "@/lib/nutrition/v2/persist-v2-plan-to-db";
import type { MealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";
import { CANONICAL_FOOD_TABLE, scaleCanonicalNutrientsToGrams } from "@/lib/nutrition/canonical-food-composition";

/** Budget di slot generoso: il protocollo è fisso e non lo insegue. */
const FAT_SLOT_BUDGET = { kcal: 1800, carbsG: 260, proteinG: 80, fatG: 50 };

function raceCtxFor(weightKg: number): RacePreLunchDayContext {
  const ctx = buildRacePreLunchDayContext({
    weightKg,
    planDate: "2026-09-20", // domenica di gara
    routineConfig: {
      week_plan: {
        Sun: { day_mode: "race", training1_start_time: "13:30", training1_duration_minutes: 180 },
      },
    },
    plannedSessions: [{ duration_minutes: 180, type: "race", notes: "Gara" }],
    activeMealSlots: ["breakfast", "lunch", "dinner"],
  });
  assert.ok(ctx, "contesto pre-gara atteso sul giorno gara");
  return ctx!;
}

/** Le righe `meal_item` del pre-gara, esattamente come le scriverebbe il persist. */
function persistedPreRaceRows(weightKg: number, seed: number): PendingMealItemRow[] {
  const ctx = raceCtxFor(weightKg);
  const meal = composeRacePreLunchMainMeal(ctx.mealSlot, FAT_SLOT_BUDGET, seed, ctx);
  const items = mediterraneanMealToV2Items(meal);
  const slot: MealPlanV2ComposedSlot = {
    slot: ctx.mealSlot,
    labelIt: "Pre-gara",
    targetKcal: FAT_SLOT_BUDGET.kcal,
    items,
    totals: items.reduce(
      (a, i) => ({ kcal: a.kcal + i.kcal, choG: a.choG + i.choG, proG: a.proG + i.proG, fatG: a.fatG + i.fatG }),
      { kcal: 0, choG: 0, proG: 0, fatG: 0 },
    ),
  };
  const production = { composedMealPlan: [slot] } as unknown as MealPlanV2Production;
  return pendingMealItemRowsFromProduction(production);
}

function rowMatching(rows: PendingMealItemRow[], re: RegExp): PendingMealItemRow {
  const found = rows.find((r) => re.test(String(r.label ?? "")));
  assert.ok(found, `riga ${re} attesa fra: ${rows.map((r) => r.label).join(" | ")}`);
  return found!;
}

test("P1 · 73 kg: il CHO PERSISTITO del pre-gara è ~219 g (3 g/kg), non 180,7", () => {
  for (const seed of [2, 3]) {
    const rows = persistedPreRaceRows(73, seed);
    const staple = rowMatching(rows, /Pasta|Riso/);
    const perKg = staple.carbsG / 73;
    assert.ok(
      Math.abs(staple.carbsG - 219) <= 3,
      `seed ${seed}: ${staple.label} ${staple.grams} g → carbs_g persistiti ${staple.carbsG} (${perKg.toFixed(2)} g/kg), attesi ~219 (3 g/kg)`,
    );
  }
});

test("P1 · l'olio EVO è tutto grasso: 15 g di olio = 15 g di grasso, zero carboidrati", () => {
  // I grammi di olio ruotano nell'intervallo del protocollo (15-20 g): qui si misura che il
  // grasso persistito sia SEMPRE i grammi serviti — 15 g di olio erano 10 g di grasso e
  // 6,3 g di carboidrati.
  const served: number[] = [];
  for (const seed of [0, 1, 2, 3, 5, 7, 11]) {
    const oil = rowMatching(persistedPreRaceRows(73, seed), /Olio/);
    served.push(oil.grams);
    assert.ok(oil.grams >= 15 && oil.grams <= 20, `seed ${seed}: olio ${oil.grams} g fuori 15-20`);
    assert.ok(
      Math.abs(oil.fatG - oil.grams) <= 0.5,
      `seed ${seed}: olio ${oil.grams} g → fat_g persistito ${oil.fatG}, atteso ${oil.grams}`,
    );
    assert.equal(oil.carbsG, 0, `seed ${seed}: olio carbs_g ${oil.carbsG} — l'olio non ha carboidrati`);
    assert.equal(oil.proteinG, 0, `seed ${seed}: olio protein_g ${oil.proteinG} — l'olio non ha proteine`);
  }
  assert.ok(served.includes(15), `atteso almeno un giro con i 15 g del protocollo: ${served.join(", ")}`);
});

test("P1 · il grana non porta carboidrati e porta la sua quota proteica vera", () => {
  const rows = persistedPreRaceRows(73, 3);
  const grana = rowMatching(rows, /Grana/);
  const row = CANONICAL_FOOD_TABLE["cheese_hard"]!;
  const real = scaleCanonicalNutrientsToGrams(row, grana.grams);
  assert.equal(grana.carbsG, 0, `grana: carbs_g persistito ${grana.carbsG} su ${grana.grams} g`);
  assert.ok(
    Math.abs(grana.proteinG - real.proteinG) <= 0.2,
    `grana: protein_g persistito ${grana.proteinG}, composizione ${real.proteinG}`,
  );
  assert.ok(
    Math.abs(grana.fatG - real.fatG) <= 0.2,
    `grana: fat_g persistito ${grana.fatG}, composizione ${real.fatG}`,
  );
});

test("P1 · un solo piatto, un solo numero: i macro persistiti = composizione × grammi persistiti", () => {
  // La stessa scalatura che il payload applica alla riga (`scaleFromCanonical` →
  // `scaleCanonicalNutrientsToGrams`): payload e meal_item devono dire lo stesso numero.
  // Vale per ogni peso, tetto dello staple compreso: qualunque siano i grammi serviti, i
  // macro persistiti sono la composizione di QUEI grammi.
  for (const weightKg of [73, 95, 67, 66]) {
    for (const seed of [2, 3]) {
      for (const r of persistedPreRaceRows(weightKg, seed)) {
        const canonical = r.canonicalKey ? CANONICAL_FOOD_TABLE[r.canonicalKey] : undefined;
        if (!canonical?.kcalPer100g) continue;
        const real = scaleCanonicalNutrientsToGrams(canonical, r.grams);
        const where = `${weightKg} kg seed ${seed} · ${r.label} ${r.grams} g`;
        assert.ok(Math.abs(r.carbsG - real.carbsG) <= 0.2, `${where}: carbs ${r.carbsG} vs ${real.carbsG}`);
        assert.ok(Math.abs(r.proteinG - real.proteinG) <= 0.2, `${where}: pro ${r.proteinG} vs ${real.proteinG}`);
        assert.ok(Math.abs(r.fatG - real.fatG) <= 0.2, `${where}: fat ${r.fatG} vs ${real.fatG}`);
      }
    }
  }
});

test("P1 · 3 g/kg persistiti, atleta per atleta", () => {
  // 95 kg NON è qui: il tetto di porzione dello staple vive in race-day-pre-race-lunch.ts
  // (altro incarico) e decide quanti grammi si servono. Questo test misura il g/kg dove i
  // grammi non sono tappati; che i macro seguano SEMPRE i grammi serviti — tetto o no — lo
  // misura il test «un solo piatto, un solo numero», che include i 95 kg.
  for (const weightKg of [73, 67, 66]) {
    for (const seed of [2, 3]) {
      const staple = rowMatching(persistedPreRaceRows(weightKg, seed), /Pasta|Riso/);
      const perKg = staple.carbsG / weightKg;
      assert.ok(
        perKg >= 2.9 && perKg <= 3.1,
        `${weightKg} kg seed ${seed}: ${staple.label} ${staple.grams} g → ${staple.carbsG} g CHO = ${perKg.toFixed(2)} g/kg`,
      );
    }
  }
});

/**
 * PERIMETRO — la ripartizione per ruolo serviva anche al recovery post-gara, che passa
 * dallo STESSO adapter. È stata corretta anche lì (stesso difetto, stesso piatto): i macro
 * seguono la composizione dell'alimento. Resta la ripartizione, e SOLO lì, per gli item che
 * non risolvono a nessun alimento canonico («Carbo Recovery Mix», «MCT oil»): nomi
 * commerciali senza composizione da cui leggere.
 */
function persistedRecoveryRows(slot: "snack_pm" | "dinner", seed: number, weightKg = 73): PendingMealItemRow[] {
  const meal = composeRacePostRecoveryMeal(slot, seed, {
    weightKg,
    raceLabel: "Gara",
    raceEndMinutes: 16 * 60 + 30,
    recoveryTimeLocal: "17:00",
    mealSlot: slot,
    choPerKgG: 1.2,
    choG: Math.round(weightKg * 1.2),
    proteinG: Math.round(weightKg * 0.4),
    mctG: 10,
    totalKcal: 800,
  });
  const items = mediterraneanMealToV2Items(meal);
  const composed: MealPlanV2ComposedSlot = {
    slot,
    labelIt: "Recovery",
    targetKcal: 800,
    items,
    totals: items.reduce(
      (a, i) => ({ kcal: a.kcal + i.kcal, choG: a.choG + i.choG, proG: a.proG + i.proG, fatG: a.fatG + i.fatG }),
      { kcal: 0, choG: 0, proG: 0, fatG: 0 },
    ),
  };
  return pendingMealItemRowsFromProduction({ composedMealPlan: [composed] } as unknown as MealPlanV2Production);
}

test("PERIMETRO · recovery post-gara: anche lì i macro vengono dall'alimento", () => {
  // Riso post-gara 73 kg: 110 g crudi per gli 88 g di CHO che il protocollo recovery chiede.
  // La ripartizione ne persisteva 63,4.
  const rice = rowMatching(persistedRecoveryRows("dinner", 2), /Riso/);
  const real = scaleCanonicalNutrientsToGrams(CANONICAL_FOOD_TABLE["rice_dry"]!, rice.grams);
  assert.ok(
    Math.abs(rice.carbsG - real.carbsG) <= 0.2,
    `riso recovery ${rice.grams} g: carbs_g ${rice.carbsG}, composizione ${real.carbsG}`,
  );
  assert.ok(rice.carbsG >= 85, `riso recovery: attesi ~88 g CHO (1,2 g/kg × 73), ottenuti ${rice.carbsG}`);

  const chicken = rowMatching(persistedRecoveryRows("dinner", 3), /Petto di pollo/);
  assert.equal(chicken.carbsG, 0, `petto di pollo: carbs_g ${chicken.carbsG} — la carne non ha carboidrati`);
});

test("PERIMETRO · resta la ripartizione per ruolo solo su chi non ha composizione", () => {
  // «Carbo Recovery Mix» e «MCT oil» non risolvono a nessun alimento canonico: il
  // comportamento è quello di prima (72/14/14 e 18/18/64 delle kcal), non un dato inventato.
  const rows = persistedRecoveryRows("dinner", 3);
  const mix = rowMatching(rows, /Carbo Recovery Mix/);
  assert.equal(mix.canonicalKey, "generic_mixed");
  assert.ok(Math.abs(mix.carbsG - (mix.kcal * 0.72) / 4) <= 0.2, `mix: carbs_g ${mix.carbsG} su ${mix.kcal} kcal`);

  const mct = rowMatching(rows, /MCT/);
  assert.equal(mct.canonicalKey, "generic_mixed");
  assert.ok(Math.abs(mct.fatG - (mct.kcal * 0.64) / 9) <= 0.2, `MCT: fat_g ${mct.fatG} su ${mct.kcal} kcal`);
});
