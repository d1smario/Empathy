import test from "node:test";
import assert from "node:assert/strict";
import { guardConfirmedPatches } from "@/lib/health/confirmed-patch-guard";

const proposta = [
  { field: "ferritina", proposed_value: 97, unit: "ng/mL" },
  { field: "vit_d", proposed_value: 31.5, unit: "ng/mL" },
];
const range = (f: string) => (f === "ferritina" ? { min: 0.1, max: 50000 } : null);

test("si confermano i valori proposti, nell'unità della proposta", () => {
  const r = guardConfirmedPatches(
    [{ field: "ferritina", value: 97, unit: "ng/mL" }, { field: "vit_d", value: 31.5, unit: null }],
    proposta,
    range,
  );
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.patches.length, 2);
    assert.equal(r.patches[1]?.unit, "ng/mL");
  }
});

test("UN CAMPO MAI PROPOSTO NON ENTRA: il punteggio fatto in casa rimbalza", () => {
  const r = guardConfirmedPatches(
    [{ field: "ferritina", value: 97, unit: null }, { field: "health_score_totale", value: 100, unit: null }],
    proposta,
    range,
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, "field_not_proposed");
    assert.equal(r.field, "health_score_totale");
  }
});

test("un valore corretto dentro la plausibilità passa", () => {
  const r = guardConfirmedPatches([{ field: "ferritina", value: 79, unit: null }], proposta, range);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.patches[0]?.value, 79);
});

test("un valore corretto fuori scala rimbalza, come nell'inserimento manuale", () => {
  const r = guardConfirmedPatches([{ field: "ferritina", value: 999999, unit: null }], proposta, range);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "value_implausible");
});

test("un numero resta un numero", () => {
  const r = guardConfirmedPatches([{ field: "ferritina", value: "tanta", unit: null }], proposta, range);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "value_not_numeric");
});

test("la virgola decimale all'italiana viene letta", () => {
  const r = guardConfirmedPatches([{ field: "vit_d", value: "31,5", unit: null }], proposta, range);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.patches[0]?.value, 31.5);
});

test("un valore vuoto non si conferma", () => {
  const r = guardConfirmedPatches([{ field: "vit_d", value: "  ", unit: null }], proposta, range);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "value_missing");
});

test("l'unità non si cambia in conferma: resta quella della proposta", () => {
  const r = guardConfirmedPatches([{ field: "ferritina", value: 97, unit: "mg/dL" }], proposta, range);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.patches[0]?.unit, "ng/mL");
});

test("lo stesso campo ripetuto: vince la prima occorrenza, la seconda non passa di nascosto", () => {
  const r = guardConfirmedPatches(
    [{ field: "ferritina", value: 97, unit: null }, { field: "FERRITINA", value: 1, unit: null }],
    proposta,
    range,
  );
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.patches.length, 1);
    assert.equal(r.patches[0]?.value, 97);
  }
});

test("senza intervallo noto un numero corretto passa: la plausibilità non si inventa", () => {
  const r = guardConfirmedPatches([{ field: "vit_d", value: 45, unit: null }], proposta, range);
  assert.ok(r.ok);
});

test("il valore proposto confermato tale e quale passa anche se il range lo escluderebbe", () => {
  // Il numero era già nel referto: la plausibilità controlla le CORREZIONI, non riscrive la proposta.
  const r = guardConfirmedPatches(
    [{ field: "ferritina", value: 60000, unit: null }],
    [{ field: "ferritina", proposed_value: 60000, unit: "ng/mL" }],
    range,
  );
  assert.ok(r.ok);
});

test("legge anche le proposte nella forma { field, value }", () => {
  const r = guardConfirmedPatches([{ field: "hb", value: 15, unit: null }], [{ field: "hb", value: 15.6, unit: "g/dL" }]);
  assert.ok(r.ok);
});
