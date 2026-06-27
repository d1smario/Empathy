import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  FUNCTIONAL_NUTRIENT_CATALOG,
  type FunctionalNutrientCatalogEntry,
} from "@/lib/nutrition/functional-food-recommendations";

const TABLE = "functional_nutrient_catalog";

/**
 * Catalogo nutriente→alimento funzionale letto da `public.functional_nutrient_catalog` (DB-first).
 * Dato pubblico non per-utente: RLS consente SELECT a anon/authenticated. `data` jsonb = entry
 * completo, `sort_order` preserva l'ordine statico. Fallback su `FUNCTIONAL_NUTRIENT_CATALOG` se
 * la tabella è vuota o irraggiungibile → shape e comportamento invariati.
 */
export async function loadFunctionalNutrientCatalogFromDb(): Promise<FunctionalNutrientCatalogEntry[]> {
  try {
    const supabase = createServerSupabaseClient();
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
}
