import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { redirectIfShellRoleNotAllowed } from "@/lib/auth/redirect-role-gate";

export const metadata: Metadata = { title: "Calendar" };

/**
 * Voce account-fissa del coach. Calendario operativo del coach (contenuto in definizione).
 * Placeholder volutamente neutro finché non è specificato il modello dati.
 */
export default async function CalendarioPage() {
  await redirectIfShellRoleNotAllowed(["coach"]);
  return (
    <Pro2ModulePageShell
      eyebrow="Calendar · Coach"
      title="Calendar"
      description={
        <span className="text-sm text-gray-400">
          Coach agenda. Module coming soon: here you&apos;ll find appointments, sessions, and commitments for your account.
        </span>
      }
    >
      <Pro2SectionCard accent="cyan" title="Coming soon" subtitle="Coach calendar" icon={CalendarDays}>
        <p className="text-sm leading-relaxed text-gray-400">
          We&apos;re defining the coach&apos;s operational calendar. It stays a fixed item in your account, independent
          of the selected athlete.
        </p>
      </Pro2SectionCard>
    </Pro2ModulePageShell>
  );
}
