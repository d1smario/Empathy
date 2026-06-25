"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BioenergeticMonitoringChannel24 } from "@/api/bioenergetics/contracts";
import { CHART_AXIS, CHART_GRID, chartTooltipStyle } from "@/lib/ui/chart-theme";
import { DEFAULT_STROKE, STROKE_BY_CHANNEL_ID, type PreparedChannel } from "./BioenergeticChannelChart";

/**
 * Grafico recharts del singolo canale, ISOLATO in un file dedicato così può essere
 * caricato con `next/dynamic` (vedi BioenergeticChannelChartLazy): recharts finisce
 * in un chunk separato e NON pesa sul bundle iniziale di chi non disegna un grafico
 * recharts (es. dashboard mobile in modalità sparkline finché non apri un modale).
 *
 * Non include il div d'altezza: lo fornisce il chiamante (riserva lo spazio → niente
 * layout shift mentre il chunk si carica).
 */
function formatStreamAxisTick(ms: number): string {
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
}

export function BioenergeticChannelChartRecharts({
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
  );
}
