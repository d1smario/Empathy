/**
 * Motore meal plan canonico: v1 (Mediterranean) | v2 (FDC taggato) | shadow (entrambi, risposta V1) | db (generate_plan Postgres, piano persistito).
 */

export type NutritionMealPlanEngine = "v1" | "v2" | "shadow" | "db";

function normalizeEngine(raw: string): NutritionMealPlanEngine | null {
  const v = raw.trim().toLowerCase();
  if (v === "v1" || v === "legacy") return "v1";
  if (v === "v2" || v === "fdc") return "v2";
  if (v === "shadow" || v === "dual") return "shadow";
  if (v === "db" || v === "database" || v === "postgres") return "db";
  return null;
}

/** Env: NUTRITION_MEAL_PLAN_ENGINE=v1|v2|shadow|db (default v1). */
export function resolveNutritionMealPlanEngine(
  nutritionConfig?: Record<string, unknown> | null,
): NutritionMealPlanEngine {
  const perAthlete = nutritionConfig?.meal_plan_engine;
  if (typeof perAthlete === "string") {
    const parsed = normalizeEngine(perAthlete);
    if (parsed) return parsed;
  }
  const env = (process.env.NUTRITION_MEAL_PLAN_ENGINE ?? "").trim();
  const fromEnv = normalizeEngine(env);
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development" && (process.env.NUTRITION_MEAL_PLAN_ENGINE_DEV ?? "").trim() === "shadow") {
    return "shadow";
  }
  // Default canonico: V2 (USDA FDC taggato) ovunque — locale come produzione — così
  // c'è UN solo motore e il piano V2 persistito è l'unica fonte letta da Nutrizione e
  // Oggi. Rollback per-atleta o globale: NUTRITION_MEAL_PLAN_ENGINE=v1|shadow|db.
  return "v2";
}

export function isNutritionMealPlanEngineV2Active(engine: NutritionMealPlanEngine): boolean {
  return engine === "v2" || engine === "shadow";
}
