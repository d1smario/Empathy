/**
 * Diagnostica 2026-05-31 Nicola Giustacchini: RAW DB vs dedupe (stessa logica nutrition).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  dedupePlannedWorkoutDbRows,
  plannedWorkoutDedupeFingerprint,
} from "../lib/training/planned/planned-workout-dedupe-fingerprint.ts";
import { parsePro2BuilderSessionFromNotes } from "../lib/training/builder/pro2-session-notes.ts";

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

async function get(pathq) {
  const res = await fetch(`${base}/rest/v1/${pathq}`, { headers });
  return res.json();
}

const raw = await get(
  `planned_workouts?athlete_id=eq.${AID}&date=eq.2026-05-31&select=id,type,duration_minutes,tss_target,kcal_target,notes,created_at,date`,
);
console.log("RAW count:", raw.length);
for (const r of raw) {
  const bs = parsePro2BuilderSessionFromNotes(r.notes ?? null);
  console.log("\n---", r.id.slice(0, 8), r.type, `${r.duration_minutes}m`, `tss=${r.tss_target}`, `kcal=${r.kcal_target}`);
  console.log("  fingerprint:", plannedWorkoutDedupeFingerprint(r));
  console.log("  builder parse:", bs ? `${bs.sessionName ?? "?"} / ${bs.discipline ?? "?"}` : "NULL");
}

const deduped = dedupePlannedWorkoutDbRows(raw);
console.log("\n== AFTER dedupePlannedWorkoutDbRows ==");
console.log("count:", deduped.length);
for (const r of deduped) {
  const bs = parsePro2BuilderSessionFromNotes(r.notes ?? null);
  console.log(" -", r.type, bs?.sessionName ?? "?", `kcal=${r.kcal_target}`);
}
