import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildNutritionFdcFoodUpsertPayloadFromUsdaRaw,
  parseUsdaDumpFoodRows,
} from "../lib/nutrition/fdc-import-row";

function loadEnvFile(filePath: string, override = false) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const admin = createClient(url, key, { auth: { persistSession: false } });

const dumpPath = path.join(root, "data", "usda-fdc", "FoundationFoods.json");
const rows = parseUsdaDumpFoodRows(JSON.parse(fs.readFileSync(dumpPath, "utf8")));
const payloads = rows.slice(1, 9).map((r) => {
  const b = buildNutritionFdcFoodUpsertPayloadFromUsdaRaw(r as Record<string, unknown>);
  if ("error" in b) throw new Error(b.error);
  return b;
});

async function main() {
  const { count: before } = await admin.from("nutrition_fdc_foods").select("fdc_id", { count: "exact", head: true });
  console.log("before:", before);
  const res = await admin.from("nutrition_fdc_foods").upsert(payloads, { onConflict: "fdc_id" });
  console.log("chunk upsert error:", res.error?.message ?? "none", "status:", res.status);
  const ids = payloads.map((p) => p.fdc_id);
  const { data } = await admin.from("nutrition_fdc_foods").select("fdc_id").in("fdc_id", ids);
  console.log("readback count:", data?.length, "expected:", ids.length);
  const { count: after } = await admin.from("nutrition_fdc_foods").select("fdc_id", { count: "exact", head: true });
  console.log("after:", after);
}

void main();
