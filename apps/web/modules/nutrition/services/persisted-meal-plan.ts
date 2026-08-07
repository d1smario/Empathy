import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntelligentMealPlanResponseBody } from "@/lib/nutrition/intelligent-meal-plan-types";

/**
 * Pagina Nutrizione READ-FIRST (decisione 8 ago): il piano PERSISTITO è la verità,
 * la generazione è un EVENTO (prima volta, ripianificazione settimanale, azioni
 * esplicite) — non un effetto collaterale dell'apertura pagina.
 *
 * Questo modulo è volutamente puro/browser-safe: lettura diretta browser→Supabase
 * (architettura DB-first, RLS select_own/coach su nutrition_plan) + gating puro
 * testabile con node:test. NIENTE import Next.
 */

/** Shape minima renderizzabile — le STESSE condizioni di parseMealPlanResponse
 *  (intelligent-meal-plan-api): un payload che non le supera non va mai in pagina. */
export function isRenderableMealPlanPayload(j: unknown): j is IntelligentMealPlanResponseBody {
  if (!j || typeof j !== "object" || Array.isArray(j)) return false;
  const o = j as Partial<IntelligentMealPlanResponseBody>;
  return (
    (o.layer === "deterministic_meal_assembly_v1" || o.layer === "db_engine_v1") &&
    Array.isArray(o.slots) &&
    Boolean(o.solverBasis) &&
    o.solverBasis?.source === "nutrition_meal_plan_solver"
  );
}

/**
 * Legge da nutrition_plan.response_payload la risposta V1-mappata completa persistita
 * dall'ultima generazione per (atleta, giorno). Client browser standard (RLS: l'atleta
 * legge il proprio piano, il coach quello dei suoi atleti).
 *
 * Ritorna `null` in TUTTI i casi degradabili — riga assente, payload NULL (piani
 * pre-migration: la pagina genera UNA volta, il persist scrive il payload e dalle
 * aperture successive si legge → self-healing), payload malformato, errore di rete o
 * colonna non ancora migrata. La pagina degrada a generazione: mai un errore bloccante.
 */
export async function loadPersistedMealPlanPayload(
  supabase: SupabaseClient,
  athleteId: string,
  planDate: string,
): Promise<IntelligentMealPlanResponseBody | null> {
  if (!athleteId || !planDate) return null;
  try {
    // Il persist fa replace per (athlete_id, plan_date) quindi la riga è di fatto unica;
    // order+limit difende comunque da eventuali doppioni storici (stesso pattern della route).
    const { data, error } = await supabase
      .from("nutrition_plan")
      .select("response_payload")
      .eq("athlete_id", athleteId)
      .eq("plan_date", planDate)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[nutrition read-first] lettura piano persistito fallita:", error.message);
      return null;
    }
    const payload = (data as { response_payload?: unknown } | null)?.response_payload ?? null;
    return isRenderableMealPlanPayload(payload) ? payload : null;
  } catch (e) {
    console.error("[nutrition read-first] lettura piano persistito fallita:", e);
    return null;
  }
}

/** Esito della lettura read-first per (atleta, giorno): `found` = payload idratato in pagina. */
export type MealPlanPersistedProbe = { key: string; found: boolean } | null;

/** Chiave del probe: lega l'esito della lettura alla coppia (atleta, giorno) corrente,
 *  così un probe stantìo (data appena cambiata) non può MAI sbloccare la generazione. */
export function mealPlanProbeKey(athleteId: string, planDate: string): string {
  return `${athleteId}|${planDate}`;
}

/**
 * Gate PURO dell'auto-generazione (estratto dalla vista per essere testabile):
 * la generazione parte SOLO quando la lettura del persistito ha risposto (probe
 * presente e della coppia atleta/giorno corrente) E non ha trovato payload.
 * MAI generazione con payload presente; MAI race lettura/generazione (probe assente
 * o di un altro giorno → si aspetta).
 */
export function shouldAutoGenerateMealPlan(args: {
  /** Richiesta pronta (athleteId+profilo+request costruita). */
  requestReady: boolean;
  /** Esito lettura persistito; null = lettura non ancora risposta. */
  probe: MealPlanPersistedProbe;
  /** Chiave attesa per (atleta, giorno) correnti. */
  expectedProbeKey: string;
  /** Piano già in memoria (idratato dal DB o appena generato). */
  hasPlanInMemory: boolean;
  /** Generazione già in corso. */
  generationLoading: boolean;
  /** Ultima generazione fallita (niente retry-loop: resta il bottone manuale). */
  generationErrored: boolean;
}): boolean {
  if (!args.requestReady) return false;
  if (args.hasPlanInMemory || args.generationLoading || args.generationErrored) return false;
  return args.probe != null && args.probe.key === args.expectedProbeKey && !args.probe.found;
}
