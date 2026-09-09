import test from "node:test";
import assert from "node:assert/strict";
import { pickBestFdcForRole, type RolePickContext } from "@/lib/nutrition/v2/fdc-healthy-meal-scoring";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import { MEAL_SLOT_ASSEMBLY } from "@/lib/nutrition/v2/meal-slot-assembly-spec";
import type { MicrosPer100g } from "@/lib/nutrition/v2/fdc-micronutrient-density";

const hit = (
  fdcId: number,
  description: string,
  m: { c: number; p: number; f: number },
  micros?: MicrosPer100g,
): FdcFoodBrowseHit => ({
  fdcId,
  description,
  kcalPer100g: m.c * 4 + m.p * 4 + m.f * 9,
  carbsPer100g: m.c,
  proteinPer100g: m.p,
  fatPer100g: m.f,
  tags: {
    mealCourse: [],
    foodFamily: [],
    macroDominant: [],
    slotFit: [],
    dietProfile: ["omnivore"],
    dietExclude: [],
    mealRole: [],
    aminoProfile: [],
    nutrientDensity: [],
    classifierVersion: "t",
  },
  tagSource: "db",
  ...(micros ? { microsPer100g: micros } : {}),
});

/** Ruolo proteico del pranzo: `PROTEIN_PREFERRED` premia entrambi i candidati. */
const proteinRole = MEAL_SLOT_ASSEMBLY.lunch.find((r) => r.lever === "protein")!;
const baseCtx: RolePickContext = { slot: "lunch", poolKey: proteinRole.poolKey, spec: proteinRole };
const noPenalty = () => 0;

test("senza target del sangue vince il punteggio, come prima", () => {
  const pool = [
    hit(1, "Chicken breast, cooked", { c: 0, p: 31, f: 3 }, { fe_mg: 0.4 }),
    hit(2, "Tuna, cooked", { c: 0, p: 29, f: 1 }, { fe_mg: 1.3 }),
  ];
  const pick = pickBestFdcForRole(pool, baseCtx, [], new Set(), noPenalty);
  assert.equal(pick?.fdcId, 1, "il pollo ha più proteine: senza target vince lui");
});

test("con ferritina bassa, a parità di ruolo vince l'alimento più ricco di ferro", () => {
  const pool = [
    hit(1, "Chicken breast, cooked", { c: 0, p: 31, f: 3 }, { fe_mg: 0.4 }),
    hit(2, "Tuna, cooked", { c: 0, p: 29, f: 1 }, { fe_mg: 1.3 }),
  ];
  const ctx: RolePickContext = { ...baseCtx, nutrientTargets: ["fe_mg"] };
  const pick = pickBestFdcForRole(pool, ctx, [], new Set(), noPenalty);
  assert.equal(pick?.fdcId, 2, "stesso ruolo, punteggi vicini: decide il ferro");
});

test("il sangue NON scavalca una preferenza di ruolo", () => {
  // Il fagiolo ha molto più ferro, ma per il ruolo proteico del pranzo il tonno prende
  // il bonus PROTEIN_PREFERRED (+180): 12 punti di pareggio non possono colmarlo.
  const pool = [
    hit(1, "Tuna, cooked", { c: 0, p: 29, f: 1 }, { fe_mg: 1.3 }),
    hit(2, "Amaranth grain, uncooked", { c: 0, p: 14, f: 7 }, { fe_mg: 7.6 }),
  ];
  const ctx: RolePickContext = { ...baseCtx, nutrientTargets: ["fe_mg"] };
  const pick = pickBestFdcForRole(pool, ctx, [], new Set(), noPenalty);
  assert.equal(pick?.fdcId, 1, "il ruolo viene prima del micronutriente");
});

test("il pareggio non cambia i macro del candidato scelto", () => {
  const pool = [
    hit(1, "Chicken breast, cooked", { c: 0, p: 31, f: 3 }, { fe_mg: 0.4 }),
    hit(2, "Tuna, cooked", { c: 0, p: 29, f: 1 }, { fe_mg: 1.3 }),
  ];
  const ctx: RolePickContext = { ...baseCtx, nutrientTargets: ["fe_mg"] };
  const pick = pickBestFdcForRole(pool, ctx, [], new Set(), noPenalty)!;
  const original = pool.find((h) => h.fdcId === pick.fdcId)!;
  assert.equal(pick.proteinPer100g, original.proteinPer100g);
  assert.equal(pick.carbsPer100g, original.carbsPer100g);
  assert.equal(pick.fatPer100g, original.fatPer100g);
  assert.equal(pick.kcalPer100g, original.kcalPer100g);
});

test("i micronutrienti si possono passare dall'indice invece che dal hit", () => {
  const pool = [
    hit(1, "Chicken breast, cooked", { c: 0, p: 31, f: 3 }),
    hit(2, "Tuna, cooked", { c: 0, p: 29, f: 1 }),
  ];
  const ctx: RolePickContext = {
    ...baseCtx,
    nutrientTargets: ["fe_mg"],
    microsByFdcId: new Map([
      [1, { fe_mg: 0.4 }],
      [2, { fe_mg: 1.3 }],
    ]),
  };
  assert.equal(pickBestFdcForRole(pool, ctx, [], new Set(), noPenalty)?.fdcId, 2);
});

test("un alimento già usato resta escluso anche se è il più ricco", () => {
  const pool = [
    hit(1, "Chicken breast, cooked", { c: 0, p: 31, f: 3 }, { fe_mg: 0.4 }),
    hit(2, "Tuna, cooked", { c: 0, p: 29, f: 1 }, { fe_mg: 1.3 }),
  ];
  const ctx: RolePickContext = { ...baseCtx, nutrientTargets: ["fe_mg"] };
  assert.equal(pickBestFdcForRole(pool, ctx, [], new Set([2]), noPenalty)?.fdcId, 1);
});

test("target attivi ma nessun dato micro: scelta identica a prima", () => {
  const pool = [
    hit(1, "Chicken breast, cooked", { c: 0, p: 31, f: 3 }),
    hit(2, "Tuna, cooked", { c: 0, p: 29, f: 1 }),
  ];
  const ctx: RolePickContext = { ...baseCtx, nutrientTargets: ["fe_mg"] };
  assert.equal(pickBestFdcForRole(pool, ctx, [], new Set(), noPenalty)?.fdcId, 1);
});
