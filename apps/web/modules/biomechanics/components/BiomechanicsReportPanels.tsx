"use client";

import { useTranslations } from "next-intl";
import { Activity, Crosshair, Ruler, ShieldAlert, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { BiomechanicsCameraPlane } from "@empathy/contracts";
import { capturePlaneToViewMode, type BiomechanicsCaptureViewMode } from "@/lib/biomechanics/biomech-capture-view";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import type { BiomechanicsSessionImportV1 } from "@empathy/contracts";
import { computeBiomechanicsEfficiencyScores, summarizeJointAngles } from "@empathy/domain-biomechanics";
import {
  deg,
  JOINT_LABELS,
  MOVEMENT_LABELS,
  pct01,
  RISK_LABELS,
  SIDE_LABELS,
  type BiomechanicsReportData,
} from "@/lib/biomechanics/biomech-report-utils";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { BiomechanicsAngleOverlay } from "@/modules/biomechanics/components/BiomechanicsAngleOverlay";

function formatDateTime(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

function KpiTile({ label, value }: { label: string; value: string }) {
  const percent = /^(.+?)\s*%$/.exec(value);
  return (
    <div className="rounded-xl border border-teal-500/25 bg-white/[0.03] p-4">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
        {percent ? percent[1] : value}
        {percent ? <span className="ml-1 text-xs font-medium text-gray-500">%</span> : null}
      </p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Pro2SectionCard accent="teal" icon={icon} title={title} subtitle={subtitle}>
      {children}
    </Pro2SectionCard>
  );
}

export function sessionToReportData(session: BiomechanicsSessionImportV1): BiomechanicsReportData {
  const efficiencyScores =
    session.efficiencyScores ??
    (session.jointAngles?.length
      ? computeBiomechanicsEfficiencyScores({
          jointAngles: session.jointAngles,
          movementPatterns: session.movementPatterns,
          riskScores: session.riskScores,
        })
      : undefined);

  return {
    discipline: session.discipline,
    source: session.source,
    recordedAt: session.recordedAt,
    jointAngles: session.jointAngles,
    landmarks: session.landmarks,
    mediaStoragePath:
      typeof session.payload?.mediaStoragePath === "string" ? session.payload.mediaStoragePath : undefined,
    movementPatterns: session.movementPatterns,
    riskScores: session.riskScores,
    efficiencyScores,
    calibration: session.calibration,
    anthropometrics: session.anthropometrics,
    compensationFlags: session.movementPatterns?.compensationFlags,
  };
}

export function BiomechanicsReportPanels({
  data,
  mode = "confirmed",
  videoUrl,
  editable = false,
  onPoseAdjust,
  cameraPlane = "side",
}: {
  data: BiomechanicsReportData;
  mode?: "preview" | "confirmed";
  videoUrl?: string | null;
  editable?: boolean;
  onPoseAdjust?: (
    landmarks: NonNullable<BiomechanicsReportData["landmarks"]>,
    jointAngles: NonNullable<BiomechanicsReportData["jointAngles"]>,
  ) => void;
  cameraPlane?: BiomechanicsCameraPlane;
}) {
  const t = useTranslations("BiomechanicsReportPanels");
  const { role, adminScoped } = useActiveAthlete();
  const showTech = role === "coach" || adminScoped;
  const viewMode: BiomechanicsCaptureViewMode = capturePlaneToViewMode(cameraPlane);
  const envelopes = data.jointAngles?.length ? summarizeJointAngles(data.jointAngles) : [];
  const efficiency = data.efficiencyScores;
  const riskEntries = Object.entries(RISK_LABELS).filter(
    ([key]) => typeof data.riskScores?.[key as keyof typeof RISK_LABELS] === "number",
  );
  const movementEntries = (
    ["pelvicStability01", "kneeTracking01", "ankleDynamics01", "strideSymmetry01", "rangeOfMotion01"] as const
  ).filter((key) => typeof data.movementPatterns?.[key] === "number");

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-300">
        <p>
          <span className="text-gray-500">{t("discipline")}</span> · {data.discipline ?? "—"} ·{" "}
          <span className="text-gray-500">{t("source")}</span> · {data.source ?? "—"}
        </p>
        {data.recordedAt ? (
          <p className="mt-1 text-xs text-gray-400">{t("recorded", { value: formatDateTime(data.recordedAt) })}</p>
        ) : null}
        {mode === "preview" ? (
          <p className="mt-2 text-xs text-amber-300">
            {t("proposedPreview")}
            {showTech && typeof data.confidence01 === "number" ? ` · ${t("confidenceSuffix", { value: pct01(data.confidence01) })}` : ""}
            {showTech && data.provider ? ` · ${data.provider}` : ""}
          </p>
        ) : null}
      </div>

      {efficiency ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile label={t("efficiency")} value={pct01(efficiency.biomechanicalEfficiency01)} />
          <KpiTile label={t("movementQuality")} value={pct01(efficiency.movementQuality01)} />
          <KpiTile label={t("symmetry")} value={pct01(efficiency.symmetry01)} />
          <KpiTile label={t("injuryRisk")} value={pct01(efficiency.injuryRisk01)} />
        </div>
      ) : (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-gray-400">
          {t("noAngleSample")}
        </p>
      )}

      {envelopes.length ? (
        <Section title={t("jointAnglesTitle")} subtitle={t("jointAnglesSubtitle")} icon={Ruler}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{t("colJoint")}</th>
                  <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{t("colSide")}</th>
                  <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{t("colMin")}</th>
                  <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{t("colMax")}</th>
                  <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{t("colRom")}</th>
                  <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{t("colMean")}</th>
                  <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{t("colSamples")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {envelopes.map((row) => (
                  <tr key={`${row.joint}-${row.side}`}>
                    <td className="px-3 py-2 text-gray-300">{JOINT_LABELS[row.joint]}</td>
                    <td className="px-3 py-2 text-gray-300">{SIDE_LABELS[row.side ?? "midline"]}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{deg(row.minDeg)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{deg(row.maxDeg)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{deg(row.rangeDeg)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{deg(row.meanDeg)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{row.samples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {movementEntries.length ? (
        <Section title={t("movementPatternsTitle")} subtitle={t("movementPatternsSubtitle")} icon={Activity}>
          <div className="grid gap-2 sm:grid-cols-2">
            {movementEntries.map((key) => (
              <div key={key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <span className="text-sm text-gray-300">{MOVEMENT_LABELS[key]}</span>
                <span className="font-mono text-sm tabular-nums text-white">{pct01(data.movementPatterns?.[key])}</span>
              </div>
            ))}
          </div>
          {data.compensationFlags?.length ? (
            <p className="mt-3 text-xs text-amber-300">
              {t("compensationsLabel")}: {data.compensationFlags.join(", ")}
            </p>
          ) : null}
        </Section>
      ) : null}

      {riskEntries.length ? (
        <Section title={t("riskByRegionTitle")} subtitle={showTech ? t("riskByRegionSubtitleTech") : t("riskByRegionSubtitle")} icon={ShieldAlert}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {riskEntries.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <span className="text-sm text-gray-300">{label}</span>
                <span className="font-mono text-sm tabular-nums text-white">
                  {pct01(data.riskScores?.[key as keyof typeof RISK_LABELS])}
                </span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {data.calibration ? (
        <Section title={t("scaleCalibrationTitle")} subtitle={t("scaleCalibrationSubtitle")} icon={Crosshair}>
          <p className="text-sm text-gray-300">
            {data.calibration.referenceLabel} · {Math.round(data.calibration.referenceValueMm)} mm ·{" "}
            {data.calibration.method}
            {showTech && typeof data.calibration.confidence01 === "number"
              ? ` · ${t("confidenceSuffix", { value: pct01(data.calibration.confidence01) })}`
              : ""}
          </p>
        </Section>
      ) : null}

      {data.anthropometrics ? (
        <Section title={t("anthropometricTitle")} subtitle={t("anthropometricSubtitle")} icon={Ruler}>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["femurMm", t("segmentFemur")],
                ["tibiaMm", t("segmentTibia")],
                ["torsoMm", t("segmentTorso")],
                ["humerusMm", t("segmentHumerus")],
                ["forearmMm", t("segmentForearm")],
              ] as const
            )
              .filter(([key]) => typeof data.anthropometrics?.[key] === "number")
              .map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-sm text-gray-300">{label}</span>
                  <span className="font-mono text-sm tabular-nums text-white">
                    {Math.round(data.anthropometrics![key]!)}
                    <span className="ml-1 text-xs font-medium text-gray-500">mm</span>
                  </span>
                </div>
              ))}
          </div>
        </Section>
      ) : null}

      <Section
        title={t("angleOverlayTitle")}
        icon={Video}
        subtitle={
          editable
            ? t("angleOverlaySubtitleEditable")
            : t("angleOverlaySubtitle")
        }
      >
        <BiomechanicsAngleOverlay
          jointAngles={data.jointAngles}
          landmarks={data.landmarks}
          videoUrl={videoUrl}
          editable={editable}
          cameraPlane={cameraPlane}
          viewMode={viewMode}
          onLandmarksChange={onPoseAdjust}
          title={
            mode === "preview"
              ? editable
                ? t("overlayCorrectPoints")
                : t("overlayPreviewCapture")
              : t("overlayConfirmedAnnotation")
          }
        />
      </Section>
    </div>
  );
}
