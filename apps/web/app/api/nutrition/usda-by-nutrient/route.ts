import { NextRequest, NextResponse } from "next/server";
import { getFunctionalNutrientCatalogEntry } from "@/lib/nutrition/functional-food-recommendations";
import { loadFunctionalNutrientCatalogFromDb } from "@/lib/nutrition/functional-food-recommendations-db";
import { rankFdcFoodsByFdcNutrientId } from "@/lib/nutrition/usda-nutrient-density-ranker";
import type { UsdaRichFoodItemViewModel } from "@/api/nutrition/contracts";

export const runtime = "nodejs";

/**
 * Alimenti più ricchi di un nutriente, dal dataset FDC IMPORTATO nel DB
 * (`nutrition_fdc_foods`, ~8.2k alimenti) via RPC `rank_fdc_foods_by_nutrient`.
 * Nessuna chiamata ad api.nal.usda.gov: le ricerche live sono state rimosse
 * (2026-07) — prima una coppia di cataloghi a cache fredda costava 10-11 s.
 * `USDA_API_KEY` non serve più a questa route.
 */

/**
 * Cache di risposta in memoria per combinazione di catalogIds: il contenuto
 * dipende solo dal catalogo funzionale + dataset FDC (nessun dato utente) e non
 * cambia tra una richiesta e l'altra. Su Vercel vive per istanza (best effort).
 */
const responseCacheByCatalogIds = new Map<string, { at: number; payload: object }>();
const RESPONSE_CACHE_TTL_MS = 6 * 60 * 60_000;

function parseCatalogIdsParam(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))).slice(0, 3);
}

function toViewModel(input: {
  fdcId: number;
  description: string;
  amountPer100g: number;
  unit: string;
  kcalPer100g: number;
  targetNutrientId: number;
}): UsdaRichFoodItemViewModel {
  return {
    fdcId: input.fdcId,
    description: input.description,
    dataType: "cache",
    targetNutrientId: input.targetNutrientId,
    targetAmountPer100g: input.amountPer100g,
    targetUnitName: input.unit,
    energyKcal100: input.kcalPer100g,
    proteinG100: null,
    carbsG100: null,
    fatG100: null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const functionalCatalog = await loadFunctionalNutrientCatalogFromDb();
    const catalogId = (sp.get("catalogId") ?? "").trim();
    const catalogIds = parseCatalogIdsParam(sp.get("catalogIds"));

    if (catalogIds.length > 0) {
      const cacheKey = catalogIds.join(",");
      const hit = responseCacheByCatalogIds.get(cacheKey);
      if (hit && Date.now() - hit.at < RESPONSE_CACHE_TTL_MS) {
        return NextResponse.json(hit.payload);
      }

      const perCatalog = await Promise.all(
        catalogIds.map(async (id) => {
          const entry = getFunctionalNutrientCatalogEntry(id, functionalCatalog);
          if (!entry?.usdaRichSearch) {
            return {
              foods: [] as UsdaRichFoodItemViewModel[],
              error: `catalogId sconosciuto o senza mappatura USDA ricca: ${id}`,
            };
          }
          const spec = entry.usdaRichSearch;
          const ranked = await rankFdcFoodsByFdcNutrientId({
            fdcNutrientId: Math.round(spec.fdcNutrientId),
            minimumPer100g: spec.minimumPer100g,
            topN: 28,
          });
          return {
            foods: ranked.foods.map((r) =>
              toViewModel({ ...r, targetNutrientId: Math.round(spec.fdcNutrientId) }),
            ),
            error: ranked.error,
          };
        }),
      );

      const foodsByCatalog = perCatalog.flatMap((p) => p.foods);
      const firstError = perCatalog.find((p) => p.error)?.error ?? null;
      const payload = {
        foods: foodsByCatalog,
        source: "fdc_local_db",
        layer: "deterministic_nutrient_density",
        queriesUsed: [] as string[],
        error: firstError,
      };
      if (!firstError && foodsByCatalog.length > 0) {
        responseCacheByCatalogIds.set(cacheKey, { at: Date.now(), payload });
      }
      return NextResponse.json(payload);
    }

    let fdcNutrientId = Number(sp.get("fdcNutrientId"));
    let minimumPer100g = Number(sp.get("min"));

    if (catalogId) {
      const entry = getFunctionalNutrientCatalogEntry(catalogId, functionalCatalog);
      if (!entry?.usdaRichSearch) {
        return NextResponse.json(
          { error: "catalogId sconosciuto o senza mappatura USDA ricca.", foods: [] },
          { status: 400 },
        );
      }
      fdcNutrientId = entry.usdaRichSearch.fdcNutrientId;
      minimumPer100g = entry.usdaRichSearch.minimumPer100g;
    }

    if (!Number.isFinite(fdcNutrientId) || fdcNutrientId < 1 || fdcNutrientId > 9999) {
      return NextResponse.json({ error: "fdcNutrientId non valido.", foods: [] }, { status: 400 });
    }
    if (!Number.isFinite(minimumPer100g) || minimumPer100g < 0) {
      minimumPer100g = 0;
    }

    const ranked = await rankFdcFoodsByFdcNutrientId({
      fdcNutrientId: Math.round(fdcNutrientId),
      minimumPer100g,
      topN: 28,
    });
    const foods = ranked.foods.map((r) => toViewModel({ ...r, targetNutrientId: Math.round(fdcNutrientId) }));
    return NextResponse.json({
      foods,
      source: "fdc_local_db",
      layer: "deterministic_nutrient_density",
      nutrientFilter: { fdcNutrientId: Math.round(fdcNutrientId), minimumPer100g },
      queriesUsed: [] as string[],
      cacheFirst: true,
      error: ranked.error,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore ranking FDC";
    return NextResponse.json({ error: message, foods: [] as UsdaRichFoodItemViewModel[] }, { status: 500 });
  }
}
