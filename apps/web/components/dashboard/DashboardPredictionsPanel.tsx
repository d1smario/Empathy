"use client";

/**
 * Pannello «Previsioni» della dashboard (2026-07): consolida il livello
 * readiness/near-term oggi frammentato tra analytics, strip e Virya.
 * Dati: adaptation loop + prontezza mitocondriale da /api/training/analytics
 * (nessun side-effect; virya-context persisterebbe research traces), con
 * cache SWR di sessione. Le previsioni operative restano nelle loro pagine:
 * qui solo lo stato sintetico e i rimandi all'azione.
 */

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Activity, CalendarRange, ChevronRight, Flame, UtensilsCrossed } from "lucide-react";
import type {
  TrainingAdaptationLoopViewModel,
  TrainingBioenergeticModulationViewModel,
} from "@/api/training/contracts";
import { fetchTrainingAnalyticsRows } from "@/modules/training/services/training-analytics-api";
import { readSwrCache, writeSwrCache } from "@/lib/client-swr-cache";
import { useActiveAthlete } from "@/lib/use-active-athlete";

type PredictionsSlice = {
  adaptationLoop: TrainingAdaptationLoopViewModel | null;
  bioenergeticModulation: TrainingBioenergeticModulationViewModel | null;
};

function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const LOOP_TONE: Record<TrainingAdaptationLoopViewModel["status"], string> = {
  aligned: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  watch: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  regenerate: "border-rose-500/40 bg-rose-500/10 text-rose-200",
};

const MITO_TONE: Record<TrainingBioenergeticModulationViewModel["state"], string> = {
  supported: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  watch: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  protective: "border-rose-500/40 bg-rose-500/10 text-rose-200",
};

function ActionLink({
  href,
  icon,
  label,
  sub,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 transition-colors hover:border-purple-500/40 hover:bg-purple-500/10"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-purple-300">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-gray-100">{label}</span>
        <span className="block truncate text-[0.7rem] text-gray-500">{sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-600 transition-colors group-hover:text-purple-300" aria-hidden />
    </Link>
  );
}

export function DashboardPredictionsPanel() {
  const t = useTranslations("DashboardPredictionsPanel");
  const { athleteId } = useActiveAthlete();
  const [slice, setSlice] = useState<PredictionsSlice | null>(() =>
    athleteId ? (readSwrCache<PredictionsSlice>(`dash-predictions:${athleteId}`) ?? null) : null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!athleteId) {
      setSlice(null);
      setLoading(false);
      return;
    }
    let active = true;
    const cacheKey = `dash-predictions:${athleteId}`;
    const cached = readSwrCache<PredictionsSlice>(cacheKey);
    if (cached) {
      setSlice(cached);
      setLoading(false);
    }
    const to = localIsoDate(new Date());
    const from = localIsoDate(new Date(Date.now() - 28 * 86_400_000));
    void fetchTrainingAnalyticsRows({ athleteId, from, to })
      .then((vm) => {
        if (!active) return;
        const next: PredictionsSlice = {
          adaptationLoop: vm.adaptationLoop ?? null,
          bioenergeticModulation: vm.bioenergeticModulation ?? null,
        };
        setSlice(next);
        writeSwrCache(cacheKey, next);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [athleteId]);

  const loop = slice?.adaptationLoop ?? null;
  const mito = slice?.bioenergeticModulation ?? null;

  const loopStatusLabel = loop
    ? loop.status === "aligned"
      ? t("statusAligned")
      : loop.status === "watch"
        ? t("statusWatch")
        : t("statusRegenerate")
    : null;
  const loopActionLabel = loop
    ? loop.nextAction === "keep_course"
      ? t("actionKeepCourse")
      : loop.nextAction === "retune_next_sessions"
        ? t("actionRetune")
        : t("actionRegenerate")
    : null;
  const mitoStateLabel = mito
    ? mito.state === "supported"
      ? t("mitoSupported")
      : mito.state === "watch"
        ? t("mitoWatch")
        : t("mitoProtective")
    : null;

  return (
    <section aria-label={t("sectionLabel")}>
      <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("kicker")}</p>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Adattamento: stato del loop piano↔risposta e mossa consigliata. */}
        <article className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="m-0 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-gray-500">{t("adaptationTitle")}</p>
          {loading && !slice ? (
            <p className="m-0 mt-3 text-sm text-gray-500">{t("loadingLabel")}</p>
          ) : loop ? (
            <>
              <span
                className={`mt-3 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${LOOP_TONE[loop.status]}`}
              >
                {loopStatusLabel}
              </span>
              <p className="m-0 mt-2 text-sm font-semibold leading-snug text-gray-100">{loopActionLabel}</p>
              <p className="m-0 mt-2 text-[0.75rem] leading-relaxed text-gray-400">
                {t("compliance7d", { pct: Math.round(loop.executionCompliancePct) })}
              </p>
              {loop.lowExecutionEvidence ? (
                <p className="m-0 mt-2 text-[0.72rem] leading-relaxed text-amber-200/85">{t("lowEvidence")}</p>
              ) : null}
            </>
          ) : (
            <p className="m-0 mt-3 text-sm leading-relaxed text-gray-500">{t("noLoopData")}</p>
          )}
        </article>

        {/* Prontezza mitocondriale: scala automaticamente le prossime sedute. */}
        <article className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="m-0 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-gray-500">{t("mitoTitle")}</p>
          {loading && !slice ? (
            <p className="m-0 mt-3 text-sm text-gray-500">{t("loadingLabel")}</p>
          ) : mito ? (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black tabular-nums text-gray-50">
                  {Math.round(mito.mitochondrialReadinessScore)}
                </span>
                <span className="text-xs text-gray-500">/100</span>
                <span
                  className={`ml-auto inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${MITO_TONE[mito.state]}`}
                >
                  {mitoStateLabel}
                </span>
              </div>
              {/* Niente headline del motore (stringa tecnica non localizzata):
                  qui parla solo l'effetto concreto sul carico. */}
              <p className="m-0 mt-2 text-sm font-semibold leading-snug text-gray-100">
                {mito.loadScalePct !== 100
                  ? t("loadScaleNote", { pct: Math.round(mito.loadScalePct) })
                  : t("loadScaleFull")}
              </p>
            </>
          ) : (
            <p className="m-0 mt-3 text-sm leading-relaxed text-gray-500">{t("noMitoData")}</p>
          )}
        </article>

        {/* Le previsioni operative vivono dove sta l'azione: solo rimandi. */}
        <article className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="m-0 mb-3 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-gray-500">{t("linksTitle")}</p>
          <div className="space-y-2">
            <ActionLink
              href="/training/builder"
              icon={<Activity className="h-4 w-4" aria-hidden />}
              label={t("linkBuilder")}
              sub={t("linkBuilderSub")}
            />
            <ActionLink
              href="/training/vyria"
              icon={<CalendarRange className="h-4 w-4" aria-hidden />}
              label={t("linkVirya")}
              sub={t("linkViryaSub")}
            />
            <ActionLink
              href="/nutrition"
              icon={<UtensilsCrossed className="h-4 w-4" aria-hidden />}
              label={t("linkNutrition")}
              sub={t("linkNutritionSub")}
            />
          </div>
          <p className="m-0 mt-3 flex items-center gap-1.5 text-[0.68rem] text-gray-600">
            <Flame className="h-3 w-3" aria-hidden />
            {t("footnote")}
          </p>
        </article>
      </div>
    </section>
  );
}
