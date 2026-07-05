import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  FUNCTIONAL_NUTRIENT_CATALOG,
  type FunctionalNutrientCatalogEntry,
} from "@/lib/nutrition/functional-food-recommendations";

const TABLE = "functional_nutrient_catalog";

/** Memo di processo: catalogo statico, ma veniva riletto dal DB a OGNI richiesta usda-by-nutrient (audit 2026-07). */
let MEMO_CATALOG: FunctionalNutrientCatalogEntry[] | null = null;
let MEMO_CATALOG_AT = 0;
const MEMO_CATALOG_TTL_MS = 10 * 60_000;

/**
 * Catalogo nutriente→alimento funzionale letto da `public.functional_nutrient_catalog` (DB-first).
 * Dato pubblico non per-utente: RLS consente SELECT a anon/authenticated. `data` jsonb = entry
 * completo, `sort_order` preserva l'ordine statico. Fallback su `FUNCTIONAL_NUTRIENT_CATALOG` se
 * la tabella è vuota o irraggiungibile → shape e comportamento invariati.
 */
export async function loadFunctionalNutrientCatalogFromDb(): Promise<FunctionalNutrientCatalogEntry[]> {
  const now = Date.now();
  if (MEMO_CATALOG && now - MEMO_CATALOG_AT < MEMO_CATALOG_TTL_MS) return MEMO_CATALOG;
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("data")
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{ data: FunctionalNutrientCatalogEntry }>;
    const resolved = rows.length === 0 ? FUNCTIONAL_NUTRIENT_CATALOG : rows.map((row) => row.data);
    MEMO_CATALOG = resolved;
    MEMO_CATALOG_AT = now;
    return resolved;
  } catch {
    return FUNCTIONAL_NUTRIENT_CATALOG;
  }
}
