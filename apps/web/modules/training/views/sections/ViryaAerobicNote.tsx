"use client";

/**
 * Ramo "aerobic" del ternario sportFamily di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Nota statica render-only: nessuna prop.
 */
export type ViryaAerobicNoteProps = Record<string, never>;

export function ViryaAerobicNote({}: ViryaAerobicNoteProps) {
  return (
    <p className="mt-4 rounded-xl border border-orange-400/25 bg-orange-500/[0.06] px-3 py-2.5 text-xs leading-relaxed text-orange-100/90">
      Every Virya plan is <span className="font-semibold text-pink-200">single-discipline</span>: for multiple sports, create separate plans (same guided flow). The active discipline is the one chosen at step 2; Calendar generation uses only that one.
    </p>
  );
}
