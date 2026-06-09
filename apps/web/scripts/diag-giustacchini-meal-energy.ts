/**
 * Diagnostica kcal training → meal plan per un giorno.
 * npx tsx --tsconfig apps/web/tsconfig.json apps/web/scripts/diag-giustacchini-meal-energy.ts 2026-06-04
 */
import fs from "node:fs";
import path from "node:path";
import { computeNutritionDailyEnergyModel } from "../lib/nutrition/daily-energy-solver";
import { parsePro2BuilderSessionFromNotes } from "../lib/training/builder/pro2-session-notes";
import { resolvePlannedSessionMetrics } from "../lib/training/physiology/planned-session-metrics";

const DATE = process.argv[2] ?? "2026-06-04";
const AID = "bfacf0d5-6563-477a-8733-0a5146f04279";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const ln of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const i = ln.indexOf("=");
    if (i <= 0) continue;
    const key = ln.slice(0, i).trim();
    let v = ln.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    v = v.replace(/\r/g, "").replace(/\n/g, "").trim();
    if (!(key in process.env)) process.env[key] = v;
  }
}

function resolveMonorepoRoot(start: string): string {
  let dir = path.resolve(start);
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, "apps", "web"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(start);
}

const root = resolveMonorepoRoot(process.cwd());
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, "apps", "web", ".env.local"));

const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function get(q: string) {
  const res = await fetch(`${base}/rest/v1/${q}`, { headers });
  return res.json();
}

async function main() {
const prof = (await get(`athlete_profiles?id=eq.${AID}&select=weight_kg,height_cm,sex,birth_date,body_fat_pct`))[0] as Record<
  string,
  unknown
>;
const physLegacy = (await get(`physiological_profiles?athlete_id=eq.${AID}&select=ftp_watts,vo2max_ml_min_kg`)) as Record<
  string,
  unknown
>[];
const pw = (
  await get(
    `planned_workouts?athlete_id=eq.${AID}&date=eq.${DATE}&select=id,duration_minutes,tss_target,kcal_target,notes`,
  )
)[0] as Record<string, unknown>;

console.log("date:", DATE);
console.log("planned DB:", pw?.duration_minutes, "min | TSS", pw?.tss_target, "| kcal_target", pw?.kcal_target);
console.log("physiological_profiles row:", physLegacy[0] ?? "(none)");

const bs = parsePro2BuilderSessionFromNotes(String(pw?.notes ?? ""));
console.log("builder parsed:", Boolean(bs), "| blocks:", bs?.blocks?.length ?? 0, "| summary.durationSec:", bs?.summary?.durationSec);

for (const ftp of [null, Number(physLegacy[0]?.ftp_watts), 250, 300]) {
  const m = resolvePlannedSessionMetrics({
    contract: bs,
    durationMinutesDb: Number(pw?.duration_minutes) || 0,
    tssTargetDb: Number(pw?.tss_target) || 0,
    kcalTargetDb: Number(pw?.kcal_target) || 0,
    athleteFtpWatts: ftp,
  });
  console.log(`metrics FTP=${ftp ?? "null"} → ${m.durationMinutes}m TSS ${m.tss} kcal ${m.kcal}`);
}

const ftpUse = Number(physLegacy[0]?.ftp_watts) || null;
const m = resolvePlannedSessionMetrics({
  contract: bs,
  durationMinutesDb: Number(pw?.duration_minutes) || 0,
  tssTargetDb: Number(pw?.tss_target) || 0,
  kcalTargetDb: Number(pw?.kcal_target) || 0,
  athleteFtpWatts: ftpUse,
});

const model = computeNutritionDailyEnergyModel({
  athleteId: AID,
  date: DATE,
  birthDate: (prof?.birth_date as string) ?? null,
  sex: (prof?.sex as string) ?? null,
  heightCm: Number(prof?.height_cm) || null,
  weightKg: Number(prof?.weight_kg) || null,
  bodyFatPct: Number(prof?.body_fat_pct) || null,
  ftpWatts: ftpUse,
  plannedTraining: [{ durationMinutes: m.durationMinutes, kcalTarget: m.kcal, tssTarget: m.tss, avgPowerW: m.avgPowerW }],
  dietDayMealsScalePct: 100,
});

console.log("\nsolver → training.kcal:", model.training.kcal, "| mealsKcal:", model.totals.mealsKcal);
if (model.training.kcal === 0 && m.tss > 0) {
  console.log(">>> CAUSA PROBABILE: kcal seduta = 0 nel solver (FTP assente o kcal non derivate dal contratto).");
}
}

void main();
