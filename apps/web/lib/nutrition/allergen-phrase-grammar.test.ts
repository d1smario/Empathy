import { test } from "node:test";
import assert from "node:assert/strict";

import { mapFoodPhrasesToAllergenClasses } from "@/lib/nutrition/meal-plan-profile-food-filter";

/**
 * La grammatica delle frasi allergene, fissata per casi.
 *
 * Tre forme, e la posizione decide. In italiano «di» COMPONE e «al» INSAPORISCE:
 * «latte di mandorla» non è latte, «riso al latte» lo è. In inglese il modificatore
 * precede la base senza connettore («almond milk»). La terza forma è l'aggettivo
 * attaccato alla base: «grano saraceno», «noce moscata».
 *
 * Perché questo file esiste: tre giri di correzione hanno scambiato un errore con
 * l'altro — tolto il vincolo di posizione per far passare «latte alle mandorle»,
 * si è rotto «riso al latte». I due errori NON sono simmetrici: un falso positivo
 * restringe il pool, un falso negativo mette l'allergene in tavola. Nel dubbio la
 * classe RESTA, ed è quello che i casi «insaporito» qui sotto difendono.
 */

/** Frasi che NON devono produrre la classe indicata (falsi amici). */
const FALSI_AMICI: Array<[frase: string, classe: string]> = [
  ["latte di mandorla", "latte"],
  ["latte di soia biologico", "latte"],
  ["latte di riso", "latte"],
  ["almond milk", "latte"],
  ["coconut milk", "latte"],
  ["soy yogurt", "latte"],
  ["oat milk", "latte"],
  ["burro di cacao", "latte"],
  ["shea butter", "latte"],
  ["burro di arachidi", "latte"],
  ["noce di cocco", "frutta_a_guscio"],
  ["grano saraceno", "glutine"],
  ["buckwheat", "glutine"],
  ["noce moscata", "frutta_a_guscio"],
  ["pesca", "pesce"],
  ["pesche", "pesce"],
  ["pesca noce", "frutta_a_guscio"],
];

/** Frasi che DEVONO produrre la classe: qui un errore è un allergene servito. */
const VERI: Array<[frase: string, classe: string]> = [
  ["riso al latte", "latte"],
  ["yogurt al cocco", "latte"],
  ["latte alle mandorle", "latte"],
  ["latte e mandorle", "latte"],
  ["latte al cacao", "latte"],
  ["Lattosio", "latte"],
  ["latte", "latte"],
  ["Noci, nocciole", "frutta_a_guscio"],
  ["frutta a guscio", "frutta_a_guscio"],
  ["noci", "frutta_a_guscio"],
  ["crostacei", "crostacei"],
  ["grano", "glutine"],
  ["pesce azzurro", "pesce"],
];

for (const [frase, classe] of FALSI_AMICI) {
  test(`falso amico: «${frase}» non è ${classe}`, () => {
    assert.ok(
      !mapFoodPhrasesToAllergenClasses([frase]).includes(classe),
      `«${frase}» ha prodotto ${classe}: il pool dell'atleta si restringe senza motivo`,
    );
  });
}

for (const [frase, classe] of VERI) {
  test(`allergene vero: «${frase}» produce ${classe}`, () => {
    assert.ok(
      mapFoodPhrasesToAllergenClasses([frase]).includes(classe),
      `«${frase}» NON ha prodotto ${classe}: l'allergene finirebbe nel piatto`,
    );
  });
}

test("l'elenco resta un elenco: «latte e mandorle» dà entrambe le classi", () => {
  const out = mapFoodPhrasesToAllergenClasses(["latte e mandorle"]);
  assert.ok(out.includes("latte") && out.includes("frutta_a_guscio"));
});

test("nessuna dichiarazione, nessuna classe (nessun effetto sul 95% degli atleti)", () => {
  assert.deepEqual(mapFoodPhrasesToAllergenClasses([]), []);
  assert.deepEqual(mapFoodPhrasesToAllergenClasses(["", "  "]), []);
});
