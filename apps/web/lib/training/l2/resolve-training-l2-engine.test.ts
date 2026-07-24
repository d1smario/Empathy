import assert from "node:assert/strict";
import test from "node:test";

import { resolveTrainingL2Engine } from "./resolve-training-l2-engine";

const ATH = "B0082091-1111-2222-3333-444455556666";

test("default: nessuna env → db (il flip non avviene mai per sbaglio)", () => {
  assert.equal(resolveTrainingL2Engine(ATH, {}), "db");
});

test("TRAINING_L2_ENGINE=builder → builder per tutti", () => {
  assert.equal(resolveTrainingL2Engine(ATH, { TRAINING_L2_ENGINE: "builder" }), "builder");
});

test("valori sporchi o 'db' espliciti → db", () => {
  assert.equal(resolveTrainingL2Engine(ATH, { TRAINING_L2_ENGINE: "db" }), "db");
  assert.equal(resolveTrainingL2Engine(ATH, { TRAINING_L2_ENGINE: "BUILDERx" }), "db");
  assert.equal(resolveTrainingL2Engine(ATH, { TRAINING_L2_ENGINE: " " }), "db");
});

test("allowlist: solo gli atleti in TRAINING_L2_BUILDER_ATHLETES (case-insensitive, csv sporco ok)", () => {
  const env = { TRAINING_L2_BUILDER_ATHLETES: ` ${ATH.toLowerCase()} , altro-id ` };
  assert.equal(resolveTrainingL2Engine(ATH, env), "builder");
  assert.equal(resolveTrainingL2Engine("altro-id", env), "builder");
  assert.equal(resolveTrainingL2Engine("estraneo", env), "db");
});

test("allowlist attiva anche con TRAINING_L2_ENGINE non-builder (QA isolato su utentetest)", () => {
  const env = { TRAINING_L2_ENGINE: "db", TRAINING_L2_BUILDER_ATHLETES: ATH };
  assert.equal(resolveTrainingL2Engine(ATH, env), "builder");
  assert.equal(resolveTrainingL2Engine("estraneo", env), "db");
});
