"use client";

import { FileUp } from "lucide-react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { normalizeDateKey } from "@/lib/training/calendar-analyzer-helpers";
import type { CalendarFileImportFormState } from "./useCalendarMonthData";

export interface CalendarFileImportSectionProps {
  athleteId: string | null;
  selectedDate: string;
  saving: boolean;
  fileImportForm: CalendarFileImportFormState;
  setFileImportForm: Dispatch<SetStateAction<CalendarFileImportFormState>>;
  onSubmit: (e: FormEvent) => Promise<void>;
}

/**
 * Import da file (PLAN strutturati / EXEC tracce). Sezione avanzata dietro toggle;
 * l'id `training-calendar-file-import` è storico (scroll dal toggle in toolbar).
 */
export function CalendarFileImportSection({
  athleteId,
  selectedDate,
  saving,
  fileImportForm,
  setFileImportForm,
  onSubmit,
}: CalendarFileImportSectionProps) {
  return (
    <div id="training-calendar-file-import" className="scroll-mt-24">
      <Pro2SectionCard
        accent="orange"
        title="Import da file"
        subtitle="Auto: FIT workout → calendario (Pianificato); attività → Eseguito. Calendario: ZWO/ERG/MRC/CSV. Eseguito: traccia registrata."
        icon={FileUp}
      >
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
              Modalità
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                value={fileImportForm.mode}
                onChange={(e) => {
                  const mode = e.target.value as "auto" | "executed" | "planned";
                  setFileImportForm((f) => ({
                    ...f,
                    mode,
                    date: normalizeDateKey(f.date) || selectedDate,
                    fallbackExecutedOnPlannedError: mode === "planned" ? f.fallbackExecutedOnPlannedError : false,
                  }));
                }}
              >
                <option value="auto">Auto (consigliato)</option>
                <option value="planned">Calendario · export device (PLAN)</option>
                <option value="executed">Attività registrata (EXEC)</option>
              </select>
            </label>
            <label className="block font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
              Sorgente dispositivo
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                value={fileImportForm.device}
                onChange={(e) => setFileImportForm((f) => ({ ...f, device: e.target.value }))}
                disabled={fileImportForm.mode === "planned"}
              >
                <option value="auto">Auto (da nome file)</option>
                <option value="garmin">Garmin</option>
                <option value="wahoo">Wahoo (ELEMNT / RIVAL)</option>
                <option value="suunto">Suunto</option>
                <option value="polar">Polar</option>
                <option value="coros">COROS</option>
                <option value="hammerhead">Hammerhead Karoo</option>
                <option value="apple_watch">Apple Watch / Health</option>
                <option value="zwift">Zwift</option>
                <option value="strava">Strava</option>
                <option value="trainingpeaks">TrainingPeaks</option>
                <option value="whoop">WHOOP</option>
                <option value="oura">Oura</option>
                <option value="other">Altro</option>
              </select>
            </label>
          </div>
          <label className="block font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
            File
            <input
              type="file"
              className="mt-1 w-full rounded-xl border border-dashed border-white/20 bg-black/40 px-3 py-2 text-sm text-gray-300 file:mr-3 file:rounded-full file:border-0 file:bg-orange-500/20 file:px-3 file:py-1 file:text-orange-100"
              accept=".csv,.json,.tcx,.gpx,.zwo,.erg,.mrc,.fit,.fit.gz,.gz"
              onChange={(e) => setFileImportForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
            />
          </label>
          <label className="block font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
            Giorno nel calendario
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
              value={fileImportForm.date}
              onChange={(e) => setFileImportForm((f) => ({ ...f, date: e.target.value }))}
            />
            <span className="mt-1 block font-sans font-normal normal-case tracking-normal text-gray-500">
              {fileImportForm.mode === "auto"
                ? "Auto: FIT/ZWO/ERG/MRC workout → chip Pianificato (export Zwift/Rouvy); FIT/TCX/GPX attività → Eseguito. Giorno = cella selezionata."
                : fileImportForm.mode === "executed"
                  ? "Solo tracce registrate (Analyzer). Il giorno è quello selezionato in griglia."
                  : "Programma tabellare o seduta strutturata su questo giorno (Pianificato)."}
            </span>
          </label>
          <label className="block font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
            Note import (opzionale)
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
              value={fileImportForm.notes}
              onChange={(e) => setFileImportForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <p className="text-xs text-gray-500">
            {fileImportForm.mode === "planned"
              ? "Tabellare: CSV/JSON export calendario (più sedute). Strutturato: ZWO, ERG, MRC o FIT workout — una seduta nel giorno scelto, con grafico a blocchi come nel Builder."
              : "Eseguito: FIT/FIT.GZ, CSV, JSON, TCX, GPX. Il salvataggio usa il giorno indicato sopra (cella corrente se non modifichi la data). Device: auto o manuale."}
          </p>
          {fileImportForm.mode === "planned" ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-300">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0"
                checked={fileImportForm.fallbackExecutedOnPlannedError}
                onChange={(e) =>
                  setFileImportForm((f) => ({ ...f, fallbackExecutedOnPlannedError: e.target.checked }))
                }
              />
              <span>
                Se l&apos;import programmato fallisce, importa lo stesso file come workout eseguito (traccia per
                Analyzer). Utile se il FIT non si converte bene in Builder: l&apos;Analyzer usa le serie come per
                gli eseguiti (i FIT solo-workout senza record possono avere grafici minimi).
              </span>
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving || !athleteId || !fileImportForm.file}
              className="rounded-full border border-orange-500/30 bg-orange-500/10 px-5 py-2.5 text-sm font-bold text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20 disabled:opacity-40"
            >
              {saving ? "Import…" : fileImportForm.mode === "planned" ? "Importa programma" : "Importa allenamento"}
            </button>
          </div>
        </form>
      </Pro2SectionCard>
    </div>
  );
}
