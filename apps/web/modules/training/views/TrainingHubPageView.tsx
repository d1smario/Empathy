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
      eyebrow="Allenamento"
      eyebrowClassName="text-orange-400"
      title="Allenamento"
      description="Il punto di partenza: crea le tue sedute, consulta il calendario, analizza i dati e segui il piano annuale."
      headerActions={
        <>
          <HubLink
            href="/dashboard"
            variant="secondary"
            className="justify-center border-orange-500/30 bg-orange-500/10 text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20"
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
        accent="orange"
        title="Percorsi"
        subtitle="Quattro viste prodotto + Virya (piano annuale)"
        icon={Sparkles}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <HubLink href="/training/builder" variant="primary" className="justify-center py-4">
            <Sparkles className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            Builder sessione
          </HubLink>
          <HubLink
            href="/training/calendar"
            variant="secondary"
            className="justify-center border-orange-500/30 bg-orange-500/10 py-4 text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20"
          >
            <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-orange-300" aria-hidden />
            Calendar
          </HubLink>
          <HubLink
            href="/training/session"
            variant="secondary"
            className="justify-center border-orange-500/30 bg-orange-500/10 py-4 text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20"
          >
            <CalendarClock className="mr-2 h-4 w-4 shrink-0 text-orange-300" aria-hidden />
            Giornata training
          </HubLink>
          <HubLink
            href="/physiology/daily"
            variant="secondary"
            className="justify-center border-orange-500/30 bg-orange-500/10 py-4 text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20"
          >
            <HeartPulse className="mr-2 h-4 w-4 shrink-0 text-orange-300" aria-hidden />
            Wellness giornaliero
          </HubLink>
          <HubLink
            href="/training/analytics"
            variant="secondary"
            className="justify-center border-orange-500/30 bg-orange-500/10 py-4 text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20"
          >
            <BarChart3 className="mr-2 h-4 w-4 shrink-0 text-orange-300" aria-hidden />
            Analyzer
          </HubLink>
          <HubLink
            href="/training/vyria"
            variant="secondary"
            className="justify-center border-orange-500/30 bg-orange-500/10 py-4 text-orange-100 hover:border-orange-400/50 hover:bg-orange-500/20"
          >
            <CalendarRange className="mr-2 h-4 w-4 shrink-0 text-orange-300" aria-hidden />
            Virya · annual
          </HubLink>
        </div>
      </Pro2SectionCard>
    </Pro2ModulePageShell>
  );
}
