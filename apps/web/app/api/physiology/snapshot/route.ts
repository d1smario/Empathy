import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { type PhysiologyProfileUpdate } from "@/lib/physiology/physiology-profile-upsert";
import {
  saveMetabolicSnapshot,
  type MetabolicSnapshotDb,
} from "@/lib/physiology/save-metabolic-snapshot";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      athleteId?: string;
      runSection?: "metabolic_profile" | "lactate_analysis" | "max_oxidate";
      modelVersion?: string;
      inputPayload?: Record<string, unknown>;
      outputPayload?: Record<string, unknown>;
      createdBy?: string | null;
      profileUpdate?: PhysiologyProfileUpdate | null;
    };
    const athleteId = (body.athleteId ?? "").trim();
    if (!athleteId || !body.runSection || !body.outputPayload || !body.inputPayload) {
      return NextResponse.json({ error: "Missing snapshot payload" }, { status: 400 });
    }

    const { db } = await requireAthleteWriteContext(req, athleteId);

    // Run di audit + riga di profilo: sequenza tutto-o-niente (il run viene rimosso se
    // l'upsert del profilo fallisce), altrimenti pagina Physiology e fueling restano
    // permanentemente su due FTP diversi. Logica + rollback sono in `save-metabolic-snapshot`,
    // coperti da test.
    const result = await saveMetabolicSnapshot(db as unknown as MetabolicSnapshotDb, {
      athleteId,
      runSection: body.runSection,
      modelVersion: body.modelVersion ?? "v0.2",
      inputPayload: body.inputPayload,
      outputPayload: body.outputPayload,
      createdBy: body.createdBy ?? null,
      profileUpdate: body.profileUpdate ?? null,
      nowIso: new Date().toISOString(),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, rolledBack: result.rolledBack }, { status: 500 });
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Physiology snapshot save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

