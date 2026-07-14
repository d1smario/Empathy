"use client";

import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { Layers } from "lucide-react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { cn } from "@/lib/cn";
import type { ViryaWeekdayPatternId } from "@/lib/training/virya/virya-builder-session-brief";

type MicrocyclePreviewRow = {
  day: string;
  role: string;
  load: number;
  adapt: string;
  patternId: ViryaWeekdayPatternId;
  loadSum: number;
};

/**
 * Card "Microciclo · anteprima Builder" del render di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaMicrocyclePreviewCardProps = {
  /** Staff-only: mostra il pattern grezzo + la colonna «adattamento Builder» (gergo motore). */
  staffView?: boolean;
  viryaWeekdayPattern: "auto" | ViryaWeekdayPatternId;
  setViryaWeekdayPattern: Dispatch<SetStateAction<"auto" | ViryaWeekdayPatternId>>;
  microcyclePreviewRows: MicrocyclePreviewRow[];
};

export function ViryaMicrocyclePreviewCard({
  staffView = false,
  viryaWeekdayPattern,
  setViryaWeekdayPattern,
  microcyclePreviewRows,
}: ViryaMicrocyclePreviewCardProps) {
  const t = useTranslations("ViryaMicrocyclePreviewCard");
  return (
    <Pro2SectionCard
      accent="violet"
      title={t("cardTitle")}
      subtitle={t("cardSubtitle")}
      icon={Layers}
    >
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          <span className="text-xs font-semibold uppercase tracking-wide text-violet-200/80">
            {t("weeklyPattern")}
          </span>
          <select
            className="rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/50"
            value={viryaWeekdayPattern}
            onChange={(e) =>
              setViryaWeekdayPattern(
                e.target.value === "auto" ? "auto" : (e.target.value as ViryaWeekdayPatternId),
              )
            }
          >
            <option value="auto">{t("patternAuto")}</option>
            <option value="3d">{t("pattern3d")}</option>
            <option value="4d">{t("pattern4d")}</option>
            <option value="5d">{t("pattern5d")}</option>
            <option value="6d">{t("pattern6d")}</option>
          </select>
        </label>
        {microcyclePreviewRows.length > 0 ? (
          <p className="text-xs text-slate-400">
            {t("previewLoadSum")}{" "}
            <span className="font-mono text-violet-200">{microcyclePreviewRows[0]?.loadSum ?? "—"}</span>
            {staffView ? (
              <>
                {" "}· pattern{" "}
                <span className="font-mono text-violet-200">{microcyclePreviewRows[0]?.patternId ?? "—"}</span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
      {microcyclePreviewRows.length === 0 ? (
        <p className="text-sm text-slate-500">{t("emptyState")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                <th className="p-2">{t("colDay")}</th>
                <th className="p-2">{t("colRole")}</th>
                <th className="p-2">{t("colLoad")}</th>
                {staffView ? <th className="p-2">{t("colBuilderAdaptation")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {microcyclePreviewRows.map((row, i) => (
                <tr key={`micro-preview-${i}`} className="border-b border-white/5 text-slate-200">
                  <td className="p-2 font-medium text-white">{row.day}</td>
                  <td className="p-2">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs font-semibold",
                        row.role === "quality"
                          ? "border-fuchsia-400/40 bg-fuchsia-500/20 text-fuchsia-100"
                          : row.role === "recovery"
                            ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-100"
                            : "border-orange-400/30 bg-orange-500/15 text-orange-100",
                      )}
                    >
                      {row.role}
                    </span>
                  </td>
                  <td className="p-2 font-mono">{row.load}</td>
                  {staffView ? (
                    <td className="p-2 font-mono text-xs text-violet-200/90">{row.adapt}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Pro2SectionCard>
  );
}
