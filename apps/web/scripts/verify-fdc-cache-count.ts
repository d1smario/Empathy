/**
 * Verifica count nutrition_fdc_foods + host Supabase (senza stampare segreti).
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filePath: string, override: boolean) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!override && key in process.env) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value.replace(/\\n/g, "").trim();
  }
}

const root = path.resolve(__dirname, "../../..");
loadEnvFile(path.join(root, ".env.local"), false);
loadEnvFile(path.join(root, "apps", "web", ".env.local"), true);

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Missing Supabase URL or service role");
  process.exit(1);
}

let host = url;
try {
  host = new URL(url).host;
} catch {
  /* keep */
}

console.log(`Supabase host: ${host}`);
if (process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const a = process.env.SUPABASE_URL.trim();
  const b = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
  if (a.replace(/\/$/, "") !== b.replace(/\/$/, "")) {
    console.warn("WARN: SUPABASE_URL ≠ NEXT_PUBLIC_SUPABASE_URL — usa un solo progetto!");
  }
}

async function main() {
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { count, error } = await admin.from("nutrition_fdc_foods").select("fdc_id", { count: "exact", head: true });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  const { data: top } = await admin
    .from("nutrition_fdc_foods")
    .select("fdc_id, description")
    .order("fdc_id", { ascending: false })
    .limit(3);
  const { data: sampleIds } = await admin.from("nutrition_fdc_foods").select("fdc_id").limit(10000);
  const { data: srProbe } = await admin.from("nutrition_fdc_foods").select("fdc_id, description").eq("fdc_id", 167512).maybeSingle();

  console.log(`nutrition_fdc_foods count (head): ${count ?? "?"}`);
  console.log(`nutrition_fdc_foods fetch limit 10000: ${sampleIds?.length ?? 0}`);
  console.log("Top fdc_id:", top);
  console.log("SR Legacy probe fdc_id=167512:", srProbe ?? "(missing)");
}

void main();
