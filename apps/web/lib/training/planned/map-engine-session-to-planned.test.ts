import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapEngineSessionToPlannedRow } from "@/lib/training/planned/map-engine-session-to-planned";

describe("mapEngineSessionToPlannedRow", () => {
  it("perserves the calendar target date (not today)", () => {
    const row = mapEngineSessionToPlannedRow({
      athleteId: "athlete-1",
      date: "2026-05-27",
      session: {
        sport: "cycling",
        domain: "endurance",
        physiologicalTarget: "aerobic_base",
        goalLabel: "Test",
        blocks: [{ label: "Z2", durationMinutes: 60, intensityHint: "Z2" }],
        expectedLoad: { loadBand: "moderate", tssHint: 50 },
      },
    });
    assert.equal(row.date, "2026-05-27");
    assert.equal(row.athlete_id, "athlete-1");
  });
});
