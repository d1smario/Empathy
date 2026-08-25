import assert from "node:assert/strict";
import test from "node:test";
import { nutrientsFromRecipeComponents } from "@/lib/nutrition/meal-plan-response-finalize";
import { scaleCanonicalNutrientsToKcal, type CanonicalFoodNutrients } from "@/lib/nutrition/canonical-food-composition";
import type { FdcCanonicalSnapshot } from "@/lib/nutrition/fdc-to-canonical-scaler";

/**
 * IL DIFETTO SEGNALATO DAL NUTRIZIONISTA (25 ago 2026), sul caso vero.
 *
 * «Nella barra dei macro mi inserisce sempre troppi grassi e pochi carboidrati […] la
 * somma dei macro dei singoli alimenti non coincide con il totale del pasto.»
 *
 * Una riga-RICETTA non ha `compositionKey` (non è un alimento): il finalize ricadeva su
 * `inferCanonicalFoodKeyPreferName`, che indovina l'alimento DAL NOME e ne scala i
 * nutrienti fino alle kcal del piatto. «Riso soffiato yogurt greco miele e mirtilli»
 * contiene la parola yogurt → yogurt bianco INTERO. Kcal giuste, macro di un altro
 * alimento: 318 righe-ricetta su 318, −32,9 g di carboidrati e +10,7 g di grassi in media.
 *
 * Fixture: valori per 100 g LETTI DA PRODUZIONE il 25 ago (nutrition_fdc_foods) per gli
 * ingredienti veri di quella colazione + lo yogurt intero che la deduzione agganciava.
 */
function per100(kcal: number, cho: number, pro: number, fat: number): CanonicalFoodNutrients {
  return { kcalPer100g: kcal, carbsG: cho, proteinG: pro, fatG: fat } as CanonicalFoodNutrients;
}

const PUFFED_RICE = per100(402, 89.8, 6.3, 0.5); // fdc 173912
const YOGURT_GRECO_0 = per100(61, 3.6, 10.3, 0.4); // fdc 330137
const MIELE = per100(304, 82.4, 0.3, 0); // fdc 169640
const MIRTILLI = per100(64, 14.6, 0.7, 0.3); // fdc 2346411
const YOGURT_INTERO = per100(61, 4.7, 3.5, 3.3); // fdc 171284 — quello dedotto per sbaglio

const SNAPSHOT = {
  "fdc:173912": { canonical: PUFFED_RICE, gi: 0, ii: 0, glPer100g: 0 },
  "fdc:330137": { canonical: YOGURT_GRECO_0, gi: 0, ii: 0, glPer100g: 0 },
  "fdc:169640": { canonical: MIELE, gi: 0, ii: 0, glPer100g: 0 },
  "fdc:2346411": { canonical: MIRTILLI, gi: 0, ii: 0, glPer100g: 0 },
} as unknown as FdcCanonicalSnapshot;

/** La colazione vera dell'atleta di test del 27 ago, ingredienti e grammi persistiti. */
const INGREDIENTI = [
  { canonicalKey: "puffed_rice", fdcId: 173912, labelIt: "Riso soffiato", grams: 63 },
  { canonicalKey: "yogurt_greek_nonfat", fdcId: 330137, labelIt: "Yogurt greco 0%", grams: 175 },
  { canonicalKey: "honey", fdcId: 169640, labelIt: "Miele", grams: 15 },
  { canonicalKey: "blueberries_raw", fdcId: 2346411, labelIt: "Mirtilli", grams: 97 },
];

test("riga-ricetta: i macro vengono dagli INGREDIENTI — colazione glucidica e magra, come dev'essere", () => {
  const n = nutrientsFromRecipeComponents(INGREDIENTI, SNAPSHOT);
  assert.ok(n, "con ingredienti risolvibili i nutrienti si calcolano");
  // Riso soffiato + yogurt magro + miele + mirtilli: carboidrati alti, grassi quasi zero.
  assert.ok(n!.carbsG > 80, `carboidrati attesi sopra 80 g, ottenuti ${n!.carbsG.toFixed(1)}`);
  assert.ok(n!.fatG < 3, `grassi attesi sotto 3 g, ottenuti ${n!.fatG.toFixed(1)}`);
  assert.ok(n!.proteinG > 20, `proteine attese sopra 20 g, ottenute ${n!.proteinG.toFixed(1)}`);
  // Coerenza interna: i macro reggono il confronto con le proprie kcal (Atwater, ±12%).
  const kcalDaMacro = n!.carbsG * 4 + n!.proteinG * 4 + n!.fatG * 9;
  assert.ok(Math.abs(kcalDaMacro - n!.kcal) / n!.kcal < 0.12, `${kcalDaMacro.toFixed(0)} vs ${n!.kcal.toFixed(0)} kcal`);
});

test("riga-ricetta: il confronto col vecchio calcolo — stesse kcal, macro di tutt'altro alimento", () => {
  const vero = nutrientsFromRecipeComponents(INGREDIENTI, SNAPSHOT)!;
  // Come faceva prima: yogurt INTERO dedotto dal nome, scalato fino alle kcal del piatto.
  const vecchio = scaleCanonicalNutrientsToKcal(YOGURT_INTERO, vero.kcal);
  assert.ok(
    Math.abs(vecchio.kcal - vero.kcal) < 2,
    "le kcal coincidevano — per questo il difetto non si vedeva dal totale del pasto",
  );
  assert.ok(vecchio.fatG > vero.fatG + 15, `grassi gonfiati: ${vecchio.fatG.toFixed(1)} contro ${vero.fatG.toFixed(1)}`);
  assert.ok(vecchio.carbsG < vero.carbsG - 40, `carboidrati persi: ${vecchio.carbsG.toFixed(1)} contro ${vero.carbsG.toFixed(1)}`);
});

test("riga-ricetta: il componente neutro (acqua/brodo) non porta nutrienti ma non ferma il calcolo", () => {
  // Le zuppe hanno 42-45 g di acqua su 100 g di piatto: niente canonical, niente fdc.
  const conAcqua = [...INGREDIENTI, { canonicalKey: null, fdcId: null, labelIt: "Acqua / brodo neutro", grams: 120 }];
  const n = nutrientsFromRecipeComponents(conAcqua, SNAPSHOT);
  assert.ok(n, "l'acqua non risolvibile non deve annullare gli altri ingredienti");
  assert.deepEqual(n!.kcal, nutrientsFromRecipeComponents(INGREDIENTI, SNAPSHOT)!.kcal);
});

test("riga-ricetta: nessun ingrediente risolvibile ⇒ null, mai nutrienti inventati", () => {
  const ignoti = [{ canonicalKey: "alimento_che_non_esiste", fdcId: null, labelIt: "Ignoto", grams: 100 }];
  assert.equal(nutrientsFromRecipeComponents(ignoti, {} as FdcCanonicalSnapshot), null);
  // Grammi a zero: non è un ingrediente servito, non entra nel conto.
  const zero = [{ canonicalKey: "puffed_rice", fdcId: 173912, labelIt: "Riso soffiato", grams: 0 }];
  assert.equal(nutrientsFromRecipeComponents(zero, SNAPSHOT), null);
});
