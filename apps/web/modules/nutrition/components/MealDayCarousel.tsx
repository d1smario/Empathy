"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { MealExtraQuickAdd } from "@/modules/nutrition/components/MealExtraQuickAdd";

/**
 * Carosello dei pasti del Piano (2026-07, «companion di giornata»): scorrimento
 * orizzontale tra colazione→spuntino→pranzo→cena, conferma di avvenuto consumo
 * sotto ogni pasto e quick-add «ho mangiato altro». All'apertura la vista si
 * posiziona sul PRIMO pasto non ancora confermato del giorno.
 * Layout critico in stili inline (scroll-snap): indipendente dal watcher CSS.
 */

export type MealCarouselItem = {
  slotKey: string;
  label: string;
  time: string;
  confirmed: boolean;
  card: ReactNode;
};

export function MealDayCarousel({
  items,
  onConfirmMeal,
  confirmBusySlot,
  extraAdd,
}: {
  items: MealCarouselItem[];
  onConfirmMeal: (slotKey: string, next: boolean) => void;
  confirmBusySlot: string | null;
  /** null = quick-add nascosto (es. schede admin/coach in sola lettura). */
  extraAdd: { athleteId: string; entryDate: string; onSaved?: () => void } | null;
}) {
  const t = useTranslations("MealDayCarousel");
  const trackRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Record<string, HTMLDivElement | null>>({});
  /** Smart-open UNA volta per data: non ri-scrollare a ogni conferma (l'utente resta dov'è). */
  const openedForDateRef = useRef<string | null>(null);

  const scrollToSlot = (slotKey: string, smooth = true) => {
    const el = slideRefs.current[slotKey];
    if (!el) return;
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", inline: "center", block: "nearest" });
  };

  const dateKey = extraAdd?.entryDate ?? "";
  const confirmedSig = items.map((i) => (i.confirmed ? "1" : "0")).join("");
  useEffect(() => {
    const firstOpen = items.find((i) => !i.confirmed) ?? items[items.length - 1];
    if (!firstOpen) return;
    if (openedForDateRef.current !== dateKey) {
      // Mount o cambio data: posizionamento immediato, senza animazione visibile.
      openedForDateRef.current = dateKey;
      setTimeout(() => scrollToSlot(firstOpen.slotKey, false), 50);
    } else {
      // Conferma appena spuntata: avanza dolcemente al primo pasto mancante.
      scrollToSlot(firstOpen.slotKey, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, confirmedSig]);

  const step = (dir: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: dir * Math.round(track.clientWidth * 0.85), behavior: "smooth" });
  };

  return (
    <div>
      {/* Nav: chip per pasto (✓ quando confermato) + frecce. */}
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          aria-label={t("prev")}
          onClick={() => step(-1)}
          className="hidden shrink-0 rounded-full border border-white/15 bg-white/5 p-1.5 text-gray-300 hover:bg-white/10 sm:inline-flex"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {items.map((it) => (
            <button
              key={it.slotKey}
              type="button"
              onClick={() => scrollToSlot(it.slotKey)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition-colors ${
                it.confirmed
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-white/15 bg-white/5 text-gray-300 hover:border-amber-400/50"
              }`}
            >
              {it.confirmed ? <Check className="h-3 w-3" aria-hidden /> : null}
              {it.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label={t("next")}
          onClick={() => step(1)}
          className="hidden shrink-0 rounded-full border border-white/15 bg-white/5 p-1.5 text-gray-300 hover:bg-white/10 sm:inline-flex"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Traccia a scorrimento orizzontale con snap. */}
      <div
        ref={trackRef}
        style={{
          display: "flex",
          gap: 14,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          paddingBottom: 8,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {items.map((it) => (
          <div
            key={it.slotKey}
            ref={(el) => {
              slideRefs.current[it.slotKey] = el;
            }}
            style={{
              scrollSnapAlign: "center",
              flex: "0 0 auto",
              width: "min(100%, 520px)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {it.card}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={confirmBusySlot === it.slotKey}
                onClick={() => onConfirmMeal(it.slotKey, !it.confirmed)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
                  it.confirmed
                    ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                    : "btn-nutrition-cta"
                }`}
              >
                {confirmBusySlot === it.slotKey ? (
                  t("saving")
                ) : it.confirmed ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden /> {t("eaten")}
                  </>
                ) : (
                  t("confirmEaten")
                )}
              </button>
              {extraAdd ? (
                <MealExtraQuickAdd
                  athleteId={extraAdd.athleteId}
                  entryDate={extraAdd.entryDate}
                  mealSlot={it.slotKey}
                  onSaved={extraAdd.onSaved}
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
