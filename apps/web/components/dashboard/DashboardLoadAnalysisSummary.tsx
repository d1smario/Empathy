"use client";

import type {
  TrainingAdaptationLoopViewModel,
  TrainingRealityDiagnosticsViewModel,
} from "@/api/training/contracts";
import { Activity, LineChart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Pro2Link } from "@/components/ui/empathy";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import {
  type ExecutedAnalyticsRow,
  refKpisLastNDays,
} from "@/lib/training/analytics/executed-metric-aggregates";
import type { TrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { fetchTrainingAnalyticsRows } from "@/modules/training/services/training-analytics-api";
import { EMPATHY_LOAD_LABELS_IT } from "@/lib/training/load-metrics-labels";
import { trainingRealityDiagnosticsBannerIt } from "@/lib/training/training-reality-diagnostics";
import { readSwrCache, writeSwrCache } from "@/lib/client-swr-cache";

type AnalyticsPayload = Awaited<ReturnType<typeof fetchTrainingAnalyticsRows>>;

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function polyline(values: number[], width: number, height: number) {
  if (!values.length) return "";
  const max = Math.max(1, ...values);
  return values
    .map((v, i) => {
      const x = 20 + (i / Math.max(1, values.length - 1)) * (width - 40);
      const y = height - 20 - (v / max) * (height - 40);
      return `${x},${y}`;
    })
    .join(" ");
}

function formatDurationTotal(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function radarRingPoints(values: number[], cx: number, cy: number, maxR: number): string {
  return values
    .map((v, i) => {
      const t = ((-90 + i * 60) * Math.PI) / 180;
      const r = (Math.max(0, Math.min(100, v)) / 100) * maxR;
      return `${cx + r * Math.cos(t)},${cy + r * Math.sin(t)}`;
    })
    .join(" ");
}

function normalizeRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function couplingColor(coupling: number): string {
  if (coupling > 1.15) return "#fb7185";
  if (coupling < 0.85) return "#fbbf24";
  return "#34d399";
}

function kpiTile(label: string, value: string, sub?: string, accent?: "rose" | "fuchsia" | "slate") {
  const border =
    accent === "rose"
      ? "border-rose-500/30 bg-rose-500/10"
      : accent === "fuchsia"
        ? "border-fuchsia-500/30 bg-fuchsia-500/10"
        : "border-white/10 bg-black/30";
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${border}`}>
      <div className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-base font-bold tabular-nums text-white">{value}</div>
      {sub ? <div className="mt-0.5 text-[0.65rem] text-slate-500">{sub}</div> : null}
    </div>
  );
}

/**
 * Core dashboard: incrocio stimolo (TSS, fitness, pianificazione) vs risposta (recovery, twin, bioenergetica, lab)
 * — allineato al loop di controllo carico esterno / interno e modulatori del sistema.
 */
export function DashboardLoadAnalysisSummary() {
  const { athleteId, role, adminScoped, loading: athleteLoading } = useActiveAthlete();
  // Loop di controllo del motore (stato "regenerate", trigger grezzi, coupling): roba
  // da coach/admin, non da atleta. Vedi pattern showTech nelle viste moduli.
  const showTech = role === "coach" || adminScoped;
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [series, setSeries] = useState<
    Array<{ date: string; external: number; internal: number; ctl: number; atl: number; tsb: number; iCtl: number; iAtl: number; iTsb: number }>
  >([]);
  const [compareSeries, setCompareSeries] = useState<
    Array<{ date: string; planned: number; executed: number; internal: number }>
  >([]);
  const [windows, setWindows] = useState<{
    last7: { external: number; internal: number; coupling: number };
    last28: { external: number; internal: number; coupling: number };
    couplingDelta: number;
  } | null>(null);
  const [planWindows, setPlanWindows] = useState<{
    last7: { planned: number; executed: number; internal: number; compliancePct: number };
    last28: { planned: number; executed: number; internal: number; compliancePct: number };
  } | null>(null);
  const [latest, setLatest] = useState<{
    ctl: number;
    atl: number;
    tsb: number;
    iCtl: number;
    iAtl: number;
    iTsb: number;
  } | null>(null);
  const [adaptationLoop, setAdaptationLoop] = useState<TrainingAdaptationLoopViewModel | null>(null);
  const [operationalContext, setOperationalContext] = useState<TrainingDayOperationalContext | null>(null);
  const [trainingRealityDiagnostics, setTrainingRealityDiagnostics] =
    useState<TrainingRealityDiagnosticsViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cacheKey = athleteId ? `dash-core:${athleteId}` : null;

    const resetState = () => {
      setRows([]);
      setSeries([]);
      setCompareSeries([]);
      setWindows(null);
      setPlanWindows(null);
      setLatest(null);
      setAdaptationLoop(null);
      setOperationalContext(null);
      setTrainingRealityDiagnostics(null);
    };

    const applyPayload = (payload: AnalyticsPayload) => {
      setRows(payload.rows ?? []);
      setSeries(payload.series ?? []);
      setCompareSeries(payload.compareSeries ?? []);
      setWindows(payload.windows ?? null);
      const pw = payload.planWindows;
      setPlanWindows(
        pw
          ? {
              last7: {
                planned: pw.last7.planned,
                executed: pw.last7.executed,
                internal: pw.last7.internal,
                compliancePct: pw.last7.compliancePct,
              },
              last28: {
                planned: pw.last28.planned,
                executed: pw.last28.executed,
                internal: pw.last28.internal,
                compliancePct: pw.last28.compliancePct,
              },
            }
          : null,
      );
      const lat = payload.latest;
      setLatest(
        lat
          ? { ctl: lat.ctl, atl: lat.atl, tsb: lat.tsb, iCtl: lat.iCtl, iAtl: lat.iAtl, iTsb: lat.iTsb }
          : null,
      );
      setAdaptationLoop(payload.adaptationLoop ?? null);
      setOperationalContext(payload.operationalContext ?? null);
      setTrainingRealityDiagnostics(payload.trainingRealityDiagnostics ?? null);
    };

    async function load() {
      if (!athleteId || !cacheKey) {
        resetState();
        setLoading(false);
        return;
      }
      // Stale-while-revalidate: se ho già i dati di questo atleta li mostro subito
      // (niente skeleton al ritorno sulla pagina) e rivalido in background.
      const cached = readSwrCache<AnalyticsPayload>(cacheKey);
      if (cached && !cached.error) {
        applyPayload(cached);
        setError(null);
        setLoading(false);
      } else {
        setLoading(true);
        setError(null);
      }

      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - 120);
      const from = toDateOnly(start);
      const to = toDateOnly(today);

      const payload = await fetchTrainingAnalyticsRows({ athleteId, from, to });

      if (payload.error) {
        // Con dati in cache li tengo (niente blank); altrimenti mostro l'errore.
        if (!cached) {
          setError(payload.error);
          resetState();
        }
      } else {
        applyPayload(payload);
        writeSwrCache(cacheKey, payload);
        setError(null);
      }
      setLoading(false);
    }
    void load();
  }, [athleteId]);

  const analyticsEndDate = compareSeries.at(-1)?.date ?? toDateOnly(new Date());
  const ref7 = useMemo(
    () => refKpisLastNDays(rows as ExecutedAnalyticsRow[], 7, analyticsEndDate),
    [rows, analyticsEndDate],
  );
  const ref28 = useMemo(
    () => refKpisLastNDays(rows as ExecutedAnalyticsRow[], 28, analyticsEndDate),
    [rows, analyticsEndDate],
  );
  const ref42 = useMemo(
    () => refKpisLastNDays(rows as ExecutedAnalyticsRow[], 42, analyticsEndDate),
    [rows, analyticsEndDate],
  );

  const ext7 = windows?.last7.external ?? 0;
  const int7 = windows?.last7.internal ?? 0;
  const coupling7 = windows?.last7.coupling ?? 0;
  const coupling28 = windows?.last28.coupling ?? 0;
  const deltaCoupling = windows?.couplingDelta ?? 0;
  const plan7 = planWindows?.last7;
  const plan28 = planWindows?.last28;
  const compliance7 = plan7?.compliancePct ?? 0;
  const compliance28 = plan28?.compliancePct ?? 0;

  const divergenceScore = adaptationLoop?.divergenceScore ?? 0;
  const interventionScore = adaptationLoop?.interventionScore ?? 0;

  const couplingTone =
    coupling7 > 1.15 ? "text-rose-300" : coupling7 < 0.85 ? "text-amber-300" : "text-emerald-300";

  const last42s = series.slice(-42);
  const last42Compare = compareSeries.slice(-42);
  const ctlLine = polyline(last42s.map((p) => p.ctl), 1100, 260);
  const iCtlLine = polyline(last42s.map((p) => p.iCtl), 1100, 260);
  const plannedLine = polyline(last42Compare.map((p) => p.planned), 1100, 260);
  const extLine = polyline(last42Compare.map((p) => p.executed), 1100, 260);
  const intLine = polyline(last42Compare.map((p) => p.internal), 1100, 260);

  const adaptationNarrative =
    coupling7 > 1.15
      ? "Risposta interna elevata rispetto allo stimolo esterno: priorità a recupero e timing."
      : coupling7 < 0.85
        ? "Accoppiamento basso tra stimolo e risposta interna: verifica volume reale e contesto."
        : "Coerenza stimolo–risposta nei range attesi per l’adattamento.";

  const tssSub28 = `${ref28.tss.toFixed(0)} su 28g`;
  const kcalSub28 = `${ref28.kcal.toFixed(0)} su 28g`;
  const wattVal = ref7.wattAvg != null ? `${ref7.wattAvg.toFixed(0)} W` : "—";
  const planReal7 = plan7 ? `${plan7.planned.toFixed(0)} / ${plan7.executed.toFixed(0)}` : "—";
  const planReal28Sub = plan28 ? `28g: ${plan28.planned.toFixed(0)} / ${plan28.executed.toFixed(0)}` : undefined;
  const compliance7s = `${compliance7.toFixed(0)}%`;
  const compliance28s = `${compliance28.toFixed(0)}% (28g)`;
  const ctlExt = latest ? `${latest.ctl.toFixed(1)} / ${latest.atl.toFixed(1)} / ${latest.tsb.toFixed(1)}` : "—";
  const ctlInt = latest ? `${latest.iCtl.toFixed(1)} / ${latest.iAtl.toFixed(1)} / ${latest.iTsb.toFixed(1)}` : "—";
  const couplingSub =
    `28g ${coupling28.toFixed(2)} · Δ ` + (deltaCoupling >= 0 ? "+" : "") + deltaCoupling.toFixed(2);
  const divInt = `${divergenceScore.toFixed(1)} / ${interventionScore.toFixed(1)}`;
  const adaptabilityScore = Math.max(0, Math.min(100, Math.round(100 - divergenceScore * 1.7)));
  const realityDiagBanner = trainingRealityDiagnostics
    ? trainingRealityDiagnosticsBannerIt(trainingRealityDiagnostics)
    : null;
  const showPreferenceMismatchBanner =
    trainingRealityDiagnostics?.hint === "preference_mismatch" && Boolean(realityDiagBanner);
  const showNoExecutedBanner =
    !showPreferenceMismatchBanner &&
    (plan7?.planned ?? 0) > 0 &&
    (plan7?.executed ?? 0) < 1;
  const showNoTssBanner =
    !showNoExecutedBanner &&
    !showPreferenceMismatchBanner &&
    (plan7?.executed ?? 0) >= 1 &&
    ext7 < 1 &&
    ref7.tss < 1;
  const metricsRecent = [ext7, int7, plan7?.planned ?? 0, compliance7, latest?.ctl ?? 0, latest?.iCtl ?? 0];
  const metricsBaseline = [
    windows?.last28.external ?? 0,
    windows?.last28.internal ?? 0,
    plan28?.planned ?? 0,
    compliance28,
    (latest?.ctl ?? 0) * 0.92,
    (latest?.iCtl ?? 0) * 0.92,
  ];
  const bounds = metricsRecent.concat(metricsBaseline);
  const minBound = Math.min(...bounds, 0);
  const maxBound = Math.max(...bounds, 1);
  const radarRecent = metricsRecent.map((v) => normalizeRange(v, minBound, maxBound));
  const radarBaseline = metricsBaseline.map((v) => normalizeRange(v, minBound, maxBound));
  const ext42 = last42s.reduce((s, d) => s + d.external, 0);
  const int42 = last42s.reduce((s, d) => s + d.internal, 0);
  const donut7Total = Math.max(1, ext7 + int7);
  const donut42Total = Math.max(1, ext42 + int42);
  const rDonut = 28;
  const donutC = 2 * Math.PI * rDonut;
  const ext7Arc = donutC * (ext7 / donut7Total);
  const ext42Arc = donutC * (ext42 / donut42Total);

  return (
    <section id="dash-core" className="scroll-mt-28">
      <Pro2SectionCard accent="cyan" title="Core" subtitle="Carico, fitness e aderenza al piano" icon={Activity}>
        <details className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-gray-300">
          <summary className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-wider text-cyan-300/90">
            Cos&apos;è il Core
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            Il tuo carico di allenamento e lo stato di fitness: quanto hai fatto, quanto era pianificato e quanto sei
            stato costante. Sonno, recupero e bioenergetica li trovi in Physiology.
          </p>
        </details>

        {error ? (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100" role="alert">
            {error}
          </p>
        ) : null}

        {!athleteId && !athleteLoading ? (
          <p className="mt-4 text-sm text-gray-500">
            {role === "coach" ? "Seleziona un atleta attivo per il Core." : "Profilo atleta non disponibile."}
          </p>
        ) : loading ? (
          <p className="mt-4 text-sm text-gray-500">Caricamento Core…</p>
        ) : !series.length && !compareSeries.length ? (
          <p className="mt-4 text-sm text-gray-500">
            Nessun dato negli ultimi 120 giorni. Aggiungi sessioni da Training / Calendario; opzionale: Health per lab e sonno.
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            {showPreferenceMismatchBanner && realityDiagBanner ? (
              <p
                className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100"
                role="status"
              >
                <strong className="font-semibold text-cyan-50">Fonte training filtrata.</strong> {realityDiagBanner}
              </p>
            ) : null}
            {showNoExecutedBanner ? (
              <p
                className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                role="status"
              >
                <strong className="font-semibold text-amber-50">Manca la reality esecuzione (7g).</strong> Il piano è
                presente ma non risultano sessioni eseguite con carico: Fitness, Carico e coupling non sono
                significativi finché non sincronizzi device (Garmin/Wahoo/Strava), importi file o registri il
                completato.
              </p>
            ) : null}
            {showNoTssBanner ? (
              <p
                className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-100"
                role="status"
              >
                <strong className="font-semibold text-violet-50">Esecuzioni senza carico strutturato.</strong> Ci sono
                attività registrate ma senza impulso di carico (load o proxy da FC): verifica trace/power sulle sessioni
                eseguite o collega un provider training.
              </p>
            ) : null}
            <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-orange-200/90">Carico &amp; fitness</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {kpiTile(`${EMPATHY_LOAD_LABELS_IT.trainingLoad} · 7g`, ref7.tss.toFixed(0), tssSub28, "rose")}
                {kpiTile("Kcal · 7g", ref7.kcal.toFixed(0), kcalSub28)}
                {kpiTile("Watt medi · 7g", wattVal, "Durata-weighted da trace")}
                {kpiTile("Piano · reale · 7g", planReal7, planReal28Sub)}
                {kpiTile(
                  "Compliance · 7g · 28g",
                  compliance7s,
                  compliance28s,
                  compliance7 < 70 || compliance7 > 130 ? "rose" : undefined,
                )}
                {kpiTile(
                  `${EMPATHY_LOAD_LABELS_IT.fitness4} · ${EMPATHY_LOAD_LABELS_IT.strain} · ${EMPATHY_LOAD_LABELS_IT.form}`,
                  ctlExt,
                  "Carico esterno (V2)",
                )}
                {kpiTile(
                  `${EMPATHY_LOAD_LABELS_IT.conditioningInt4} · ${EMPATHY_LOAD_LABELS_IT.fatigueInt} · diff.`,
                  ctlInt,
                  "Stress core (V2)",
                  "fuchsia",
                )}
                {kpiTile("Coupling int/ext · 7g", coupling7.toFixed(2), couplingSub)}
                {kpiTile("Carico esterno 7g", ext7.toFixed(0), "Somma training load")}
                {kpiTile("Carico interno 7g", int7.toFixed(0), "Indice stress interno", "fuchsia")}
                {kpiTile("Divergenza · intervento", divInt, "Loop adattamento vs piano", divergenceScore > 35 ? "rose" : undefined)}
              </div>
            </div>

            {showTech && adaptationLoop ? (
              <details className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm">
                <summary className="cursor-pointer font-semibold text-white">Loop di adattamento · {adaptabilityScore}/100</summary>
                <p className="mt-2 text-gray-400">
                  Atteso 7g <span className="tabular-nums text-gray-200">{Math.round(adaptationLoop.expectedLoad7d)}</span>
                  {" · "}
                  Reale <span className="tabular-nums text-gray-200">{Math.round(adaptationLoop.realLoad7d)}</span>
                  {" · "}
                  Interno <span className="tabular-nums text-gray-200">{Math.round(adaptationLoop.internalLoad7d)}</span>
                  {" · "}
                  Compliance esecuzione{" "}
                  <span className="tabular-nums text-cyan-200">{adaptationLoop.executionCompliancePct.toFixed(0)}%</span>
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Stato: <strong className="text-gray-300">{adaptationLoop.status}</strong> ·{" "}
                  {adaptationLoop.nextAction.replace(/_/g, " ")} · {adaptationLoop.guidance}
                </p>
                {adaptationLoop.triggers.length ? (
                  <p className="mt-2 text-xs text-amber-200/80">Trigger: {adaptationLoop.triggers.join(" · ")}</p>
                ) : null}
                {adaptationLoop.lowExecutionEvidence ? (
                  <p className="mt-2 text-xs text-amber-200/85">
                    Evidenza esecutiva bassa: divergenza e intervento sono attenuati finché non c&apos;è carico
                    eseguito registrato (7g).
                  </p>
                ) : null}
              </details>
            ) : null}

            {showTech ? (
              <details
                className="rounded-2xl border border-white/10 bg-black/25 p-4"
                style={{ borderLeft: `3px solid ${couplingColor(coupling7)}` }}
              >
                <summary className={`cursor-pointer text-sm font-semibold ${couplingTone}`}>
                  Adattabilita {adaptabilityScore}/100 · coupling {coupling7.toFixed(2)}
                </summary>
                <p className={`mt-2 text-sm font-semibold ${couplingTone}`}>{adaptationNarrative}</p>
                {operationalContext ? (
                  <p className="mt-2 text-xs text-gray-500">{operationalContext.guidance}</p>
                ) : null}
              </details>
            ) : null}

            {last42Compare.length > 1 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
                  <LineChart className="h-4 w-4 text-cyan-400" aria-hidden />
                  Pannello unico 42g · carico + fitness + confronto
                </h3>
                <svg
                  viewBox="0 0 1100 260"
                  width="100%"
                  height="260"
                  preserveAspectRatio="none"
                  className="h-[200px] max-h-[45vh] w-full sm:h-[260px] sm:max-h-[40vh]"
                >
                  <polyline fill="none" stroke="#60a5fa" strokeWidth="1.8" points={plannedLine} />
                  <polyline fill="none" stroke="#ff7a1a" strokeWidth="2.3" points={extLine} />
                  <polyline fill="none" stroke="#d946ef" strokeWidth="2.3" points={intLine} />
                  <polyline fill="none" stroke="rgba(56,189,248,0.85)" strokeWidth="1.8" points={ctlLine} />
                  <polyline fill="none" stroke="rgba(167,139,250,0.9)" strokeWidth="1.8" points={iCtlLine} />
                </svg>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#60a5fa]" /> Planned</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#ff7a1a]" /> Real</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#d946ef]" /> Internal</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400/90" /> {EMPATHY_LOAD_LABELS_IT.fitness4}</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-400/90" /> {EMPATHY_LOAD_LABELS_IT.conditioningInt4}</span>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <h3 className="mb-2 text-sm font-bold text-white">Radar confronto · core loading</h3>
              <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center">
                <svg
                  viewBox="0 0 420 420"
                  className="h-auto w-full max-w-[260px] shrink-0 sm:max-w-[300px]"
                >
                  {Array.from({ length: 6 }, (_, i) => {
                    const t = ((-90 + i * 60) * Math.PI) / 180;
                    const cx = 210;
                    const cy = 210;
                    const r = 140;
                    return (
                      <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(t)} y2={cy + r * Math.sin(t)} stroke="rgba(148,163,184,0.25)" strokeWidth={1} />
                    );
                  })}
                  <polygon
                    points={radarRingPoints(radarBaseline, 210, 210, 140)}
                    fill="rgba(167,139,250,0.08)"
                    stroke="rgba(167,139,250,0.55)"
                    strokeWidth={2}
                    strokeDasharray="7 5"
                  />
                  <polygon
                    points={radarRingPoints(radarRecent, 210, 210, 140)}
                    fill="rgba(52,211,153,0.12)"
                    stroke="#34d399"
                    strokeWidth={2.5}
                  />
                </svg>
                <details className="w-full max-w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400 lg:max-w-md">
                  <summary className="cursor-pointer text-slate-300">
                    Confronto stella · recente vs baseline ({adaptabilityScore}/100)
                  </summary>
                  <p className="mt-2">
                    Assi: carico est. 7g, stress core 7g, piano 7g, compliance 7g, fitness, conditioning int. Verde = finestra
                    recente; viola tratteggiato = baseline.
                  </p>
                </details>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <h3 className="mb-2 text-sm font-bold text-white">Donut 7g · external vs internal</h3>
                <div className="flex items-center gap-4">
                  <svg width="96" height="96" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r={rDonut} fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="10" />
                    <circle
                      cx="48"
                      cy="48"
                      r={rDonut}
                      fill="none"
                      stroke="#ff7a1a"
                      strokeWidth="10"
                      strokeDasharray={`${ext7Arc} ${donutC - ext7Arc}`}
                      transform="rotate(-90 48 48)"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r={rDonut}
                      fill="none"
                      stroke="#d946ef"
                      strokeWidth="10"
                      strokeDasharray={`${donutC - ext7Arc} ${ext7Arc}`}
                      strokeDashoffset={-ext7Arc}
                      transform="rotate(-90 48 48)"
                    />
                  </svg>
                  <div className="text-xs text-gray-400">
                    <p>External: {ext7.toFixed(0)}</p>
                    <p>Internal: {int7.toFixed(0)}</p>
                    <p className="text-gray-500">Totale: {(ext7 + int7).toFixed(0)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <h3 className="mb-2 text-sm font-bold text-white">Donut 42g · external vs internal</h3>
                <div className="flex items-center gap-4">
                  <svg width="96" height="96" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r={rDonut} fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="10" />
                    <circle
                      cx="48"
                      cy="48"
                      r={rDonut}
                      fill="none"
                      stroke="#ff7a1a"
                      strokeWidth="10"
                      strokeDasharray={`${ext42Arc} ${donutC - ext42Arc}`}
                      transform="rotate(-90 48 48)"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r={rDonut}
                      fill="none"
                      stroke="#d946ef"
                      strokeWidth="10"
                      strokeDasharray={`${donutC - ext42Arc} ${ext42Arc}`}
                      strokeDashoffset={-ext42Arc}
                      transform="rotate(-90 48 48)"
                    />
                  </svg>
                  <div className="text-xs text-gray-400">
                    <p>External: {ext42.toFixed(0)}</p>
                    <p>Internal: {int42.toFixed(0)}</p>
                    <p className="text-gray-500">Ore 7g/42g: {formatDurationTotal(ref7.totalMinutes)} / {formatDurationTotal(ref42.totalMinutes)}</p>
                  </div>
                </div>
              </div>
            </div>

            <Pro2Link
              href="/training/analytics"
              variant="secondary"
              className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15"
            >
              Analyzer completo (grafici e overlay)
            </Pro2Link>
          </div>
        )}
      </Pro2SectionCard>
    </section>
  );
}
