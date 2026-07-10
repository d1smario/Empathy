"use client";

import { useTranslations } from "next-intl";
import type { TodayEvent } from "@/app/api/today/contracts";
import { TodayTimelineItem } from "./TodayTimelineItem";

export function TodayTimeline({
  events,
  onConfirmMeal,
  onAddHydration,
  confirmBusySlot,
  hydrationBusy,
}: {
  events: TodayEvent[];
  onConfirmMeal?: (slotKey: string, confirmed: boolean) => void;
  onAddHydration?: (deltaMl: number) => void;
  confirmBusySlot?: string | null;
  hydrationBusy?: boolean;
}) {
  const t = useTranslations("TodayPage");

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-sm text-gray-400">{t("noPlan")}</p>
      </div>
    );
  }

  return (
    <section className="space-y-0">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">{t("timelineTitle")}</h2>
      <div>
        {events.map((event) => (
          <TodayTimelineItem
            key={event.id}
            event={event}
            onConfirmMeal={onConfirmMeal}
            onAddHydration={onAddHydration}
            confirmBusySlot={confirmBusySlot}
            hydrationBusy={hydrationBusy}
          />
        ))}
      </div>
    </section>
  );
}
