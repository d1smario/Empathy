"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BloodPanelRow } from "@/modules/health/lib/health-panel-readers";
import {
  CHART_AXIS,
  CHART_FONT,
  CHART_GRID,
  CHART_SIGNAL,
  CHART_STROKE,
  chartTooltipStyle,
} from "@/lib/ui/chart-theme";

export interface HealthBloodTrendSectionProps {
  data: BloodPanelRow[];
  realPointCount: number;
  usingDemoTrend: boolean;
  hasLatestStructuredRow: boolean;
}

/**
 * Trend ematici nel tempo (line chart). I valori puntuali dell'ultimo referto
 * NON vengono ripetuti qui: stanno nella sezione «Ultimo referto caricato».
 */
export function HealthBloodTrendSection({
  data,
  realPointCount,
  usingDemoTrend,
  hasLatestStructuredRow,
}: HealthBloodTrendSectionProps) {
  return (
    <div className="rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-950/[0.14] via-pink-950/[0.08] to-black/85 p-5 shadow-inner">
      <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-400">Andamento parametri ematici</p>
      <p className="mt-1 text-sm text-gray-400">
        Ultimi 6 mesi · valori principali {usingDemoTrend ? "(demo finché mancano ≥2 punti reali)" : ""}
      </p>
      <div className="mt-4 h-[260px] w-full sm:h-[300px] lg:h-[320px]">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center px-4 text-center text-sm text-gray-400">
            {!hasLatestStructuredRow
              ? "Importa un referto "
              : "Aggiungi un secondo referto ematico per il grafico nel tempo · "}
            <code className="mx-1 text-rose-300">blood</code>
            {!hasLatestStructuredRow ? " per iniziare." : ""}
          </p>
        ) : realPointCount === 1 && !usingDemoTrend ? (
          <p className="flex h-full items-center justify-center px-4 text-center text-sm text-gray-400">
            Hai un solo referto ematico: il grafico comparativo nel tempo compare dopo il secondo referto.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
              <Tooltip contentStyle={chartTooltipStyle("health")} labelStyle={{ color: CHART_AXIS.tick }} />
              <Legend />
              <Line type="monotone" dataKey="emoglobina" name="Emoglobina (g/dL)" stroke={CHART_SIGNAL.hr} strokeWidth={CHART_STROKE.base} dot />
              <Line type="monotone" dataKey="ferritina" name="Ferritina (ng/mL)" stroke={CHART_SIGNAL.power} strokeWidth={CHART_STROKE.base} dot />
              <Line type="monotone" dataKey="vit_d" name="Vit. D (ng/mL)" stroke={CHART_SIGNAL.cho} strokeWidth={CHART_STROKE.base} dot />
              <Line type="monotone" dataKey="b12" name="B12 (pg/mL)" stroke={CHART_SIGNAL.hrv} strokeWidth={CHART_STROKE.base} dot />
              <Line type="monotone" dataKey="glicemia" name="Glicemia (mg/dL)" stroke={CHART_SIGNAL.glucose} strokeWidth={CHART_STROKE.base} dot />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
