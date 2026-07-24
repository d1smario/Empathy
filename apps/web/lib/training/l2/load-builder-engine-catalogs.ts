import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveExerciseMediaUrl } from "@/lib/training/builder/exercise-media";
import { disciplineToBlock1SportTag } from "@/lib/training/domain-blocks/block1-strength-functional";
import { describeBlock1Taxonomy } from "@/lib/training/exercise-library/block1-taxonomy";
import { loadUnifiedExerciseCatalogWithClient } from "@/lib/training/exercise-library/catalog-db-core";
import { selectExercises } from "@/lib/training/exercise-library/selector";
import type { UnifiedExerciseRecord } from "@/lib/training/exercise-library/types";
import { loadAerobicStarterPresetsWithClient } from "@/lib/training/library/starter-pack-aerobic-db-core";
import type { AerobicStarterPreset } from "@/lib/training/library/starter-pack-aerobic-helpers";
import type { BuilderCatalogExerciseRow } from "@/modules/training/services/training-builder-catalog-api";

/**
 * Cataloghi per il motore L2 «builder» (blueprint C): preset aerobici + esercizi gym,
 * caricati UNA volta per piano e passati come input alla funzione pura del motore.
 *
 * PERCHÉ un loader dedicato: la catena wizard prendeva gli esercizi via fetch alla
 * route Next (`fetchUnifiedBuilderExercises`) — impraticabile in Edge Function e
 * comunque un hop inutile server-side. Qui si legge dalle stesse fonti DB-first
 * (`exercise_catalog`, `aerobic_starter_presets`) con client iniettato.
 */

/** Stessa proiezione della route `unified-exercises`, ridotta ai campi del type condiviso. */
function unifiedExerciseToBuilderCatalogRow(ex: UnifiedExerciseRecord): BuilderCatalogExerciseRow {
  const taxonomy = describeBlock1Taxonomy(ex);
  return {
    id: ex.id,
    name: ex.name,
    muscleGroup: ex.muscleGroups.join(", "),
    catalogCategory: taxonomy.catalogCategory,
    primaryDistrict: taxonomy.primaryDistrict,
    equipmentClass: taxonomy.equipmentClass,
    exerciseKind: taxonomy.exerciseKind,
    equipment: ex.equipment.join(", "),
    difficulty: ex.difficulty,
    mediaUrl: resolveExerciseMediaUrl(ex),
    movementPattern: ex.movementPattern,
    sportTags: ex.sportTags,
  };
}

export type BuilderEngineCatalogs = {
  aerobicPresets: AerobicStarterPreset[];
  gymCatalogRows: BuilderCatalogExerciseRow[];
};

export async function loadBuilderEngineCatalogs(
  client: SupabaseClient,
  args: { discipline: string; includeGym: boolean },
): Promise<BuilderEngineCatalogs> {
  const aerobicPresets = await loadAerobicStarterPresetsWithClient(client);

  let gymCatalogRows: BuilderCatalogExerciseRow[] = [];
  if (args.includeGym) {
    const catalog = await loadUnifiedExerciseCatalogWithClient(client);
    // Discipline endurance (cycling…) non sono id Block1 → sportTag "gym": il pool
    // generale palestra, stesso default della route unified-exercises.
    const sportTag = disciplineToBlock1SportTag(args.discipline);
    gymCatalogRows = selectExercises(catalog, { sportTag, limit: 400 }).map(
      unifiedExerciseToBuilderCatalogRow,
    );
  }

  return { aerobicPresets, gymCatalogRows };
}
