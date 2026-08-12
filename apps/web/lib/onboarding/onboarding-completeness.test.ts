import test from "node:test";
import assert from "node:assert/strict";
import {
  ONBOARDING_ITEMS,
  computeOnboardingCompleteness,
  itemsBlockingPlan,
  type OnboardingPlanKind,
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

/* ──────────────────────────────────────────────────────────────────────────────
 * `blocks`: quale piano vincola davvero una voce.
 * Il bug che chiudono: la pagina Nutrizione bloccava il piano ALIMENTARE su
 * «Giorni di allenamento/settimana» e «Durata max seduta», che nessuna riga di
 * lib/nutrition legge (li usa solo lib/training).
 * ────────────────────────────────────────────────────────────────────────────── */

/** FULL meno le chiavi indicate (per costruire mancanze mirate). */
function withoutKeys(keys: string[]): OnboardingSnapshot {
  const profile = { ...(FULL.profile ?? {}) } as Record<string, unknown>;
  for (const k of keys) profile[k] = null;
  return { ...FULL, profile };
}

test("voce che vincola SOLO il training non blocca la nutrizione", () => {
  const snap = withoutKeys(["training_days_per_week", "training_max_session_minutes"]);
  const r = computeOnboardingCompleteness(snap);

  // Onboarding invariato: restano obbligatori mancanti (sala d'attesa e cron D3 li vedono).
  assert.equal(r.planReady, false);
  assert.deepEqual(
    r.required.missing.map((i) => i.key).sort(),
    ["training_days_per_week", "training_max_session_minutes"],
  );

  // Nutrizione: nessun blocco. Training: entrambi.
  assert.deepEqual(itemsBlockingPlan(r.required.missing, "nutrition"), []);
  assert.equal(itemsBlockingPlan(r.required.missing, "training").length, 2);
});

test("voce che vincola la nutrizione blocca la nutrizione, e non l'altro dominio", () => {
  const snap = withoutKeys(["diet_type", "weight_kg", "training_days_per_week"]);
  const r = computeOnboardingCompleteness(snap);

  assert.deepEqual(
    itemsBlockingPlan(r.required.missing, "nutrition").map((i) => i.key).sort(),
    ["diet_type", "weight_kg"],
  );
  assert.deepEqual(
    itemsBlockingPlan(r.required.missing, "training").map((i) => i.key),
    ["training_days_per_week"],
  );
});

test("voce che vincola ENTRAMBI blocca in tutti e due i domini", () => {
  const both = [{ key: "ftp", blocks: ["training", "nutrition"] as readonly OnboardingPlanKind[] }];
  assert.equal(itemsBlockingPlan(both, "nutrition").length, 1);
  assert.equal(itemsBlockingPlan(both, "training").length, 1);
  // …e una voce che non vincola nulla non blocca mai (es. il device: il solver degrada a stima).
  const none = [{ key: "device", blocks: [] as readonly OnboardingPlanKind[] }];
  assert.equal(itemsBlockingPlan(none, "nutrition").length, 0);
  assert.equal(itemsBlockingPlan(none, "training").length, 0);
});

test("il caso reale dell'atleta: mancano SOLO i due campi training → nutrizione sbloccata", () => {
  // Fotografia dell'atleta 04968274 letta su prod: profilo pieno, device alimentato,
  // solo `training_days_per_week` e `training_max_session_minutes` a null.
  const snap: OnboardingSnapshot = {
    profile: {
      sex: "male", birth_date: "2006-10-03", timezone: "Europe/Rome",
      height_cm: 186, weight_kg: 73, body_fat_pct: 8,
      resting_hr_bpm: 40, max_hr_bpm: 204, goals: ["performance"], diet_type: "omnivore",
    },
    deviceConnected: true, deviceFed: true, hasFtp: false, hasBloodPanel: false,
  };
  const r = computeOnboardingCompleteness(snap);
  assert.equal(r.planReady, false); // onboarding NON completo: nulla è cambiato lì
  assert.deepEqual(itemsBlockingPlan(r.required.missing, "nutrition"), []); // …ma il piano alimentare parte
});

test("la sala d'attesa vede l'insieme COMPLETO: nessuna voce persa né spostata di categoria", () => {
  // Guardia anti-deriva: `blocks` è additivo, non deve toccare l'elenco dell'onboarding.
  assert.deepEqual(
    ONBOARDING_ITEMS.map((i) => `${i.key}:${i.category}`),
    [
      "sex:required",
      "birth_date:required",
      "timezone:required",
      "weight_kg:required",
      "height_cm:required",
      "body_fat_pct:recommended",
      "muscle_mass_kg:recommended",
      "resting_hr_bpm:required",
      "max_hr_bpm:required",
      "threshold_hr_bpm:recommended",
      "device:required",
      "goals:required",
      "training_days_per_week:required",
      "training_max_session_minutes:required",
      "diet_type:required",
      "preferred_meal_count:recommended",
      "food_constraints:recommended",
      "ftp:optional",
      "blood_panel:optional",
    ],
  );
  // Uno snapshot vuoto continua a mostrare TUTTI gli obbligatori, non i soli di un dominio.
  const empty = computeOnboardingCompleteness(EMPTY);
  assert.equal(empty.required.missing.length, REQUIRED_COUNT);
  assert.equal(REQUIRED_COUNT, 12);
});
