/**
 * Guard ≤32k sulle notes dei planned_workouts (blueprint F1 sezione C, task T6).
 *
 * PERCHÉ: la colonna notes viene troncata a ~32k (vedi clampPlannedWorkoutRow) e lo slice
 * cieco storico di contract-to-planned-row tagliava il JSON del contratto a metà →
 * BUILDER_SESSION_JSON imparsabile in silenzio (calendario/Oggi/round-trip perdevano la seduta
 * strutturata senza alcun segnale). Strategia DECISA: comprimere-poi-fallire, MAI troncare.
 *
 * Compressione = rimozione dei soli campi opzionali non strutturali (blueprint sezione C):
 * `blocks[].notes`, `mediaUrl` (blocco e lifestyleRx), `sessionInterpretation.coachPrompts/
 * facilitationHints`. MAI i blocchi né i chart: il render della seduta resta integro.
 *
 * Helper condiviso: oggi lo usa contract-to-planned-row, domani la Edge Function
 * `materialize-training-week` (L2) — che sul ramo {ok:false} fa fallire la singola seduta
 * con errore esplicito nel result invece di persistere spazzatura.
 */

import {
  BUILDER_SESSION_JSON_TAG,
  serializePro2BuilderSessionContract,
  type Pro2BuilderSessionContract,
} from "@/lib/training/builder/pro2-session-contract";

/**
 * Limite operativo SOTTO il tetto colonna (32000, clampPlannedWorkoutRow:35): margine di
 * sicurezza perché lo slice del clamp non deve MAI scattare su notes strutturate — se scatta,
 * il JSON torna imparsabile e il guard non è servito a niente.
 */
export const PLANNED_NOTES_MAX_CHARS = 30000;

export type PlannedNotesSizeGuardResult =
  | { ok: true; notes: string; compressed: boolean }
  | { ok: false; error: "contract_too_large"; length: number };

/**
 * Rimuove dal contratto i campi opzionali non necessari al render (descrizioni/note libere e
 * media), lasciando intatti blocchi, chart e prescrizioni: il round-trip Builder resta valido.
 * Opera sul contratto GIÀ preparato (sessionInterpretation attaccata): riusabile da test ed EF.
 */
export function compressPro2ContractForNotes(
  contract: Pro2BuilderSessionContract,
): Pro2BuilderSessionContract {
  const blocks = contract.blocks?.map((block) => {
    const { notes: _notes, mediaUrl: _mediaUrl, ...rest } = block;
    if (rest.lifestyleRx?.mediaUrl) {
      const { mediaUrl: _lifestyleMedia, ...lifestyleRx } = rest.lifestyleRx;
      return { ...rest, lifestyleRx };
    }
    return rest;
  });
  const sessionInterpretation = contract.sessionInterpretation
    ? { ...contract.sessionInterpretation, coachPrompts: [], facilitationHints: [] }
    : undefined;
  return {
    ...contract,
    ...(blocks ? { blocks } : {}),
    ...(sessionInterpretation ? { sessionInterpretation } : {}),
  };
}

/** Decodifica la riga serializzata (tag + URI-encoded JSON) nel contratto preparato. */
function decodeSerializedContract(serialized: string): Pro2BuilderSessionContract | null {
  if (!serialized.startsWith(BUILDER_SESSION_JSON_TAG)) return null;
  try {
    const json = JSON.parse(
      decodeURIComponent(serialized.slice(BUILDER_SESSION_JSON_TAG.length)),
    ) as unknown;
    if (!json || typeof json !== "object") return null;
    return json as Pro2BuilderSessionContract;
  } catch {
    return null;
  }
}

/**
 * Costruisce `notes` = metaLine + "\n" + contratto serializzato, garantendo ≤ PLANNED_NOTES_MAX_CHARS.
 * 1° tentativo: serializzazione piena. 2°: contratto compresso. Se ancora sfora → {ok:false},
 * MAI uno slice: un JSON troncato è corruzione silenziosa, un errore esplicito è gestibile.
 *
 * NOTA: la compressione ri-serializza a mano il JSON già preparato — ripassare da
 * serializePro2BuilderSessionContract rigenererebbe coachPrompts/facilitationHints
 * (preparePro2BuilderSessionContractForPersist li ricalcola sempre), annullando lo strip.
 */
export function buildPlannedNotesWithSizeGuard(input: {
  /** Riga meta già costruita dal chiamante (es. "[PRO2_BUILDER_LIBRARY]{...}" o "[PRO2_BUILDER_PLAN]{...}"). */
  metaLine: string;
  contract: Pro2BuilderSessionContract;
}): PlannedNotesSizeGuardResult {
  const serialized = serializePro2BuilderSessionContract(input.contract);
  const fullNotes = `${input.metaLine}\n${serialized}`;
  if (fullNotes.length <= PLANNED_NOTES_MAX_CHARS) {
    return { ok: true, notes: fullNotes, compressed: false };
  }

  const prepared = decodeSerializedContract(serialized);
  if (prepared) {
    const compressed = compressPro2ContractForNotes(prepared);
    const compressedLine = `${BUILDER_SESSION_JSON_TAG}${encodeURIComponent(JSON.stringify(compressed))}`;
    const compressedNotes = `${input.metaLine}\n${compressedLine}`;
    if (compressedNotes.length <= PLANNED_NOTES_MAX_CHARS) {
      return { ok: true, notes: compressedNotes, compressed: true };
    }
    return { ok: false, error: "contract_too_large", length: compressedNotes.length };
  }
  return { ok: false, error: "contract_too_large", length: fullNotes.length };
}
