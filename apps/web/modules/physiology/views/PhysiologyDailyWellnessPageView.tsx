"use client";

import { OperationalDayNavigator } from "@/components/navigation/OperationalDayNavigator";
import { Activity, Beaker, Heart, Moon } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { AdminScopedPro2Link } from "@/modules/physiology/components/AdminScopedLink";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import type { PhysiologyDailyPanelOk } from "@/lib/physiology/daily-wellness-panel";

import { SleepHypnogramChart } from "@/components/physiology/SleepHypnogramChart";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Cache cross-mount del pannello wellness giornaliero, keyed by athleteId+date:
// ri-atterrando sulla pagina (stesso atleta + stesso giorno) i dati compaiono
// subito (niente spinner/"refresh"); l'aggiornamento avviene in background
// silenzioso, così le mutazioni/ingest restano riflesse senza spinner.
let dailyPanelCacheKey: string | null = null;
let dailyPanelCache: { panel: PhysiologyDailyPanelOk | null; error: string | null } | null = null;

function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("it-IT", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function MetricCell({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/35 p-3 sm:p-4">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{label}</p>
      <p className="mt-1 truncate font-mono text-xl font-bold tabular-nums text-white sm:text-2xl">
        {value}
        {unit ? <span className="ml-1 text-xs font-medium text-gray-500">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

function TimeSeriesPlaceholder({
  title,
  subtitle,
  unitHint,
}: {
  title: string;
  subtitle: string;
  unitHint: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <span className="font-mono text-[0.6rem] uppercase text-gray-500">{unitHint}</span>
      </div>
      <div className="relative mt-4 h-32 w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/90">
        <svg viewBox="0 0 400 120" className="h-full w-full text-emerald-400/50" preserveAspectRatio="none" aria-hidden>
          <line x1="0" y1="100" x2="400" y2="100" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" />
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            points="0,90 40,88 80,72 120,60 160,55 200,48 240,52 280,40 320,38 360,30 400,28"
          />
        </svg>
        <p className="pointer-events-none absolute bottom-2 left-3 right-3 text-center text-[0.65rem] text-gray-500">
          Time axis · placeholder until the continuous series is ingested for this day
        </p>
      </div>
    </div>
  );
}

/** Fascia fissa: utente vede quali canali “extra” il modulo supporta, anche se oggi sono vuoti. */
function AdvancedPhysiologyChannelsStrip({ panel }: { panel: PhysiologyDailyPanelOk | null }) {
  const lab = panel?.labTracksAvailability;
  const bio = panel?.biomarkers;
  const gasLine =
    bio?.vo2LMin != null || bio?.vco2LMin != null
      ? `VO₂ ${fmtNum(bio.vo2LMin, 2)} · VCO₂ ${fmtNum(bio.vco2LMin, 2)} L/min`
      : "—";

  const slots: Array<{ title: string; value: string; unit?: string; foot: string; warm?: boolean }> = [
    {
      title: "Glucose",
      value: fmtNum(bio?.glucoseMmolL ?? null, 2),
      unit: bio?.glucoseMmolL != null ? "mmol/L" : undefined,
      foot: "Point value from biomarker · CGM series below once ingested.",
      warm: Boolean(lab?.glucoseCgm),
    },
    {
      title: "Lactate",
      value: fmtNum(bio?.lactateMmolL ?? null, 2),
      unit: bio?.lactateMmolL != null ? "mmol/L" : undefined,
      foot: "Flash / panel · continuous monitoring (series) below.",
      warm: Boolean(lab?.lactateContinuous),
    },
    {
      title: "Muscle SmO₂ (NIRS)",
      value: "—",
      foot: "Muscle oxygen saturation · NIRS device / lab (not wrist SpO₂).",
      warm: Boolean(lab?.muscleSmo2Continuous),
    },
    {
      title: "Gas · VO₂ / VCO₂",
      value: gasLine,
      foot: "Spirometry / metabolic cart · same row shows both when present.",
      warm: Boolean(lab?.gasExchangeLab),
    },
    {
      title: "Core temperature",
      value: "—",
      foot: "Continuous (belt, pill, lab) · point value + chart when connected.",
      warm: Boolean(lab?.coreTempContinuous),
    },
    {
      title: "Hormones / metabolomics",
      value: "—",
      foot: "Serial panels or Health upload: they will appear here with mapped keys.",
      warm: Boolean(lab?.hormonePanels),
    },
  ];

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/[0.18] via-black/40 to-black/60 p-4 shadow-inner sm:p-5">
      <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-400">
        Advanced data channels
      </p>
      <p className="mt-2 max-w-3xl text-sm text-gray-300">
        Beyond steps, sleep and recovery: we set up slots for lab and technical wearables. If you don&apos;t yet have
        connected sources, the cells stay empty (—) but the product scope is clear.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((s) => (
          <div
            key={s.title}
            className={`rounded-xl border p-3 ${
              s.warm ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/10 bg-black/35"
            }`}
          >
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{s.title}</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">
              {s.value}
              {s.unit ? <span className="ml-1 text-xs font-medium text-gray-500">{s.unit}</span> : null}
            </p>
            <p className="mt-2 text-[0.7rem] leading-snug text-gray-500">{s.foot}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PhysiologyDailyWellnessPageView() {
  const params = useParams();
  const dateRaw = params?.date;
  const date = (Array.isArray(dateRaw) ? dateRaw[0] : dateRaw ?? "").slice(0, 10);
  const dateValid = ISO_DATE.test(date);

  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [panel, setPanel] = useState<PhysiologyDailyPanelOk | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!athleteId || !dateValid) {
      setPanel(null);
      setLoading(false);
      return;
    }
    const cacheKey = `${athleteId}|${date}`;
    const cached = dailyPanelCacheKey === cacheKey ? dailyPanelCache : null;
    if (cached) {
      // Mostra subito i dati in cache (niente spinner); refresh in background sotto.
      setPanel(cached.panel);
      setErr(cached.error);
      setLoading(false);
    } else {
      setLoading(true);
      setErr(null);
    }
    try {
      const q = new URLSearchParams({ athleteId, date });
      const res = await fetch(`/api/physiology/daily-panel?${q}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: await buildSupabaseAuthHeaders(),
      });
      const json = (await res.json()) as PhysiologyDailyPanelOk | { ok: false; error?: string };
      if (!res.ok || !json || typeof json !== "object" || !("ok" in json) || json.ok !== true) {
        const nextErr = (json as { error?: string }).error || "Panel read failed.";
        setPanel(null);
        setErr(nextErr);
        dailyPanelCache = { panel: null, error: nextErr };
        dailyPanelCacheKey = cacheKey;
        return;
      }
      setPanel(json);
      setErr(null);
      dailyPanelCache = { panel: json, error: null };
      dailyPanelCacheKey = cacheKey;
    } catch {
      setPanel(null);
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }, [athleteId, dateValid, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const dayLabel = useMemo(() => {
    if (!dateValid) return "";
    return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [date, dateValid]);

  if (ctxLoading || (loading && athleteId && dateValid)) {
    return (
      <Pro2ModulePageShell
        eyebrow="Your day"
        eyebrowClassName={moduleEyebrowClass("physiology")}
        title="Loading…"
        description="We're gathering the data for the selected day."
      >
        <p className="text-sm text-gray-500">Loading athlete context…</p>
      </Pro2ModulePageShell>
    );
  }

  if (!athleteId) {
    return (
      <Pro2ModulePageShell
        eyebrow="Your day"
        eyebrowClassName={moduleEyebrowClass("physiology")}
        title="Daily wellness"
        description="Select an active athlete to see the day's data."
        headerActions={
          <AdminScopedPro2Link href="/access" variant="secondary" className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-500/20">
            Access
          </AdminScopedPro2Link>
        }
      >
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-gray-400">
          No active athlete. As a coach open Athletes; as a private athlete link your profile in Access.
        </div>
      </Pro2ModulePageShell>
    );
  }

  if (!dateValid) {
    return (
      <Pro2ModulePageShell
        eyebrow="Your day"
        eyebrowClassName={moduleEyebrowClass("physiology")}
        title="Invalid date"
        description="Select a valid day to see the data."
      >
        <p className="text-sm text-amber-200/90">The specified day is not valid.</p>
      </Pro2ModulePageShell>
    );
  }

  const r = panel?.recovery;

  return (
    <Pro2ModulePageShell
      eyebrow="Your day"
      eyebrowClassName={moduleEyebrowClass("physiology")}
      title="Daily wellness"
      description={
        <>
          The day&apos;s snapshot: recovery, sleep, energy and body signals, on the same day as your training.
          The charts appear when the data is available.
        </>
      }
    >
      <div className="mb-6 space-y-3">
        <OperationalDayNavigator dateIso={date} hrefPrefix="/physiology/daily" />
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
          <p className="font-mono text-xs text-gray-500">{date}</p>
          <p className="mt-1 text-lg font-bold capitalize text-white">{dayLabel}</p>
        </div>
      </div>

      {err ? (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{err}</div>
      ) : null}

      {panel?.notes?.length ? (
        <div className="mb-6 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-200">
          {panel.notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      ) : null}

      <div className="mb-8">
        <AdvancedPhysiologyChannelsStrip panel={panel} />
      </div>

      <Pro2SectionCard accent="emerald" title="Profile and activity" subtitle="Profile weight, steps, energy, vitals" icon={Activity}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCell label="Weight (profile)" value={fmtNum(panel?.profileWeightKg ?? null, 1)} unit="kg" />
          <MetricCell label="Steps" value={fmtNum(panel?.activity.steps ?? null, 0)} />
          <MetricCell label="Active kcal" value={fmtNum(panel?.activity.activeCaloriesKcal ?? null, 0)} unit="kcal" />
          <MetricCell label="Total kcal (estimate)" value={fmtNum(panel?.activity.totalCaloriesKcal ?? null, 0)} unit="kcal" />
          <MetricCell
            label="Respiratory rate"
            value={fmtNum(panel?.activity.respiratoryRateRpm ?? null, 1)}
            unit="rpm"
          />
          <MetricCell label="Skin temperature" value={fmtNum(panel?.activity.skinTempC ?? null, 2)} unit="°C" />
          <MetricCell label="Temperature / wrist" value={fmtNum(panel?.activity.bodyTempC ?? null, 2)} unit="°C" />
          <MetricCell label="SpO₂ (average)" value={fmtNum(panel?.activity.spo2Pct ?? null, 1)} unit="%" />
          <MetricCell
            label="ECG (flag)"
            value={panel?.activity.ecgCaptured == null ? "—" : panel.activity.ecgCaptured ? "Yes" : "No"}
            hint="From device payload when exposed"
          />
        </div>
      </Pro2SectionCard>

      <Pro2SectionCard accent="emerald" title="Recovery and sleep" subtitle="HRV, night HR, duration, score" icon={Moon}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCell label="HRV" value={fmtNum(r?.hrvMs ?? null, 0)} unit="ms" />
          <MetricCell label="Resting / night HR" value={fmtNum(r?.restingHrBpm ?? null, 0)} unit="bpm" />
          <MetricCell label="Sleep hours" value={fmtNum(r?.sleepDurationHours ?? null, 2)} unit="h" />
          <MetricCell label="Sleep score" value={fmtNum(r?.sleepScore ?? null, 0)} />
          <MetricCell label="Readiness" value={fmtNum(r?.readinessScore ?? null, 0)} />
          <MetricCell label="Recovery" value={fmtNum(r?.recoveryScore ?? null, 0)} />
          <MetricCell label="Strain" value={fmtNum(r?.strainScore ?? null, 1)} />
          <MetricCell label="Overall status" value={r?.status === "unknown" || !r ? "—" : r.status} hint={r?.guidance} />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <SleepHypnogramChart
            segments={panel?.sleepHypnogram ?? []}
            approximated={panel?.sleepHypnogramApproximated ?? false}
            sleepStartUtc={panel?.sleepHypnogramWindowUtc?.sleepStartUtc}
            sleepEndUtc={panel?.sleepHypnogramWindowUtc?.sleepEndUtc}
          />
          <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-sm font-bold text-white">Sleep phases (hours)</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <MetricCell label="Deep" value={fmtNum(panel?.sleepStages.deepHours ?? null, 2)} unit="h" />
              <MetricCell label="Light" value={fmtNum(panel?.sleepStages.lightHours ?? null, 2)} unit="h" />
              <MetricCell label="REM" value={fmtNum(panel?.sleepStages.remHours ?? null, 2)} unit="h" />
              <MetricCell label="Awake" value={fmtNum(panel?.sleepStages.awakeHours ?? null, 2)} unit="h" />
            </div>
            {panel?.sleepStages.summaryLabel ? (
              <p className="text-xs text-gray-400">Vendor: {panel.sleepStages.summaryLabel}</p>
            ) : null}
          </div>
        </div>
      </Pro2SectionCard>

      <Pro2SectionCard accent="emerald" title="Lab and continuous series" subtitle="Glucose, lactate, gas, NIRS…" icon={Beaker}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCell
            label="Glucose (panel)"
            value={fmtNum(panel?.biomarkers.glucoseMmolL ?? null, 2)}
            unit="mmol/L"
            hint={`Biomarker panels with sample_date = ${date}`}
          />
          <MetricCell label="Lactate (panel)" value={fmtNum(panel?.biomarkers.lactateMmolL ?? null, 2)} unit="mmol/L" />
          <MetricCell label="VO₂ (panel)" value={fmtNum(panel?.biomarkers.vo2LMin ?? null, 2)} unit="L/min" />
          <MetricCell label="VCO₂ (panel)" value={fmtNum(panel?.biomarkers.vco2LMin ?? null, 2)} unit="L/min" />
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Panels found: <span className="font-mono text-gray-300">{panel?.biomarkers.panelCount ?? 0}</span> — the
          continuous series (CGM, core temp, hormones, muscle SmO₂) require dedicated ingestion; below is the chart
          placeholder aligned to the Pro 2 canon.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <TimeSeriesPlaceholder
            title="Interstitial glucose / CGM"
            subtitle={panel?.labTracksAvailability.glucoseCgm ? "Glucose keys present in the panels." : "No CGM key detected in today's panels."}
            unitHint="mmol/L · t"
          />
          <TimeSeriesPlaceholder
            title="Continuous blood lactate"
            subtitle={panel?.labTracksAvailability.lactateContinuous ? "Lactate references in values." : "To be integrated with lab stream."}
            unitHint="mmol/L · t"
          />
          <TimeSeriesPlaceholder
            title="Core temperature"
            subtitle={panel?.labTracksAvailability.coreTempContinuous ? "Core temperature signals in values." : "From belt / pill / lab."}
            unitHint="°C · t"
          />
          <TimeSeriesPlaceholder
            title="Hormones · serial panels"
            subtitle={panel?.labTracksAvailability.hormonePanels ? "Hormonal keys detected." : "Upload Health / lab documents."}
            unitHint="unit · t"
          />
          <TimeSeriesPlaceholder
            title="Muscle SmO₂ / NIRS"
            subtitle={panel?.labTracksAvailability.muscleSmo2Continuous ? "SmO₂/NIRS signals in values." : "Session + NIRS wearables."}
            unitHint="% · t"
          />
          <TimeSeriesPlaceholder
            title="VO₂ / VCO₂ · spirometry"
            subtitle={panel?.labTracksAvailability.gasExchangeLab ? "Gas exchange in values." : "Cardiopulmonary / metabolic lab."}
            unitHint="L/min · t"
          />
        </div>
      </Pro2SectionCard>

      <Pro2SectionCard accent="slate" title="Merge sources" subtitle="Device exports mapped to this date" icon={Heart}>
        {panel?.sources?.length ? (
          <ul className="space-y-2 font-mono text-xs text-gray-300">
            {panel.sources.map((s, i) => (
              <li key={`${s.provider}-${s.created_at}-${i}`}>
                {s.provider} · {s.created_at ? new Date(s.created_at).toLocaleString("en-US") : "—"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No device_sync_exports row associated with this date.</p>
        )}
        <p className="mt-4 text-xs text-gray-500">
          Overlaying the signals on the training chart (same day) is planned as the next step: same ISO date key
          between the Training session and this view.
        </p>
      </Pro2SectionCard>
    </Pro2ModulePageShell>
  );
}
