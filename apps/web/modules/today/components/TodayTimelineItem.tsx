"use client";

import {
  Activity,
  ArrowUpRight,
  Check,
  Clock,
  Coffee,
  Droplets,
  Moon,
  Pill,
  Sun,
  Utensils,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { TodayEvent } from "@/app/api/today/contracts";
import { BuilderPlannedSessionViz } from "@/components/training/BuilderPlannedSessionViz";
import { scopedShellHref } from "@/lib/athlete-scope/scoped-athlete-href";
import { productHrefForPathname } from "@/lib/shell/use-product-href";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import { useScopedSessionHref } from "@/lib/training/use-scoped-session-href";
import { useActiveAthlete } from "@/lib/use-active-athlete";

const ICONS: Record<TodayEvent["type"], typeof Sun> = {
  wake: Sun,
  hydration: Droplets,
  supplement: Pill,
  meal: Utensils,
  snack: Coffee,
  workout: Activity,
  sleep: Moon,
};

const ACCENTS: Record<NonNullable<TodayEvent["accent"]>, { border: string; bg: string; icon: string; text: string }> = {
  slate: { border: "border-white/10", bg: "bg-white/5", icon: "text-gray-300", text: "text-white" },
  violet: { border: "border-violet-500/30", bg: "bg-violet-500/10", icon: "text-violet-300", text: "text-violet-100" },
  orange: { border: "border-orange-500/30", bg: "bg-orange-500/10", icon: "text-orange-300", text: "text-orange-100" },
  cyan: { border: "border-cyan-500/30", bg: "bg-cyan-500/10", icon: "text-cyan-300", text: "text-cyan-100" },
  emerald: { border: "border-emerald-500/30", bg: "bg-emerald-500/10", icon: "text-emerald-300", text: "text-emerald-100" },
  amber: { border: "border-amber-500/30", bg: "bg-amber-500/10", icon: "text-amber-300", text: "text-amber-100" },
  fuchsia: { border: "border-fuchsia-500/30", bg: "bg-fuchsia-500/10", icon: "text-fuchsia-300", text: "text-fuchsia-100" },
};

function EventTitle({ event, t }: { event: TodayEvent; t: ReturnType<typeof useTranslations> }) {
  if (event.titleKey) {
    if (event.titleKey === "hydrationLogged") {
      return <>{t(event.titleKey, { ml: Number(event.data?.ml) || 0 })}</>;
    }
    if (event.titleKey === "workoutCompleted") {
      return <>{t(event.titleKey, { duration: Number(event.data?.duration) || 0 })}</>;
    }
    if (event.titleKey === "hydrationCheckpoint") {
      return <>{t(event.titleKey, { liters: ((Number(event.data?.cumTargetMl) || 0) / 1000).toFixed(1) })}</>;
    }
    return <>{t(event.titleKey)}</>;
  }
  return <>{event.title}</>;
}

function EventSubtitle({ event, t }: { event: TodayEvent; t: ReturnType<typeof useTranslations> }) {
  if (event.subtitleKey) {
    return <>{t(event.subtitleKey)}</>;
  }
  if (event.subtitle) {
    return <>{event.subtitle}</>;
  }
  return null;
}

/** Slot rapidi per «Fissa orario» (mattina / pranzo / sera). */
const SCHEDULE_SLOTS = ["07:00", "12:30", "18:00"] as const;

export function TodayTimelineItem({
  event,
  onConfirmMeal,
  onAddHydration,
  onScheduleWorkout,
  confirmBusySlot,
  hydrationBusy,
  scheduleBusyId,
}: {
  event: TodayEvent;
  onConfirmMeal?: (slotKey: string, confirmed: boolean) => void;
  onAddHydration?: (deltaMl: number) => void;
  onScheduleWorkout?: (plannedId: string, hhmm: string) => void;
  confirmBusySlot?: string | null;
  hydrationBusy?: boolean;
  scheduleBusyId?: string | null;
}) {
  const t = useTranslations("TodayPage");
  const pathname = usePathname() ?? "/";
  const { athleteId, adminScoped, platformAdminView, scopeOwnerUserId } = useActiveAthlete();
  const sessionHrefFor = useScopedSessionHref();
  const Icon = ICONS[event.type];
  const accent = event.accent ?? "slate";
  const styles = ACCENTS[accent] ?? {
    border: "border-white/10",
    bg: "bg-white/5",
    icon: "text-gray-300",
    text: "text-white",
  };

  const isMeal = event.type === "meal" || event.type === "snack";
  const isWorkout = event.type === "workout";
  const isHydration = event.type === "hydration";
  const isHydrationCheckpoint = isHydration && Boolean(event.data?.checkpoint);

  // Anteprima seduta dal contratto builder nelle notes (sempre visibile, compatta).
  const workoutContract = useMemo(() => {
    if (!isWorkout) return null;
    const notes = typeof event.data?.notes === "string" ? event.data.notes : null;
    return parsePro2BuilderSessionFromNotes(notes) as unknown as Pro2BuilderSessionContract | null;
  }, [isWorkout, event.data?.notes]);

  // Link «Dettaglio seduta» (eseguito) e «Apri piano pasti»: scope-aware.
  const detailDate = typeof event.data?.detailDate === "string" ? event.data.detailDate : null;
  const mealPlanHref = adminScoped
    ? (scopedShellHref("/nutrition", { athleteId, adminScoped, platformAdminView, scopeOwnerUserId }) ?? "/nutrition")
    : productHrefForPathname("/nutrition", pathname);

  return (
    <div className="relative flex gap-3">
      {/* Linea timeline */}
      <div className="flex flex-col items-center">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${styles.border} ${styles.bg}`}
        >
          <Icon className={`h-4 w-4 ${styles.icon}`} aria-hidden />
        </div>
        <div className="mt-1 w-px flex-1 bg-white/10" />
      </div>

      <div className={`mb-4 flex-1 rounded-2xl border ${styles.border} ${styles.bg} p-3.5`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {event.time ? (
                <>
                  <Clock className="h-3 w-3" aria-hidden />
                  <span className="tabular-nums">{event.time}</span>
                </>
              ) : null}
              {event.status === "done" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[0.6rem] font-semibold text-emerald-200">
                  <Check className="h-3 w-3" /> {t("statusDone")}
                </span>
              ) : event.status === "current" ? (
                <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-[0.6rem] font-semibold text-orange-200">
                  {t("statusCurrent")}
                </span>
              ) : null}
              {isWorkout && event.data?.toSchedule ? (
                <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[0.6rem] font-semibold text-gray-300">
                  {t("workoutToSchedule")}
                </span>
              ) : null}
            </div>
            <h3 className={`mt-1 text-sm font-bold ${styles.text}`}>
              <EventTitle event={event} t={t} />
            </h3>
            {event.subtitle || event.subtitleKey ? (
              <p className="text-xs text-gray-400">
                <EventSubtitle event={event} t={t} />
              </p>
            ) : null}
          </div>

        </div>

        {/* Azioni */}
        <div className="mt-2 flex flex-wrap gap-2">
          {isMeal && event.status !== "done" && event.data?.slot ? (
            <button
              type="button"
              disabled={confirmBusySlot === event.data.slot}
              onClick={() => onConfirmMeal?.(String(event.data!.slot), true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
              {confirmBusySlot === event.data.slot ? t("mealSaving") : t("mealDone")}
            </button>
          ) : null}

          {isHydration && !isHydrationCheckpoint && event.status !== "done" ? (
            <button
              type="button"
              disabled={hydrationBusy}
              onClick={() => onAddHydration?.(250)}
              className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-50"
            >
              {t("add250ml")}
            </button>
          ) : null}

          {/* Workout da fissare: chips slot rapidi (scrivono scheduledTime nel contratto). */}
          {isWorkout && event.data?.toSchedule && event.data?.schedulable && onScheduleWorkout && event.data?.plannedId ? (
            <>
              <span className="self-center text-[0.65rem] uppercase tracking-wider text-gray-500">
                {t("scheduleWorkoutLabel")}
              </span>
              {SCHEDULE_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  disabled={scheduleBusyId === event.data?.plannedId}
                  onClick={() => onScheduleWorkout(String(event.data!.plannedId), slot)}
                  className="inline-flex items-center rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 font-mono text-xs font-bold tabular-nums text-orange-100 transition hover:bg-orange-500/25 disabled:opacity-50"
                >
                  {slot}
                </button>
              ))}
            </>
          ) : null}

          {/* Seduta eseguita: link al dettaglio (mappa GPS, curve, KPI) nello scope giusto. */}
          {isWorkout && event.status === "done" && detailDate ? (
            <Link
              href={sessionHrefFor(detailDate)}
              className="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-100 transition hover:bg-orange-500/25"
            >
              {t("sessionDetailLink")} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>

        {/* Checkpoint idratazione: progresso reale vs obiettivo cumulativo + azioni rapide. */}
        {isHydrationCheckpoint ? (
          <div className="mt-3">
            {(() => {
              const cum = Number(event.data?.cumTargetMl) || 0;
              const cur = Number(event.data?.currentMl) || 0;
              const pct = cum > 0 ? Math.min(100, Math.round((cur / cum) * 100)) : 0;
              return (
                <>
                  <div className="flex items-center justify-between text-[0.7rem] text-gray-400">
                    <span>
                      {(cur / 1000).toFixed(1)} / {(cum / 1000).toFixed(1)} L
                    </span>
                    <span className="font-mono tabular-nums">{pct}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {event.status === "current" ? (
                    <div className="mt-2 flex gap-2">
                      {[250, 500].map((ml) => (
                        <button
                          key={ml}
                          type="button"
                          disabled={hydrationBusy}
                          onClick={() => onAddHydration?.(ml)}
                          className="inline-flex items-center rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-50"
                        >
                          +{ml} ml
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              );
            })()}
          </div>
        ) : null}

        {/* Anteprima seduta pianificata: blocchi/intensità dal contratto builder. */}
        {isWorkout && event.status !== "done" && workoutContract ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
            <BuilderPlannedSessionViz contract={workoutContract} compact />
          </div>
        ) : null}

        {event.type === "supplement" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.isArray(event.data?.supplements) && (event.data.supplements as string[]).length > 0 ? (
              (event.data.supplements as string[]).map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-100"
                >
                  <Pill className="h-3 w-3" /> {s}
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-500">{t("supplementEmpty")}</span>
            )}
          </div>
        ) : null}

        {isMeal ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
            <p className="font-semibold text-white">{t("mealDetailsTitle")}</p>
            {event.items && event.items.length > 0 ? (
              <ul className="mt-1.5 space-y-1.5">
                {event.items.map((item, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-2 text-gray-300">
                    <span className="flex-1">{item.foodLabel}</span>
                    <span className="shrink-0 tabular-nums text-gray-500">
                      {item.quantityG}g · {Math.round(item.kcal)} kcal
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-gray-500">{t("mealNoItems")}</p>
                <Link
                  href={mealPlanHref}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[0.7rem] font-bold text-amber-100 transition hover:bg-amber-500/25"
                >
                  {t("openMealPlan")} <ArrowUpRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
