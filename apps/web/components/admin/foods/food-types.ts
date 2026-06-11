/** Tipi e helper condivisi della Gestione Alimenti admin (`fdc_food` + motore menù). */

export type FoodRow = {
  fdc_id: number;
  description: string;
  food_category: string | null;
  kcal_100g: number | null;
  carbs_100g: number | null;
  protein_100g: number | null;
  fat_100g: number | null;
  fiber_100g: number | null;
  sugars_100g: number | null;
  sodium_mg_100g: number | null;
  image_url: string | null;
  source_dataset: string | null;
  refreshed_at: string | null;
};

export type FoodImageItem = { name: string; publicUrl: string };

export type EngineConfigRow = {
  key: string;
  value: number;
  label_it: string | null;
  description_it: string | null;
  min_value: number | null;
  max_value: number | null;
};

/** Campi numerici editabili (per 100 g) con etichetta italiana. */
export const FOOD_NUMERIC_FIELDS = [
  { field: "kcal_100g", label: "Kcal" },
  { field: "carbs_100g", label: "Carboidrati (g)" },
  { field: "protein_100g", label: "Proteine (g)" },
  { field: "fat_100g", label: "Grassi (g)" },
  { field: "fiber_100g", label: "Fibre (g)" },
  { field: "sugars_100g", label: "Zuccheri (g)" },
  { field: "sodium_mg_100g", label: "Sodio (mg)" },
] as const;

export type FoodNumericField = (typeof FOOD_NUMERIC_FIELDS)[number]["field"];

/**
 * Tinte semantiche dei macro (design system Console v2): stessa tinta per valore
 * (piena, *-300) e intestazione di colonna / label (attenuata, *-400/70).
 * kcal=ambra · carboidrati/zuccheri=azzurro · proteine=verde · grassi=rosa · fibre=lime · sodio=neutro.
 */
export const MACRO_TINT: Record<FoodNumericField, { value: string; header: string }> = {
  kcal_100g: { value: "text-amber-300", header: "text-amber-400/70" },
  carbs_100g: { value: "text-sky-300", header: "text-sky-400/70" },
  protein_100g: { value: "text-emerald-300", header: "text-emerald-400/70" },
  fat_100g: { value: "text-rose-300", header: "text-rose-400/70" },
  fiber_100g: { value: "text-lime-300", header: "text-lime-400/70" },
  sugars_100g: { value: "text-sky-300", header: "text-sky-400/70" },
  sodium_mg_100g: { value: "text-zinc-200", header: "text-zinc-400/70" },
};

export function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString("it-IT", { maximumFractionDigits: 1 });
}
