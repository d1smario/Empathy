"use client";

import type { Dispatch, SetStateAction } from "react";
import { BookMarked } from "lucide-react";
import { useTranslations } from "next-intl";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";

type LibraryProgramWeekRow = {
  week: number;
  weekStart: string;
  phase: string;
  displayTss: number;
  displaySessions: number;
};

/**
 * Card "Salva settimana in libreria" del render di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaSaveWeekToLibraryCardProps = {
  libraryWeekStart: string;
  setLibraryWeekStart: Dispatch<SetStateAction<string>>;
  savingLibrary: boolean;
  programWeekRows: LibraryProgramWeekRow[];
  saveWeekToLibrary: () => Promise<void>;
  saving: boolean;
  selectedAthleteId: string | null;
};

export function ViryaSaveWeekToLibraryCard({
  libraryWeekStart,
  setLibraryWeekStart,
  savingLibrary,
  programWeekRows,
  saveWeekToLibrary,
  saving,
  selectedAthleteId,
}: ViryaSaveWeekToLibraryCardProps) {
  const t = useTranslations("ViryaSaveWeekToLibraryCard");
  return (
    <Pro2SectionCard
      accent="violet"
      title={t("title")}
      subtitle={t("subtitle")}
      icon={BookMarked}
    >
      <p className="mb-3 text-sm text-slate-300">
        {t.rich("intro", { b: (chunks) => <strong className="text-white">{chunks}</strong> })}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t("weekLabel")}
          <select
            className="min-w-[200px] rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            value={libraryWeekStart}
            onChange={(e) => setLibraryWeekStart(e.target.value)}
            disabled={savingLibrary || !programWeekRows.length}
          >
            {programWeekRows.map((w) => (
              <option key={w.weekStart} value={w.weekStart}>
                W{w.week} · {w.weekStart} · {w.phase} · {w.displaySessions} {t("sessionsSuffix")} · TSS {w.displayTss}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-xl border border-violet-500/50 bg-violet-500/20 px-5 py-3 text-sm font-semibold text-violet-50 shadow-[0_0_24px_rgba(139,92,246,0.12)] hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void saveWeekToLibrary()}
          disabled={savingLibrary || saving || !selectedAthleteId || !libraryWeekStart}
          title={
            !selectedAthleteId
              ? t("selectAthleteHint")
              : !libraryWeekStart
                ? t("noWeekHint")
                : undefined
          }
        >
          {savingLibrary ? t("materializing") : t("saveButton")}
        </button>
      </div>
    </Pro2SectionCard>
  );
}
