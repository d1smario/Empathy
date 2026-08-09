/**
 * ITEM 4 — Enforcement SERVER delle % nutrizione (l'atleta NON le scrive).
 *
 * PERCHÉ: il gate UI (`canEditNutritionPercents` in ProfilePageView) è solo client e
 * aggirabile con una fetch manuale. Le % che il coach imposta nel Profilo → Diet
 * (distribuzione calorica pasti, macro giornalieri, macro custom per-pasto) guidano la
 * GENERAZIONE del piano: un atleta non deve poterle alterare né azzerare.
 *
 * Questo helper è PURO (nessun import server-only) così è testabile con `tsx --test`:
 * riceve il `nutrition_config` in ingresso dal client e quello ATTUALE dal DB, e
 * restituisce una copia dell'ingresso in cui i campi protetti sono forzati ai valori
 * correnti (o rimossi se oggi non esistono). Tutto il resto (meal_count_mode,
 * excluded_fdc_foods, excluded_food_classes, prep_time, meal_strategy, …) resta
 * scrivibile dall'atleta: il layer reintegro/riduzione non passa di qui e non è toccato.
 *
 * NOTA ARCHITETTURALE (rischio futuro): oggi TUTTI i write di `nutrition_config` passano
 * dalle API route Next (PUT/POST /api/profile, PATCH /api/nutrition/profile-config) con
 * service role: nessun write diretto browser→Supabase su `athlete_profiles`. Se il
 * refactor DB-first sposterà i profili su write client diretti, questo enforcement a
 * livello route NON basterà più: servirà un trigger Postgres che preserva i campi per i
 * non-privilegiati (pattern `is_platform_admin` / `coach_athletes` già in RLS) con
 * bypass per service role (`auth.uid() IS NULL`).
 */

type JsonRecord = Record<string, unknown>;

/**
 * Campi protetti PER GIORNO dentro `week_plan[Mon…Sun]`.
 * `caloric_split` a livello giorno è incluso perché `resolve-nutrition-diet-day.ts`
 * lo legge come alias della distribuzione calorica (readCaloricDistribution).
 *
 * `day_type_pct` è LA LEVA DELLA STRATEGIA (ipo | normo | iper): scala il fabbisogno
 * del giorno in `daily-energy-solver` (dietScale). Nel modello nuovo la sceglie SOLO il
 * coach, quindi va protetta come le altre percentuali. `day_type` (preset testuale) è
 * inerte ma è l'etichetta della stessa scelta: si protegge insieme, altrimenti l'atleta
 * potrebbe lasciarla incoerente con la percentuale.
 */
const DAY_PROTECTED_KEYS = [
  "caloric_distribution",
  "daily_macros",
  "meal_macro_custom",
  "caloric_split",
  "day_type_pct",
  "day_type",
] as const;

/** Chiavi legacy alla RADICE del config, lette da `readFromLegacyRoot` (resolve-nutrition-diet-day.ts). */
const ROOT_PROTECTED_KEYS = ["caloric_split", "macro_split"] as const;

/** Chiavi legacy dentro `meal_plan`, lette da `readFromLegacyRoot` (resolve-nutrition-diet-day.ts). */
const MEAL_PLAN_PROTECTED_KEYS = ["caloric_split", "macro_split"] as const;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

/** JSONB a volte arriva come stringa da API/cache — stessa tolleranza di `parseNutritionConfigRecord`. */
function parseConfigRecord(value: unknown): JsonRecord {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return asRecord(JSON.parse(trimmed) as unknown);
    } catch {
      return {};
    }
  }
  return asRecord(value);
}

/** Uguaglianza profonda su valori JSON (ordine chiavi irrilevante) per calcolare `changed`. */
function deepJsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepJsonEqual(item, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ra = a as JsonRecord;
    const rb = b as JsonRecord;
    const keysA = Object.keys(ra);
    const keysB = Object.keys(rb);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((k) => Object.prototype.hasOwnProperty.call(rb, k) && deepJsonEqual(ra[k], rb[k]));
  }
  return false;
}

/** Forza le chiavi protette di `target` ai valori di `source` (o le rimuove se assenti in `source`). */
function applyProtectedKeys(target: JsonRecord, source: JsonRecord, keys: readonly string[]): void {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      target[key] = source[key];
    } else {
      delete target[key];
    }
  }
}

export type SanitizedNutritionConfigResult = {
  /** Config da persistere al posto di quello in ingresso. */
  config: JsonRecord;
  /** `true` se l'enforcement ha modificato qualcosa rispetto all'ingresso (per il warning in risposta). */
  changed: boolean;
};

/**
 * Sanitizza il `nutrition_config` in ingresso da un caller NON privilegiato (né coach né
 * platform admin): le % restano quelle correnti del DB, il resto passa invariato.
 *
 * Va chiamata anche quando l'ingresso è `undefined`/vuoto: il writer nutrition fa un
 * REPLACE integrale di `nutrition_config`, quindi senza questo passaggio un atleta
 * potrebbe azzerare tutte le % del coach semplicemente omettendo il campo.
 */
export function sanitizeNutritionConfigPercentsForAthlete(
  incoming: unknown,
  stored: unknown,
): SanitizedNutritionConfigResult {
  const inc = parseConfigRecord(incoming);
  const sto = parseConfigRecord(stored);
  const out: JsonRecord = { ...inc };

  // 1) Chiavi legacy alla radice: sempre quelle del DB (o rimosse se il DB non le ha).
  applyProtectedKeys(out, sto, ROOT_PROTECTED_KEYS);

  // 2) Chiavi legacy dentro `meal_plan`: preserva le % correnti anche se l'atleta
  //    rimuove `meal_plan` per intero (le altre chiavi di meal_plan restano sue).
  const stoMealPlan = asRecord(sto.meal_plan);
  const storedHasMealPlanPercents = MEAL_PLAN_PROTECTED_KEYS.some((k) =>
    Object.prototype.hasOwnProperty.call(stoMealPlan, k),
  );
  if (Object.prototype.hasOwnProperty.call(inc, "meal_plan") || storedHasMealPlanPercents) {
    const outMealPlan: JsonRecord = { ...asRecord(inc.meal_plan) };
    applyProtectedKeys(outMealPlan, stoMealPlan, MEAL_PLAN_PROTECTED_KEYS);
    if (Object.keys(outMealPlan).length > 0 || Object.prototype.hasOwnProperty.call(inc, "meal_plan")) {
      out.meal_plan = outMealPlan;
    }
  }

  // 3) `week_plan` giorno per giorno, sull'UNIONE dei giorni in ingresso e nel DB:
  //    se il coach ha configurato Mon–Sun e l'atleta manda solo alcuni giorni (o nessuno),
  //    i giorni mancanti vengono re-iniettati con le sole chiavi protette — il replace
  //    integrale del writer non deve far perdere le % del coach.
  const incWeek = asRecord(inc.week_plan);
  const stoWeek = asRecord(sto.week_plan);
  const dayKeys = new Set([...Object.keys(incWeek), ...Object.keys(stoWeek)]);
  if (Object.prototype.hasOwnProperty.call(inc, "week_plan") || dayKeys.size > 0) {
    const outWeek: JsonRecord = {};
    for (const day of dayKeys) {
      const dayInIncoming = Object.prototype.hasOwnProperty.call(incWeek, day);
      const stoDay = asRecord(stoWeek[day]);
      // Giorno assente nell'ingresso: l'atleta può togliere le SUE impostazioni del
      // giorno, ma le % del coach sopravvivono come giorno "solo protette".
      const outDay: JsonRecord = dayInIncoming ? { ...asRecord(incWeek[day]) } : {};
      applyProtectedKeys(outDay, stoDay, DAY_PROTECTED_KEYS);
      if (dayInIncoming || Object.keys(outDay).length > 0) outWeek[day] = outDay;
    }
    if (Object.keys(outWeek).length > 0 || Object.prototype.hasOwnProperty.call(inc, "week_plan")) {
      out.week_plan = outWeek;
    }
  }

  return { config: out, changed: !deepJsonEqual(out, inc) };
}
