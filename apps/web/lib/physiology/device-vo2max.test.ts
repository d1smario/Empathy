import test from "node:test";
import assert from "node:assert/strict";
import { extractDeviceVo2maxFromRows } from "@/lib/physiology/device-vo2max";

const userMetrics = (source: Record<string, unknown>, createdAt = "2026-09-09T17:12:53.945Z") => ({
  created_at: createdAt,
  payload: { sourcePayload: { garmin_wellness_stream: "userMetrics", ...source } },
});

test("prende il valore bici quando ci sono entrambi (default)", () => {
  const out = extractDeviceVo2maxFromRows([
    userMetrics({ vo2Max: 61, vo2MaxCycling: 58, calendarDate: "2026-09-09", fitnessAge: 28 }),
  ]);
  assert.equal(out?.mlMinKg, 58);
  assert.equal(out?.sport, "cycling");
  assert.equal(out?.measuredOn, "2026-09-09");
  assert.equal(out?.fitnessAge, 28);
  assert.equal(out?.enhanced, false);
});

test("ripiega sulla corsa se la bici manca", () => {
  const out = extractDeviceVo2maxFromRows([userMetrics({ vo2Max: 61, calendarDate: "2026-09-09" })]);
  assert.equal(out?.mlMinKg, 61);
  assert.equal(out?.sport, "running");
});

test("preferSport running inverte la precedenza", () => {
  const out = extractDeviceVo2maxFromRows([userMetrics({ vo2Max: 61, vo2MaxCycling: 58 })], {
    preferSport: "running",
  });
  assert.equal(out?.sport, "running");
  assert.equal(out?.mlMinKg, 61);
});

test("scarta i valori implausibili invece di mostrarli", () => {
  assert.equal(extractDeviceVo2maxFromRows([userMetrics({ vo2MaxCycling: 4 })]), null);
  assert.equal(extractDeviceVo2maxFromRows([userMetrics({ vo2MaxCycling: 480 })]), null);
  assert.equal(extractDeviceVo2maxFromRows([userMetrics({ vo2MaxCycling: null })]), null);
});

test("ignora gli stream che non sono userMetrics", () => {
  const rows = [
    { created_at: "2026-09-09T00:00:00Z", payload: { sourcePayload: { garmin_wellness_stream: "dailies", vo2MaxCycling: 58 } } },
  ];
  assert.equal(extractDeviceVo2maxFromRows(rows), null);
});

test("prende la riga più recente e non guarda oltre", () => {
  const out = extractDeviceVo2maxFromRows([
    userMetrics({ vo2MaxCycling: 58, calendarDate: "2026-09-09" }, "2026-09-09T00:00:00Z"),
    userMetrics({ vo2MaxCycling: 52, calendarDate: "2026-08-01" }, "2026-08-01T00:00:00Z"),
  ]);
  assert.equal(out?.mlMinKg, 58);
  assert.equal(out?.measuredOn, "2026-09-09");
});

test("salta le righe senza VO2max e continua a cercare", () => {
  const out = extractDeviceVo2maxFromRows([
    userMetrics({ fitnessAge: 30 }, "2026-09-09T00:00:00Z"),
    userMetrics({ vo2MaxCycling: 52, calendarDate: "2026-08-01" }, "2026-08-01T00:00:00Z"),
  ]);
  assert.equal(out?.mlMinKg, 52);
});

test("enhanced viene riportato, non interpretato", () => {
  const out = extractDeviceVo2maxFromRows([userMetrics({ vo2MaxCycling: 58, enhanced: true })]);
  assert.equal(out?.enhanced, true);
});
