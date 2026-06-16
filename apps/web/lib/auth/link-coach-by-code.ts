import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Risultato normalizzato del tentativo di collegamento atleta↔coach via codice.
 * `ok=false` non è mai fatale per il signup: il codice è opzionale e il flusso
 * deve proseguire anche se il codice è assente o non valido.
 */
export type LinkCoachByCodeResult = {
  attempted: boolean;
  ok: boolean;
  coachUserId: string | null;
  error: string | null;
};

const NOOP: LinkCoachByCodeResult = { attempted: false, ok: false, coachUserId: null, error: null };

/**
 * Normalizza un codice coach grezzo (trim + uppercase). `null` se vuoto.
 * La RPC confronta su colonna `citext`, ma normalizziamo comunque per coerenza UI.
 */
export function normalizeCoachCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return code.length > 0 ? code : null;
}

/**
 * Punto server-side UNICO (riusato da ensure-profile e auth/callback): collega
 * l'atleta chiamante al coach del codice via RPC `link_athlete_by_coach_code`
 * (ESCLUSIVO: la RPC rimuove i legami precedenti). Va invocata DOPO che il
 * bootstrap garantisce `athlete_id`, e con un client autenticato a cookie
 * (la RPC risolve l'atleta da `auth.uid()`).
 */
export async function linkAthleteByCoachCode(
  supabase: SupabaseClient,
  rawCode: unknown,
): Promise<LinkCoachByCodeResult> {
  const code = normalizeCoachCode(rawCode);
  if (!code) return NOOP;

  const { data, error } = await supabase.rpc("link_athlete_by_coach_code", { p_code: code });
  if (error) {
    return { attempted: true, ok: false, coachUserId: null, error: error.message };
  }

  const payload = (data ?? {}) as { ok?: boolean; coach_user_id?: string | null; error?: string | null };
  return {
    attempted: true,
    ok: payload.ok === true,
    coachUserId: typeof payload.coach_user_id === "string" ? payload.coach_user_id : null,
    error: payload.ok === true ? null : payload.error ?? "Codice coach non valido.",
  };
}
