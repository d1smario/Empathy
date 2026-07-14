"use client";

import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type { ResearchPlan } from "@/lib/empathy/schemas/research";
import { Brain, CalendarRange, FlaskConical, LineChart, ScrollText, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { BuilderScopeTabs } from "@/components/training/BuilderScopeTabs";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Button } from "@/components/ui/empathy";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { fetchTrainingPlannerContext, persistTrainingResearchPlans } from "@/modules/training/services/training-virya-api";

// Lazy-load: l'orchestrator (+ libraries.ts ~48KB + 20 sezioni + kit) è il chunk
// più pesante della route; differirlo alleggerisce il bundle iniziale della pagina.
const ViryaAnnualPlanOrchestrator = dynamic(
  () => import("@/modules/training/components/ViryaAnnualPlanOrchestrator").then((m) => m.ViryaAnnualPlanOrchestrator),
  {
    ssr: false,
    loading: () => <div className="py-12 text-center text-sm text-gray-500">Loading annual planner…</div>,
  },
);

function planTriggerLine(p: ResearchPlan): string {
  const t = p.trigger;
  const bits: string[] = [t.kind];
  if (t.stimulusLabel) bits.push(t.stimulusLabel);
  if (t.entityLabel) bits.push(t.entityLabel);
  if (t.adaptationTarget) bits.push(String(t.adaptationTarget));
  return bits.join(" · ");
}

function traceStatusClass(status: KnowledgeResearchTraceSummary["status"]): string {
  switch (status) {
    case "complete":
      return "text-emerald-300";
    case "running":
      return "text-sky-300";
    case "ready":
      return "text-amber-200";
    default:
      return "text-slate-400";
  }
}

// Cache cross-mount del contesto planner Virya: ri-atterrando sulla pagina i dati
// compaiono subito (niente spinner/"refresh"); l'aggiornamento avviene in background
// silenzioso, così le mutazioni (es. persistenza trace) restano riflesse al prossimo fetch.
let viryaContextCacheId: string | null = null;
let viryaContextCache: Awaited<ReturnType<typeof fetchTrainingPlannerContext>> | null = null;

/**
 * Virya (V1 parity, shell Pro 2): contesto canonico da `resolveAthleteMemory` + hint strategici.
 * La materializzazione sedute resta sul builder (`/api/training/engine/generate`) e sul calendario.
 */
export default function TrainingViryaPageView() {
  const t = useTranslations("TrainingViryaPageView");
  const { athleteId, role, adminScoped, platformAdminView, loading: ctxLoading } = useActiveAthlete();
  const router = useRouter();
  /** «Piano» è uno strumento coach: l'atleta non pianifica la stagione. */
  const isCoachOrAdmin = role === "coach" || adminScoped;
  /**
   * Gergo motore (diagnostica, readSpine, trace, pipeline, readout grezzo): SOLO staff di
   * piattaforma. Il coach vede il «Piano» pulito (wizard + tabelle + grafici + azioni),
   * non il motore — distinto dal vecchio showTech coach-inclusivo.
   */
  const staffOnly = platformAdminView;
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof fetchTrainingPlannerContext>> | null>(null);
  const [persistingTraces, setPersistingTraces] = useState(false);

  const load = useCallback(async () => {
    if (ctxLoading) return;
    if (!athleteId) {
      setCtx(null);
      setErr(t("errNoActiveAthlete"));
      setLoading(false);
      return;
    }
    // Se i dati di questo atleta sono già in cache, mostrali SUBITO (niente
    // spinner/"refresh"); il refetch sotto aggiorna comunque stato+cache in background.
    const cached = viryaContextCacheId === athleteId ? viryaContextCache : null;
    if (cached) {
      setCtx(cached);
      setErr(cached.error ?? null);
      setLoading(false);
    } else {
      setLoading(true);
      setErr(null);
    }
    try {
      const vm = await fetchTrainingPlannerContext(athleteId, { persistResearchTraces: true });
      if (vm.error) {
        setErr(vm.error);
      } else {
        setErr(null);
      }
      setCtx(vm);
      viryaContextCache = vm;
      viryaContextCacheId = athleteId;
    } catch (e) {
      if (!cached) {
        setErr(e instanceof Error ? e.message : t("errLoadContext"));
        setCtx(null);
      }
    } finally {
      setLoading(false);
    }
  }, [athleteId, ctxLoading, t]);

  const handlePersistResearchTraces = useCallback(async () => {
    if (!ctx?.researchPlans?.length) return;
    setPersistingTraces(true);
    setErr(null);
    try {
      const res = await persistTrainingResearchPlans(ctx.researchPlans);
      if (!res.ok) {
        setErr(res.error ?? t("errPersistTraces"));
      } else {
        await load();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("errPersistTraces"));
    } finally {
      setPersistingTraces(false);
    }
  }, [ctx?.researchPlans, load, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // «Piano» è coach/admin. L'atleta che ci arriva via URL torna al Calendario
  // (parità col vecchio redirect, ma ora la rotta è viva per lo staff tecnico).
  useEffect(() => {
    if (!ctxLoading && !isCoachOrAdmin) router.replace("/training/calendar");
  }, [ctxLoading, isCoachOrAdmin, router]);

  const phys = ctx?.physiology as Record<string, unknown> | null | undefined;
  const ftp = phys && typeof phys.ftp_watts === "number" ? phys.ftp_watts : null;

  const flagsList = useMemo(() => {
    if (!ctx?.flags) return [];
    return Object.entries(ctx.flags).filter(([, v]) => v === true);
  }, [ctx?.flags]);

  // Atleta su rotta coach: non mostrare lo strumento mentre parte il redirect (niente flash).
  if (!ctxLoading && !isCoachOrAdmin) return null;

  return (
    <Pro2ModulePageShell
      eyebrow="Training · Piano"
      eyebrowClassName="text-violet-400"
      title={t("shellTitle")}
      description={t("shellDescription")}
    >
      <div className="scroll-mt-28">
        <TrainingSubnav />
      </div>

      <BuilderScopeTabs active="piano" />

      {staffOnly && ctx?.readSpineCoverage && !err ? (
        <details className="mb-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-300">
          <summary className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-wider text-violet-300/90">
            {t("readSpineSummary", { spineScore: ctx.readSpineCoverage.spineScore })}
          </summary>
          <p className="mt-2 text-xs text-slate-500">
            {t("readSpineBody")}
          </p>
        </details>
      ) : null}

      {err ? (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="alert">
          {err}
        </p>
      ) : null}

      {athleteId ? (
        <ViryaAnnualPlanOrchestrator
          athleteId={athleteId}
          viryaContext={ctx}
          contextLoading={loading || ctxLoading}
          staffView={staffOnly}
        />
      ) : null}

      {staffOnly && (loading || ctxLoading) ? (
        <div className="mb-6 space-y-2">
          <div className="h-3 w-full max-w-xl animate-pulse rounded-lg bg-violet-500/15" />
          <div className="h-40 w-full animate-pulse rounded-2xl bg-white/5" />
        </div>
      ) : null}

      {staffOnly && !loading && !ctxLoading && ctx ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Pro2SectionCard accent="violet" title={t("physiologyTitle")} subtitle={t("physiologySubtitle")} icon={Sparkles}>
            <dl className="grid gap-2 text-sm text-slate-300">
              <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                <dt className="text-slate-500">FTP</dt>
                <dd className="font-mono tabular-nums text-white">{ftp != null ? `${Math.round(ftp)} W` : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                <dt className="text-slate-500">{t("connectedModules")}</dt>
                <dd className="text-right text-xs text-slate-400">
                  {t("connectedModulesLine", {
                    profile: ctx.connectedModules?.profile ? t("yes") : t("no"),
                    physiology: ctx.connectedModules?.physiology ? t("yes") : t("no"),
                    health: ctx.connectedModules?.health ? t("yes") : t("no"),
                    twin: ctx.twinState ? t("yes") : t("no"),
                  })}
                </dd>
              </div>
              {!ctx.twinState ? (
                <p className="text-xs text-amber-200/80">
                  {t("twinNotAvailable")}
                </p>
              ) : null}
              {ctx.operationalContext ? (
                <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-400">
                  <p className="font-semibold text-violet-200/90">{t("dayOperationalContext")}</p>
                  <p className="mt-1">{ctx.operationalContext.headline}</p>
                  <p className="mt-1 opacity-90">{ctx.operationalContext.guidance}</p>
                  <p className="mt-2 font-mono text-[0.65rem] text-slate-500">
                    {t("loadScaleModeLine", {
                      loadScale: Math.round(ctx.operationalContext.loadScalePct),
                      mode: ctx.operationalContext.mode,
                    })}
                  </p>
                </div>
              ) : null}
            </dl>
          </Pro2SectionCard>

          <Pro2SectionCard accent="amber" title={t("strategyTitle")} subtitle={t("strategySubtitle")} icon={Brain}>
            <div className="flex flex-wrap gap-2">
              {(ctx.strategyHints ?? []).map((h) => (
                <span
                  key={h}
                  className="rounded-full border border-amber-400/35 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-100"
                >
                  {h}
                </span>
              ))}
            </div>
            {staffOnly ? (
              flagsList.length ? (
                <div className="mt-4">
                  <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">{t("activeFlags")}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-rose-200/90">
                    {flagsList.map(([k]) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500">{t("noActiveConstraintFlag")}</p>
              )
            ) : null}
          </Pro2SectionCard>

          {ctx.adaptationLoop ? (
            <Pro2SectionCard accent="cyan" title={t("adaptationTitle")} subtitle={t("adaptationSubtitle")} icon={LineChart}>
              <dl className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between">
                  <dt className="text-slate-500">{t("status")}</dt>
                  <dd className="font-semibold text-cyan-100">{ctx.adaptationLoop.status}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">{t("compliance")}</dt>
                  <dd className="font-mono">{ctx.adaptationLoop.executionCompliancePct.toFixed(0)}%</dd>
                </div>
                <p className="text-xs text-slate-500">{ctx.adaptationLoop.guidance}</p>
              </dl>
            </Pro2SectionCard>
          ) : null}

          {ctx.bioenergeticModulation ? (
            <Pro2SectionCard accent="fuchsia" title={t("bioenergeticsTitle")} subtitle={t("bioenergeticsSubtitle")} icon={CalendarRange}>
              <p className="text-sm text-slate-300">{ctx.bioenergeticModulation.headline}</p>
              <p className="mt-2 text-xs text-slate-500">{ctx.bioenergeticModulation.guidance}</p>
              <p className="mt-2 font-mono text-[0.65rem] text-slate-500">
                {t("bioScaleLine", {
                  scale: Math.round(ctx.bioenergeticModulation.loadScalePct),
                  state: ctx.bioenergeticModulation.state,
                })}
              </p>
            </Pro2SectionCard>
          ) : null}

          {ctx.crossModuleDynamicsLines?.length ? (
            <Pro2SectionCard accent="cyan" title={t("crossModuleTitle")} subtitle={t("crossModuleSubtitle")} icon={LineChart}>
              <ul className="list-inside list-disc space-y-1 text-xs leading-relaxed text-slate-400">
                {ctx.crossModuleDynamicsLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </Pro2SectionCard>
          ) : null}

          {ctx.knowledgeModulation ? (
            <Pro2SectionCard accent="emerald" title={t("knowledgeTitle")} subtitle={t("knowledgeSubtitle")} icon={ScrollText}>
              <dl className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                  <dt className="text-slate-500">{t("domain")}</dt>
                  <dd className="font-semibold text-emerald-100">{ctx.knowledgeModulation.domain}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                  <dt className="text-slate-500">{t("constraint")}</dt>
                  <dd className="text-right text-xs">{ctx.knowledgeModulation.constraintLevel}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                  <dt className="text-slate-500">{t("confidence")}</dt>
                  <dd className="font-mono tabular-nums">{(ctx.knowledgeModulation.confidence * 100).toFixed(0)}%</dd>
                </div>
                {ctx.knowledgeModulation.reasoningSummary ? (
                  <p className="text-xs leading-relaxed text-slate-400">{ctx.knowledgeModulation.reasoningSummary}</p>
                ) : null}
                {ctx.knowledgeModulation.hardConstraints?.length ? (
                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-rose-300/80">Hard</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-rose-100/80">
                      {ctx.knowledgeModulation.hardConstraints.slice(0, 8).map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </dl>
            </Pro2SectionCard>
          ) : null}

          {staffOnly && (ctx.researchPlans?.length ?? 0) > 0 ? (
            <Pro2SectionCard accent="cyan" title="Research plans (Virya)" subtitle={t("researchPlansSubtitle")} icon={FlaskConical}>
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {(ctx.researchPlans ?? []).map((p) => (
                  <li key={p.planId} className="rounded-xl border border-cyan-500/20 bg-black/35 px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[0.65rem] text-slate-500">{p.planId.slice(0, 10)}…</span>
                      <span className="rounded-full border border-cyan-400/30 px-2 py-0.5 text-[0.65rem] text-cyan-200">
                        {p.status}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-200">{planTriggerLine(p)}</p>
                    <p className="mt-1 text-slate-500">
                      {p.intents.length} intent · {p.hops.length} hop
                    </p>
                  </li>
                ))}
              </ul>
            </Pro2SectionCard>
          ) : null}

          {staffOnly && (ctx.researchPlans?.length ?? 0) > 0 && (ctx.researchTraces?.length ?? 0) === 0 ? (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs text-amber-100/90">
              <p className="mb-2">
                {t.rich("noTraceInResponse", {
                  code: (chunks) => <code className="rounded bg-black/40 px-1">{chunks}</code>,
                })}
              </p>
              <Pro2Button type="button" variant="secondary" disabled={persistingTraces} onClick={() => void handlePersistResearchTraces()}>
                {persistingTraces ? t("syncing") : t("syncTraces")}
              </Pro2Button>
            </div>
          ) : null}

          {staffOnly && (ctx.researchTraces?.length ?? 0) > 0 ? (
            <Pro2SectionCard accent="orange" title={t("savedTracesTitle")} subtitle={t("savedTracesSubtitle")} icon={FlaskConical}>
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {(ctx.researchTraces ?? []).map((tr: KnowledgeResearchTraceSummary) => (
                  <li key={tr.traceId} className="rounded-xl border border-orange-500/25 bg-black/35 px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[0.65rem] text-slate-500">{tr.traceId.slice(0, 10)}…</span>
                      <span className={`font-semibold ${traceStatusClass(tr.status)}`}>{tr.status}</span>
                    </div>
                    <p className="mt-1 text-slate-400">
                      {t("hopLine", {
                        complete: tr.hopCounts.complete,
                        total: tr.hopCounts.total,
                        documents: tr.linkCounts.documents,
                        assertions: tr.linkCounts.assertions,
                      })}
                    </p>
                    {tr.latestResultSummary ? (
                      <p className="mt-1 text-slate-300">{tr.latestResultSummary}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Pro2SectionCard>
          ) : null}
        </div>
      ) : null}

      {staffOnly ? (
        <Pro2SectionCard accent="orange" title="Pipeline" subtitle={t("pipelineSubtitle")} icon={Sparkles} className="mt-8">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-400">
            <li>{t("pipelineStep1")}</li>
            <li>{t("pipelineStep2")}</li>
            <li>
              {t.rich("pipelineStep3", {
                c1: () => <code className="text-slate-300">GET …/virya-context?persistResearchTraces=1</code>,
                c2: () => <code className="text-slate-300"> POST /api/knowledge/research-traces</code>,
                c3: () => <code className="text-slate-300">plans[]</code>,
                c4: () => <code className="text-slate-300"> syncResearchTracePlans</code>,
                c5: () => <code className="text-slate-300">lib/knowledge/virya-research-trace-sync.ts</code>,
              })}
            </li>
          </ol>
        </Pro2SectionCard>
      ) : null}
    </Pro2ModulePageShell>
  );
}
