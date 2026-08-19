/**
 * Tipi condivisi della sezione Ricette admin (`nutrition_recipes` +
 * `nutrition_recipe_components`, macro CALCOLATE dagli ingredienti del catalogo).
 * File client-safe: solo tipi e costanti, niente Supabase/server-only.
 */
import type { RecipeFrequency } from "@/lib/admin/menu-recipe-validation";

export type AdminMenuRecipeComponentRow = {
  position: number;
  /** null solo per il componente neutro (acqua/brodo). */
  canonical_key: string | null;
  fdc_id: number | null;
  label_it: string;
  grams_per_100g: number;
  is_neutral: boolean;
  /** Nome attuale nel catalogo (null se neutro o se l'alimento non c'è più / è disattivo). */
  catalog_label_it: string | null;
  catalog_is_active: boolean | null;
};

export type AdminMenuRecipeRow = {
  id: string;
  recipe_key: string;
  label_it: string;
  is_active: boolean;
  note: string | null;
  source_ref: string | null;
  source_version: string | null;
  /** null finché la migration `frequency/max_week` non è applicata. */
  frequency: RecipeFrequency | null;
  max_week: number | null;
  updated_at: string | null;
  components: AdminMenuRecipeComponentRow[];
  /** Somma grams_per_100g dei componenti (valida in [99, 101]). */
  grams_total: number;
  /** Macro per 100 g di ricetta calcolate dagli ingredienti (server-side). */
  macro: { kcal: number; carbs: number; protein: number; fat: number };
  /** Ingredienti senza macro a DB (contati a zero nel totale). */
  macro_missing: string[];
  /** Flag dieta ereditati dagli ingredienti. */
  diet: { is_meat: boolean; is_fish: boolean; is_animal_product: boolean };
  /**
   * false se il loader del motore (`mapMenuRecipeRows`) la SCARTEREBBE (somma fuori
   * tolleranza, ingrediente sparito/disattivo): l'admin la vede, il motore no.
   */
  engine_ok: boolean;
  engine_issue: string | null;
};

export type { RecipeFrequency };

/** Etichette IT per la select frequenza (stessa semantica degli alimenti). */
export const RECIPE_FREQUENCY_LABELS: Record<RecipeFrequency, string> = {
  COMMON: "Comune (ogni settimana)",
  ROTATION: "In rotazione",
  OCCASIONAL: "Occasionale",
};
