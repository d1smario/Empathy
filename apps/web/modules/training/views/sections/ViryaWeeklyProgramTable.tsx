"use client";

import { TableProperties } from "lucide-react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { cn } from "@/lib/cn";
import {
  PhaseType,
  WeekObjectiveKey,
  WEEK_FOCUS_OPTIONS,
  WEEK_FOCUS_CHIP_STYLES,
  VIRYA_LOAD_LABEL,
  VIRYA_LOAD_SHORT,
  phaseColor,
  phaseRowBackground,
  phaseCellBorder,
  clamp,
} from "@/lib/training/virya/virya-annual-plan-kit";

type ProgramWeekRow = {
  week: number;
  weekStart: string;
  phase: string;
  phaseType: PhaseType;
  displayTss: number;
  displaySessions: number;
  hoursPerWeek?: number;
  objectives: WeekObjectiveKey[];
};

/**
 * Card "5 · Programma settimanale" del render di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaWeeklyProgramTableProps = {
  programWeekRows: ProgramWeekRow[];
  planWindowWeekCount: number;
  patchWeeklyOverride: (
    weekStart: string,
    patch: Partial<{ weeklyTss: number; sessionsPerWeek: number; hoursPerWeek: number; objectives: WeekObjectiveKey[] }>,
  ) => void;
  clearWeeklyHours: (weekStart: string) => void;
  toggleWeekObjective: (weekStart: string, id: WeekObjectiveKey) => void;
};

export function ViryaWeeklyProgramTable({
  programWeekRows,
  planWindowWeekCount,
  patchWeeklyOverride,
  clearWeeklyHours,
  toggleWeekObjective,
}: ViryaWeeklyProgramTableProps) {
  return (
    <Pro2SectionCard
      accent="violet"
      className="!border-pink-500/35 !bg-black bg-none from-transparent via-transparent to-transparent shadow-[inset_0_1px_0_rgba(251,113,133,0.12)]"
      title="5 · Programma settimanale"
      subtitle={`${programWeekRows.length} settimane (periodo passo 3: ${planWindowWeekCount || "—"}) · ${VIRYA_LOAD_LABEL}, sedute, ore e focus — usati in Calendar`}
      icon={TableProperties}
    >
      <div className="max-h-[min(520px,60vh)] overflow-auto rounded-xl border border-pink-500/20 bg-black">
        <table className="w-full min-w-[800px] border-collapse text-left text-xs text-slate-200">
          <thead className="sticky top-0 z-10 border-b border-pink-500/25 bg-black backdrop-blur-sm">
            <tr>
              <th className="whitespace-nowrap p-2 font-semibold text-pink-200/80">#</th>
              <th className="whitespace-nowrap p-2 font-semibold text-pink-200/80">Inizio sett.</th>
              <th className="whitespace-nowrap p-2 font-semibold text-pink-200/80">Fase</th>
              <th className="whitespace-nowrap p-2 font-semibold text-orange-200/90">{VIRYA_LOAD_SHORT}</th>
              <th className="whitespace-nowrap p-2 font-semibold text-orange-200/90">Sedute</th>
              <th className="whitespace-nowrap p-2 font-semibold text-orange-200/90">Ore sett.</th>
              <th className="min-w-[260px] p-2 font-semibold text-pink-200/80">Obiettivi (multipli)</th>
            </tr>
          </thead>
          <tbody>
            {programWeekRows.map((row) => {
              const pc = phaseColor(row.phaseType);
              const rowBg = phaseRowBackground(row.phaseType);
              const bdr = phaseCellBorder(row.phaseType);
              return (
              <tr
                key={row.weekStart}
                className="border-b border-white/[0.04]"
                style={{ backgroundColor: rowBg }}
              >
                <td className="p-2 font-mono font-semibold" style={{ color: pc }}>
                  {row.week}
                </td>
                <td className="p-2 font-mono text-[0.7rem]" style={{ color: `${pc}dd` }}>
                  {row.weekStart}
                </td>
                <td className="p-2 font-bold" style={{ color: pc }}>
                  {row.phase}
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min={0}
                    className="w-20 rounded-lg border px-2 py-1 font-mono font-bold outline-none transition focus:ring-2"
                    style={{
                      borderColor: bdr,
                      backgroundColor: `${pc}24`,
                      color: pc,
                      boxShadow: `inset 0 0 0 1px ${pc}20`,
                    }}
                    value={row.displayTss}
                    onChange={(e) =>
                      patchWeeklyOverride(row.weekStart, {
                        weeklyTss: Math.max(0, Math.round(Number(e.target.value) || 0)),
                      })
                    }
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min={1}
                    max={7}
                    className="w-14 rounded-lg border px-2 py-1 font-mono font-semibold outline-none transition focus:ring-2"
                    style={{
                      borderColor: bdr,
                      backgroundColor: `${pc}20`,
                      color: "#f8fafc",
                    }}
                    value={row.displaySessions}
                    onChange={(e) =>
                      patchWeeklyOverride(row.weekStart, {
                        sessionsPerWeek: clamp(Math.round(Number(e.target.value) || 1), 1, 7),
                      })
                    }
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="—"
                    className="w-16 rounded-lg border px-2 py-1 font-mono outline-none transition focus:ring-2"
                    style={{
                      borderColor: bdr,
                      backgroundColor: `${pc}18`,
                      color: "#e2e8f0",
                    }}
                    value={row.hoursPerWeek ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (v === "") clearWeeklyHours(row.weekStart);
                      else patchWeeklyOverride(row.weekStart, { hoursPerWeek: Math.max(0, Number(v) || 0) });
                    }}
                  />
                </td>
                <td className="p-2" style={{ backgroundColor: `${pc}0c` }}>
                  <div className="flex flex-wrap gap-1">
                    {WEEK_FOCUS_OPTIONS.map((opt) => {
                      const on = row.objectives.includes(opt.id);
                      const st = WEEK_FOCUS_CHIP_STYLES[opt.id];
                      return (
                        <button
                          key={`${row.weekStart}-${opt.id}`}
                          type="button"
                          onClick={() => toggleWeekObjective(row.weekStart, opt.id)}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold transition",
                            on ? st.on : st.off,
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Valori iniziali dalle fasi; modifiche qui hanno priorità sulla generazione. Le ore settimanali (macro aerobico)
        ripartiscono la durata media per seduta.
      </p>
    </Pro2SectionCard>
  );
}
