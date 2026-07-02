import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("CalendarioPage");
  return (
    <Pro2ModulePageShell
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={
        <span className="text-sm text-gray-400">
          {t("description")}
        </span>
      }
    >
      <Pro2SectionCard accent="cyan" title={t("comingSoonTitle")} subtitle={t("comingSoonSubtitle")} icon={CalendarDays}>
        <p className="text-sm leading-relaxed text-gray-400">
          {t("comingSoonBody")}
        </p>
      </Pro2SectionCard>
    </Pro2ModulePageShell>
  );
}
