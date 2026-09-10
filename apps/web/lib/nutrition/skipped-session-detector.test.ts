import test from "node:test";
import assert from "node:assert/strict";
import {
  localMinutesFromIso,
  resolveSkippedPlannedIds,
  type ExecutedTraceForSkip,
} from "@/lib/nutrition/skipped-session-detector";

/** Seduta delle 18:00, un'ora, con la finestra già passata (adesso sono le 22:00). */
const seduta = { id: "p1", scheduledMin: 18 * 60, durationMin: 60 };
const ADESSO = 22 * 60;
const MARGINE = 90;

const run = (executed: ExecutedTraceForSkip[], planned = [seduta]) =>
  resolveSkippedPlannedIds({ planned, executed, nowLocalMin: ADESSO, marginMin: MARGINE });

test("nessuna traccia di allenamento: la seduta è saltata", () => {
  const { skippedIds } = run([]);
  assert.equal(skippedIds.has("p1"), true);
});

test("esecuzione collegata: non è saltata", () => {
  const { skippedIds, keptReasonById } = run([
    { plannedWorkoutId: "p1", startedAtMin: 18 * 60, durationMin: 60 },
  ]);
  assert.equal(skippedIds.size, 0);
  assert.equal(keptReasonById.get("p1"), "collegata");
});

test("IL CASO DEL 16 AGOSTO: esecuzione Garmin non collegata, nella finestra → non è saltata", () => {
  // Prima di questo fix la riduzione scattava e i pasti venivano tagliati a chi si era allenato.
  const { skippedIds, keptReasonById } = run([
    { plannedWorkoutId: null, startedAtMin: 18 * 60 + 20, durationMin: 75 },
  ]);
  assert.equal(skippedIds.size, 0);
  assert.equal(keptReasonById.get("p1"), "orario_compatibile");
});

test("esecuzione in ritardo entro la tolleranza: non è saltata", () => {
  const { skippedIds } = run([{ plannedWorkoutId: null, startedAtMin: 19 * 60 + 55, durationMin: 60 }]);
  assert.equal(skippedIds.size, 0);
});

test("attività del mattino e seduta della sera: la sera è saltata davvero", () => {
  const { skippedIds } = run([{ plannedWorkoutId: null, startedAtMin: 7 * 60, durationMin: 45 }]);
  assert.equal(skippedIds.has("p1"), true, "una corsa alle 7 non è la seduta delle 18");
});

test("esecuzione senza orario: nel dubbio non si dichiara nulla", () => {
  const { skippedIds, keptReasonById } = run([
    { plannedWorkoutId: null, startedAtMin: null, durationMin: null },
  ]);
  assert.equal(skippedIds.size, 0);
  assert.equal(keptReasonById.get("p1"), "esecuzione_senza_orario");
});

test("finestra non ancora passata: non si dichiara nulla", () => {
  const out = resolveSkippedPlannedIds({
    planned: [seduta],
    executed: [],
    nowLocalMin: 18 * 60 + 30,
    marginMin: MARGINE,
  });
  assert.equal(out.skippedIds.size, 0);
  assert.equal(out.keptReasonById.get("p1"), "finestra_non_passata");
});

test("orario della seduta ignoto: non si dichiara mai saltata", () => {
  const out = run([], [{ id: "p1", scheduledMin: null, durationMin: 60 }]);
  assert.equal(out.skippedIds.size, 0);
  assert.equal(out.keptReasonById.get("p1"), "orario_ignoto");
});

test("due sedute, una fatta e una no: solo la seconda è saltata", () => {
  const out = resolveSkippedPlannedIds({
    planned: [
      { id: "mattina", scheduledMin: 7 * 60, durationMin: 60 },
      { id: "sera", scheduledMin: 18 * 60, durationMin: 60 },
    ],
    executed: [{ plannedWorkoutId: null, startedAtMin: 7 * 60 + 10, durationMin: 55 }],
    nowLocalMin: ADESSO,
    marginMin: MARGINE,
  });
  assert.deepEqual([...out.skippedIds], ["sera"]);
});

test("il collegamento vale solo per la sua seduta, non per le altre", () => {
  const out = resolveSkippedPlannedIds({
    planned: [
      { id: "mattina", scheduledMin: 7 * 60, durationMin: 60 },
      { id: "sera", scheduledMin: 18 * 60, durationMin: 60 },
    ],
    executed: [{ plannedWorkoutId: "mattina", startedAtMin: null, durationMin: null }],
    nowLocalMin: ADESSO,
    marginMin: MARGINE,
  });
  assert.deepEqual([...out.skippedIds], ["sera"], "un'esecuzione collegata non è un'orfana senza orario");
});

test("localMinutesFromIso converte nel fuso dell'atleta", () => {
  assert.equal(localMinutesFromIso("2026-08-16T16:20:00.000Z", "Europe/Rome"), 18 * 60 + 20);
  assert.equal(localMinutesFromIso("2026-08-16T16:20:00.000Z", null), 16 * 60 + 20);
});

test("localMinutesFromIso non inventa un orario che non c'è", () => {
  assert.equal(localMinutesFromIso(null, "Europe/Rome"), null);
  assert.equal(localMinutesFromIso("", "Europe/Rome"), null);
  assert.equal(localMinutesFromIso("non-una-data", "Europe/Rome"), null);
});

test("fuso non valido: ripiega su UTC invece di perdere l'aggancio", () => {
  assert.equal(localMinutesFromIso("2026-08-16T16:20:00.000Z", "Marte/Olympus"), 16 * 60 + 20);
});
