/**
 * Rimozione delle esclusioni STORICHE (`athlete_profiles.intolerances` / `food_exclusions`).
 *
 * Due proprietà da tenere ferme:
 *  1. la × è un'INTENZIONE, non una mutazione: `form` resta la copia fedele del DB finché
 *     non si salva, così la rimozione è annullabile (il dato, una volta salvato, non è più
 *     recuperabile da nessuna UI — l'ultimo token azzera la colonna);
 *  2. `food_exclusions` ha uno scrittore vivo (il bottone staff che toglie un alimento dal
 *     piano): se non ci fosse una via di uscita sarebbe una lista che cresce e basta.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_LEGACY_REMOVALS,
  applyLegacyRemovals,
  csvTokens,
  toggleLegacyRemoval,
} from "@/modules/profile/views/sections/profile-form-state";
import { parseCsvList } from "@/lib/profile/profile-page-kit";

test("csvTokens: pulisce spazi, vuoti e duplicati", () => {
  assert.deepEqual(csvTokens("  lattosio , , glutine,lattosio "), ["lattosio", "glutine"]);
  assert.deepEqual(csvTokens(""), []);
  assert.deepEqual(csvTokens("   "), []);
});

test("toggleLegacyRemoval: marca, smarca e non sporca l'altro campo", () => {
  const a = toggleLegacyRemoval(EMPTY_LEGACY_REMOVALS, "intolerances", "lattosio");
  assert.deepEqual(a.intolerances, ["lattosio"]);
  assert.deepEqual(a.food_exclusions, []);

  const b = toggleLegacyRemoval(a, "food_exclusions", "Fiorentina (bistecca con osso)");
  assert.deepEqual(b.intolerances, ["lattosio"]);
  assert.deepEqual(b.food_exclusions, ["Fiorentina (bistecca con osso)"]);

  // Secondo click sullo stesso token = ripristino (è l'annulla richiesto prima del Salva).
  const c = toggleLegacyRemoval(b, "intolerances", "lattosio");
  assert.deepEqual(c.intolerances, []);
  assert.deepEqual(c.food_exclusions, ["Fiorentina (bistecca con osso)"]);
});

test("toggleLegacyRemoval: è puro, non muta lo stato in ingresso", () => {
  const start = EMPTY_LEGACY_REMOVALS;
  toggleLegacyRemoval(start, "intolerances", "lattosio");
  assert.deepEqual(start.intolerances, []);
});

test("applyLegacyRemovals: toglie solo i token marcati", () => {
  assert.equal(applyLegacyRemovals("lattosio, glutine, soia", ["glutine"]), "lattosio, soia");
});

test("applyLegacyRemovals: senza marcature il CSV torna normalizzato ma equivalente", () => {
  assert.deepEqual(
    parseCsvList(applyLegacyRemovals(" lattosio ,glutine ", [])),
    ["lattosio", "glutine"],
  );
});

test("applyLegacyRemovals: togliere TUTTO azzera la colonna (parseCsvList → null)", () => {
  // È l'unico modo di svuotare davvero una lista storica: deve restare possibile, ma
  // succede solo al salvataggio, mai al click sulla ×.
  const csv = applyLegacyRemovals("lattosio", ["lattosio"]);
  assert.equal(csv, "");
  assert.equal(parseCsvList(csv), null);
});

test("il click sulla × NON cambia il form: il DB si tocca solo al salvataggio", () => {
  const form = { intolerances: "lattosio, glutine" };
  const marked = toggleLegacyRemoval(EMPTY_LEGACY_REMOVALS, "intolerances", "glutine");

  // Stato del form invariato → riaprire l'editor senza salvare non perde nulla.
  assert.equal(form.intolerances, "lattosio, glutine");
  // Il payload di salvataggio è l'unico posto in cui la rimozione diventa reale.
  assert.deepEqual(parseCsvList(applyLegacyRemovals(form.intolerances, marked.intolerances)), ["lattosio"]);
  // …e annullando prima del Salva il payload torna completo.
  const restored = toggleLegacyRemoval(marked, "intolerances", "glutine");
  assert.deepEqual(parseCsvList(applyLegacyRemovals(form.intolerances, restored.intolerances)), [
    "lattosio",
    "glutine",
  ]);
});
