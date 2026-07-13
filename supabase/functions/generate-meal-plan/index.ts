import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import "./env-shim.ts"; // deve precedere l'import del bundle (mappa process.env → Deno.env)
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  prepareIntelligentMealPlanContext,
  buildMealPlanV2Production,
  mapV2PlanToV1Response,
  persistV2PlanToDb,
  attachSolverBasisToAssembled,
  canAccessAthleteData,
} from "./nutrition-v2-engine.mjs";

// Nutrition V2 meal-plan generator — motore V2 (bundle di apps/web/lib/nutrition/v2)
// eseguito DENTRO Supabase. Auth chiamante (JWT utente → canAccessAthleteData) → compone
// il piano V2, lo persiste in nutrition_plan/meal/meal_item (fonte unica letta anche da
// Oggi) e RESTITUISCE la risposta piena renderizzabile (stessa shape della route Next).
//
// Il bundle nutrition-v2-engine.mjs si rigenera con ./_build.sh.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceKey || !anonKey) return json({ error: "env Supabase mancante" }, 500);

    const body = await req.json().catch(() => ({}));
    const athleteId = String(body?.athleteId ?? "").trim();
    if (!athleteId) return json({ error: "Missing athleteId" }, 400);

    // 0) Auth: valida il JWT utente e verifica l'accesso all'atleta (stesso gate della route Next).
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user ?? null;
    if (!user) return json({ error: "Non autenticato" }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const allowed = await canAccessAthleteData(admin, user.id, athleteId, null);
    if (!allowed) return json({ error: "Accesso atleta negato" }, 403);

    // 1) Contesto (profilo, planned_workouts→allenamento, diet day) 2) Compose V2
    const prepared = await prepareIntelligentMealPlanContext(admin, body);
    if ("error" in prepared) return json({ error: prepared.error }, prepared.status ?? 500);
    const { request, profileRow, dietDay, plannedSessions, ftp, weightKg, performanceIntegration } = prepared;

    const v2 = await buildMealPlanV2Production(
      {
        request,
        weightKg,
        ftpWatts: ftp,
        lifestyleActivityClass:
          profileRow?.lifestyle_activity_class != null ? String(profileRow.lifestyle_activity_class) : null,
        dietDayMealsScalePct: dietDay.dayTypePct,
        plannedSessions,
        dietDay,
        performanceIntegration: performanceIntegration ?? null,
      },
      admin,
    );
    const responseCore = await mapV2PlanToV1Response(v2, request);

    // 3) Persiste SEMPRE (replace per data) → il DB riflette SEMPRE l'ultima generazione del
    //    Piano ed è la fonte unica letta da Oggi. Prima persisteva solo alla prima volta (o su
    //    «Rigenera»): cambi a peso/allenamento/diet aggiornavano il render del Piano ma NON il
    //    DB → Oggi mostrava un piano stantìo diverso dal Piano. La generazione è deterministica
    //    per (atleta, data) e il persist fa REPLACE, quindi ripersistere è idempotente.
    const persisted = await persistV2PlanToDb(admin, athleteId, request.planDate, v2, {
      hydrationMlTarget: weightKg != null ? Math.round(weightKg * 35) : null,
    });
    if (!persisted.ok) return json({ error: persisted.error }, 500);

    // 4) Risposta piena renderizzabile — identica alla route Next (attachSolverBasis + lever line V2).
    const engineLeverLines = ["Motore Nutrition V2 (USDA FDC taggato + fueling substrati)."];
    const solverMeta = request.mealPlanSolverMeta ?? { integrationLeverLines: [] };
    const full = attachSolverBasisToAssembled(responseCore, {
      ...request,
      mealPlanSolverMeta: {
        ...solverMeta,
        integrationLeverLines: [...(solverMeta.integrationLeverLines ?? []), ...engineLeverLines].slice(0, 16),
      },
    });
    return json(full);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
