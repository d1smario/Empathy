"use client";

import type { Dispatch, SetStateAction } from "react";
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
  viryaWeekdayPattern: "auto" | ViryaWeekdayPatternId;
  setViryaWeekdayPattern: Dispatch<SetStateAction<"auto" | ViryaWeekdayPatternId>>;
  microcyclePreviewRows: MicrocyclePreviewRow[];
};

export function ViryaMicrocyclePreviewCard({
  viryaWeekdayPattern,
  setViryaWeekdayPattern,
  microcyclePreviewRows,
}: ViryaMicrocyclePreviewCardProps) {
  return (
    <Pro2SectionCard
      accent="violet"
      title="Microciclo · anteprima Builder"
      subtitle="Pattern giorni, polarizzazione Q/V e istruzioni che riceverà generateBuilderSession (prima settimana fase 1)"
      icon={Layers}
    >
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          <span className="text-xs font-semibold uppercase tracking-wide text-violet-200/80">
            Pattern settimanale
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
            <option value="auto">Auto (da giorni/settimana)</option>
            <option value="3d">3d · Lun Mer Ven</option>
            <option value="4d">4d · Lun Mer Ven Dom</option>
            <option value="5d">5d · Lun Mar Gio Ven Dom</option>
            <option value="6d">6d · Lun–Sab</option>
          </select>
        </label>
        {microcyclePreviewRows.length > 0 ? (
          <p className="text-xs text-slate-400">
            Somma carico anteprima:{" "}
            <span className="font-mono text-violet-200">{microcyclePreviewRows[0]?.loadSum ?? "—"}</span> · pattern{" "}
            <span className="font-mono text-violet-200">{microcyclePreviewRows[0]?.patternId ?? "—"}</span>
          </p>
        ) : null}
      </div>
      {microcyclePreviewRows.length === 0 ? (
        <p className="text-sm text-slate-500">Aggiungi almeno una fase per vedere l&apos;anteprima settimana.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                <th className="p-2">Giorno</th>
                <th className="p-2">Ruolo</th>
                <th className="p-2">Carico</th>
                <th className="p-2">Adattamento Builder</th>
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
                  <td className="p-2 font-mono text-xs text-violet-200/90">{row.adapt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Pro2SectionCard>
  );
}
