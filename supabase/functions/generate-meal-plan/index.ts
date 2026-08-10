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
  computeDailyHydrationTargetMl,
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
        // Solo day-engine (shadow di default): massa magra→Katch + orario prima seduta.
        bodyFatPct: (profileRow?.body_fat_pct ?? null) as number | string | null,
        routineConfig: (profileRow?.routine_config ?? null) as Record<string, unknown> | null,
      },
      admin,
    );
    const responseCore = await mapV2PlanToV1Response(v2, request);

    // 3) Risposta piena renderizzabile PRIMA del persist — identica alla route Next
    //    (attachSolverBasis + lever line V2). È QUESTO il payload che la pagina renderizza
    //    e che si persiste in nutrition_plan.response_payload (pagina read-first, 8 ago):
    //    una sola scrittura col payload già mappato, niente update a due tempi.
    const engineLeverLines = ["Motore Nutrition V2 (USDA FDC taggato + fueling substrati)."];
    const solverMeta = request.mealPlanSolverMeta ?? { integrationLeverLines: [] };
    const full = attachSolverBasisToAssembled(responseCore, {
      ...request,
      mealPlanSolverMeta: {
        ...solverMeta,
        integrationLeverLines: [...(solverMeta.integrationLeverLines ?? []), ...engineLeverLines].slice(0, 16),
      },
    });

    // 4) Persiste SEMPRE (replace per data) → il DB riflette SEMPRE l'ultima generazione del
    //    Piano ed è la fonte unica letta da Oggi. Prima persisteva solo alla prima volta (o su
    //    «Rigenera»): cambi a peso/allenamento/diet aggiornavano il render del Piano ma NON il
    //    DB → Oggi mostrava un piano stantìo diverso dal Piano. La generazione è deterministica
    //    per (atleta, data) e il persist fa REPLACE, quindi ripersistere è idempotente.
    // Idratazione: si persiste il target della FORMULA CANONICA (max(2200, peso×33) + extra solo
    // con seduta), la stessa delle superfici Oggi/Nutrizione — prima qui restava il vecchio peso×35.
    // Peso: weight_kg del profilo (nullable, come le superfici). `weightKg` del prepare è ora
    // anch'esso il valore MISURATO (null se assente): i default 250 W / 70 kg li mette il motore
    // V2, così la fascia di capacità intestinale non si alza su un FTP mai misurato.
    // Durata: somma delle plannedSessions risolte dal
    // prepare — è il contesto training del giorno che guida anche il fueling del motore (questo
    // path non ha l'«effettivo» con gli eseguiti, che esiste solo lato superfici).
    const profileWeightRaw = Number((profileRow as Record<string, unknown> | null)?.weight_kg);
    const hydrationWeightKg = Number.isFinite(profileWeightRaw) && profileWeightRaw > 0 ? profileWeightRaw : null;
    const hydrationSessionMin = plannedSessions.reduce(
      (sum: number, s: { durationMin: number }) => sum + Math.max(0, s.durationMin),
      0,
    );
    const persisted = await persistV2PlanToDb(admin, athleteId, request.planDate, v2, {
      hydrationMlTarget: computeDailyHydrationTargetMl({
        weightKg: hydrationWeightKg,
        sessionDurationMin: hydrationSessionMin,
      }).totalMl,
      responsePayload: full,
    });
    if (!persisted.ok) return json({ error: persisted.error }, 500);

    return json(full);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
