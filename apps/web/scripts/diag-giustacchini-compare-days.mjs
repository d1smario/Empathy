/**
 * Confronta risoluzione kcal / warning meal plan tra più date.
 * node apps/web/scripts/diag-giustacchini-compare-days.mjs 2026-06-04 2026-06-05 2026-06-06
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dates = process.argv.slice(2);
if (dates.length === 0) dates.push("2026-06-04", "2026-06-05", "2026-06-06");
const AID = "bfacf0d5-6563-477a-8733-0a5146f04279";
const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(here, "..");
const monoRoot = path.join(here, "..", "..", "..");

function parseEnvFile(p) {
  const env = {};
  for (const ln of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const i = ln.indexOf("=");
    if (i <= 0) continue;
    let v = ln.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[ln.slice(0, i).trim()] = v;
  }
  return env;
}

const envCandidates = [
  path.join(monoRoot, "apps", "web", ".env.local"),
  path.join(monoRoot, ".env.local"),
];
let envFile = null;
for (const p of envCandidates) {
  if (!fs.existsSync(p)) continue;
  const e = parseEnvFile(p);
  if (e.NEXT_PUBLIC_SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) {
    envFile = e;
    break;
  }
}
if (!envFile) {
  console.error("Missing Supabase env");
  process.exit(1);
}
process.env.NEXT_PUBLIC_SUPABASE_URL = envFile.NEXT_PUBLIC_SUPABASE_URL.replace(/\\[rn]/g, "").trim();
process.env.SUPABASE_SERVICE_ROLE_KEY = envFile.SUPABASE_SERVICE_ROLE_KEY.replace(/\\[rn]/g, "").trim();

const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function get(q) {
  const res = await fetch(`${base}/rest/v1/${q}`, { headers });
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

const { parsePro2BuilderSessionFromNotes } = await import(
  pathToFileURL(path.join(webRoot, "lib/training/builder/pro2-session-notes.ts")).href
);
const { resolvePlannedSessionMetrics } = await import(
  pathToFileURL(path.join(webRoot, "lib/training/physiology/planned-session-metrics.ts")).href
);
const { computeNutritionDailyEnergyModel } = await import(
  pathToFileURL(path.join(webRoot, "lib/nutrition/daily-energy-solver.ts")).href
);

const prof = (await get(`athlete_profiles?id=eq.${AID}&select=weight_kg,height_cm,sex,birth_date,body_fat_pct`))?.[0];
const physLegacy = await get(`physiological_profiles?athlete_id=eq.${AID}&select=ftp_watts`);
const ftpLegacy = Array.isArray(physLegacy) ? physLegacy[0]?.ftp_watts : null;

// module API often uses memory — probe athlete_profiles routine + common memory path via API would need auth; use legacy + typical coach FTP from diag
let ftp = ftpLegacy;
console.log("profile weight_kg:", prof?.weight_kg, "| birth_date:", prof?.birth_date ?? "(missing)");
console.log("physiological_profiles ftp:", ftpLegacy ?? "(none)");
console.log("");

for (const DATE of dates) {
  const rows = await get(
    `planned_workouts?athlete_id=eq.${AID}&date=eq.${DATE}&select=duration_minutes,tss_target,kcal_target,notes`,
  );
  const pw = Array.isArray(rows) ? rows[0] : null;
  const bs = parsePro2BuilderSessionFromNotes(String(pw?.notes ?? ""));
  const m = resolvePlannedSessionMetrics({
    contract: bs,
    durationMinutesDb: Number(pw?.duration_minutes) || 0,
    tssTargetDb: Number(pw?.tss_target) || 0,
    kcalTargetDb: Number(pw?.kcal_target) || 0,
    athleteFtpWatts: ftp,
  });
  const plannedTraining = [{ durationMinutes: m.durationMinutes, kcalTarget: m.kcal, tssTarget: m.tss }];
  const modelNoFtp = computeNutritionDailyEnergyModel({
    athleteId: AID,
    date: DATE,
    birthDate: prof?.birth_date ?? null,
    sex: prof?.sex ?? null,
    heightCm: prof?.height_cm ?? null,
    weightKg: prof?.weight_kg ?? null,
    bodyFatPct: prof?.body_fat_pct ?? null,
    ftpWatts: null,
    lifestyleActivityClass: "moderate",
    plannedTraining,
  });
  const modelWithFtp = ftp
    ? computeNutritionDailyEnergyModel({
        athleteId: AID,
        date: DATE,
        birthDate: prof?.birth_date ?? null,
        sex: prof?.sex ?? null,
        heightCm: prof?.height_cm ?? null,
        weightKg: prof?.weight_kg ?? null,
        bodyFatPct: prof?.body_fat_pct ?? null,
        ftpWatts: ftp,
        lifestyleActivityClass: "moderate",
        plannedTraining,
      })
    : null;

  const pick = modelWithFtp ?? modelNoFtp;
  const lowWarn =
    pick.totals.mealsKcal < 900 &&
    pick.training.kcal >= 220 &&
    pick.totals.mealsKcal <= pick.training.kcal * 0.55;

  console.log("===", DATE, "===");
  console.log(
    "DB:",
    pw?.duration_minutes,
    "min | TSS",
    pw?.tss_target,
    "| builder:",
    Boolean(bs),
    "blocks:",
    bs?.blocks?.length ?? 0,
    "| summary kcal/kj:",
    bs?.summary?.kcal ?? "—",
    bs?.summary?.kj ?? "—",
  );
  console.log("resolvePlannedSessionMetrics → kcal:", m.kcal, "| TSS:", m.tss);
  console.log(
    "solver (FTP",
    ftp ?? "null",
    ") → training",
    pick.training.kcal,
    "kcal | meals",
    pick.totals.mealsKcal,
    "| lowMealsBudgetWarning:",
    lowWarn,
  );
  if (m.kcal === 0 && m.tss > 0) {
    const withTssFb = computeNutritionDailyEnergyModel({
      athleteId: AID,
      date: DATE,
      birthDate: prof?.birth_date ?? null,
      sex: prof?.sex ?? null,
      heightCm: prof?.height_cm ?? null,
      weightKg: prof?.weight_kg ?? null,
      bodyFatPct: prof?.body_fat_pct ?? null,
      ftpWatts: ftp,
      lifestyleActivityClass: "moderate",
      plannedTraining: [{ durationMinutes: m.durationMinutes, kcalTarget: 0, tssTarget: m.tss }],
    });
    console.log("  (con fix TSS fallback locale) → training", withTssFb.training.kcal, "meals", withTssFb.totals.mealsKcal);
  }
  console.log("");
}
