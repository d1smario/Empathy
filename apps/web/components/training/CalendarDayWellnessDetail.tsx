"use client";

import { Heart, Moon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { DayHeartRateCurve } from "@/components/training/DayHeartRateCurve";
import { SleepHypnogramChart } from "@/components/physiology/SleepHypnogramChart";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import type { PhysiologyDailyPanelOk } from "@/lib/physiology/daily-wellness-panel";

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; panel: PhysiologyDailyPanelOk }
  | { kind: "error"; message: string };

function fmtNumber(value: number | null | undefined, digits: number): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function fmtInt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.round(value).toString();
}

function fmtHoursLabel(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${String(m).padStart(2, "0")}`;
}

function KpiCell({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl border border-orange-500/25 bg-black/40 px-4 py-3">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
        {value}
        {unit ? <span className="ml-1 text-xs font-medium text-gray-500">{unit}</span> : null}
      </p>
    </div>
  );
}

export type CalendarDayWellnessDetailProps = {
  athleteId: string | null | undefined;
  selectedDate: string;
  /**
   * Colonna "arte" opzionale (es. TwinFigureArt in «Oggi»): desktop = 40% a destra
   * dei contatori+fasi sonno (60%); mobile = PRIMA dei contatori. Le altre superfici
   * (calendario Training, Physiology daily) non la passano → layout invariato.
   */
  aside?: ReactNode;
  /** Vista Oggi: niente header «Giornata · wellness» (ridondante, la pagina ha già il suo). */
  hideHeader?: boolean;
};

export function CalendarDayWellnessDetail({ athleteId, selectedDate, aside, hideHeader = false }: CalendarDayWellnessDetailProps) {
  const t = useTranslations("CalendarDayWellnessDetail");
  const [state, setState] = useState<LoadState>({ kind: "idle" });

  const panel = state.kind === "ok" ? state.panel : null;

  useEffect(() => {
    if (!athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      setState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    (async () => {
      try {
        const q = new URLSearchParams({ athleteId, date: selectedDate });
        const headers = await buildSupabaseAuthHeaders();
        const res = await fetch(`/api/health/daily-wellness?${q}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers,
        });
        const json = (await res.json()) as PhysiologyDailyPanelOk | { ok: false; error?: string };
        if (cancelled) return;
        if (!res.ok || !("ok" in json) || !json.ok) {
          setState({
            kind: "error",
            message: ("error" in json && json.error) || res.statusText || t("loadingError"),
          });
          return;
        }
        setState({ kind: "ok", panel: json });
      } catch (err) {
        if (cancelled) return;
        setState({ kind: "error", message: err instanceof Error ? err.message : t("networkError") });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, selectedDate]);

  const subtitle = t("subtitle", { date: selectedDate });

  // Contenitore: card con header (default) oppure box neutro senza header (vista
  // Oggi, che ha già il proprio header di pagina). L'aria-label resta per l'a11y.
  const Card = ({ children }: { children: ReactNode }) =>
    hideHeader ? (
      <section
        aria-label={t("cardTitle")}
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-lg backdrop-blur-xl sm:p-6"
      >
        {children}
      </section>
    ) : (
      <Pro2SectionCard accent="orange" title={t("cardTitle")} subtitle={subtitle} icon={Moon}>
        {children}
      </Pro2SectionCard>
    );

  if (!athleteId) {
    return null;
  }

  if (state.kind === "loading") {
    return (
      <div id="day-wellness-detail" className="scroll-mt-24">
        <Card>
          <p className="text-sm text-gray-500">{t("loadingPanel")}</p>
        </Card>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div id="day-wellness-detail" className="scroll-mt-24">
        <Card>
          <p className="text-sm text-amber-300/90">{t("readFailed", { message: state.message })}</p>
        </Card>
      </div>
    );
  }

  if (state.kind !== "ok" || !panel) return null;

  const totalSleepHours = (() => {
    const stages = panel.sleepStages;
    const partial = (stages.deepHours ?? 0) + (stages.lightHours ?? 0) + (stages.remHours ?? 0);
    if (partial > 0) return partial;
    return null;
  })();
  const recoveryScore = panel.recovery?.recoveryScore ?? null;
  const hrvMs = panel.recovery?.hrvMs ?? null;
  const restingHr = panel.recovery?.restingHrBpm ?? null;
  const sleepDurH = panel.recovery?.sleepDurationHours ?? totalSleepHours;

  const stagesBars = [
    { key: "deep", label: t("stageDeep"), color: "#22d3ee", value: panel.sleepStages.deepHours },
    { key: "rem", label: "REM", color: "#a78bfa", value: panel.sleepStages.remHours },
    { key: "light", label: t("stageLight"), color: "#34d399", value: panel.sleepStages.lightHours },
    { key: "awake", label: t("stageAwake"), color: "#fb923c", value: panel.sleepStages.awakeHours },
  ];

  const hasAnyKpi =
    sleepDurH != null ||
    recoveryScore != null ||
    hrvMs != null ||
    restingHr != null ||
    panel.activity.steps != null ||
    panel.activity.activeCaloriesKcal != null;

  // Ipnogramma: SOLO quando la sequenza è quella REALE del device (Garmin
  // sleepLevelsMap). Se è ricostruita dai totali (WHOOP non espone la sequenza)
  // NON la mostriamo: i totali veri sono già nelle barre «Fasi sonno», e una
  // timeline sintetica sembrerebbe un dato che non abbiamo (regola no-fake-data).
  // Con `aside` va DENTRO la colonna sinistra; senza, full-width come sempre.
  const hypnogramBlock =
    panel.sleepHypnogram.length > 0 && !panel.sleepHypnogramApproximated ? (
      <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
        <p className="mb-2 flex items-center gap-2 font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400">
          <Heart className="h-3.5 w-3.5" aria-hidden /> {t("stagesNightLine")}
        </p>
        <SleepHypnogramChart
          segments={panel.sleepHypnogram}
          approximated={panel.sleepHypnogramApproximated}
          sleepStartUtc={panel.sleepHypnogramWindowUtc?.sleepStartUtc}
          sleepEndUtc={panel.sleepHypnogramWindowUtc?.sleepEndUtc}
        />
      </div>
    ) : null;

  return (
    <div id="day-wellness-detail" className="scroll-mt-24">
      <Card>
        {!hasAnyKpi ? (
          <p className="text-sm text-gray-500">
            {t.rich("noData", {
              date: selectedDate,
              code: (chunks) => (
                <code className="mx-1 rounded bg-white/5 px-1 py-0.5 font-mono text-xs">{chunks}</code>
              ),
            })}
          </p>
        ) : (
          <div className="space-y-5">
            {/* Con `aside` (vista Oggi): desktop = contatori+fasi 2/3 a sinistra, arte 1/3
                a destra; mobile = prima l'omino, sotto tutti i contatori. Senza aside il
                blocco resta full-width (calendario Training, Physiology daily). */}
            <div className={aside ? "grid gap-4 lg:grid-cols-5" : "space-y-5"}>
              {aside ? (
                // Split 60/40: contatori 3/5, arte 2/5. Desktop: l'arte è ASSOLUTA
                // dentro la cella → non detta l'altezza della riga; il min-h della
                // cella dà però ancora un filo di respiro verticale alla figura.
                // Mobile: altezza minima fissa, arte PRIMA dei contatori.
                <div className="relative min-h-[460px] lg:order-last lg:col-span-2 lg:min-h-[540px]">
                  <div className="h-full lg:absolute lg:inset-0">{aside}</div>
                </div>
              ) : null}
              <div className={aside ? "space-y-5 lg:col-span-3" : "space-y-5"}>
            {hideHeader ? (
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.25em] text-orange-400">
                {t("metricsTodayTitle")}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <KpiCell label={t("kpiTotalSleep")} value={fmtHoursLabel(sleepDurH)} />
              <KpiCell label="HRV" value={fmtInt(hrvMs)} unit="ms" />
              <KpiCell label={t("kpiRestingHr")} value={fmtInt(restingHr)} unit="bpm" />
              <KpiCell
                label={t("kpiRecovery")}
                value={recoveryScore != null ? fmtInt(recoveryScore) : "—"}
                unit={recoveryScore != null ? "%" : undefined}
              />
              <KpiCell
                label={t("kpiSteps")}
                value={fmtInt(panel.activity.steps)}
                unit={panel.activity.stepsGoal != null ? `/ ${fmtInt(panel.activity.stepsGoal)}` : undefined}
              />
              <KpiCell label={t("kpiDayDistance")} value={fmtNumber(panel.activity.distanceKm, 1)} unit="km" />
              <KpiCell
                label={t("kpiActiveCalories")}
                value={fmtInt(panel.activity.activeCaloriesKcal)}
                unit="kcal"
              />
              <KpiCell
                label={t("kpiResp")}
                value={fmtNumber(panel.activity.respiratoryRateRpm, 1)}
                unit="rpm"
              />
              <KpiCell label={t("kpiSpo2")} value={fmtInt(panel.activity.spo2Pct)} unit="%" />
            </div>

            {/* Fasi sonno: UNA barra impilata (segmenti proporzionali alla durata),
                con tempo e percentuale di ogni fase nella legenda sopra. */}
            <div>
              <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
                {t("sleepStagesHeading")}
              </p>
              {(() => {
                const total = stagesBars.reduce((acc, r) => acc + (r.value ?? 0), 0);
                if (total <= 0) return null;
                const withPct = stagesBars
                  .filter((r) => (r.value ?? 0) > 0)
                  .map((r) => ({ ...r, pct: ((r.value ?? 0) / total) * 100 }));
                return (
                  <>
                    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
                      {withPct.map((r) => (
                        <span key={r.key} className="flex items-center gap-1.5 text-xs text-gray-400">
                          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: r.color }} />
                          {r.label}
                          <span className="font-mono tabular-nums text-gray-200">
                            {fmtHoursLabel(r.value)} · {Math.round(r.pct)}%
                          </span>
                        </span>
                      ))}
                    </div>
                    <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-white/5">
                      {withPct.map((r) => (
                        <div key={r.key} className="h-full" style={{ width: `${r.pct}%`, background: r.color }} />
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

              {/* Curva FC della giornata (campioni reali Garmin): riempie la colonna.
                  Distanza/passi intraday NON arrivano dai dailies (solo totali). */}
              {panel.intradayHeartRate.length > 1 ? (
                <DayHeartRateCurve points={panel.intradayHeartRate} title={t("dayHrTitle")} />
              ) : null}
              {aside ? hypnogramBlock : null}
              </div>
            </div>

            {!aside ? hypnogramBlock : null}

            {panel.notes.length > 0 ? (
              <ul className="space-y-1 text-xs text-gray-500">
                {panel.notes.map((n) => (
                  <li key={n}>• {n}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}
