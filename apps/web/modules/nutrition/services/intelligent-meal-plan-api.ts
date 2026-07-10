import type { IntelligentMealPlanRequest, IntelligentMealPlanResponseBody } from "@/lib/nutrition/intelligent-meal-plan-types";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

type MealPlanResult =
  | { ok: true; body: IntelligentMealPlanResponseBody }
  | { ok: false; error: string; status: number };

function parseMealPlanResponse(res: Response, j: { error?: string } & Partial<IntelligentMealPlanResponseBody>): MealPlanResult {
  if (!res.ok) {
    return { ok: false, error: j.error ?? `HTTP ${res.status}`, status: res.status };
  }
  if (
    (j.layer !== "deterministic_meal_assembly_v1" && j.layer !== "db_engine_v1") ||
    !Array.isArray(j.slots) ||
    !j.solverBasis ||
    j.solverBasis.source !== "nutrition_meal_plan_solver"
  ) {
    return { ok: false, error: "Risposta API non valida", status: 502 };
  }
  return { ok: true, body: j as IntelligentMealPlanResponseBody };
}

/**
 * Chiama la Edge Function Supabase `generate-meal-plan`: il motore V2 gira DENTRO
 * Supabase, persiste il piano in nutrition_plan/meal/meal_item (fonte unica letta
 * anche da Oggi) e restituisce la risposta piena. Auth = JWT utente (Authorization).
 */
async function callEdgeMealPlan(athleteId: string, plan: IntelligentMealPlanRequest): Promise<MealPlanResult> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon) return { ok: false, error: "Supabase non configurato", status: 0 };
  const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json", apikey: anon });
  const res = await fetchWithTimeout(`${base}/functions/v1/generate-meal-plan`, {
    method: "POST",
    cache: "no-store",
    headers,
    body: JSON.stringify({ athleteId, plan }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string } & Partial<IntelligentMealPlanResponseBody>;
  return parseMealPlanResponse(res, j);
}

/** Fallback: route Next (stesso motore V2) se la Edge Function è irraggiungibile. */
async function callNextMealPlan(athleteId: string, plan: IntelligentMealPlanRequest): Promise<MealPlanResult> {
  const res = await fetchWithTimeout("/api/nutrition/intelligent-meal-plan", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ athleteId, plan }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string } & Partial<IntelligentMealPlanResponseBody>;
  return parseMealPlanResponse(res, j);
}

export async function fetchIntelligentMealPlan(
  athleteId: string,
  plan: IntelligentMealPlanRequest,
): Promise<MealPlanResult> {
  // Primario: Edge Function (DB-first). Fallback alla route Next solo se l'edge è
  // irraggiungibile o restituisce una risposta non valida — così la pagina non si rompe
  // durante il rollout. Auth/atleta hanno lo stesso gate sui due lati.
  try {
    const edge = await callEdgeMealPlan(athleteId, plan);
    if (edge.ok) return edge;
    // Errori "legittimi" del chiamante (auth/accesso/validazione): NON fare fallback,
    // la route Next darebbe lo stesso esito. Fallback solo su 5xx/edge rotta.
    if (edge.status === 401 || edge.status === 403 || edge.status === 400) return edge;
  } catch {
    /* edge irraggiungibile → fallback */
  }
  try {
    return await callNextMealPlan(athleteId, plan);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error", status: 0 };
  }
}
