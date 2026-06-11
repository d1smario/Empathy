"use client";

import type { ReactNode } from "react";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link, pro2ButtonClassName, type Pro2ButtonVariant } from "@/components/ui/empathy";
import { cn } from "@/lib/cn";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { BarChart3, CalendarClock, CalendarDays, CalendarRange, HeartPulse, Sparkles } from "lucide-react";

const ADMIN_SCOPED_TITLE = "Disponibile nella scheda dedicata (v2)";

/** Link hub: nelle schede admin diventa inerte (span) verso le rotte shell coach. */
function HubLink({
  href,
  variant = "secondary",
  className,
  children,
}: {
  href: string;
  variant?: Pro2ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  const { adminScoped } = useActiveAthlete();
  if (adminScoped) {
    return (
      <span
        className={pro2ButtonClassName(variant, cn(className, "cursor-default opacity-50"))}
        title={ADMIN_SCOPED_TITLE}
      >
        {children}
      </span>
    );
  }
  return (
    <Pro2Link href={href} variant={variant} className={className}>
      {children}
    </Pro2Link>
  );
}

/** Hub training: shell e sezioni canone Pro 2 (allineato a Builder). */
export default function TrainingHubPageView() {
  const { adminScoped } = useActiveAthlete();
  return (
    <Pro2ModulePageShell
      eyebrow="Training · Hub"
      eyebrowClassName="text-orange-400"
      title="Allenamento"
      description="Hub moduli: Builder, Calendar, Analyzer e Virya condividono la stessa linea dati e un solo motore di sessione."
      headerActions={
        <>
          <HubLink
            href="/dashboard"
            variant="secondary"
            className="justify-center border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15"
          >
            Dashboard
          </HubLink>
        </>
      }
    >
      {/* Subnav condivisa: nelle schede admin i suoi link restano visibili ma inerti */}
      <div
        className={cn("scroll-mt-28", adminScoped && "pointer-events-none opacity-50")}
        title={adminScoped ? ADMIN_SCOPED_TITLE : undefined}
      >
        <TrainingSubnav />
      </div>

      <Pro2SectionCard
        accent="fuchsia"
        title="Percorsi"
        subtitle="Quattro viste prodotto + Virya (piano annuale)"
        icon={Sparkles}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <HubLink
            href="/training/builder"
            variant="secondary"
            className="justify-center border border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-600/25 to-violet-600/20 py-4 hover:from-fuchsia-600/35 hover:to-violet-600/30"
          >
            <Sparkles className="mr-2 h-4 w-4 shrink-0 text-fuchsia-300 drop-shadow-[0_0_8px_rgba(232,121,249,0.45)]" aria-hidden />
            Builder sessione
          </HubLink>
          <HubLink
            href="/training/calendar"
            variant="secondary"
            className="justify-center border border-sky-500/40 bg-sky-500/10 py-4 hover:bg-sky-500/15"
          >
            <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.45)]" aria-hidden />
            Calendar
          </HubLink>
          <HubLink
            href="/training/session"
            variant="secondary"
            className="justify-center border border-orange-500/40 bg-orange-500/10 py-4 hover:bg-orange-500/15"
          >
            <CalendarClock className="mr-2 h-4 w-4 shrink-0 text-orange-300 drop-shadow-[0_0_8px_rgba(251,146,60,0.45)]" aria-hidden />
            Giornata training
          </HubLink>
          <HubLink
            href="/physiology/daily"
            variant="secondary"
            className="justify-center border border-emerald-500/40 bg-emerald-500/10 py-4 hover:bg-emerald-500/15"
          >
            <HeartPulse className="mr-2 h-4 w-4 shrink-0 text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]" aria-hidden />
            Wellness giornaliero
          </HubLink>
          <HubLink
            href="/training/analytics"
            variant="secondary"
            className="justify-center border border-rose-500/40 bg-rose-500/10 py-4 hover:bg-rose-500/15"
          >
            <BarChart3 className="mr-2 h-4 w-4 shrink-0 text-rose-300 drop-shadow-[0_0_8px_rgba(251,113,133,0.4)]" aria-hidden />
            Analyzer
          </HubLink>
          <HubLink
            href="/training/vyria"
            variant="secondary"
            className="justify-center border border-amber-500/40 bg-amber-500/10 py-4 hover:bg-amber-500/15"
          >
            <CalendarRange className="mr-2 h-4 w-4 shrink-0 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]" aria-hidden />
            Virya · annual
          </HubLink>
        </div>
      </Pro2SectionCard>
    </Pro2ModulePageShell>
  );
}
