import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import type { Pro2SectionAccent } from "@/components/shell/Pro2SectionCard";
import { cn } from "@/lib/cn";

const ACCENT: Record<Pro2SectionAccent, { border: string; chevron: string }> = {
  fuchsia: { border: "border-fuchsia-500/25", chevron: "text-fuchsia-300" },
  violet: { border: "border-violet-500/25", chevron: "text-violet-300" },
  cyan: { border: "border-cyan-500/25", chevron: "text-cyan-300" },
  orange: { border: "border-orange-500/25", chevron: "text-orange-300" },
  emerald: { border: "border-emerald-500/25", chevron: "text-emerald-300" },
  amber: { border: "border-amber-500/25", chevron: "text-amber-300" },
  rose: { border: "border-rose-500/25", chevron: "text-rose-300" },
  slate: { border: "border-white/15", chevron: "text-slate-300" },
  sky: { border: "border-sky-500/25", chevron: "text-sky-300" },
  teal: { border: "border-teal-500/25", chevron: "text-teal-300" },
  lime: { border: "border-lime-500/25", chevron: "text-lime-300" },
};

export interface Pro2AccordionProps {
  id?: string;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  accent?: Pro2SectionAccent;
  children: ReactNode;
}

/**
 * Accordion canone Pro2 per «Dettagli e motore» e sezioni avanzate collassabili.
 * `<details>` nativo: nessuno stato client, chevron ruotante via `group-open`.
 * L'`id` opzionale ha `scroll-mt-28` per gli anchor delle subnav sticky.
 */
export function Pro2Accordion({
  id,
  title,
  subtitle,
  defaultOpen = false,
  accent,
  children,
}: Pro2AccordionProps) {
  const a = accent ? ACCENT[accent] : null;
  return (
    <details
      id={id}
      open={defaultOpen}
      className={cn(
        "group scroll-mt-28 rounded-2xl border bg-white/[0.02]",
        a ? a.border : "border-white/10",
      )}
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-2xl px-4 py-3.5 transition hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">{title}</span>
          {subtitle ? <span className="mt-0.5 block text-xs text-gray-400">{subtitle}</span> : null}
        </span>
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180",
            a ? a.chevron : "text-gray-400",
          )}
          aria-hidden
        />
      </summary>
      <div className="border-t border-white/10 px-4 pb-4 pt-3">{children}</div>
    </details>
  );
}
