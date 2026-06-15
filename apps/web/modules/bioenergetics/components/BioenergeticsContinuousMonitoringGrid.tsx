"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type {
  BioenergeticChannelCurveResolutionV1,
  BioenergeticContinuousMonitoringDay,
  BioenergeticMetricTileCategory,
  BioenergeticMonitoringChannel24,
  BioenergeticMonitoringDataPlane,
} from "@/api/bioenergetics/contracts";
import type { BioenergeticCurveGovernanceHintV1 } from "@empathy/contracts";
import { CHART_AXIS, CHART_GRID, CHART_SIGNAL, chartTooltipStyle } from "@/lib/ui/chart-theme";

const CATEGORY_ORDER: BioenergeticMetricTileCategory[] = [
  "metabolic",
  "inflammatory",
  "hormonal",
  "neural",
  "gastro_intestinal",
  "gonadal",
];

function planeLabel(plane: BioenergeticMonitoringDataPlane): string {
  if (plane === "measured_stream") return "Stream";
  if (plane === "sparse_lab_hold") return "Lab tenuto";
  if (plane === "ai_from_inputs") return "AI da input";
  return "Modello";
}

function planeBadgeClass(plane: BioenergeticMonitoringDataPlane): string {
  // Pill canonica (§7): stati semantici per piano dato.
  if (plane === "measured_stream") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (plane === "sparse_lab_hold") return "border-sky-500/30 bg-sky-500/10 text-sky-300";
  if (plane === "ai_from_inputs") return "border-lime-500/30 bg-lime-500/10 text-lime-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

function governanceIt(g: BioenergeticCurveGovernanceHintV1): string {
  if (g === "measurement_wins") return "Policy: vince la misura Empathy";
  if (g === "deterministic_engine_wins") return "Policy: motore / pareggio (contesto ricco vs sim)";
  return "Policy: fase iniziale — prevale curva AI supervisionata (sim come fallback oggi)";
}

function fusionSummary(res: BioenergeticChannelCurveResolutionV1): string {
  const dm = Math.round(res.deterministicWeight01 * 100);
  const ai = Math.round(res.aiProposalWeight01 * 100);
  const r = Math.round(res.internalContextRichness01 * 100);
  return `Fusione v${res.fusionContractVersion}: motore ${dm}% · AI ${ai}% · ricchezza contesto ${r}%`;
}

type StreamChartRow = {
  tsMs: number;
  observedAt: string;
  v: number;
  timeLabel: string;
};

type Props = {
  monitoring: BioenergeticContinuousMonitoringDay;
};

const CHART_H = 92;

const STROKE_BY_CHANNEL_ID: Record<string, string> = {
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

/** Recharts con dominio [v,v] non disegna la linea: aggiunge padding simmetrico. */
function yDomainFromHourly(hourly: (number | null)[]): [number, number] {
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

export function BioenergeticsContinuousMonitoringGrid({ monitoring }: Props) {
  const sorted = [...monitoring.channels].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((ch) => {
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

        const rows = ch.hourly.map((v, hour) => ({
          hour,
          hourLabel: `${String(hour).padStart(2, "0")}:00`,
          hourEndLabel: `${String(hour).padStart(2, "0")}:59`,
          v: v == null || Number.isNaN(v) ? null : v,
        }));
        const hasData = streamRows?.length ? true : rows.some((r) => r.v != null);
        if (!hasData) return null;

        const yDomain = streamRows?.length ? yDomainFromHourly(streamRows.map((r) => r.v)) : yDomainFromHourly(ch.hourly);

        return (
          <div
            key={ch.id}
            className="rounded-xl border border-white/10 bg-black/30 p-3 shadow-inner shadow-black/40"
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium leading-snug text-white">{ch.labelIt}</p>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{ch.unit}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide ${planeBadgeClass(ch.dataPlane)}`}
                >
                  {planeLabel(ch.dataPlane)}
                </span>
                {ch.replacesWithDeviceStream ? (
                  <span className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-lime-300/80">Slot stream</span>
                ) : null}
              </div>
            </div>
            {ch.curveResolution ? (
              <p className="mb-2 text-[0.58rem] leading-snug text-gray-400">
                {fusionSummary(ch.curveResolution)}
                <span className="text-gray-500"> · </span>
                <span className="text-gray-400">{governanceIt(ch.curveResolution.governance)}</span>
              </p>
            ) : null}
            <p className="mb-1 text-[0.6rem] text-gray-500">
              {streamRows?.length
                ? ch.dataPlane === "measured_stream"
                  ? "Asse: tempo reale del campione (stream misurato; tabella 055 / merge device)."
                  : ch.dataPlane === "ai_from_inputs"
                    ? "Asse: tempo reale (passo 5 min; curva da OpenAI sugli input giornata — non è CGM né sim diurno v1)."
                    : "Asse: tempo reale del modello (passo 5 min, deterministico da timeline — non è CGM)."
                : "Asse orizzontale: ore del giorno (0–23, locale)."}
            </p>
            <div className="w-full min-w-[160px]" style={{ height: CHART_H }}>
              <ResponsiveContainer width="100%" height={CHART_H} debounce={50}>
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
                      stroke={STROKE_BY_CHANNEL_ID[ch.id] ?? DEFAULT_STROKE}
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
                      stroke={STROKE_BY_CHANNEL_ID[ch.id] ?? DEFAULT_STROKE}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
