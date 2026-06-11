"use client";

import type { PasswordStrengthLevel } from "@/lib/auth/password-strength";

/** Ordine semaforo: rosso (debole) → giallo (media) → verde (sicura). */
const LIGHTS: { key: Exclude<PasswordStrengthLevel, "empty">; on: string; off: string }[] = [
  { key: "weak", on: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]", off: "bg-red-500/15" },
  { key: "medium", on: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]", off: "bg-amber-400/15" },
  { key: "strong", on: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]", off: "bg-emerald-500/15" },
];

const RANK: Record<PasswordStrengthLevel, number> = { empty: 0, weak: 1, medium: 2, strong: 3 };

const LABEL_COLOR: Record<PasswordStrengthLevel, string> = {
  empty: "text-gray-600",
  weak: "text-red-400",
  medium: "text-amber-300",
  strong: "text-emerald-300",
};

/**
 * Semaforo robustezza password: tre lucine che si accendono progressivamente
 * (rosso → giallo → verde) in base al livello stimato.
 */
export function PasswordStrengthMeter({ level, label }: { level: PasswordStrengthLevel; label: string }) {
  const rank = RANK[level];
  return (
    <div className="mt-1.5 flex items-center gap-2" aria-live="polite">
      <div className="flex items-center gap-1.5">
        {LIGHTS.map((light, i) => {
          const lit = rank >= i + 1;
          return (
            <span
              key={light.key}
              className={`h-2 w-2 rounded-full transition-all ${lit ? light.on : light.off}`}
              aria-hidden
            />
          );
        })}
      </div>
      {label ? <span className={`text-[0.65rem] font-medium ${LABEL_COLOR[level]}`}>{label}</span> : null}
    </div>
  );
}
