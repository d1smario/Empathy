import type { FdcFoodTaxonomy } from "@empathy/contracts";
import { extractMicrosPer100g, type MicrosPer100g } from "@/lib/nutrition/v2/fdc-micronutrient-density";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlausiblePer100gMacros } from "@/lib/nutrition/macro-plausibility";
import {
  classifyFdcFoodRow,
  dietExcludeForActiveProfile,
  taxonomyMatchesFilter,
} from "@/lib/nutrition/v2/classify-fdc-description";
import type { FdcFoodBrowseFilter } from "@/lib/nutrition/v2/fdc-food-taxonomy";
import { CLASSIFIER_VERSION } from "@/lib/nutrition/v2/fdc-food-taxonomy";

const TAG_PREFETCH_CAP = 300;

export type FdcFoodBrowseHit = {
  fdcId: number;
  description: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  tags: FdcFoodTaxonomy;
  tagSource: "db" | "runtime_classifier";
  /**
   * Micronutrienti per 100 g, solo quelli che possono essere un target di pathway.
   * Serve al criterio di pareggio a parità di ruolo (vedi `fdc-micronutrient-density`).
   * Assente quando la riga non li porta: il pareggio ricade sull'ordine di prima.
   */
  microsPer100g?: MicrosPer100g;
};

export function fdcRowToHit(
  row: Record<string, unknown>,
  tagRow: Record<string, unknown> | null,
): FdcFoodBrowseHit | null {
  const fdcId = Math.round(Number(row.fdc_id));
  if (!Number.isFinite(fdcId) || fdcId < 1) return null;
  const description = String(row.description ?? "").trim();
  if (!description) return null;

  const kcalPer100g = Number(row.kcal_100g) || 0;
  const proteinPer100g = Number(row.protein_100g) || 0;
  const carbsPer100g = Number(row.carbs_100g) || 0;
  const fatPer100g = Number(row.fat_100g) || 0;
  const fiberG = row.fiber_100g != null ? Number(row.fiber_100g) : undefined;
  const microsPer100g = extractMicrosPer100g(row.minerals, row.vitamins, row.other_nutrients);

  let tags: FdcFoodTaxonomy;
  let tagSource: "db" | "runtime_classifier" = "runtime_classifier";

  if (tagRow && Array.isArray(tagRow.diet_profile)) {
    tags = {
      mealCourse: (tagRow.meal_course as string[]) ?? [],
      foodFamily: (tagRow.food_family as string[]) ?? [],
      macroDominant: (tagRow.macro_dominant as string[]) ?? [],
      slotFit: (tagRow.slot_fit as string[]) ?? [],
      dietProfile: (tagRow.diet_profile as string[]) ?? [],
      dietExclude: (tagRow.diet_exclude as string[]) ?? [],
      mealRole: (tagRow.meal_role as string[]) ?? [],
      aminoProfile: (tagRow.amino_profile as string[]) ?? [],
      nutrientDensity: (tagRow.nutrient_density as string[]) ?? [],
      classifierVersion: String(tagRow.classifier_version ?? CLASSIFIER_VERSION),
    } as FdcFoodTaxonomy;
    tagSource = "db";
  } else {
    tags = classifyFdcFoodRow({
      description,
      kcalPer100g,
      proteinG: proteinPer100g,
      carbsG: carbsPer100g,
      fatG: fatPer100g,
      fiberG,
    });
  }

  return {
    fdcId,
    description,
    kcalPer100g,
    proteinPer100g,
    carbsPer100g,
    fatPer100g,
    tags,
    tagSource,
    ...(Object.keys(microsPer100g).length ? { microsPer100g } : {}),
  };
}

// Supabase chain: select() returns FilterBuilder; typing the full generic chain is brittle.
type FdcTagQueryChain = {
  or: (filters: string) => FdcTagQueryChain;
  contains: (column: string, value: unknown) => FdcTagQueryChain;
  not: (column: string, operator: string, value: unknown) => FdcTagQueryChain;
  order: (column: string) => FdcTagQueryChain;
  limit: (count: number) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function applyDietProfileSqlFilter(
  query: FdcTagQueryChain,
  dietProfile: FdcFoodBrowseFilter["dietProfile"],
): FdcTagQueryChain {
  if (dietProfile === "omnivore") return query;
  if (dietProfile === "mediterranean") {
    return query.or("diet_profile.cs.{mediterranean},diet_profile.cs.{omnivore}");
  }
  if (dietProfile === "vegetarian") {
    return query.or("diet_profile.cs.{vegetarian},diet_profile.cs.{vegan}");
  }
  if (dietProfile === "pescatarian") {
    return query.or("diet_profile.cs.{pescatarian},diet_profile.cs.{vegetarian},diet_profile.cs.{vegan}");
  }
  return query.contains("diet_profile", [dietProfile]);
}

export async function queryFdcBranchPool(
  admin: SupabaseClient,
  filter: FdcFoodBrowseFilter,
): Promise<FdcFoodBrowseHit[]> {
  const limit = Math.min(80, Math.max(5, filter.limit ?? 24));
  const prefetch = Math.min(TAG_PREFETCH_CAP, Math.max(limit * 6, 48));

  let tagQuery = admin.from("nutrition_fdc_food_tags").select(
    "fdc_id, meal_course, food_family, macro_dominant, slot_fit, diet_profile, diet_exclude, meal_role, amino_profile, nutrient_density, classifier_version",
  ) as unknown as FdcTagQueryChain;

  tagQuery = applyDietProfileSqlFilter(tagQuery, filter.dietProfile);

  const mustExclude = filter.requireDietExcludeAbsent ?? dietExcludeForActiveProfile(filter.dietProfile);
  if (mustExclude.length > 0) {
    tagQuery = tagQuery.not("diet_exclude", "ov", mustExclude);
  }
  if (filter.slotFit) tagQuery = tagQuery.contains("slot_fit", [filter.slotFit]);
  if (filter.mealCourse) tagQuery = tagQuery.contains("meal_course", [filter.mealCourse]);
  if (filter.mealRole) tagQuery = tagQuery.contains("meal_role", [filter.mealRole]);
  if (filter.macroDominant) tagQuery = tagQuery.contains("macro_dominant", [filter.macroDominant]);
  if (filter.foodFamily) tagQuery = tagQuery.contains("food_family", [filter.foodFamily]);
  if (filter.aminoProfile) tagQuery = tagQuery.contains("amino_profile", [filter.aminoProfile]);
  if (filter.nutrientDensity) tagQuery = tagQuery.contains("nutrient_density", [filter.nutrientDensity]);
  for (const amino of filter.excludeAminoProfile ?? []) {
    tagQuery = tagQuery.not("amino_profile", "cs", [amino]);
  }
  if (filter.dietProfile === "low_histamine") {
    tagQuery = tagQuery.not("amino_profile", "cs", ["histamine_rich"]);
  }

  const { data: tagRows, error: tagErr } = await tagQuery.order("fdc_id").limit(prefetch);
  if (tagErr || !Array.isArray(tagRows) || tagRows.length === 0) return [];

  const tagMap = new Map<number, Record<string, unknown>>();
  const ids: number[] = [];
  for (const tr of tagRows) {
    const row = tr as Record<string, unknown>;
    const id = Math.round(Number(row.fdc_id));
    if (!Number.isFinite(id) || id < 1) continue;
    tagMap.set(id, row);
    ids.push(id);
  }
  if (ids.length === 0) return [];

  /**
   * `minerals`/`vitamins`/`other_nutrients` servono al pareggio per densità di micronutriente.
   * Se le colonne mancassero su un ambiente, si ritenta senza: il motore continua a comporre,
   * perde solo il criterio di pareggio. MAI un pool vuoto per una colonna in meno.
   */
  let foodRes: { data: Record<string, unknown>[] | null; error: { code?: string; message?: string } | null } = await admin
    .from("nutrition_fdc_foods")
    .select("fdc_id, description, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, minerals, vitamins, other_nutrients")
    .in("fdc_id", ids)
    .gt("kcal_100g", 0);
  if (foodRes.error?.code === "42703") {
    foodRes = await admin
      .from("nutrition_fdc_foods")
      .select("fdc_id, description, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g")
      .in("fdc_id", ids)
      .gt("kcal_100g", 0);
  }
  const { data: foods, error: foodErr } = foodRes;

  if (foodErr || !Array.isArray(foods) || foods.length === 0) return [];

  const hits: FdcFoodBrowseHit[] = [];
  for (const row of foods) {
    const r = row as Record<string, unknown>;
    const id = Math.round(Number(r.fdc_id));
    const hit = fdcRowToHit(r, tagMap.get(id) ?? null);
    if (!hit || hit.tagSource !== "db") continue;
    if (
      !isPlausiblePer100gMacros({
        kcal_100: hit.kcalPer100g,
        carbs_100: hit.carbsPer100g,
        protein_100: hit.proteinPer100g,
        fat_100: hit.fatPer100g,
      })
    ) {
      continue;
    }
    if (!taxonomyMatchesFilter(hit.tags, filter)) continue;
    hits.push(hit);
    if (hits.length >= limit) break;
  }

  return hits;
}
