import assert from "node:assert/strict";
import test from "node:test";
import {
  decideHealthStagingConfirmation,
  HEALTH_STAGING_ATHLETE_ACCESS_REQUIRED_MESSAGE,
  HEALTH_STAGING_COACH_REQUIRED_MESSAGE,
  HEALTH_STAGING_SELF_VALIDATION_MESSAGE,
  type HealthStagingConfirmationCaller,
} from "./health-staging-confirmation-gate";

/**
 * Casi reali dal DB di produzione (progetto ggmpegwnzbrjkeiydwqu):
 * i 3 `biomarker_panels` con `values.import.vlm_confirmed_by` risultano confermati da utenti
 * con `role = "private"`, `is_platform_admin = false`, sul PROPRIO pannello — cioè dall'atleta,
 * mentre il contratto di prodotto (e la UI) dicono che la conferma spetta al coach.
 *
 * ⚠️ `app_user_profiles.role` NON è un fatto: la policy `app_user_profiles_update_own` lascia
 * l'UPDATE sulla propria riga e il trigger `app_user_profiles_protect_platform_fields`
 * (letto dal DB il 2026-09-08) protegge SOLO `is_platform_admin` e `platform_coach_status`.
 * Il fatto non falsificabile è `platform_coach_status = "approved"`: il trigger concede
 * all'utente la sola transizione private→coach con status `"pending"` e riscrive col valore
 * vecchio qualunque altro cambio di status. In produzione tutti e 4 i coach reali hanno
 * `platform_coach_status = "approved"`.
 */

const TARGET_ATHLETE = "b0082091-0000-4000-8000-000000000001";
const OTHER_ATHLETE = "b0082091-0000-4000-8000-0000000000ff";

/** Atleta «private» sul proprio pannello: canAccessAthleteData lo lascia passare (linked athlete). */
const athleteOnSelf: HealthStagingConfirmationCaller = {
  role: "private",
  isPlatformAdmin: false,
  platformCoachStatus: null,
  hasAthleteAccess: true,
  callerAthleteId: TARGET_ATHLETE,
  targetAthleteId: TARGET_ATHLETE,
};

/** Coach APPROVATO con riga in coach_athletes per QUESTO atleta. */
const coachOfAthlete: HealthStagingConfirmationCaller = {
  role: "coach",
  isPlatformAdmin: false,
  platformCoachStatus: "approved",
  hasAthleteAccess: true,
  callerAthleteId: OTHER_ATHLETE,
  targetAthleteId: TARGET_ATHLETE,
};

/** Platform admin: canAccessAthleteData concede ogni atleta (policy platform_admin_all). */
const platformAdmin: HealthStagingConfirmationCaller = {
  role: "private",
  isPlatformAdmin: true,
  platformCoachStatus: null,
  hasAthleteAccess: true,
  callerAthleteId: OTHER_ATHLETE,
  targetAthleteId: TARGET_ATHLETE,
};

/** Coach di un ALTRO atleta: è coach approvato, ma canAccessAthleteData nega questo target. */
const coachOfAnotherAthlete: HealthStagingConfirmationCaller = {
  role: "coach",
  isPlatformAdmin: false,
  platformCoachStatus: "approved",
  hasAthleteAccess: false,
  callerAthleteId: OTHER_ATHLETE,
  targetAthleteId: TARGET_ATHLETE,
};

test("atleta su se stesso → negato (la conferma referti è coach-only)", () => {
  const d = decideHealthStagingConfirmation(athleteOnSelf);
  assert.equal(d.allowed, false);
  assert.equal(d.allowed === false && d.status, 403);
});

test("atleta auto-promosso role=\"coach\" con status pending → NEGATO", () => {
  // Scalata reale: UPDATE sulla propria riga, `role` non è protetto dal trigger.
  // Lo status che l'utente riesce a ottenere è al massimo "pending", mai "approved".
  const selfPromoted: HealthStagingConfirmationCaller = {
    role: "coach",
    isPlatformAdmin: false,
    platformCoachStatus: "pending",
    hasAthleteAccess: true,
    callerAthleteId: TARGET_ATHLETE,
    targetAthleteId: TARGET_ATHLETE,
  };
  const d = decideHealthStagingConfirmation(selfPromoted);
  assert.equal(d.allowed, false, "role=coach senza approvazione non deve confermare referti");
  assert.equal(d.allowed === false && d.status, 403);
});

test("role=\"coach\" senza approvazione → negato per ogni status non «approved»", () => {
  for (const status of [null, "", "pending", "rejected", "revoked", "APPROVED_", "suspended"]) {
    const d = decideHealthStagingConfirmation({
      role: "coach",
      isPlatformAdmin: false,
      platformCoachStatus: status,
      hasAthleteAccess: true,
      callerAthleteId: OTHER_ATHLETE,
      targetAthleteId: TARGET_ATHLETE,
    });
    assert.equal(d.allowed, false, `platform_coach_status=${String(status)} non deve confermare`);
    assert.equal(d.allowed === false && d.code, "coach_role_required");
  }
});

test("coach approvato dell'atleta → permesso", () => {
  assert.deepEqual(decideHealthStagingConfirmation(coachOfAthlete), { allowed: true });
});

test("coach approvato che è anche l'atleta del referto → negato (auto-validazione)", () => {
  const coachOnOwnReport: HealthStagingConfirmationCaller = {
    role: "coach",
    isPlatformAdmin: false,
    platformCoachStatus: "approved",
    hasAthleteAccess: true,
    callerAthleteId: TARGET_ATHLETE,
    targetAthleteId: TARGET_ATHLETE,
  };
  const d = decideHealthStagingConfirmation(coachOnOwnReport);
  assert.equal(d.allowed, false, "nessuno valida il referto di se stesso");
  assert.equal(d.allowed === false && d.status, 403);
  assert.equal(d.allowed === false && d.code, "self_validation_forbidden");
  assert.equal(d.allowed === false && d.error, HEALTH_STAGING_SELF_VALIDATION_MESSAGE);
});

test("confronto athlete_id insensibile a maiuscole/spazi (uuid dal DB vs dal payload)", () => {
  const d = decideHealthStagingConfirmation({
    role: "coach",
    isPlatformAdmin: false,
    platformCoachStatus: "approved",
    hasAthleteAccess: true,
    callerAthleteId: `  ${TARGET_ATHLETE.toUpperCase()}  `,
    targetAthleteId: TARGET_ATHLETE,
  });
  assert.equal(d.allowed, false);
  assert.equal(d.allowed === false && d.code, "self_validation_forbidden");
});

test("athlete_id assente su un lato → l'auto-validazione non scatta per caso", () => {
  // Due null non sono «la stessa persona»: il gate di ruolo resta l'unico giudice.
  const d = decideHealthStagingConfirmation({
    role: "coach",
    isPlatformAdmin: false,
    platformCoachStatus: "approved",
    hasAthleteAccess: true,
    callerAthleteId: null,
    targetAthleteId: null,
  });
  assert.deepEqual(d, { allowed: true });
});

test("platform admin → permesso", () => {
  assert.deepEqual(decideHealthStagingConfirmation(platformAdmin), { allowed: true });
  assert.deepEqual(
    decideHealthStagingConfirmation({
      role: "coach",
      isPlatformAdmin: true,
      platformCoachStatus: "approved",
      hasAthleteAccess: true,
      callerAthleteId: OTHER_ATHLETE,
      targetAthleteId: TARGET_ATHLETE,
    }),
    { allowed: true },
  );
});

test("platform admin sul PROPRIO referto → negato (l'auto-validazione non ha eccezioni)", () => {
  const d = decideHealthStagingConfirmation({
    role: "private",
    isPlatformAdmin: true,
    platformCoachStatus: null,
    hasAthleteAccess: true,
    callerAthleteId: TARGET_ATHLETE,
    targetAthleteId: TARGET_ATHLETE,
  });
  assert.equal(d.allowed, false);
  assert.equal(d.allowed === false && d.code, "self_validation_forbidden");
});

test("coach di un ALTRO atleta → negato (il ruolo non sostituisce canAccessAthleteData)", () => {
  const d = decideHealthStagingConfirmation(coachOfAnotherAthlete);
  assert.equal(d.allowed, false);
  assert.equal(d.allowed === false && d.status, 403);
  assert.equal(d.allowed === false && d.code, "athlete_access_required");
  assert.equal(d.allowed === false && d.error, HEALTH_STAGING_ATHLETE_ACCESS_REQUIRED_MESSAGE);
});

test("profilo senza ruolo / ruolo sconosciuto → negato", () => {
  for (const role of [null, "", "private", "athlete", "staff"]) {
    const d = decideHealthStagingConfirmation({
      role,
      isPlatformAdmin: false,
      platformCoachStatus: "approved",
      hasAthleteAccess: true,
      callerAthleteId: OTHER_ATHLETE,
      targetAthleteId: TARGET_ATHLETE,
    });
    assert.equal(d.allowed, false, `role=${String(role)} non deve poter confermare`);
    assert.equal(d.allowed === false && d.code, "coach_role_required");
  }
});

test("il messaggio di diniego dice cosa serve, non solo «vietato»", () => {
  const d = decideHealthStagingConfirmation({ ...athleteOnSelf, callerAthleteId: null });
  assert.equal(d.allowed === false && d.error, HEALTH_STAGING_COACH_REQUIRED_MESSAGE);
  assert.match(HEALTH_STAGING_COACH_REQUIRED_MESSAGE, /coach/i);
  assert.match(HEALTH_STAGING_COACH_REQUIRED_MESSAGE, /validazione/i);
  assert.match(HEALTH_STAGING_COACH_REQUIRED_MESSAGE, /approv/i);
  assert.ok(HEALTH_STAGING_COACH_REQUIRED_MESSAGE.length > 40);
});

test("admin senza accesso atleta (gate atleta fallito) → negato comunque", () => {
  const d = decideHealthStagingConfirmation({
    role: "coach",
    isPlatformAdmin: true,
    platformCoachStatus: "approved",
    hasAthleteAccess: false,
    callerAthleteId: OTHER_ATHLETE,
    targetAthleteId: TARGET_ATHLETE,
  });
  assert.equal(d.allowed, false);
  assert.equal(d.allowed === false && d.code, "athlete_access_required");
});
