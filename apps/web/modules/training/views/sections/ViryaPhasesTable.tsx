"use client";

import {
  PhasePlan,
  PhaseType,
  SportFamily,
  VIRYA_LOAD_SHORT,
  gymMacroObjectiveLabels,
  phaseColor,
  tssColor,
} from "@/lib/training/virya/virya-annual-plan-kit";

/**
 * Tabella "Fasi, mesocicli, carico/scarico" del render di
 * ViryaAnnualPlanOrchestrator (decomposizione del God-component).
 * Render-only: stato/handler nel padre, passati via props. JSX verbatim.
 */
export type ViryaPhasesTableProps = {
  phases: PhasePlan[];
  sportFamily: SportFamily;
  strengthPhaseLoadHints: Map<string, { avgLoad: number; avgSessions: number }>;
  addPhase: () => void;
  updatePhase: (id: string, patch: Partial<PhasePlan>) => void;
  removePhase: (id: string) => void;
};

export function ViryaPhasesTable({
  phases,
  sportFamily,
  strengthPhaseLoadHints,
  addPhase,
  updatePhase,
  removePhase,
}: ViryaPhasesTableProps) {
  return (
    <section className="viz-card builder-panel" style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
        <h3 className="viz-title" style={{ margin: 0 }}>Fasi, mesocicli, carico/scarico</h3>
        <button type="button" className="btn-primary" onClick={addPhase}>+ Fase</button>
      </div>
      <table className="table-shell">
        <thead>
          <tr>
            <th>Inizio</th>
            <th>Fine</th>
            <th>Fase</th>
            {(sportFamily === "strength" || sportFamily === "technical" || sportFamily === "lifestyle") && <th>Obiettivo macrofase</th>}
            <th>Mesociclo</th>
            <th>{VIRYA_LOAD_SHORT}/w</th>
            <th>Sedute/w</th>
            <th>Note</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {phases.map((p) => (
            <tr key={p.id} style={{ background: `${phaseColor(p.phase)}14` }}>
              <td><input className="form-input" type="date" value={p.start} onChange={(e) => updatePhase(p.id, { start: e.target.value })} /></td>
              <td><input className="form-input" type="date" value={p.end} onChange={(e) => updatePhase(p.id, { end: e.target.value })} /></td>
              <td>
                <select
                  className="form-select"
                  value={p.phase}
                  style={{ borderColor: phaseColor(p.phase), color: phaseColor(p.phase) }}
                  onChange={(e) => updatePhase(p.id, { phase: e.target.value as PhaseType })}
                >
                  <option value="base">Base</option>
                  <option value="build">Costruzione</option>
                  <option value="refine">Rifinitura</option>
                  <option value="peak">Forma</option>
                  <option value="deload">Scarico</option>
                  <option value="second_peak">Secondo picco</option>
                </select>
              </td>
              {(sportFamily === "strength" || sportFamily === "technical" || sportFamily === "lifestyle") && (
                <td>
                  <select
                    className="form-select"
                    value={
                      p.macroObjective ??
                      (sportFamily === "strength"
                        ? "forza"
                        : sportFamily === "technical"
                          ? "tecnico_tattico"
                          : "lifestyle_balance")
                    }
                    onChange={(e) => updatePhase(p.id, { macroObjective: e.target.value })}
                  >
                    {sportFamily === "strength"
                      ? gymMacroObjectiveLabels.map((g) => (
                          <option key={`macro-obj-${p.id}-${g.id}`} value={g.id}>
                            {g.label}
                          </option>
                        ))
                      : sportFamily === "technical"
                        ? [
                          <option key={`macro-obj-${p.id}-tecnico_tattico`} value="tecnico_tattico">Tecnico-tattico</option>,
                          <option key={`macro-obj-${p.id}-offensiva`} value="offensiva">Offensiva</option>,
                          <option key={`macro-obj-${p.id}-difensiva`} value="difensiva">Difensiva</option>,
                          <option key={`macro-obj-${p.id}-mista`} value="mista">Mista</option>,
                        ]
                        : [
                            <option key={`macro-obj-${p.id}-lifestyle_balance`} value="lifestyle_balance">Balance</option>,
                            <option key={`macro-obj-${p.id}-respirazione`} value="respirazione">Respirazione</option>,
                            <option key={`macro-obj-${p.id}-mobilita`} value="mobilita">Mobilita</option>,
                            <option key={`macro-obj-${p.id}-recovery`} value="recovery">Recovery</option>,
                          ]}
                  </select>
                </td>
              )}
              <td><input className="form-input" value={p.mesocycle} onChange={(e) => updatePhase(p.id, { mesocycle: e.target.value })} /></td>
              <td>
                <input
                  className="form-input"
                  type="number"
                  value={p.weeklyTss}
                  title={
                    sportFamily === "strength" && strengthPhaseLoadHints.get(p.id)
                      ? `Media dal programma settimanale (passo 5): ${strengthPhaseLoadHints.get(p.id)!.avgLoad} ${VIRYA_LOAD_SHORT.toLowerCase()} · ${strengthPhaseLoadHints.get(p.id)!.avgSessions} sedute`
                      : undefined
                  }
                  style={{ borderColor: tssColor(p.weeklyTss), color: tssColor(p.weeklyTss) }}
                  onChange={(e) => updatePhase(p.id, { weeklyTss: Number(e.target.value) || 0 })}
                />
              </td>
              <td><input className="form-input" type="number" value={p.sessionsPerWeek} onChange={(e) => updatePhase(p.id, { sessionsPerWeek: Number(e.target.value) || 0 })} /></td>
              <td><input className="form-input" value={p.notes} onChange={(e) => updatePhase(p.id, { notes: e.target.value })} /></td>
              <td><button type="button" className="btn-primary" style={{ background: "rgba(255,255,255,0.12)" }} onClick={() => removePhase(p.id)}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
