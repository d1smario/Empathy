/**
 * Densità di micronutriente per 100 g, dal dataset locale — il ponte fra gli esami del
 * sangue e la scelta dell'alimento.
 *
 * Cosa risolve. Ferritina, emoglobina, vitamina D, B12, omocisteina e PCR venivano lette,
 * trasformate in vie metaboliche e cofattori, e arrivavano fino al motore come
 * `nutrientBoostTargets`. Lì si fermavano: diventavano una nota testuale accanto al pasto
 * e un elenco di alimenti consigliati, e nessun alimento del piatto cambiava. Qui il
 * numero entra nella scelta.
 *
 * Come entra, e come NON entra. È un **criterio di pareggio a parità di ruolo**: fra due
 * alimenti ugualmente validi per quel posto nel pasto, vince il più ricco del nutriente
 * che serve. Non tocca macro, grammi, né il budget del pasto: il solver riceve lo stesso
 * problema di prima, con un ingrediente diverso a parità di punteggio. Un alimento non
 * adatto al ruolo non diventa adatto perché è ricco di ferro.
 *
 * I valori arrivano dalle colonne JSON di `nutrition_fdc_foods` (vitamins / minerals /
 * other_nutrients), che elencano `{name, unit, nutrientId, amountPer100g}` con gli id USDA.
 */
import type { NutrientTargetId } from "@/lib/nutrition/pathway-cofactors-to-nutrient-targets";

/** Id USDA (FoodData Central) per ciascun target. Più id = sinonimi/forme della stessa voce. */
const USDA_IDS_BY_TARGET: Record<NutrientTargetId, readonly number[]> = {
  vitA_mcg_RAE: [1106],
  vitC_mg: [1162],
  vitD_mcg: [1114, 1110],
  vitE_mg: [1109],
  vitK_mcg: [1185],
  thiamineB1_mg: [1165],
  riboflavinB2_mg: [1166],
  niacinB3_mg: [1167],
  vitB6_mg: [1175],
  folate_mcg: [1177, 1187, 1190],
  vitB12_mcg: [1178],
  ca_mg: [1087],
  fe_mg: [1089],
  mg_mg: [1090],
  p_mg: [1091],
  k_mg: [1092],
  na_mg: [1093],
  zn_mg: [1095],
  se_mcg: [1103],
  fiberG: [1079],
  omega3G: [1404, 1405, 1272, 1278],
};

export const NUTRIENT_TARGET_IDS = Object.keys(USDA_IDS_BY_TARGET) as NutrientTargetId[];

/** Target → id USDA, invertito una volta sola: la lettura di una riga è un solo passaggio sull'array. */
const TARGET_BY_USDA_ID = new Map<number, NutrientTargetId>();
for (const [target, ids] of Object.entries(USDA_IDS_BY_TARGET) as Array<[NutrientTargetId, readonly number[]]>) {
  for (const id of ids) if (!TARGET_BY_USDA_ID.has(id)) TARGET_BY_USDA_ID.set(id, target);
}

export type MicrosPer100g = Partial<Record<NutrientTargetId, number>>;

function asNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Estrae SOLO i nutrienti che possono essere un target. Il dataset ne porta molti di più:
 * tenerli tutti significherebbe trascinare l'intero JSON dentro il bundle del motore per
 * ogni alimento del pool. Le forme diverse dello stesso target (folati, omega-3) si sommano.
 */
export function extractMicrosPer100g(...jsonColumns: unknown[]): MicrosPer100g {
  const out: MicrosPer100g = {};
  for (const col of jsonColumns) {
    if (!Array.isArray(col)) continue;
    for (const raw of col) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as Record<string, unknown>;
      const usdaId = asNumber(entry.nutrientId);
      if (usdaId == null) continue;
      const target = TARGET_BY_USDA_ID.get(Math.round(usdaId));
      if (!target) continue;
      const amount = asNumber(entry.amountPer100g);
      if (amount == null) continue;
      out[target] = (out[target] ?? 0) + amount;
    }
  }
  return out;
}

/**
 * Confronto fra due candidati sui target attivi, **in ordine di priorità**: decide il primo
 * target su cui differiscono. Nessuna normalizzazione fra unità diverse — mg e mcg non si
 * sommano mai, perché ogni target si confronta solo con se stesso.
 *
 * Ritorna > 0 se `a` è più ricco, < 0 se lo è `b`, 0 se sono indistinguibili.
 */
export function compareMicroDensity(
  a: MicrosPer100g | undefined,
  b: MicrosPer100g | undefined,
  targets: readonly NutrientTargetId[],
): number {
  for (const target of targets) {
    const va = a?.[target] ?? 0;
    const vb = b?.[target] ?? 0;
    if (va === vb) continue;
    // Differenze infinitesime non sono un motivo per cambiare alimento: sotto l'1% del
    // valore più alto le due voci sono lo stesso alimento con arrotondamenti diversi.
    const scale = Math.max(va, vb);
    if (scale > 0 && Math.abs(va - vb) / scale < 0.01) continue;
    return va - vb;
  }
  return 0;
}

/** I target validi fra quelli richiesti dal sistema intelligente (scarta gli id sconosciuti). */
export function normalizeNutrientTargets(
  raw: ReadonlyArray<{ nutrientId?: unknown }> | null | undefined,
): NutrientTargetId[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<NutrientTargetId>();
  const out: NutrientTargetId[] = [];
  for (const item of raw) {
    const id = typeof item?.nutrientId === "string" ? item.nutrientId : "";
    if (!id || !(id in USDA_IDS_BY_TARGET)) continue;
    const target = id as NutrientTargetId;
    if (seen.has(target)) continue;
    seen.add(target);
    out.push(target);
  }
  return out;
}
