import type {
  ExerciseCatalogFile,
  UnifiedExercisePurpose,
  UnifiedExerciseRecord,
} from "./types";

/**
 * Riga DB della tabella `public.exercise_catalog` (snake_case, coerente con
 * `nutrition_product_catalog` / `nutrition_fdc_foods`). I campi composti
 * (physiology, skills, purpose, provenance, media) sono persistiti come jsonb
 * per non frammentare lo schema; le colonne scalari/array più filtrabili
 * (sport_tags, movement_pattern, muscle_groups, primary_system, energy_system,
 * difficulty, category) sono prime-class per gli indici.
 */
export type ExerciseCatalogRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  sport_tags: string[];
  movement_pattern: string;
  muscle_groups: string[];
  equipment: string[];
  difficulty: UnifiedExerciseRecord["difficulty"];
  primary_system: string;
  energy_system: string;
  physiology: UnifiedExerciseRecord["physiology"];
  skills: UnifiedExerciseRecord["skills"];
  purpose: UnifiedExercisePurpose | null;
  provenance: UnifiedExerciseRecord["provenance"];
  media: NonNullable<UnifiedExerciseRecord["media"]> | null;
};

/** Record di catalogo (TS / JSON) → riga DB pronta per INSERT/seed. */
export function unifiedRecordToCatalogRow(ex: UnifiedExerciseRecord): ExerciseCatalogRow {
  return {
    id: ex.id,
    slug: ex.slug,
    name: ex.name,
    category: ex.category,
    sport_tags: ex.sportTags ?? [],
    movement_pattern: ex.movementPattern,
    muscle_groups: ex.muscleGroups ?? [],
    equipment: ex.equipment ?? [],
    difficulty: ex.difficulty,
    primary_system: ex.physiology.primarySystem,
    energy_system: ex.physiology.energySystem,
    physiology: ex.physiology,
    skills: ex.skills,
    purpose: ex.purpose ?? null,
    provenance: ex.provenance ?? [],
    media: ex.media ?? null,
  };
}

/** Riga DB → record di catalogo (shape identica all'import statico). */
export function catalogRowToUnifiedRecord(row: ExerciseCatalogRow): UnifiedExerciseRecord {
  const record: UnifiedExerciseRecord = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    sportTags: row.sport_tags ?? [],
    movementPattern: row.movement_pattern,
    muscleGroups: row.muscle_groups ?? [],
    equipment: row.equipment ?? [],
    difficulty: row.difficulty,
    physiology: row.physiology,
    skills: row.skills,
    provenance: row.provenance ?? [],
  };
  if (row.purpose) record.purpose = row.purpose;
  if (row.media) record.media = row.media;
  return record;
}

/** Avvolge le righe DB nella stessa shape del file di catalogo unificato. */
export function rowsToCatalogFile(rows: ExerciseCatalogRow[]): ExerciseCatalogFile {
  const exercises = rows.map(catalogRowToUnifiedRecord);
  return {
    version: 1,
    generatedAt: new Date(0).toISOString(),
    count: exercises.length,
    exercises,
  };
}
