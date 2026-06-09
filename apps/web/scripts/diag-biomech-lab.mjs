/**
 * Diagnostica rapida lab Biomechanics (DB + env).
 * Uso: node scripts/diag-biomech-lab.mjs [email]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const inlineMock = process.env.LAB_INLINE_MOCK;

if (!url || !serviceKey) {
  console.error("MISSING env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local");
  process.exit(1);
}

const email = process.argv[2]?.trim() || "m@d1s.ch";
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  console.log("=== Biomech lab diag ===");
  console.log("LAB_INLINE_MOCK:", inlineMock ?? "(not set)");
  console.log("User email:", email);

  const { data: users, error: userErr } = await db.auth.admin.listUsers({ perPage: 200 });
  if (userErr) {
    console.error("auth.admin.listUsers:", userErr.message);
    process.exit(1);
  }
  const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error("User not found:", email);
    process.exit(1);
  }
  console.log("auth user id:", user.id);

  const { data: profile } = await db
    .from("app_user_profiles")
    .select("athlete_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const athleteId = profile?.athlete_id;
  console.log("athlete_id:", athleteId ?? "(none)");
  if (!athleteId) {
    console.error("No athlete linked to profile.");
    process.exit(1);
  }

  const jobsFull = await db
    .from("biomech_capture_jobs")
    .select("id, status, created_at, error_message, source")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (jobsFull.error?.message?.includes("column")) {
    const jobsLegacy = await db
      .from("biomech_capture_jobs")
      .select("id, status, created_at, error_message")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(5);
    console.log("\nJobs (legacy select — migration 073 missing?):");
    console.log(jobsLegacy.error ? jobsLegacy.error.message : jobsLegacy.data);
  } else {
    console.log("\nLatest capture jobs:");
    console.log(jobsFull.error ? jobsFull.error.message : jobsFull.data);
  }

  const staging = await db
    .from("interpretation_staging_runs")
    .select("id, domain, status, created_at")
    .eq("athlete_id", athleteId)
    .eq("domain", "biomechanics")
    .order("created_at", { ascending: false })
    .limit(5);
  console.log("\nBiomech staging runs:");
  if (staging.error) {
    console.log(staging.error.message);
    if (staging.error.message.includes("domain")) {
      console.log("→ Applica migration 072_lab_staging_domains_v1.sql su Supabase");
    }
  } else {
    console.log(staging.data);
  }

  const bucket = await db.storage.from("biomech-capture").list(`${athleteId}`, { limit: 3 });
  console.log("\nStorage biomech-capture prefix:");
  console.log(bucket.error ? bucket.error.message : bucket.data?.map((f) => f.name));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
