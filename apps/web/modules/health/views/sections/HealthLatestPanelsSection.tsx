import type { HealthPanelTimelineRow } from "@/modules/health/services/health-module-api";
import { structuredValuesFieldCount, type BloodPanelRow } from "@/modules/health/lib/health-panel-readers";
import { BloodSnapshotTable, RawPanelValuesCard } from "./HealthPanelCards";

export interface HealthLatestPanelsSectionProps {
  bloodRow: BloodPanelRow | null;
  newestBloodPanel: HealthPanelTimelineRow | undefined;
  latestPanelsByTypeForRaw: HealthPanelTimelineRow[];
  /** false per l'atleta: le card valori grezzi mostrano solo etichette note. */
  showTech?: boolean;
}

/** Etichette italiane per i tipi di pannello visibili all'atleta (solo presentazione). */
const PANEL_TYPE_LABELS_IT: Record<string, string> = {
  blood: "ematici",
  microbiota: "microbiota",
  epigenetics: "epigenetica",
  hormones: "profilo ormonale",
  inflammation: "infiammazione",
  oxidative_stress: "stress ossidativo",
};

function panelTypeLabelIt(type: string): string {
  return PANEL_TYPE_LABELS_IT[type] ?? type.replace(/_/g, " ");
}

/**
 * UNICA fonte dei valori puntuali: ultimo referto per tipo + valori estratti.
 * I grafici di trend e le aree leggono lo stesso panel ma non ripetono qui i numeri.
 */
export function HealthLatestPanelsSection({
  bloodRow,
  newestBloodPanel,
  latestPanelsByTypeForRaw,
  showTech = true,
}: HealthLatestPanelsSectionProps) {
  const hasNonBlood = latestPanelsByTypeForRaw.some((p) => p.type !== "blood");
  if (!bloodRow && !hasNonBlood) return null;

  return (
    <section
      id="mod-ultimo-referto"
      className="scroll-mt-20 rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-950/[0.14] via-pink-950/[0.08] to-black/85 p-4 shadow-inner sm:scroll-mt-28 sm:p-6"
      aria-label="Valori ultimo referto per tipo"
    >
      <h2 className="text-center font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-400">
        Ultimo referto caricato · valori estratti
      </h2>
      <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-gray-400">
        Un solo esame basta: qui vedi i campi strutturati dell&apos;ultimo referto per ogni tipo. I trend nel tempo si
        riempiono quando ci sono più punti.
      </p>
      <div className="mt-5 space-y-4">
        {bloodRow ? (
          <BloodSnapshotTable
            row={bloodRow}
            sampleLabel={newestBloodPanel?.sample_date ?? newestBloodPanel?.created_at?.slice(0, 10) ?? null}
          />
        ) : newestBloodPanel &&
          structuredValuesFieldCount(newestBloodPanel.values as Record<string, unknown> | null) > 0 ? (
          <RawPanelValuesCard panel={newestBloodPanel} title="ematici" className="border-rose-500/20" showTech={showTech} />
        ) : null}
        {latestPanelsByTypeForRaw
          .filter((p) => p.type !== "blood")
          .map((p) => (
            <RawPanelValuesCard
              key={p.type}
              panel={p}
              title={panelTypeLabelIt(p.type)}
              className="border-rose-500/20"
              showTech={showTech}
            />
          ))}
      </div>
    </section>
  );
}
