import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import {
  FUELING_PRODUCT_CATALOG,
  type FuelingCategory,
  type FuelingFormat,
  type FuelingFunctionalFocus,
  type FuelingProduct,
  type FuelingTiming,
} from "@/lib/nutrition/fueling-product-catalog";

export type SupplementCatalogSource = "db" | "static";

export type SupplementCatalogResult = {
  catalog: FuelingProduct[];
  source: SupplementCatalogSource;
};

type SupplementCatalogRow = {
  brand: string;
  product: string;
  category: string;
  product_url: string;
  logo_domain: string;
  image_url: string | null;
  format: string;
  functional_focus: string[] | null;
  timing: string[] | null;
  carbohydrate_g_per_serving: number | string | null;
  nutrient_targets: string[] | null;
};

function rowToProduct(row: SupplementCatalogRow): FuelingProduct {
  const cho =
    row.carbohydrate_g_per_serving == null ? null : Number(row.carbohydrate_g_per_serving);
  return {
    brand: row.brand,
    product: row.product,
    category: row.category as FuelingCategory,
    productUrl: row.product_url,
    logoDomain: row.logo_domain,
    ...(row.image_url ? { imageUrl: row.image_url } : {}),
    format: row.format as FuelingFormat,
    functionalFocus: (row.functional_focus ?? []) as FuelingFunctionalFocus[],
    timing: (row.timing ?? []) as FuelingTiming[],
    ...(cho != null && Number.isFinite(cho) && cho > 0 ? { carbohydrateGPerServing: cho } : {}),
    ...(row.nutrient_targets?.length ? { nutrientTargets: row.nutrient_targets } : {}),
  };
}

/** Memo di modulo: il catalogo cambia solo per curation, inutile rileggerlo a ogni mount. */
let MEMO: SupplementCatalogResult | null = null;
let MEMO_AT = 0;
const MEMO_TTL_MS = 10 * 60_000;

/**
 * Catalogo integratori/fueling da `public.nutrition_supplement_catalog` (DB-first, lettura
 * browser→Supabase diretta). Fallback su `FUELING_PRODUCT_CATALOG` se tabella vuota o
 * irraggiungibile → shape e comportamento invariati; `sort_order` preserva l'ordine statico.
 */
export async function loadSupplementCatalog(): Promise<SupplementCatalogResult> {
  const now = Date.now();
  if (MEMO && now - MEMO_AT < MEMO_TTL_MS) return MEMO;
  try {
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) return { catalog: FUELING_PRODUCT_CATALOG, source: "static" };
    const { data, error } = await supabase
      .from("nutrition_supplement_catalog")
      .select(
        "brand, product, category, product_url, logo_domain, image_url, format, functional_focus, timing, carbohydrate_g_per_serving, nutrient_targets",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as SupplementCatalogRow[];
    if (!rows.length) return { catalog: FUELING_PRODUCT_CATALOG, source: "static" };
    const result: SupplementCatalogResult = { catalog: rows.map(rowToProduct), source: "db" };
    MEMO = result;
    MEMO_AT = now;
    return result;
  } catch {
    return { catalog: FUELING_PRODUCT_CATALOG, source: "static" };
  }
}
