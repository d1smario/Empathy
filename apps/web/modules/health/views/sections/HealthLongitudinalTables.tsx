import { readNum, type BloodPanelRow } from "@/modules/health/lib/health-panel-readers";

export interface BloodMatrixColumn {
  id: string;
  label: string;
  row: BloodPanelRow;
  source: string | null;
}

export interface MicroMatrixColumn {
  id: string;
  label: string;
  v: Record<string, unknown> | null;
}

export interface HealthLongitudinalTablesProps {
  bloodCols: BloodMatrixColumn[];
  microCols: MicroMatrixColumn[] | null;
}

/**
 * Matrici longitudinali: una colonna per referto. De-duplicate rispetto a chart e snapshot —
 * qui i parametri si confrontano nel tempo, non si ripetono i valori singoli.
 */
export function HealthLongitudinalTables({ bloodCols, microCols }: HealthLongitudinalTablesProps) {
  if (bloodCols.length === 0 && !microCols) return null;
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm leading-relaxed text-gray-400">
        Ogni colonna è un referto in archivio (data campione). Le righe sono gli stessi parametri usati dai grafici sopra,
        così confronti i valori nel tempo.
      </p>

      {bloodCols.length > 0 ? (
        <div className="rounded-xl border border-rose-500/25 bg-white/[0.03] p-4">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-400">Sangue — parametri chiave</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Parametro</th>
                  {bloodCols.map((c) => (
                    <th key={c.id} className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">
                      <div>{c.label}</div>
                      {c.source ? (
                        <div
                          className="ml-auto mt-0.5 max-w-[140px] truncate text-[9px] font-normal normal-case text-gray-600"
                          title={c.source}
                        >
                          {c.source.length > 24 ? `${c.source.slice(0, 24)}…` : c.source}
                        </div>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(
                  [
                    { k: "emoglobina" as const, label: "Emoglobina", unit: "g/dL" },
                    { k: "ferritina" as const, label: "Ferritina", unit: "ng/mL" },
                    { k: "vit_d" as const, label: "Vit. D", unit: "ng/mL" },
                    { k: "b12" as const, label: "B12", unit: "pg/mL" },
                    { k: "glicemia" as const, label: "Glicemia", unit: "mg/dL" },
                  ] as const
                ).map((m) => (
                  <tr key={m.k} className="transition-colors hover:bg-white/[0.03]">
                    <td className="px-3 py-2 text-gray-300">{m.label}</td>
                    {bloodCols.map((c) => {
                      const v = c.row[m.k];
                      return (
                        <td key={`${c.id}-${m.k}`} className="px-3 py-2 text-right font-mono tabular-nums text-white">
                          {v == null ? "—" : `${v} ${m.unit}`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {microCols ? (
        <div className="rounded-xl border border-emerald-500/25 bg-white/[0.03] p-4">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-400">Microbiota — abbondanze / diversità</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">Indicatore</th>
                  {microCols.map((c) => (
                    <th key={c.id} className="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(
                  [
                    { keys: ["firmicutes_pct", "firmicutes"], label: "Firmicutes", unit: "%" },
                    { keys: ["bacteroidetes_pct", "bacteroidetes"], label: "Bacteroidetes", unit: "%" },
                    { keys: ["proteobacteria_pct", "proteobacteria"], label: "Proteobacteria", unit: "%" },
                    { keys: ["actinobacteria_pct", "actinobacteria"], label: "Actinobacteria", unit: "%" },
                    {
                      keys: ["diversity_shannon", "diversity", "shannon_index", "shannon"],
                      label: "Diversità (Shannon)",
                      unit: "",
                    },
                  ] as const
                ).map((m) => (
                  <tr key={m.label} className="transition-colors hover:bg-white/[0.03]">
                    <td className="px-3 py-2 text-gray-300">{m.label}</td>
                    {microCols.map((c) => {
                      const v = readNum(c.v, [...m.keys]);
                      return (
                        <td key={`${c.id}-${m.label}`} className="px-3 py-2 text-right font-mono tabular-nums text-white">
                          {v == null ? "—" : m.unit ? `${v} ${m.unit}` : String(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
