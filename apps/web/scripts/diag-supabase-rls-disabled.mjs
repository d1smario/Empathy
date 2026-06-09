/**
 * Elenca tabelle public senza RLS + policy count.
 * node apps/web/scripts/diag-supabase-rls-disabled.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..", "..");

function parseEnvFile(p) {
  const env = {};
  for (const ln of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const i = ln.indexOf("=");
    if (i <= 0) continue;
    let v = ln.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[ln.slice(0, i).trim()] = v.replace(/\r/g, "").replace(/\n/g, "").trim();
  }
  return env;
}

let env = null;
for (const p of [path.join(root, "apps", "web", ".env.local"), path.join(root, ".env.local")]) {
  if (!fs.existsSync(p)) continue;
  const e = parseEnvFile(p);
  if (e.NEXT_PUBLIC_SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) {
    env = e;
    break;
  }
}
if (!env) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const sql = `
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  (select count(*)::int from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policy_count,
  obj_description(c.oid, 'pg_class') as table_comment
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
order by c.relname;
`;

const res = await fetch(`${base}/rest/v1/rpc/exec_sql`, {
  method: "POST",
  headers,
  body: JSON.stringify({ query: sql }),
}).catch(() => null);

async function viaPgMeta() {
  const res2 = await fetch(`${base}/pg`, { headers }).catch(() => null);
  return res2;
}

if (res && res.ok) {
  const rows = await res.json();
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

const resSql = await fetch(`${base}/rest/v1/`, { method: "GET", headers }).catch(() => null);
void resSql;

const query = encodeURIComponent(`
select c.relname, c.relrowsecurity,
  (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity order by 1
`);

const adminRes = await fetch(`${base}/database/query`, {
  method: "POST",
  headers: { ...headers, "X-Supabase-Admin": "true" },
  body: JSON.stringify({ query: sql.trim() }),
}).catch(() => null);

if (adminRes?.ok) {
  console.log(await adminRes.text());
  process.exit(0);
}

console.log("REST exec_sql not available; use supabase CLI or paste SQL in dashboard.");
console.log("\n--- SQL to run in Supabase SQL Editor ---\n");
console.log(sql.trim());
