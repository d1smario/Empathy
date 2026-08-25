import assert from "node:assert/strict";
import test from "node:test";
import {
  chunkForFanOut,
  isPlausibleOverrideDate,
  nextMondayUTC,
  OVERRIDE_DATE_WINDOW_DAYS,
  selectWeeklyReplanTargets,
  weeklyReplanNotReady,
  summarizeWeeklyReplanFanOut,
  type WeeklyReplanFanOutItem,
} from "@/lib/nutrition/weekly-replan-dispatch";

test("nextMondayUTC: dal martedì del cron punta al lunedì della settimana DOPO", () => {
  // 11 ago 2026 è martedì; la settimana corrente parte il 10, quella da riscrivere il 17.
  assert.equal(nextMondayUTC(new Date("2026-08-11T05:00:00Z")), "2026-08-17");
});

test("nextMondayUTC: mai la settimana corrente, in nessun giorno della settimana", () => {
  const byDay: Record<string, string> = {
    "2026-08-10": "2026-08-17", // lunedì
    "2026-08-11": "2026-08-17", // martedì
    "2026-08-14": "2026-08-17", // venerdì
    "2026-08-16": "2026-08-17", // domenica (settimana ISO precedente)
    "2026-08-17": "2026-08-24", // lunedì successivo
  };
  for (const [today, expected] of Object.entries(byDay)) {
    assert.equal(nextMondayUTC(new Date(`${today}T05:00:00Z`)), expected, `giorno ${today}`);
  }
});

test("nextMondayUTC: regge il cambio di mese e di anno", () => {
  assert.equal(nextMondayUTC(new Date("2026-12-29T05:00:00Z")), "2027-01-04"); // martedì
  assert.equal(nextMondayUTC(new Date("2026-01-27T05:00:00Z")), "2026-02-02");
});

test("isPlausibleOverrideDate: il percorso normale del cron passa (oggi e la settimana bersaglio)", () => {
  const today = "2026-08-11";
  assert.equal(isPlausibleOverrideDate(today, today), true);
  assert.equal(isPlausibleOverrideDate(nextMondayUTC(new Date(`${today}T05:00:00Z`)), today), true);
  // Rilancio a mano del martedì saltato: indietro di una settimana, resta legittimo.
  assert.equal(isPlausibleOverrideDate("2026-08-04", today), true);
});

test("isPlausibleOverrideDate: l'anno sbagliato a mano non arriva a materializzare pianificazione", () => {
  const today = "2026-08-11";
  assert.equal(isPlausibleOverrideDate("2027-08-11", today), false); // anno
  assert.equal(isPlausibleOverrideDate("2026-01-11", today), false); // mese
  assert.equal(isPlausibleOverrideDate("2025-12-31", today), false);
});

test("isPlausibleOverrideDate: il bordo della finestra è incluso, il giorno dopo no", () => {
  const today = "2026-08-11";
  assert.equal(OVERRIDE_DATE_WINDOW_DAYS, 21);
  assert.equal(isPlausibleOverrideDate("2026-09-01", today), true); // +21
  assert.equal(isPlausibleOverrideDate("2026-09-02", today), false); // +22
  assert.equal(isPlausibleOverrideDate("2026-07-21", today), true); // -21
  assert.equal(isPlausibleOverrideDate("2026-07-20", today), false); // -22
});

test("isPlausibleOverrideDate: forma sbagliata o data inesistente ⇒ rifiutata, non 'rotolata'", () => {
  const today = "2026-02-25";
  assert.equal(isPlausibleOverrideDate("2026-02-31", today), false); // rotolerebbe sul 3 marzo
  assert.equal(isPlausibleOverrideDate("2026-2-5", today), false);
  assert.equal(isPlausibleOverrideDate("11/08/2026", today), false);
  assert.equal(isPlausibleOverrideDate("", today), false);
  assert.equal(isPlausibleOverrideDate("2026-02-24", "non-una-data"), false);
});

test("selectWeeklyReplanTargets: tiene solo chi ha diritto d'uso, senza allargare la platea", () => {
  const targets = selectWeeklyReplanTargets(["a", "b", "c"], new Set(["a", "c", "z"]));
  assert.deepEqual(targets, ["a", "c"]);
});

test("selectWeeklyReplanTargets: deduplica — un id ripetuto sarebbe una doppia scrittura sullo stesso giorno", () => {
  const targets = selectWeeklyReplanTargets(["a", "a", " a ", "b"], new Set(["a", "b"]));
  assert.deepEqual(targets, ["a", "b"]);
});

test("selectWeeklyReplanTargets: scarta stringhe vuote e nessun entitled ⇒ nessun bersaglio", () => {
  assert.deepEqual(selectWeeklyReplanTargets(["", "  ", "a"], new Set(["a"])), ["a"]);
  assert.deepEqual(selectWeeklyReplanTargets(["a", "b"], new Set<string>()), []);
});

test("selectWeeklyReplanTargets: il filtro PRONTEZZA tiene fuori chi non ha il peso — meglio nessun piano che un piano su 70 kg inventati", () => {
  const entitled = new Set(["a", "b", "c"]);
  const ready = new Set(["a", "c"]);
  assert.deepEqual(selectWeeklyReplanTargets(["a", "b", "c"], entitled, ready), ["a", "c"]);
  // Senza il set di prontezza il comportamento è quello storico: nessun filtro.
  assert.deepEqual(selectWeeklyReplanTargets(["a", "b", "c"], entitled), ["a", "b", "c"]);
});

test("weeklyReplanNotReady: chi ha diritto e non è pronto NON sparisce — è l'elenco da riportare", () => {
  const entitled = new Set(["a", "b", "c"]);
  const ready = new Set(["a"]);
  // b e c pagano e non ricevono nulla: senza questo elenco restano fermi per mesi
  // (25 ago 2026: 13 abbonati senza peso, il più vecchio iscritto da 127 giorni).
  assert.deepEqual(weeklyReplanNotReady(["a", "b", "c"], entitled, ready), ["b", "c"]);
  // Chi non ha diritto non è «non pronto»: non è affare di questo elenco.
  assert.deepEqual(weeklyReplanNotReady(["a", "z"], entitled, ready), []);
  // Bersagli e non-pronti sono una PARTIZIONE degli aventi diritto: nessuno si perde.
  const cands = ["a", "b", "c", "z", "", " a "];
  const t = selectWeeklyReplanTargets(cands, entitled, ready);
  const n = weeklyReplanNotReady(cands, entitled, ready);
  assert.equal(t.length + n.length, 3);
  assert.deepEqual([...t, ...n].sort(), ["a", "b", "c"]);
});

test("chunkForFanOut: con la platea sotto il limite parte UN solo gruppo (tutte le fetch nello stesso tick)", () => {
  const ids = Array.from({ length: 12 }, (_, i) => `atleta-${i}`);
  const groups = chunkForFanOut(ids, 24);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].length, 12);
});

test("chunkForFanOut: oltre il limite spezza in gruppi, senza perdere né duplicare nessuno", () => {
  const ids = Array.from({ length: 53 }, (_, i) => `atleta-${i}`);
  const groups = chunkForFanOut(ids, 24);
  assert.deepEqual(groups.map((g) => g.length), [24, 24, 5]);
  assert.deepEqual(groups.flat(), ids);
});

test("chunkForFanOut: lista vuota ⇒ nessun gruppo; size degenere ⇒ gruppi da 1 (mai loop infinito)", () => {
  assert.deepEqual(chunkForFanOut([], 24), []);
  assert.deepEqual(chunkForFanOut(["a", "b"], 0), [["a"], ["b"]]);
});

test("summarizeWeeklyReplanFanOut: conta atleti serviti, giorni scritti e cosa è fallito", () => {
  const items: WeeklyReplanFanOutItem[] = [
    { athleteId: "a", ok: true, days: 7, daysTotal: 7, status: 200 },
    { athleteId: "b", ok: true, days: 5, daysTotal: 7, status: 200 },
    { athleteId: "c", ok: false, days: 0, daysTotal: 7, status: 500, error: "persist: FK" },
  ];
  const s = summarizeWeeklyReplanFanOut(items);
  assert.equal(s.dispatched, 3);
  assert.equal(s.athletesOk, 2);
  assert.equal(s.athletesFailed, 1);
  assert.equal(s.daysWritten, 12);
  assert.equal(s.daysExpected, 21);
  assert.equal(s.unknown, 0);
  assert.deepEqual(s.failures, [{ athleteId: "c", error: "persist: FK" }]);
});

test("summarizeWeeklyReplanFanOut: risposta non arrivata ⇒ 'unknown', non un falso zero", () => {
  const items: WeeklyReplanFanOutItem[] = [
    { athleteId: "a", ok: true, days: 7, daysTotal: 7 },
    { athleteId: "b", ok: false, days: null, daysTotal: null, error: "The operation was aborted due to timeout" },
  ];
  const s = summarizeWeeklyReplanFanOut(items);
  assert.equal(s.unknown, 1);
  assert.equal(s.daysWritten, 7);
  assert.equal(s.daysExpected, 14); // il figlio senza risposta conta comunque 7 giorni attesi
  assert.equal(s.failures[0].error, "The operation was aborted due to timeout");
});

test("summarizeWeeklyReplanFanOut: un fallimento senza messaggio non resta muto", () => {
  const s = summarizeWeeklyReplanFanOut([{ athleteId: "a", ok: false, days: 0, daysTotal: 7, status: 502 }]);
  assert.equal(s.failures[0].error, "HTTP 502");
});

test("summarizeWeeklyReplanFanOut: ventaglio vuoto ⇒ riepilogo a zero, non un errore", () => {
  const s = summarizeWeeklyReplanFanOut([]);
  assert.deepEqual(s, { dispatched: 0, athletesOk: 0, athletesFailed: 0, daysWritten: 0, daysExpected: 0, unknown: 0, failures: [] });
});
