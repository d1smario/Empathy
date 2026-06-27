"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { viryaPlanTag } from "@/lib/training/virya/virya-plan-name";
import { PhasePlan } from "@/lib/training/virya/virya-annual-plan-kit";

/**
 * Card "Salva sul Calendar" del render di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Render-only: stato/handler nel padre,
 * passati via props. JSX verbatim.
 */
export type ViryaSaveToCalendarCardProps = {
  planName: string;
  replacePrevious: boolean;
  setReplacePrevious: Dispatch<SetStateAction<boolean>>;
  generateOnCalendar: () => Promise<void>;
  saving: boolean;
  selectedAthleteId: string | null;
  phases: PhasePlan[];
};

export function ViryaSaveToCalendarCard({
  planName,
  replacePrevious,
  setReplacePrevious,
  generateOnCalendar,
  saving,
  selectedAthleteId,
  phases,
}: ViryaSaveToCalendarCardProps) {
  return (
    <Pro2SectionCard
      accent="cyan"
      title="Salva sul Calendar"
      subtitle="Salva in blocco le sedute del piano sul Calendar"
      icon={CalendarRange}
    >
      <p className="mb-3 text-sm text-slate-300">
        Piano <strong className="text-white">«{planName.trim() || "Senza nome"}»</strong> · tag{" "}
        <code className="rounded bg-black/40 px-1 text-cyan-200">{viryaPlanTag(planName)}</code>.{" "}
        <strong className="text-amber-200">
          Configurare mag–giu in VIRYA non scrive sul Calendar: serve questo pulsante.
        </strong>{" "}
        Dopo il successo, apri Calendar sulle date indicate (es. maggio–giugno).
      </p>
      <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-white/20 bg-black/40"
          checked={replacePrevious}
          onChange={(e) => setReplacePrevious(e.target.checked)}
        />
        <span>
          Sostituisci sessioni VIRYA già salvate nello stesso intervallo di date del piano (marker{" "}
          <code className="rounded bg-black/40 px-1">[VIRYA:…]</code> nelle note)
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-xl border border-cyan-500/50 bg-cyan-500/20 px-5 py-3 text-sm font-semibold text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.12)] hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void generateOnCalendar()}
          disabled={saving || !selectedAthleteId || phases.length === 0}
          title={
            !selectedAthleteId
              ? "Seleziona / carica contesto atleta"
              : phases.length === 0
                ? "Aggiungi fasi (passo 4) prima di generare"
                : undefined
          }
        >
          {saving ? "Generazione in corso…" : "Genera piano annuale su Calendar"}
        </button>
        <Link
          href="/training/calendar"
          className="text-sm font-semibold text-cyan-300 underline decoration-cyan-500/40 hover:text-cyan-200"
        >
          Apri Calendar →
        </Link>
      </div>
    </Pro2SectionCard>
  );
}
