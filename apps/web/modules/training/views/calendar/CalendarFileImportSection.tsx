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
        title="Import from file"
        subtitle="Auto: FIT workout → calendar (Planned); activity → Executed. Calendar: ZWO/ERG/MRC/CSV. Executed: recorded track."
        icon={FileUp}
      >
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
              Mode
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
                <option value="auto">Auto (recommended)</option>
                <option value="planned">Calendar · device export (PLAN)</option>
                <option value="executed">Recorded activity (EXEC)</option>
              </select>
            </label>
            <label className="block font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
              Device source
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                value={fileImportForm.device}
                onChange={(e) => setFileImportForm((f) => ({ ...f, device: e.target.value }))}
                disabled={fileImportForm.mode === "planned"}
              >
                <option value="auto">Auto (from file name)</option>
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
                <option value="other">Other</option>
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
            Day in calendar
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
              value={fileImportForm.date}
              onChange={(e) => setFileImportForm((f) => ({ ...f, date: e.target.value }))}
            />
            <span className="mt-1 block font-sans font-normal normal-case tracking-normal text-gray-500">
              {fileImportForm.mode === "auto"
                ? "Auto: FIT/ZWO/ERG/MRC workout → Planned chip (Zwift/Rouvy export); FIT/TCX/GPX activity → Executed. Day = selected cell."
                : fileImportForm.mode === "executed"
                  ? "Recorded tracks only (Analyzer). The day is the one selected in the grid."
                  : "Tabular program or structured session on this day (Planned)."}
            </span>
          </label>
          <label className="block font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
            Import notes (optional)
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
              value={fileImportForm.notes}
              onChange={(e) => setFileImportForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <p className="text-xs text-gray-500">
            {fileImportForm.mode === "planned"
              ? "Tabular: CSV/JSON calendar export (multiple sessions). Structured: ZWO, ERG, MRC or FIT workout — a single session on the chosen day, with a block chart as in the Builder."
              : "Executed: FIT/FIT.GZ, CSV, JSON, TCX, GPX. Saving uses the day indicated above (current cell if you do not change the date). Device: auto or manual."}
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
                If the planned import fails, import the same file as an executed workout (track for
                Analyzer). Useful when the FIT does not convert well in Builder: the Analyzer uses the series as for
                executed ones (workout-only FIT files without records may have minimal charts).
              </span>
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving || !athleteId || !fileImportForm.file}
              className="rounded-full border border-orange-500/30 bg-orange-500/10 px-5 py-2.5 text-sm font-bold text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20 disabled:opacity-40"
            >
              {saving ? "Importing…" : fileImportForm.mode === "planned" ? "Import program" : "Import workout"}
            </button>
          </div>
        </form>
      </Pro2SectionCard>
    </div>
  );
}
