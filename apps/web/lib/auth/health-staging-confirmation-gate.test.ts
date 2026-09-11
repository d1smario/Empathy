import test from "node:test";
import assert from "node:assert/strict";
import {
  decideHealthStagingConfirmation,
  resolveStagingInsertedBy,
} from "@/lib/auth/health-staging-confirmation-gate";

const ATLETA = "11111111-1111-1111-1111-111111111111";
const COACH = "22222222-2222-2222-2222-222222222222";
const ALTRO = "33333333-3333-3333-3333-333333333333";

const base = { hasAthleteAccess: true, isPlatformAdmin: false };

test("l'atleta che ha inserito i propri valori li conferma", () => {
  const d = decideHealthStagingConfirmation({ ...base, callerUserId: ATLETA, insertedByUserId: ATLETA });
  assert.equal(d.allowed, true);
});

test("il coach che ha inserito i valori per il suo atleta li conferma", () => {
  const d = decideHealthStagingConfirmation({ ...base, callerUserId: COACH, insertedByUserId: COACH });
  assert.equal(d.allowed, true);
});

test("l'atleta non conferma i valori che ha inserito il coach", () => {
  const d = decideHealthStagingConfirmation({ ...base, callerUserId: ATLETA, insertedByUserId: COACH });
  assert.equal(d.allowed, false);
  if (!d.allowed) assert.equal(d.code, "not_the_inserter");
});

test("il coach non conferma i valori che ha inserito l'atleta", () => {
  const d = decideHealthStagingConfirmation({ ...base, callerUserId: COACH, insertedByUserId: ATLETA });
  assert.equal(d.allowed, false);
});

test("nemmeno l'amministratore conferma al posto di chi ha inserito", () => {
  const d = decideHealthStagingConfirmation({
    ...base,
    isPlatformAdmin: true,
    callerUserId: ALTRO,
    insertedByUserId: ATLETA,
  });
  assert.equal(d.allowed, false, "conferma chi inserisce, a prescindere da chi sia");
});

test("autore sconosciuto (revisione storica): solo l'amministratore la chiude", () => {
  const nessuno = decideHealthStagingConfirmation({ ...base, callerUserId: ATLETA, insertedByUserId: null });
  assert.equal(nessuno.allowed, false);
  if (!nessuno.allowed) assert.equal(nessuno.code, "inserter_unknown");
  const admin = decideHealthStagingConfirmation({ ...base, isPlatformAdmin: true, callerUserId: ALTRO, insertedByUserId: null });
  assert.equal(admin.allowed, true);
});

test("senza accesso all'atleta non si conferma, nemmeno se si è l'autore", () => {
  const d = decideHealthStagingConfirmation({
    hasAthleteAccess: false,
    isPlatformAdmin: false,
    callerUserId: COACH,
    insertedByUserId: COACH,
  });
  assert.equal(d.allowed, false);
  if (!d.allowed) assert.equal(d.code, "athlete_access_required");
});

test("il confronto fra id tollera maiuscole e spazi, mai il vuoto", () => {
  assert.equal(
    decideHealthStagingConfirmation({ ...base, callerUserId: ` ${ATLETA.toUpperCase()} `, insertedByUserId: ATLETA }).allowed,
    true,
  );
  assert.equal(decideHealthStagingConfirmation({ ...base, callerUserId: "", insertedByUserId: ATLETA }).allowed, false);
  assert.equal(decideHealthStagingConfirmation({ ...base, callerUserId: null, insertedByUserId: ATLETA }).allowed, false);
});

test("il messaggio di diniego dice a chi spetta, non solo «vietato»", () => {
  const d = decideHealthStagingConfirmation({ ...base, callerUserId: COACH, insertedByUserId: ATLETA });
  assert.ok(!d.allowed && /chi li ha inseriti/.test(d.error));
});

test("l'autore viene dalla colonna, con ripiego sul bundle per le revisioni vecchie", () => {
  assert.equal(resolveStagingInsertedBy({ created_by: ATLETA, candidate_bundle: { entered_by: COACH } }), ATLETA);
  assert.equal(resolveStagingInsertedBy({ created_by: null, candidate_bundle: { entered_by: COACH } }), COACH);
  assert.equal(resolveStagingInsertedBy({ created_by: null, candidate_bundle: null }), null);
  assert.equal(resolveStagingInsertedBy({ created_by: "  ", candidate_bundle: { entered_by: "" } }), null);
});
