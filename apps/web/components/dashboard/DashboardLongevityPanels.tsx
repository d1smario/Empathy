"use client";

/**
 * Pannello «Indice Longevità & Fitness» (EPI) montato in «Analisi» (dashboard
 * desktop/mobile e scope coach/admin). Self-contained: fetch dell'indice EPI e
 * cache cross-mount. La card «Check-in di oggi» è stata spostata nella vista
 * Oggi (DailyCheckinCard); il POST del check-in continua ad alimentare il
 * pilastro subjective_wellness di questo indice lato server.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { HeartPulse } from "lucide-react";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import {
  type DailyCheckin,
  type EpiPillarId,
  type EpiResult,
} from "@/lib/empathy/schemas";

type LongevityFitnessPayload = {
  epi: EpiResult;
  checkin: DailyCheckin | null;
  snapshotDate: string;
};

// I PILLAR_LABELS sono stringhe visibili: le chiavi i18n vengono risolte a runtime
// dentro il componente, così restano localizzate.
const PILLAR_LABEL_KEYS: Record<EpiPillarId, string> = {
  activity_load: "pillarActivityLoad",
  recovery: "pillarRecovery",
  hrv: "pillarHrv",
  sleep: "pillarSleep",
  nutrition: "pillarNutrition",
  body_composition: "pillarBodyComposition",
  protocol_adherence: "pillarProtocolAdherence",
  subjective_wellness: "pillarSubjectiveWellness",
};

// Cache cross-mount dell'indice longevità: ri-atterrando sui pannelli i dati
// compaiono subito (niente spinner "Calcolo in corso…"); il refetch avviene in
// background silenzioso, così i nuovi check-in salvati restano comunque riflessi.
// La chiave include adminScoped perché la scheda admin non persiste lo snapshot
// (persist=false): non mescoliamo mai dati di scope/atleti diversi.
const LONGEVITY_SS_PREFIX = "longevity-index:";
const longevityIndexCache = new Map<string, LongevityFitnessPayload>();
function longevityCacheKey(id: string, adminScoped: boolean): string {
  return `${id}::${adminScoped ? "admin" : "self"}`;
}
function readLongevityCache(key: string): LongevityFitnessPayload | null {
  const mem = longevityIndexCache.get(key);
  if (mem) return mem;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LONGEVITY_SS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LongevityFitnessPayload;
    if (parsed) {
      longevityIndexCache.set(key, parsed);
      return parsed;
    }
  } catch {
    // sessionStorage non disponibile / JSON corrotto: ignora.
  }
  return null;
}
function writeLongevityCache(key: string, payload: LongevityFitnessPayload): void {
  longevityIndexCache.set(key, payload);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(LONGEVITY_SS_PREFIX + key, JSON.stringify(payload));
  } catch {
    // quota/serializzazione: la cache in-memory basta comunque.
  }
}

function formatSnapshotDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });
}

export function DashboardLongevityPanels() {
  const t = useTranslations("DashboardLongevityPanels");
  const { athleteId, adminScoped, role } = useActiveAthlete();
  const showTech = role === "coach" || adminScoped;
  const [data, setData] = useState<LongevityFitnessPayload | null>(() =>
    athleteId ? readLongevityCache(longevityCacheKey(athleteId, adminScoped)) : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadIndex = useCallback(
    async (id: string) => {
      const cacheKey = longevityCacheKey(id, adminScoped);
      // Se i dati di questa stessa chiave sono già in cache, mostrali SUBITO
      // (niente spinner "Calcolo in corso…"); il refetch in background sotto
      // aggiorna comunque stato+cache, così i nuovi check-in restano riflessi.
      const cached = readLongevityCache(cacheKey);
      if (cached) {
        setData(cached);
        setError(null);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        // In scheda admin niente persistenza snapshot/coin: la sola apertura non muta lo storico
        const persistParam = adminScoped ? "&persist=false" : "";
        const res = await fetch(`/api/longevity/index?athleteId=${encodeURIComponent(id)}${persistParam}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as LongevityFitnessPayload & { error?: string };
        if (!res.ok) throw new Error(json.error ?? t("loadingError"));
        setData(json);
        writeLongevityCache(cacheKey, json);
      } catch (err) {
        // Con cache già mostrata teniamo i dati validi a schermo: il banner
        // d'errore avviserebbe a vuoto su un refresh di sfondo fallito.
        if (!cached) setError(err instanceof Error ? err.message : t("loadingError"));
      } finally {
        setLoading(false);
      }
    },
    [adminScoped, t],
  );

  useEffect(() => {
    if (athleteId) void loadIndex(athleteId);
  }, [athleteId, loadIndex]);

  const epi = data?.epi ?? null;

  const pillars = useMemo(() => (epi?.pillars ?? []).filter((p) => p.available), [epi]);

  return (
    <div className="space-y-10">
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      {/* La card «Check-in di oggi» è stata spostata nella vista Oggi (DailyCheckinCard):
          il check-in è un'azione mattutina, non un pannello di analisi. Qui resta solo
          l'indice EPI, che il POST del check-in continua ad alimentare lato server. */}
      <Pro2SectionCard accent="fuchsia" title={t("indexTitle")} subtitle={t("indexSubtitle")} icon={HeartPulse}>
        {loading && !epi ? (
          <p className="text-sm text-gray-400">{t("calculating")}</p>
        ) : epi && (epi.dataTier === "standard" || epi.dataTier === "extended") ? (
          <div className="space-y-5">
            {data?.snapshotDate ? (
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
                {t("todayPrefix", { date: formatSnapshotDate(data.snapshotDate) })}
              </p>
            ) : null}

            <div className="flex flex-wrap items-end gap-x-4 gap-y-2 sm:gap-x-6">
              <div>
                <span className="font-mono text-3xl font-black tabular-nums tracking-tight text-white sm:text-4xl">
                  {Math.round(epi.score)}
                </span>
                <span className="ml-1 text-xs font-medium text-gray-500">/100</span>
              </div>
              <div className="text-xs text-gray-400">
                {showTech ? (
                  <p>{t("confidenceCoverage", { confidence: Math.round(epi.confidence * 100), coverage: epi.dataTier })}</p>
                ) : null}
                <p className="mt-1">
                  {epi.efficientDay ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-emerald-300">
                      {t("efficientDay")}
                    </span>
                  ) : epi.illnessDay ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-amber-300">
                      {t("symptomDay")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gray-300">
                      {t("notEfficientDayYet")}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {epi.illnessDay ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                {t("illnessBanner")}
              </div>
            ) : null}

            <div className="space-y-2.5">
              {pillars.map((p) => (
                <div key={p.pillar} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs text-gray-400 sm:w-44">{t(PILLAR_LABEL_KEYS[p.pillar])}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 to-fuchsia-400"
                      style={{ width: `${Math.round(p.score ?? 0)}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-white">
                    {Math.round(p.score ?? 0)}
                  </span>
                </div>
              ))}
              {!pillars.length ? (
                <p className="text-xs text-gray-500">
                  {t("noSignal")}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-gray-300">{t("indexNotAvailable")}</p>
            <p className="text-xs text-gray-500">
              {t("indexNotAvailableHint")}
            </p>
          </div>
        )}
      </Pro2SectionCard>
    </div>
  );
}
