"use client";

import { useTranslations } from "next-intl";
import { FileUp, FlaskConical, Link2, Stethoscope } from "lucide-react";
import { Pro2Link } from "@/components/ui/empathy";

export type SegmentAttachmentMeta = { name: string; size: number; type: string } | null;

export type HealthBioGlucoseMeta = {
  mmol_l: number;
  source: "blood_panel" | "physiological_baseline" | "session_roll";
};

function glucoseSourceLabel(
  source: HealthBioGlucoseMeta["source"],
  t: (key: string) => string,
): string {
  if (source === "blood_panel") return t("glucoseSourceBloodPanel");
  if (source === "physiological_baseline") return t("glucoseSourcePhysiologicalBaseline");
  return t("glucoseSourceSessionAverage");
}

/**
 * Linee guida operative: sensori da sessione / Health&Bio per microbiota / allegati traccia / manuale come fallback.
 */
export function LactateAnalysisDataSourcesCard({
  segmentAttachment,
  onSegmentFile,
  hasHealthMicrobiotaProfile = false,
  healthBioGlucose = null,
  healthBioCoreTempC = null,
}: {
  segmentAttachment: SegmentAttachmentMeta;
  onSegmentFile: (meta: SegmentAttachmentMeta) => void;
  hasHealthMicrobiotaProfile?: boolean;
  healthBioGlucose?: HealthBioGlucoseMeta | null;
  healthBioCoreTempC?: number | null;
}) {
  const t = useTranslations("LactateAnalysisDataSourcesCard");
  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/10 px-4 py-4 text-sm text-gray-300">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-400">
        <FlaskConical className="h-4 w-4" aria-hidden />
        {t("dataSourcesLabel")}
      </div>
      {(healthBioGlucose != null || healthBioCoreTempC != null || hasHealthMicrobiotaProfile) ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[0.75rem] leading-relaxed text-gray-400">
          <span className="font-semibold text-emerald-300">{t("alignedFromHealthProfile")}</span>
          {hasHealthMicrobiotaProfile ? (
            <span className="block mt-1">
              {t.rich("microbiotaPanelLine", { em: (chunks) => <em>{chunks}</em> })}
            </span>
          ) : null}
          {healthBioGlucose != null ? (
            <span className="block mt-1">
              {t("glucoseLabel")}{" "}
              <strong className="text-gray-200">{healthBioGlucose.mmol_l.toFixed(2)} mmol/L</strong> ·{" "}
              {glucoseSourceLabel(healthBioGlucose.source, t)} {t("glucoseSourceNote")}
            </span>
          ) : null}
          {healthBioCoreTempC != null ? (
            <span className="block mt-1">
              {t("coreTempBaselineLabel")}{" "}
              <strong className="text-gray-200">{healthBioCoreTempC.toFixed(1)} °C</strong> {t("coreTempBaselineNote")}
            </span>
          ) : null}
        </div>
      ) : null}
      <ul className="mt-3 list-inside list-disc space-y-1.5 text-[0.8rem] leading-relaxed text-gray-400">
        <li>
          {t.rich("bulletAbsorption", {
            b: (chunks) => <strong className="text-gray-200">{chunks}</strong>,
            s: (chunks) => <strong>{chunks}</strong>,
            em: (chunks) => <em>{chunks}</em>,
          })}
        </li>
        <li>
          {t.rich("bulletMetrics", {
            b: (chunks) => <strong className="text-gray-200">{chunks}</strong>,
            s: (chunks) => <strong>{chunks}</strong>,
          })}
        </li>
        <li>
          {t.rich("bulletSegmentTrack", {
            b: (chunks) => <strong className="text-gray-200">{chunks}</strong>,
          })}
        </li>
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Pro2Link
          href="/health"
          variant="secondary"
          className="inline-flex items-center gap-2 border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-500/20"
        >
          <Stethoscope className="h-3.5 w-3.5" aria-hidden />
          {t("healthBioLink")}
        </Pro2Link>
        <span className="inline-flex items-center gap-1.5 text-[0.7rem] text-gray-500">
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          {t("testsReflectedNote")}
        </span>
      </div>
      <label className="mt-4 flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed border-white/15 bg-black/25 px-3 py-3 text-xs text-gray-400 transition-colors hover:border-emerald-500/40">
        <span className="flex items-center gap-2 font-medium text-gray-200">
          <FileUp className="h-4 w-4 text-emerald-400" aria-hidden />
          {t("segmentTrackAttachmentLabel")}
        </span>
        <input
          type="file"
          accept=".csv,.json,.gpx,.txt,text/csv,application/json,text/xml,application/gpx+xml"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) {
              onSegmentFile(null);
              return;
            }
            onSegmentFile({ name: f.name, size: f.size, type: f.type || "application/octet-stream" });
            e.target.value = "";
          }}
        />
        <span className="text-[0.7rem] text-gray-500">
          {segmentAttachment ? (
            <>
              {t("selectedLabel")}{" "}
              <strong className="text-gray-300">{segmentAttachment.name}</strong>{" "}
              {t("selectedSize", { size: (segmentAttachment.size / 1024).toFixed(1) })}
            </>
          ) : (
            t("noFileNote")
          )}
        </span>
        {segmentAttachment ? (
          <button
            type="button"
            className="self-start text-[0.7rem] text-rose-300 underline"
            onClick={() => onSegmentFile(null)}
          >
            {t("removeAttachment")}
          </button>
        ) : null}
      </label>
    </div>
  );
}
