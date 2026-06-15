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
import { CHART_AXIS, CHART_FONT, CHART_GRID, CHART_STROKE, chartTooltipStyle } from "@/lib/ui/chart-theme";

type TrainingSingleTraceChartProps = {
  label: string;
  color: string;
  values: number[];
  labels: string[];
  unit?: string;
};

export function TrainingSingleTraceChart({
  label,
  color,
  values,
  labels,
  unit,
}: TrainingSingleTraceChartProps) {
  const fillId = useId().replace(/:/g, "");
  if (!values.length) return null;
  const data = values.map((v, i) => ({
    t: labels[i] ?? `s${i + 1}`,
    v: Number.isFinite(v) ? v : 0,
  }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} />
          <XAxis dataKey="t" tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} width={44} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={chartTooltipStyle("training")}
            labelStyle={{ color: "#e5e7eb" }}
            formatter={(val: number) => [`${Number.isFinite(val) ? val.toFixed(2) : "0.00"}${unit ? ` ${unit}` : ""}`, label]}
          />
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.55} />
              <stop offset="92%" stopColor={color} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke="transparent"
            fill={`url(#${fillId})`}
            fillOpacity={1}
          />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={CHART_STROKE.base} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
