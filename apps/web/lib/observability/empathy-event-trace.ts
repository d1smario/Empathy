import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Traccia DURATURA di un evento di piattaforma su `empathy_events`.
 *
 * Perché serve: la ritenzione dei log runtime su Vercel per questo progetto è di circa
 * UN'ORA. Un cron che gira alle 05:00 UTC e fallisce non lascia nulla di consultabile la
 * mattina dopo. Una riga su `empathy_events` (tabella generica già esistente:
 * event_type / athlete_id / payload jsonb / created_at) sopravvive e si interroga con una
 * SELECT — senza creare tabelle nuove.
 *
 * DUE SCELTE DELIBERATE, entrambe nate da un difetto reale trovato in review:
 *
 * 1. La colonna `athlete_id` resta SEMPRE a NULL. Su `empathy_events` esiste una policy
 *    RLS di SELECT (`empathy_events_select_scoped`) che concede la lettura all'atleta e al
 *    suo coach esattamente sulle righe con `athlete_id` VALORIZZATO. Il payload di queste
 *    tracce porta messaggi d'errore grezzi di motore e DB: materiale da ops, che un atleta
 *    non deve mai vedere. Con la colonna a NULL quella policy non aggancia nulla e la riga
 *    resta leggibile solo da platform admin. L'atleta, quando serve saperlo, sta DENTRO il
 *    payload — che è ops-only per costruzione, non per convenzione.
 *
 * 2. L'esito si legge da `{ error }`, NON da un catch. postgrest-js non lancia se non gli
 *    si chiede `.throwOnError()` (`shouldThrowOnError = false` di default, e senza quel
 *    flag pure gli errori di rete vengono intercettati e trasformati in `{ error }`).
 *    Il solo try/catch era codice morto: tabella assente, RLS o vincoli violati sparivano
 *    in silenzio assoluto, e in QA «zero righe» diventava indistinguibile da «il cron non
 *    è mai partito».
 *
 * Resta best-effort: la traccia è osservabilità, non lavoro. Un fallimento si LOGGA e si
 * riporta al chiamante, ma non si propaga: non deve mai trasformare un cron riuscito in un
 * cron fallito. Richiede il client service-role (in scrittura la RLS ammette solo admin).
 *
 * @returns `true` se la riga è stata scritta — così il chiamante può dire nella sua
 * risposta se la traccia c'è, invece di lasciar credere a chi legge che ci sia sempre.
 */
export async function recordEmpathyEvent(
  db: SupabaseClient,
  event: { eventType: string; payload: Record<string, unknown> },
): Promise<boolean> {
  try {
    const { error } = await db.from("empathy_events").insert({
      event_type: event.eventType,
      athlete_id: null, // vedi punto 1: ops-only, mai leggibile dall'atleta
      payload: event.payload,
    });
    if (error) {
      console.warn("[empathy events] traccia non scritta", { eventType: event.eventType, error: error.message });
      return false;
    }
    return true;
  } catch (e) {
    // Percorso residuo (client rotto prima della query): non passa da `{ error }`.
    console.warn("[empathy events] traccia non scritta (eccezione)", {
      eventType: event.eventType,
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}
