import { NextRequest, NextResponse } from "next/server";
import { TrainingRouteAuthError, requireTrainingAthleteWriteContext } from "@/lib/auth/training-route-auth";
import { loadAerobicStarterPresetsFromDb } from "@/lib/training/library/starter-pack-aerobic-db";
import { buildStarterContractFromPreset } from "@/lib/training/library/starter-pack-aerobic-helpers";
import { contractToPlannedWorkoutRow } from "@/lib/training/library/contract-to-planned-row";
import { insertSinglePlannedWorkout } from "@/lib/training/planned/insert-planned-workout";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function authError(err: unknown) {
  if (err instanceof TrainingRouteAuthError) {
    return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
  }
  const message = err instanceof Error ? err.message : "apply_preset_failed";
  return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
}

/**
 * Applica un preset Empathy (catalogo `aerobic_starter_presets`) come seduta pianificata su
 * atleta+giorno. Stesso gate coach→atleta di `items/[id]/apply` (`requireTrainingAthleteWriteContext`
 * → `canAccessAthleteData`): 403 se il coach non è collegato all'atleta. La scrittura passa SEMPRE
 * da `insertSinglePlannedWorkout` (dedupe fingerprint), mai insert diretto.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { presetId?: string; athleteId?: string; date?: string };
    const presetId = String(body.presetId ?? "").trim();
    const athleteId = String(body.athleteId ?? "").trim();
    const date = String(body.date ?? "").trim().slice(0, 10);
    if (!presetId || !athleteId || !date) {
      return NextResponse.json(
        { ok: false as const, error: "missing_preset_athlete_or_date" },
        { status: 400, headers: NO_STORE },
      );
    }

    const { db } = await requireTrainingAthleteWriteContext(req, athleteId);

    const presets = await loadAerobicStarterPresetsFromDb();
    const preset = presets.find((p) => p.presetId === presetId);
    if (!preset) {
      return NextResponse.json({ ok: false as const, error: "preset_not_found" }, { status: 404, headers: NO_STORE });
    }

    const contract = buildStarterContractFromPreset(preset);
    const row = contractToPlannedWorkoutRow({ athleteId, date, contract });
    const { id } = await insertSinglePlannedWorkout(db, row);

    return NextResponse.json({ ok: true as const, athleteId, date, id }, { headers: NO_STORE });
  } catch (err) {
    return authError(err);
  }
}
