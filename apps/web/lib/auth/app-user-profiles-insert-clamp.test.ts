import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * Guardia anti-regressione per il buco C1 (INSERT su app_user_profiles).
 *
 * Il difetto vive in Postgres, non in TypeScript: il ramo INSERT del trigger
 * `app_user_profiles_protect_platform_fields` metteva 'pending' SOLO quando
 * `platform_coach_status` arrivava NULL, quindi un client che passava
 * esplicitamente 'approved' se lo teneva e — grazie alla policy
 * `app_user_profiles_insert_own` — poteva nascere coach gia approvato.
 *
 * Questo test non parla col DB: verifica che la migrazione piu recente che
 * ridefinisce la funzione tenga l'invariante (valore FORZATO, non condizionato),
 * cosi un futuro `create or replace` che reintroduce `... is null` fallisce qui.
 */

function migrationsDir(): string {
  const override = process.env.EMPATHY_MIGRATIONS_DIR;
  if (override) return override;
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(dir, "supabase", "migrations");
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error("supabase/migrations non trovata risalendo da " + process.cwd());
}

const FN = "app_user_profiles_protect_platform_fields";

function latestTriggerDefinition(): string {
  const dir = migrationsDir();
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => fs.readFileSync(path.join(dir, f), "utf8").includes(FN))
    .sort();
  assert.ok(files.length > 0, `nessuna migrazione definisce ${FN} in ${dir}`);
  return fs.readFileSync(path.join(dir, files[files.length - 1]), "utf8").toLowerCase();
}

function insertBranch(sql: string): string {
  const start = sql.indexOf("if tg_op = 'insert' then");
  assert.notEqual(start, -1, "ramo INSERT non trovato nella definizione del trigger");
  const end = sql.indexOf("if tg_op = 'update' then", start);
  assert.notEqual(end, -1, "ramo UPDATE non trovato nella definizione del trigger");
  return sql.slice(start, end);
}

test("INSERT: platform_coach_status non e condizionato al NULL in arrivo", () => {
  const branch = insertBranch(latestTriggerDefinition());
  assert.ok(
    !/platform_coach_status\s+is\s+null/.test(branch),
    "il ramo INSERT torna a fidarsi del valore inviato dal client: " +
      "con `platform_coach_status is null` chi passa 'approved' se lo tiene",
  );
});

test("INSERT: coach forzato a pending, non-coach forzato a null", () => {
  const branch = insertBranch(latestTriggerDefinition());
  assert.match(branch, /new\.platform_coach_status\s*:=\s*'pending'/);
  assert.match(branch, /new\.platform_coach_status\s*:=\s*null/);
});

test("INSERT: resta l'esenzione service_role e il clamp su is_platform_admin", () => {
  const branch = insertBranch(latestTriggerDefinition());
  assert.match(branch, /auth\.role\(\)\s*=\s*'service_role'/);
  assert.match(branch, /new\.is_platform_admin\s*:=\s*false/);
});
