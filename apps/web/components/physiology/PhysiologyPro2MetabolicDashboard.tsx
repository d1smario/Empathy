"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Award,
  BarChart3,
  Battery,
  CheckCircle2,
  Droplet,
  Flame,
  Gauge,
  HeartPulse,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetabolicProfileOutput, ZoneRow } from "@/lib/engines/critical-power-engine";
import { labelMetabolicFitModel } from "@/lib/engines/critical-power-engine";
import {
  CHART_AXIS,
  CHART_FONT,
  CHART_GRID,
  CHART_SIGNAL,
  CHART_STROKE,
  chartTooltipStyle,
} from "@/lib/ui/chart-theme";

export type CpPointDef = { label: string; sec: number };

const CP_CARD_ACCENTS: { border: string; glow: string; Icon: LucideIcon }[] = [
  { border: "#ef4444", glow: "rgba(239,68,68,0.35)", Icon: Zap },
  { border: "#f97316", glow: "rgba(249,115,22,0.35)", Icon: Zap },
  { border: "#f59e0b", glow: "rgba(245,158,11,0.3)", Icon: Flame },
  { border: "#eab308", glow: "rgba(234,179,8,0.3)", Icon: Flame },
  { border: "#22c55e", glow: "rgba(34,197,94,0.35)", Icon: HeartPulse },
  { border: "#4ade80", glow: "rgba(74,222,128,0.3)", Icon: HeartPulse },
  { border: "#14b8a6", glow: "rgba(20,184,166,0.35)", Icon: TrendingUp },
  { border: "#2dd4bf", glow: "rgba(45,212,191,0.35)", Icon: TrendingUp },
];

const ZONE_VISUAL: Record<
  string,
  { badge: string; barFat: string; barCho: string }
> = {
  "Z1 Recovery": { badge: "#6b7280", barFat: "#facc15", barCho: "#38bdf8" },
  "Z2 Endurance": { badge: "#22c55e", barFat: "#facc15", barCho: "#38bdf8" },
  "Z3 Tempo": { badge: "#f97316", barFat: "#facc15", barCho: "#38bdf8" },
  "Z4 Threshold": { badge: "#ea580c", barFat: "#facc15", barCho: "#38bdf8" },
  "Z5 VO2": { badge: "#dc2626", barFat: "#facc15", barCho: "#38bdf8" },
  "Z5 VO2max": { badge: "#dc2626", barFat: "#facc15", barCho: "#38bdf8" },
  "Z6 Anaerobic": { badge: "#a855f7", barFat: "#facc15", barCho: "#38bdf8" },
};

const HR_BANDS = ["100 - 130", "130 - 150", "150 - 165", "165 - 175", "175 - 185", "185+"] as const;
const LACTATE_MMOL = [0.8, 1.2, 2, 4, 8, 15] as const;

function parseW(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function buildZ6Row(z5: ZoneRow, p5W: number): ZoneRow {
  const low = z5.high + 1;
  const high = Math.max(p5W, z5.high * 1.08, low + 80);
  const avgW = (low + high) / 2;
  const rer = 1.02;
  const choFrac = 0.99;
  const fatFrac = 0.01;
  const efficiency = 0.24;
  const kcalH = (avgW / efficiency) * 3600 / 4184;
  const choG = (kcalH * choFrac) / 4;
  const fatG = (kcalH * fatFrac) / 9;
  return {
    name: "Z6 Anaerobic",
    low: Math.round(low),
    high: Math.round(high),
    avgW: Math.round(avgW),
    rer: Math.round(rer * 1000) / 1000,
    choFrac,
    fatFrac,
    kcalH: Math.round(kcalH),
    choG: Math.round(choG * 10) / 10,
    fatG: Math.round(fatG * 10) / 10,
  };
}

export type ZoneDisplayRow = ZoneRow & {
  fatPct: number;
  choPct: number;
  hrBand: string;
  lactateMmol: number;
  badgeColor: string;
};

function buildZoneRows(model: MetabolicProfileOutput, p5W: number): ZoneDisplayRow[] {
  const table = model.substrateTable;
  const base: ZoneDisplayRow[] = table.map((z, i) => ({
    ...z,
    fatPct: Math.round(z.fatFrac * 100),
    choPct: Math.round(z.choFrac * 100),
    hrBand: HR_BANDS[i] ?? "—",
    lactateMmol: LACTATE_MMOL[i] ?? 4,
    badgeColor: ZONE_VISUAL[z.name]?.badge ?? "#64748b",
  }));
  const z5raw = table[table.length - 1];
  if (!z5raw) return base;
  const z6 = buildZ6Row(z5raw, p5W);
  base.push({
    ...z6,
    fatPct: Math.round(z6.fatFrac * 100),
    choPct: Math.round(z6.choFrac * 100),
    hrBand: HR_BANDS[5],
    lactateMmol: LACTATE_MMOL[5],
    badgeColor: ZONE_VISUAL["Z6 Anaerobic"].badge,
  });
  return base;
}

function metabolicIntensitySeries(model: MetabolicProfileOutput, p5W: number) {
  const rows = buildZoneRows(model, p5W);
  return rows.map((z) => ({
    name: z.name.replace(/^Z\d+\s+/, ""),
    pctFtp: Math.round((z.avgW / Math.max(1, model.ftp)) * 10) / 10,
    fat: z.fatPct,
    cho: z.choPct,
  }));
}

export type PhysiologyPro2MetabolicDashboardProps = {
  cpPointDefs: CpPointDef[];
  cpInputs: Record<string, string>;
  onCpInputChange: (label: string, value: string) => void;
  model: MetabolicProfileOutput;
  /** Diagnostica di fit (R²/confidence/model) visibile solo a coach/admin. */
  showTech?: boolean;
};

export function PhysiologyPro2MetabolicDashboard({
  cpPointDefs,
  cpInputs,
  onCpInputChange,
  model,
  showTech = false,
}: PhysiologyPro2MetabolicDashboardProps) {
  const t = useTranslations("PhysiologyPro2MetabolicDashboard");
  const cpCurveHasData = useMemo(
    () => cpPointDefs.some((p) => parseW(cpInputs[p.label] ?? "") > 0),
    [cpPointDefs, cpInputs],
  );
  const p5W = parseW(cpInputs["5s"] ?? "");
  const curveData = cpPointDefs.map((p) => ({
    label: p.label,
    sec: p.sec,
    watts: parseW(cpInputs[p.label] ?? ""),
  }));

  const zones = buildZoneRows(model, p5W > 0 ? p5W : model.sprintReserve + model.cp);
  const metabolicSeries = metabolicIntensitySeries(model, p5W > 0 ? p5W : model.sprintReserve + model.cp);

  return (
    <div className="physiology-pro2-lab">
      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--cp">
        <Zap className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>CRITICAL POWER INPUTS</span>
        <Zap className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>

      <div className="physiology-pro2-lab-cp-grid">
        {cpPointDefs.map((p, i) => {
          const acc = CP_CARD_ACCENTS[i] ?? CP_CARD_ACCENTS[0];
          const Ico = acc.Icon;
          return (
            <div
              key={p.label}
              className="physiology-pro2-lab-cp-card"
              style={{ ["--cp-border" as string]: acc.border, ["--cp-glow" as string]: acc.glow }}
            >
              <div className="physiology-pro2-lab-cp-card-head">
                <span className="physiology-pro2-lab-cp-dur">{p.label}</span>
                <Ico className="physiology-pro2-lab-cp-ico" aria-hidden />
              </div>
              <div className="physiology-pro2-lab-cp-watts">{parseW(cpInputs[p.label] ?? "").toLocaleString("it-IT")}</div>
              <div className="physiology-pro2-lab-cp-unit">watts</div>
              <label className="physiology-pro2-lab-cp-edit">
                <span className="physiology-pro2-sr-only">{t("powerLabel", { label: p.label })}</span>
                <input
                  type="number"
                  className="physiology-pro2-lab-cp-input"
                  value={cpInputs[p.label] ?? ""}
                  onChange={(e) => onCpInputChange(p.label, e.target.value)}
                />
              </label>
            </div>
          );
        })}
      </div>

      {!cpCurveHasData ? (
        <p className="mt-4 rounded-xl border border-slate-600/40 bg-black/25 px-4 py-3 text-sm text-gray-400">
          {t.rich("noDataHint", { b: (chunks) => <strong>{chunks}</strong> })}
        </p>
      ) : null}

      {cpCurveHasData ? (
      <>
      <div className="physiology-pro2-lab-chart-card">
        <h3 className="physiology-pro2-lab-chart-title">Power Duration Curve</h3>
        <div className="physiology-pro2-lab-chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={curveData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pdcFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_SIGNAL.power} stopOpacity={0.55} />
                  <stop offset="95%" stopColor={CHART_SIGNAL.power} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
              <YAxis domain={[0, "auto"]} tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
              <Tooltip
                contentStyle={chartTooltipStyle("physiology")}
                formatter={(v: number) => [`${v} W`, t("powerSeries")]}
              />
              <Area type="monotone" dataKey="watts" stroke={CHART_SIGNAL.power} strokeWidth={CHART_STROKE.base} fill="url(#pdcFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--derived">
        <Target className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>DERIVED METRICS &amp; ANALYSIS</span>
        <Target className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>

      <p className="physiology-pro2-lab-subsec">{t("subsecThresholds")}</p>
      <div className="physiology-pro2-lab-metric-row physiology-pro2-lab-metric-row--3">
        <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--ftp">
          <Target className="physiology-pro2-lab-metric-ico" aria-hidden />
          <div className="physiology-pro2-lab-metric-label">FTP</div>
          <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--ftp">{model.ftp.toFixed(0)} W</div>
        </div>
        <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--lt1">
          <Activity className="physiology-pro2-lab-metric-ico" aria-hidden />
          <div className="physiology-pro2-lab-metric-label">LT1</div>
          <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--lt1">{model.lt1.toFixed(0)} W</div>
        </div>
        <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--lt2">
          <Flame className="physiology-pro2-lab-metric-ico" aria-hidden />
          <div className="physiology-pro2-lab-metric-label">LT2</div>
          <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--lt2">{model.lt2.toFixed(0)} W</div>
        </div>
      </div>

      {/* Substrati energetici e Metabolismo affiancati (feedback 2026-07). */}
      <div className="physiology-pro2-lab-split2">
        <div className="physiology-pro2-lab-split2-col">
          <p className="physiology-pro2-lab-subsec">{t("subsecEnergySubstrates")}</p>
          <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--fatmax">
            <Droplet className="physiology-pro2-lab-metric-ico" aria-hidden />
            <div className="physiology-pro2-lab-metric-label">FatMax</div>
            <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--fatmax">{model.fatmax.toFixed(0)} W</div>
          </div>
        </div>
        <div className="physiology-pro2-lab-split2-col">
          <p className="physiology-pro2-lab-subsec">{t("subsecMetabolismGlycolytic")}</p>
          <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--vla">
            <Zap className="physiology-pro2-lab-metric-ico" aria-hidden />
            <div className="physiology-pro2-lab-metric-label">{t("glycolyticIndexProxy")}</div>
            <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--vla">{model.vlamax.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <p className="physiology-pro2-lab-subsec physiology-pro2-lab-subsec--with-ico">
        <Battery className="physiology-pro2-lab-subsec-ico" aria-hidden />
        {t("subsecEnergyCapacities")}
      </p>
      <div className="physiology-pro2-lab-metric-row physiology-pro2-lab-metric-row--4">
        <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--compact">
          <Zap className="physiology-pro2-lab-metric-ico" aria-hidden />
          <div className="physiology-pro2-lab-metric-label">Sprint reserve</div>
          <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--red">{model.sprintReserve.toFixed(0)} W</div>
        </div>
        <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--compact">
          <Battery className="physiology-pro2-lab-metric-ico" aria-hidden />
          <div className="physiology-pro2-lab-metric-label">W′ capacity</div>
          <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--purple">
            {(model.wPrimeJ / 1000).toFixed(1)} kJ
          </div>
        </div>
        <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--compact">
          <Sparkles className="physiology-pro2-lab-metric-ico" aria-hidden />
          <div className="physiology-pro2-lab-metric-label">PCr capacity (est.)</div>
          <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--cyan">
            {(model.pcrCapacityJ / 1000).toFixed(1)} kJ
          </div>
        </div>
        <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--compact">
          <Flame className="physiology-pro2-lab-metric-ico" aria-hidden />
          <div className="physiology-pro2-lab-metric-label">Glycolytic cap. (est.)</div>
          <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--pink">
            {(model.glycolyticCapacityJ / 1000).toFixed(1)} kJ
          </div>
        </div>
      </div>

      {/* Fenotipo sempre (dato utile all'atleta: tipo metabolico). La diagnostica
          di fit (R²/confidence/model) è motore → solo coach/admin (audit 2026-07). */}
      <p className="physiology-pro2-lab-subsec physiology-pro2-lab-subsec--with-ico">
        <Award className="physiology-pro2-lab-subsec-ico" aria-hidden />
        {showTech ? t("subsecFitQualityPhenotype") : t("subsecPhenotype")}
      </p>
      <div className="physiology-pro2-lab-metric-row physiology-pro2-lab-metric-row--4">
        {showTech ? (
          <>
            <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--compact">
              <CheckCircle2 className="physiology-pro2-lab-metric-ico" aria-hidden />
              <div className="physiology-pro2-lab-metric-label">Fit quality (R²)</div>
              <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--green">{model.fitR2.toFixed(3)}</div>
            </div>
            <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--compact">
              <Award className="physiology-pro2-lab-metric-ico" aria-hidden />
              <div className="physiology-pro2-lab-metric-label">Fit confidence</div>
              <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--green">
                {model.fitConfidence.toFixed(0)}/100
              </div>
            </div>
            <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--compact">
              <BarChart3 className="physiology-pro2-lab-metric-ico" aria-hidden />
              <div className="physiology-pro2-lab-metric-label">Fit model</div>
              <div
                className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--blue"
                title={model.fitModel}
              >
                {labelMetabolicFitModel(model.fitModel)}
              </div>
            </div>
          </>
        ) : null}
        <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--compact">
          <Gauge className="physiology-pro2-lab-metric-ico" aria-hidden />
          <div className="physiology-pro2-lab-metric-label">{t("phenotypeLabel")}</div>
          <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--violet" style={{ textTransform: "capitalize" }}>
            {model.phenotype}
          </div>
        </div>
      </div>

      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--zones">
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>POWER ZONES &amp; SUBSTRATES</span>
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>

      <div className="physiology-pro2-lab-table-wrap">
        <table className="physiology-pro2-lab-table">
          <thead>
            <tr>
              <th>{t("tableColZone")}</th>
              <th>Power</th>
              <th>HR</th>
              <th>FAT %</th>
              <th>CHO %</th>
              <th>Lactate</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => {
              const vis = ZONE_VISUAL[z.name] ?? { barFat: "#facc15", barCho: "#38bdf8" };
              return (
                <tr key={z.name}>
                  <td>
                    <span className="physiology-pro2-lab-zone-badge" style={{ background: `${z.badgeColor}33`, borderColor: z.badgeColor, color: "#f8fafc" }}>
                      {z.name}
                    </span>
                  </td>
                  <td className="physiology-pro2-lab-td-power">
                    {z.low.toFixed(0)} – {z.high.toFixed(0)}W
                  </td>
                  <td className="physiology-pro2-lab-td-hr">{z.hrBand}</td>
                  <td>
                    <div className="physiology-pro2-lab-bar-track">
                      <div
                        className="physiology-pro2-lab-bar physiology-pro2-lab-bar--fat"
                        style={{ width: `${z.fatPct}%`, background: vis.barFat }}
                      />
                    </div>
                    <span className="physiology-pro2-lab-bar-label">{z.fatPct}%</span>
                  </td>
                  <td>
                    <div className="physiology-pro2-lab-bar-track">
                      <div
                        className="physiology-pro2-lab-bar physiology-pro2-lab-bar--cho"
                        style={{ width: `${z.choPct}%`, background: vis.barCho }}
                      />
                    </div>
                    <span className="physiology-pro2-lab-bar-label">{z.choPct}%</span>
                  </td>
                  <td className="physiology-pro2-lab-td-lac">{z.lactateMmol} mmol/L</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--report">
        <BarChart3 className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>{t("reportsBanner")}</span>
        <BarChart3 className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>

      <div className="physiology-pro2-lab-chart-card physiology-pro2-lab-chart-card--orange">
        <h3 className="physiology-pro2-lab-chart-title physiology-pro2-lab-chart-title--orange">
          {t("metabolicChartTitle")}
        </h3>
        <p className="physiology-pro2-lab-chart-hint">{t("metabolicChartHint")}</p>
        <div className="physiology-pro2-lab-chart-wrap">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={metabolicSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: CHART_AXIS.tick, fontSize: CHART_FONT.tick }} label={{ value: t("substrateAxisLabel"), angle: -90, position: "insideLeft", fill: CHART_AXIS.label, fontSize: CHART_FONT.axisLabel }} />
              <Tooltip
                contentStyle={chartTooltipStyle("physiology")}
              />
              <Legend />
              <Line type="monotone" dataKey="fat" name="FAT %" stroke={CHART_SIGNAL.fat} strokeWidth={CHART_STROKE.base} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="cho" name="CHO %" stroke={CHART_SIGNAL.cho} strokeWidth={CHART_STROKE.base} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      </>
      ) : null}
    </div>
  );
}
