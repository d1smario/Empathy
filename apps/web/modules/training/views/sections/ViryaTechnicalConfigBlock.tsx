"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import type { TechnicalDayModule } from "@/lib/training/virya/virya-day-module-types";
import {
  buildTechnicalDayModules,
  technicalObjectiveOptions,
  technicalExerciseTypeOptions,
  technicalIntensityOptions,
  technicalMethodologyOptions,
} from "@/lib/training/virya/virya-annual-plan-kit";

type TechnicalWeekConfig = { sessionsPerWeek: number; loadPct: number; modules: TechnicalDayModule[] };

/**
 * Ramo "technical" del ternario sportFamily di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaTechnicalConfigBlockProps = {
  technicalPlanStart: string;
  setTechnicalPlanStart: Dispatch<SetStateAction<string>>;
  technicalPlanEnd: string;
  setTechnicalPlanEnd: Dispatch<SetStateAction<string>>;
  technicalMacroPhaseCount: number;
  setTechnicalMacroPhaseCount: Dispatch<SetStateAction<number>>;
  regenerateTechnicalMacroPlan: () => void;
  selectedTechnicalWeekStart: string;
  setSelectedTechnicalWeekStart: Dispatch<SetStateAction<string>>;
  programWeekRows: Array<{ week: number; weekStart: string }>;
  selectedTechnicalWeekConfig: () => TechnicalWeekConfig;
  updateSelectedTechnicalWeekConfig: (patch: Partial<TechnicalWeekConfig>) => void;
  loadStatusLabel: (loadPct: number) => string;
};

export function ViryaTechnicalConfigBlock({
  technicalPlanStart,
  setTechnicalPlanStart,
  technicalPlanEnd,
  setTechnicalPlanEnd,
  technicalMacroPhaseCount,
  setTechnicalMacroPhaseCount,
  regenerateTechnicalMacroPlan,
  selectedTechnicalWeekStart,
  setSelectedTechnicalWeekStart,
  programWeekRows,
  selectedTechnicalWeekConfig,
  updateSelectedTechnicalWeekConfig,
  loadStatusLabel,
}: ViryaTechnicalConfigBlockProps) {
  return (
    <div style={{ marginTop: "10px", display: "grid", gap: "10px" }}>
      <div className="profile-subpanel">
        <div className="session-title-copy">1 · Intervallo periodo</div>
        <div className="form-grid-two">
          <label className="form-field">
            <span>Data inizio piano</span>
            <input className="form-input" type="date" value={technicalPlanStart} onChange={(e) => setTechnicalPlanStart(e.target.value)} />
          </label>
          <label className="form-field">
            <span>Data fine piano</span>
            <input className="form-input" type="date" value={technicalPlanEnd} onChange={(e) => setTechnicalPlanEnd(e.target.value)} />
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
              value={technicalMacroPhaseCount}
              onChange={(e) => setTechnicalMacroPhaseCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
            />
          </label>
          <div className="form-field" style={{ display: "flex", alignItems: "end" }}>
            <button type="button" className="btn-secondary" onClick={regenerateTechnicalMacroPlan}>
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
            <select className="form-select" value={selectedTechnicalWeekStart} onChange={(e) => setSelectedTechnicalWeekStart(e.target.value)}>
              {programWeekRows.slice(0, 52).map((w) => (
                <option key={`tech-week-opt-${w.weekStart}`} value={w.weekStart}>
                  Settimana {w.week} · {new Date(w.weekStart).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Giorni allenamento / week</span>
            <select
              className="form-select"
              value={selectedTechnicalWeekConfig().sessionsPerWeek}
              onChange={(e) => {
                const nextDays = Math.max(1, Math.min(7, Number(e.target.value) || 1));
                const baseModules = selectedTechnicalWeekConfig().modules.slice(0, nextDays);
                const modules = baseModules.length ? baseModules : buildTechnicalDayModules(nextDays);
                while (modules.length < nextDays) {
                  const day = modules.length + 1;
                  modules.push({
                    dayIndex: day,
                    objectives: ["Condizione fisica", "Tecnica con modulo"],
                    exerciseType: "Lavoro tattico a reparti",
                    intensity: "Media",
                    methodology: "Progressivo",
                  });
                }
                updateSelectedTechnicalWeekConfig({ sessionsPerWeek: nextDays, modules });
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={`tech-days-${d}`} value={d}>
                  {d} giorni
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Volume settimana (% vs TSS macrofase)</span>
            <input
              className="form-input"
              type="number"
              min={50}
              max={180}
              value={selectedTechnicalWeekConfig().loadPct}
              onChange={(e) => {
                const pct = Math.max(50, Math.min(180, Number(e.target.value) || 100));
                updateSelectedTechnicalWeekConfig({ loadPct: pct });
              }}
            />
          </label>
        </div>
        <div className="builder-zone-legend" style={{ marginTop: "8px" }}>
          <span className="builder-zone-chip">
            Stato volume: {loadStatusLabel(selectedTechnicalWeekConfig().loadPct)} ({selectedTechnicalWeekConfig().loadPct}%)
          </span>
          <Link href={`/training/calendar?date=${selectedTechnicalWeekStart}`} style={{ color: "var(--empathy-primary)", textDecoration: "none", alignSelf: "center" }}>
            Apri settimana in Calendar →
          </Link>
        </div>
        <small style={{ color: "var(--empathy-text-muted)" }}>
          Regola volume: Scarico 50-99% · Stabile 100% · Carico 101-180%.
        </small>
        <div style={{ marginTop: "8px", overflowX: "auto" }}>
          <table className="table-shell">
            <thead>
              <tr>
                <th>Giorno</th>
                <th>Obiettivo del giorno (sequenza)</th>
                <th>Tipo esercizio</th>
                <th>Intensita</th>
                <th>Metodo</th>
              </tr>
            </thead>
            <tbody>
              {selectedTechnicalWeekConfig().modules.slice(0, selectedTechnicalWeekConfig().sessionsPerWeek).map((row) => (
                <tr key={`tech-day-module-${row.dayIndex}`}>
                  <td>Giorno {row.dayIndex}</td>
                  <td>
                    <div className="builder-zone-legend" style={{ marginBottom: "6px" }}>
                      {row.objectives.map((obj, idx) => (
                        <span key={`obj-seq-${row.dayIndex}-${idx}`} className="builder-zone-chip">
                          {idx + 1}. {obj}
                        </span>
                      ))}
                    </div>
                    <div className="builder-zone-legend">
                      {technicalObjectiveOptions.map((obj) => (
                        <button
                          key={`obj-opt-${row.dayIndex}-${obj}`}
                          type="button"
                          className={`builder-zone-chip ${row.objectives.includes(obj) ? "builder-chip-active" : ""}`}
                          onClick={() => {
                            const current = selectedTechnicalWeekConfig().modules;
                            updateSelectedTechnicalWeekConfig({
                              modules: current.map((m) =>
                                m.dayIndex === row.dayIndex
                                  ? {
                                      ...m,
                                      objectives: m.objectives.includes(obj)
                                        ? m.objectives.filter((x) => x !== obj)
                                        : [...m.objectives, obj],
                                    }
                                  : m,
                              ),
                            });
                          }}
                        >
                          {obj}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td>
                    <select
                      className="form-select"
                      value={row.exerciseType}
                      onChange={(e) =>
                        updateSelectedTechnicalWeekConfig({
                          modules: selectedTechnicalWeekConfig().modules.map((m) =>
                            m.dayIndex === row.dayIndex ? { ...m, exerciseType: e.target.value } : m,
                          ),
                        })
                      }
                    >
                      {technicalExerciseTypeOptions.map((opt) => (
                        <option key={`tech-ex-${row.dayIndex}-${opt}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="form-select"
                      value={row.intensity}
                      onChange={(e) =>
                        updateSelectedTechnicalWeekConfig({
                          modules: selectedTechnicalWeekConfig().modules.map((m) =>
                            m.dayIndex === row.dayIndex ? { ...m, intensity: e.target.value } : m,
                          ),
                        })
                      }
                    >
                      {technicalIntensityOptions.map((opt) => (
                        <option key={`tech-int-${row.dayIndex}-${opt}`} value={opt}>
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
                        updateSelectedTechnicalWeekConfig({
                          modules: selectedTechnicalWeekConfig().modules.map((m) =>
                            m.dayIndex === row.dayIndex ? { ...m, methodology: e.target.value } : m,
                          ),
                        })
                      }
                    >
                      {technicalMethodologyOptions.map((opt) => (
                        <option key={`tech-method-${row.dayIndex}-${opt}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
