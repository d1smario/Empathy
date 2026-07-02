"use client";

import { useTranslations } from "next-intl";

import { formatDurationMmss, type StructuredIntervalRow } from "@/lib/training/planned-structured-interval-csv";

function formatTargetW(row: StructuredIntervalRow): string {
  if (row.kind === "ramp") {
    return `${row.powerLowW}–${row.powerHighW}`;
  }
  return String(row.powerAvgW);
}

export function StructuredWorkoutStepTable({
  rows,
  ftpW,
  compact = false,
  title,
}: {
  rows: StructuredIntervalRow[];
  ftpW?: number;
  compact?: boolean;
  title?: string;
}) {
  const t = useTranslations("StructuredWorkoutStepTable");

  if (!rows.length) return null;

  const resolvedTitle = title ?? t("defaultTitle");
  const cell = compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm";
  const head = compact ? "px-2 py-1.5 text-[0.6rem]" : "px-3 py-2 text-[0.65rem]";

  return (
    <div className="rounded-xl border border-white/10 bg-black/30">
      <p className="border-b border-white/10 px-3 py-2 text-[0.65rem] font-bold uppercase tracking-wider text-gray-400">
        {resolvedTitle}
        {ftpW && ftpW > 0 ? (
          <span className="ml-2 font-mono font-normal normal-case text-gray-500">FTP {ftpW} W</span>
        ) : null}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-left text-gray-200">
          <thead>
            <tr className="border-b border-white/10 text-gray-500">
              <th className={`${head} font-bold uppercase tracking-wider`}>#</th>
              <th className={`${head} font-bold uppercase tracking-wider`}>Step</th>
              <th className={`${head} font-bold uppercase tracking-wider`}>{t("durationHeader")}</th>
              <th className={`${head} font-bold uppercase tracking-wider`}>Target W</th>
              <th className={`${head} font-bold uppercase tracking-wider`}>{t("zoneHeader")}</th>
              <th className={`${head} font-bold uppercase tracking-wider`}>{t("notesHeader")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.index} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                <td className={`${cell} font-mono text-gray-500`}>{r.index}</td>
                <td className={`${cell} max-w-[12rem] truncate font-medium text-white`} title={r.label}>
                  {r.label ?? `Step ${r.index}`}
                </td>
                <td className={`${cell} font-mono tabular-nums text-gray-300`}>{formatDurationMmss(r.durationSec)}</td>
                <td className={`${cell} font-mono tabular-nums text-white`}>{formatTargetW(r)}</td>
                <td className={`${cell} font-mono text-gray-300`}>{r.zoneLabel ?? "—"}</td>
                <td className={`${cell} max-w-[14rem] truncate text-xs text-gray-400`} title={r.coachNote}>
                  {r.coachNote ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
