"use client";

import { useId, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_AXIS,
  CHART_FONT,
  CHART_GRID,
  CHART_SIGNAL,
  CHART_STROKE,
  chartTooltipStyle,
} from "@/lib/ui/chart-theme";
import { cn } from "@/lib/cn";

/**
 * «Analisi multifattoriale»: tutte le tracce della seduta sovrapposte su un unico
 * grafico multi-asse (potenza/FC/velocità/cadenza) + strip quota sotto, con legenda
 * a toggle. Sostituisce il selettore un-canale-alla-volta: si vede tutto insieme,
 * si spegne ciò che non serve. Adattivo: disegna solo i canali con dati reali.
 */
export type MultiAxisChannel = "power" | "hr" | "speed" | "cadence" | "altitude" | "temperature";

export type MultiAxisSeries = {
  channel: MultiAxisChannel;
  unit: string;
  values: number[];
};

type ChannelMeta = {
  label: string;
  color: string;
  kind: "area" | "line";
  digits: number;
};

const META: Record<MultiAxisChannel, ChannelMeta> = {
  power: { label: "Potenza", color: CHART_SIGNAL.power, kind: "area", digits: 0 },
  hr: { label: "FC", color: CHART_SIGNAL.hr, kind: "line", digits: 0 },
  speed: { label: "Velocità", color: CHART_SIGNAL.speed, kind: "line", digits: 1 },
  cadence: { label: "Cadenza", color: CHART_SIGNAL.cadence, kind: "line", digits: 0 },
  temperature: { label: "Temperatura", color: "#fbbf24", kind: "line", digits: 1 },
  altitude: { label: "Quota", color: CHART_SIGNAL.altitude, kind: "area", digits: 0 },
};

/** Canali del grafico principale (la quota va nella strip sotto). Ordine di disegno. */
const OVERLAY_ORDER: MultiAxisChannel[] = ["power", "speed", "cadence", "temperature", "hr"];

const PLOT_POINTS = 480;

/** Ricampiona (stretch o downsample) un array numerico a `n` punti per allineare canali di lunghezza diversa. */
function resample(values: number[], n: number): (number | null)[] {
  if (values.length === 0) return Array.from({ length: n }, () => null);
  if (values.length === 1) return Array.from({ length: n }, () => values[0]!);
  const last = values.length - 1;
  return Array.from({ length: n }, (_, i) => {
    const idx = Math.round((i * last) / (n - 1));
    const v = values[Math.min(last, idx)];
    return Number.isFinite(v) ? v! : null;
  });
}

function resampleLabels(labels: string[], n: number): string[] {
  if (labels.length === 0) return Array.from({ length: n }, () => "");
  const last = labels.length - 1;
  return Array.from({ length: n }, (_, i) => labels[Math.min(last, Math.round((i * last) / (n - 1)))] ?? "");
}

export function SessionMultiAxisChart({
  series,
  labels,
}: {
  series: MultiAxisSeries[];
  labels: string[];
}) {
  const gid = useId().replace(/:/g, "");

  const present = useMemo(() => {
    const set = new Set(series.filter((s) => s.values.length >= 2).map((s) => s.channel));
    return set;
  }, [series]);

  const overlayChannels = useMemo(
    () => OVERLAY_ORDER.filter((c) => present.has(c)),
    [present],
  );
  const hasAltitude = present.has("altitude");

  const [hidden, setHidden] = useState<Set<MultiAxisChannel>>(() => new Set());

  const rows = useMemo(() => {
    const byChannel = new Map<MultiAxisChannel, (number | null)[]>();
    for (const s of series) {
      if (s.values.length >= 2) byChannel.set(s.channel, resample(s.values, PLOT_POINTS));
    }
    const t = resampleLabels(labels, PLOT_POINTS);
    return Array.from({ length: PLOT_POINTS }, (_, i) => {
      const row: Record<string, number | string | null> = { t: t[i] ?? "" };
      for (const [ch, vals] of byChannel) row[ch] = vals[i] ?? null;
      return row;
    });
  }, [series, labels]);

  // Asse sinistro etichettato = primo tra potenza/velocità/cadenza; destro = FC.
  const leftChannel = overlayChannels.find((c) => c !== "hr") ?? null;
  const rightChannel = present.has("hr") ? ("hr" as const) : null;

  if (overlayChannels.length === 0 && !hasAltitude) return null;

  const toggle = (c: MultiAxisChannel) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const powFill = `smaPow-${gid}`;
  const altFill = `smaAlt-${gid}`;

  const legendChannels: MultiAxisChannel[] = [...overlayChannels, ...(hasAltitude ? (["altitude"] as const) : [])];

  return (
    <div className="space-y-3">
      {/* Legenda a toggle: clic per accendere/spegnere una traccia. */}
      <div className="flex flex-wrap gap-2">
        {legendChannels.map((c) => {
          const meta = META[c];
          const off = hidden.has(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wide transition",
                off
                  ? "border-white/10 bg-black/40 text-gray-600"
                  : "border-white/20 bg-white/[0.06] text-gray-200 hover:border-white/35",
              )}
              title={off ? `Mostra ${meta.label}` : `Nascondi ${meta.label}`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: off ? "#4b5563" : meta.color }}
                aria-hidden
              />
              {meta.label}
              <span className="font-mono text-[0.6rem] font-normal text-gray-500">
                {series.find((s) => s.channel === c)?.unit ?? ""}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grafico principale multi-asse: potenza (area) + FC/velocità/cadenza (linee). */}
      <div className="h-[min(320px,46vw)] min-h-[220px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id={powFill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_SIGNAL.power} stopOpacity={0.75} />
                <stop offset="95%" stopColor={CHART_SIGNAL.power} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} vertical={false} />
            <XAxis
              dataKey="t"
              tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            {overlayChannels.map((c) => {
              const isLeft = c === leftChannel;
              const isRight = c === rightChannel;
              const visibleAxis = isLeft || isRight;
              return (
                <YAxis
                  key={`axis-${c}`}
                  yAxisId={c}
                  orientation={isRight ? "right" : "left"}
                  hide={!visibleAxis}
                  width={visibleAxis ? 44 : 0}
                  tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }}
                  domain={["auto", "auto"]}
                  label={
                    visibleAxis
                      ? {
                          value: series.find((s) => s.channel === c)?.unit ?? "",
                          angle: isRight ? 90 : -90,
                          position: isRight ? "insideRight" : "insideLeft",
                          fill: META[c].color,
                          fontSize: CHART_FONT.tick,
                        }
                      : undefined
                  }
                />
              );
            })}
            <Tooltip
              contentStyle={chartTooltipStyle("training")}
              labelStyle={{ color: "#e5e7eb" }}
              formatter={(value: number, name: string) => {
                const meta = META[name as MultiAxisChannel];
                if (!meta) return [value, name];
                const v = Number.isFinite(value) ? value.toFixed(meta.digits) : "—";
                const unit = series.find((s) => s.channel === (name as MultiAxisChannel))?.unit ?? "";
                return [`${v} ${unit}`.trim(), meta.label];
              }}
            />
            {overlayChannels.map((c) => {
              if (hidden.has(c)) return null;
              const meta = META[c];
              if (meta.kind === "area") {
                return (
                  <Area
                    key={`s-${c}`}
                    yAxisId={c}
                    type="monotone"
                    dataKey={c}
                    stroke={meta.color}
                    strokeWidth={CHART_STROKE.base}
                    fill={`url(#${powFill})`}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  />
                );
              }
              return (
                <Line
                  key={`s-${c}`}
                  yAxisId={c}
                  type="monotone"
                  dataKey={c}
                  stroke={meta.color}
                  strokeWidth={CHART_STROKE.base}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Strip quota sotto (come il profilo altimetrico del mockup). */}
      {hasAltitude && !hidden.has("altitude") ? (
        <div className="h-[min(120px,20vw)] min-h-[90px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 4, bottom: 2 }}>
              <defs>
                <linearGradient id={altFill} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_SIGNAL.altitude} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={CHART_SIGNAL.altitude} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} vertical={false} />
              <XAxis dataKey="t" hide />
              <YAxis
                tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }}
                width={44}
                domain={["auto", "auto"]}
                label={{ value: "m", angle: -90, position: "insideLeft", fill: CHART_SIGNAL.altitude, fontSize: CHART_FONT.tick }}
              />
              <Tooltip
                contentStyle={chartTooltipStyle("training")}
                formatter={(value: number) => [`${Number.isFinite(value) ? value.toFixed(0) : "—"} m`, "Quota"]}
              />
              <Area
                type="monotone"
                dataKey="altitude"
                stroke={CHART_SIGNAL.altitude}
                strokeWidth={CHART_STROKE.thin}
                fill={`url(#${altFill})`}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
