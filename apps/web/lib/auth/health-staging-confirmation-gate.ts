/**
 * PRO2 — **Gate di conferma referti** (revisione → archivio).
 *
 * REGOLA (decisione di prodotto, 11 settembre 2026): **conferma chi ha inserito i valori,
 * chiunque sia** — l'atleta che ha caricato il proprio referto, il coach che lo ha caricato per
 * lui, l'amministratore.
 *
 * Prima (commit 3fe230a) confermava solo un coach approvato. Chiudeva una falla vera — l'atleta
 * confermava con scrittura privilegiata su tabelle che la RLS gli nega — ma lasciava fuori chi un
 * coach non ce l'ha: 13 atleti su 41, i cui valori restavano proposte per sempre e al motore non
 * arrivavano mai.
 *
 * Due cose rendono sicura la nuova regola:
 *  - l'identità si confronta per **user id** (`auth.uid()`), che il chiamante non può scriversi.
 *    Il ruolo — che l'utente può riscrivere sulla propria riga — qui non entra più;
 *  - la conferma accetta **solo i campi della proposta originale**, con valori plausibili
 *    (`lib/health/confirmed-patch-guard`). La scrittura privilegiata resta, ma non può più
 *    portare nel referto un campo che nessuno aveva proposto.
 *
 * Funzione **pura** di proposito: testabile con `node:test`, mai `server-only`.
 */

export type HealthStagingConfirmationCaller = {
  /** `auth.uid()` del chiamante. */
  callerUserId: string | null;
  /** Esito di `canAccessAthleteData` per l'atleta del referto: senza accesso non si conferma. */
  hasAthleteAccess: boolean;
  /** `app_user_profiles.is_platform_admin` (il trigger lo blinda). */
  isPlatformAdmin: boolean;
  /**
   * Chi ha inserito i valori: `interpretation_staging_runs.created_by`, con ripiego su
   * `candidate_bundle.entered_by` per le revisioni create prima che la colonna fosse scritta.
   * `null` = inserimento storico di cui non si sa l'autore.
   */
  insertedByUserId: string | null;
};

export type HealthStagingConfirmationDenialCode =
  | "athlete_access_required"
  | "not_the_inserter"
  | "inserter_unknown";

export type HealthStagingConfirmationDecision =
  | { allowed: true }
  | { allowed: false; status: 403; code: HealthStagingConfirmationDenialCode; error: string };

export const HEALTH_STAGING_ATHLETE_ACCESS_REQUIRED_MESSAGE =
  "Nessun accesso ai dati di questo atleta: la conferma richiede di poter vedere il suo referto.";

export const HEALTH_STAGING_NOT_THE_INSERTER_MESSAGE =
  "Questi valori li ha inseriti un'altra persona: la conferma spetta a chi li ha inseriti.";

export const HEALTH_STAGING_INSERTER_UNKNOWN_MESSAGE =
  "Di questo referto non si sa chi abbia inserito i valori: può confermarlo solo un " +
  "amministratore della piattaforma.";

function sameUser(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = typeof a === "string" ? a.trim().toLowerCase() : "";
  const right = typeof b === "string" ? b.trim().toLowerCase() : "";
  return left !== "" && left === right;
}

/**
 * Chi ha inserito i valori di una revisione. La colonna vince; il campo nel bundle copre le
 * revisioni dell'inserimento manuale create prima che la colonna venisse scritta.
 */
export function resolveStagingInsertedBy(run: {
  created_by?: unknown;
  candidate_bundle?: unknown;
}): string | null {
  if (typeof run.created_by === "string" && run.created_by.trim()) return run.created_by.trim();
  const bundle =
    run.candidate_bundle && typeof run.candidate_bundle === "object"
      ? (run.candidate_bundle as Record<string, unknown>)
      : null;
  const enteredBy = bundle?.entered_by;
  return typeof enteredBy === "string" && enteredBy.trim() ? enteredBy.trim() : null;
}

/**
 * Tre casi, in quest'ordine:
 * 1. senza accesso all'atleta non si conferma, nemmeno se si è l'autore (un coach scollegato
 *    dopo aver caricato il referto ha perso il diritto di scriverci);
 * 2. autore noto → conferma solo l'autore, qualunque ruolo abbia;
 * 3. autore ignoto (storico) → solo un amministratore, perché qualcuno deve poterla chiudere.
 */
export function decideHealthStagingConfirmation(
  caller: HealthStagingConfirmationCaller,
): HealthStagingConfirmationDecision {
  if (!caller.hasAthleteAccess) {
    return { allowed: false, status: 403, code: "athlete_access_required", error: HEALTH_STAGING_ATHLETE_ACCESS_REQUIRED_MESSAGE };
  }
  if (caller.insertedByUserId) {
    if (sameUser(caller.callerUserId, caller.insertedByUserId)) return { allowed: true };
    return { allowed: false, status: 403, code: "not_the_inserter", error: HEALTH_STAGING_NOT_THE_INSERTER_MESSAGE };
  }
  if (caller.isPlatformAdmin) return { allowed: true };
  return { allowed: false, status: 403, code: "inserter_unknown", error: HEALTH_STAGING_INSERTER_UNKNOWN_MESSAGE };
}
