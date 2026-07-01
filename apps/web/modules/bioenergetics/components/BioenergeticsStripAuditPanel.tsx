"use client";

import type { BioenergeticMonitoringStripAuditV1 } from "@/api/bioenergetics/contracts";

type Props = {
  audit: BioenergeticMonitoringStripAuditV1;
};

/**
 * Pannello tecnico da `GET /api/bioenergetics/day?stripAudit=1` — controlli input → curve striscia.
 */
export function BioenergeticsStripAuditPanel({ audit }: Props) {
  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div>
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-lime-400">
          Strip controls (audit v{audit.auditContractVersion})
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Rendered layer: <span className="text-gray-200">{audit.stripLayerRendered}</span> · engine consistency check
          without recomputing curves.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AuditStat label="CHO day (g)" value={String(Math.round(audit.diaryAndTraining.choIntakeGramsDay))} />
        <AuditStat label="Meals with macros" value={String(audit.diaryAndTraining.mealsWithMacroSignals)} />
        <AuditStat label="Sessions executed" value={String(audit.diaryAndTraining.executedWorkoutCount)} />
        <AuditStat label="TSS executed" value={String(Math.round(audit.diaryAndTraining.executedTssSum))} />
        <AuditStat label="Glucose samples (055)" value={String(audit.channelsSource.glucoseSamples055)} />
        <AuditStat label="Lactate samples (055)" value={String(audit.channelsSource.lactateSamples055)} />
        <AuditStat
          label="Glu / lac provenance"
          value={`${audit.channelsSource.glucoseProvenance} / ${audit.channelsSource.lactateProvenance}`}
        />
        <AuditStat
          label="Postprandial load (01)"
          value={String(Math.round(audit.cortisolActhModulation.postprandialMealLoad01 * 100) / 100)}
        />
        <AuditStat
          label="Meal glycemic peak hour"
          value={`${String(audit.timelineDigest.mealGlycemicMaxHour).padStart(2, "0")}:00`}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/30">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Channel</th>
              <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Plane</th>
              <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Populated hours</th>
              <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Min–max</th>
              <th className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Stream</th>
              <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Fusion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {audit.stripChannels.map((ch) => (
              <tr key={ch.id} className="align-top transition-colors hover:bg-white/[0.03]">
                <td className="px-3 py-2 text-gray-300">
                  {ch.labelIt}
                  <span className="block text-[0.65rem] text-gray-500">{ch.unit}</span>
                </td>
                <td className="px-3 py-2 text-gray-400">{ch.dataPlane}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{ch.hourlyNonNullCount}/24</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-white">
                  {ch.hourlyMin != null && ch.hourlyMax != null ? `${ch.hourlyMin} – ${ch.hourlyMax}` : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-white">{ch.streamPointCount}</td>
                <td className="max-w-xs px-3 py-2 text-[0.65rem] leading-snug text-gray-500">
                  {ch.curveResolutionNote ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-1 text-[0.7rem] leading-relaxed text-gray-500">
        {audit.engineRefsIt.map((line) => (
          <li key={line.slice(0, 48)}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function AuditStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}
