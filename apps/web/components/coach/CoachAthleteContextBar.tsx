"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Award,
  Calendar,
  Cpu,
  Heart,
  type LucideIcon,
  Move,
  UserRound,
  Utensils,
  Wind,
  X,
} from "lucide-react";
import { PRODUCT_MODULE_NAV, type ProductNavIconKey } from "@/core/navigation/module-registry";
import { cn } from "@/lib/cn";

const ICONS: Partial<Record<ProductNavIconKey, LucideIcon>> = {
  heart: Heart,
  activity: Activity,
  calendar: Calendar,
  utensils: Utensils,
  pulse: Cpu,
  motion: Move,
  wind: Wind,
  award: Award,
};

/**
 * Barra contestuale dell'atleta selezionato dal coach — stesso pattern della
 * AdminUserContextBar: identità, tab orizzontali con le schede, ✕ per chiudere.
 * Montata dal layout su tutte le rotte /athletes/[athleteId]/...
 * La sidebar coach resta SOLO con le voci account.
 */
export function CoachAthleteContextBar({
  athleteId,
  label,
  email,
}: {
  athleteId: string;
  label: string;
  email: string | null;
}) {
  const pathname = usePathname() ?? "";
  const base = `/athletes/${athleteId}`;

  const pills = PRODUCT_MODULE_NAV.filter((m) => m.scope === "athlete").map((m) => ({
    key: m.module,
    label: m.label,
    href: `${base}/${m.module}`,
    icon: ICONS[m.icon] ?? UserRound,
  }));

  return (
    <div className="sticky top-0 z-30 border-b border-fuchsia-500/20 bg-[#120a14]/95 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 px-4 pt-2.5 sm:px-6">
        <p className="truncate font-mono text-[0.65rem] uppercase tracking-[0.2em] text-fuchsia-200/90">
          Atleta · {label}
          {email && email !== label ? <span className="text-fuchsia-200/50"> · {email}</span> : null}
        </p>
        <Link
          href="/athletes"
          title="Togli la selezione"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300 transition hover:border-fuchsia-500/40 hover:text-white"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Chiudi
        </Link>
      </div>
      <nav
        aria-label="Schede atleta selezionato"
        className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2.5 pt-2 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pills.map((p) => {
          const active = pathname.startsWith(p.href);
          const Icon = p.icon;
          return (
            <Link
              key={p.key}
              href={p.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "border-transparent bg-gradient-to-r from-purple-600 to-orange-500 text-white shadow-md shadow-purple-500/20"
                  : "border-white/10 bg-white/5 text-gray-400 hover:border-fuchsia-500/40 hover:text-gray-200",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {p.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
