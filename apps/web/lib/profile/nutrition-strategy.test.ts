import assert from "node:assert/strict";
import test from "node:test";
import {
  NUTRITION_STRATEGY_INTENSITIES,
  dayTypePctToStrategy,
  resolveWeekStrategy,
  strategyToDayTypePct,
  strategyToDayTypePreset,
  type NutritionStrategy,
} from "./nutrition-strategy";

const CANONICAL: ReadonlyArray<[NutritionStrategy, number]> = [
  [{ kind: "hypocaloric", intensityPct: 10 }, 90],
  [{ kind: "hypocaloric", intensityPct: 5 }, 95],
  [{ kind: "normocaloric", intensityPct: null }, 100],
  [{ kind: "hypercaloric", intensityPct: 5 }, 105],
  [{ kind: "hypercaloric", intensityPct: 10 }, 110],
];

test("scala del documento: normo→100, ipo 5→95, ipo 10→90, iper 5→105, iper 10→110", () => {
  for (const [strategy, pct] of CANONICAL) {
    assert.equal(strategyToDayTypePct(strategy), pct, `${strategy.kind} ${strategy.intensityPct}`);
  }
});

test("round-trip strategia → % → strategia su tutte le combinazioni ammesse", () => {
  for (const [strategy] of CANONICAL) {
    assert.deepEqual(dayTypePctToStrategy(strategyToDayTypePct(strategy)), strategy);
  }
});

test("round-trip % → strategia → %", () => {
  for (const [, pct] of CANONICAL) {
    assert.equal(strategyToDayTypePct(dayTypePctToStrategy(pct)), pct);
  }
});

test("intensità ammesse: solo 5 e 10", () => {
  assert.deepEqual([...NUTRITION_STRATEGY_INTENSITIES], [5, 10]);
});

test("normocalorico ignora l'intensità (100 comunque)", () => {
  assert.equal(strategyToDayTypePct({ kind: "normocaloric", intensityPct: 10 }), 100);
  assert.equal(strategyToDayTypePct({ kind: "normocaloric", intensityPct: null }), 100);
});

test("intensità mancante su ipo/iper → scarto minimo 5%", () => {
  assert.equal(strategyToDayTypePct({ kind: "hypocaloric", intensityPct: null }), 95);
  assert.equal(strategyToDayTypePct({ kind: "hypercaloric", intensityPct: null }), 105);
});

test("percentuali legacy fuori scala: snap alla combinazione canonica più vicina", () => {
  // Preset legacy mai usati in produzione (tutte le righe valgono 100).
  assert.deepEqual(dayTypePctToStrategy(0), { kind: "hypocaloric", intensityPct: 10 }); // fasting-0
  assert.deepEqual(dayTypePctToStrategy(75), { kind: "hypocaloric", intensityPct: 10 }); // catabolic
  assert.deepEqual(dayTypePctToStrategy(115), { kind: "hypercaloric", intensityPct: 10 }); // anabolic
  assert.deepEqual(dayTypePctToStrategy(103), { kind: "hypercaloric", intensityPct: 5 });
  // Parità → vince il più prudente (il più basso), primo in ordine crescente.
  assert.deepEqual(dayTypePctToStrategy(92.5), { kind: "hypocaloric", intensityPct: 10 });
});

test("valori non numerici → normocalorico (nessuna eccezione: la UI deve poter renderizzare)", () => {
  for (const bad of [null, undefined, "", "abc", NaN, {}, []]) {
    assert.deepEqual(dayTypePctToStrategy(bad), { kind: "normocaloric", intensityPct: null });
  }
  // Le stringhe numeriche invece sono tollerate (JSONB può restituire "95").
  assert.deepEqual(dayTypePctToStrategy("95"), { kind: "hypocaloric", intensityPct: 5 });
});

test("settimana uniforme → quella strategia; settimana vuota → normocalorico", () => {
  assert.deepEqual(resolveWeekStrategy(Array(7).fill(100)), { kind: "normocaloric", intensityPct: null });
  assert.deepEqual(resolveWeekStrategy(Array(7).fill(90)), { kind: "hypocaloric", intensityPct: 10 });
  assert.deepEqual(resolveWeekStrategy([]), { kind: "normocaloric", intensityPct: null });
});

test("settimana legacy disomogenea → vince la percentuale più frequente", () => {
  assert.deepEqual(resolveWeekStrategy([100, 105, 105, 105, 105, 100, 105]), {
    kind: "hypercaloric",
    intensityPct: 5,
  });
  // A parità di frequenza vince la prima incontrata (deterministico).
  assert.deepEqual(resolveWeekStrategy([95, 110]), { kind: "hypocaloric", intensityPct: 5 });
});

test("preset day_type coerente con la strategia (campo inerte, tenuto allineato)", () => {
  assert.equal(strategyToDayTypePreset({ kind: "hypocaloric", intensityPct: 5 }), "catabolic-50-99");
  assert.equal(strategyToDayTypePreset({ kind: "normocaloric", intensityPct: null }), "normocaloric-100");
  assert.equal(strategyToDayTypePreset({ kind: "hypercaloric", intensityPct: 10 }), "anabolic-101-130");
});
