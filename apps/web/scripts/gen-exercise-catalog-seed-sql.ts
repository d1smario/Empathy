/**
 * Genera SQL idempotente (migrazione + seed) per `public.exercise_catalog`
 * a partire dal catalogo unificato statico (JSON + block1-generated).
 *
 * Esecuzione (da apps/web):
 *   npx tsx scripts/gen-exercise-catalog-seed-sql.ts > scripts/exercise-catalog-seed.sql
 *
 * NB: lo script importa il loader statico — questo è l'UNICO punto che mantiene
 * il dataset in-bundle, ed è build-tooling, non runtime di route.
 */
import { loadUnifiedExerciseCatalog } from "../lib/training/exercise-library/catalog-loader";
import { unifiedRecordToCatalogRow } from "../lib/training/exercise-library/catalog-row";

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function sqlTextArray(arr: string[]): string {
  // text[] literal: array['a','b']
  if (!arr.length) return "array[]::text[]";
  return `array[${arr.map(sqlString).join(", ")}]`;
}

function sqlJsonb(value: unknown): string {
  if (value === null || value === undefined) return "null";
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

const MIGRATION = `-- ============================================================================
-- exercise_catalog : catalogo esercizi DB-first (ex import statico nel bundle)
-- Dato pubblico non per-utente: RLS read pubblico (anon, authenticated),
-- scritture solo service_role. Naming coerente con nutrition_product_catalog.
-- ============================================================================

create table if not exists public.exercise_catalog (
  id                text primary key,
  slug              text not null,
  name              text not null,
  category          text not null,
  sport_tags        text[] not null default '{}',
  movement_pattern  text not null,
  muscle_groups     text[] not null default '{}',
  equipment         text[] not null default '{}',
  difficulty        text not null,
  primary_system    text not null,
  energy_system     text not null,
  physiology        jsonb not null,
  skills            jsonb not null,
  purpose           jsonb,
  provenance        jsonb not null default '[]'::jsonb,
  media             jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists exercise_catalog_slug_idx on public.exercise_catalog (slug);
create index if not exists exercise_catalog_category_idx on public.exercise_catalog (category);
create index if not exists exercise_catalog_movement_pattern_idx on public.exercise_catalog (movement_pattern);
create index if not exists exercise_catalog_primary_system_idx on public.exercise_catalog (primary_system);
create index if not exists exercise_catalog_energy_system_idx on public.exercise_catalog (energy_system);
create index if not exists exercise_catalog_sport_tags_gin on public.exercise_catalog using gin (sport_tags);
create index if not exists exercise_catalog_muscle_groups_gin on public.exercise_catalog using gin (muscle_groups);

alter table public.exercise_catalog enable row level security;

-- Catalogo pubblico: lettura per anon + authenticated.
drop policy if exists exercise_catalog_read_anon on public.exercise_catalog;
create policy exercise_catalog_read_anon
  on public.exercise_catalog
  for select
  to anon, authenticated
  using (true);

-- Scritture (insert/update/delete) riservate al service_role.
drop policy if exists exercise_catalog_write_service on public.exercise_catalog;
create policy exercise_catalog_write_service
  on public.exercise_catalog
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================================
-- Seed idempotente (ON CONFLICT (id) DO UPDATE)
-- ============================================================================
`;

const catalog = loadUnifiedExerciseCatalog();
const rows = catalog.exercises.map(unifiedRecordToCatalogRow);

const lines: string[] = [];
lines.push(MIGRATION);

for (const r of rows) {
  lines.push(`insert into public.exercise_catalog (
  id, slug, name, category, sport_tags, movement_pattern, muscle_groups,
  equipment, difficulty, primary_system, energy_system, physiology, skills,
  purpose, provenance, media
) values (
  ${sqlString(r.id)},
  ${sqlString(r.slug)},
  ${sqlString(r.name)},
  ${sqlString(r.category)},
  ${sqlTextArray(r.sport_tags)},
  ${sqlString(r.movement_pattern)},
  ${sqlTextArray(r.muscle_groups)},
  ${sqlTextArray(r.equipment)},
  ${sqlString(r.difficulty)},
  ${sqlString(r.primary_system)},
  ${sqlString(r.energy_system)},
  ${sqlJsonb(r.physiology)},
  ${sqlJsonb(r.skills)},
  ${sqlJsonb(r.purpose)},
  ${sqlJsonb(r.provenance)},
  ${sqlJsonb(r.media)}
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  sport_tags = excluded.sport_tags,
  movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  primary_system = excluded.primary_system,
  energy_system = excluded.energy_system,
  physiology = excluded.physiology,
  skills = excluded.skills,
  purpose = excluded.purpose,
  provenance = excluded.provenance,
  media = excluded.media,
  updated_at = now();
`);
}

process.stdout.write(lines.join("\n"));
