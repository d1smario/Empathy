import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import type { PlannedWorkoutInsertPayload } from "@/lib/training/planned/clamp-planned-row";
import { buildPlannedNotesWithSizeGuard } from "@/lib/training/planned/notes-size-guard";
import { denormalizedFieldsFromContract } from "@/lib/training/library/library-item-from-contract";

const LIBRARY_NOTES_PREFIX = "[PRO2_BUILDER_LIBRARY]";

export function contractToPlannedWorkoutRow(input: {
  athleteId: string;
  date: string;
  contract: Pro2BuilderSessionContract;
  libraryItemId?: string | null;
}): PlannedWorkoutInsertPayload {
  const contract: Pro2BuilderSessionContract = {
    ...input.contract,
    source: "builder",
  };
  const fields = denormalizedFieldsFromContract(contract);
  const meta = {
    v: 1,
    family: fields.family,
    discipline: fields.discipline,
    sessionName: contract.sessionName ?? "",
    libraryItemId: input.libraryItemId?.trim() || null,
  };
  const baseNotes = `${LIBRARY_NOTES_PREFIX}${JSON.stringify(meta)}`;
  // Guard 32k (blueprint F1 sezione C / T6): comprimere-poi-degradare, MAI slice — lo slice
  // cieco storico tagliava il JSON a metà e il contratto diventava imparsabile in silenzio.
  // SCELTA documentata: la firma resta infallibile perché i 4 chiamanti (route apply-preset e
  // clone, CalendarSessionEditModal client-side, applyCoachLibraryTemplate) si aspettano sempre
  // un payload valido; sul caso estremo (incomprimibile > limite) salviamo la SOLA riga meta —
  // il calendario rende comunque dai campi denormalizzati — e lo segnaliamo con console.error.
  // La futura EF L2 usa invece il ramo {ok:false} dell'helper per far fallire la singola seduta.
  const guarded = buildPlannedNotesWithSizeGuard({ metaLine: baseNotes, contract });
  let notes: string;
  if (guarded.ok) {
    if (guarded.compressed) {
      console.error(
        "[contract-to-planned-row] notes oltre il limite: contratto compresso (campi opzionali rimossi)",
        { sessionName: meta.sessionName, family: meta.family },
      );
    }
    notes = guarded.notes;
  } else {
    console.error(
      "[contract-to-planned-row] contract_too_large anche dopo compressione: ometto il contratto strutturato dalle notes",
      { sessionName: meta.sessionName, family: meta.family, length: guarded.length },
    );
    notes = baseNotes;
  }
  return {
    athlete_id: input.athleteId.trim(),
    date: input.date.trim().slice(0, 10),
    type: `pro2_builder_${fields.family}`.slice(0, 120),
    duration_minutes: fields.durationMinutes,
    tss_target: fields.tssTarget,
    kcal_target:
      contract.summary?.kcal != null && Number.isFinite(contract.summary.kcal)
        ? Math.round(contract.summary.kcal)
        : null,
    notes,
  };
}
