"use client";

import { Activity, Crosshair, Ruler, ShieldAlert, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { BiomechanicsCameraPlane } from "@empathy/contracts";
import { capturePlaneToViewMode, type BiomechanicsCaptureViewMode } from "@/lib/biomechanics/biomech-capture-view";
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
          <span className="text-gray-500">Disciplina</span> · {data.discipline ?? "—"} ·{" "}
          <span className="text-gray-500">Sorgente</span> · {data.source ?? "—"}
        </p>
        {data.recordedAt ? (
          <p className="mt-1 text-xs text-gray-400">Registrata {formatDateTime(data.recordedAt)}</p>
        ) : null}
        {mode === "preview" ? (
          <p className="mt-2 text-xs text-amber-300">
            Anteprima proposta CV
            {typeof data.confidence01 === "number" ? ` · confidenza ${pct01(data.confidence01)}` : ""}
            {data.provider ? ` · ${data.provider}` : ""}
          </p>
        ) : null}
      </div>

      {efficiency ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile label="Efficienza" value={pct01(efficiency.biomechanicalEfficiency01)} />
          <KpiTile label="Qualità movimento" value={pct01(efficiency.movementQuality01)} />
          <KpiTile label="Simmetria" value={pct01(efficiency.symmetry01)} />
          <KpiTile label="Rischio infortunio" value={pct01(efficiency.injuryRisk01)} />
        </div>
      ) : (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-gray-400">
          Nessun campione angolo disponibile per calcolare i KPI.
        </p>
      )}

      {envelopes.length ? (
        <Section title="Angoli articolari (ROM)" subtitle="Min, max, range e media per articolazione e lato." icon={Ruler}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Articolazione</th>
                  <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Lato</th>
                  <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Min</th>
                  <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Max</th>
                  <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">ROM</th>
                  <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Media</th>
                  <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Campioni</th>
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
        <Section title="Pattern di movimento" subtitle="Indicatori normalizzati 0–100%." icon={Activity}>
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
              Compensazioni: {data.compensationFlags.join(", ")}
            </p>
          ) : null}
        </Section>
      ) : null}

      {riskEntries.length ? (
        <Section title="Rischio per distretto" subtitle="Punteggi normalizzati dal motore CV + domain engine." icon={ShieldAlert}>
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
        <Section title="Calibrazione scala" subtitle="Riferimento metrico usato per la cattura." icon={Crosshair}>
          <p className="text-sm text-gray-300">
            {data.calibration.referenceLabel} · {Math.round(data.calibration.referenceValueMm)} mm ·{" "}
            {data.calibration.method}
            {typeof data.calibration.confidence01 === "number"
              ? ` · confidenza ${pct01(data.calibration.confidence01)}`
              : ""}
          </p>
        </Section>
      ) : null}

      {data.anthropometrics ? (
        <Section title="Segmenti antropometrici" subtitle="Lunghezze stimate (mm)." icon={Ruler}>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["femurMm", "Femore"],
                ["tibiaMm", "Tibia"],
                ["torsoMm", "Torso"],
                ["humerusMm", "Omero"],
                ["forearmMm", "Avambraccio"],
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
        title="Overlay angoli"
        icon={Video}
        subtitle={
          editable
            ? "Trascina i punti sul video; angoli e KPI si aggiornano dopo ogni correzione."
            : "Scheletro CV, archi e valori in gradi sul frame chiave (fase ciclo)."
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
                ? "Correggi i punti CV prima di confermare la sessione."
                : "Anteprima sulla cattura — conferma per promuovere al report canonico."
              : "Annotazione angoli sulla sessione confermata."
          }
        />
      </Section>
    </div>
  );
}
