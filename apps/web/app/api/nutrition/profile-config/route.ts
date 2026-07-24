import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { writeAthleteMemoryDomainPatch } from "@/lib/memory/athlete-memory-domain-writer";
import { sanitizeNutritionConfigPercentsForAthlete } from "@/lib/profile/sanitize-nutrition-config-percents";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      athleteId?: string;
      nutrition_config?: Record<string, unknown>;
      routine_config?: Record<string, unknown>;
    };
    const athleteId = (body.athleteId ?? "").trim();
    if (!athleteId) return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    // Gate canonico atleta (owner / coach / platform admin): prima era scrivibile da chiunque.
    const { db, role, isPlatformAdmin } = await requireAthleteWriteContext(req, athleteId);

    // ITEM 4 — enforcement server delle % nutrizione: il writer fa un REPLACE integrale di
    // `nutrition_config`, quindi un atleta (né coach né platform admin) potrebbe azzerare o
    // riscrivere le % impostate dal coach con una fetch manuale. Qui il payload viene
    // sanitizzato contro il config corrente: le % restano quelle del DB, il resto passa.
    // Si applica anche con `nutrition_config` assente (il replace con {} le cancellerebbe).
    let nutritionConfig = body.nutrition_config;
    let nutritionPercentsEnforced = false;
    const callerIsPrivileged = role === "coach" || isPlatformAdmin;
    if (!callerIsPrivileged) {
      const { data: row, error: readError } = await db
        .from("athlete_profiles")
        .select("nutrition_config")
        .eq("id", athleteId)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      const stored = (row as { nutrition_config?: unknown } | null)?.nutrition_config ?? {};
      const sanitized = sanitizeNutritionConfigPercentsForAthlete(body.nutrition_config, stored);
      nutritionConfig = sanitized.config;
      nutritionPercentsEnforced = sanitized.changed;
    }

    const result = await writeAthleteMemoryDomainPatch({
      domain: "nutrition",
      action: "config",
      athleteId,
      nutritionConfig,
      routineConfig: body.routine_config,
    });
    return NextResponse.json({
      status: result.status,
      athleteMemory: result.athleteMemory,
      ...(nutritionPercentsEnforced ? { nutritionPercentsEnforced: true } : {}),
    });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Nutrition profile config update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
