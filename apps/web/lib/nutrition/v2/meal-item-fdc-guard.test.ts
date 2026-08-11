/**
 * Guardia FK `meal_item.fdc_id → fdc_food(fdc_id)` — logica PURA, nessun DB.
 * Il difetto coperto: le voci del giorno si scrivono in un colpo solo, quindi un solo
 * fdc_id che la FK rifiuta faceva sparire l'INTERA lista-cibi (meal senza meal_item →
 * pagina Oggi vuota con la pagina Nutrizione piena). Qui si verifica che il rifiuto costi
 * al massimo il legame FDC di quella voce — mai la voce, mai la giornata — e che lasci
 * sempre una traccia.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  candidateFdcIdsForFkCheck,
  clearUnknownFdcIds,
  mealItemFdcClearedTrace,
  type PendingMealItem,
} from "@/lib/nutrition/v2/meal-item-fdc-guard";

function item(over: Partial<PendingMealItem>): PendingMealItem {
  return { slot: "lunch", fdcId: null, label: null, canonicalKey: null, ...over };
}

const PASTA = item({ fdcId: 170645, label: "Pasta di semola" });
/** Riga CIQUAL importata in nutrition_fdc_foods con fdc_id sintetico 900000000+codice. */
const CIQUAL = item({ slot: "dinner", fdcId: 900011043, label: "Formaggio fresco" });
/** Staple canonico senza alias FDC: arriva con la sola chiave testuale. */
const CANONICAL = item({ slot: "snack_pm", fdcId: null, canonicalKey: "chicken_breast", label: "Petto di pollo" });

test("guardia: fdc_id presente in fdc_food → la voce passa intatta", () => {
  const { rows, cleared } = clearUnknownFdcIds([PASTA], new Set([170645]));
  assert.deepEqual(rows, [PASTA]);
  assert.deepEqual(cleared, []);
});

test("guardia: fdc_id ASSENTE da fdc_food → la voce RESTA con fdc_id azzerato, le altre intatte", () => {
  const { rows, cleared } = clearUnknownFdcIds([PASTA, CIQUAL, item({ fdcId: 170379 })], new Set([170645, 170379]));
  assert.equal(rows.length, 3, "nessun cibo sparisce dal piatto");
  assert.deepEqual(
    rows.map((r) => r.fdcId),
    [170645, null, 170379],
  );
  // Il cibo resta identificabile: Oggi lo mostra con label + canonical_key.
  assert.equal(rows[1]!.label, "Formaggio fresco");
  assert.deepEqual(cleared, [
    { slot: "dinner", fdcId: 900011043, label: "Formaggio fresco", canonicalKey: null },
  ]);
});

test("guardia: voce con sola chiave testuale (chicken_breast) → passa con fdc_id NULL, senza traccia", () => {
  // La FK non si applica ai NULL: queste righe sono la lista-cibi completa che Oggi mostra
  // con label + canonical_key, non un errore.
  const { rows, cleared } = clearUnknownFdcIds([CANONICAL], new Set());
  assert.deepEqual(rows, [CANONICAL]);
  assert.deepEqual(cleared, []);
  assert.deepEqual(candidateFdcIdsForFkCheck([CANONICAL]), [], "niente da verificare: nessun fdc_id");
});

test("guardia: lista tutta valida → niente azzerato e nessuna traccia", () => {
  const items = [PASTA, item({ fdcId: 170379 }), CANONICAL];
  const { rows, cleared } = clearUnknownFdcIds(items, new Set([170645, 170379]));
  assert.deepEqual(rows, items);
  assert.deepEqual(cleared, []);
  assert.equal(mealItemFdcClearedTrace(cleared), null, "provenienza identica al caso normale");
});

test("guardia: lista tutta invalida → le voci RESTANO tutte (giornata mai vuota) con traccia completa", () => {
  const items = [CIQUAL, item({ slot: "breakfast", fdcId: 900012345, label: "Yogurt CIQUAL" })];
  const { rows, cleared } = clearUnknownFdcIds(items, new Set([170645]));
  assert.equal(rows.length, 2, "il caso peggiore costa i legami FDC, non i cibi");
  assert.deepEqual(
    rows.map((r) => r.fdcId),
    [null, null],
  );
  assert.equal(cleared.length, 2);
  assert.deepEqual(mealItemFdcClearedTrace(cleared), {
    reason: "fdc_id_missing_in_fdc_food",
    cleared_count: 2,
    cleared: [
      { slot: "dinner", fdc_id: 900011043, label: "Formaggio fresco", canonical_key: null },
      { slot: "breakfast", fdc_id: 900012345, label: "Yogurt CIQUAL", canonical_key: null },
    ],
  });
});

test("guardia: la voce in ingresso non viene mutata (il chiamante può ancora leggere l'fdc originale)", () => {
  const original = { ...CIQUAL };
  const { rows } = clearUnknownFdcIds([original], new Set([170645]));
  assert.equal(original.fdcId, 900011043, "input immutato");
  assert.equal(rows[0]!.fdcId, null);
});

test("guardia: gli id da verificare sono deduplicati (una sola query per giornata)", () => {
  const items = [PASTA, item({ fdcId: 170645 }), CIQUAL, CANONICAL, item({ fdcId: 0 })];
  assert.deepEqual(candidateFdcIdsForFkCheck(items), [170645, 900011043]);
});
