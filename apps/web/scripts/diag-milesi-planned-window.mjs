/**
 * Diagnostica sedute pianificate per atleta (nome) — finestra date opzionale.
 * Uso: node apps/web/scripts/diag-milesi-planned-window.mjs
 *      node apps/web/scripts/diag-milesi-planned-window.mjs --from=2026-06-01 --to=2026-06-10
 */
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

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "1"];
  }),
);

const from = args.from ?? "2026-06-01";
const to = args.to ?? "2026-06-14";
const nameNeedle = (args.name ?? "milesi").toLowerCase();

const envPaths = [
  path.join(root, "apps", "web", ".env.local"),
  path.join(root, ".env.local"),
];
let env = {};
for (const p of envPaths) {
  if (!fs.existsSync(p)) continue;
  env = { ...env, ...parseEnv(p) };
}
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Manca NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local");
  process.exit(1);
}
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}` };

async function q(table, qs) {
  const r = await fetch(`${base}/rest/v1/${table}?${qs}`, { headers: h });
  return { status: r.status, data: await r.json() };
}

const athletes = await q(
  "athlete_profiles",
  `or=(first_name.ilike.%${nameNeedle}%,last_name.ilike.%${nameNeedle}%,email.ilike.%${nameNeedle}%)&select=id,first_name,last_name,email&limit=10`,
);

if (!Array.isArray(athletes.data) || athletes.data.length === 0) {
  console.log("Nessun atleta trovato per", nameNeedle);
  process.exit(1);
}

for (const a of athletes.data) {
  console.log(`\n=== ${a.first_name ?? ""} ${a.last_name ?? ""} <${a.email ?? ""}> id=${a.id} ===`);
  const planned = await q(
    "planned_workouts",
    `athlete_id=eq.${a.id}&date=gte.${from}&date=lte.${to}&select=id,date,type,duration_minutes,tss_target,created_at&order=date.asc`,
  );
  const rows = Array.isArray(planned.data) ? planned.data : [];
  console.log(`Planned ${from}…${to}: ${rows.length} righe`);
  const byDate = new Map();
  for (const r of rows) {
    const d = String(r.date).slice(0, 10);
    byDate.set(d, (byDate.get(d) ?? 0) + 1);
  }
  for (const d of [...byDate.keys()].sort()) {
    console.log(`  ${d}: ${byDate.get(d)} seduta/e`);
  }
  for (const day of ["2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07"]) {
    if (day < from || day > to) continue;
    const detail = await q(
      "planned_workouts",
      `athlete_id=eq.${a.id}&date=eq.${day}&select=id,date,type,duration_minutes,tss_target,notes`,
    );
    const list = Array.isArray(detail.data) ? detail.data : [];
    console.log(`\n  Dettaglio ${day}: ${list.length}`);
    for (const r of list) {
      const notes = typeof r.notes === "string" ? r.notes : "";
      const virya = notes.includes("[VIRYA:");
      const builder = notes.includes("BUILDER_SESSION_JSON");
      console.log(
        `    ${r.id} ${r.type} ${r.duration_minutes}min tss=${r.tss_target} virya=${virya} builder=${builder} notesLen=${notes.length}`,
      );
    }
  }
}
