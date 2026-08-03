import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { CoachCalendarBoardView } from "@/components/coach/CoachCalendarBoardView";
import { redirectIfShellRoleNotAllowed } from "@/lib/auth/redirect-role-gate";

export const metadata: Metadata = { title: "Calendar" };

/**
 * Voce account-fissa del coach. Calendario operativo a TUTTA larghezza: griglia settimana ×
 * atleti su una colonna sola, con le sorgenti (sedute di libreria + template Empathy) in un
 * menù a tendina nella barra settimana. L'assegnazione è a selezione («in mano» → «Assegna
 * qui» sul giorno), col trascinamento mantenuto come scorciatoia per il mouse.
 */
export default async function CalendarioPage() {
  await redirectIfShellRoleNotAllowed(["coach"]);
  const t = await getTranslations("CalendarioPage");
  return (
    <Pro2ModulePageShell
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={<span className="text-sm text-gray-400">{t("description")}</span>}
      contentMaxWidthClassName="max-w-none"
    >
      <CoachCalendarBoardView />
    </Pro2ModulePageShell>
  );
}
