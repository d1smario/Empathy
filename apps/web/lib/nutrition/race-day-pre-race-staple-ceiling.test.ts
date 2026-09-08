/**
 * REGOLA 1 di Mario, il NUMERO: «3 g/kg di carboidrati da pasta o riso».
 *
 * Il tetto di porzione dello staple (`clampStep(raw, 50, 320)` per la pasta, `(45, 300)`
 * per il riso) è una guardia generica ereditata dal compositore, non un numero del
 * nutrizionista: sopra ~80 kg appiattiva la quota CHO su ~240 g per chiunque. Misurato in
 * produzione: l'atleta da 95 kg riceveva 320 g di pasta su OGNI piano gara (6 piani
 * 21/08→06/09) e 300 g di riso su altri 6 (17/08→31/08) — sempre il tetto, mai il
 * protocollo — mentre 73/67/66/60,5/52,5 kg scalavano regolarmente col peso.
 *
 * Qui si verifica che il protocollo arrivi intero fino a 110 kg, e che quando il tetto di
 * porzione morde davvero (peso fuori scala, tipicamente un errore di profilo) NON scenda in
 * silenzio: la riga del piatto deve dirlo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RACE_STAPLE_MAX_PROTOCOL_WEIGHT_KG,
  buildRacePreLunchDayContext,
  composeRacePreLunchMainMeal,
  dryStapleServingForTargetCarbs,
  type RacePreLunchDayContext,
} from "@/lib/nutrition/race-day-pre-race-lunch";

const SLOT_BUDGET = { kcal: 1800, carbsG: 260, proteinG: 80, fatG: 50 };

function raceCtxFor(weightKg: number): RacePreLunchDayContext {
  const ctx = buildRacePreLunchDayContext({
    weightKg,
    planDate: "2026-09-20", // domenica
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

/** Riga dello staple del protocollo (pasta o riso), come la legge l'atleta. */
function stapleLine(weightKg: number, glutenFree = false): string {
  const ctx = raceCtxFor(weightKg);
  const meal = composeRacePreLunchMainMeal(
    ctx.mealSlot,
    SLOT_BUDGET,
    2, // seed pari → pasta; con glutine escluso resta il riso
    ctx,
    undefined,
    glutenFree ? new Set(["glutine" as const]) : undefined,
  );
  const staple = meal.items.find((i) => /Pasta|Riso/.test(i.name));
  assert.ok(staple, "staple pasta/riso atteso nel protocollo");
  return staple!.portionHint;
}

function gramsOf(line: string): number {
  return Number(/^(\d+)\s*g\s+(pasta secca|riso)/i.exec(line)?.[1] ?? 0);
}

function choOf(line: string): number {
  return Number(/~(\d+)\s*g CHO/.exec(line)?.[1] ?? 0);
}

// ── Il protocollo arriva intero fino a 110 kg ────────────────────────────────────────

test("73 kg → 219 g CHO (3 g/kg): invariato, il tetto non c'entra", () => {
  const line = stapleLine(73);
  assert.equal(gramsOf(line), 290, line);
  assert.equal(choOf(line), 219, line);
  assert.doesNotMatch(line, /TETTO/i, line);
});

test("95 kg (atleta reale e9e8dc46) → 285 g CHO, non 240", () => {
  const line = stapleLine(95);
  assert.equal(choOf(line), 285, `atteso 3 g/kg = 285 g CHO, riga: ${line}`);
  assert.equal(gramsOf(line), 380, line);
  assert.doesNotMatch(line, /TETTO/i, line);
});

test("95 kg celiaco → stesso protocollo col riso: 285 g CHO", () => {
  const line = stapleLine(95, true);
  assert.match(line, /riso/i, line);
  assert.equal(choOf(line), 285, `atteso 3 g/kg = 285 g CHO dal riso, riga: ${line}`);
  assert.equal(gramsOf(line), 355, line); // 285 / 0.8 CHO per g, al passo da 5 g
  assert.doesNotMatch(line, /TETTO/i, line);
});

test("110 kg → 330 g CHO: il protocollo regge fino al peso realistico più alto", () => {
  const pasta = stapleLine(110);
  assert.equal(choOf(pasta), 330, pasta);
  assert.equal(gramsOf(pasta), 440, pasta);
  assert.doesNotMatch(pasta, /TETTO/i, pasta);

  const riso = stapleLine(110, true);
  assert.equal(choOf(riso), 330, riso);
  assert.equal(gramsOf(riso), 415, riso); // 330 / 0.8 = 412,5 → 415 al passo da 5 g
  assert.doesNotMatch(riso, /TETTO/i, riso);
});

test("nessun altopiano fra 60 e 120 kg: i grammi crescono col peso", () => {
  for (const glutenFree of [false, true]) {
    let prev = 0;
    for (let kg = 60; kg <= RACE_STAPLE_MAX_PROTOCOL_WEIGHT_KG; kg += 5) {
      const line = stapleLine(kg, glutenFree);
      const g = gramsOf(line);
      assert.ok(g > prev, `${kg} kg (${glutenFree ? "riso" : "pasta"}): ${g} g non supera ${prev} g — ${line}`);
      prev = g;
    }
  }
});

// ── Quando il tetto morde, lo dice ──────────────────────────────────────────────────

test("peso fuori scala (150 kg): il tetto morde ma lascia una traccia leggibile", () => {
  const line = stapleLine(150);
  assert.equal(gramsOf(line), 480, line); // tetto pasta = 3 g/kg di un atleta da 120 kg
  assert.equal(choOf(line), 360, `la riga deve dire i CHO SERVITI, non quelli chiesti: ${line}`);
  assert.match(line, /TETTO PORZIONE/i, `nessuna traccia del protocollo non raggiunto: ${line}`);
  assert.match(line, /450 g CHO/, `manca il numero chiesto dal protocollo: ${line}`);
  assert.match(line, /2[.,]4 g\/kg/, `manca il g\\/kg realmente servito: ${line}`);
});

test("dryStapleServingForTargetCarbs espone il divario, non solo i grammi", () => {
  const ok = dryStapleServingForTargetCarbs("pasta", 285);
  assert.equal(ok.cappedByPortionCeiling, false);
  assert.equal(ok.dryG, 380);
  assert.equal(ok.servedCarbsG, 285);
  assert.equal(ok.shortfallCarbsG, 0);

  const capped = dryStapleServingForTargetCarbs("pasta", 450);
  assert.equal(capped.cappedByPortionCeiling, true);
  assert.equal(capped.dryG, 480);
  assert.equal(capped.servedCarbsG, 360);
  assert.equal(capped.shortfallCarbsG, 90);
});
