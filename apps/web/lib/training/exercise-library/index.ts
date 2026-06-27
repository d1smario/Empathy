export * from "./types";
export * from "./catalog-row";
export * from "./selector";
export * from "./block1-taxonomy";
export * from "./purpose-taxonomy";
// NB: `catalog-loader` (import statico JSON + block1-generated) NON è ri-esportato
// qui di proposito, per evitare che il dataset rientri nei bundle via barrel.
// Runtime: usare `loadUnifiedExerciseCatalogFromDb` da `./catalog-db` (server-only).
// Il loader statico resta importabile direttamente solo dal seed generator.
