import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { buildDeterministicMealPlanFromRequest } from "@/lib/nutrition/deterministic-meal-plan-from-request";
import { prepareIntelligentMealPlanContext } from "@/lib/nutrition/intelligent-meal-plan-route-prep";
import type {
  IntelligentMealPlanAssembledCore,
  IntelligentMealPlanItemOut,
  IntelligentMealPlanRequest,
  IntelligentMealPlanSlotOut,
  MealSlotKey,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import { MEAL_SLOT_KEYS } from "@/lib/nutrition/intelligent-meal-plan-types";
import { attachSolverBasisToAssembled } from "@/lib/nutrition/meal-plan-solver-basis";
import { computeDailyHydrationTargetMl } from "@/lib/nutrition/hydration-target";
import { buildMealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";
import { mapV2PlanToV1Response } from "@/lib/nutrition/v2/map-v2-plan-to-v1-response";
import { persistV2PlanToDb } from "@/lib/nutrition/v2/persist-v2-plan-to-db";
import {
  diffMealPlanEngines,
  logMealPlanEngineShadowDiff,
} from "@/lib/nutrition/v2/meal-plan-engine-shadow-log";
import { resolveNutritionMealPlanEngine } from "@/lib/nutrition/v2/resolve-nutrition-meal-plan-engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function parseNutritionConfig(row: Record<string, unknown> | null): Record<string, unknown> | null {
  const nc = row?.nutrition_config;
  if (!nc || typeof nc !== "object" || Array.isArray(nc)) return null;
  return nc as Record<string, unknown>;
}

/* ── Motore "db": piano persistito da public.generate_plan (nutrition_plan/meal/meal_item) ── */

type DbPlanRow = {
  id: string;
  kcal_target: number | null;
  carbs_g_target: number | null;
  protein_g_target: number | null;
  fat_g_target: number | null;
};

type DbMealRow = {
  id: string;
  slot: string;
  slot_order: number | null;
  kcal_target: number | null;
  carbs_g_target: number | null;
  protein_g_target: number | null;
  fat_g_target: number | null;
};

type DbMealItemRow = {
  meal_id: string;
  fdc_id: number | null;
  food_role: string | null;
  grams: number | null;
  kcal: number | null;
  carbs_g: number | null;
  protein_g: number | null;
  fat_g: number | null;
};

function isMealSlotKey(s: string): s is MealSlotKey {
  return (MEAL_SLOT_KEYS as readonly string[]).includes(s);
}

function macroRoleFromDbFoodRole(foodRole: string | null): IntelligentMealPlanItemOut["macroRole"] {
  switch (foodRole) {
    case "cho_complex":
    case "cho_simple":
      return "cho_heavy";
    case "protein_primary":
    case "protein_secondary":
      return "protein";
    case "fat":
    case "fat_condiment":
      return "fat";
    case "veg_condiment":
      return "veg";
    default:
      return "mixed";
  }
}

function functionalBridgeFromDbFoodRole(foodRole: string | null): string {
  switch (foodRole) {
    case "cho_complex":
      return "Carboidrato complesso del pasto (motore DB)";
    case "cho_simple":
      return "Carboidrato semplice / frutta del pasto (motore DB)";
    case "protein_primary":
      return "Proteina principale del pasto (motore DB)";
    case "protein_secondary":
      return "Proteina secondaria del pasto (motore DB)";
    case "fat":
      return "Fonte di grassi di qualità (motore DB)";
    case "fat_condiment":
      return "Condimento lipidico (motore DB)";
    case "veg_condiment":
      return "Verdura / contorno del pasto (motore DB)";
    default:
      return "Alimento del pasto (motore DB)";
  }
}

function mapDbMealItem(it: DbMealItemRow, foodNameByFdcId: Map<number, string>): IntelligentMealPlanItemOut {
  const fdcId = typeof it.fdc_id === "number" && Number.isFinite(it.fdc_id) ? it.fdc_id : null;
  const name = (fdcId != null ? foodNameByFdcId.get(fdcId) : undefined) ?? (fdcId != null ? `Alimento FDC ${fdcId}` : "Alimento");
  return {
    name,
    portionHint: `${Math.round(Number(it.grams ?? 0))} g`,
    functionalBridge: functionalBridgeFromDbFoodRole(it.food_role),
    approxKcal: Math.round(Number(it.kcal ?? 0)),
    macroRole: macroRoleFromDbFoodRole(it.food_role),
    compositionKey: fdcId != null ? `fdc:${fdcId}` : undefined,
  };
}

/** Legge il piano persistito (service role: RLS senza policy utente su nutrition_plan/meal/meal_item) e lo mappa nella shape UI. */
async function readDbPlanAsAssembledCore(
  admin: SupabaseClient,
  planId: string,
  request: IntelligentMealPlanRequest,
): Promise<{ core: IntelligentMealPlanAssembledCore } | { error: string }> {
  const { data: planRow, error: planErr } = await admin
    .from("nutrition_plan")
    .select("id, kcal_target, carbs_g_target, protein_g_target, fat_g_target")
    .eq("id", planId)
    .maybeSingle();
  if (planErr || !planRow) {
    return { error: `Piano DB non leggibile: ${planErr?.message ?? "riga assente"}` };
  }
  const plan = planRow as DbPlanRow;

  const { data: mealRows, error: mealErr } = await admin
    .from("meal")
    .select("id, slot, slot_order, kcal_target, carbs_g_target, protein_g_target, fat_g_target")
    .eq("plan_id", planId)
    .order("slot_order", { ascending: true });
  if (mealErr || !mealRows?.length) {
    return { error: `Pasti del piano DB non leggibili: ${mealErr?.message ?? "nessun pasto"}` };
  }
  const meals = mealRows as DbMealRow[];

  const { data: itemRows, error: itemErr } = await admin
    .from("meal_item")
    .select("meal_id, fdc_id, food_role, grams, kcal, carbs_g, protein_g, fat_g")
    .in("meal_id", meals.map((m) => m.id));
  if (itemErr) {
    return { error: `Voci del piano DB non leggibili: ${itemErr.message}` };
  }
  const items = (itemRows ?? []) as DbMealItemRow[];

  const fdcIds = [
    ...new Set(items.map((i) => i.fdc_id).filter((id): id is number => typeof id === "number" && Number.isFinite(id))),
  ];
  const foodNameByFdcId = new Map<number, string>();
  if (fdcIds.length) {
    const { data: foodRows, error: foodErr } = await admin
      .from("fdc_food")
      .select("fdc_id, description, image_url")
      .in("fdc_id", fdcIds);
    if (foodErr) {
      return { error: `Alimenti FDC del piano DB non leggibili: ${foodErr.message}` };
    }
    for (const row of (foodRows ?? []) as Array<{ fdc_id: number; description: string | null }>) {
      if (row.description) foodNameByFdcId.set(Number(row.fdc_id), row.description);
    }
  }

  const itemsByMealId = new Map<string, DbMealItemRow[]>();
  for (const it of items) {
    const list = itemsByMealId.get(it.meal_id) ?? [];
    list.push(it);
    itemsByMealId.set(it.meal_id, list);
  }

  const requestSlotMeta = new Map(request.slots.map((s) => [s.slot, s]));
  const slots: IntelligentMealPlanSlotOut[] = [];
  for (const meal of meals) {
    if (!isMealSlotKey(meal.slot)) continue;
    const meta = requestSlotMeta.get(meal.slot);
    const kcalTarget = Math.round(Number(meal.kcal_target ?? 0));
    slots.push({
      slot: meal.slot,
      targetKcalEcho: kcalTarget,
      items: (itemsByMealId.get(meal.id) ?? []).map((it) => mapDbMealItem(it, foodNameByFdcId)),
      slotCoherence: `Target pasto DB: ${kcalTarget} kcal · C ${Math.round(Number(meal.carbs_g_target ?? 0))} g · P ${Math.round(Number(meal.protein_g_target ?? 0))} g · G ${Math.round(Number(meal.fat_g_target ?? 0))} g.`,
      slotTimingRationale: meta?.scheduledTimeLocal
        ? `Pasto ${meta.labelIt} alle ${meta.scheduledTimeLocal} · piano persistito dal motore DB.`
        : `Pasto ${meal.slot} (ordine ${meal.slot_order ?? slots.length + 1}) · piano persistito dal motore DB.`,
    });
  }
  if (!slots.length) {
    return { error: "Piano DB senza pasti mappabili sugli slot UI" };
  }

  const totals = items.reduce(
    (acc, it) => {
      acc.kcal += Number(it.kcal ?? 0);
      acc.carbs += Number(it.carbs_g ?? 0);
      acc.protein += Number(it.protein_g ?? 0);
      acc.fat += Number(it.fat_g ?? 0);
      return acc;
    },
    { kcal: 0, carbs: 0, protein: 0, fat: 0 },
  );
  const dayInteractionSummary =
    `Totali effettivi: ${Math.round(totals.kcal)} kcal · C ${Math.round(totals.carbs)} g · P ${Math.round(totals.protein)} g · G ${Math.round(totals.fat)} g` +
    ` vs target ${Math.round(Number(plan.kcal_target ?? 0))} kcal · C ${Math.round(Number(plan.carbs_g_target ?? 0))} g · P ${Math.round(Number(plan.protein_g_target ?? 0))} g · G ${Math.round(Number(plan.fat_g_target ?? 0))} g · pasti: ${slots.length}.`;

  return {
    core: {
      layer: "db_engine_v1",
      disclaimer:
        "Piano generato dal motore nutrizionale Empathy nel database (alimenti USDA, qualità grassi 80% insaturi, rotazione famiglie proteiche). Non sostituisce parere medico.",
      slots,
      dayInteractionSummary,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
    }
    const athleteId = String(body.athleteId ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    }
    const { db } = await requireAthleteReadContext(req, athleteId);

    const prepared = await prepareIntelligentMealPlanContext(db, body);
    if ("error" in prepared) {
      return NextResponse.json({ error: prepared.error }, { status: prepared.status });
    }

    const { request, profileRow, dietDay, plannedSessions, ftp, weightKg, performanceIntegration } = prepared;
    const engine = resolveNutritionMealPlanEngine(parseNutritionConfig(profileRow));

    let responseCore;
    let dbPlanReused = false;
    /** Produzione V2 del ramo engine=v2: persistita DOPO l'assemblaggio finale, così
     *  nutrition_plan.response_payload riceve la STESSA risposta V1-mappata completa
     *  che questa route restituisce (pagina read-first, una sola scrittura). */
    let v2ProductionForPersist: Awaited<ReturnType<typeof buildMealPlanV2Production>> | null = null;
    const regenerate = body.regenerate === true || (isRecord(body.plan) && body.plan.regenerate === true);

    if (engine === "db") {
      const admin = createSupabaseAdminClient();
      if (!admin) {
        return NextResponse.json(
          { error: "Motore DB non disponibile: SUPABASE_SERVICE_ROLE_KEY mancante" },
          { status: 500 },
        );
      }
      const planDate = request.planDate;

      let planId: string | null = null;
      if (!regenerate) {
        const { data: existing, error: existingErr } = await admin
          .from("nutrition_plan")
          .select("id")
          .eq("athlete_id", athleteId)
          .eq("plan_date", planDate)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existingErr) {
          return NextResponse.json(
            { error: `Lettura piano DB fallita: ${existingErr.message}` },
            { status: 500 },
          );
        }
        if (existing?.id) {
          planId = String(existing.id);
          dbPlanReused = true;
        }
      }
      if (!planId) {
        const { data: generatedPlanId, error: rpcErr } = await admin.rpc("generate_plan", {
          p_athlete_id: athleteId,
          p_plan_date: planDate,
        });
        if (rpcErr || !generatedPlanId) {
          return NextResponse.json(
            { error: `generate_plan fallita: ${rpcErr?.message ?? "nessun plan id restituito"}` },
            { status: 500 },
          );
        }
        planId = String(generatedPlanId);
      }

      const dbCore = await readDbPlanAsAssembledCore(admin, planId, request);
      if ("error" in dbCore) {
        return NextResponse.json({ error: dbCore.error }, { status: 500 });
      }
      responseCore = dbCore.core;
    } else if (engine === "v2") {
      const v2Production = await buildMealPlanV2Production(
        {
          request,
          weightKg,
          ftpWatts: ftp,
          lifestyleActivityClass:
            profileRow?.lifestyle_activity_class != null
              ? String(profileRow.lifestyle_activity_class)
              : null,
          dietDayMealsScalePct: dietDay.dayTypePct,
          plannedSessions,
          dietDay,
          performanceIntegration: performanceIntegration ?? null,
          // Solo day-engine (shadow di default): massa magra→Katch + orario prima seduta.
          bodyFatPct: (profileRow?.body_fat_pct ?? null) as number | string | null,
          routineConfig: (profileRow?.routine_config ?? null) as Record<string, unknown> | null,
        },
        db,
      );
      responseCore = await mapV2PlanToV1Response(v2Production, request);
      v2ProductionForPersist = v2Production;
    } else if (engine === "shadow") {
      const [v1Core, v2Production] = await Promise.all([
        buildDeterministicMealPlanFromRequest(request),
        buildMealPlanV2Production(
          {
            request,
            weightKg,
            ftpWatts: ftp,
            lifestyleActivityClass:
              profileRow?.lifestyle_activity_class != null
                ? String(profileRow.lifestyle_activity_class)
                : null,
            dietDayMealsScalePct: dietDay.dayTypePct,
            plannedSessions,
            dietDay,
            performanceIntegration: performanceIntegration ?? null,
            // Solo day-engine (shadow di default): massa magra→Katch + orario prima seduta.
            bodyFatPct: (profileRow?.body_fat_pct ?? null) as number | string | null,
            routineConfig: (profileRow?.routine_config ?? null) as Record<string, unknown> | null,
          },
          db,
        ),
      ]);
      const v2Core = await mapV2PlanToV1Response(v2Production, request);
      logMealPlanEngineShadowDiff(
        diffMealPlanEngines(v1Core, v2Core),
        athleteId,
        request.planDate,
      );
      responseCore = v1Core;
    } else {
      responseCore = await buildDeterministicMealPlanFromRequest(request);
    }

    const engineLeverLines =
      engine === "db"
        ? [
            "Motore Nutrition DB (generate_plan Postgres, piano persistito).",
            ...(dbPlanReused
              ? ["Piano già generato per questa data: riuso (regenerate=true per rigenerare)."]
              : []),
          ]
        : [
            engine === "v2"
              ? "Motore Nutrition V2 (USDA FDC taggato + fueling substrati)."
              : engine === "shadow"
                ? "Shadow: V1 servito, V2 loggato."
                : "Motore Nutrition V1 (Mediterranean composer).",
          ];

    const assembledFull = attachSolverBasisToAssembled(responseCore, {
      ...request,
      mealPlanSolverMeta: {
        ...request.mealPlanSolverMeta,
        integrationLeverLines: [
          ...request.mealPlanSolverMeta.integrationLeverLines,
          ...engineLeverLines,
        ].slice(0, 16),
      },
    });

    // Unica fonte di verità (solo engine=v2): persiste il piano V2 (deterministico per
    // data) nelle tabelle canoniche, così la vista Oggi legge ESATTAMENTE quello che
    // mostra Nutrizione. Il persist avviene QUI, dopo l'assemblaggio, perché
    // nutrition_plan.response_payload deve contenere la risposta V1-mappata COMPLETA
    // (assembledFull), la stessa che la pagina read-first rilegge dal DB — una sola
    // scrittura, payload già mappato. Scrive alla generazione (piano assente), su
    // «Rigenera», o se il piano esiste ma è pre-migration senza payload (self-healing).
    // Best-effort: un errore di persistenza non deve rompere la risposta.
    if (engine === "v2" && v2ProductionForPersist) {
      const admin = createSupabaseAdminClient();
      if (admin) {
        try {
          const { data: existingPlan } = await admin
            .from("nutrition_plan")
            .select("id, response_payload")
            .eq("athlete_id", athleteId)
            .eq("plan_date", request.planDate)
            .limit(1)
            .maybeSingle();
          const existingRow = existingPlan as { id?: string; response_payload?: unknown } | null;
          if (!existingRow?.id || regenerate || existingRow.response_payload == null) {
            // Idratazione: formula CANONICA (max(2200, peso×33) + extra solo con seduta),
            // stessi input della Edge Function e delle superfici — peso = weight_kg del
            // profilo nullable (NON `weightKg` del prepare che ha fallback 70), durata =
            // somma plannedSessions. Questo è il fallback vivo quando la Edge non risponde:
            // deve persistere lo stesso valore che avrebbe scritto lei.
            const profileWeightRaw = Number((profileRow as Record<string, unknown> | null)?.weight_kg);
            const hydrationWeightKg =
              Number.isFinite(profileWeightRaw) && profileWeightRaw > 0 ? profileWeightRaw : null;
            const hydrationSessionMin = plannedSessions.reduce((sum, s) => sum + Math.max(0, s.durationMin), 0);
            const persisted = await persistV2PlanToDb(admin, athleteId, request.planDate, v2ProductionForPersist, {
              hydrationMlTarget: computeDailyHydrationTargetMl({
                weightKg: hydrationWeightKg,
                sessionDurationMin: hydrationSessionMin,
              }).totalMl,
              responsePayload: assembledFull,
            });
            if (!persisted.ok) console.error("[nutrition v2 persist]", persisted.error);
          }
        } catch (persistErr) {
          console.error("[nutrition v2 persist]", persistErr);
        }
      }
    }

    const res = NextResponse.json(assembledFull);
    res.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    return res;
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Intelligent meal plan error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
