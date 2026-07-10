import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  prepareIntelligentMealPlanContext,
  buildMealPlanV2Production,
  persistV2PlanToDb,
} from "./nutrition-v2-engine.mjs";

// Nutrition V2 meal-plan generator — motore V2 (bundle di apps/web/lib/nutrition/v2)
// eseguito DENTRO Supabase. Legge profilo + planned_workouts (allenamento→cibi),
// compone il piano deterministico e lo persiste in nutrition_plan/meal/meal_item:
// UNICA fonte letta sia da Nutrizione sia da Oggi.
//
// Il bundle nutrition-v2-engine.mjs si rigenera con ./_build.sh (esbuild dal repo web).
//
// TODO(auth — Fase 4): verify_jwt=false come le altre function del progetto. Aggiungere
// il check del chiamante: JWT utente → accesso atleta (RLS/authz), oppure secret
// condiviso per chiamate server-to-server. Oggi accetta athleteId dal body con service-role.

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ ok: false, error: "env Supabase mancante" }, 500);
    const db = createClient(url, key);

    const body = await req.json().catch(() => ({}));
    const athleteId = String(body?.athleteId ?? "").trim();
    if (!athleteId) return json({ ok: false, error: "Missing athleteId" }, 400);

    // 1) Assembla il contesto (profilo, planned_workouts→influenza allenamento, diet day)
    const prepared = await prepareIntelligentMealPlanContext(db, body);
    if ("error" in prepared) return json({ ok: false, error: prepared.error }, prepared.status ?? 500);

    const { request, profileRow, dietDay, plannedSessions, ftp, weightKg, performanceIntegration } = prepared;

    // 2) Compone il piano V2 (deterministico per data)
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
      db,
    );

    // 3) Persiste (replace per data) se assente o su «Rigenera»
    const regenerate = body?.regenerate === true || (body?.plan && body.plan.regenerate === true);
    const { data: existing } = await db
      .from("nutrition_plan")
      .select("id")
      .eq("athlete_id", athleteId)
      .eq("plan_date", request.planDate)
      .limit(1)
      .maybeSingle();

    let planId: string | null = existing?.id ?? null;
    let action = "reused";
    if (!existing?.id || regenerate) {
      const persisted = await persistV2PlanToDb(db, athleteId, request.planDate, v2, {
        hydrationMlTarget: weightKg != null ? Math.round(weightKg * 35) : null,
      });
      if (!persisted.ok) return json({ ok: false, error: persisted.error }, 500);
      planId = persisted.planId;
      action = regenerate ? "regenerated" : "generated";
    }

    return json({
      ok: true,
      engine: "v2-edge",
      athleteId,
      planDate: request.planDate,
      slots: v2.composedMealPlan.length,
      action,
      planId,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
