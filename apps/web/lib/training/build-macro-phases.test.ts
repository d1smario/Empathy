import test from "node:test";
import assert from "node:assert/strict";
import { buildMacroPhases, macroTotalWeeks, type MacroPhaseType } from "./build-macro-phases";

const VALID: MacroPhaseType[] = ["base", "build", "refine", "peak", "deload", "second_peak"];

test("open-ended: arco base→build con scarichi, orizzonte di default", () => {
  const p = buildMacroPhases({ startDate: "2026-01-05" });
  assert.equal(macroTotalWeeks(p), 8);
  assert.ok(p.every((x) => VALID.includes(x.phase)));
  assert.ok(p.some((x) => x.phase === "base"));
  assert.ok(p.some((x) => x.phase === "deload")); // scarico piazzato, non "sempre carico"
});

test("goal-driven: finisce con refine + peak sulla gara", () => {
  const p = buildMacroPhases({ startDate: "2026-01-05", goalEventDate: "2026-04-06" }); // ~13 settimane
  const total = macroTotalWeeks(p);
  assert.ok(total >= 12 && total <= 14, `total=${total}`);
  assert.equal(p[p.length - 1]?.phase, "peak");
  assert.equal(p[p.length - 2]?.phase, "refine");
  assert.ok(p.some((x) => x.phase === "base"));
  assert.ok(p.some((x) => x.phase === "build"));
  assert.ok(p.some((x) => x.phase === "deload"));
});

test("scarico ogni ~4 settimane (mai troppo carico di fila)", () => {
  const p = buildMacroPhases({ startDate: "2026-01-05", openHorizonWeeks: 12 });
  // nessuna fase di carico contigua supera 3 settimane
  assert.ok(p.filter((x) => x.phase !== "deload").every((x) => x.weeks <= 3));
});

test("gara troppo vicina (<4 settimane): fallback open-ended", () => {
  const p = buildMacroPhases({ startDate: "2026-01-05", goalEventDate: "2026-01-19" }); // 2 sett
  assert.ok(macroTotalWeeks(p) >= 4);
});
