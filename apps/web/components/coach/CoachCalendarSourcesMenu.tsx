"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Dumbbell, Search, Sparkles, X } from "lucide-react";
import { LOAD_CHIP_LABEL } from "@/lib/training/load-metrics-labels";
import type { AerobicStarterPreset } from "@/lib/training/library/starter-pack-aerobic";
import type { CoachWorkoutLibraryItemView } from "@/lib/training/library/coach-workout-library-types";
import type { CoachCalendarDragPayload } from "@/lib/training/library/coach-calendar-drag-payload";

export type CoachCalendarSourceTab = "coach" | "empathy";

/**
 * Menù a tendina delle SORGENTI seduta (libreria coach + template Empathy).
 *
 * PERCHÉ un popover e non più l'aside a sinistra: l'aside mangiava 288px+24px di gap e la
 * settimana non ci stava (si vedevano ~3 giorni su 7). Il pannello è `absolute` dentro un
 * wrapper `relative` — stesso principio di CopyWeekTrigger — così l'apertura NON sposta la
 * board di un pixel.
 *
 * PERCHÉ l'assegnazione è a SELEZIONE e non solo a trascinamento: il drag è HTML5 nativo
 * (nessun polyfill touch) e `/calendario` non ha una rotta mobile dedicata, quindi da iPad il
 * coach riceve questa stessa board e trascinare è impossibile. Cliccare una voce riempie la
 * «mano» della board e il pannello si chiude subito: le celle restano libere per il click.
 * Il trascinamento resta come scorciatoia per il mouse — per questo il pannello NON si chiude
 * su `dragstart`/`drop` e ignora il pointerdown-fuori mentre un drag partito da qui è in volo.
 */
export function CoachCalendarSourcesMenu({
  open,
  onOpenChange,
  tab,
  onTabChange,
  libraryItems,
  libraryLoading,
  libraryError,
  empathyPresets,
  empathyLoading,
  empathyError,
  onDragStartSource,
  onPickSource,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: CoachCalendarSourceTab;
  onTabChange: (tab: CoachCalendarSourceTab) => void;
  libraryItems: CoachWorkoutLibraryItemView[];
  libraryLoading: boolean;
  libraryError: string | null;
  empathyPresets: AerobicStarterPreset[];
  empathyLoading: boolean;
  empathyError: string | null;
  /** Avvio drag HTML5 di una voce (scorciatoia mouse): payload nel `dataTransfer`. */
  onDragStartSource: (e: DragEvent<HTMLElement>, payload: CoachCalendarDragPayload) => void;
  /** Click su una voce: la seduta va «in mano» alla board, il pannello si chiude. */
  onPickSource: (payload: CoachCalendarDragPayload, title: string) => void;
}) {
  const t = useTranslations("CoachCalendarBoard");
  const wrapRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  // Drag in volo partito da questo pannello: blocca la chiusura su pointerdown-fuori.
  // Smontare il nodo trascinato annullerebbe il drag in Chrome/Safari.
  const draggingRef = useRef(false);

  const [filter, setFilter] = useState("");

  // Chiusura su Escape e pointerdown fuori dal wrapper (trigger incluso).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (draggingRef.current) return;
      if (wrapRef.current && e.target instanceof Node && !wrapRef.current.contains(e.target)) onOpenChange(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  // Accessibilità dialog: focus sul primo controllo (il filtro) all'apertura.
  useEffect(() => {
    if (open) filterRef.current?.focus();
  }, [open]);

  // Un drag interrotto fuori dal pannello lascerebbe la guardia accesa: resetto alla chiusura.
  useEffect(() => {
    if (!open) draggingRef.current = false;
  }, [open]);

  const needle = filter.trim().toLowerCase();
  const visibleLibrary = useMemo(() => {
    if (!needle) return libraryItems;
    return libraryItems.filter(
      (i) =>
        i.title.toLowerCase().includes(needle) ||
        i.discipline.toLowerCase().includes(needle) ||
        i.family.toLowerCase().includes(needle),
    );
  }, [libraryItems, needle]);
  const visiblePresets = useMemo(() => {
    if (!needle) return empathyPresets;
    return empathyPresets.filter(
      (p) => p.title.toLowerCase().includes(needle) || p.discipline.toLowerCase().includes(needle),
    );
  }, [empathyPresets, needle]);

  const pick = (payload: CoachCalendarDragPayload, title: string) => {
    onPickSource(payload, title);
    onOpenChange(false);
  };

  const startDrag = (e: DragEvent<HTMLElement>, payload: CoachCalendarDragPayload) => {
    draggingRef.current = true;
    onDragStartSource(e, payload);
  };
  const endDrag = () => {
    draggingRef.current = false;
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => onOpenChange(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-[0.72rem] font-semibold text-violet-100 transition hover:border-violet-300/60 hover:bg-violet-500/20"
      >
        <Dumbbell className="h-3.5 w-3.5" aria-hidden />
        {t("sourcesMenuTrigger")}
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t("sourcesMenuTitle")}
          /* right-0: il pannello scende sulle colonne finali della settimana, mai sulla colonna
             atleti a sinistra. w-[min(...)]: su telefono non deborda dal viewport. */
          className="absolute right-0 top-full z-40 mt-1.5 w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-violet-400/30 bg-zinc-950/95 p-3 text-left shadow-xl shadow-black/50 backdrop-blur"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-violet-100">{t("sourcesMenuTitle")}</p>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={t("sourcesMenuClose")}
              title={t("sourcesMenuClose")}
              className="flex shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 p-1 text-gray-300 transition hover:border-white/30 hover:text-white"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          <div className="mt-3 flex rounded-lg border border-white/10 bg-black/20 p-0.5">
            <button
              type="button"
              onClick={() => onTabChange("coach")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[0.7rem] font-semibold transition ${
                tab === "coach" ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Dumbbell className="h-3.5 w-3.5" aria-hidden />
              {t("coachSourcesTab")}
            </button>
            <button
              type="button"
              onClick={() => onTabChange("empathy")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[0.7rem] font-semibold transition ${
                tab === "empathy" ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {t("empathySourcesTab")}
            </button>
          </div>

          {/* Il filtro serve ORA che le liste non sono più sempre a vista (20+ template). */}
          <label className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
            <input
              ref={filterRef}
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("sourcesFilter")}
              aria-label={t("sourcesFilter")}
              className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-gray-600"
            />
          </label>

          <p className="mt-2 text-[0.7rem] text-gray-500">
            {tab === "coach" ? t("sourcesHint") : t("empathySourcesHint")}
          </p>

          {/* Scroll interno: il pannello non deve crescere oltre la board. */}
          <div className="mt-2 max-h-[20rem] overflow-y-auto pr-0.5">
            {tab === "coach" ? (
              libraryLoading ? (
                <p className="py-3 text-xs text-gray-500">{t("sourcesLoading")}</p>
              ) : libraryError ? (
                <p className="py-3 text-xs text-amber-200" role="alert">
                  {t("sourcesError")}
                </p>
              ) : libraryItems.length === 0 ? (
                <p className="py-3 text-xs text-gray-500">{t("sourcesEmpty")}</p>
              ) : visibleLibrary.length === 0 ? (
                <p className="py-3 text-xs text-gray-500">{t("sourcesFilterEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {visibleLibrary.map((item) => {
                    const payload: CoachCalendarDragPayload = {
                      kind: "coach-item",
                      itemId: item.id,
                      title: item.title,
                    };
                    return (
                      /* `draggable` sull'<li> (non sul <button>): su Firefox il drag da un
                         <button draggable> è inaffidabile. Il click secco seleziona. */
                      <li
                        key={item.id}
                        draggable
                        onDragStart={(e) => startDrag(e, payload)}
                        onDragEnd={endDrag}
                        className="cursor-grab select-none rounded-xl border border-white/10 bg-black/25 transition hover:border-white/25 active:cursor-grabbing"
                      >
                        <button
                          type="button"
                          onClick={() => pick(payload, item.title)}
                          className="block w-full px-3 py-2.5 text-left"
                        >
                          <span className="block truncate text-sm font-medium text-white">{item.title}</span>
                          <span className="mt-0.5 block text-[0.7rem] text-gray-500">
                            <span className="uppercase tracking-wide">{t(`family.${item.family}`)}</span>
                            {" · "}
                            {item.durationMinutes}m{" · "}
                            {LOAD_CHIP_LABEL} {item.tssTarget}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : empathyLoading ? (
              <p className="py-3 text-xs text-gray-500">{t("empathyLoading")}</p>
            ) : empathyError ? (
              <p className="py-3 text-xs text-amber-200" role="alert">
                {t("empathyError")}
              </p>
            ) : empathyPresets.length === 0 ? (
              <p className="py-3 text-xs text-gray-500">{t("empathyEmpty")}</p>
            ) : visiblePresets.length === 0 ? (
              <p className="py-3 text-xs text-gray-500">{t("sourcesFilterEmpty")}</p>
            ) : (
              <ul className="space-y-2">
                {visiblePresets.map((preset) => {
                  const payload: CoachCalendarDragPayload = {
                    kind: "empathy-preset",
                    presetId: preset.presetId,
                    title: preset.title,
                    discipline: preset.discipline,
                  };
                  return (
                    <li
                      key={preset.presetId}
                      draggable
                      onDragStart={(e) => startDrag(e, payload)}
                      onDragEnd={endDrag}
                      className="cursor-grab select-none rounded-xl border border-violet-400/20 bg-violet-500/[0.06] transition hover:border-violet-400/40 active:cursor-grabbing"
                    >
                      <button
                        type="button"
                        onClick={() => pick(payload, preset.title)}
                        className="block w-full px-3 py-2.5 text-left"
                      >
                        <span className="block truncate text-sm font-medium text-white">{preset.title}</span>
                        <span className="mt-0.5 block text-[0.7rem] text-gray-500">
                          <span className="uppercase tracking-wide">{preset.discipline}</span>
                          {" · "}
                          {preset.plannedMinutes}m{" · "}
                          {LOAD_CHIP_LABEL} {preset.tss}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="mt-2 border-t border-white/5 pt-2 text-[0.65rem] text-gray-600">{t("sourcesDragHint")}</p>
        </div>
      ) : null}
    </div>
  );
}
