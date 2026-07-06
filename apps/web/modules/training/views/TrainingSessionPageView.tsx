"use client";

import {
  type ExecutedWorkout,
  type PlannedWorkout,
} from "@empathy/domain-training";
import { CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalendarDaySessionDetail } from "@/components/training/CalendarDaySessionDetail";
import { CalendarPlannedBuilderDetail } from "@/components/training/CalendarPlannedBuilderDetail";
import { TrainingPlannedWindowContextStrip } from "@/components/training/TrainingPlannedWindowContextStrip";
import { OperationalDayNavigator } from "@/components/navigation/OperationalDayNavigator";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import type { TrainingPlannedWindowOkViewModel, TrainingTwinContextStripViewModel } from "@/api/training/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import type { ReadSpineCoverageSummary } from "@/lib/platform/read-spine-coverage";
import { useActiveAthlete } from "@/lib/use-active-athlete";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Cache cross-mount della giornata training (chiave athleteId:date): ri-atterrando
// sulla pagina i dati compaiono subito (niente spinner "Caricamento segnali sessione…");
// il refetch gira comunque in background silenzioso, così le esecuzioni/registrazioni
// più recenti restano riflesse senza mostrare lo spinner.
type TrainingSessionPayload = {
  planned: PlannedWorkout[];
  executed: ExecutedWorkout[];
  readSpineCoverage: ReadSpineCoverageSummary | null;
  twinContextStrip: TrainingTwinContextStripViewModel | null;
  plannedProvenanceSummary: Partial<Record<string, number>> | null;
  err: string | null;
};
let trainingSessionCacheKey: string | null = null;
let trainingSessionCache: TrainingSessionPayload | null = null;

type WindowErr = { ok: false; error?: string };

/**
 * Vista giornata: pianificato + eseguito per `date` (stessa API finestra calendario, `from`=`to`=`date`).
 * Completion manuale e patch coach arriveranno con endpoint dedicati Pro 2.
 */
export default function TrainingSessionPageView() {
  const t = useTranslations("TrainingSessionPageView");
  const params = useParams<{ date: string }>();
  const date = typeof params?.date === "string" ? params.date : "";
  const dateValid = ISO_DATE.test(date);

  const { athleteId, role, adminScoped, loading: ctxLoading } = useActiveAthlete();
  // Diagnostica motore (read-spine, twin, provenance) solo per staff: l'atleta non
  // deve mai vedere gergo interno. Vedi regole di visibilità atleta.
  const showTech = role === "coach" || adminScoped;
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [planned, setPlanned] = useState<PlannedWorkout[]>([]);
  const [executed, setExecuted] = useState<ExecutedWorkout[]>([]);
  const [readSpineCoverage, setReadSpineCoverage] = useState<ReadSpineCoverageSummary | null>(null);
  const [twinContextStrip, setTwinContextStrip] = useState<TrainingTwinContextStripViewModel | null>(null);
  const [plannedProvenanceSummary, setPlannedProvenanceSummary] = useState<Partial<Record<string, number>> | null>(null);

  useEffect(() => {
    if (!dateValid) {
      setLoading(false);
      setErr(null);
      setPlanned([]);
      setExecuted([]);
      setReadSpineCoverage(null);
      setTwinContextStrip(null);
      setPlannedProvenanceSummary(null);
      return;
    }
    if (ctxLoading) return;
    if (!athleteId) {
      setLoading(false);
      setPlanned([]);
      setExecuted([]);
      setReadSpineCoverage(null);
      setTwinContextStrip(null);
      setPlannedProvenanceSummary(null);
      setErr(t("noActiveAthlete"));
      return;
    }

    // Se la giornata di questo atleta è già in cache, mostrala SUBITO (niente
    // spinner); il refetch sotto gira comunque in background e aggiorna stato+cache.
    const cacheKey = `${athleteId}:${date}`;
    const cached = trainingSessionCacheKey === cacheKey ? trainingSessionCache : null;
    if (cached) {
      setPlanned(cached.planned);
      setExecuted(cached.executed);
      setReadSpineCoverage(cached.readSpineCoverage);
      setTwinContextStrip(cached.twinContextStrip);
      setPlannedProvenanceSummary(cached.plannedProvenanceSummary);
      setErr(cached.err);
      setLoading(false);
    } else {
      setLoading(true);
      setErr(null);
    }

    let cancelled = false;
    (async () => {
      try {
        const q = new URLSearchParams({ athleteId, from: date, to: date, includeAthleteContext: "0" });
        const res = await fetch(`/api/training/planned-window?${q}`, {
          cache: "no-store",
          headers: await buildSupabaseAuthHeaders(),
        });
        const json = (await res.json()) as TrainingPlannedWindowOkViewModel | WindowErr;
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          const errMsg = ("error" in json && json.error) || t("readFailed");
          setPlanned([]);
          setExecuted([]);
          setReadSpineCoverage(null);
          setTwinContextStrip(null);
          setPlannedProvenanceSummary(null);
          setErr(errMsg);
          trainingSessionCacheKey = cacheKey;
          trainingSessionCache = {
            planned: [],
            executed: [],
            readSpineCoverage: null,
            twinContextStrip: null,
            plannedProvenanceSummary: null,
            err: errMsg,
          };
          return;
        }
        const nextReadSpineCoverage = json.readSpineCoverage ?? null;
        const nextTwinContextStrip = json.twinContextStrip ?? null;
        const nextPlannedProvenanceSummary = json.plannedProvenanceSummary ?? null;
        setPlanned(json.planned);
        setExecuted(json.executed);
        setReadSpineCoverage(nextReadSpineCoverage);
        setTwinContextStrip(nextTwinContextStrip);
        setPlannedProvenanceSummary(nextPlannedProvenanceSummary);
        setErr(null);
        trainingSessionCacheKey = cacheKey;
        trainingSessionCache = {
          planned: json.planned,
          executed: json.executed,
          readSpineCoverage: nextReadSpineCoverage,
          twinContextStrip: nextTwinContextStrip,
          plannedProvenanceSummary: nextPlannedProvenanceSummary,
          err: null,
        };
      } catch {
        if (!cancelled && !cached) {
          setErr(t("networkError"));
          setPlanned([]);
          setExecuted([]);
          setReadSpineCoverage(null);
          setTwinContextStrip(null);
          setPlannedProvenanceSummary(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [athleteId, ctxLoading, date, dateValid, t]);

  const titleDate = useMemo(() => {
    if (!dateValid) return "—";
    try {
      return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return date;
    }
  }, [date, dateValid]);

  return (
    <Pro2ModulePageShell
      eyebrow={t("eyebrow")}
      eyebrowClassName="text-orange-400"
      title={dateValid ? titleDate : t("invalidDateTitle")}
      description={
        dateValid ? (
          <span>
            {t.rich("dayDescription", {
              date,
              code: (chunks) => <code className="text-orange-200/80">{chunks}</code>,
            })}
          </span>
        ) : (
          t("invalidAddress")
        )
      }
    >
      <div className="scroll-mt-28">
        <TrainingSubnav />
      </div>

      {dateValid ? (
        <div className="mb-5">
          <OperationalDayNavigator dateIso={date} hrefPrefix="/training/session" />
        </div>
      ) : null}

      {dateValid && showTech && readSpineCoverage && athleteId ? (
        <TrainingPlannedWindowContextStrip
          className="mb-4"
          label={t("dayLabel")}
          readSpineCoverage={readSpineCoverage}
          twinContextStrip={twinContextStrip}
          athleteId={athleteId}
          plannedProvenanceSummary={plannedProvenanceSummary}
        />
      ) : null}

      {!dateValid ? (
        <Pro2SectionCard accent="slate" title={t("invalidDateTitle")} subtitle={t("dateFormatSubtitle")} icon={CalendarDays}>
          <p className="text-sm text-gray-400">
            {t.rich("dateFormatBody", {
              b: (chunks) => <strong className="text-gray-200">{chunks}</strong>,
            })}
          </p>
        </Pro2SectionCard>
      ) : null}

      {dateValid ? (
        ctxLoading || loading ? (
          <Pro2SectionCard accent="cyan" title={t("plannedTitle")} subtitle={t("loading")} icon={CalendarDays}>
            <p className="text-sm text-gray-500">{t("loading")}</p>
          </Pro2SectionCard>
        ) : err ? (
          <Pro2SectionCard accent="slate" title={t("plannedTitle")} icon={CalendarDays}>
            <p className="text-sm text-amber-300/90" role="alert">
              {err}
            </p>
          </Pro2SectionCard>
        ) : (
          <>
            {/* Analisi allenamento: la seduta eseguita — KPI, grafico multi-canale,
                mappa percorso, min/avg/max. Tutto adattivo: mostra solo i canali con
                dati reali (niente grafici finti). */}
            {executed.length > 0 ? (
              <CalendarDaySessionDetail selectedDate={date} dayExecuted={executed} athleteId={athleteId} />
            ) : null}

            {/* Pianificato: cosa prevede la seduta (scheda palestra / struttura blocchi).
                Editing coach (Adatta/Elimina/Copia/Sposta/Export) e gergo motore restano
                allo staff via coachControls={showTech}; l'atleta vede solo la scheda. */}
            {planned.length > 0 ? (
              <Pro2SectionCard
                accent="cyan"
                title={t("plannedTitle")}
                subtitle={t("plannedCount", { count: planned.length })}
                icon={CalendarDays}
              >
                <ul className="space-y-4">
                  {planned.map((w) => (
                    <li key={w.id}>
                      <CalendarPlannedBuilderDetail workout={w} athleteId={athleteId} coachControls={showTech} />
                    </li>
                  ))}
                </ul>
              </Pro2SectionCard>
            ) : null}

            {/* Giornata senza nulla pianificato né eseguito. */}
            {executed.length === 0 && planned.length === 0 ? (
              <Pro2SectionCard accent="slate" title={t("plannedTitle")} icon={CalendarDays}>
                <p className="text-sm text-gray-500">{t("noWorkoutPlanned")}</p>
              </Pro2SectionCard>
            ) : null}
          </>
        )
      ) : null}
    </Pro2ModulePageShell>
  );
}
