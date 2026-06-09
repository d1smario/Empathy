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
  const e = parseEnv(p);
  if (e.NEXT_PUBLIC_SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) { env = e; break; }
}
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\\[rn]/g, "").trim().replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY.replace(/\\[rn]/g, "").trim();
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const nowIso = new Date().toISOString();

async function get(pathq) {
  const res = await fetch(`${base}/rest/v1/${pathq}`, { headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { ok: res.ok, status: res.status, json };
}

const AID = "1a0a63b8-29ad-48d1-b221-b645ee5b933d"; // matteo dognini athlete_id
console.log("NOW:", nowIso);

// 1) app_user_profiles per athlete_id (mapping user_id <-> athlete_id)
const prof = await get(`app_user_profiles?athlete_id=eq.${AID}&select=user_id,role,platform_coach_status,is_platform_admin,athlete_id,preferred_locale`);
console.log("\n== app_user_profiles (by athlete_id) ==");
console.log(JSON.stringify(prof.json, null, 2));

const rows = Array.isArray(prof.json) ? prof.json : [];
const userIds = rows.map((r) => r.user_id).filter(Boolean);

// fallback: cerca per email negli auth? non accessibile via REST. proviamo anche app_user_profiles by email mapping non disponibile.
if (userIds.length === 0) {
  console.log("\n!! Nessun app_user_profiles con athlete_id di Matteo. Il gate accesso (per user_id) non trova entitlement.");
}

for (const uid of userIds) {
  console.log(`\n################ user_id ${uid} ################`);
  const grants = await get(`subscription_grants?user_id=eq.${uid}&select=kind,starts_at,ends_at,revoked_at,note,created_at&order=created_at.desc`);
  console.log("-- subscription_grants (TUTTI) --");
  console.log(JSON.stringify(grants.json, null, 2));
  if (Array.isArray(grants.json)) {
    for (const g of grants.json) {
      const active = !g.revoked_at && g.starts_at <= nowIso && g.ends_at > nowIso;
      console.log(`   kind=${g.kind} starts=${g.starts_at} ends=${g.ends_at} revoked=${g.revoked_at ?? "no"} => ${active ? "ATTIVO" : "NON attivo"}`);
    }
  }
  const subs = await get(`billing_subscriptions?user_id=eq.${uid}&select=status,current_period_end,base_plan_id`);
  console.log("-- billing_subscriptions --");
  console.log(JSON.stringify(subs.json, null, 2));
}

// 2) eventuali grants orfani creati per email/altro user
console.log("\n== subscription_grants attivi totali (panoramica) ==");
const allG = await get(`subscription_grants?revoked_at=is.null&ends_at=gt.${nowIso}&select=user_id,kind,starts_at,ends_at&order=ends_at.desc&limit=50`);
console.log(JSON.stringify(allG.json, null, 2));
