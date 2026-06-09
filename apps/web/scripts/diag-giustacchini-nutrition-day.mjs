/**
 * Diagnostica nutrition + training per un giorno (Nicola Giustacchini).
 * Usage: node apps/web/scripts/diag-giustacchini-nutrition-day.mjs 2026-06-02
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATE = process.argv[2] ?? "2026-06-02";
const AID = "bfacf0d5-6563-477a-8733-0a5146f04279";

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

const envCandidates = [
  path.join(root, "apps", "web", ".env.local"),
  path.join(root, ".env.local"),
  path.join(root, ".env.local.production"),
];
let env = null;
for (const p of envCandidates) {
  if (!fs.existsSync(p)) continue;
  const e = parseEnv(p);
  if (e.NEXT_PUBLIC_SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) {
    env = e;
    break;
  }
}
if (!env) {
  console.error("Missing Supabase env (apps/web/.env.local)");
  process.exit(1);
}
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\\[rn]/g, "").trim().replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY.replace(/\\[rn]/g, "").trim();
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function get(pathq) {
  const res = await fetch(`${base}/rest/v1/${pathq}`, { headers });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _error: text.slice(0, 200), _status: res.status };
  }
}

function sessionNameFromNotes(notes) {
  const m = String(notes ?? "").match(/"sessionName"\s*:\s*"([^"]+)"/);
  return m?.[1] ?? null;
}

const prof = await get(`athlete_profiles?id=eq.${AID}&select=id,routine_config,weight_kg`);
const profName = await get(`athlete_profiles?id=eq.${AID}&select=*`);
if (Array.isArray(profName) && profName[0]) {
  const row = profName[0];
  const nameKeys = ["display_name", "full_name", "first_name", "last_name", "name"];
  for (const k of nameKeys) {
    if (row[k]) console.log("profile field", k, "=", row[k]);
  }
}
console.log("=== Nicola Giustacchini ===");
console.log("athlete_id:", AID);
console.log("date:", DATE);
console.log("profile:", [prof[0]?.display_name, prof[0]?.full_name, prof[0]?.first_name, prof[0]?.last_name].filter(Boolean).join(" ") || "?");
let routineConfig = prof[0]?.routine_config;
if (typeof routineConfig === "string") {
  try {
    routineConfig = JSON.parse(routineConfig);
  } catch {
    routineConfig = null;
  }
}
const wdLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const wd = wdLabels[new Date(`${DATE}T12:00:00`).getDay()] ?? "Tue";
console.log("week_plan weekday key:", wd);

if (routineConfig && typeof routineConfig === "object") {
  const wp = routineConfig.week_plan;
  if (wp && typeof wp === "object") {
    const day = wp[wd];
    console.log("\n=== routine_config.week_plan[" + wd + "] (race day?) ===");
    console.log(JSON.stringify(day, null, 2));
    if (day && typeof day === "object") {
      console.log("day_mode:", day.day_mode ?? "(missing)");
      console.log("training1_start:", day.training1_start_time ?? day.training_1?.start_time ?? "—");
      console.log("training1_duration:", day.training1_duration_minutes ?? "—");
      if (String(day.day_mode).toLowerCase() === "race") {
        console.log(">>> ROUTINE SEGNA GIORNATA GARA <<<");
        const w = Number(prof[0]?.weight_kg);
        const startStr = day.training1_start_time ?? "?";
        const [sh, sm] = String(startStr).split(":").map(Number);
        const raceMin = (sh || 0) * 60 + (sm || 0);
        const lunchMin = Math.max(6 * 60, raceMin - 3 * 60);
        const hhmm = (m) =>
          `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
        console.log("\n--- protocollo pre-gara (solver Empathy) ---");
        console.log("weight_kg:", prof[0]?.weight_kg ?? "(mancante → race lunch disattivato)");
        console.log("start gara (routine):", startStr, "| pranzo:", hhmm(lunchMin), "(start − 3 h)");
        if (Number.isFinite(w) && w >= 35) {
          console.log(
            `CHO pranzo ~${Math.round(w * 3)} g (3 g/kg) + grana 15–20 g + olio 15 g; resto da Diet profile`,
          );
        }
        console.log(
          "Calendario: la seduta può non dire 'gara' — day_mode=race basta per il meal plan pre-gara.",
        );
      }
    }
  } else {
    console.log("\nroutine_config.week_plan: MISSING");
  }
}

const planned = await get(
  `planned_workouts?athlete_id=eq.${AID}&date=eq.${DATE}&select=id,type,date,duration_minutes,tss_target,kcal_target,notes,created_at&order=created_at.asc`,
);
console.log("\n=== planned_workouts (raw DB) ===");
if (!Array.isArray(planned)) {
  console.log(planned);
} else {
  console.log("count:", planned.length);
  let sumTss = 0;
  let sumKcal = 0;
  for (const r of planned) {
    const tss = Number(r.tss_target) || 0;
    const kcal = Number(r.kcal_target) || 0;
    sumTss += tss;
    sumKcal += kcal;
    const name = sessionNameFromNotes(r.notes);
    console.log(
      `  ${r.id} | ${r.type} | ${name ?? "?"} | ${r.duration_minutes ?? "?"}m | TSS ${tss || "—"} | kcal ${kcal || "—"}`,
    );
    if (name) console.log(`    → session: ${name}`);
  }
  console.log("Σ TSS (raw, no dedupe):", sumTss, "| Σ kcal:", sumKcal);
  if (planned[0]?.notes) {
    const n = String(planned[0].notes);
    console.log("\nnotes preview (first 500 chars):");
    console.log(n.slice(0, 500));
  const m1 = n.match(/"sessionName"\s*:\s*"([^"]+)"/);
    const m2 = n.match(/sessionName%22%3A%22([^%"]+)%22/);
    const m3 = n.match(/sessionName['"]?\s*[:=]\s*['"]([^'"]+)['"]/i);
    console.log(
      "parsed sessionName:",
      m1?.[1] ?? (m2?.[1] ? decodeURIComponent(m2[1]) : null) ?? m3?.[1] ?? "(not found)",
    );
    const adapt = n.match(/adaptationTarget%22%3A%22([^%"]+)%22/) ?? n.match(/"adaptationTarget"\s*:\s*"([^"]+)"/);
    if (adapt?.[1]) console.log("adaptationTarget:", decodeURIComponent(adapt[1]));
  }
}

const nutExplicit = await get(
  `nutrition_plans?athlete_id=eq.${AID}&date=eq.${DATE}&select=date,kcal_target,carbs_g_target,proteins_g_target,fats_g_target,hydration_ml_target`,
);
console.log("\n=== nutrition_plans (override per data) ===");
console.log(JSON.stringify(nutExplicit, null, 2));

const nutRange = await get(
  `nutrition_plans?athlete_id=eq.${AID}&from_date=lte.${DATE}&to_date=gte.${DATE}&select=id,from_date,to_date,goal,constraints_snapshot&order=from_date.desc&limit=3`,
);
console.log("\n=== nutrition_plans (periodo attivo) ===");
console.log(JSON.stringify(nutRange, null, 2));

const constraints = await get(`nutrition_constraints?athlete_id=eq.${AID}&select=*`);
console.log("\n=== nutrition_constraints ===");
if (Array.isArray(constraints) && constraints[0]) {
  const c = constraints[0];
  console.log("goal:", c.goal, "| rows keys:", Object.keys(c).join(", "));
  let mp = c.meal_plan;
  if (typeof mp === "string") {
    try {
      mp = JSON.parse(mp);
    } catch {
      /* keep string */
    }
  }
  if (mp && typeof mp === "object") {
    console.log("meal_plan keys:", Object.keys(mp));
    if (mp.caloric_split) console.log("caloric_split meals:", Object.keys(mp.caloric_split));
  }
}

const diary = await get(
  `food_diary_entries?athlete_id=eq.${AID}&logged_on=eq.${DATE}&select=id,meal_slot,logged_on,status&limit=20`,
);
console.log("\n=== food_diary_entries ===");
console.log(JSON.stringify(diary, null, 2));

const weekday = new Date(DATE + "T12:00:00").toLocaleDateString("it-IT", { weekday: "long" });
console.log("\nWeekday (IT):", weekday);

console.log("\nDone. In app: Nutrition → data", DATE, "→ meal plan da solver training (nessun override nutrition_plans).");
