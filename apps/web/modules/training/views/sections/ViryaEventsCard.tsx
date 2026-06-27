"use client";

import { Flag } from "lucide-react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { RacePlan, RaceType } from "@/lib/training/virya/virya-annual-plan-kit";

/**
 * Card "Eventi e date intermedie" del render di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaEventsCardProps = {
  races: RacePlan[];
  addRace: () => void;
  updateRace: (id: string, patch: Partial<RacePlan>) => void;
  removeRace: (id: string) => void;
};

export function ViryaEventsCard({
  races,
  addRace,
  updateRace,
  removeRace,
}: ViryaEventsCardProps) {
  return (
    <Pro2SectionCard
      accent="cyan"
      title="Eventi e date intermedie"
      subtitle="Gare, test, milestone — ancorano taper e picco"
      icon={Flag}
    >
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
          onClick={addRace}
        >
          + Aggiungi evento
        </button>
      </div>
      <div className="space-y-2">
        {races.map((race) => (
          <div
            key={race.id}
            className="grid gap-2 rounded-xl border border-white/10 bg-black/30 p-3 sm:grid-cols-[140px_1fr_140px_100px_40px] sm:items-center"
          >
            <input
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
              type="date"
              value={race.date}
              onChange={(e) => updateRace(race.id, { date: e.target.value })}
            />
            <input
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
              value={race.name}
              onChange={(e) => updateRace(race.id, { name: e.target.value })}
              placeholder="Nome evento"
            />
            <select
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
              value={race.raceType}
              onChange={(e) => updateRace(race.id, { raceType: e.target.value as RaceType })}
            >
              <option value="warmup">Warm-up</option>
              <option value="milestone">Milestone / intermedio</option>
              <option value="test">Test</option>
              <option value="goal">Gara obiettivo</option>
            </select>
            <select
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
              value={race.priority}
              onChange={(e) => updateRace(race.id, { priority: e.target.value as "A" | "B" | "C" })}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
            <button
              type="button"
              className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-slate-300 hover:bg-white/10"
              onClick={() => removeRace(race.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </Pro2SectionCard>
  );
}
