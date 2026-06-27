"use client";

/**
 * Ramo "aerobic" del ternario sportFamily di ViryaAnnualPlanOrchestrator
 * (decomposizione del God-component). Nota statica render-only: nessuna prop.
 */
export type ViryaAerobicNoteProps = Record<string, never>;

export function ViryaAerobicNote({}: ViryaAerobicNoteProps) {
  return (
    <p className="mt-4 rounded-xl border border-orange-400/25 bg-orange-500/[0.06] px-3 py-2.5 text-xs leading-relaxed text-orange-100/90">
      Ogni piano Virya è <span className="font-semibold text-pink-200">mono-disciplina</span>: per più sport crea piani separati (stesso flusso guidato). La disciplina attiva è quella scelta al passo 2; la generazione Calendar usa solo quella.
    </p>
  );
}
