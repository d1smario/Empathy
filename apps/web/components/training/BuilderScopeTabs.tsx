"use client";

import Link from "next/link";
import { CalendarRange, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { useActiveAthlete } from "@/lib/use-active-athlete";

/**
 * Toggle di scope della costruzione allenamento (coach/admin):
 *   · «Giorno» = Builder (breve periodo, la singola seduta)
 *   · «Piano»  = Virya/Piano (lungo periodo, periodizzazione stagionale)
 * Due viste dello stesso strumento di programmazione, non due moduli separati.
 * Nascosto agli atleti (che non costruiscono le sedute). Render Link-based:
 * l'active è dato dalla rotta, non da stato locale.
 */
export function BuilderScopeTabs({ active }: { active: "giorno" | "piano" }) {
  const t = useTranslations("TrainingScopeTabs");
  const { role, adminScoped } = useActiveAthlete();
  const isCoachOrAdmin = role === "coach" || adminScoped;
  if (!isCoachOrAdmin) return null;

  const items = [
    { key: "giorno" as const, href: "/training/builder", label: t("day"), hint: t("dayHint"), icon: Sparkles },
    { key: "piano" as const, href: "/training/vyria", label: t("plan"), hint: t("planHint"), icon: CalendarRange },
  ];

  return (
    <div
      className="mb-5 inline-flex rounded-2xl border border-white/10 bg-black/30 p-1"
      role="tablist"
      aria-label={t("aria")}
    >
      {items.map((item) => {
        const isActive = item.key === active;
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
              isActive
                ? "bg-gradient-to-br from-fuchsia-500/25 to-violet-500/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="flex flex-col items-start leading-tight">
              <span>{item.label}</span>
              <span className="text-[0.62rem] font-normal text-slate-500">{item.hint}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
