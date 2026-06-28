"use client";

import type {
  BioenergeticChannelCurveResolutionV1,
  BioenergeticMonitoringChannel24,
  BioenergeticMonitoringDataPlane,
} from "@/api/bioenergetics/contracts";
import type { BioenergeticCurveGovernanceHintV1 } from "@empathy/contracts";
import { CHART_SIGNAL } from "@/lib/ui/chart-theme";

/**
 * Base condivisa (recharts-FREE) del canale "Striscia 24 h": tipi, normalizzazione
 * (`prepareBioenergeticChannel`), helper di presentazione e la sparkline SVG leggera.
 * Il grafico ricco recharts vive in BioenergeticChannelChartRecharts.tsx e si carica
 * con `next/dynamic` (BioenergeticChannelChartLazy), così recharts NON entra nel
 * bundle di chi importa solo questa base (es. dashboard mobile in modalità sparkline).
 */

export type StreamChartRow = {
  tsMs: number;
  observedAt: string;
  v: number;
  timeLabel: string;
};

export type HourlyRow = {
  hour: number;
  hourLabel: string;
  hourEndLabel: string;
  v: number | null;
};

export const STROKE_BY_CHANNEL_ID: Record<string, string> = {
  glucose: CHART_SIGNAL.glucose,
  lactate: CHART_SIGNAL.lactate,
  insulin_proxy: "#fb923c",
  cortisol: "#38bdf8",
  acth: "#f472b6",
  tsh: "#2dd4bf",
  ft4: "#fde047",
  gh: "#4ade80",
  ghrelin: "#f97316",
  igf1: "#c084fc",
  leptin: "#fbbf24",
};

export const DEFAULT_STROKE = CHART_SIGNAL.glucose;

export function planeLabel(plane: BioenergeticMonitoringDataPlane): string {
  if (plane === "measured_stream") return "Stream";
  if (plane === "sparse_lab_hold") return "Lab tenuto";
  if (plane === "ai_from_inputs") return "Stima da input";
  return "Modello";
}

export function planeBadgeClass(plane: BioenergeticMonitoringDataPlane): string {
  // Pill canonica (§7): stati semantici per piano dato.
  if (plane === "measured_stream") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (plane === "sparse_lab_hold") return "border-sky-500/30 bg-sky-500/10 text-sky-300";
  if (plane === "ai_from_inputs") return "border-lime-500/30 bg-lime-500/10 text-lime-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

export function governanceIt(g: BioenergeticCurveGovernanceHintV1): string {
  if (g === "measurement_wins") return "Policy: vince la misura Empathy";
  if (g === "deterministic_engine_wins") return "Policy: motore / pareggio (contesto ricco vs sim)";
  return "Policy: fase iniziale — prevale curva stimata (sim come fallback oggi)";
}

export function fusionSummary(res: BioenergeticChannelCurveResolutionV1): string {
  const dm = Math.round(res.deterministicWeight01 * 100);
  const ai = Math.round(res.aiProposalWeight01 * 100);
  const r = Math.round(res.internalContextRichness01 * 100);
  return `Fusione v${res.fusionContractVersion}: motore ${dm}% · AI ${ai}% · ricchezza contesto ${r}%`;
}

/** Nota sull'asse temporale, coerente tra card e modale. */
export function channelAxisNote(
  ch: BioenergeticMonitoringChannel24,
  isStream: boolean,
  showTech: boolean,
): string {
  if (!isStream) return "Asse orizzontale: ore del giorno (0–23, locale).";
  if (ch.dataPlane === "measured_stream") {
    return showTech
      ? "Asse: tempo reale del campione (stream misurato; tabella 055 / merge device)."
      : "Asse: tempo reale del campione (misura registrata).";
  }
  if (ch.dataPlane === "ai_from_inputs") {
    return showTech
      ? "Asse: tempo reale (passo 5 min; curva generata dai dati della giornata — non è CGM né sim diurno v1)."
      : "Asse: tempo reale della giornata (passo 5 min). È una stima, non un sensore continuo.";
  }
  return showTech
    ? "Asse: tempo reale del modello (passo 5 min, deterministico da timeline — non è CGM)."
    : "Asse: tempo reale della giornata (passo 5 min). È una stima, non un sensore continuo.";
}

/** Recharts con dominio [v,v] non disegna la linea: aggiunge padding simmetrico. */
export function yDomainFromHourly(hourly: (number | null)[]): [number, number] {
  const nums = hourly.filter((x): x is number => x != null && Number.isFinite(x));
  if (!nums.length) return [0, 1];
  let mn = Math.min(...nums);
  let mx = Math.max(...nums);
  if (!Number.isFinite(mn) || !Number.isFinite(mx)) return [0, 1];
  if (mn > mx) [mn, mx] = [mx, mn];
  if (mn === mx) {
    const pad = Math.max(Math.abs(mn) * 0.06, 0.02);
    return [mn - pad, mx + pad];
  }
  const span = mx - mn;
  const pad = Math.max(span * 0.08, span * 0.01);
  return [mn - pad, mx + pad];
}

function streamValuePlausible(channelId: string, v: number): boolean {
  if (!Number.isFinite(v)) return false;
  if (channelId === "glucose") return v >= 1.8 && v <= 16;
  if (channelId === "lactate") return v >= 0.12 && v <= 28;
  if (channelId === "gh") return v >= 0.02 && v <= 12;
  if (channelId === "ghrelin") return v >= 40 && v <= 1400;
  if (channelId === "igf1") return v >= 35 && v <= 400;
  if (channelId === "leptin") return v >= 0.2 && v <= 12;
  return true;
}

function streamChartRows(
  trace: NonNullable<BioenergeticMonitoringChannel24["streamTrace"]>,
  channelId: string,
): StreamChartRow[] {
  return [...trace]
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
    .map((p) => {
      const tsMs = Date.parse(p.observedAt);
      return {
        tsMs,
        observedAt: p.observedAt,
        v: p.value,
        timeLabel: Number.isFinite(tsMs)
          ? new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(tsMs))
          : "—",
      };
    })
    .filter((r) => Number.isFinite(r.tsMs) && streamValuePlausible(channelId, r.v));
}

export type PreparedChannel = {
  streamRows: StreamChartRow[] | null;
  rows: HourlyRow[];
  hasData: boolean;
  isStream: boolean;
  yDomain: [number, number];
};

/** Normalizza un canale per il grafico (stream ad alta frequenza vs orario). */
export function prepareBioenergeticChannel(ch: BioenergeticMonitoringChannel24): PreparedChannel {
  const streamTrace = ch.streamTrace;
  const isGluLac = ch.id === "glucose" || ch.id === "lactate";
  const useStreamChart =
    streamTrace &&
    (ch.dataPlane === "measured_stream"
      ? streamTrace.length >= 4
      : Boolean(
          isGluLac &&
            (ch.dataPlane === "model_continuous" || ch.dataPlane === "ai_from_inputs") &&
            streamTrace.length >= 72,
        ));
  const streamRows: StreamChartRow[] | null = useStreamChart ? streamChartRows(streamTrace, ch.id) : null;

  const rows: HourlyRow[] = ch.hourly.map((v, hour) => ({
    hour,
    hourLabel: `${String(hour).padStart(2, "0")}:00`,
    hourEndLabel: `${String(hour).padStart(2, "0")}:59`,
    v: v == null || Number.isNaN(v) ? null : v,
  }));

  const isStream = Boolean(streamRows?.length);
  const hasData = isStream ? true : rows.some((r) => r.v != null);
  const yDomain = isStream ? yDomainFromHourly(streamRows!.map((r) => r.v)) : yDomainFromHourly(ch.hourly);

  return { streamRows, rows, hasData, isStream, yDomain };
}

/**
 * Sparkline SVG leggera (zero recharts / zero ResizeObserver) per la griglia in
 * modalità `lite` (dashboard mobile): mostra solo l'andamento. Il grafico ricco
 * (assi/tooltip recharts) resta nel modale d'espansione, montato una sola volta.
 */
/** Formato adattivo: piu' decimali sui valori piccoli (es. glucosio 5.62), meno sui grandi (es. IGF-1 172). */
function formatSparkValue(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

export function BioenergeticSparkline({
  channel: ch,
  prepared,
  height = 36,
}: {
  channel: BioenergeticMonitoringChannel24;
  prepared: PreparedChannel;
  height?: number;
}) {
  const { streamRows, rows, isStream } = prepared;
  const values = isStream
    ? (streamRows ?? []).map((r) => r.v)
    : rows.map((r) => r.v).filter((v): v is number => v != null);
  const stroke = STROKE_BY_CHANNEL_ID[ch.id] ?? DEFAULT_STROKE;
  const W = 100;
  const H = height;

  if (values.length === 0) {
    return <p className="text-[0.65rem] text-gray-600">Nessun dato</p>;
  }

  const current = values[values.length - 1];
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);

  let mn = vMin;
  let mx = vMax;
  if (mn === mx) {
    mn -= 1;
    mx += 1;
  }
  const pad = 3;
  const nPts = values.length;
  const linePoints = values
    .map((v, i) => {
      const x = (i / (nPts - 1)) * W;
      const y = pad + (H - 2 * pad) * (1 - (v - mn) / (mx - mn));
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div>
      {/* Valori leggibili a colpo d'occhio (sostituiscono assi/tooltip recharts su mobile; dettaglio pieno al tocco). */}
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums text-white">
          {formatSparkValue(current)}
          <span className="ml-1 text-[0.6rem] font-normal uppercase tracking-wide text-gray-500">{ch.unit}</span>
        </span>
        <span className="text-[0.6rem] tabular-nums text-gray-500">
          min {formatSparkValue(vMin)} · max {formatSparkValue(vMax)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden>
        {nPts < 2 ? (
          <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke={stroke} strokeOpacity={0.5} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        ) : (
          <polyline
            points={linePoints}
            fill="none"
            stroke={stroke}
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}
