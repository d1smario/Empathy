"use client";

import { useEffect, useState } from "react";
import { CalendarRange } from "lucide-react";
import { useTranslations } from "next-intl";
import { fetchViryaCalendarRows } from "@/modules/training/services/training-planned-api";
import {
  deriveViryaContextForDate,
  type ViryaCalendarRow,
} from "@/lib/training/virya/virya-context-for-date";

/**
 * Striscia «Virya · lungo periodo» dentro il Builder: mentre il coach costruisce la
 * seduta del giorno, mostra dove cade nella stagione (fase, settimana, carico-target,
 * posizione) leggendo il piano `[VIRYA:]` attivo dell'atleta. Compare solo se la data
 * scelta cade dentro un piano pubblicato. Le due viste (Giorno/Virya) restano separate;
 * questa è l'anteprima di lungo periodo che assiste il Giorno.
 */

let rowsCacheId: string | null = null;
let rowsCache: ViryaCalendarRow[] | null = null;

export function ViryaLongTermStrip({ athleteId, date }: { athleteId: string | null; date: string }) {
  const t = useTranslations("ViryaLongTermStrip");
  const [rows, setRows] = useState<ViryaCalendarRow[] | null>(
    rowsCacheId === athleteId ? rowsCache : null,
  );

  useEffect(() => {
    if (!athleteId) {
      setRows(null);
      return;
    }
    if (rowsCacheId === athleteId && rowsCache) {
      setRows(rowsCache);
      return;
    }
    let cancelled = false;
    fetchViryaCalendarRows(athleteId)
      .then((r) => {
        if (cancelled) return;
        rowsCache = r;
        rowsCacheId = athleteId;
        setRows(r);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  if (!rows || !date) return null;
  const ctx = deriveViryaContextForDate(rows, date);
  if (!ctx) return null;

  return (
    <div className="mb-4 rounded-2xl border border-violet-500/25 bg-violet-950/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-wider text-violet-300/90">
          <CalendarRange className="h-3.5 w-3.5" aria-hidden /> {t("eyebrow")}
        </span>
        {ctx.phaseLabel ? (
          <span className="text-sm text-violet-100">
            {t("phase")} <span className="font-semibold text-white">{ctx.phaseLabel}</span>
          </span>
        ) : null}
        <span className="text-sm text-violet-100">
          {t("week", { n: ctx.weekIndex, total: ctx.totalWeeks })}
        </span>
        <span className="text-sm text-violet-100">
          {t("weekLoad")} <span className="font-semibold text-white">{ctx.weekLoadTarget}</span>
        </span>
        <span className="text-sm text-violet-100">
          {t("session", { pos: ctx.positionInWeek, count: ctx.sessionsThisWeek })}
        </span>
      </div>
    </div>
  );
}
