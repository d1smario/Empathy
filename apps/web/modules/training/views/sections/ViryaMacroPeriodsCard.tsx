"use client";

import { CalendarRange } from "lucide-react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";

/**
 * Card "Macro-periodi di preparazione" del render di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaMacroPeriodsCardProps = {
  planWindowStart: string;
  planWindowEnd: string;
  applyClassicPeriodization: () => void;
};

export function ViryaMacroPeriodsCard({
  planWindowStart,
  planWindowEnd,
  applyClassicPeriodization,
}: ViryaMacroPeriodsCardProps) {
  return (
    <Pro2SectionCard
      accent="violet"
      title="Macro-periodi di preparazione"
      subtitle="Base, costruzione, rifinitura, forma — quattro fasi sulla durata scelta al passo 3"
      icon={CalendarRange}
    >
      <p className="mb-3 text-xs text-slate-400">
        Il template ripartisce la finestra <span className="font-mono text-slate-300">{planWindowStart}</span> →{" "}
        <span className="font-mono text-slate-300">{planWindowEnd}</span> in quattro blocchi coerenti. Puoi
        rifinire date e TSS nel passo successivo (tabella fasi e griglia settimanale).
      </p>
      <button
        type="button"
        className="rounded-xl border border-violet-500/45 bg-violet-500/15 px-4 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-500/25"
        onClick={applyClassicPeriodization}
      >
        Genera fasi classiche (base · costruzione · rifinitura · forma)
      </button>
      <p className="mt-2 text-[0.7rem] text-slate-500">
        Sovrascrive l’elenco fasi attuale e azzera le personalizzazioni settimanali finché non le reimposti al passo 5.
      </p>
    </Pro2SectionCard>
  );
}
