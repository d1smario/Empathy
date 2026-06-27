"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  GYM_WEEK_DAY_SLOTS,
  ensureGymWeekModules,
  gymModuleDistricts,
  toggleGymDistrict,
  type GymDayModule,
} from "@/lib/training/virya/gym-day-modules";
import {
  GymPrimaryGoal,
  VIRYA_LOAD_SHORT,
  gymGoalLabels,
  gymDistrictOptions,
  gymDistrictObjectiveOptions,
  gymExerciseTypeOptions,
  gymMethodologyOptions,
} from "@/lib/training/virya/virya-annual-plan-kit";

type GymWeekConfig = { sessionsPerWeek: number; loadPct: number; modules: GymDayModule[] };

/**
 * Ramo "strength" del ternario sportFamily di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaStrengthConfigBlockProps = {
  gymPlanStart: string;
  setGymPlanStart: Dispatch<SetStateAction<string>>;
  gymPlanEnd: string;
  setGymPlanEnd: Dispatch<SetStateAction<string>>;
  gymMacroPhaseCount: number;
  setGymMacroPhaseCount: Dispatch<SetStateAction<number>>;
  regenerateGymMacroPlan: () => void;
  selectedGymWeekStart: string;
  setSelectedGymWeekStart: Dispatch<SetStateAction<string>>;
  programWeekRows: Array<{ week: number; weekStart: string }>;
  selectedWeekConfig: () => GymWeekConfig;
  updateSelectedWeekConfig: (patch: Partial<GymWeekConfig>) => void;
  setGymTrainingDaysPerWeek: Dispatch<SetStateAction<number>>;
  gymPrimaryGoal: GymPrimaryGoal;
  setGymPrimaryGoal: Dispatch<SetStateAction<GymPrimaryGoal>>;
  loadStatusLabel: (loadPct: number) => string;
};

export function ViryaStrengthConfigBlock({
  gymPlanStart,
  setGymPlanStart,
  gymPlanEnd,
  setGymPlanEnd,
  gymMacroPhaseCount,
  setGymMacroPhaseCount,
  regenerateGymMacroPlan,
  selectedGymWeekStart,
  setSelectedGymWeekStart,
  programWeekRows,
  selectedWeekConfig,
  updateSelectedWeekConfig,
  setGymTrainingDaysPerWeek,
  gymPrimaryGoal,
  setGymPrimaryGoal,
  loadStatusLabel,
}: ViryaStrengthConfigBlockProps) {
  return (
    <div style={{ marginTop: "10px", display: "grid", gap: "10px" }}>
      <div className="profile-subpanel">
        <div className="session-title-copy">1 · Intervallo periodo</div>
        <div className="form-grid-two">
          <label className="form-field">
            <span>Data inizio piano</span>
            <input className="form-input" type="date" value={gymPlanStart} onChange={(e) => setGymPlanStart(e.target.value)} />
          </label>
          <label className="form-field">
            <span>Data fine piano</span>
            <input className="form-input" type="date" value={gymPlanEnd} onChange={(e) => setGymPlanEnd(e.target.value)} />
          </label>
        </div>
      </div>
      <div className="profile-subpanel">
        <div className="session-title-copy">2 · Macrofasi</div>
        <div className="form-grid-two">
          <label className="form-field">
            <span>Numero macrofasi</span>
            <input
              className="form-input"
              type="number"
              min={1}
              max={8}
              value={gymMacroPhaseCount}
              onChange={(e) => setGymMacroPhaseCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
            />
          </label>
          <div className="form-field" style={{ display: "flex", alignItems: "end" }}>
            <button type="button" className="btn-secondary" onClick={regenerateGymMacroPlan}>
              Genera macrofasi automatiche
            </button>
          </div>
        </div>
      </div>
      <div className="profile-subpanel">
        <div className="session-title-copy">3 · Modulo settimanale coach</div>
        <div className="form-grid-two">
          <label className="form-field">
            <span>Settimana da customizzare</span>
            <select className="form-select" value={selectedGymWeekStart} onChange={(e) => setSelectedGymWeekStart(e.target.value)}>
              {programWeekRows.slice(0, 52).map((w) => (
                <option key={`gym-week-opt-${w.weekStart}`} value={w.weekStart}>
                  Settimana {w.week} · {new Date(w.weekStart).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Giorni allenamento / week</span>
            <select
              className="form-select"
              value={selectedWeekConfig().sessionsPerWeek}
              onChange={(e) => {
                const nextDays = Math.max(1, Math.min(GYM_WEEK_DAY_SLOTS, Number(e.target.value) || 1));
                updateSelectedWeekConfig({
                  sessionsPerWeek: nextDays,
                  modules: ensureGymWeekModules(selectedWeekConfig().modules),
                });
                setGymTrainingDaysPerWeek(nextDays);
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={`gym-days-${d}`} value={d}>
                  {d} giorni
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Volume settimana (% vs {VIRYA_LOAD_SHORT.toLowerCase()} macrofase)</span>
            <input
              className="form-input"
              type="number"
              min={50}
              max={180}
              value={selectedWeekConfig().loadPct}
              onChange={(e) => {
                const pct = Math.max(50, Math.min(180, Number(e.target.value) || 100));
                updateSelectedWeekConfig({ loadPct: pct });
              }}
            />
          </label>
          <label className="form-field">
            <span>Obiettivo Gym annuale</span>
            <select className="form-select" value={gymPrimaryGoal} onChange={(e) => setGymPrimaryGoal(e.target.value as GymPrimaryGoal)}>
              {gymGoalLabels.map((g) => (
                <option key={`gym-goal-select-${g.id}`} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="builder-zone-legend" style={{ marginTop: "8px" }}>
          <span className="builder-zone-chip">
            Stato volume: {loadStatusLabel(selectedWeekConfig().loadPct)} ({selectedWeekConfig().loadPct}%)
          </span>
          <Link href={`/training/calendar?date=${selectedGymWeekStart}`} style={{ color: "var(--empathy-primary)", textDecoration: "none", alignSelf: "center" }}>
            Apri settimana in Calendar →
          </Link>
        </div>
        <small style={{ color: "var(--empathy-text-muted)" }}>
          Regola volume: Scarico 50-99% · Stabile 100% · Carico 101-180%. Configura fino a {GYM_WEEK_DAY_SLOTS}{" "}
          giorni; in generazione Calendar si usano i primi {selectedWeekConfig().sessionsPerWeek} giorni della tabella.
        </small>
        <div style={{ marginTop: "8px", overflowX: "auto" }}>
          <table className="table-shell">
            <thead>
              <tr>
                <th>Giorno</th>
                <th>Distretti allenati (multipli)</th>
                <th>Obiettivo distretto</th>
                <th>Tipo esercizio</th>
                <th>Metodologia</th>
              </tr>
            </thead>
            <tbody>
              {ensureGymWeekModules(selectedWeekConfig().modules).map((row) => {
                const active = row.dayIndex <= selectedWeekConfig().sessionsPerWeek;
                return (
                <tr
                  key={`gym-day-module-${row.dayIndex}`}
                  style={active ? undefined : { opacity: 0.45 }}
                  title={
                    active
                      ? undefined
                      : "Giorno oltre le sedute/settimana — non usato in generazione finché non aumenti i giorni allenamento"
                  }
                >
                  <td>
                    Giorno {row.dayIndex}
                    {!active ? <span className="ml-1 text-[0.65rem] text-slate-500">(riserva)</span> : null}
                  </td>
                  <td>
                    <div className="flex max-w-[420px] flex-wrap gap-1">
                      {gymDistrictOptions.map((opt) => {
                        const on = gymModuleDistricts(row).includes(opt);
                        return (
                          <button
                            key={`district-chip-${row.dayIndex}-${opt}`}
                            type="button"
                            className={cn(
                              "rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold transition",
                              on
                                ? "border-fuchsia-400/60 bg-fuchsia-500/25 text-fuchsia-50"
                                : "border-white/15 bg-black/40 text-slate-400 hover:border-fuchsia-400/35 hover:text-fuchsia-100",
                            )}
                            onClick={() =>
                              updateSelectedWeekConfig({
                                modules: ensureGymWeekModules(selectedWeekConfig().modules).map((m) =>
                                  m.dayIndex === row.dayIndex ? toggleGymDistrict(m, opt) : m,
                                ),
                              })
                            }
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td>
                    <select
                      className="form-select"
                      value={row.districtObjective}
                      onChange={(e) =>
                        updateSelectedWeekConfig({
                          modules: selectedWeekConfig().modules.map((m) => (m.dayIndex === row.dayIndex ? { ...m, districtObjective: e.target.value } : m)),
                        })
                      }
                    >
                      {gymDistrictObjectiveOptions.map((opt) => (
                        <option key={`district-obj-${row.dayIndex}-${opt}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="form-select"
                      value={row.exerciseType}
                      onChange={(e) =>
                        updateSelectedWeekConfig({
                          modules: selectedWeekConfig().modules.map((m) => (m.dayIndex === row.dayIndex ? { ...m, exerciseType: e.target.value } : m)),
                        })
                      }
                    >
                      {gymExerciseTypeOptions.map((opt) => (
                        <option key={`ex-type-${row.dayIndex}-${opt}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="form-select"
                      value={row.methodology}
                      onChange={(e) =>
                        updateSelectedWeekConfig({
                          modules: selectedWeekConfig().modules.map((m) => (m.dayIndex === row.dayIndex ? { ...m, methodology: e.target.value } : m)),
                        })
                      }
                    >
                      {gymMethodologyOptions.map((opt) => (
                        <option key={`method-${row.dayIndex}-${opt}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
