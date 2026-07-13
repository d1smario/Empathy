import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { decompressTrainingImportBuffer } from "@/lib/training/import-parser";
import { parseStructuredPlannedWorkoutFromBuffer } from "@/lib/training/planned-structured-import";
import { resolveImportRenderProfileForAthlete } from "@/lib/training/physiology/resolve-import-render-profile";
import { resolveTrainingImportRoute } from "@/lib/training/training-import-routing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Parse-only (NIENTE scrittura DB) di una seduta strutturata (FIT workout / ZWO / ERG / MRC)
 * verso il contratto editabile del Builder. È il ponte «anteprima editabile» che mancava tra il
 * parser esistente e il Builder: il coach importa, RIVEDE/modifica i blocchi nell'editor manuale e
 * poi salva con il flusso normale «Rifinisci → Salva». A differenza di /api/training/import (che
 * inserisce subito una riga planned_workouts), qui non si persiste nulla.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const athleteId = String(form.get("athleteId") ?? "").trim();
    const fileEntry = form.get("file");
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
    }
    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400, headers: NO_STORE });
    }
    const file = fileEntry;

    // Autorizzazione coach: throwa AthleteReadContextError se non ha scrittura su questo atleta.
    await requireAthleteWriteContext(req, athleteId);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const route = resolveTrainingImportRoute({
      intent: "planned",
      fileName: file.name,
      mimeType: file.type,
      buffer: fileBuffer,
    });

    if (route.kind !== "planned_structured") {
      const hint =
        route.kind === "planned_program"
          ? "È un programma tabellare (CSV/JSON multi-seduta): importalo dal Calendario, non dal Builder."
          : "Non è una seduta strutturata (serve FIT workout / ZWO / ERG / MRC). I file di attività registrata (FIT/GPX/TCX) vanno importati come «eseguito».";
      return NextResponse.json({ error: hint }, { status: 400, headers: NO_STORE });
    }

    const { effectiveName, payload } = decompressTrainingImportBuffer({
      fileName: file.name,
      mimeType: file.type ?? "",
      buffer: fileBuffer,
    });
    const renderProfile = await resolveImportRenderProfileForAthlete(athleteId);
    const parsed = await parseStructuredPlannedWorkoutFromBuffer({
      fileName: effectiveName,
      buffer: payload,
      format: route.format,
      renderProfile,
    });

    return NextResponse.json(
      {
        status: "ok" as const,
        contract: parsed.contract,
        sessionName: parsed.sessionName,
        discipline: parsed.discipline,
        sourceVendorTag: parsed.sourceVendorTag,
        format: route.format,
        intervalRows: parsed.intervalLadder.length,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Structured import parse failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
