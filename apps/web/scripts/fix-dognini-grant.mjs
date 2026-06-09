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
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const TARGET_USER_ID = "4a745af9-0779-4721-b780-c4e3fbe436aa"; // matteo dognini (private)
const KIND = "testimonial";
const MONTHS = 6;
const NOTE = "Atleta tester 6 mesi";
// Granter = coach empathy (contact@d1s.ch) per audit.
const GRANTED_BY_USER_ID = "ee2ffcc1-0d46-47ad-90fe-c60f3006c60e";
const GRANTED_BY_EMAIL = "contact@d1s.ch";

const nowIso = new Date().toISOString();
function endsAtFromMonths(months, startsAtIso) {
  const d = new Date(startsAtIso);
  d.setUTCMonth(d.getUTCMonth() + Math.max(1, Math.round(months)));
  return d.toISOString();
}

async function get(pathq) {
  const res = await fetch(`${base}/rest/v1/${pathq}`, { headers });
  const t = await res.text();
  try { return { ok: res.ok, status: res.status, json: JSON.parse(t) }; } catch { return { ok: res.ok, status: res.status, json: t }; }
}

// Idempotenza: se esiste già un grant attivo, non duplicare.
const existing = await get(`subscription_grants?user_id=eq.${TARGET_USER_ID}&revoked_at=is.null&ends_at=gt.${nowIso}&select=id,kind,ends_at`);
if (Array.isArray(existing.json) && existing.json.length > 0) {
  console.log("Grant attivo già presente, nessun insert:");
  console.log(JSON.stringify(existing.json, null, 2));
  process.exit(0);
}

const startsAt = nowIso;
const endsAt = endsAtFromMonths(MONTHS, startsAt);
const payload = {
  user_id: TARGET_USER_ID,
  kind: KIND,
  starts_at: startsAt,
  ends_at: endsAt,
  note: NOTE,
  granted_by_user_id: GRANTED_BY_USER_ID,
  granted_by_email: GRANTED_BY_EMAIL,
};

const res = await fetch(`${base}/rest/v1/subscription_grants`, {
  method: "POST",
  headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify(payload),
});
const text = await res.text();
console.log("INSERT status:", res.status);
console.log(text);

if (res.ok) {
  const verify = await get(`subscription_grants?user_id=eq.${TARGET_USER_ID}&select=id,kind,starts_at,ends_at,revoked_at,note&order=created_at.desc`);
  console.log("\n== Verifica grants Matteo ==");
  console.log(JSON.stringify(verify.json, null, 2));
  console.log(`\n>>> Accesso atteso ora: grant_active fino a ${endsAt} (entra al prossimo refresh/login).`);
}
