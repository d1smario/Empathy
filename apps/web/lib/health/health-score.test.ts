import test from "node:test";
import assert from "node:assert/strict";
import {
  extractScorableMarkers,
  scoreArea,
  scoreMarker,
  scoreTotal,
} from "@/lib/health/health-score";

test("dentro l'intervallo vale 100, ovunque dentro", () => {
  assert.equal(scoreMarker(30, { low: 30, high: 100 }), 100, "il bordo basso è dentro");
  assert.equal(scoreMarker(65, { low: 30, high: 100 }), 100);
  assert.equal(scoreMarker(100, { low: 30, high: 100 }), 100, "il bordo alto è dentro");
});

test("fuori scende in proporzione a quanto è lontano", () => {
  // Vitamina D 30-100: la scala severa è 30 (il limite), non 70 (la larghezza).
  assert.equal(scoreMarker(15, { low: 30, high: 100 }), 50);
  assert.equal(scoreMarker(0, { low: 30, high: 100 }), 0, "zero vitamina D è zero punti");
});

test("una ferritina azzerata non se la cava con otto punti", () => {
  // Intervallo 24-336: largo 312. Con la sola larghezza, 0 varrebbe 92.
  assert.equal(scoreMarker(0, { low: 24, high: 336 }), 0);
  assert.equal(scoreMarker(12, { low: 24, high: 336 }), 50);
});

test("un'emoglobina a 10 su 13-17 è anemia, e si vede", () => {
  // Qui la scala severa è la larghezza (4), non il limite (13).
  assert.equal(scoreMarker(10, { low: 13, high: 17 }), 25);
});

test("non scende sotto zero per quanto sia lontano", () => {
  assert.equal(scoreMarker(10000, { low: 30, high: 100 }), 0);
});

test("un intervallo aperto da un lato si giudica sul lato che ha", () => {
  assert.equal(scoreMarker(3, { low: null, high: 5 }), 100, "«< 5» e vale 3");
  assert.equal(scoreMarker(5, { low: null, high: 5 }), 100);
  assert.equal(scoreMarker(10, { low: null, high: 5 }), 0, "il doppio del limite azzera");
  assert.equal(scoreMarker(7.5, { low: null, high: 5 }), 50);
});

test("senza intervallo non si giudica: il marcatore non entra nel conto", () => {
  assert.equal(scoreMarker(42, { low: null, high: null }), null);
  assert.equal(scoreMarker(Number.NaN, { low: 1, high: 2 }), null);
  assert.equal(scoreMarker(5, { low: 10, high: 10 }), null, "intervallo degenere");
});

const m = (field: string, value: number, low: number | null, high: number | null) => ({
  field,
  value,
  range: { low, high },
});

test("tutto nella norma: cento", () => {
  const a = scoreArea([m("hb", 15, 13, 17), m("ferritina", 97, 24, 336)]);
  assert.equal(a.score, 100);
  assert.equal(a.markerCount, 2);
  assert.equal(a.worst, null);
  assert.deepEqual(a.outOfRange, []);
});

test("UN valore fuori norma non sparisce dietro venti a posto", () => {
  const buoni = Array.from({ length: 20 }, (_, i) => m(`ok${i}`, 15, 13, 17));
  const conCarenza = scoreArea([...buoni, m("ferritina", 0, 24, 336)]);
  // Con la sola media sarebbe 95: «ottimo», mentre l'atleta è a zero di ferritina.
  assert.ok(conCarenza.score! < 60, `atteso sotto 60, ottenuto ${conCarenza.score}`);
  assert.equal(conCarenza.worst?.field, "ferritina");
  assert.equal(conCarenza.outOfRange.length, 1);
});

test("nessun marcatore utilizzabile: nessun punteggio, non uno inventato", () => {
  const a = scoreArea([]);
  assert.equal(a.score, null);
  assert.equal(a.markerCount, 0);
});

test("i marcatori senza intervallo non contano ma non rompono", () => {
  const a = scoreArea([m("hb", 15, 13, 17), m("neutrofili_pct", 53.2, null, null)]);
  assert.equal(a.score, 100);
  assert.equal(a.markerCount, 1, "solo quello con intervallo è entrato");
});

test("il totale usa la stessa regola sulle aree che esistono", () => {
  assert.equal(scoreTotal([100, 100]), 100);
  assert.equal(scoreTotal([100, 40]), 55, "media 70 e peggiore 40");
});

test("un'area senza dati non abbassa il totale", () => {
  assert.equal(scoreTotal([90, null, null]), 90);
  assert.equal(scoreTotal([null, null]), null);
});

test("legge valori e intervalli dal referto salvato", () => {
  const panel = {
    vlm_proposals: [
      { field: "ferritin", value: 97, reference_range: { low: 24, high: 336 } },
      { field: "vit_d", value: 31.5, reference_range: { low: 30, high: 100 } },
      { field: "neutrophils_pct", value: 53.2, reference_range: null },
    ],
  };
  const out = extractScorableMarkers(panel);
  assert.equal(out.length, 2, "quello senza intervallo resta fuori");
  assert.deepEqual(
    out.map((x) => x.field).sort(),
    ["ferritin", "vit_d"],
  );
});

test("legge anche dall'archivio di un referto già confermato", () => {
  const panel = {
    import: { vlm_proposals_archived: [{ field: "hb", value: 156, reference_range: { low: 135, high: 180 } }] },
  };
  assert.equal(extractScorableMarkers(panel).length, 1);
});

test("lo stesso marcatore in due liste si conta una volta sola", () => {
  const p = { field: "hb", value: 156, reference_range: { low: 135, high: 180 } };
  const panel = { vlm_proposals: [p], import: { vlm_proposals_archived: [p] } };
  assert.equal(extractScorableMarkers(panel).length, 1);
});

test("un referto vuoto o malformato non produce marcatori", () => {
  assert.deepEqual(extractScorableMarkers(null), []);
  assert.deepEqual(extractScorableMarkers({}), []);
  assert.deepEqual(extractScorableMarkers({ vlm_proposals: "non una lista" }), []);
});
