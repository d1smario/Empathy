"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";
import type {
  BioenergeticContinuousMonitoringDay,
  BioenergeticMetricTileCategory,
} from "@/api/bioenergetics/contracts";
import {
  BioenergeticSparkline,
  channelAxisNote,
  fusionSummary,
  governanceIt,
  planeBadgeClass,
  planeLabel,
  prepareBioenergeticChannel,
} from "./BioenergeticChannelChart";
import { BioenergeticChannelChartLazy } from "./BioenergeticChannelChartLazy";
import { BioenergeticChannelExpandModal } from "./BioenergeticChannelExpandModal";

const CATEGORY_ORDER: BioenergeticMetricTileCategory[] = [
  "metabolic",
  "inflammatory",
  "hormonal",
  "neural",
  "gastro_intestinal",
  "gonadal",
];

type Props = {
  monitoring: BioenergeticContinuousMonitoringDay;
  /** Vista atleta (false) nasconde governance/policy, pesi fusione e riferimenti motore/AI. */
  showTech?: boolean;
  /** Modalità leggera (dashboard mobile): sparkline SVG invece di recharts (zero ResizeObserver). */
  lite?: boolean;
};

const CHART_H = 92;
const CHART_H_LITE = 52;

export function BioenergeticsContinuousMonitoringGrid({ monitoring, showTech = false, lite = false }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...monitoring.channels].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  );
  const expandedChannel = expandedId ? sorted.find((c) => c.id === expandedId) ?? null : null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sorted.map((ch) => {
          const prepared = prepareBioenergeticChannel(ch);
          if (!prepared.hasData) return null;

          return (
            <div
              key={ch.id}
              role="button"
              tabIndex={0}
              aria-label={`Espandi grafico ${ch.labelIt}`}
              onClick={() => setExpandedId(ch.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedId(ch.id);
                }
              }}
              className="group cursor-pointer rounded-xl border border-white/10 bg-black/30 p-3 shadow-inner shadow-black/40 transition hover:border-lime-400/40 hover:bg-black/40 focus:outline-none focus-visible:border-lime-400/60"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-snug text-white">{ch.labelIt}</p>
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{ch.unit}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Maximize2
                    className="h-3.5 w-3.5 text-gray-500 transition group-hover:text-lime-300"
                    aria-hidden
                  />
                  {showTech ? (
                    <>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide ${planeBadgeClass(ch.dataPlane)}`}
                      >
                        {planeLabel(ch.dataPlane)}
                      </span>
                      {ch.replacesWithDeviceStream ? (
                        <span className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-lime-300/80">Slot stream</span>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
              {!lite && showTech && ch.curveResolution ? (
                <p className="mb-2 text-[0.58rem] leading-snug text-gray-400">
                  {fusionSummary(ch.curveResolution)}
                  <span className="text-gray-500"> · </span>
                  <span className="text-gray-400">{governanceIt(ch.curveResolution.governance)}</span>
                </p>
              ) : null}
              {!lite ? (
                <p className="mb-1 text-[0.6rem] text-gray-500">{channelAxisNote(ch, prepared.isStream, showTech)}</p>
              ) : null}
              {lite ? (
                <BioenergeticSparkline channel={ch} prepared={prepared} height={CHART_H_LITE} />
              ) : (
                <div className="w-full min-w-0" style={{ height: CHART_H }}>
                  <BioenergeticChannelChartLazy channel={ch} prepared={prepared} height={CHART_H} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {expandedChannel ? (
        <BioenergeticChannelExpandModal
          channel={expandedChannel}
          showTech={showTech}
          onClose={() => setExpandedId(null)}
        />
      ) : null}
    </>
  );
}
