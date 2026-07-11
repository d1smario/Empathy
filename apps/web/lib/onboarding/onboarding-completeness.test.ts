import test from "node:test";
import assert from "node:assert/strict";
import {
  ONBOARDING_ITEMS,
  computeOnboardingCompleteness,
  type OnboardingSnapshot,
} from "./onboarding-completeness";

const EMPTY: OnboardingSnapshot = {
  profile: null,
  deviceConnected: false,
  deviceFed: false,
  hasFtp: false,
  hasBloodPanel: false,
};

const FULL: OnboardingSnapshot = {
  profile: {
    sex: "male",
    birth_date: "1990-05-01",
    timezone: "Europe/Zurich",
    height_cm: 180,
    weight_kg: 74,
    body_fat_pct: 12,
    muscle_mass_kg: 36,
    resting_hr_bpm: 48,
    max_hr_bpm: 192,
    threshold_hr_bpm: 168,
    goals: ["performance"],
    training_days_per_week: 5,
    training_max_session_minutes: 120,
    diet_type: "onnivora",
    preferred_meal_count: 5,
    intolerances: ["lattosio"],
  },
  deviceConnected: true,
  deviceFed: true,
  hasFtp: true,
  hasBloodPanel: true,
};

const REQUIRED_COUNT = ONBOARDING_ITEMS.filter((i) => i.category === "required").length;

test("snapshot vuoto: nessun obbligatorio, piano non pronto, progresso 0", () => {
  const r = computeOnboardingCompleteness(EMPTY);
  assert.equal(r.planReady, false);
  assert.equal(r.progressPct, 0);
  assert.equal(r.required.done, 0);
  assert.equal(r.required.total, REQUIRED_COUNT);
  assert.equal(r.required.missing.length, REQUIRED_COUNT);
  assert.equal(r.recommended.done, 0);
  assert.equal(r.optional.done, 0);
});

test("snapshot completo: piano pronto, progresso 100, nessun mancante", () => {
  const r = computeOnboardingCompleteness(FULL);
  assert.equal(r.planReady, true);
  assert.equal(r.progressPct, 100);
  assert.equal(r.required.done, r.required.total);
  assert.equal(r.required.missing.length, 0);
  assert.ok(r.recommended.done > 0);
  assert.equal(r.optional.done, 2);
});

test("solo obbligatori presenti: piano pronto anche senza consigliati/opzionali", () => {
  const snap: OnboardingSnapshot = {
    profile: {
      sex: "female", birth_date: "1995-01-01", timezone: "Europe/Rome",
      height_cm: 168, weight_kg: 60, resting_hr_bpm: 52, max_hr_bpm: 188,
      goals: ["salute"], training_days_per_week: 3, training_max_session_minutes: 60,
      diet_type: "vegetariana",
    },
    deviceConnected: true, deviceFed: true, hasFtp: false, hasBloodPanel: false,
  };
  const r = computeOnboardingCompleteness(snap);
  assert.equal(r.planReady, true);
  assert.equal(r.progressPct, 100);
  assert.equal(r.recommended.done, 0);
  assert.equal(r.optional.done, 0);
});

test("device collegato ma NON alimentato non conta come completo", () => {
  const snap: OnboardingSnapshot = { ...FULL, deviceConnected: true, deviceFed: false };
  const r = computeOnboardingCompleteness(snap);
  assert.equal(r.planReady, false);
  assert.ok(r.required.missing.some((i) => i.key === "device"));
});

test("progresso parziale: metà obbligatori → planReady false, pct tra 0 e 100", () => {
  const snap: OnboardingSnapshot = {
    profile: { sex: "male", birth_date: "1988-03-03", timezone: "Europe/Zurich", height_cm: 175, weight_kg: 70 },
    deviceConnected: false, deviceFed: false, hasFtp: false, hasBloodPanel: false,
  };
  const r = computeOnboardingCompleteness(snap);
  assert.equal(r.planReady, false);
  assert.ok(r.progressPct > 0 && r.progressPct < 100);
  assert.equal(r.required.done, 5); // sex, birth_date, timezone, height, weight
});

test("valori zero/negativi non contano come presenti", () => {
  const snap: OnboardingSnapshot = {
    profile: { weight_kg: 0, height_cm: -5, resting_hr_bpm: 0, training_days_per_week: 0 },
    deviceConnected: false, deviceFed: false, hasFtp: false, hasBloodPanel: false,
  };
  const r = computeOnboardingCompleteness(snap);
  assert.equal(r.required.done, 0);
});

test("purezza: stesso input → stesso output", () => {
  assert.deepEqual(computeOnboardingCompleteness(FULL), computeOnboardingCompleteness(FULL));
});
