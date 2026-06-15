"use client";

import { useId } from "react";
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
import { CHART_AXIS, CHART_FONT, CHART_GRID, CHART_SIGNAL, CHART_STROKE, chartTooltipStyle } from "@/lib/ui/chart-theme";

export type TelemetryChartRow = {
  t: string;
  power: number;
  hr: number;
  altitude: number;
};

type Props = {
  data: TelemetryChartRow[];
};

function downsampleRows(rows: TelemetryChartRow[], maxPoints: number): TelemetryChartRow[] {
  if (rows.length <= maxPoints) return rows;
  const step = rows.length / maxPoints;
  const out: TelemetryChartRow[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const idx = Math.min(rows.length - 1, Math.round(i * step));
    out.push(rows[idx]);
  }
  return out;
}

export function TrainingCalendarTelemetryChart({ data }: Props) {
  const gid = useId().replace(/:/g, "");
  const plot = downsampleRows(data, 520);
  if (plot.length < 2) return null;
  const powFill = `tcPow-${gid}`;
  const altFill = `tcAlt-${gid}`;

  return (
    <div className="space-y-3">
      <div className="h-[min(300px,42vw)] min-h-[220px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={plot} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id={powFill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_SIGNAL.power} stopOpacity={0.85} />
                <stop offset="95%" stopColor={CHART_SIGNAL.power} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} vertical={false} />
            <XAxis dataKey="t" tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} interval="preserveStartEnd" minTickGap={28} />
            <YAxis
              yAxisId="pow"
              orientation="left"
              tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }}
              width={44}
              domain={["auto", "auto"]}
              label={{ value: "W", angle: -90, position: "insideLeft", fill: CHART_SIGNAL.power, fontSize: CHART_FONT.tick }}
            />
            <YAxis
              yAxisId="hr"
              orientation="right"
              tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }}
              width={40}
              domain={["auto", "auto"]}
              label={{ value: "bpm", angle: 90, position: "insideRight", fill: CHART_SIGNAL.hr, fontSize: CHART_FONT.tick }}
            />
            <Tooltip
              contentStyle={chartTooltipStyle("training")}
              labelStyle={{ color: "#e5e7eb" }}
              formatter={(value: number, name: string) => {
                const v = Number.isFinite(value) ? value.toFixed(0) : "—";
                if (name === "power") return [`${v} W`, "Potenza"];
                if (name === "hr") return [`${v} bpm`, "FC"];
                return [v, name];
              }}
            />
            <Area
              yAxisId="pow"
              type="monotone"
              dataKey="power"
              stroke={CHART_SIGNAL.power}
              strokeWidth={CHART_STROKE.base}
              fill={`url(#${powFill})`}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="hr"
              type="monotone"
              dataKey="hr"
              stroke={CHART_SIGNAL.hr}
              strokeWidth={CHART_STROKE.base}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="h-[min(140px,22vw)] min-h-[100px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={plot} margin={{ top: 4, right: 8, left: 4, bottom: 2 }}>
            <defs>
              <linearGradient id={altFill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_SIGNAL.altitude} stopOpacity={0.65} />
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
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
        Potenza (area) · FC (linea) · Quota (area sotto)
      </p>
    </div>
  );
}
