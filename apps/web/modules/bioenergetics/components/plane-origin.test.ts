import test from "node:test";
import assert from "node:assert/strict";
import { isEstimatedPlane } from "@/modules/bioenergetics/components/BioenergeticChannelChart";

test("modello e stima da input sono STIME", () => {
  assert.equal(isEstimatedPlane("model_continuous"), true);
  assert.equal(isEstimatedPlane("ai_from_inputs"), true);
});

test("stream del dispositivo e valore di laboratorio sono MISURATI", () => {
  assert.equal(isEstimatedPlane("measured_stream"), false);
  assert.equal(isEstimatedPlane("sparse_lab_hold"), false);
});
