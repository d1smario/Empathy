"use client";

import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import {
  FUNCTIONAL_NUTRIENT_CATALOG,
  type FunctionalNutrientCatalogEntry,
} from "@/lib/nutrition/functional-food-recommendations";

const TABLE = "functional_nutrient_catalog";

let cache: Promise<FunctionalNutrientCatalogEntry[]> | null = null;

/**
 * Catalogo nutriente→alimento lato client (browser→Supabase diretto, RLS anon-read).
 * Memoizzato a livello di modulo: una sola read per sessione. Fallback su
 * `FUNCTIONAL_NUTRIENT_CATALOG` se il client browser non è disponibile, la tabella è vuota
 * o la query fallisce → comportamento invariato.
 */
export function loadFunctionalNutrientCatalogClient(): Promise<FunctionalNutrientCatalogEntry[]> {
  if (cache) return cache;
  cache = (async () => {
    try {
      const supabase = createEmpathyBrowserSupabase();
      if (!supabase) return FUNCTIONAL_NUTRIENT_CATALOG;
      const { data, error } = await supabase
        .from(TABLE)
        .select("data")
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{ data: FunctionalNutrientCatalogEntry }>;
      if (rows.length === 0) return FUNCTIONAL_NUTRIENT_CATALOG;
      return rows.map((row) => row.data);
    } catch {
      return FUNCTIONAL_NUTRIENT_CATALOG;
    }
  })();
  return cache;
}
