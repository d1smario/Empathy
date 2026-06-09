/**
 * Simula pipeline nutrition per 2026-05-31: dedupe + race detect + kcal da builder.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dedupePlannedWorkoutDbRows } from "../lib/training/planned/planned-workout-dedupe-fingerprint.ts";
import { parsePro2BuilderSessionFromNotes } from "../lib/training/builder/pro2-session-notes.ts";
import { effectivePlannedWorkoutNutritionMetrics } from "../lib/training/builder/pro2-session-notes.ts";
import {
  buildRacePreLunchDayContext,
  detectPrimaryRaceSessionForDay,
  mapPlannedSessionsForRaceDetection,
} from "../lib/nutrition/race-day-pre-race-lunch.ts";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
function parseEnv(p) {
  const raw = fs.readFileSync(p, "utf8");
  const env = {};
  for (const ln of raw.split(/\r?\n/)) {
    const i = ln.indexOf("=");
    if (i <= 0) continue;
    let v = ln.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[ln.slice(0, i).trim()] = v;
  }
  return env;
}
const env = parseEnv(path.join(root, "apps", "web", ".env.local"));
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\\[rn]/g, "").trim().replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY.replace(/\\[rn]/g, "").trim();
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const AID = "bfacf0d5-6563-477a-8733-0a5146f04279";

const raw = await fetch(
  `${base}/rest/v1/planned_workouts?athlete_id=eq.${AID}&date=eq.2026-05-31&select=id,type,date,duration_minutes,tss_target,kcal_target,notes,created_at`,
  { headers },
).then((r) => r.json());

const prof = await fetch(
  `${base}/rest/v1/athlete_profiles?id=eq.${AID}&select=routine_config`,
  { headers },
).then((r) => r.json());
const phys = await fetch(
  `${base}/rest/v1/physiological_profiles?athlete_id=eq.${AID}&select=ftp_watts`,
  { headers },
).then((r) => r.json());

let routineConfig = prof[0]?.routine_config;
if (typeof routineConfig === "string") routineConfig = JSON.parse(routineConfig);
const ftp = Number(phys[0]?.ftp_watts) || null;

console.log("RAW rows:", raw.length);
const deduped = dedupePlannedWorkoutDbRows(raw);
console.log("After dedupe:", deduped.length);
for (const r of deduped) {
  const bs = parsePro2BuilderSessionFromNotes(r.notes);
  const m = effectivePlannedWorkoutNutritionMetrics({
    durationMinutesDb: r.duration_minutes,
    tssTargetDb: r.tss_target,
    kcalTargetDb: r.kcal_target,
    builderSession: bs,
    athleteFtpWatts: ftp,
  });
  console.log(`  ${r.type} | ${bs?.sessionName ?? "?"} | ${m.durationMinutes}m TSS ${m.tss} kcal ${m.kcal}`);
}

const mapped = mapPlannedSessionsForRaceDetection(
  deduped.map((r) => {
    const bs = parsePro2BuilderSessionFromNotes(r.notes);
    return {
      duration_minutes: r.duration_minutes,
      type: r.type,
      notes: r.notes,
      plannedSessionName: bs?.sessionName,
      plannedAdaptationTarget: bs?.adaptationTarget,
      builderSession: bs,
    };
  }),
);
const race = detectPrimaryRaceSessionForDay({
  planDate: "2026-05-31",
  routineConfig,
  plannedSessions: mapped,
});
console.log("\nRace detect:", race);
const preLunch = buildRacePreLunchDayContext({
  weightKg: 67,
  planDate: "2026-05-31",
  routineConfig,
  plannedSessions: mapped,
});
console.log("Pre-race lunch ctx:", preLunch);

let sumKcal = 0;
let sumTss = 0;
for (const r of deduped) {
  const bs = parsePro2BuilderSessionFromNotes(r.notes);
  const m = effectivePlannedWorkoutNutritionMetrics({
    durationMinutesDb: r.duration_minutes,
    tssTargetDb: r.tss_target,
    kcalTargetDb: r.kcal_target,
    builderSession: bs,
    athleteFtpWatts: ftp,
  });
  sumKcal += m.kcal;
  sumTss += m.tss;
}
console.log("\nSolver training input (post-dedupe):", deduped.length, "sessioni, TSS tot", sumTss, "kcal tot", sumKcal);
