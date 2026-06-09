/**
 * Cancella il `planned_workouts` di Timothy del 2026-05-29 (id d4900153...).
 * Quel record e' stato scritto col parser vecchio (target Z7 ovunque).
 * Dopo la cancellazione l'utente puo' reimportare lo stesso `2026-05-29_tracks.fit`
 * dalla UI: il parser nuovo (commit e2a11b0) decodifica correttamente i custom_target_value
 * con bias Garmin SDK +1000.
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
    v = v.replace(/\\n$/g, "").replace(/\s+$/g, "");
    env[ln.slice(0, i).trim()] = v;
  }
  return env;
}
let env = null;
for (const p of [path.join(root, ".env.local.production"), path.join(root, ".env.local"), path.join(root, "apps", "web", ".env.local")]) {
  if (fs.existsSync(p)) { env = parseEnv(p); if (env.NEXT_PUBLIC_SUPABASE_URL) break; }
}
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };

const ATHLETE = "c2bd27ec-3261-45fb-a9ff-a6dc7e9bc908";
const DATE = "2026-05-29";

/** Cerco PRIMA, mostro all'utente cosa sto per cancellare. */
const findUrl = `${base}/rest/v1/planned_workouts?athlete_id=eq.${ATHLETE}&date=eq.${DATE}&select=id,date,duration_minutes,type,created_at,notes`;
const rows = await (await fetch(findUrl, { headers })).json();
if (!Array.isArray(rows)) { console.error("query err:", rows); process.exit(1); }
console.log(`Trovati ${rows.length} planned_workouts per Timothy ${DATE}:`);
for (const r of rows) {
  const notesHead = typeof r.notes === "string" ? r.notes.slice(0, 60).replace(/\n/g, " ") : "";
  console.log(`  id=${r.id} type=${r.type} dur=${r.duration_minutes}m created=${r.created_at?.slice(0, 16)}`);
  console.log(`    notes head: ${notesHead}...`);
}

if (!rows.length) { console.log("\nNessun record da cancellare."); process.exit(0); }

if (!process.argv.includes("--apply")) {
  console.log(`\n[DRY-RUN] Lancia con --apply per cancellare.`);
  process.exit(0);
}

console.log(`\nDELETE in corso (--apply)...`);
const ids = rows.map((r) => `"${r.id}"`).join(",");
const delUrl = `${base}/rest/v1/planned_workouts?id=in.(${ids})`;
const dr = await fetch(delUrl, { method: "DELETE", headers });
if (!dr.ok) {
  console.error(`DELETE fallita: ${dr.status} ${await dr.text()}`);
  process.exit(1);
}
console.log(`Cancellate ${rows.length} righe planned. Ora reimporta il file dalla UI.`);
