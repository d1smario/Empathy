"use client";

import { Activity } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_AXIS, CHART_FONT, CHART_GRID, CHART_SIGNAL, CHART_STROKE, chartTooltipStyle } from "@/lib/ui/chart-theme";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import type { CrossChannelSessionVm } from "@/lib/training/analytics/cross-channel-session";

function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function buildChartData(session: CrossChannelSessionVm): Array<{ tSec: number; tLabel: string; power: number | null; hr: number | null; glucose: number | null }> {
  const power = session.powerSeries;
  const hr = session.hrSeries;
  const samples = Math.max(power.length, hr.length, 2);
  const dt = session.durationSeconds / Math.max(1, samples - 1);
  const data: Array<{ tSec: number; tLabel: string; power: number | null; hr: number | null; glucose: number | null }> = [];
  for (let i = 0; i < samples; i += 1) {
    const tSec = Math.round(i * dt);
    data.push({
      tSec,
      tLabel: fmtTime(tSec),
      power: power[i] != null && Number.isFinite(power[i]) ? power[i] : null,
      hr: hr[i] != null && Number.isFinite(hr[i]) ? hr[i] : null,
      glucose: null,
    });
  }
  // Glucosio come scatter su tSec → trovo l'indice più vicino
  for (const point of session.glucosePoints) {
    if (!data.length) break;
    const idx = Math.min(
      data.length - 1,
      Math.max(0, Math.round((point.tSec / Math.max(1, session.durationSeconds)) * (data.length - 1))),
    );
    data[idx] = { ...data[idx], glucose: point.mmol };
  }
  return data;
}

export function TrainingAnalyzerCrossChannelSection({
  sessions,
}: {
  sessions: CrossChannelSessionVm[];
}) {
  const t = useTranslations("TrainingAnalyzerCrossChannelSection");
  const [activeId, setActiveId] = useState<string | null>(sessions[0]?.executedId ?? null);
  const active = useMemo(
    () => (activeId ? sessions.find((s) => s.executedId === activeId) ?? sessions[0] ?? null : sessions[0] ?? null),
    [activeId, sessions],
  );
  const chartData = useMemo(() => (active ? buildChartData(active) : []), [active]);

  if (!sessions.length) {
    return null;
  }

  return (
    <div className="mb-6">
      <Pro2SectionCard
        accent="orange"
        title={t("cardTitle")}
        subtitle={t("cardSubtitle")}
        icon={Activity}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {sessions.map((s) => {
            const isActive = active?.executedId === s.executedId;
            return (
              <button
                key={s.executedId}
                type="button"
                onClick={() => setActiveId(s.executedId)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                  isActive
                    ? "border-orange-400/55 bg-orange-500/20 text-orange-100"
                    : "border-white/10 bg-black/40 text-gray-400 hover:border-white/25 hover:text-gray-200"
                }`}
              >
                {s.date ?? s.executedId.slice(0, 6)} · {fmtTime(s.durationSeconds)}
              </button>
            );
          })}
        </div>

        {active ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} />
                  <XAxis
                    dataKey="tLabel"
                    tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }}
                    interval="preserveStartEnd"
                    minTickGap={32}
                  />
                  <YAxis yAxisId="left" tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} width={40} domain={["auto", "auto"]} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }}
                    width={40}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip contentStyle={chartTooltipStyle("training")} labelStyle={{ color: "#e5e7eb" }} />
                  {active.hasPower ? (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="power"
                      stroke={CHART_SIGNAL.power}
                      strokeWidth={CHART_STROKE.base}
                      dot={false}
                      isAnimationActive={false}
                      name="Power (W)"
                    />
                  ) : null}
                  {active.hasHr ? (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="hr"
                      stroke={CHART_SIGNAL.hr}
                      strokeWidth={CHART_STROKE.thin}
                      dot={false}
                      isAnimationActive={false}
                      name={t("seriesHr")}
                    />
                  ) : null}
                  {active.hasGlucose ? (
                    <Scatter
                      yAxisId="right"
                      dataKey="glucose"
                      fill={CHART_SIGNAL.glucose}
                      shape="circle"
                      name={t("seriesGlucose")}
                    />
                  ) : null}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
              {active.hasPower ? (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: CHART_SIGNAL.power }} /> Power
                </span>
              ) : null}
              {active.hasHr ? (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: CHART_SIGNAL.hr }} /> {t("legendHr")}
                </span>
              ) : null}
              {active.hasGlucose ? (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: CHART_SIGNAL.glucose }} /> {t("legendGlucose")}
                </span>
              ) : null}
              {!active.hasGlucose ? (
                <span className="text-amber-300/80">{t("noCgmSample")}</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </Pro2SectionCard>
    </div>
  );
}
