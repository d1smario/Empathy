/** Smoke test GIN tag query (no server-only import). */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

async function countBranch(
  label: string,
  apply: (q: ReturnType<ReturnType<typeof admin.from>["select"]>) => ReturnType<ReturnType<typeof admin.from>["select"]>,
) {
  const base = admin.from("nutrition_fdc_food_tags").select("fdc_id", { count: "exact", head: true });
  const { count, error } = await apply(base);
  console.log(`${label}: ${error ? error.message : (count ?? 0)}`);
}

async function main() {
  await countBranch("tags total", (q) => q);
  await countBranch("main_meal + primo_carb", (q) =>
    q.contains("slot_fit", ["main_meal"]).contains("meal_course", ["primo_carb"]),
  );
  await countBranch("vegan breakfast", (q) =>
    q.contains("diet_profile", ["vegan"]).contains("slot_fit", ["breakfast"]).not("diet_exclude", "ov", ["animal"]),
  );
  await countBranch("celiac secondo (no gluten)", (q) =>
    q
      .contains("slot_fit", ["main_meal"])
      .contains("meal_course", ["secondo_protein"])
      .not("diet_exclude", "ov", ["gluten"]),
  );
}

void main();
