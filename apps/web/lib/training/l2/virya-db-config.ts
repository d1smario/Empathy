import type { SupabaseClient } from "@supabase/supabase-js";
import type { ViryaCatalogMatchRule } from "@/lib/training/virya/virya-catalog-preset-resolver";

/**
 * Config VIRYA letta dalle tabelle DB (VIRYA rework F3, motore «builder»).
 *
 * FONTE UNICA: `virya_weekday_pattern` + `virya_role_sequence` + `virya_role_weight`
 * sono la verità su pattern giorni / sequenze ruolo / pesi carico — la copia
 * hardcoded client (`virya-microcycle-planner.ts`) NON deve mai alimentare il
 * motore L2 (blueprint C: config regolabile senza deploy). Le due mappe di
 * supporto (`virya_archetype_catalog_match`, `virya_discipline_map`) sono
 * opzionali: se vuote si degrada alle mappe della catena esistente, perché un
 * archetipo senza regola non deve azzerare la generazione.
 *
 * Bundle-abile: client Supabase iniettato, zero import server-only — lo stesso
 * modulo serve al ramo in-process di `materializeTrainingMacro` e alla futura
 * Edge Function `materialize-training-week` (stessa funzione, due runtime).
 */

export type ViryaDbConfig = {
  /** pattern_id → offset giorni 0..6 (0 = lunedì). */
  weekdayPatterns: Record<string, number[]>;
  /** session_count → sequenza ruoli (quality|volume|recovery). */
  roleSequences: Record<number, string[]>;
  /** `${role}|${phase}` → peso di ripartizione carico. */
  roleWeights: Record<string, number>;
  /** archetype_id → regola match catalogo; null = usare la mappa hardcoded della catena. */
  archetypeRules: Record<string, ViryaCatalogMatchRule> | null;
  /** virya_label (lowercase) → disciplina catalogo; null = usare la mappa hardcoded. */
  disciplineMap: Record<string, string> | null;
};

function asIntArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => Math.round(Number(v)))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}

/**
 * Carica la config VIRYA dalle 5 tabelle. Le 3 tabelle CORE devono esistere e
 * avere righe: se mancano si LANCIA (fail-fast esplicito) invece di ripiegare in
 * silenzio sulla copia hardcoded — altrimenti «fonte unica DB» sarebbe una bugia
 * e un errore di config passerebbe inosservato in QA.
 */
export async function loadViryaConfigFromDb(client: SupabaseClient): Promise<ViryaDbConfig> {
  const [patternRes, sequenceRes, weightRes, archetypeRes, disciplineRes] = await Promise.all([
    client.from("virya_weekday_pattern").select("pattern_id, offsets"),
    client.from("virya_role_sequence").select("session_count, roles"),
    client.from("virya_role_weight").select("role, phase, weight"),
    client.from("virya_archetype_catalog_match").select("archetype_id, preset_ids, tags_any"),
    client.from("virya_discipline_map").select("virya_label, catalog_discipline"),
  ]);

  if (patternRes.error) throw new Error(`virya_weekday_pattern: ${patternRes.error.message}`);
  if (sequenceRes.error) throw new Error(`virya_role_sequence: ${sequenceRes.error.message}`);
  if (weightRes.error) throw new Error(`virya_role_weight: ${weightRes.error.message}`);

  const weekdayPatterns: Record<string, number[]> = {};
  for (const row of (patternRes.data ?? []) as Array<Record<string, unknown>>) {
    const id = String(row.pattern_id ?? "").trim();
    const offsets = asIntArray(row.offsets);
    if (id && offsets.length) weekdayPatterns[id] = offsets;
  }

  const roleSequences: Record<number, string[]> = {};
  for (const row of (sequenceRes.data ?? []) as Array<Record<string, unknown>>) {
    const count = Math.round(Number(row.session_count));
    const roles = asStringArray(row.roles);
    if (Number.isFinite(count) && count >= 1 && roles.length) roleSequences[count] = roles;
  }

  const roleWeights: Record<string, number> = {};
  for (const row of (weightRes.data ?? []) as Array<Record<string, unknown>>) {
    const role = String(row.role ?? "").trim();
    const phase = String(row.phase ?? "").trim();
    const weight = Number(row.weight);
    if (role && phase && Number.isFinite(weight) && weight > 0) {
      roleWeights[`${role}|${phase}`] = weight;
    }
  }

  if (!Object.keys(weekdayPatterns).length) throw new Error("virya_weekday_pattern vuota: config L2 assente");
  if (!Object.keys(roleSequences).length) throw new Error("virya_role_sequence vuota: config L2 assente");
  if (!Object.keys(roleWeights).length) throw new Error("virya_role_weight vuota: config L2 assente");

  // Mappe opzionali: errore di lettura o tabella vuota → null (fallback catena hardcoded).
  let archetypeRules: Record<string, ViryaCatalogMatchRule> | null = null;
  if (!archetypeRes.error) {
    const rules: Record<string, ViryaCatalogMatchRule> = {};
    for (const row of (archetypeRes.data ?? []) as Array<Record<string, unknown>>) {
      const id = String(row.archetype_id ?? "").trim();
      if (!id) continue;
      rules[id] = {
        presetIds: asStringArray(row.preset_ids),
        tagsAny: asStringArray(row.tags_any),
      };
    }
    if (Object.keys(rules).length) archetypeRules = rules;
  }

  let disciplineMap: Record<string, string> | null = null;
  if (!disciplineRes.error) {
    const map: Record<string, string> = {};
    for (const row of (disciplineRes.data ?? []) as Array<Record<string, unknown>>) {
      const label = String(row.virya_label ?? "").trim().toLowerCase();
      const catalog = String(row.catalog_discipline ?? "").trim();
      if (label && catalog) map[label] = catalog;
    }
    if (Object.keys(map).length) disciplineMap = map;
  }

  return { weekdayPatterns, roleSequences, roleWeights, archetypeRules, disciplineMap };
}
