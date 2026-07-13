"use client";

import { useMemo, useState } from "react";
import type { ExecutedWorkout } from "@empathy/domain-training";
import { useTranslations } from "next-intl";
import {
  buildPeriodAggregates,
  HR_ZONE_LABELS,
  PERIOD_PEAK_WINDOWS,
  type PeriodGranularity,
} from "@/lib/training/analytics/period-aggregates";

const ZONE_COLORS = ["#38bdf8", "#34d399", "#fbbf24", "#fb923c", "#f87171"];

export function AnalyzerPeriodAggregates({
  workouts,
  lthrBpm,
  hrMaxBpm,
}: {
  workouts: ExecutedWorkout[];
  lthrBpm?: number | null;
  hrMaxBpm?: number | null;
}) {
  const t = useTranslations("AnalyzerPeriodAggregates");
  const [granularity, setGranularity] = useState<PeriodGranularity>("week");

  const rows = useMemo(
    () => buildPeriodAggregates(workouts, { granularity, lthrBpm, hrMaxBpm }),
    [workouts, granularity, lthrBpm, hrMaxBpm],
  );

  if (rows.length === 0) return null;
  const anyPower = rows.some((r) => r.hasPower);
  const anyHr = rows.some((r) => r.hasHr);
  const zoneSource = lthrBpm && lthrBpm > 0 ? t("zonesFromLthr") : hrMaxBpm && hrMaxBpm > 0 ? t("zonesFromHrMax") : null;

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">{t("title")}</h3>
          <p className="text-[0.7rem] text-gray-500">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-1">
          {(["week", "month"] as PeriodGranularity[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularity(g)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                granularity === g
                  ? "bg-orange-500/20 text-orange-100"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {g === "week" ? t("week") : t("month")}
            </button>
          ))}
        </div>
      </div>

      {/* Tabella volume + peak power — scroll orizzontale su schermi stretti. */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[40rem] border-collapse text-xs">
          <thead className="bg-black/50">
            <tr>
              <th className="px-3 py-2 text-left font-mono text-[0.58rem] uppercase tracking-[0.12em] text-gray-500">{t("period")}</th>
              <th className="px-3 py-2 text-right font-mono text-[0.58rem] uppercase tracking-[0.12em] text-gray-500">{t("sessions")}</th>
              <th className="px-3 py-2 text-right font-mono text-[0.58rem] uppercase tracking-[0.12em] text-gray-500">{t("duration")}</th>
              <th className="px-3 py-2 text-right font-mono text-[0.58rem] uppercase tracking-[0.12em] text-gray-500">km</th>
              <th className="px-3 py-2 text-right font-mono text-[0.58rem] uppercase tracking-[0.12em] text-gray-500">TSS</th>
              <th className="px-3 py-2 text-right font-mono text-[0.58rem] uppercase tracking-[0.12em] text-gray-500">{t("elev")}</th>
              {anyPower
                ? PERIOD_PEAK_WINDOWS.map((w) => (
                    <th key={w.key} className="px-3 py-2 text-right font-mono text-[0.58rem] uppercase tracking-[0.12em] text-sky-400/80">
                      {w.label}
                    </th>
                  ))
                : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-3 py-2 font-semibold text-white">{r.label}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-300">{r.workoutCount}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-300">
                  {Math.floor(r.durationMin / 60)}h{String(r.durationMin % 60).padStart(2, "0")}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-300">{r.distanceKm || "—"}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-300">{r.tss || "—"}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-300">{r.elevGainAvgM != null ? `${r.elevGainAvgM}m` : "—"}</td>
                {anyPower
                  ? PERIOD_PEAK_WINDOWS.map((w) => (
                      <td key={w.key} className="px-3 py-2 text-right font-mono tabular-nums text-white">
                        {r.peak[w.key] != null ? r.peak[w.key] : "—"}
                      </td>
                    ))
                  : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tempo in zone FC per periodo — barra impilata. */}
      {anyHr ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.2em] text-rose-300/80">
              {t("hrZonesTitle")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {zoneSource ? <span className="text-[0.6rem] text-gray-600">{zoneSource}</span> : null}
              {HR_ZONE_LABELS.map((z, i) => (
                <span key={z} className="flex items-center gap-1 text-[0.6rem] text-gray-400">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ background: ZONE_COLORS[i] }} />
                  {z}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            {rows.map((r) => {
              const total = r.hrZoneMin.reduce((s, m) => s + m, 0);
              if (total <= 0) return null;
              return (
                <div key={r.key} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[0.65rem] font-semibold text-gray-300">{r.label}</span>
                  <div className="flex h-4 flex-1 overflow-hidden rounded-full bg-white/5">
                    {r.hrZoneMin.map((m, i) =>
                      m > 0 ? (
                        <div
                          key={i}
                          style={{ width: `${(m / total) * 100}%`, background: ZONE_COLORS[i] }}
                          title={`${HR_ZONE_LABELS[i]}: ${m} min`}
                        />
                      ) : null,
                    )}
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-[0.6rem] text-gray-500">{Math.round(total)}m</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
