"use client";

import { useTranslations } from "next-intl";

import type { AdaptationSectorBoxVm } from "@/lib/adaptation/adaptation-sector-box";

export type { AdaptationSectorBoxVm } from "@/lib/adaptation/adaptation-sector-box";

export function AdaptationSectorStrip({
  boxes,
  title,
  emptyHint,
  className,
}: {
  boxes: AdaptationSectorBoxVm[];
  title?: string;
  emptyHint?: string;
  className?: string;
}) {
  const t = useTranslations("AdaptationSectorStrip");
  if (!boxes.length) {
    return <p className={`text-xs text-gray-500 ${className ?? ""}`.trim()}>{emptyHint ?? t("noSectors")}</p>;
  }

  return (
    <div className={`grid gap-2 ${className ?? ""}`.trim()}>
      {title ? <div className="text-sm font-bold tracking-wide text-gray-200">{title}</div> : null}
      <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
        {boxes.map((b) => {
          return (
            <div
              key={b.id}
              className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 transition-colors hover:border-amber-500/40"
              style={{ minWidth: 104, maxWidth: 148 }}
            >
              <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{b.shortLabel}</div>
              <div className="mt-1 font-mono text-sm font-bold tabular-nums text-white">{b.valueLine}</div>
              {b.pills?.length ? (
                <div className="mt-1.5 flex flex-col gap-1" aria-label={t("effectContextSummary")}>
                  {b.pills.map((p) => (
                    <span
                      key={p.id}
                      title={
                        p.direction === "forward"
                          ? t("forwardTooltip")
                          : t("backwardTooltip")
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.58rem] font-semibold leading-tight ${
                        p.direction === "forward"
                          ? "border-white/15 bg-white/5 text-gray-300"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      <span className="opacity-70">{p.direction === "forward" ? "→ " : "← "}</span>
                      {p.text}
                    </span>
                  ))}
                </div>
              ) : null}
              <details className="mt-1">
                <summary className="cursor-pointer text-[0.6rem] text-gray-500">{t("detail")}</summary>
                <p className="mt-1 text-[0.65rem] leading-snug text-gray-400">{b.detailLine}</p>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}
