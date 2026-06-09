/**
 * Test upsert singolo alimento USDA — debug perché import non persiste.
 */
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
const rawJson = JSON.parse(fs.readFileSync(dumpPath, "utf8")) as unknown;
const rows = parseUsdaDumpFoodRows(rawJson);
const built = buildNutritionFdcFoodUpsertPayloadFromUsdaRaw(rows[0] as Record<string, unknown>, {
  sourceTag: "test_single",
});
if ("error" in built) {
  console.error("Build error:", built.error);
  process.exit(1);
}

console.log("fdc_id:", built.fdc_id, "desc:", built.description.slice(0, 60));
console.log("payload keys:", Object.keys(built).length, "nutrients_raw len:", built.nutrients_raw.length);

const full = { ...built };
const { glycemic_index_estimate: _a, insulin_index_estimate: _b, glycemic_load_100g: _c, insulin_load_100g: _d, metabolic_indices: _e, ...baseOnly } = full;

async function main() {
  for (const [label, row] of [
    ["full+metabolic", full],
    ["base_only", baseOnly],
  ] as const) {
    const res = await admin.from("nutrition_fdc_foods").upsert([row], { onConflict: "fdc_id" });
    console.log(`Upsert ${label}: error=${res.error?.message ?? "none"} status=${res.status}`);
    const rb = await admin
      .from("nutrition_fdc_foods")
      .select("fdc_id, description")
      .eq("fdc_id", built.fdc_id)
      .maybeSingle();
    console.log(`  readback:`, rb.data ?? rb.error?.message);
  }
}

void main();
