import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  env = parseEnv(p);
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) break;
}
if (!env?.NEXT_PUBLIC_SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\\[rn]/g, "").trim().replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY.replace(/\\[rn]/g, "").trim();
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function get(pathq) {
  const res = await fetch(`${base}/rest/v1/${pathq}`, { headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { ok: res.ok, status: res.status, json };
}

// 0) elenco profili (nome) per individuare Dognini e capire le colonne
const all = await get(`athlete_profiles?select=id,first_name,last_name,email,weight_kg&limit=200`);
console.log("== athlete_profiles status:", all.status, "==");
if (!Array.isArray(all.json)) {
  console.log("Risposta non-array:", JSON.stringify(all.json, null, 2));
  process.exit(0);
}
console.log(`Totale profili letti: ${all.json.length}`);
for (const a of all.json) {
  console.log(`- ${a.id} | ${a.first_name ?? ""} ${a.last_name ?? ""} | ${a.email ?? ""} | weight=${a.weight_kg ?? "NULL"}`);
}

const matches = all.json.filter((a) => {
  const blob = `${a.first_name ?? ""} ${a.last_name ?? ""} ${a.email ?? ""}`.toLowerCase();
  return blob.includes("dognini") || blob.includes("matteo");
});
console.log(`\n== match Dognini/Matteo: ${matches.length} ==`);

for (const a of matches) {
  const aid = a.id;
  console.log(`\n################ ${a.first_name ?? ""} ${a.last_name ?? ""} (${aid}) ################`);
  console.log(`weight_kg=${a.weight_kg ?? "NULL"}`);

  const pp = await get(
    `physiological_profiles?athlete_id=eq.${aid}&select=ftp_watts,lt1_watts,lt2_watts,v_lamax,vo2max_ml_min_kg,updated_at`,
  );
  console.log("-- physiological_profiles --");
  console.log(JSON.stringify(pp.json, null, 2));

  const runs = await get(`metabolic_lab_runs?athlete_id=eq.${aid}&select=section,created_at&order=created_at.desc&limit=10`);
  console.log("-- metabolic_lab_runs (ultimi 10) --");
  console.log(JSON.stringify(runs.json, null, 2));

  const exHead = { ...headers, Prefer: "count=exact" };
  const exRes = await fetch(`${base}/rest/v1/executed_workouts?athlete_id=eq.${aid}&select=id&limit=1`, { headers: exHead });
  console.log(`-- executed_workouts count-range: ${exRes.headers.get("content-range")}`);
  const exPow = await get(`executed_workouts?athlete_id=eq.${aid}&select=date,trace_summary&order=date.desc&limit=5`);
  if (Array.isArray(exPow.json)) {
    for (const w of exPow.json) {
      const ts = w.trace_summary ?? {};
      const hasPower = ts && (ts.average_power_w != null || ts.np_w != null || ts.power_avg_w != null || (ts.channels_available && ts.channels_available.power));
      console.log(`   ${w.date}: power=${hasPower ? "SI" : "no"}`);
    }
  }

  const p = Array.isArray(pp.json) && pp.json[0] ? pp.json[0] : null;
  const ftp = p?.ftp_watts ?? null;
  const vlamax = p?.v_lamax ?? null;
  const vo2 = p?.vo2max_ml_min_kg ?? null;
  const weight = a.weight_kg ?? null;
  const ftpPerKg = ftp != null && weight ? ftp / weight : null;
  const haveAny = ftpPerKg != null || vlamax != null || vo2 != null;
  console.log(`>>> ftp=${ftp ?? "NULL"} weight=${weight ?? "NULL"} ftpPerKg=${ftpPerKg ?? "NULL"} vLamax=${vlamax ?? "NULL"} vo2max=${vo2 ?? "NULL"}`);
  console.log(`>>> ETICHETTA ATTESA: ${haveAny ? "classificato" : "PROFILO IN DEFINIZIONE (tutti null)"}`);
  if (!haveAny && ftp != null && !weight) console.log(">>> CAUSA: FTP presente ma PESO mancante.");
}
