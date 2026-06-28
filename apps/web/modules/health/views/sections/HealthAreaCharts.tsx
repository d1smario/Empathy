"use client";

import { Dna, Flame, Heart, HeartPulse, Zap } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_AXIS,
  CHART_FONT,
  CHART_GRID,
  CHART_SIGNAL,
  CHART_STROKE,
  chartHexToRgba,
  chartTooltipStyle,
} from "@/lib/ui/chart-theme";

const POLAR_GRID = chartHexToRgba("#ffffff", 0.12);
const RADIUS_TICK = { fill: CHART_AXIS.tickMuted, fontSize: CHART_FONT.tick - 1 };

type RadarResult = { rows: { subject: string; A: number; fullMark: number }[]; isDemo: boolean };
type BarResult = { rows: { name: string; val: number }[]; isDemo: boolean };
type TrendResult = {
  rows: { label: string; metilazione: number | null; detox: number | null; riparazione: number | null }[];
  isDemo: boolean;
};

export interface HealthAreaChartsProps {
  epigeneticRings: { name: string; value: number; fill: string }[];
  epigeneticRadar: RadarResult;
  epigeneticTrend: TrendResult;
  hasEpigeneticPanel: boolean;
  endocrineRadar: RadarResult;
  hormonesBar: BarResult;
  hasHormonesPanel: boolean;
  oxidativeRadar: RadarResult;
  hasOxidativePanel: boolean;
  inflammationRadar: RadarResult;
  hasInflammationPanel: boolean;
  microbiotaRadar: RadarResult;
  hasMicrobiotaPanel: boolean;
}

/** Rimanda alla sezione unica dei valori puntuali invece di ristampare i raw qui. */
function PointToLatest({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex h-full min-h-[220px] items-center justify-center px-4 text-center text-sm text-gray-400">
      {children}
    </p>
  );
}

/**
 * Approfondimenti per area (epigenetica / endocrino / stress / infiammazione / microbiota).
 * I valori grezzi NON vengono duplicati: stanno in «Ultimo referto caricato · valori estratti».
 */
export function HealthAreaCharts({
  epigeneticRings,
  epigeneticRadar,
  epigeneticTrend,
  hasEpigeneticPanel,
  endocrineRadar,
  hormonesBar,
  hasHormonesPanel,
  oxidativeRadar,
  hasOxidativePanel,
  inflammationRadar,
  hasInflammationPanel,
  microbiotaRadar,
  hasMicrobiotaPanel,
}: HealthAreaChartsProps) {
  return (
    <div className="space-y-6">
      {/* Epigenetica — anelli + radar pathway + trend */}
      <section className="space-y-6 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/[0.14] via-black/60 to-black/85 p-4 shadow-inner sm:p-6">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Dna className="h-5 w-5 text-violet-400" />
            <h3 className="text-lg font-bold text-white">Epigenetica · metilazione e vie metaboliche</h3>
          </div>
          <p className="text-sm text-gray-400">
            Anelli percentuali, radar sintetico e trend temporale.
            {epigeneticRadar.isDemo && epigeneticTrend.isDemo ? " Dati demo finché mancano valori strutturati." : ""}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-center font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
              Profilo a ciambelle
            </h4>
            <div className="h-[220px] w-full sm:h-[260px]">
              {epigeneticRings.length === 0 ? (
                <PointToLatest>
                  Carica un referto epigenetico per questo profilo. I valori estratti compaiono nella sezione «Ultimo
                  referto caricato».
                </PointToLatest>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="20%"
                    outerRadius="100%"
                    data={epigeneticRings.map((r) => ({ ...r, fill: r.fill }))}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar background dataKey="value" cornerRadius={6} />
                    <Tooltip formatter={(v: number) => [`${v}%`, ""]} contentStyle={chartTooltipStyle("health")} />
                  </RadialBarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {epigeneticRings.map((r) => (
                <div
                  key={r.name}
                  className="rounded-xl border border-white/10 px-2 py-2 text-center"
                  style={{ borderColor: chartHexToRgba(r.fill, 0.33) }}
                >
                  <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{r.name}</div>
                  <div className="font-mono text-lg font-semibold tabular-nums" style={{ color: r.fill }}>
                    {r.value}
                    <span className="ml-0.5 text-xs font-medium text-gray-500">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-center font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
              Vie metaboliche · radar
            </h4>
            <div className="w-full min-w-0" style={{ height: 300 }}>
              {epigeneticRadar.rows.length === 0 ? (
                <PointToLatest>
                  Nessun dato numerico epigenetico strutturato — importa un referto <code className="mx-1 text-violet-300">epigenetics</code>.
                </PointToLatest>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="78%" data={epigeneticRadar.rows}>
                    <PolarGrid stroke={POLAR_GRID} />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#c4b5fd", fontSize: CHART_FONT.tick - 1 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={RADIUS_TICK} />
                    <Radar name="Score" dataKey="A" stroke="#a855f7" fill="#a855f7" fillOpacity={0.35} strokeWidth={CHART_STROKE.base} />
                    <Tooltip contentStyle={chartTooltipStyle("health")} formatter={(v: number) => [`${Math.round(v)}`, ""]} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-center font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
            Trend metilazione / detox / riparazione
            {epigeneticTrend.isDemo ? " (demo)" : ""}
          </h4>
          <div className="min-h-[260px] w-full">
            {epigeneticTrend.rows.length === 0 ? (
              <PointToLatest>
                Carica almeno un panel <code className="mx-1 text-violet-300">epigenetics</code> con metilazione, detox e riparazione.
                Il confronto nel tempo parte dal secondo referto compatibile.
              </PointToLatest>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={epigeneticTrend.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="epiMeth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.55} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="epiDetox" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_SIGNAL.hrv} stopOpacity={0.5} />
                      <stop offset="95%" stopColor={CHART_SIGNAL.hrv} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="epiRep" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
                  <Tooltip contentStyle={chartTooltipStyle("health")} />
                  <Legend />
                  <Area type="monotone" dataKey="metilazione" name="Metilazione" stroke="#a855f7" fill="url(#epiMeth)" strokeWidth={CHART_STROKE.base} connectNulls />
                  <Area type="monotone" dataKey="detox" name="Detox" stroke={CHART_SIGNAL.hrv} fill="url(#epiDetox)" strokeWidth={CHART_STROKE.base} connectNulls />
                  <Area type="monotone" dataKey="riparazione" name="Riparazione" stroke="#3b82f6" fill="url(#epiRep)" strokeWidth={CHART_STROKE.base} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Endocrino — radar equilibrio + bar referto */}
      <section className="rounded-2xl border border-orange-500/25 bg-gradient-to-br from-orange-950/[0.12] via-black/60 to-black/85 p-4 shadow-inner sm:p-6">
        <div className="mb-2 flex items-center gap-2">
          <Heart className="h-5 w-5 text-orange-400" />
          <h3 className="text-lg font-bold text-white">Sistema endocrino</h3>
        </div>
        <p className="text-sm text-gray-400">
          Radar funzionale (HPA, HPG, tiroide, DHEA, IGF-1) e barre con i valori del referto ormonale.
          {endocrineRadar.isDemo && hormonesBar.isDemo ? " Dati demo finché mancano numeri." : ""}
        </p>
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-center font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
              Equilibrio assi
            </h4>
            <div className="w-full min-w-0" style={{ height: 300 }}>
              {endocrineRadar.rows.length === 0 ? (
                <PointToLatest>
                  {hasHormonesPanel
                    ? "Il radar richiede campi mappati (cortisolo AM/PM, testosterone, TSH, DHEA, IGF-1). I valori grezzi sono in «Ultimo referto caricato»."
                    : "Carica un referto ormonale con numeri strutturati."}
                </PointToLatest>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="78%" data={endocrineRadar.rows}>
                    <PolarGrid stroke={POLAR_GRID} />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#fdba74", fontSize: CHART_FONT.tick - 1 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={RADIUS_TICK} />
                    <Radar name="Score" dataKey="A" stroke={CHART_SIGNAL.power} fill={CHART_SIGNAL.power} fillOpacity={0.32} strokeWidth={CHART_STROKE.base} />
                    <Tooltip contentStyle={chartTooltipStyle("health")} formatter={(v: number) => [`${Math.round(v)}`, ""]} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-center font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
              Valori ormonali (referto)
            </h4>
            <div className="w-full min-w-0" style={{ height: 300 }}>
              {hormonesBar.rows.length === 0 ? (
                <PointToLatest>
                  {hasHormonesPanel
                    ? "Le barre usano gli ormoni mappati (cortisolo AM/PM, testosterone, TSH, T3/T4 libere). I valori grezzi sono in «Ultimo referto caricato»."
                    : "Nessun dato ormonale strutturato — importa un referto ormonale."}
                </PointToLatest>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hormonesBar.rows} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                    <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick - 1 }} angle={-20} textAnchor="end" height={64} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
                    <Tooltip contentStyle={chartTooltipStyle("health")} formatter={(v: number) => [v, ""]} />
                    <Bar dataKey="val" name="Valore" fill={CHART_SIGNAL.power} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stress ossidativo — radar */}
      <section className="rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-950/[0.12] via-black/60 to-black/85 p-4 shadow-inner sm:p-6">
        <div className="mb-2 flex items-center gap-2">
          <Zap className="h-5 w-5 text-sky-400" />
          <h3 className="text-lg font-bold text-white">Stress ossidativo · capacità antiossidante</h3>
        </div>
        <p className="text-sm text-gray-400">
          d-ROMs, BAP, glutatione, enzimi. {oxidativeRadar.isDemo ? "Demo finché mancano valori." : ""}
        </p>
        <div className="mx-auto mt-4 w-full min-w-0 max-w-none sm:max-w-lg" style={{ height: 300 }}>
          {oxidativeRadar.rows.length === 0 ? (
            <PointToLatest>
              {hasOxidativePanel
                ? "Nessun marker mappato al radar — i valori grezzi sono in «Ultimo referto caricato»."
                : "Carica un referto di stress ossidativo per vedere questo radar."}
            </PointToLatest>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="78%" data={oxidativeRadar.rows}>
                <PolarGrid stroke={POLAR_GRID} />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#7dd3fc", fontSize: CHART_FONT.tick }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={RADIUS_TICK} />
                <Radar name="Score" dataKey="A" stroke={CHART_SIGNAL.fat} fill={CHART_SIGNAL.fat} fillOpacity={0.35} strokeWidth={CHART_STROKE.base} />
                <Tooltip contentStyle={chartTooltipStyle("health")} formatter={(v: number) => [`${Math.round(v)}`, ""]} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Infiammazione — radar */}
      <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/[0.12] via-black/60 to-black/85 p-4 shadow-inner sm:p-6">
        <div className="mb-2 flex items-center gap-2">
          <Flame className="h-5 w-5 text-amber-400" />
          <h3 className="text-lg font-bold text-white">Markers infiammatori</h3>
        </div>
        <p className="text-sm text-gray-400">
          Radar · score sintetico (valori bassi = migliore){" "}
          {inflammationRadar.isDemo ? "— demo finché manca un referto con numeri" : ""}
        </p>
        <div className="mx-auto mt-4 w-full min-w-0 max-w-none sm:max-w-lg" style={{ height: 300 }}>
          {inflammationRadar.rows.length === 0 ? (
            <PointToLatest>
              {hasInflammationPanel
                ? "Nessun marker mappato agli assi PCR/IL-6 — i valori grezzi sono in «Ultimo referto caricato»."
                : "Carica un referto di infiammazione per questo grafico."}
            </PointToLatest>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="78%" data={inflammationRadar.rows}>
                <PolarGrid stroke={POLAR_GRID} />
                <PolarAngleAxis dataKey="subject" tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={RADIUS_TICK} />
                <Radar name="Score" dataKey="A" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.35} strokeWidth={CHART_STROKE.base} />
                <Tooltip contentStyle={chartTooltipStyle("health")} formatter={(v: number) => [`${Math.round(v)}`, ""]} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Microbiota — radar */}
      <section className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/[0.12] via-teal-950/[0.08] to-black/85 p-4 shadow-inner sm:p-6">
        <div className="mb-2 flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-emerald-400" />
          <h3 className="text-lg font-bold text-white">Composizione microbiota</h3>
        </div>
        <p className="text-sm text-gray-400">
          Percentuali / diversità (asse 0–100){" "}
          {microbiotaRadar.isDemo ? "— demo finché manca un referto con numeri" : ""}
        </p>
        <div className="mx-auto mt-4 w-full min-w-0 max-w-none sm:max-w-lg" style={{ height: 300 }}>
          {microbiotaRadar.rows.length === 0 ? (
            <PointToLatest>
              {hasMicrobiotaPanel
                ? "Composizioni attese non trovate (Firmicutes/Bacteroidetes ecc.) — i valori grezzi sono in «Ultimo referto caricato»."
                : "Carica un referto del microbiota per questo grafico."}
            </PointToLatest>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="78%" data={microbiotaRadar.rows}>
                <PolarGrid stroke={POLAR_GRID} />
                <PolarAngleAxis dataKey="subject" tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={RADIUS_TICK} />
                <Radar name="Valore" dataKey="A" stroke={CHART_SIGNAL.hrv} fill={CHART_SIGNAL.hrv} fillOpacity={0.35} strokeWidth={CHART_STROKE.base} />
                <Tooltip contentStyle={chartTooltipStyle("health")} formatter={(v: number) => [`${Math.round(v)}`, ""]} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}
