import assert from "node:assert/strict";
import test from "node:test";
import { ATHLETE_HR_THRESHOLDS_UNAVAILABLE, athleteHrThresholdsFromProfile } from "@empathy/domain-training";
import type { ExecutedWorkout } from "@empathy/domain-training";
import { buildSessionDetailVM } from "./session-detail-summary";

const WORKOUT = {
  id: "w1",
  athleteId: "a1",
  date: "2026-05-16",
  source: "garmin",
  durationMinutes: 116,
  tss: 0,
  kj: 6502,
  kcal: 1554,
  traceSummary: { hr_avg_bpm: 142 },
} as ExecutedWorkout;

function carico(vm: ReturnType<typeof buildSessionDetailVM>): string {
  const tile = vm.kpi.find((t) => t.label === "Carico");
  assert.ok(tile, "la tile Carico deve esserci");
  return tile!.value;
}

test("buildSessionDetailVM: con la soglia dell'atleta il carico si calcola anche se tss = 0", () => {
  const vm = buildSessionDetailVM(WORKOUT, {
    athlete: athleteHrThresholdsFromProfile({ thresholdHrBpm: 168 }),
  });
  // 116' @142bpm, LTHR 168 → 1,9333h × (0,845)² × 100 = 138
  assert.equal(carico(vm), "138");
});

/**
 * R-carico #3 — prima di questo giro nessun lettore passava le soglie: la stessa riga
 * mostrava il ripiego per durata (40) come se fosse una misura.
 */
test("buildSessionDetailVM: senza soglie dell'atleta il carico è «—», non 40", () => {
  const vm = buildSessionDetailVM(WORKOUT, { athlete: ATHLETE_HR_THRESHOLDS_UNAVAILABLE });
  assert.equal(carico(vm), "—");
});

/**
 * Caso del revisore: riga senza `tss`, 85 minuti a FC 110, atleta con soglia 188.
 * I lettori mostravano 38 (ripiego durata) invece di 48 (hrTSS sull'atleta).
 */
test("buildSessionDetailVM: 85'@110bpm con soglia 188 → 48, non 38", () => {
  const vm = buildSessionDetailVM(
    { ...WORKOUT, durationMinutes: 85, traceSummary: { hr_avg_bpm: 110 } } as ExecutedWorkout,
    { athlete: athleteHrThresholdsFromProfile({ thresholdHrBpm: 188, maxHrBpm: 202 }) },
  );
  assert.equal(carico(vm), "48");
});
