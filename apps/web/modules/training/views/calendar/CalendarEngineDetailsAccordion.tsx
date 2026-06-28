"use client";

import { Pro2Accordion } from "@/components/ui/empathy";
import type { CalendarFetchDiag, ExecutedCalendarGapInfo } from "./useCalendarMonthData";

export interface CalendarEngineDetailsAccordionProps {
  showTech: boolean;
  athleteId: string | null;
  fetchFrom: string;
  fetchTo: string;
  fetchDiag: CalendarFetchDiag | null;
  executedCalendarGap: ExecutedCalendarGapInfo | null;
  monthExecutedRenderedCount: number;
}

/**
 * Accordion unico «Dettagli e motore» in fondo pagina: come funzionano
 * spostamenti drag&drop, import file e finestra dati; dentro, i blocchi
 * diagnostici riservati a coach/admin (showTech) invariati.
 */
export function CalendarEngineDetailsAccordion({
  showTech,
  athleteId,
  fetchFrom,
  fetchTo,
  fetchDiag,
  executedCalendarGap,
  monthExecutedRenderedCount,
}: CalendarEngineDetailsAccordionProps) {
  return (
    <Pro2Accordion
      id="mod-dettagli-motore"
      title="Come funziona"
      subtitle="Spostamenti, formati di import e finestra dati del calendario"
      accent="orange"
    >
      <div className="space-y-4 text-sm text-gray-300">
        <div>
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">Spostare una seduta</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            Trascina una chip <strong className="text-orange-200">PLAN</strong> su un altro giorno della griglia per
            spostare la seduta (stessa struttura Builder, nuova data). I workout eseguiti (EXEC) non si spostano.
          </p>
        </div>
        <div>
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">Formati di import</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            Modalità Auto: i file FIT workout diventano sedute in calendario (PLAN), le attività registrate diventano
            EXEC. Sedute strutturate: ZWO, ERG, MRC o FIT workout — una seduta nel giorno scelto con grafico a blocchi
            come nel Builder. Tracce eseguite: FIT/FIT.GZ, CSV, JSON, TCX, GPX.
          </p>
        </div>
        <div>
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">Finestra dati</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            I dati caricati includono alcuni giorni prima e dopo il mese visibile, così le sedute ai bordi non
            spariscono dalla griglia.
            {showTech ? (
              <span className="mt-1 block font-mono text-[0.65rem] text-gray-500">
                API: {fetchFrom} → {fetchTo}
              </span>
            ) : null}
          </p>
        </div>

        {showTech && athleteId && fetchDiag ? (
          <p className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-[0.65rem] leading-relaxed text-gray-400">
            <span className="text-gray-500">diag calendario · </span>
            athleteId={athleteId} · HTTP {fetchDiag.status} · planned={fetchDiag.plannedN} · executed={fetchDiag.executedN}
            {fetchDiag.executedFallback ? <span className="text-amber-300"> · executedAdminFallbackUsed=true</span> : null}
            {(fetchDiag.executedHiddenByPreference ?? 0) > 0 ? (
              <span className="text-amber-300"> · hiddenBySourcePref={fetchDiag.executedHiddenByPreference}</span>
            ) : null}
            {fetchDiag.resFrom && fetchDiag.resTo ? (
              <>
                {" "}
                · API <span className="text-gray-300">{fetchDiag.resFrom}</span> →{" "}
                <span className="text-gray-300">{fetchDiag.resTo}</span>
              </>
            ) : null}
            {fetchDiag.sampleDates?.length ? (
              <span>
                {" "}
                · dates=[<span className="text-gray-300">{fetchDiag.sampleDates.join(", ")}</span>]
              </span>
            ) : null}
            {fetchDiag.apiError ? <span className="text-amber-400/90"> · {fetchDiag.apiError}</span> : null}
          </p>
        ) : null}

        {showTech && executedCalendarGap ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <p className="font-mono text-[0.65rem] uppercase tracking-wide text-amber-300">
              warning · executed presenti ma non renderizzati in griglia
            </p>
            <p className="mt-1 text-amber-100/90">
              Eseguiti nel mese: {executedCalendarGap.totalRows}. Chip EXEC visibili: {monthExecutedRenderedCount}.
            </p>
            <pre className="mt-2 overflow-x-auto rounded border border-amber-500/25 bg-black/40 p-2 font-mono text-[0.65rem] leading-relaxed text-amber-200/95">
              {JSON.stringify(executedCalendarGap.sample, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </Pro2Accordion>
  );
}
