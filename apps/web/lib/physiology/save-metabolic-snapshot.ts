/**
 * Salvataggio "Profilo metabolico" (`/api/physiology/snapshot`): riga di audit in
 * `metabolic_lab_runs` + riga corrente in `physiological_profiles`.
 *
 * PERCHÉ TUTTO-O-NIENTE. I due lettori della piattaforma non guardano la stessa cosa:
 *  - `resolveCanonicalPhysiologyState` (pagina Physiology, training, twin, nutrizione
 *    modulo) è **run-first**: legge `output_payload.ftp` dell'ultimo run
 *    `metabolic_profile` e solo in fallback la colonna `ftp_watts`;
 *  - `loadNutritionAthleteProfile` (piano alimentare / fueling) legge **solo la colonna**.
 * Finché le due scritture riescono entrambe i numeri coincidono (in prod
 * |colonna − run| ≤ 0,005 W su 11/11 atleti con run). Ma erano due statement separati
 * senza transazione: se l'upsert del profilo falliva, il run era GIÀ scritto e da quel
 * momento la pagina mostrava il nuovo FTP e il fueling continuava a usare il vecchio,
 * in modo permanente e silenzioso. Qui il run viene rimosso quando il profilo non si
 * aggiorna, così lo stato torna a quello di prima del salvataggio.
 *
 * Nessuna transazione vera è possibile da PostgREST senza una funzione DB: questo è il
 * compenso applicativo (delete per chiave primaria del run appena inserito).
 */

import {
  buildPhysiologyProfileUpsertRow,
  type PhysiologyProfileUpdate,
} from "@/lib/physiology/physiology-profile-upsert";

export type MetabolicSnapshotRunSection = "metabolic_profile" | "lactate_analysis" | "max_oxidate";

export type MetabolicSnapshotInput = {
  athleteId: string;
  runSection: MetabolicSnapshotRunSection;
  modelVersion: string;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  createdBy: string | null;
  profileUpdate: PhysiologyProfileUpdate | null;
  nowIso: string;
};

export type MetabolicSnapshotResult =
  | { ok: true }
  | {
      ok: false;
      /** Messaggio da restituire al client (500). */
      error: string;
      /** true se il run era stato scritto ed è stato rimosso: nessun disallineamento residuo. */
      rolledBack: boolean;
    };

type QueryResult<T> = { data: T; error: { message: string } | null };

/**
 * Superficie MINIMA del client Supabase usata qui: tenerla esplicita permette di
 * testare la sequenza di scritture (e il rollback) senza un DB.
 */
export type MetabolicSnapshotDb = {
  from(table: string): {
    insert(row: Record<string, unknown>): {
      select(columns: string): { maybeSingle(): Promise<QueryResult<{ id?: unknown } | null>> };
    };
    upsert(
      row: Record<string, unknown>,
      options: { onConflict: string },
    ): Promise<{ error: { message: string } | null }>;
    delete(): { eq(column: string, value: string): Promise<{ error: { message: string } | null }> };
  };
};

function runIdOf(row: { id?: unknown } | null): string | null {
  const id = row?.id;
  return typeof id === "string" && id.trim() !== "" ? id : null;
}

export async function saveMetabolicSnapshot(
  db: MetabolicSnapshotDb,
  input: MetabolicSnapshotInput,
): Promise<MetabolicSnapshotResult> {
  const insertRes = await db
    .from("metabolic_lab_runs")
    .insert({
      athlete_id: input.athleteId,
      section: input.runSection,
      model_version: input.modelVersion,
      input_payload: input.inputPayload,
      output_payload: input.outputPayload,
      created_by: input.createdBy,
    })
    .select("id")
    .maybeSingle();
  if (insertRes.error) return { ok: false, error: insertRes.error.message, rolledBack: false };

  // Solo il profilo metabolico aggiorna `physiological_profiles`: le altre sezioni
  // finiscono qui e non hanno nulla da tenere allineato.
  if (input.runSection !== "metabolic_profile" || !input.profileUpdate) return { ok: true };

  // Le colonne scritte sono il contratto dell'upsert (PostgREST fa ON CONFLICT DO
  // UPDATE SOLO su quelle presenti): la riga si costruisce nel helper, che è coperto
  // da test. In particolare `baseline_hrv_ms` NON va scritta qui.
  const upsertRes = await db
    .from("physiological_profiles")
    .upsert(buildPhysiologyProfileUpsertRow(input.athleteId, input.profileUpdate, input.nowIso), {
      onConflict: "athlete_id",
    });
  if (!upsertRes.error) return { ok: true };

  const runId = runIdOf(insertRes.data);
  if (!runId) {
    // Senza id non si può disfare il run (es. client senza SELECT sulla tabella):
    // lo si dichiara, invece di lasciare il chiamante convinto che non sia stato scritto.
    return {
      ok: false,
      error: `${upsertRes.error.message} — run di audit già salvato e non annullabile: ripeti il salvataggio del profilo metabolico`,
      rolledBack: false,
    };
  }
  const deleteRes = await db.from("metabolic_lab_runs").delete().eq("id", runId);
  if (deleteRes.error) {
    return {
      ok: false,
      error: `${upsertRes.error.message} — rollback del run fallito (${deleteRes.error.message}): ripeti il salvataggio del profilo metabolico`,
      rolledBack: false,
    };
  }
  return {
    ok: false,
    error: `${upsertRes.error.message} — salvataggio annullato per intero: ripeti il salvataggio del profilo metabolico`,
    rolledBack: true,
  };
}
