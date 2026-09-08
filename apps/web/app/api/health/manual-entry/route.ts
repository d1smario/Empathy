import { NextRequest, NextResponse } from "next/server";
import {
  AthleteReadContextError,
  requireAthleteWriteContext,
  requireAuthenticatedTrainingUser,
} from "@/lib/auth/athlete-read-context";
import { HEALTH_MARKERS } from "@/lib/health/health-ontology";
import {
  buildManualMarkerCatalog,
  buildManualStagingPatches,
  validateManualLabEntryBatch,
  validateManualSampleDate,
  type ManualLabEntryInput,
} from "@/lib/health/manual-lab-entry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * PRO2 — **Inserimento manuale di un referto**.
 *
 * Perché serve: `decodeHealthDocument` legge solo i PDF testuali. Una foto del referto o un PDF
 * scansionato arrivano a `needs_manual_review` con `parsed = {}`, senza staging run: il pannello
 * nasce vuoto e non c'è modo di recuperarlo. Questa rotta è la via manuale — l'atleta digita quello
 * che ha sul foglio.
 *
 * **Non apre porte laterali al gate di conferma.** Qui si scrive SOLO una *proposta*:
 * `biomarker_panels` senza valori canonici (i numeri stanno in `values.import.manual_entry`, che i
 * reader di Health ignorano) + un `interpretation_staging_runs` in `pending_validation` con patch
 * nella stessa forma di quelle VLM. La promozione ad archivio clinico resta dove era, dietro
 * `decideHealthStagingConfirmation` in `POST /api/health/staging-runs/[id]/apply`.
 *
 * L'unità è obbligatoria, è scelta da un **menù curato per marcatore** (solo le scritture che si
 * vedono davvero sui referti) e viene **convertita** nella canonica prima di salvare; il valore
 * canonico deve poi cadere dentro l'intervallo di plausibilità del marcatore, altrimenti è
 * rifiutato nominando l'unità come causa probabile. Tutto in `lib/health/manual-lab-entry.ts`
 * (audit: emoglobina 156 g/L archiviata come 156 g/dL; ematocrito 45 dichiarato «L/L» → 4500 %).
 */

const ALLOWED_TYPES = new Set<string>([
  "blood",
  "hormones",
  "inflammation",
  "oxidative_stress",
  "epigenetics",
]);

function panelTypesWithMarkers(): string[] {
  return [...ALLOWED_TYPES].filter((t) => HEALTH_MARKERS.some((m) => m.panelType === t));
}

/** Vocabolario per la UI: marcatori noti + unità che ciascuno sa accettare. */
export async function GET(req: NextRequest) {
  try {
    await requireAuthenticatedTrainingUser(req);
    const url = new URL(req.url);
    const panelType = url.searchParams.get("panelType");
    const wanted = panelType && ALLOWED_TYPES.has(panelType) ? panelType : null;
    const markers = buildManualMarkerCatalog(HEALTH_MARKERS, wanted);
    return NextResponse.json(
      { ok: true as const, panelTypes: panelTypesWithMarkers(), markers },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "manual_entry_catalog_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      athleteId?: string;
      panelType?: string;
      sampleDate?: string;
      entries?: unknown;
      note?: string;
    };
    const athleteId = String(body.athleteId ?? "").trim();
    const panelType = String(body.panelType ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ ok: false as const, error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }
    if (!ALLOWED_TYPES.has(panelType)) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "invalid_panelType",
          message: `L'inserimento manuale è disponibile per: ${panelTypesWithMarkers().join(", ")}.`,
        },
        { status: 400, headers: NO_STORE },
      );
    }

    // Auth prima della validazione di merito: nessuna informazione sul vocabolario a chi non passa il gate.
    const { db, userId } = await requireAthleteWriteContext(req, athleteId);

    const dateCheck = validateManualSampleDate(body.sampleDate);
    if (!dateCheck.ok) {
      return NextResponse.json(
        { ok: false as const, error: dateCheck.error.code, message: dateCheck.error.message, errors: [dateCheck.error] },
        { status: 400, headers: NO_STORE },
      );
    }
    const sampleDate = dateCheck.date;

    const rawEntries = Array.isArray(body.entries) ? (body.entries as ManualLabEntryInput[]) : [];
    const catalog = buildManualMarkerCatalog(HEALTH_MARKERS, panelType);
    const validated = validateManualLabEntryBatch(rawEntries, catalog, { panelType });
    if (!validated.ok) {
      return NextResponse.json(
        {
          ok: false as const,
          error: validated.errors[0]?.code ?? "invalid_entries",
          message: validated.errors[0]?.message ?? "Valori non validi.",
          errors: validated.errors,
        },
        { status: 400, headers: NO_STORE },
      );
    }
    const entries = validated.entries;

    const nowIso = new Date().toISOString();
    const convertedCount = entries.filter((e) => e.converted).length;

    /**
     * I numeri stanno DENTRO `values.import` di proposito: `structuredValuesFieldCount` e i reader
     * di Health contano solo le chiavi di primo livello, quindi il pannello resta correttamente
     * «nessun valore canonico» finché il coach non conferma.
     */
    const values = {
      import: {
        filename: "inserimento-manuale",
        mime: "application/x-empathy-manual-entry",
        size_bytes: 0,
        status: "manual_entry",
        uploaded_at: nowIso,
        parsed_keys: [],
        vlm: null,
        note: "Valori digitati a mano dal referto. Restano una proposta finché il coach non li conferma.",
        manual_entry: {
          entered_at: nowIso,
          entered_by: userId,
          entry_count: entries.length,
          converted_count: convertedCount,
          user_note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null,
          entries: entries.map((e) => ({
            field: e.markerKey,
            label: e.label,
            /**
             * La stringa **digitata**, non solo il numero già interpretato: senza di essa nemmeno
             * il coach può accorgersi che «250.000» è stato letto in un modo invece che nell'altro.
             */
            entered_text: e.enteredText,
            entered_value: e.enteredValue,
            entered_unit: e.enteredUnit,
            canonical_value: e.canonicalValue,
            canonical_unit: e.canonicalUnit,
            converted: e.converted,
          })),
        },
      },
    };

    const { data: inserted, error: panelErr } = await db
      .from("biomarker_panels")
      .insert({
        athlete_id: athleteId,
        type: panelType,
        sample_date: sampleDate,
        source: "health_manual_entry_v1",
        values,
      })
      .select("id")
      .maybeSingle();
    if (panelErr) {
      return NextResponse.json({ ok: false as const, error: panelErr.message }, { status: 500, headers: NO_STORE });
    }
    const panelId = inserted?.id ?? null;
    if (!panelId) {
      return NextResponse.json({ ok: false as const, error: "panel_insert_failed" }, { status: 500, headers: NO_STORE });
    }

    const patches = buildManualStagingPatches(entries, panelType);
    const { data: run, error: runErr } = await db
      .from("interpretation_staging_runs")
      .insert({
        athlete_id: athleteId,
        domain: "health",
        status: "pending_validation",
        trigger_source: "health_manual_entry",
        source_refs: [{ table: "biomarker_panels", id: panelId }],
        candidate_bundle: {
          panel_type: panelType,
          sample_date: sampleDate,
          manual_entry: true,
          entered_by: userId,
          field_count: entries.length,
          converted_count: convertedCount,
        },
        proposed_structured_patches: patches,
        confidence: 1,
      })
      .select("id")
      .maybeSingle();

    if (runErr || !run?.id) {
      // Senza staging run il pannello sarebbe un orfano invisibile: meglio non lasciarlo.
      await db.from("biomarker_panels").delete().eq("id", panelId).eq("athlete_id", athleteId);
      return NextResponse.json(
        { ok: false as const, error: runErr?.message ?? "staging_run_insert_failed" },
        { status: 500, headers: NO_STORE },
      );
    }

    const stagingRunId = String(run.id);
    return NextResponse.json(
      {
        ok: true as const,
        panelId,
        stagingRunId,
        reviewUrl: `/health/staging/${stagingRunId}`,
        entryCount: entries.length,
        convertedCount,
        message:
          `${entries.length} ${entries.length === 1 ? "valore inserito" : "valori inseriti"} a mano` +
          (convertedCount ? ` (${convertedCount} convertiti nell'unità canonica)` : "") +
          ". Ora servono la revisione e la conferma del coach.",
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "health_manual_entry_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
