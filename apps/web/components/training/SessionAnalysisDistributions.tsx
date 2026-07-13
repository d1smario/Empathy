"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  buildMinutesHistogram,
  buildSessionDataGridRows,
  type ChannelValues,
} from "@/lib/training/analytics/series-distribution";

const CARD = "rounded-2xl border border-white/10 bg-black/40 p-3";
const LABEL = "font-mono text-[0.6rem] font-bold uppercase tracking-[0.2em]";

/** Istogramma «minuti nel bucket» (frequenza cardiaca / cadenza), stile TrainingPeaks. */
export function SessionDistributionHistogram({
  title,
  values,
  durationMinutes,
  color,
  bucketWidth,
  unit,
  minutesLabel,
  excludeZeroLabel,
  supportsExcludeZero,
}: {
  title: string;
  values: number[];
  durationMinutes: number;
  color: string;
  bucketWidth: number;
  unit: string;
  minutesLabel: string;
  excludeZeroLabel: string;
  supportsExcludeZero?: boolean;
}) {
  const [excludeZero, setExcludeZero] = useState<boolean>(Boolean(supportsExcludeZero));
  const bins = useMemo(
    () => buildMinutesHistogram(values, durationMinutes, { bucketWidth, excludeZero }),
    [values, durationMinutes, bucketWidth, excludeZero],
  );
  if (bins.length === 0) return null;
  const peak = Math.max(...bins.map((b) => b.minutes));

  return (
    <div className={CARD}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className={`${LABEL}`} style={{ color }}>
          {title}
        </p>
        {supportsExcludeZero ? (
          <label className="flex cursor-pointer items-center gap-1.5 text-[0.65rem] text-gray-400">
            <input
              type="checkbox"
              className="h-3 w-3 accent-orange-400"
              checked={excludeZero}
              onChange={(e) => setExcludeZero(e.target.checked)}
            />
            {excludeZeroLabel}
          </label>
        ) : null}
      </div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bins} margin={{ top: 4, right: 6, bottom: 2, left: -20 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "#9ca3af" }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              contentStyle={{
                background: "rgba(10,12,18,0.96)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                fontSize: 11,
              }}
              labelFormatter={(l) => `${l}–${Number(l) + bucketWidth} ${unit}`}
              formatter={(v: number) => [`${v.toFixed(1)} min`, minutesLabel]}
            />
            <Bar dataKey="minutes" radius={[3, 3, 0, 0]}>
              {bins.map((b, i) => (
                <Cell
                  key={i}
                  fill={color}
                  fillOpacity={peak > 0 ? 0.35 + 0.6 * (b.minutes / peak) : 0.6}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Griglia dati (Time × canali) equi-spaziata, scorrevole in orizzontale. */
export function SessionDataGridTable({
  title,
  timeLabel,
  series,
  durationMinutes,
}: {
  title: string;
  timeLabel: string;
  series: ChannelValues[];
  durationMinutes: number;
}) {
  const { columns, rows } = useMemo(
    () => buildSessionDataGridRows(series, durationMinutes, 60),
    [series, durationMinutes],
  );
  if (columns.length === 0 || rows.length === 0) return null;

  return (
    <div className={CARD}>
      <p className={`${LABEL} mb-2 text-orange-300/80`}>{title}</p>
      <div className="max-h-72 overflow-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[28rem] border-collapse text-xs">
          <thead className="sticky top-0 bg-black/80 backdrop-blur">
            <tr>
              <th className="px-2.5 py-1.5 text-left font-mono text-[0.58rem] uppercase tracking-[0.12em] text-gray-500">
                {timeLabel}
              </th>
              {columns.map((c) => (
                <th
                  key={c.channel}
                  className="px-2.5 py-1.5 text-right font-mono text-[0.58rem] uppercase tracking-[0.12em] text-gray-500"
                >
                  {c.label}
                  <span className="ml-1 normal-case text-gray-600">{c.unit}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r, ri) => (
              <tr key={ri} className={ri % 2 ? "bg-white/[0.015]" : undefined}>
                <td className="px-2.5 py-1 font-mono tabular-nums text-gray-400">{r.time}</td>
                {r.cells.map((v, ci) => (
                  <td key={ci} className="px-2.5 py-1 text-right font-mono tabular-nums text-white">
                    {v == null ? "—" : v.toFixed(columns[ci]!.decimals)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
