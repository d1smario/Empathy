/**
 * PRO2 — **Gate di conferma referti** (staging run → archivio clinico).
 *
 * Il contratto di prodotto è coach-only: la UI (`HealthStagingReviewView`) nasconde all'atleta
 * i bottoni Conferma/Rifiuta e gli scrive «in attesa di validazione dal tuo coach». Questo modulo
 * è la stessa regola messa **lato server**, dove conta: le rotte
 * `POST /api/health/staging-runs/[id]/apply` e `PATCH /api/health/staging-runs/[id]` scrivono con
 * service role su tabelle che la RLS all'atleta nega.
 *
 * Funzione **pura** di proposito: è testabile con `node:test` senza impalcatura Next/Supabase,
 * e non deve mai importare `server-only`. L'unico import ammesso è `lib/platform-coach-status`,
 * a sua volta senza dipendenze, per non avere una seconda definizione di «coach approvato».
 */

import { parsePlatformCoachStatus } from "@/lib/platform-coach-status";

/**
 * Ruolo/scope del CALLER (non del target) + esito del gate atleta.
 *
 * ⚠️ **`role` da solo non è un fatto.** La policy `app_user_profiles_update_own` consente
 * l'UPDATE sulla propria riga e il trigger `app_user_profiles_protect_platform_fields`
 * protegge `is_platform_admin` e `platform_coach_status` ma **non** `role`: chiunque può
 * scriversi `role = "coach"`. Il fatto non falsificabile è `platform_coach_status`, che il
 * trigger lascia muovere all'utente solo private→coach con valore `"pending"` e per qualunque
 * altra transizione riscrive col valore vecchio. Quindi qui il ruolo vale **solo** se
 * accompagnato da `platformCoachStatus === "approved"`.
 */
export type HealthStagingConfirmationCaller = {
  /** `app_user_profiles.role` del chiamante: "private" | "coach" | … (null se profilo assente). */
  role: string | null;
  /** `app_user_profiles.is_platform_admin` del chiamante (il trigger lo blinda su UPDATE). */
  isPlatformAdmin: boolean;
  /**
   * `app_user_profiles.platform_coach_status` del chiamante: solo `"approved"` è una promozione
   * fatta dalla piattaforma (service role / platform admin). `"pending"` è auto-dichiarato.
   */
  platformCoachStatus: string | null;
  /**
   * Esito di `canAccessAthleteData` **per questo atleta**.
   *
   * ⚠️ Non è ridondante con `role`: `role === "coach"` dice che il chiamante è *un* coach,
   * non che segua *questo* atleta. I due controlli non si sostituiscono a vicenda, servono
   * entrambi (audit C-gate-ruolo).
   */
  hasAthleteAccess: boolean;
  /** `app_user_profiles.athlete_id` del CHIAMANTE (null se il profilo non ne ha uno). */
  callerAthleteId: string | null;
  /** `interpretation_staging_runs.athlete_id`: l'atleta a cui appartiene il referto. */
  targetAthleteId: string | null;
};

export type HealthStagingConfirmationDenialCode =
  | "athlete_access_required"
  | "coach_role_required"
  | "self_validation_forbidden";

export type HealthStagingConfirmationDecision =
  | { allowed: true }
  | {
      allowed: false;
      status: 403;
      code: HealthStagingConfirmationDenialCode;
      /** Messaggio utente: dice *cosa serve*, coerente con la copy della review page. */
      error: string;
    };

/** Coerente con `HealthStagingReviewView.awaitingCoachValidation`. */
export const HEALTH_STAGING_COACH_REQUIRED_MESSAGE =
  "La conferma dei referti spetta al coach: i valori restano in attesa di validazione. " +
  "Serve un account coach approvato dalla piattaforma e collegato a questo atleta " +
  "(o un amministratore di piattaforma).";

export const HEALTH_STAGING_ATHLETE_ACCESS_REQUIRED_MESSAGE =
  "Nessun accesso ai dati di questo atleta: serve un collegamento coach-atleta attivo " +
  "(o un amministratore di piattaforma).";

export const HEALTH_STAGING_SELF_VALIDATION_MESSAGE =
  "Un referto non può essere validato dalla persona a cui appartiene: la conferma deve " +
  "arrivare da un altro account coach approvato (o da un amministratore di piattaforma).";

/** UUID dal DB vs UUID da un payload: confronto tollerante a case e spazi, mai a `null`. */
function sameAthlete(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = typeof a === "string" ? a.trim().toLowerCase() : "";
  const right = typeof b === "string" ? b.trim().toLowerCase() : "";
  if (!left || !right) return false;
  return left === right;
}

/**
 * Chi può promuovere un referto ad archivio clinico.
 *
 * **Tre gate in AND**, nell'ordine:
 * 1. `hasAthleteAccess` (`canAccessAthleteData`) — il chiamante può toccare *questo* atleta;
 * 2. **non auto-validazione** — il chiamante non è l'atleta a cui appartiene il referto.
 *    Vale per tutti, coach approvato e platform admin compresi: un coach che è anche atleta di
 *    se stesso (caso reale) non firma il proprio referto, e non esiste un motivo clinico per
 *    cui un admin debba validare il proprio;
 * 3. ruolo — platform admin **oppure** coach **approvato dalla piattaforma**.
 *
 * Nessuno dei tre sostituisce gli altri: senza (1) un coach potrebbe confermare i referti di un
 * atleta che non segue; senza (2) basta essere coach di se stessi per aggirare il gate; senza
 * l'`"approved"` in (3) l'atleta si scrive `role = "coach"` sulla propria riga (il trigger non
 * protegge quel campo) e passa.
 */
export function decideHealthStagingConfirmation(
  caller: HealthStagingConfirmationCaller,
): HealthStagingConfirmationDecision {
  if (!caller.hasAthleteAccess) {
    return {
      allowed: false,
      status: 403,
      code: "athlete_access_required",
      error: HEALTH_STAGING_ATHLETE_ACCESS_REQUIRED_MESSAGE,
    };
  }
  if (sameAthlete(caller.callerAthleteId, caller.targetAthleteId)) {
    return {
      allowed: false,
      status: 403,
      code: "self_validation_forbidden",
      error: HEALTH_STAGING_SELF_VALIDATION_MESSAGE,
    };
  }
  const isApprovedCoach =
    caller.role === "coach" && parsePlatformCoachStatus(caller.platformCoachStatus) === "approved";
  if (caller.isPlatformAdmin || isApprovedCoach) {
    return { allowed: true };
  }
  return {
    allowed: false,
    status: 403,
    code: "coach_role_required",
    error: HEALTH_STAGING_COACH_REQUIRED_MESSAGE,
  };
}
