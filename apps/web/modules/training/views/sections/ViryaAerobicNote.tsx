"use client";

import { useTranslations } from "next-intl";

/**
 * Ramo "aerobic" del ternario sportFamily di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Nota statica render-only: nessuna prop.
 */
export type ViryaAerobicNoteProps = Record<string, never>;

export function ViryaAerobicNote({}: ViryaAerobicNoteProps) {
  const t = useTranslations("ViryaAerobicNote");
  return (
    <p className="mt-4 rounded-xl border border-orange-400/25 bg-orange-500/[0.06] px-3 py-2.5 text-xs leading-relaxed text-orange-100/90">
      {t.rich("note", {
        b: (chunks) => <span className="font-semibold text-pink-200">{chunks}</span>,
      })}
    </p>
  );
}
