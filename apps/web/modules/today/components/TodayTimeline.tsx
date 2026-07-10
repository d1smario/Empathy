"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TodayEvent } from "@/app/api/today/contracts";
import { TodayTimelineItem } from "./TodayTimelineItem";

function minutesOf(time: string | null): number | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Marker «ADESSO»: linea che taglia la timeline all'ora corrente. */
function NowMarker({ label }: { label: string }) {
  return (
    <div className="relative flex items-center gap-3 py-1.5" aria-label={label}>
      <span className="relative ml-[14px] flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-400" />
      </span>
      <span className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.25em] text-orange-300">
        {label}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-orange-500/50 to-transparent" />
    </div>
  );
}

export function TodayTimeline({
  events,
  onAddHydration,
  onScheduleWorkout,
  hydrationBusy,
  scheduleBusyId,
}: {
  events: TodayEvent[];
  onAddHydration?: (deltaMl: number) => void;
  /** Fissa l'orario di una seduta pianificata senza orario (chips nel blocco workout). */
  onScheduleWorkout?: (plannedId: string, hhmm: string) => void;
  hydrationBusy?: boolean;
  scheduleBusyId?: string | null;
}) {
  const t = useTranslations("TodayPage");
  const [pastOpen, setPastOpen] = useState(false);

  // Passato compresso: il prefisso iniziale di eventi GIÀ FATTI (done) prima
  // dell'ora corrente collassa in una riga «✓ n completati» espandibile. Gli
  // eventi passati NON fatti (es. pasto da confermare) restano visibili.
  const { collapsed, rest, nowIndex } = useMemo(() => {
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    const prefix: TodayEvent[] = [];
    let i = 0;
    while (i < events.length) {
      const e = events[i]!;
      const m = minutesOf(e.time);
      if (e.status === "done" && m != null && m <= now) {
        prefix.push(e);
        i += 1;
      } else {
        break;
      }
    }
    const tail = events.slice(i);
    // Indice (nel tail) del primo evento con orario FUTURO: il marker ADESSO va lì sopra.
    let idx = tail.length;
    for (let j = 0; j < tail.length; j++) {
      const m = minutesOf(tail[j]!.time);
      if (m != null && m > now) {
        idx = j;
        break;
      }
    }
    return { collapsed: prefix, rest: tail, nowIndex: idx };
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-sm text-gray-400">{t("noPlan")}</p>
      </div>
    );
  }

  const renderItem = (event: TodayEvent) => (
    <TodayTimelineItem
      key={event.id}
      event={event}
      onAddHydration={onAddHydration}
      onScheduleWorkout={onScheduleWorkout}
      hydrationBusy={hydrationBusy}
      scheduleBusyId={scheduleBusyId}
    />
  );

  return (
    <section className="space-y-0">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">{t("timelineTitle")}</h2>

      {collapsed.length > 0 ? (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setPastOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-left text-xs text-gray-400 transition hover:bg-white/[0.06]"
            aria-expanded={pastOpen}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-[0.6rem] font-bold text-emerald-200">
              ✓
            </span>
            {t("pastCollapsed", { count: collapsed.length })}
            {pastOpen ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
          </button>
          {pastOpen ? <div className="mt-3">{collapsed.map(renderItem)}</div> : null}
        </div>
      ) : null}

      <div>
        {rest.slice(0, nowIndex).map(renderItem)}
        <NowMarker label={t("nowMarker")} />
        {rest.slice(nowIndex).map(renderItem)}
      </div>
    </section>
  );
}
