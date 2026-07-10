"use client";

import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Coffee,
  Droplets,
  Moon,
  Pill,
  Sun,
  Utensils,
} from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { TodayEvent } from "@/app/api/today/contracts";

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

export function TodayTimelineItem({
  event,
  onConfirmMeal,
  onAddHydration,
  confirmBusySlot,
  hydrationBusy,
}: {
  event: TodayEvent;
  onConfirmMeal?: (slotKey: string, confirmed: boolean) => void;
  onAddHydration?: (deltaMl: number) => void;
  confirmBusySlot?: string | null;
  hydrationBusy?: boolean;
}) {
  const t = useTranslations("TodayPage");
  const [expanded, setExpanded] = useState(false);
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

          {isWorkout ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 text-gray-400 transition hover:text-white"
              aria-label={t(expanded ? "collapse" : "expand")}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          ) : null}
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

          {isHydration && event.status !== "done" ? (
            <button
              type="button"
              disabled={hydrationBusy}
              onClick={() => onAddHydration?.(250)}
              className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-50"
            >
              {t("add250ml")}
            </button>
          ) : null}

          {event.actions?.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => {
                if (action.key === "done") {
                  // TODO: segna allenamento completato
                } else if (action.key === "start") {
                  // TODO: avvia allenamento
                }
              }}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                action.variant === "primary"
                  ? "border border-orange-500/40 bg-orange-500/15 text-orange-100 hover:bg-orange-500/25"
                  : "border border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
              }`}
            >
              {action.i18nKey ? t(action.i18nKey) : action.label}
            </button>
          ))}
        </div>

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
              <p className="mt-1 text-gray-500">{t("mealNoItems")}</p>
            )}
          </div>
        ) : null}

        {expanded && isWorkout ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-gray-300">
            <p className="font-semibold text-white">{t("fuelingTitle")}</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-gray-400">
              <li>{t("fuelingPre")}</li>
              <li>{t("fuelingIntra")}</li>
              <li>{t("fuelingPost")}</li>
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
