"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type {
  BioenergeticChannelCurveResolutionV1,
  BioenergeticMonitoringChannel24,
  BioenergeticMonitoringDataPlane,
} from "@/api/bioenergetics/contracts";
import type { BioenergeticCurveGovernanceHintV1 } from "@empathy/contracts";
import { CHART_AXIS, CHART_GRID, CHART_SIGNAL, chartTooltipStyle } from "@/lib/ui/chart-theme";

/**
 * Renderer condiviso del singolo canale "Striscia 24 h": stesso grafico usato
 * dalla card compatta in griglia e dal modale d'espansione (DRY). `prepare…`
 * normalizza stream vs orario; `BioenergeticChannelChart` disegna a un'altezza
 * arbitraria. Helper di presentazione (piano dato / fusione / nota assi)
 * esportati per riuso.
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

const DEFAULT_STROKE = CHART_SIGNAL.glucose;

export function planeLabel(plane: BioenergeticMonitoringDataPlane): string {
  if (plane === "measured_stream") return "Stream";
  if (plane === "sparse_lab_hold") return "Lab tenuto";
  if (plane === "ai_from_inputs") return "AI da input";
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
  return "Policy: fase iniziale — prevale curva AI supervisionata (sim come fallback oggi)";
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
      ? "Asse: tempo reale (passo 5 min; curva da OpenAI sugli input giornata — non è CGM né sim diurno v1)."
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

function formatStreamAxisTick(ms: number): string {
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
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

/** Grafico del singolo canale, ad altezza arbitraria (card compatta o modale). */
export function BioenergeticChannelChart({
  channel: ch,
  prepared,
  height,
}: {
  channel: BioenergeticMonitoringChannel24;
  prepared: PreparedChannel;
  height: number;
}) {
  const { streamRows, rows, yDomain } = prepared;
  const stroke = STROKE_BY_CHANNEL_ID[ch.id] ?? DEFAULT_STROKE;

  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height={height} debounce={50}>
        {streamRows?.length ? (
          <LineChart data={streamRows} margin={{ top: 6, right: 4, left: 2, bottom: 22 }}>
            <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} vertical={false} />
            <XAxis
              type="number"
              dataKey="tsMs"
              domain={["dataMin", "dataMax"]}
              scale="time"
              tickFormatter={formatStreamAxisTick}
              tick={{ fill: CHART_AXIS.tick, fontSize: 8 }}
              axisLine={{ stroke: CHART_AXIS.line }}
              tickLine={false}
              minTickGap={32}
              height={18}
            />
            <YAxis
              width={36}
              tick={{ fill: CHART_AXIS.tick, fontSize: 9 }}
              domain={yDomain}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={chartTooltipStyle("bioenergetics")}
              formatter={(value) => {
                const v = typeof value === "number" ? value : Number(value);
                return Number.isFinite(v) ? [`${v.toFixed(3)} ${ch.unit}`, ch.labelIt] : ["—", ch.labelIt];
              }}
              labelFormatter={(_label, payload) => {
                const row = payload?.[0]?.payload as { tsMs?: number } | undefined;
                if (row && typeof row.tsMs === "number" && Number.isFinite(row.tsMs)) {
                  return new Date(row.tsMs).toLocaleString("it-IT");
                }
                return "Orario";
              }}
            />
            <Line
              type="linear"
              dataKey="v"
              stroke={stroke}
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        ) : (
          <LineChart data={rows} margin={{ top: 6, right: 2, left: 2, bottom: 18 }}>
            <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} vertical={false} />
            <XAxis
              dataKey="hourLabel"
              tick={{ fill: CHART_AXIS.tick, fontSize: 8 }}
              axisLine={{ stroke: CHART_AXIS.line }}
              tickLine={false}
              interval={3}
              height={16}
            />
            <YAxis
              width={36}
              tick={{ fill: CHART_AXIS.tick, fontSize: 9 }}
              domain={yDomain}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={chartTooltipStyle("bioenergetics")}
              formatter={(value) => {
                const v = typeof value === "number" ? value : Number(value);
                return Number.isFinite(v) ? [`${v.toFixed(3)} ${ch.unit}`, "Valore"] : ["—", ch.labelIt];
              }}
              labelFormatter={(_label, payload) => {
                const row = payload?.[0]?.payload as
                  | { hour?: number; hourLabel?: string; hourEndLabel?: string }
                  | undefined;
                if (row && typeof row.hour === "number") {
                  return `Finestra: ${row.hourLabel}–${row.hourEndLabel}`;
                }
                return "Orario";
              }}
            />
            <Line
              type="monotone"
              dataKey="v"
              stroke={stroke}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
