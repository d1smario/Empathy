/**
 * `athlete_profiles.food_preferences` ha DUE scrittori nel tab Alimentazione: i chip
 * «Cucine preferite» e (storicamente) un campo di testo libero. Il salvataggio scrive
 * l'UNIONE dei due (`joinUnique([...food_preferences, ...cuisines])`).
 *
 * Regressione che questi test bloccano: se `cuisines` ripartisse vuoto al caricamento del
 * profilo e la colonna restasse tutta dentro `food_preferences`, l'unione renderebbe la
 * colonna APPEND-ONLY — un chip già salvato non sarebbe più deselezionabile da nessuna
 * superficie. `splitFoodPreferences` separa i token: quelli che sono un chip vanno in
 * `cuisines` (ri-cliccarli li toglie davvero), gli altri restano nel campo residuo e
 * vengono riscritti identici.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  joinUnique,
  parseCsvList,
  preferredCuisines,
  splitFoodPreferences,
  toggleCsvToken,
} from "@/lib/profile/profile-page-kit";

/** Riproduce il salvataggio di ProfilePageView: unione residuo + chip. */
function saveFoodPreferences(rest: string, cuisines: string): string[] | null {
  return joinUnique([...(parseCsvList(rest) ?? []), ...(parseCsvList(cuisines) ?? [])]);
}

test("splitFoodPreferences: i token-chip vanno in cuisines, il resto nel residuo", () => {
  const s = splitFoodPreferences(["mediterranea", "poco piccante", "asiatica"]);
  assert.deepEqual(s.cuisines, ["mediterranea", "asiatica"]);
  assert.deepEqual(s.rest, ["poco piccante"]);
});

test("splitFoodPreferences: null/vuoti/duplicati/spazi non producono token spuri", () => {
  assert.deepEqual(splitFoodPreferences(null), { cuisines: [], rest: [] });
  assert.deepEqual(splitFoodPreferences(undefined), { cuisines: [], rest: [] });
  assert.deepEqual(splitFoodPreferences([" ", "", "  mediterranea  ", "mediterranea", "x", "x"]), {
    cuisines: ["mediterranea"],
    rest: ["x"],
  });
});

test("splitFoodPreferences: il match è case-insensitive ma canonicalizza sul token del chip", () => {
  // In DB c'è «Mediterranea»: dev'essere riconosciuto come chip (altrimenti resta nel
  // residuo e ricompare per sempre) e riscritto minuscolo, come lo scrive il chip.
  const s = splitFoodPreferences(["Mediterranea"]);
  assert.deepEqual(s.cuisines, ["mediterranea"]);
  assert.deepEqual(s.rest, []);
});

test("round-trip: deselezionare un chip lo TOGLIE davvero dalla colonna (no append-only)", () => {
  const inDb = ["mediterranea", "asiatica", "niente cibo piccante"];
  const hydrated = splitFoodPreferences(inDb);
  const form = { rest: hydrated.rest.join(", "), cuisines: hydrated.cuisines.join(", ") };

  // L'atleta ri-clicca il chip «mediterranea» per toglierlo.
  const afterToggle = toggleCsvToken(form.cuisines, "mediterranea");
  const saved = saveFoodPreferences(form.rest, afterToggle);

  assert.deepEqual(saved, ["niente cibo piccante", "asiatica"]);
  assert.ok(!saved?.includes("mediterranea"), "il token deselezionato non deve tornare in DB");
});

test("round-trip: senza toccare nulla la colonna si riscrive con lo stesso insieme", () => {
  const inDb = ["asiatica", "mediterranea", "poco sale"];
  const h = splitFoodPreferences(inDb);
  const saved = saveFoodPreferences(h.rest.join(", "), h.cuisines.join(", ")) ?? [];
  assert.deepEqual([...saved].sort(), [...inDb].sort());
});

test("round-trip: togliere l'ULTIMO valore svuota la colonna (null), non la lascia appesa", () => {
  const h = splitFoodPreferences(["mediterranea"]);
  const saved = saveFoodPreferences(h.rest.join(", "), toggleCsvToken(h.cuisines.join(", "), "mediterranea"));
  assert.equal(saved, null);
});

test("ogni chip proposto dalla UI è riconosciuto dallo split (nessun chip orfano)", () => {
  for (const c of preferredCuisines) {
    assert.deepEqual(splitFoodPreferences([c]).cuisines, [c], `chip «${c}» non riconosciuto`);
  }
});
