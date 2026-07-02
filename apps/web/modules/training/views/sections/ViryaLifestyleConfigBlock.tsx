"use client";

import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { LifestyleDayModule } from "@/lib/training/virya/virya-day-module-types";
import {
  buildLifestyleDayModules,
  lifestyleObjectiveOptions,
  lifestylePracticeOptions,
  lifestyleBreathingOptions,
  lifestyleHoldFlowOptions,
  lifestyleMethodologyOptions,
} from "@/lib/training/virya/virya-annual-plan-kit";

type LifestyleWeekConfig = { sessionsPerWeek: number; loadPct: number; modules: LifestyleDayModule[] };

/**
 * Ramo "lifestyle" (default del ternario sportFamily) di
 * ViryaAnnualPlanOrchestrator (decomposizione del God-component). Render-only:
 * stato/handler nel padre, passati via props. JSX verbatim.
 */
export type ViryaLifestyleConfigBlockProps = {
  lifestylePlanStart: string;
  setLifestylePlanStart: Dispatch<SetStateAction<string>>;
  lifestylePlanEnd: string;
  setLifestylePlanEnd: Dispatch<SetStateAction<string>>;
  lifestyleMacroPhaseCount: number;
  setLifestyleMacroPhaseCount: Dispatch<SetStateAction<number>>;
  regenerateLifestyleMacroPlan: () => void;
  selectedLifestyleWeekStart: string;
  setSelectedLifestyleWeekStart: Dispatch<SetStateAction<string>>;
  programWeekRows: Array<{ week: number; weekStart: string }>;
  selectedLifestyleWeekConfig: () => LifestyleWeekConfig;
  updateSelectedLifestyleWeekConfig: (patch: Partial<LifestyleWeekConfig>) => void;
  loadStatusLabel: (loadPct: number) => string;
};

export function ViryaLifestyleConfigBlock({
  lifestylePlanStart,
  setLifestylePlanStart,
  lifestylePlanEnd,
  setLifestylePlanEnd,
  lifestyleMacroPhaseCount,
  setLifestyleMacroPhaseCount,
  regenerateLifestyleMacroPlan,
  selectedLifestyleWeekStart,
  setSelectedLifestyleWeekStart,
  programWeekRows,
  selectedLifestyleWeekConfig,
  updateSelectedLifestyleWeekConfig,
  loadStatusLabel,
}: ViryaLifestyleConfigBlockProps) {
  const t = useTranslations("ViryaLifestyleConfigBlock");
  return (
    <div style={{ marginTop: "10px", display: "grid", gap: "10px" }}>
      <div className="profile-subpanel">
        <div className="session-title-copy">{t("periodRangeTitle")}</div>
        <div className="form-grid-two">
          <label className="form-field">
            <span>{t("planStartDate")}</span>
            <input className="form-input" type="date" value={lifestylePlanStart} onChange={(e) => setLifestylePlanStart(e.target.value)} />
          </label>
          <label className="form-field">
            <span>{t("planEndDate")}</span>
            <input className="form-input" type="date" value={lifestylePlanEnd} onChange={(e) => setLifestylePlanEnd(e.target.value)} />
          </label>
        </div>
      </div>
      <div className="profile-subpanel">
        <div className="session-title-copy">{t("macroPhasesTitle")}</div>
        <div className="form-grid-two">
          <label className="form-field">
            <span>{t("numberOfMacroPhases")}</span>
            <input
              className="form-input"
              type="number"
              min={1}
              max={8}
              value={lifestyleMacroPhaseCount}
              onChange={(e) => setLifestyleMacroPhaseCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
            />
          </label>
          <div className="form-field" style={{ display: "flex", alignItems: "end" }}>
            <button type="button" className="btn-secondary" onClick={regenerateLifestyleMacroPlan}>
              {t("generateAutomaticMacroPhases")}
            </button>
          </div>
        </div>
      </div>
      <div className="profile-subpanel">
        <div className="session-title-copy">{t("coachWeeklyModuleTitle")}</div>
        <div className="form-grid-two">
          <label className="form-field">
            <span>{t("weekToCustomize")}</span>
            <select className="form-select" value={selectedLifestyleWeekStart} onChange={(e) => setSelectedLifestyleWeekStart(e.target.value)}>
              {programWeekRows.slice(0, 52).map((w) => (
                <option key={`life-week-opt-${w.weekStart}`} value={w.weekStart}>
                  {t("weekOptionLabel", { week: w.week, date: new Date(w.weekStart).toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" }) })}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{t("trainingDaysPerWeek")}</span>
            <select
              className="form-select"
              value={selectedLifestyleWeekConfig().sessionsPerWeek}
              onChange={(e) => {
                const nextDays = Math.max(1, Math.min(7, Number(e.target.value) || 1));
                const baseModules = selectedLifestyleWeekConfig().modules.slice(0, nextDays);
                const modules = baseModules.length ? baseModules : buildLifestyleDayModules(nextDays);
                while (modules.length < nextDays) {
                  const day = modules.length + 1;
                  modules.push({
                    dayIndex: day,
                    objective: "Recupero attivo",
                    practiceType: "Yoga flow",
                    intensityRpe: 4,
                    breathingCadence: "4-2-6",
                    holdOrFlow: "Flow continuo",
                    methodology: "Respirazione guidata",
                  });
                }
                updateSelectedLifestyleWeekConfig({ sessionsPerWeek: nextDays, modules });
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={`life-days-${d}`} value={d}>
                  {t("daysOption", { d })}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{t("weekVolumeLabel")}</span>
            <input
              className="form-input"
              type="number"
              min={50}
              max={180}
              value={selectedLifestyleWeekConfig().loadPct}
              onChange={(e) => {
                const pct = Math.max(50, Math.min(180, Number(e.target.value) || 100));
                updateSelectedLifestyleWeekConfig({ loadPct: pct });
              }}
            />
          </label>
        </div>
        <div className="builder-zone-legend" style={{ marginTop: "8px" }}>
          <span className="builder-zone-chip">
            {t("volumeStatus", { status: loadStatusLabel(selectedLifestyleWeekConfig().loadPct), pct: selectedLifestyleWeekConfig().loadPct })}
          </span>
          <Link href={`/training/calendar?date=${selectedLifestyleWeekStart}`} style={{ color: "var(--empathy-primary)", textDecoration: "none", alignSelf: "center" }}>
            {t("openWeekInCalendar")}
          </Link>
        </div>
        <small style={{ color: "var(--empathy-text-muted)" }}>
          {t("volumeRule")}
        </small>
        <div style={{ marginTop: "8px", overflowX: "auto" }}>
          <table className="table-shell">
            <thead>
              <tr>
                <th>{t("thDay")}</th>
                <th>{t("thObjective")}</th>
                <th>{t("thPracticeType")}</th>
                <th>{t("thRpeIntensity")}</th>
                <th>{t("thBreathingCadence")}</th>
                <th>{t("thHoldFlow")}</th>
                <th>{t("thMethodology")}</th>
              </tr>
            </thead>
            <tbody>
              {selectedLifestyleWeekConfig().modules.slice(0, selectedLifestyleWeekConfig().sessionsPerWeek).map((row) => (
                <tr key={`life-day-module-${row.dayIndex}`}>
                  <td>{t("dayLabel", { day: row.dayIndex })}</td>
                  <td>
                    <select
                      className="form-select"
                      value={row.objective}
                      onChange={(e) =>
                        updateSelectedLifestyleWeekConfig({
                          modules: selectedLifestyleWeekConfig().modules.map((m) =>
                            m.dayIndex === row.dayIndex ? { ...m, objective: e.target.value } : m,
                          ),
                        })
                      }
                    >
                      {lifestyleObjectiveOptions.map((opt) => (
                        <option key={`life-obj-${row.dayIndex}-${opt}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="form-select"
                      value={row.practiceType}
                      onChange={(e) =>
                        updateSelectedLifestyleWeekConfig({
                          modules: selectedLifestyleWeekConfig().modules.map((m) =>
                            m.dayIndex === row.dayIndex ? { ...m, practiceType: e.target.value } : m,
                          ),
                        })
                      }
                    >
                      {lifestylePracticeOptions.map((opt) => (
                        <option key={`life-practice-${row.dayIndex}-${opt}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={10}
                      step={1}
                      value={row.intensityRpe}
                      onChange={(e) =>
                        updateSelectedLifestyleWeekConfig({
                          modules: selectedLifestyleWeekConfig().modules.map((m) =>
                            m.dayIndex === row.dayIndex ? { ...m, intensityRpe: Math.max(1, Math.min(10, Number(e.target.value) || 1)) } : m,
                          ),
                        })
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="form-select"
                      value={row.breathingCadence}
                      onChange={(e) =>
                        updateSelectedLifestyleWeekConfig({
                          modules: selectedLifestyleWeekConfig().modules.map((m) =>
                            m.dayIndex === row.dayIndex ? { ...m, breathingCadence: e.target.value } : m,
                          ),
                        })
                      }
                    >
                      {lifestyleBreathingOptions.map((opt) => (
                        <option key={`life-breath-${row.dayIndex}-${opt}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="form-select"
                      value={row.holdOrFlow}
                      onChange={(e) =>
                        updateSelectedLifestyleWeekConfig({
                          modules: selectedLifestyleWeekConfig().modules.map((m) =>
                            m.dayIndex === row.dayIndex ? { ...m, holdOrFlow: e.target.value } : m,
                          ),
                        })
                      }
                    >
                      {lifestyleHoldFlowOptions.map((opt) => (
                        <option key={`life-hold-${row.dayIndex}-${opt}`} value={opt}>
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
                        updateSelectedLifestyleWeekConfig({
                          modules: selectedLifestyleWeekConfig().modules.map((m) =>
                            m.dayIndex === row.dayIndex ? { ...m, methodology: e.target.value } : m,
                          ),
                        })
                      }
                    >
                      {lifestyleMethodologyOptions.map((opt) => (
                        <option key={`life-method-${row.dayIndex}-${opt}`} value={opt}>
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
