"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BioenergeticMonitoringChannel24 } from "@/api/bioenergetics/contracts";
import {
  channelAxisNote,
  fusionSummary,
  governanceIt,
  planeBadgeClass,
  planeLabel,
  prepareBioenergeticChannel,
} from "./BioenergeticChannelChart";
import { BioenergeticChannelChartLazy } from "./BioenergeticChannelChartLazy";

/**
 * Modale d'espansione di un singolo grafico "Striscia 24 h": grafico in grande,
 * stesso renderer della card. Portal su <body> per restare ancorato al viewport
 * a prescindere da eventuali antenati con backdrop-filter/transform; lock dello
 * scroll di sfondo via <style> dentro il render.
 */
export function BioenergeticChannelExpandModal({
  channel,
  showTech = false,
  onClose,
}: {
  channel: BioenergeticMonitoringChannel24;
  showTech?: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("BioenergeticChannelExpandModal");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const prepared = prepareBioenergeticChannel(channel);
  const label = channel.labelIt;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t("chartAriaLabel", { label })}
      onClick={onClose}
    >
      <style>{`html,body{overflow:hidden!important}`}</style>
      <div
        className="relative my-auto w-full max-w-4xl rounded-2xl border border-white/12 bg-[#0b0a10] p-4 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label={t("closeChart")}
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-black/40 text-gray-300 transition hover:bg-white/10"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="mb-3 flex flex-wrap items-start justify-between gap-3 pr-10">
          <div className="min-w-0">
            <p className="text-lg font-bold text-white">{channel.labelIt}</p>
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-gray-500">{channel.unit}</p>
          </div>
          {showTech ? (
            <span
              className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide ${planeBadgeClass(channel.dataPlane)}`}
            >
              {planeLabel(channel.dataPlane)}
            </span>
          ) : null}
        </div>

        {showTech && channel.curveResolution ? (
          <p className="mb-3 text-[0.62rem] leading-snug text-gray-400">
            {fusionSummary(channel.curveResolution)}
            <span className="text-gray-500"> · </span>
            <span className="text-gray-400">{governanceIt(channel.curveResolution.governance)}</span>
          </p>
        ) : null}

        <p className="mb-2 text-[0.65rem] text-gray-500">{channelAxisNote(channel, prepared.isStream, showTech)}</p>

        <div className="w-full min-w-0" style={{ height: 420 }}>
          <BioenergeticChannelChartLazy channel={channel} prepared={prepared} height={420} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
