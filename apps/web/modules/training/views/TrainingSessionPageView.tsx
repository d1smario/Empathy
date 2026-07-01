"use client";

import {
  formatExecutedWorkoutSummary,
  type ExecutedWorkout,
  type PlannedWorkout,
} from "@empathy/domain-training";
import { CalendarDays, ClipboardList, Heart, Wrench } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlannedBuilderDetail } from "@/components/training/CalendarPlannedBuilderDetail";
import { TrainingPlannedWindowContextStrip } from "@/components/training/TrainingPlannedWindowContextStrip";
import { OperationalDayNavigator } from "@/components/navigation/OperationalDayNavigator";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link } from "@/components/ui/empathy";
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
  const params = useParams<{ date: string }>();
  const date = typeof params?.date === "string" ? params.date : "";
  const dateValid = ISO_DATE.test(date);

  const { athleteId, loading: ctxLoading } = useActiveAthlete();
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
      setErr("No active athlete.");
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
          const errMsg = ("error" in json && json.error) || "Read failed.";
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
          setErr("Network error.");
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
  }, [athleteId, ctxLoading, date, dateValid]);

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
      eyebrow="Training · Day"
      eyebrowClassName="text-orange-400"
      title={dateValid ? titleDate : "Invalid date"}
      description={
        dateValid ? (
          <span>
            Day <code className="text-orange-200/80">{date}</code> — same data as the calendar.
          </span>
        ) : (
          "Invalid address: the date must be in YYYY-MM-DD format (e.g. 2025-04-02)."
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

      {dateValid && readSpineCoverage && athleteId ? (
        <TrainingPlannedWindowContextStrip
          className="mb-4"
          label="Day"
          readSpineCoverage={readSpineCoverage}
          twinContextStrip={twinContextStrip}
          athleteId={athleteId}
          plannedProvenanceSummary={plannedProvenanceSummary}
        />
      ) : null}

      {!dateValid ? (
        <Pro2SectionCard accent="slate" title="Invalid date" subtitle="Date format" icon={CalendarDays}>
          <p className="text-sm text-gray-400">
            The date in the URL must be <strong className="text-gray-200">YYYY-MM-DD</strong>.
          </p>
        </Pro2SectionCard>
      ) : null}

      {dateValid ? (
        <>
          <Pro2SectionCard
            accent="cyan"
            title="Planned"
            subtitle={ctxLoading || loading ? "Loading…" : err ? undefined : `${planned.length} on this day`}
            icon={CalendarDays}
          >
            {err ? (
              <p className="text-sm text-amber-300/90" role="alert">
                {err}
              </p>
            ) : null}
            {!ctxLoading && !loading && !err && planned.length === 0 ? (
              <p className="text-sm text-gray-500">No workout planned for this date.</p>
            ) : null}
            {!ctxLoading && !loading && !err && planned.length > 0 ? (
              <ul className="space-y-4">
                {planned.map((w) => (
                  <li key={w.id}>
                    <CalendarPlannedBuilderDetail workout={w} />
                  </li>
                ))}
              </ul>
            ) : null}
          </Pro2SectionCard>

          <Pro2SectionCard
            accent="emerald"
            title="Executed"
            subtitle={!loading && !err ? `${executed.length} recordings` : undefined}
            icon={ClipboardList}
          >
            {!ctxLoading && !loading && !err && executed.length === 0 ? (
              <p className="text-sm text-gray-500">No execution on this day.</p>
            ) : null}
            {!ctxLoading && !loading && !err && executed.length > 0 ? (
              <ul className="space-y-2">
                {executed.map((w) => (
                  <li
                    key={w.id}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-200"
                  >
                    {formatExecutedWorkoutSummary(w)}
                  </li>
                ))}
              </ul>
            ) : null}
          </Pro2SectionCard>

          <Pro2SectionCard
            accent="violet"
            title="Twin and recovery"
            subtitle="Same data used by Builder and Nutrition"
            icon={Heart}
          >
            <p className="text-sm text-gray-400">
              Readiness, internal load and recovery live in the athlete&apos;s <strong className="text-gray-200">digital twin</strong>.
              Open Profile for the snapshot; Physiology for the signal detail.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pro2Link
                href="/profile"
                variant="secondary"
                className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
              >
                Profile · twin
              </Pro2Link>
              <Pro2Link
                href="/physiology"
                variant="secondary"
                className="justify-center border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15"
              >
                Physiology
              </Pro2Link>
            </div>
          </Pro2SectionCard>

          <Pro2SectionCard accent="amber" title="Next steps" subtitle="Coming soon" icon={Wrench}>
            <p className="text-sm text-gray-400">
              <strong className="text-gray-200">Complete session</strong> recording, coach load editing and structured builder notes
              will arrive in upcoming releases.
            </p>
          </Pro2SectionCard>
        </>
      ) : null}
    </Pro2ModulePageShell>
  );
}
