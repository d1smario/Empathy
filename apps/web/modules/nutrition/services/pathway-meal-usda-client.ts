import type { UsdaRichFoodItemViewModel } from "@/api/nutrition/contracts";

export type PathwayUsdaFetchResult = {
  foods: UsdaRichFoodItemViewModel[];
  error: string | null;
  usdaConfigured: boolean;
};

function mergeAndRankFoods(rows: UsdaRichFoodItemViewModel[], limit: number): UsdaRichFoodItemViewModel[] {
  const m = new Map<number, UsdaRichFoodItemViewModel>();
  for (const r of rows) {
    const prev = m.get(r.fdcId);
    if (!prev || (r.targetAmountPer100g ?? 0) > (prev.targetAmountPer100g ?? 0)) m.set(r.fdcId, r);
  }
  return Array.from(m.values())
    .sort((a, b) => (b.targetAmountPer100g ?? 0) - (a.targetAmountPer100g ?? 0))
    .slice(0, limit);
}

/**
 * Coalescing + cache breve lato client: al load la stessa combinazione di
 * catalogIds veniva richiesta più volte (slot diversi condividono cataloghi e
 * l'effect nel God-component ripartiva a ogni arrivo dati → richieste triplicate
 * da 2–11 s l'una, misurate live 2026-07). I cataloghi USDA non cambiano nel
 * corso di una sessione: una richiesta in volo si condivide, un risultato buono
 * si riusa per 10 minuti.
 */
const inflightByIds = new Map<string, Promise<PathwayUsdaFetchResult>>();
const cacheByIds = new Map<string, { at: number; res: PathwayUsdaFetchResult }>();
const CACHE_TTL_MS = 10 * 60_000;

/** Una chiamata per catalogId (chiave catalogo funzionale EMPATHY, es. leucine_mtor). */
export async function fetchUsdaFoodsForCatalogIds(catalogIds: string[]): Promise<PathwayUsdaFetchResult> {
  const ids = Array.from(new Set(catalogIds.map((id) => id.trim()).filter(Boolean))).slice(0, 3);
  if (!ids.length) {
    return { foods: [], error: null, usdaConfigured: true };
  }
  const key = ids.join(",");

  const hit = cacheByIds.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.res;
  }
  const pending = inflightByIds.get(key);
  if (pending) {
    return pending;
  }

  const request = (async (): Promise<PathwayUsdaFetchResult> => {
    const res = await fetch(`/api/nutrition/usda-by-nutrient?catalogIds=${encodeURIComponent(key)}`, {
      cache: "no-store",
    });
    const j = (await res.json().catch(() => ({}))) as {
      foods?: UsdaRichFoodItemViewModel[];
      error?: string;
    };
    const foods = j.foods ?? [];
    const usdaConfigured = res.status !== 503;
    const error =
      res.ok ? (j.error ?? null) : j.error ?? (usdaConfigured ? "USDA error." : "USDA_API_KEY not configured (server).");

    const result: PathwayUsdaFetchResult = {
      foods: mergeAndRankFoods(foods, 12),
      error,
      usdaConfigured,
    };
    // Solo i risultati buoni entrano in cache: gli errori restano ritentabili.
    if (!error) {
      cacheByIds.set(key, { at: Date.now(), res: result });
    }
    return result;
  })().finally(() => {
    inflightByIds.delete(key);
  });

  inflightByIds.set(key, request);
  return request;
}
