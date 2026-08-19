/**
 * Tre sedute reali di `planned_workouts` (caso QA utentetest 19 ago: 90/180/240 min, notes in
 * testo libero senza contratto Builder, FTP mai misurato, peso 74) attraversano il percorso
 * VERO del motore: mapping riga→sessione di `prepareIntelligentMealPlanContext`
 * (resolvePlannedSessionMetrics + sanitizeAvgPowerW + fallback 0,75×FTP), fabbisogno V2
 * (`buildDailyNutritionRequirementsV2`) e day-engine (`computeDayEngineDay`).
 *
 * Invariante: una seduta reale È una seduta — entra nel consumo (trainingKcal > 0, consumoKcal
 * sopra il giorno di riposo) e nel fueling (intraChoG/fuelingChoG > 0) QUALUNQUE sia la sua
 * durata/kcal; nessuna delle tre sparisce. Il guasto di prod (25 e 27 «a riposo», 29 giusto) NON
 * stava qui ma nella lettura DB servita dalla Data Cache di Next (vedi lib/supabase/no-store-fetch.ts):
 * questo test blinda che il modello, ricevute le righe, le conta tutte e tre.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  buildDailyNutritionRequirementsV2,
  sanitizeAvgPowerW,
} from "@/lib/nutrition/v2/daily-nutrition-requirements";
import { computeDayEngineDay } from "@/lib/nutrition/v2/day-engine-integration";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import { resolvePlannedSessionMetrics } from "@/lib/training/physiology/planned-session-metrics";

const ATHLETE = "20529424-61d7-47c8-84df-9e9b221aaa49";
const WEIGHT_KG = 74;
const BODY_FAT_PCT = 12;
/** FTP non misurato → default motore (identico a route-prep: `ftpMeasuredW ?? 250`). */
const FTP_DEFAULT = 250;

/** Righe ESATTE inserite in prod il 19 ago 16:40:07 UTC (select di route-prep: duration_minutes,type,notes,tss_target,kcal_target). */
const PLANNED_ROWS = [
  { date: "2026-08-25", duration_minutes: 90, type: "pro2_builder_aerobic", notes: "QA grammatica pasti (utentetest): seduta media", tss_target: "70.00", kcal_target: "900.00" },
  { date: "2026-08-27", duration_minutes: 180, type: "pro2_builder_aerobic", notes: "QA grammatica pasti (utentetest): seduta lunga", tss_target: "150.00", kcal_target: "1950.00" },
  { date: "2026-08-29", duration_minutes: 240, type: "pro2_builder_aerobic", notes: "QA grammatica pasti (utentetest): lungo weekend", tss_target: "185.00", kcal_target: "2450.00" },
] as const;

function makeRequest(planDate: string): IntelligentMealPlanRequest {
  return {
    athleteId: ATHLETE,
    planDate,
    dietType: "omnivore",
    intolerances: null,
    allergies: null,
    foodExclusions: null,
    foodPreferences: null,
    supplements: null,
    aggregateInhibitors: null,
    pathwayTimingLines: [],
    trainingDayLines: [],
    routineDigest: null,
    contextLines: [],
    mealPlanSolverMeta: { dailyMealsKcalTotal: 0, integrationLeverLines: [] },
    slots: [],
  };
}

/** Stesso mapping di intelligent-meal-plan-route-prep.ts (plannedSessions). */
function sessionFromRow(pr: (typeof PLANNED_ROWS)[number], idx: number) {
  const bs = parsePro2BuilderSessionFromNotes(pr.notes || null);
  const m = resolvePlannedSessionMetrics({
    contract: bs,
    durationMinutesDb: Number(pr.duration_minutes) || 0,
    tssTargetDb: Number(pr.tss_target) || 0,
    kcalTargetDb: Number(pr.kcal_target) || 0,
    athleteFtpWatts: FTP_DEFAULT,
  });
  const avgPowerPlausibleW = sanitizeAvgPowerW(m.avgPowerW, FTP_DEFAULT);
  return {
    contract: bs,
    session: {
      label: `${pr.type} #${idx + 1} · ${avgPowerPlausibleW ?? "?"}W · ${m.durationMinutes}min`,
      avgPowerW: avgPowerPlausibleW ?? Math.round(FTP_DEFAULT * 0.75),
      durationMin: m.durationMinutes,
    },
  };
}

function dayFor(planDate: string, sessions: Array<{ label: string; avgPowerW: number; durationMin: number }>) {
  const request = makeRequest(planDate);
  const requirements = buildDailyNutritionRequirementsV2({
    request,
    weightKg: WEIGHT_KG,
    ftpWatts: null,
    lifestyleActivityClass: "moderate",
    plannedSessions: sessions,
  });
  const dayEngine = computeDayEngineDay({
    mode: "on",
    requirements,
    request,
    dietDay: null,
    weightKg: requirements.weightKg,
    bodyFatPct: BODY_FAT_PCT,
    lifestyleActivityClass: "moderate",
    firstSessionStartMinutes: null,
  });
  return { requirements, dayEngine };
}

test("3 righe planned_workouts senza contratto Builder → 3 sessioni valide (durata vera, potenza 0,75×FTP)", () => {
  const mapped = PLANNED_ROWS.map(sessionFromRow);
  for (const [i, { contract, session }] of mapped.entries()) {
    assert.equal(contract, null, `riga ${i}: notes in testo libero, nessun contratto`);
    assert.equal(session.durationMin, PLANNED_ROWS[i]!.duration_minutes);
    assert.equal(session.avgPowerW, Math.round(FTP_DEFAULT * 0.75));
  }
});

test("consumo: ogni seduta entra nel trainingKcal; 90 min NON è sotto nessuna soglia", () => {
  const rest = dayFor("2026-08-24", []);
  assert.equal(rest.requirements.energy.trainingKcal, 0);
  assert.ok(rest.dayEngine.applicable && rest.dayEngine.consumoKcal != null);

  let prevKcal = 0;
  for (const [i, row] of PLANNED_ROWS.entries()) {
    const { session } = sessionFromRow(row, i);
    const { requirements, dayEngine } = dayFor(row.date, [session]);
    assert.ok(requirements.energy.trainingKcal > 0, `${row.date}: trainingKcal atteso > 0`);
    assert.ok(
      requirements.energy.trainingKcal > prevKcal,
      `${row.date}: il consumo deve crescere con la durata (${requirements.energy.trainingKcal} ≤ ${prevKcal})`,
    );
    prevKcal = requirements.energy.trainingKcal;
    assert.ok(dayEngine.applicable, `${row.date}: day-engine applicabile`);
    assert.ok(
      (dayEngine.consumoKcal ?? 0) > (rest.dayEngine.consumoKcal ?? 0),
      `${row.date}: consumoKcal ${dayEngine.consumoKcal} deve superare il giorno di riposo ${rest.dayEngine.consumoKcal}`,
    );
    assert.notEqual(dayEngine.dayClass, "recupero", `${row.date}: con seduta reale la classe non è «recupero»`);
  }
});

test("fueling: intraChoG/fuelingChoG > 0 per TUTTE e tre le sedute (anche la più corta)", () => {
  for (const [i, row] of PLANNED_ROWS.entries()) {
    const { session } = sessionFromRow(row, i);
    const { requirements, dayEngine } = dayFor(row.date, [session]);
    assert.ok(requirements.substrateFueling, `${row.date}: substrateFueling presente`);
    assert.equal(requirements.substrateFueling!.sessions.length, 1, `${row.date}: una sessione nel fueling`);
    assert.ok((requirements.substrateFueling!.totals.intraChoG ?? 0) > 0, `${row.date}: intraChoG > 0`);
    assert.ok(dayEngine.fuelingChoG > 0, `${row.date}: fuelingChoG day-engine > 0`);
  }
});

test("più sedute nello stesso giorno si ACCUMULANO (nessun sessions[0]/max/dedupe per type)", () => {
  const a = sessionFromRow(PLANNED_ROWS[0], 0).session; // 90 min
  const b = sessionFromRow(PLANNED_ROWS[1], 1).session; // 180 min, stesso type
  const solo90 = dayFor("2026-08-25", [a]).requirements;
  const solo180 = dayFor("2026-08-25", [b]).requirements;
  const both = dayFor("2026-08-25", [a, b]).requirements;
  assert.equal(both.substrateFueling!.sessions.length, 2);
  assert.ok(both.energy.trainingKcal > solo180.energy.trainingKcal, "consumo cumulato > seduta più lunga da sola");
  assert.ok(
    Math.abs(both.energy.trainingKcal - (solo90.energy.trainingKcal + solo180.energy.trainingKcal)) <= 2,
    "consumo cumulato ≈ somma delle due",
  );
  assert.ok(
    (both.substrateFueling!.totals.intraChoG ?? 0) >= (solo180.substrateFueling!.totals.intraChoG ?? 0),
    "fueling cumulato non sotto la seduta più lunga",
  );
});
