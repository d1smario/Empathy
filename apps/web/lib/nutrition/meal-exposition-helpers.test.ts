/**
 * Regressione difetto «Pistacchi 6 g · 0 kcal · CHO 0 · PRO 0 · FAT 0».
 *
 * La riga persistita in `meal_item` era corretta (36 kcal, 1.7/1.2/2.7): a divergere era la
 * RISPOSTA, dove l'item arrivava con un oggetto `nutrients` tutto-zero prodotto dal lookup
 * fallito a monte. `approxMacrosForPlanItem` si fidava della sola presenza del campo e stampava
 * gli zeri. Questi test bloccano la regola: un `nutrients` senza dettaglio macro NON e' un dato.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  approxMacrosForPlanItem,
  estimatedItemGlycemicIndex,
  sumVisibleSlotMacros,
} from "./meal-exposition-helpers";
import { buildExpositionItemsFromPlan } from "@/modules/nutrition/components/EmpathyMealPlanExpositionCard";
import type {
  IntelligentMealPlanItemOut,
  IntelligentMealPlanSlotOut,
} from "./intelligent-meal-plan-types";
import type { ScaledMealItemNutrients } from "./canonical-food-composition";

const ZERO: ScaledMealItemNutrients = {
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  saturatedFatG: 0,
  monoFatG: 0,
  polyFatG: 0,
  omega3G: 0,
  vitA_mcg_RAE: 0,
  vitC_mg: 0,
  vitD_mcg: 0,
  vitE_mg: 0,
  vitK_mcg: 0,
  thiamineB1_mg: 0,
  riboflavinB2_mg: 0,
  niacinB3_mg: 0,
  vitB6_mg: 0,
  folate_mcg: 0,
  vitB12_mcg: 0,
  ca_mg: 0,
  fe_mg: 0,
  mg_mg: 0,
  p_mg: 0,
  k_mg: 0,
  na_mg: 0,
  zn_mg: 0,
  se_mcg: 0,
  eaa_leu: 0,
  eaa_lys: 0,
  eaa_met: 0,
  eaa_phe: 0,
  eaa_thr: 0,
  eaa_trp: 0,
  eaa_ile: 0,
  eaa_val: 0,
  eaa_his: 0,
  glycemicIndex: 0,
  insulinIndex: 0,
  glycemicLoad: 0,
};

function nutrients(patch: Partial<ScaledMealItemNutrients>): ScaledMealItemNutrients {
  return { ...ZERO, ...patch };
}

function item(patch: Partial<IntelligentMealPlanItemOut> = {}): IntelligentMealPlanItemOut {
  return {
    name: "Pistacchi",
    portionHint: "6 g Pistacchi",
    functionalBridge: "",
    approxKcal: 36,
    macroRole: "fat",
    ...patch,
  };
}

test("nutrients validi: passano invariati (nessuna stima)", () => {
  const m = approxMacrosForPlanItem(
    item({ nutrients: nutrients({ kcal: 35.9, carbsG: 1.66, proteinG: 1.23, fatG: 2.7 }) }),
  );
  assert.equal(m.kcal, 36);
  assert.equal(m.carbsG, 1.7);
  assert.equal(m.proteinG, 1.2);
  assert.equal(m.fatG, 2.7);
});

test("nutrients tutti-zero: trattati come dato assente → stima da approxKcal + macroRole", () => {
  const m = approxMacrosForPlanItem(item({ nutrients: nutrients({}) }));
  // Il difetto originale stampava 0/0/0/0 qui.
  assert.equal(m.kcal, 36);
  assert.ok(m.carbsG > 0 && m.proteinG > 0 && m.fatG > 0);
  // macroRole "fat" → 64% dell'energia dai grassi.
  assert.equal(m.fatG, Math.round(((36 * 0.64) / 9) * 10) / 10);
  // Identico all'item senza il campo `nutrients`: lo zero-payload non deve valere piu' di niente.
  assert.deepEqual(m, approxMacrosForPlanItem(item()));
});

test("nutrients PARZIALI (kcal > 0, macro a zero): si tengono le kcal reali, i macro si stimano dal ruolo", () => {
  // Scelta documentata: le kcal sono il dato buono (USDA), il dettaglio macro e' l'unica cosa
  // mancante. Buttarle per ricadere su approxKcal perderebbe l'informazione migliore.
  const m = approxMacrosForPlanItem(
    item({ approxKcal: 999, nutrients: nutrients({ kcal: 36 }) }),
  );
  assert.equal(m.kcal, 36);
  assert.ok(m.carbsG > 0 && m.proteinG > 0 && m.fatG > 0);
  assert.equal(m.fatG, Math.round(((36 * 0.64) / 9) * 10) / 10);
});

test("nutrients con macro ma kcal a zero: kcal ricostruite con Atwater, macro invariati", () => {
  const m = approxMacrosForPlanItem(
    item({ nutrients: nutrients({ kcal: 0, carbsG: 1.7, proteinG: 1.2, fatG: 2.7 }) }),
  );
  assert.equal(m.kcal, Math.round(1.7 * 4 + 1.2 * 4 + 2.7 * 9));
  assert.equal(m.carbsG, 1.7);
  assert.equal(m.fatG, 2.7);
});

test("item senza nutrients: comportamento invariato (stima da approxKcal + macroRole)", () => {
  const m = approxMacrosForPlanItem(item({ approxKcal: 603, macroRole: "cho_heavy" }));
  assert.equal(m.kcal, 603);
  assert.equal(m.carbsG, Math.round(((603 * 0.72) / 4) * 10) / 10);
  assert.equal(m.proteinG, Math.round(((603 * 0.14) / 4) * 10) / 10);
  assert.equal(m.fatG, Math.round(((603 * 0.14) / 9) * 10) / 10);
});

test("difesa in profondita': nessun alimento con grammi > 0 esce a 0 kcal / 0 macro", () => {
  const casi: IntelligentMealPlanItemOut[] = [
    item({ nutrients: nutrients({}) }),
    item({ name: "Pinoli", portionHint: "8 g Pinoli", nutrients: nutrients({}) }),
    item({ name: "Teff", portionHint: "60 g Teff", macroRole: "cho_heavy", nutrients: nutrients({}) }),
    item({ name: "Gouda", portionHint: "30 g Gouda", macroRole: "protein", approxKcal: 0, nutrients: nutrients({}) }),
    item({ name: "Cardi", portionHint: "120 g Cardi", macroRole: "veg", approxKcal: 0 }),
  ];
  for (const c of casi) {
    const m = approxMacrosForPlanItem(c);
    assert.ok(m.kcal > 0, `${c.name}: kcal deve essere > 0`);
    assert.ok(m.carbsG + m.proteinG + m.fatG > 0, `${c.name}: macro non possono essere tutti 0`);
  }
});

test("estimatedItemGlycemicIndex: zero-payload non azzera l'IG (usa i macro stimati)", () => {
  const ig = estimatedItemGlycemicIndex(
    item({ name: "Corn flakes", portionHint: "40 g Corn flakes", macroRole: "cho_heavy", nutrients: nutrients({}) }),
  );
  assert.ok(ig >= 28 && ig <= 92);
  assert.ok(ig > 50, "un cho_heavy stimato deve stare nella banda alta, non nel minimo");
});

test("sumVisibleSlotMacros: il totale pasto non perde le voci con nutrients azzerati", () => {
  const slot: IntelligentMealPlanSlotOut = {
    slot: "breakfast",
    targetKcalEcho: 1025,
    items: [
      item({ name: "Fette biscottate", portionHint: "145 g", approxKcal: 590, macroRole: "cho_heavy",
        nutrients: nutrients({ kcal: 590, carbsG: 110, proteinG: 18, fatG: 6 }) }),
      item({ name: "Uovo in camicia", portionHint: "270 g", approxKcal: 386, macroRole: "protein",
        nutrients: nutrients({ kcal: 386, carbsG: 2, proteinG: 34, fatG: 26 }) }),
      item({ nutrients: nutrients({}) }),
    ],
    slotCoherence: "",
    slotTimingRationale: "",
  };
  const tot = sumVisibleSlotMacros(slot, () => true, { kcal: 0, carbsG: 0, proteinG: 0, fatG: 0 });
  assert.equal(tot.kcal, 590 + 386 + 36);
  assert.ok(tot.fatG > 26 + 6, "il grasso dei pistacchi deve entrare nel totale");
});

test("card del piano: una riga-RICETTA porta gli INGREDIENTI con le quantità e il peso del piatto", () => {
  // Difetto segnalato dal nutrizionista (25 ago): «quando esponiamo una ricetta dovrebbe
  // comparire anche le quantità — l'utente non sa quanto di yogurt, di muesli o di
  // fragole». Prima il peso non usciva nemmeno: `looksLikeMultiIngredientPortionHint`
  // spegneva il badge, perché sul testo il primo numero è un ingrediente solo.
  const riga = item({
    name: "Riso soffiato yogurt greco miele e mirtilli",
    portionHint: "350 g Riso soffiato yogurt greco miele e mirtilli (piatto cotto) · Riso soffiato 63 g, Yogurt greco 0% 175 g, Miele 15 g, Mirtilli 97 g",
    approxKcal: 455,
    macroRole: "cho_heavy",
    nutrients: nutrients({ kcal: 455, carbsG: 89, proteinG: 23, fatG: 1.4 }),
    components: [
      { canonicalKey: "puffed_rice", fdcId: 173912, labelIt: "Riso soffiato", grams: 63 },
      { canonicalKey: "yogurt_greek_nonfat", fdcId: 330137, labelIt: "Yogurt greco 0%", grams: 175 },
      { canonicalKey: "honey", fdcId: 169640, labelIt: "Miele", grams: 15 },
      { canonicalKey: "blueberries_raw", fdcId: 2346411, labelIt: "Mirtilli", grams: 97 },
    ],
  });
  const [out] = buildExpositionItemsFromPlan([riga], () => true);
  assert.ok(out, "la riga deve arrivare alla card");
  assert.equal(out!.components?.length, 4, "gli ingredienti devono arrivare alla card");
  assert.deepEqual(out!.components?.map((c) => c.labelIt), ["Riso soffiato", "Yogurt greco 0%", "Miele", "Mirtilli"]);
  assert.deepEqual(out!.components?.map((c) => c.grams), [63, 175, 15, 97]);
  // Peso del piatto = somma degli ingredienti (350 g), non più assente.
  assert.equal(out!.weightG, 350);
});

test("card del piano: una riga NON-ricetta resta com'era — nessun elenco ingredienti", () => {
  const [out] = buildExpositionItemsFromPlan(
    [item({ name: "Crema di anacardi", portionHint: "46 g Crema di anacardi", approxKcal: 270, macroRole: "fat", nutrients: nutrients({ kcal: 270, carbsG: 12.7, proteinG: 8.1, fatG: 22.7 }) })],
    () => true,
  );
  assert.equal(out!.components, undefined, "un alimento singolo non ha ingredienti da elencare");
  assert.equal(out!.weightG, 46, "il peso continua a leggersi dalla porzione");
});
