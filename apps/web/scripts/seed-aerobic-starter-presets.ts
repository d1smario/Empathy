/**
 * Seed/refresh della tabella `public.aerobic_starter_presets` dal catalogo statico
 * `AEROBIC_STARTER_PRESETS` (source of truth in codice). Idempotente (upsert su preset_id).
 *
 * DB-first con fallback: l'app legge la tabella via `loadAerobicStarterPresetsFromDb()`
 * e ricade sull'array statico se vuota/irraggiungibile. Esegui questo script dopo aver
 * modificato l'array statico per riallineare il DB, oppure su un DB fresco.
 *
 * Run:  npx tsx scripts/seed-aerobic-starter-presets.ts
 * Schema: scripts/aerobic-starter-presets-schema.sql
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { AEROBIC_STARTER_PRESETS } from "@/lib/training/library/starter-pack-aerobic";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function parseEnv(p: string): Record<string, string> {
  if (!fs.existsSync(p)) return {};
  const env: Record<string, string> = {};
  for (const ln of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const i = ln.indexOf("=");
    if (i <= 0) continue;
    let v = ln.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[ln.slice(0, i).trim()] = v;
  }
  return env;
}

async function main() {
  const env = { ...parseEnv(path.join(root, ".env.local")), ...parseEnv(path.join(root, "apps/web/.env.local")) };
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const rows = AEROBIC_STARTER_PRESETS.map((p, i) => ({
    preset_id: p.presetId,
    discipline: p.discipline,
    adaptation_target: p.adaptationTarget ?? null,
    phase: p.phase ?? null,
    title: p.title,
    planned_minutes: p.plannedMinutes ?? null,
    tss: p.tss ?? null,
    tags: Array.isArray(p.tags) ? p.tags : [],
    sort_order: i,
    data: p,
  }));

  let done = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.from("aerobic_starter_presets").upsert(batch, { onConflict: "preset_id" });
    if (error) throw new Error(`batch @${i}: ${error.message}`);
    done += batch.length;
  }
  console.log(`upserted ${done} aerobic starter presets into ${new URL(url).host}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
