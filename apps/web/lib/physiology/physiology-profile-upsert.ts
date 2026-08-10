/**
 * Riga di `physiological_profiles` scritta dal salvataggio del profilo metabolico
 * (`/api/physiology/snapshot`).
 *
 * Sta in un modulo a parte per una ragione precisa: l'upsert PostgREST fa
 * `ON CONFLICT DO UPDATE` SOLTANTO sulle colonne presenti nel payload, quindi
 * l'elenco delle chiavi È il contratto di scrittura. Una chiave in più qui
 * sovrascrive un dato che questo endpoint non calcola (è già successo con
 * `baseline_hrv_ms: null`, che azzerava la HRV di baseline dell'atleta a ogni
 * salvataggio). Il test accanto blocca esattamente questo.
 */

export type PhysiologyProfileUpdate = {
  ftp_watts: number;
  lt1_watts: number;
  lt2_watts: number;
  v_lamax: number;
  vo2max_ml_min_kg: number;
  cp_watts?: number;
};

export type PhysiologyProfileUpsertRow = {
  athlete_id: string;
  ftp_watts: number;
  lt1_watts: number;
  lt2_watts: number;
  v_lamax: number;
  vo2max_ml_min_kg: number;
  cp_watts: number | null;
  updated_at: string;
};

/**
 * Colonne di `physiological_profiles` che il motore CP NON produce e che quindi
 * NON vanno mai messe nel payload: restano quelle già sulla riga (o il default,
 * se la riga è nuova). Elencate per documentare l'omissione volontaria.
 */
export const PHYSIOLOGY_PROFILE_COLUMNS_NOT_OWNED_HERE = [
  "baseline_hrv_ms",
  "baseline_hrv_std",
  "baseline_temp_c",
  "baseline_glucose_mmol",
] as const;

export function buildPhysiologyProfileUpsertRow(
  athleteId: string,
  update: PhysiologyProfileUpdate,
  nowIso: string,
): PhysiologyProfileUpsertRow {
  return {
    athlete_id: athleteId,
    ftp_watts: update.ftp_watts,
    lt1_watts: update.lt1_watts,
    lt2_watts: update.lt2_watts,
    v_lamax: update.v_lamax,
    vo2max_ml_min_kg: update.vo2max_ml_min_kg,
    cp_watts: update.cp_watts ?? null,
    // La tabella non ha trigger su updated_at: senza questo campo la riga restava
    // marcata con la data del PRIMO salvataggio pur avendo valori nuovi, e i lettori
    // che ordinano per `updated_at desc` (nutrizione, training L2, dashboard)
    // leggevano una data di freschezza falsa.
    updated_at: nowIso,
  };
}
