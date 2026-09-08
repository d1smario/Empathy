import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePro2BuilderSessionContract } from "@/lib/training/library/library-item-from-contract";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

describe("importViryaWeekToLibrary contract gate", () => {
  const minimalContract: Pro2BuilderSessionContract = {
    version: 1,
    source: "virya",
    family: "aerobic",
    discipline: "Cycling",
    sessionName: "VIRYA · base · Cycling · Mon",
    adaptationTarget: "aerobic_endurance",
    phase: "base",
    plannedSessionDurationMinutes: 60,
    blocks: [],
    summary: { durationSec: 3600, tss: 45 },
  };

  it("accepts virya-sourced builder contracts", () => {
    assert.notEqual(parsePro2BuilderSessionContract(minimalContract), null);
  });
});
