"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Activity, HeartPulse, Microscope, Wrench } from "lucide-react";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import { ModulePillSubnav, type ModulePillAnchorItem } from "@/components/navigation/ModulePillSubnav";
import { MODULE_PILL_ROSE } from "@/components/navigation/module-pill-styles";
import { scopedReviewUrl } from "@/lib/athlete-scope/scoped-athlete-href";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import {
  fetchHealthPanelsTimeline,
  fetchHealthSystemMap,
  patchHealthStagingRun,
  type HealthSystemMapViewModel,
  type HealthStagingRunAction,
  type HealthTimelineFetchDiagnostics,
  uploadHealthDocument,
  type HealthPanelTimelineRow,
} from "@/modules/health/services/health-module-api";
import {
  SHOW_HEALTH_DEMO_FALLBACK_DATA,
  DEMO_BLOOD_TREND,
  DEMO_EPIGENETIC_TREND,
  endocrineRadarFromPanel,
  epigeneticRadarFromPanel,
  epigeneticRingsFromPanel,
  hormonesBarFromPanel,
  inflammationRadarFromPanel,
  isHormonePanelType,
  microbiotaRadarFromPanel,
  oxidativeStressRadarFromPanel,
  readNum,
  rowFromBloodPanel,
  rowFromEpigeneticTrendPanel,
  sortPanelsNewestFirst,
  structuredValuesFieldCount,
} from "@/modules/health/lib/health-panel-readers";
import { HealthImportSection } from "@/modules/health/views/sections/HealthImportSection";
import { HealthScoreSummary } from "@/modules/health/views/sections/HealthScoreSummary";
import { HealthLatestPanelsSection } from "@/modules/health/views/sections/HealthLatestPanelsSection";
import {
  HealthLongitudinalTables,
  type BloodMatrixColumn,
  type MicroMatrixColumn,
} from "@/modules/health/views/sections/HealthLongitudinalTables";
import { HealthSystemMapPanel } from "@/modules/health/views/sections/HealthSystemMapPanel";
import { HealthArchiveSection } from "@/modules/health/views/sections/HealthArchiveSection";

// Sezioni recharts (radar/anelli/trend): caricate in chunk separati e solo quando
// il tab che le contiene è attivo (no SSR, presentazionali su props già pronte).
// Tiene fuori recharts dal bundle iniziale della pagina Health.
const healthChartFallback = (
  <div className="h-48 rounded-2xl border border-white/10 bg-black/20" aria-hidden />
);
const HealthAreaCharts = dynamic(
  () => import("@/modules/health/views/sections/HealthAreaCharts").then((m) => m.HealthAreaCharts),
  { ssr: false, loading: () => healthChartFallback },
);
const HealthBloodTrendSection = dynamic(
  () => import("@/modules/health/views/sections/HealthBloodTrendSection").then((m) => m.HealthBloodTrendSection),
  { ssr: false, loading: () => healthChartFallback },
);

type HealthTabId = "aree" | "stato" | "dettagli";

// Cache cross-mount della timeline referti: ri-atterrando su Health & Bio i dati
// compaiono subito (niente spinner/"refresh"); l'aggiornamento avviene in background
// silenzioso, così si vedono anche i nuovi referti dopo un upload senza spinner.
let healthTimelineCacheId: string | null = null;
let healthTimelineCache: {
  panels: HealthPanelTimelineRow[];
  error: string | null;
  diagnostics: HealthTimelineFetchDiagnostics | null;
} | null = null;

export default function HealthPageView() {
  const t = useTranslations("HealthPageView");
  const { athleteId, loading: ctxLoading, adminScoped, platformAdminView, scopeOwnerUserId, role } = useActiveAthlete();
  const showTech = role === "coach" || adminScoped;
  const [panels, setPanels] = useState<HealthPanelTimelineRow[]>([]);
  const [systemMap, setSystemMap] = useState<HealthSystemMapViewModel>({
    nodes: [],
    edges: [],
    bioenergeticsResponses: [],
    stagingRuns: [],
  });
  const [timelineErr, setTimelineErr] = useState<string | null>(null);
  const [timelineDiag, setTimelineDiag] = useState<HealthTimelineFetchDiagnostics | null>(null);
  const [systemMapErr, setSystemMapErr] = useState<string | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [uploadBusy, setUploadBusy] = useState<string | null>(null);
  const [stagingBusy, setStagingBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sampleDate, setSampleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expandedPanelId, setExpandedPanelId] = useState<string | null>(null);
  /** Tab di navigazione: si monta solo la sezione attiva (apertura su «Analisi dettagliata»). */
  const [activeTab, setActiveTab] = useState<HealthTabId>("aree");
  /** athleteId per cui la mappa di sistema è già stata caricata (lazy, solo tab «Dettagli e motore»). */
  const [systemMapLoadedFor, setSystemMapLoadedFor] = useState<string | null>(null);

  const loadTimeline = useCallback(async () => {
    if (!athleteId) {
      setPanels([]);
      setTimelineErr(null);
      setTimelineDiag(null);
      setSystemMap({ nodes: [], edges: [], bioenergeticsResponses: [], stagingRuns: [] });
      setSystemMapErr(null);
      setLoadingTimeline(false);
      return;
    }
    const cached = healthTimelineCacheId === athleteId ? healthTimelineCache : null;
    if (cached) {
      // Mostra subito i dati in cache (niente spinner); refresh in background sotto.
      setPanels(cached.panels);
      setTimelineErr(cached.error);
      setTimelineDiag(cached.diagnostics);
      setLoadingTimeline(false);
    } else {
      setLoadingTimeline(true);
    }
    // Lettura diretta da Supabase (RLS come guardia): stessa sessione browser,
    // niente retry HTTP cookie-only (il vecchio fallback compensava bearer stale).
    const { panels: next, error, diagnostics } = await fetchHealthPanelsTimeline(athleteId);
    setPanels(next);
    setTimelineErr(error);
    setTimelineDiag(diagnostics);
    healthTimelineCache = { panels: next, error, diagnostics };
    healthTimelineCacheId = athleteId;
    setLoadingTimeline(false);
  }, [athleteId]);

  /** Mappa di sistema (diagnostica coach/admin): caricata solo quando si apre «Dettagli e motore». */
  const loadSystemMap = useCallback(async () => {
    if (!athleteId) {
      setSystemMap({ nodes: [], edges: [], bioenergeticsResponses: [], stagingRuns: [] });
      setSystemMapErr(null);
      return;
    }
    const { systemMap: nextMap, error: mapErr } = await fetchHealthSystemMap(athleteId);
    setSystemMap(nextMap);
    setSystemMapErr(mapErr);
  }, [athleteId]);

  useEffect(() => {
    if (ctxLoading) return;
    void loadTimeline();
  }, [ctxLoading, loadTimeline]);

  /** Lazy: la mappa di sistema si carica solo entrando in «Dettagli e motore» (coach/admin), per atleta. */
  useEffect(() => {
    if (ctxLoading || !showTech || !athleteId) return;
    if (activeTab !== "dettagli" || systemMapLoadedFor === athleteId) return;
    setSystemMapLoadedFor(athleteId);
    void loadSystemMap();
  }, [ctxLoading, showTech, athleteId, activeTab, systemMapLoadedFor, loadSystemMap]);

  const panelsNewestFirst = useMemo(() => sortPanelsNewestFirst(panels), [panels]);

  /**
   * Diagnostica leggera dell'archivio: distingue i panel che effettivamente
   * popolano i grafici (values strutturati canonici) da quelli che attendono
   * conferma o sono solo file caricati.
   */
  const archiveDiagnostics = useMemo(() => {
    let withCanonicalValues = 0;
    let withProposalsOnly = 0;
    let importOnly = 0;
    let vlmPending = 0;
    for (const p of panels) {
      const vals = (p.values ?? null) as Record<string, unknown> | null;
      const flatFields = vals
        ? Object.keys(vals).filter((k) => k !== "import" && k !== "vlm_proposals" && k !== "vlm_pending_validation").length
        : 0;
      const proposals = vals?.vlm_proposals;
      const proposalCount = Array.isArray(proposals) ? proposals.length : 0;
      const importBlock =
        vals && typeof vals.import === "object" && vals.import !== null
          ? (vals.import as Record<string, unknown>)
          : null;
      const importStatus = typeof importBlock?.status === "string" ? (importBlock?.status as string) : "";
      const isPendingVlm = Boolean(vals?.vlm_pending_validation) || importStatus === "vlm_proposed";
      if (isPendingVlm) vlmPending++;
      if (flatFields > 0) withCanonicalValues++;
      else if (proposalCount > 0) withProposalsOnly++;
      else importOnly++;
    }
    return {
      total: panels.length,
      withCanonicalValues,
      withProposalsOnly,
      importOnly,
      vlmPending,
    };
  }, [panels]);

  /** Map panelId → runId VLM in pending_validation, per il link "Apri review" sull'archivio. */
  const pendingVlmRunByPanelId = useMemo(() => {
    const out = new Map<string, string>();
    for (const run of systemMap.stagingRuns) {
      const status = typeof run.status === "string" ? run.status : "";
      const trigger = typeof run.trigger_source === "string" ? run.trigger_source : "";
      if (status !== "pending_validation" || trigger !== "health_upload_vlm") continue;
      const refs = Array.isArray(run.source_refs) ? run.source_refs : [];
      for (const ref of refs) {
        if (ref && typeof ref === "object" && !Array.isArray(ref)) {
          const r = ref as Record<string, unknown>;
          if (r.table === "biomarker_panels" && typeof r.id === "string" && typeof run.id === "string") {
            out.set(r.id, run.id);
          }
        }
      }
    }
    return out;
  }, [systemMap.stagingRuns]);

  const bloodRowsChronological = useMemo(() => {
    const rowsDesc = panelsNewestFirst
      .filter((p) => p.type === "blood")
      .map(rowFromBloodPanel)
      .filter((r): r is NonNullable<typeof r> => r != null);
    return [...rowsDesc].reverse();
  }, [panelsNewestFirst]);

  /**
   * Serie per il grafico: anche **1 solo punto** reale è valido.
   * Demo fallback solo in dev e solo se non c'è alcun dato reale.
   */
  const bloodLineChartData = useMemo(() => {
    if (bloodRowsChronological.length >= 1) return bloodRowsChronological;
    if (!SHOW_HEALTH_DEMO_FALLBACK_DATA) return [];
    return DEMO_BLOOD_TREND.map((r) => ({
      label: r.label,
      emoglobina: r.emoglobina,
      ferritina: r.ferritina,
      vit_d: r.vit_d,
      b12: r.b12,
      glicemia: r.glicemia,
    }));
  }, [bloodRowsChronological]);

  /**
   * Sceglie il panel di un dato tipo da cui le card riassuntive devono leggere.
   * Ordinamento deterministico: sample_date DESC → ricchezza payload → created_at DESC.
   */
  const findLatestUsefulPanel = useCallback(
    (matcher: (p: HealthPanelTimelineRow) => boolean): HealthPanelTimelineRow | undefined => {
      const ofType = panelsNewestFirst.filter(matcher);
      const fieldsCount = (p: HealthPanelTimelineRow): number => {
        const v = (p.values ?? null) as Record<string, unknown> | null;
        if (!v) return 0;
        const flat = Object.keys(v).filter(
          (k) => k !== "import" && k !== "vlm_proposals" && k !== "vlm_pending_validation",
        ).length;
        const proposals = v.vlm_proposals;
        const proposalsLen = Array.isArray(proposals) ? proposals.length : 0;
        return flat + proposalsLen;
      };
      const ranked = ofType
        .filter((p) => fieldsCount(p) > 0)
        .sort((a, b) => {
          const da = a.sample_date ?? "";
          const db = b.sample_date ?? "";
          if (da !== db) return db.localeCompare(da);
          const fa = fieldsCount(a);
          const fb = fieldsCount(b);
          if (fa !== fb) return fb - fa;
          return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        });
      return ranked[0] ?? ofType[0];
    },
    [panelsNewestFirst],
  );

  const newestBloodPanel = useMemo(() => findLatestUsefulPanel((p) => p.type === "blood"), [findLatestUsefulPanel]);

  const bloodLatestStructuredRow = useMemo(() => {
    return newestBloodPanel ? rowFromBloodPanel(newestBloodPanel) : null;
  }, [newestBloodPanel]);

  /** Referti ematici in ordine cronologico (vecchio → nuovo): colonne tabella comparativa. */
  const bloodComparisonCols = useMemo<BloodMatrixColumn[]>(() => {
    return [...panelsNewestFirst]
      .filter((p) => p.type === "blood")
      .map((p) => {
        const row = rowFromBloodPanel(p);
        if (!row) return null;
        const label = p.sample_date ?? p.reported_at?.slice(0, 10) ?? p.created_at?.slice(0, 10) ?? row.label;
        return { id: p.id, label, row, source: p.source ?? null };
      })
      .filter((c): c is BloodMatrixColumn => c != null)
      .reverse();
  }, [panelsNewestFirst]);

  const microComparisonCols = useMemo<MicroMatrixColumn[] | null>(() => {
    const cols = [...panelsNewestFirst]
      .filter((p) => p.type === "microbiota")
      .map((p) => ({
        id: p.id,
        label: p.sample_date ?? p.reported_at?.slice(0, 10) ?? p.created_at?.slice(0, 10) ?? "—",
        v: (p.values ?? null) as Record<string, unknown> | null,
      }))
      .reverse();
    return cols.length ? cols : null;
  }, [panelsNewestFirst]);

  const usingDemoTrend = useMemo(() => {
    const nReal = panels
      .filter((p) => p.type === "blood")
      .map(rowFromBloodPanel)
      .filter((r): r is NonNullable<typeof r> => r != null).length;
    return SHOW_HEALTH_DEMO_FALLBACK_DATA && nReal < 1;
  }, [panels]);

  const latestPanelsByTypeForRaw = useMemo(() => {
    const seen = new Set<string>();
    const out: HealthPanelTimelineRow[] = [];
    for (const p of panelsNewestFirst) {
      if (seen.has(p.type)) continue;
      seen.add(p.type);
      if (structuredValuesFieldCount(p.values as Record<string, unknown> | null) > 0) out.push(p);
    }
    return out;
  }, [panelsNewestFirst]);

  const latestInflammation = useMemo(
    () => findLatestUsefulPanel((p) => p.type === "inflammation"),
    [findLatestUsefulPanel],
  );
  const latestMicrobiota = useMemo(() => findLatestUsefulPanel((p) => p.type === "microbiota"), [findLatestUsefulPanel]);
  const latestHormones = useMemo(() => findLatestUsefulPanel((p) => isHormonePanelType(p.type)), [findLatestUsefulPanel]);
  const latestEpigenetics = useMemo(() => findLatestUsefulPanel((p) => p.type === "epigenetics"), [findLatestUsefulPanel]);
  const latestOxidative = useMemo(() => findLatestUsefulPanel((p) => p.type === "oxidative_stress"), [findLatestUsefulPanel]);

  const inflammationRadar = useMemo(() => inflammationRadarFromPanel(latestInflammation), [latestInflammation]);
  const microbiotaRadar = useMemo(() => microbiotaRadarFromPanel(latestMicrobiota), [latestMicrobiota]);
  const hormonesBar = useMemo(() => hormonesBarFromPanel(latestHormones), [latestHormones]);
  const epigeneticRings = useMemo(() => epigeneticRingsFromPanel(latestEpigenetics), [latestEpigenetics]);
  const epigeneticRadar = useMemo(() => epigeneticRadarFromPanel(latestEpigenetics), [latestEpigenetics]);
  const epigeneticTrend = useMemo(() => {
    const fromDb = panels
      .filter((p) => p.type === "epigenetics")
      .map(rowFromEpigeneticTrendPanel)
      .filter((r): r is NonNullable<typeof r> => r != null)
      .reverse();
    if (fromDb.length >= 1) return { rows: fromDb, isDemo: false as const };
    if (SHOW_HEALTH_DEMO_FALLBACK_DATA) return { rows: DEMO_EPIGENETIC_TREND, isDemo: true as const };
    return { rows: fromDb, isDemo: false as const };
  }, [panels]);
  const oxidativeRadar = useMemo(() => oxidativeStressRadarFromPanel(latestOxidative), [latestOxidative]);
  const endocrineRadar = useMemo(() => endocrineRadarFromPanel(latestHormones), [latestHormones]);

  const globalScores = useMemo(() => {
    const blood = findLatestUsefulPanel((p) => p.type === "blood");
    const micro = findLatestUsefulPanel((p) => p.type === "microbiota");
    const epi = findLatestUsefulPanel((p) => p.type === "epigenetics");
    const pick = (row: HealthPanelTimelineRow | undefined, keys: string[], demoFallback: number): number | null => {
      const n = readNum((row?.values as Record<string, unknown>) ?? null, keys);
      if (n != null) return Math.round(Math.min(100, Math.max(0, n)));
      return SHOW_HEALTH_DEMO_FALLBACK_DATA ? demoFallback : null;
    };
    return {
      ematici: pick(blood, ["health_score_ematici", "score_ematici"], 92),
      microbiota: pick(micro, ["health_score_microbiota", "score_microbiota", "diversity_score"], 88),
      epigenetica: pick(epi, ["health_score_epigenetica", "score_epigenetica"], 85),
      totale: pick(blood, ["health_score_totale", "score_totale"], 90),
    };
  }, [findLatestUsefulPanel]);

  const onPickFile = useCallback(
    async (panelType: string, file: File | null) => {
      if (!file || !athleteId) return;
      setUploadBusy(panelType);
      setToast(null);
      const res = await uploadHealthDocument({ athleteId, panelType, sampleDate, file });
      setUploadBusy(null);
      if (!res.ok) {
        setToast(res.error ?? t("uploadError"));
        return;
      }
      setToast(res.message ?? t("uploadRecorded"));
      void loadTimeline();
      /** Fase B: se l'AI ha proposto valori, instradiamo subito alla review per la conferma
       *  (in scope coach resta dentro la scheda atleta: /athletes/[id]/health/staging/[runId]). */
      if (res.reviewUrl) {
        const url = scopedReviewUrl(res.reviewUrl as string, { athleteId, adminScoped, platformAdminView, scopeOwnerUserId });
        setTimeout(() => {
          window.location.assign(url);
        }, 600);
      }
    },
    [athleteId, sampleDate, loadTimeline, adminScoped, platformAdminView, scopeOwnerUserId, t],
  );

  const onPatchStagingRun = useCallback(
    async (runId: string, status: HealthStagingRunAction) => {
      if (!runId) return;
      setStagingBusy(`${runId}:${status}`);
      setToast(null);
      const res = await patchHealthStagingRun({
        runId,
        status,
        reason:
          status === "committed"
            ? "Validato da Health System Map"
            : status === "rejected"
              ? "Scartato da Health System Map"
              : "Archiviato da Health System Map",
      });
      setStagingBusy(null);
      if (!res.ok) {
        setToast(res.error ?? t("stagingUpdateFailed"));
        return;
      }
      setToast(
        status === "committed" ? t("stagingValidated") : status === "rejected" ? t("stagingRejected") : t("stagingArchived"),
      );
      void loadTimeline();
      void loadSystemMap();
    },
    [loadTimeline, loadSystemMap, t],
  );

  if (ctxLoading) {
    return (
      <div className="min-h-[40vh] px-6 py-16 text-center text-sm text-gray-500">{t("loadingAthleteContext")}</div>
    );
  }

  if (!athleteId) {
    return (
      <Pro2ModulePageShell
        eyebrow={t("eyebrow")}
        eyebrowClassName={moduleEyebrowClass("health")}
        title={t("pageTitle")}
        description={t("selectActiveAthlete")}
      >
        <p className="text-sm text-amber-200/90">{t("noActiveAthlete")}</p>
      </Pro2ModulePageShell>
    );
  }

  const tabItems: ModulePillAnchorItem[] = [
    { key: "aree", anchor: "aree", label: t("tabDetailedAnalysis"), icon: Microscope, style: MODULE_PILL_ROSE },
    { key: "stato", anchor: "stato", label: t("tabHealthStatus"), icon: HeartPulse, style: MODULE_PILL_ROSE },
    { key: "dettagli", anchor: "dettagli", label: t("tabEngineDetails"), icon: Wrench, style: MODULE_PILL_ROSE },
  ];
  const hasMatrici = bloodComparisonCols.length > 0 || Boolean(microComparisonCols);

  return (
    <Pro2ModulePageShell
      eyebrow={t("eyebrow")}
      eyebrowClassName={moduleEyebrowClass("health")}
      title={t("pageTitle")}
      description={t("pageDescription")}
    >
      {/* Tab di navigazione: una sola sezione montata alla volta */}
      <div className="sticky top-0 z-30 -mx-1 border-b border-white/10 bg-slate-950/90 px-1 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-slate-950/80">
        <ModulePillSubnav
          variant="anchor"
          items={tabItems}
          activeAnchor={activeTab}
          onSelect={(tab) => setActiveTab(tab as HealthTabId)}
          ariaLabel={t("sectionsAriaLabel")}
        />
      </div>

      {/* STATO DI SALUTE — sintesi + valori puntuali, poi Carica esame (con Trend nel tempo in fondo) */}
      {activeTab === "stato" ? (
        <div className="space-y-6">
          <HealthScoreSummary scores={globalScores} />
          <HealthLatestPanelsSection
            bloodRow={bloodLatestStructuredRow}
            newestBloodPanel={newestBloodPanel}
            latestPanelsByTypeForRaw={latestPanelsByTypeForRaw}
            showTech={showTech}
          />

          {/* CARICA ESAME — spostato in fondo a «Stato di salute» */}
          <div className="space-y-6">
            {/* Carica esame: solo l'atleta carica i propri referti; al coach/admin resta solo lo storico. */}
            {role === "private" ? (
              <>
                <HealthImportSection
                  sampleDate={sampleDate}
                  onSampleDateChange={setSampleDate}
                  onPickFile={onPickFile}
                  uploadBusy={uploadBusy}
                  loadingTimeline={loadingTimeline}
                  timelineErr={timelineErr}
                />
                {toast ? (
                  <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-center text-sm text-emerald-300">
                    {toast}
                  </p>
                ) : null}
              </>
            ) : null}

            {/* TREND NEL TEMPO — in fondo al blocco Carica esame */}
            <section id="health-storico" className="scroll-mt-20 sm:scroll-mt-28">
              <div className="mb-4 flex items-center justify-center gap-2">
                <Activity className="h-4 w-4 text-rose-400" />
                <h2 className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-400">
                  {t("bloodTestHistory")}
                </h2>
              </div>
              <HealthBloodTrendSection
                data={bloodLineChartData}
                realPointCount={bloodRowsChronological.length}
                usingDemoTrend={usingDemoTrend}
                hasLatestStructuredRow={Boolean(bloodLatestStructuredRow)}
              />
            </section>
          </div>
        </div>
      ) : null}

      {/* ANALISI DETTAGLIATA — aree + matrici longitudinali (tab di default) */}
      {activeTab === "aree" ? (
        <div className="space-y-6">
          <HealthAreaCharts
            epigeneticRings={epigeneticRings}
            epigeneticRadar={epigeneticRadar}
            epigeneticTrend={epigeneticTrend}
            hasEpigeneticPanel={Boolean(latestEpigenetics)}
            endocrineRadar={endocrineRadar}
            hormonesBar={hormonesBar}
            hasHormonesPanel={Boolean(latestHormones)}
            oxidativeRadar={oxidativeRadar}
            hasOxidativePanel={Boolean(latestOxidative)}
            inflammationRadar={inflammationRadar}
            hasInflammationPanel={Boolean(latestInflammation)}
            microbiotaRadar={microbiotaRadar}
            hasMicrobiotaPanel={Boolean(latestMicrobiota)}
          />
          {hasMatrici ? (
            <div className="space-y-3">
              <h2 className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-400">
                {t("longitudinalMatrices")}
              </h2>
              <HealthLongitudinalTables bloodCols={bloodComparisonCols} microCols={microComparisonCols} />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* DETTAGLI E MOTORE — metodologia + diagnostica (solo coach/admin) */}
      {activeTab === "dettagli" ? (
        <div className="space-y-6">
          <div className="space-y-3 text-sm leading-relaxed text-gray-400">
            <p>{t("methodologyParagraph1")}</p>
            <p>{t("methodologyParagraph2")}</p>
            <p>{t("methodologyParagraph3")}</p>
          </div>

          {showTech ? (
            <div className="space-y-6">
              <HealthSystemMapPanel
                systemMap={systemMap}
                systemMapErr={systemMapErr}
                stagingBusy={stagingBusy}
                onPatchStagingRun={onPatchStagingRun}
              />
              <HealthArchiveSection
                panels={panels}
                athleteId={athleteId}
                loadingTimeline={loadingTimeline}
                timelineErr={timelineErr}
                timelineDiag={timelineDiag}
                archiveDiagnostics={archiveDiagnostics}
                pendingVlmRunByPanelId={pendingVlmRunByPanelId}
                expandedPanelId={expandedPanelId}
                onToggleExpanded={setExpandedPanelId}
                onReloadTimeline={loadTimeline}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </Pro2ModulePageShell>
  );
}
