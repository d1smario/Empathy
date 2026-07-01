"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, ChevronDown } from "lucide-react";
import { Pro2Button } from "@/components/ui/empathy";

export type LactateWorkoutPickItem = {
  id: string;
  date: string;
  duration_min: number;
  tss: number;
  sport: string;
};

function formatWorkoutLine(w: LactateWorkoutPickItem) {
  return `${new Date(w.date).toLocaleDateString("en-US")} · ${w.sport} · ${Math.round(w.duration_min)} min · ${Math.round(w.tss)} TSS`;
}

export function LactateWorkoutPickerPro2({
  workouts,
  selectedWorkoutId,
  onSelectWorkoutId,
  variant = "lactate",
}: {
  workouts: LactateWorkoutPickItem[];
  selectedWorkoutId: string;
  onSelectWorkoutId: (id: string) => void;
  /** Stile accent: lactate (ambra) o max oxidate (rosa). */
  variant?: "lactate" | "maxox";
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = workouts.find((w) => w.id === selectedWorkoutId) ?? null;

  const isMox = variant === "maxox";
  const btnClass = isMox
    ? "physiology-pro2-lac-pick-btn physiology-pro2-lac-pick-btn--maxox w-full justify-between gap-3 border border-emerald-500/30 bg-emerald-500/10 py-3 text-left font-semibold text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-500/20"
    : "physiology-pro2-lac-pick-btn w-full justify-between gap-3 border border-emerald-500/30 bg-emerald-500/10 py-3 text-left font-semibold text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-500/20";
  const icoClass = "h-5 w-5 shrink-0 text-emerald-300";

  return (
    <div className={`physiology-pro2-lac-pick${isMox ? " physiology-pro2-lac-pick--maxox" : ""}`} ref={panelRef}>
      <Pro2Button type="button" variant="secondary" className={btnClass} onClick={() => setOpen((o) => !o)} disabled={workouts.length === 0}>
        <span className="flex min-w-0 items-center gap-2">
          <CalendarClock className={icoClass} aria-hidden />
          <span className="truncate">
            {workouts.length === 0
              ? "No session imported"
              : selected
                ? formatWorkoutLine(selected)
                : "Select workout to analyze"}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </Pro2Button>
      {open && workouts.length > 0 ? (
        <div className={`physiology-pro2-lac-pick-pop${isMox ? " physiology-pro2-lac-pick-pop--maxox" : ""}`} role="listbox">
          <p className="physiology-pro2-lac-pick-pop-hint">
            {isMox
              ? "Tap a session: power, VO₂, RER, lactate and SmO₂ go into the Max Oxidate engine (snapshot/aggregates from the file). For a steady-pace segment, prefer those numbers or enter them by hand."
              : "Tap a session: the signals are applied to the lactate engine."}
          </p>
          <div className={`physiology-pro2-lac-pick-chips${isMox ? " physiology-pro2-lac-pick-chips--maxox" : ""}`}>
            {workouts.map((w) => (
              <button
                key={w.id}
                type="button"
                role="option"
                aria-selected={w.id === selectedWorkoutId}
                className={`physiology-pro2-lac-pick-chip${isMox ? " physiology-pro2-lac-pick-chip--maxox" : ""}${w.id === selectedWorkoutId ? " physiology-pro2-lac-pick-chip--on" : ""}`}
                onClick={() => {
                  onSelectWorkoutId(w.id);
                  setOpen(false);
                }}
              >
                {formatWorkoutLine(w)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
