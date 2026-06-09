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

async function get(pathq) {
  const res = await fetch(`${base}/rest/v1/${pathq}`, { headers });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

const grantUserIds = [
  "74ec9c85-f5a3-43ad-88a5-21bd03f33174",
  "d6360e52-2036-48a7-9135-28f4a85d1a54",
  "753b6274-d20d-4170-8ea7-6c1bcb1d28c5",
  "dfea67a5-e97b-4d6d-b10e-14ef7498f2f6",
  "407922d4-691a-4dd1-bf1f-208f0268c321",
];
const inList = grantUserIds.map((x) => `"${x}"`).join(",");
const profs = await get(`app_user_profiles?user_id=in.(${inList})&select=user_id,athlete_id,role`);
console.log("== owners dei grant 6 mesi ==");
const arr = Array.isArray(profs) ? profs : [];
for (const p of arr) {
  let email = "(no athlete)";
  if (p.athlete_id) {
    const a = await get(`athlete_profiles?id=eq.${p.athlete_id}&select=first_name,last_name,email`);
    if (Array.isArray(a) && a[0]) email = `${a[0].first_name ?? ""} ${a[0].last_name ?? ""} <${a[0].email ?? ""}>`;
  }
  console.log(`user_id=${p.user_id} role=${p.role} athlete_id=${p.athlete_id ?? "NULL"} => ${email}`);
}

// cerca QUALSIASI athlete_profiles con email dognini (duplicati)
console.log("\n== athlete_profiles con email *dognini* ==");
const dup = await get(`athlete_profiles?email=ilike.*dognini*&select=id,first_name,last_name,email`);
console.log(JSON.stringify(dup, null, 2));

// cerca app_user_profiles multipli che mappano athlete dognini
const AID = "1a0a63b8-29ad-48d1-b221-b645ee5b933d";
console.log("\n== TUTTI gli app_user_profiles che puntano all'athlete_id di Matteo ==");
const allMap = await get(`app_user_profiles?athlete_id=eq.${AID}&select=user_id,role,athlete_id,created_at`);
console.log(JSON.stringify(allMap, null, 2));
