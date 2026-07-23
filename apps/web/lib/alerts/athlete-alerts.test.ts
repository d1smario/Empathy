/**
 * Test logica pura alert event-driven (`tsx --test lib/alerts/athlete-alerts.test.ts`):
 * soglie sonno (0.8×target, fallback 8h) e training (over >130%, under <70%, TSS→durata,
 * nessun pianificato → nessun alert), derivazione target sonno da routine_config,
 * riconcilio LIFECYCLE delle kind di training (upsert la valutata + delete l'altra / entrambe),
 * riconcilio single-owner di plan_adjusted (adjustment attivi → payload {kinds, reasons} / null).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SLEEP_TARGET_HOURS,
  deriveSleepTargetHours,
  evaluateSleepAlert,
  evaluateTrainingAlert,
  hasActiveAdjustment,
  reconcileTrainingKinds,
  summarizePlanAdjustedAlert,
} from "@/lib/alerts/athlete-alerts";

test("evaluateSleepAlert: sotto l'80% del target scatta sleep_low", () => {
  const alert = evaluateSleepAlert({ sleepHours: 5.5, targetHours: 8 });
  assert.ok(alert);
  assert.equal(alert.kind, "sleep_low");
  assert.equal(alert.payload.sleep_hours, 5.5);
  assert.equal(alert.payload.target_hours, 8);
  assert.equal(alert.payload.threshold_hours, 6.4);
});

test("evaluateSleepAlert: sopra o alla soglia niente alert", () => {
  assert.equal(evaluateSleepAlert({ sleepHours: 6.4, targetHours: 8 }), null);
  assert.equal(evaluateSleepAlert({ sleepHours: 7.9, targetHours: 8 }), null);
});

test("evaluateSleepAlert: target mancante/invalido usa fallback 8h", () => {
  assert.equal(DEFAULT_SLEEP_TARGET_HOURS, 8);
  const alert = evaluateSleepAlert({ sleepHours: 6.3 }); // 6.3 < 6.4 = 0.8*8
  assert.ok(alert);
  assert.equal(alert.payload.target_hours, 8);
  assert.equal(evaluateSleepAlert({ sleepHours: 6.5, targetHours: null }), null);
  assert.equal(evaluateSleepAlert({ sleepHours: 6.3, targetHours: 0 })?.payload.target_hours, 8);
  assert.equal(evaluateSleepAlert({ sleepHours: 6.3, targetHours: Number.NaN })?.payload.target_hours, 8);
});

test("evaluateSleepAlert: senza ore misurate niente alert (caso sleep_missing, non sleep_low)", () => {
  assert.equal(evaluateSleepAlert({ sleepHours: null, targetHours: 8 }), null);
  assert.equal(evaluateSleepAlert({ sleepHours: undefined }), null);
  assert.equal(evaluateSleepAlert({ sleepHours: Number.NaN, targetHours: 8 }), null);
});

test("deriveSleepTargetHours: sleep_time/wake_time globali a cavallo di mezzanotte", () => {
  assert.equal(deriveSleepTargetHours({ sleep_time: "22:30", wake_time: "06:30" }), 8);
  assert.equal(deriveSleepTargetHours({ sleep_time: "23:00", wake_time: "07:30" }), 8.5);
  // Finestra diurna (turnista): 09:00 → 16:00 = 7h
  assert.equal(deriveSleepTargetHours({ sleep_time: "09:00", wake_time: "16:00" }), 7);
});

test("deriveSleepTargetHours: override per-giorno da week_plan (night_time/wake_time)", () => {
  const cfg = {
    sleep_time: "23:00",
    wake_time: "07:00",
    week_plan: { Sat: { night_time: "00:30", wake_time: "09:30" } },
  };
  // 2026-07-18 è sabato → 00:30→09:30 = 9h
  assert.equal(deriveSleepTargetHours(cfg, "2026-07-18"), 9);
  // 2026-07-15 è mercoledì → globali 23:00→07:00 = 8h
  assert.equal(deriveSleepTargetHours(cfg, "2026-07-15"), 8);
});

test("deriveSleepTargetHours: routine assente/illeggibile → fallback 8h", () => {
  assert.equal(deriveSleepTargetHours(null), 8);
  assert.equal(deriveSleepTargetHours(undefined), 8);
  assert.equal(deriveSleepTargetHours({}), 8);
  assert.equal(deriveSleepTargetHours({ sleep_time: "boh", wake_time: "07:00" }), 8);
  assert.equal(deriveSleepTargetHours({ sleep_time: "23:00" }), 8);
  // stessa ora → durata 0 → fallback
  assert.equal(deriveSleepTargetHours({ sleep_time: "07:00", wake_time: "07:00" }), 8);
});

test("evaluateTrainingAlert: TSS preferito quando entrambi presenti", () => {
  const over = evaluateTrainingAlert({ plannedTss: 100, executedTss: 140, plannedMin: 60, executedMin: 60 });
  assert.ok(over);
  assert.equal(over.kind, "training_over");
  assert.equal(over.payload.basis, "tss");
  assert.equal(over.payload.ratio, 1.4);

  const under = evaluateTrainingAlert({ plannedTss: 100, executedTss: 50, plannedMin: 60, executedMin: 60 });
  assert.ok(under);
  assert.equal(under.kind, "training_under");
  assert.equal(under.payload.basis, "tss");
});

test("evaluateTrainingAlert: bordi 130%/70% NON scattano (soglie strette)", () => {
  assert.equal(evaluateTrainingAlert({ plannedTss: 100, executedTss: 130 }), null);
  assert.equal(evaluateTrainingAlert({ plannedTss: 100, executedTss: 70 }), null);
  assert.equal(evaluateTrainingAlert({ plannedTss: 100, executedTss: 100 }), null);
});

test("evaluateTrainingAlert: senza TSS completo ricade sulla durata", () => {
  const over = evaluateTrainingAlert({ plannedTss: null, executedTss: 90, plannedMin: 60, executedMin: 90 });
  assert.ok(over);
  assert.equal(over.payload.basis, "duration");
  assert.equal(over.kind, "training_over");

  // TSS pianificato presente ma eseguito senza TSS → durata
  const viaDuration = evaluateTrainingAlert({ plannedTss: 100, executedTss: null, plannedMin: 100, executedMin: 30 });
  assert.ok(viaDuration);
  assert.equal(viaDuration.payload.basis, "duration");
  assert.equal(viaDuration.kind, "training_under");
});

test("evaluateTrainingAlert: nessun pianificato → nessun alert", () => {
  assert.equal(evaluateTrainingAlert({ plannedTss: null, executedTss: 120, plannedMin: null, executedMin: 90 }), null);
  assert.equal(evaluateTrainingAlert({ plannedTss: 0, executedTss: 120, plannedMin: 0, executedMin: 90 }), null);
  assert.equal(evaluateTrainingAlert({}), null);
});

test("evaluateTrainingAlert: eseguito 0 su pianificato presente → training_under", () => {
  const alert = evaluateTrainingAlert({ plannedTss: 100, executedTss: 0 });
  assert.ok(alert);
  assert.equal(alert.kind, "training_under");
  assert.equal(alert.payload.ratio, 0);
});

test("reconcileTrainingKinds: under → null cancella ENTRAMBE (2ª seduta fa rientrare il ratio)", () => {
  // 1ª seduta del giorno: ratio ~0.5 → training_under upsertato, l'altra kind ritirata.
  const first = reconcileTrainingKinds(evaluateTrainingAlert({ plannedTss: 100, executedTss: 50 }));
  assert.equal(first.upsert?.kind, "training_under");
  assert.deepEqual(first.delete, ["training_over"]);

  // 2ª seduta: totali rientrati → valutazione null → cancellate entrambe (via anche la riga stale).
  const second = reconcileTrainingKinds(evaluateTrainingAlert({ plannedTss: 100, executedTss: 100 }));
  assert.equal(second.upsert, null);
  assert.deepEqual(second.delete, ["training_over", "training_under"]);
});

test("reconcileTrainingKinds: transizione under → over SOSTITUISCE (upsert over + delete under)", () => {
  const over = reconcileTrainingKinds(evaluateTrainingAlert({ plannedTss: 100, executedTss: 140 }));
  assert.equal(over.upsert?.kind, "training_over");
  assert.deepEqual(over.delete, ["training_under"]);
});

test("reconcileTrainingKinds: nessun pianificato → valutazione null → ritiro di entrambe", () => {
  const r = reconcileTrainingKinds(evaluateTrainingAlert({ plannedTss: null, executedTss: 120 }));
  assert.equal(r.upsert, null);
  assert.deepEqual(r.delete, ["training_over", "training_under"]);
});

test("hasActiveAdjustment: attivo se almeno un extra è diverso da zero (riduzione = kcal negative)", () => {
  assert.equal(hasActiveAdjustment({ extra_kcal: 250, extra_carbs_g: 40, extra_water_ml: 500 }), true);
  assert.equal(hasActiveAdjustment({ extra_kcal: -300, extra_carbs_g: 0, extra_water_ml: 0 }), true);
  assert.equal(hasActiveAdjustment({ extra_kcal: 0, extra_carbs_g: 0, extra_water_ml: 350 }), true);
  assert.equal(hasActiveAdjustment({ extra_kcal: 0, extra_carbs_g: 0, extra_water_ml: 0 }), false);
  assert.equal(hasActiveAdjustment({ extra_kcal: null, extra_carbs_g: null, extra_water_ml: null }), false);
  assert.equal(hasActiveAdjustment({}), false);
  // Valori stringa dal DB numeric → coerenza col resto delle coercizioni
  assert.equal(hasActiveAdjustment({ extra_kcal: "150" }), true);
  assert.equal(hasActiveAdjustment({ extra_kcal: "boh" }), false);
});

test("summarizePlanAdjustedAlert: entrambe le kind attive → payload riassuntivo {kinds, reasons}", () => {
  const payload = summarizePlanAdjustedAlert([
    { kind: "reintegration", extra_kcal: 250, reason: "surplus post-allenamento" },
    { kind: "reduction", extra_kcal: -300, reason: "seduta saltata" },
  ]);
  assert.ok(payload);
  assert.deepEqual(payload.kinds, ["reduction", "reintegration"]); // ordinate: payload stabile
  // reasons ordinati alfabeticamente (payload deterministico a parità di righe DB)
  assert.deepEqual(payload.reasons, ["seduta saltata", "surplus post-allenamento"]);
});

test("summarizePlanAdjustedAlert: solo gli adjustment ATTIVI contano; nessuno attivo → null (ritiro)", () => {
  const payload = summarizePlanAdjustedAlert([
    { kind: "reintegration", extra_kcal: 250, reason: "surplus" },
    { kind: "reduction", extra_kcal: 0, extra_carbs_g: 0, extra_water_ml: 0, reason: "azzerata" },
  ]);
  assert.ok(payload);
  assert.deepEqual(payload.kinds, ["reintegration"]);
  assert.deepEqual(payload.reasons, ["surplus"]);

  assert.equal(summarizePlanAdjustedAlert([]), null);
  assert.equal(summarizePlanAdjustedAlert([{ kind: "reduction", extra_kcal: 0 }]), null);
});
