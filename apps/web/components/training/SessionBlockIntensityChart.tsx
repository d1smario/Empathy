"use client";

import { colorForIntensity } from "@/lib/training/builder/pro2-intensity";
import { LOAD_CHIP_LABEL } from "@/lib/training/load-metrics-labels";
import type { ChartSegment } from "@/lib/training/engine/block-chart-segments";

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}s`;
  if (s === 0) return `${m}′`;
  return `${m}′${s.toString().padStart(2, "0")}″`;
}

/**
 * Timeline: larghezza ∝ secondi, altezza ∝ score intensità.
 * Etichette sotto ogni segmento (tempo + zona colorata) — niente lista separata.
 */
export function SessionBlockIntensityChart({
  segments,
  title = "Grafico a blocchi (intensità)",
  estimatedTss,
  compact = false,
}: {
  segments: ChartSegment[];
  title?: string;
  /** Stima TSS (IF² normalizzato: 60′ Z4 ≈ 100). */
  estimatedTss?: number;
  /** Variante compatta per anteprime in lista (libreria coach). */
  compact?: boolean;
}) {
  const totalSec = segments.reduce((s, x) => s + x.durationSeconds, 0) || 1;

  if (segments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center text-sm text-gray-400">
        Nessun blocco da visualizzare.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">
          {title}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.65rem] text-gray-500">
          <span>
            {formatSec(totalSec)} totali · {segments.length} segmenti
          </span>
          {typeof estimatedTss === "number" ? (
            <span className="inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 font-semibold text-orange-300">
              {LOAD_CHIP_LABEL} ~{estimatedTss}
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="rounded-xl border border-orange-500/25 bg-gradient-to-b from-orange-950/20 via-black/60 to-black/75 p-2 shadow-inner shadow-orange-950/20 ring-1 ring-orange-500/15"
        role="img"
        aria-label={`Timeline sessione, ${totalSec} secondi`}
      >
        <div className={`flex gap-1 ${compact ? "min-h-[8rem]" : "min-h-[11rem]"}`}>
          {segments.map((seg) => {
            const heightScore = seg.barIntensityScore ?? seg.intensityScore;
            const pct = (heightScore / 7) * 100;
            const h = Math.max(22, pct);
            const zoneColor = colorForIntensity(seg.intensityLabel);
            /** Piramide: stessa zona ma target diverso → scala luminosità col gradiente lineare. */
            const pyramidBright =
              typeof seg.pyramidLinearT === "number"
                ? 0.78 + seg.pyramidLinearT * 0.42
                : 1;
            return (
              <div
                key={seg.id}
                className="flex min-w-0 flex-col"
                style={{ flexGrow: Math.max(1, seg.durationSeconds), flexBasis: 0 }}
              >
                <div className={`flex flex-1 flex-col justify-end ${compact ? "min-h-[5rem]" : "min-h-[7.5rem]"}`}>
                  <div
                    className="mx-0.5 rounded-t-lg shadow-[inset_0_-2px_0_rgba(0,0,0,0.35)] ring-1 ring-white/10 transition hover:brightness-110"
                    style={{
                      height: `${h}%`,
                      minHeight: "2.25rem",
                      backgroundColor: zoneColor,
                      boxShadow: `0 0 18px ${zoneColor}55`,
                      filter: typeof seg.pyramidLinearT === "number" ? `brightness(${pyramidBright}) saturate(1.08)` : undefined,
                    }}
                    title={`${seg.label}: ${formatSec(seg.durationSeconds)}, ${seg.intensityLabel}`}
                  />
                </div>
                <div className="mt-1.5 px-0.5 text-center">
                  <p className="truncate font-mono text-[0.62rem] font-semibold leading-tight text-white/95">{formatSec(seg.durationSeconds)}</p>
                  <p
                    className="truncate text-[0.62rem] font-bold leading-tight"
                    style={{ color: zoneColor }}
                  >
                    {seg.intensityLabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!compact ? (
        <p className="text-[0.6rem] leading-relaxed text-gray-500">
          Colori = zona; larghezza = tempo. Altezza = carico (piramide: incremento lineare su W/bpm, non solo etichetta zona).
          {typeof estimatedTss === "number" ? (
            <>
              {" "}
              TSS stimato: modello somma <span className="text-orange-300/90">IF²</span> per segmento, calibrato su{" "}
              <span className="text-orange-300/90">60′ in Z4 ≈ 100 TSS</span>.
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
