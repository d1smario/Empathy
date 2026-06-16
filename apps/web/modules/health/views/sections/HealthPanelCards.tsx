import type { HealthPanelTimelineRow } from "@/modules/health/services/health-module-api";
import { panelRawDisplayRows, type BloodPanelRow } from "@/modules/health/lib/health-panel-readers";

export function BloodSnapshotTable({
  row,
  sampleLabel,
}: {
  row: BloodPanelRow;
  sampleLabel?: string | null;
}) {
  const cells: Array<{ label: string; value: string | null; unit: string }> = [
    { label: "Emoglobina", value: row.emoglobina != null ? String(row.emoglobina) : null, unit: "g/dL" },
    { label: "Ferritina", value: row.ferritina != null ? String(row.ferritina) : null, unit: "ng/mL" },
    { label: "Vit. D", value: row.vit_d != null ? String(row.vit_d) : null, unit: "ng/mL" },
    { label: "B12", value: row.b12 != null ? String(row.b12) : null, unit: "pg/mL" },
    { label: "Glicemia", value: row.glicemia != null ? String(row.glicemia) : null, unit: "mg/dL" },
  ];
  return (
    <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
      <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-400">
        Ultimo referto ematico
        {sampleLabel ? <span className="ml-2 font-sans font-normal normal-case text-gray-400">· {sampleLabel}</span> : null}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {cells.map((c) => (
          <div key={c.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <dt className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{c.label}</dt>
            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">
              {c.value ?? "—"}
              {c.value != null ? <span className="ml-1 text-xs font-medium text-gray-500">{c.unit}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function RawPanelValuesCard({
  panel,
  title,
  className = "border-white/10",
  showTech = true,
}: {
  panel: HealthPanelTimelineRow;
  title?: string;
  className?: string;
  /** false per l'atleta: solo etichette note, niente chiavi grezze/sconosciute né JSON annidato. */
  showTech?: boolean;
}) {
  const rows = panelRawDisplayRows(panel, { showTech });
  if (rows.length === 0) return null;
  const when = panel.sample_date ?? panel.created_at?.slice(0, 10) ?? null;
  return (
    <div className={`rounded-xl border bg-white/[0.03] p-4 ${className}`}>
      {title ? (
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-400">
          {title}
          {when ? <span className="ml-2 font-sans font-normal normal-case text-gray-500">· {when}</span> : null}
        </p>
      ) : when ? (
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Data referto · {when}</p>
      ) : null}
      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.key} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
            <dt className="truncate font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500" title={r.key}>
              {r.label}
            </dt>
            <dd className="mt-0.5 break-words font-mono text-sm tabular-nums text-white">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
