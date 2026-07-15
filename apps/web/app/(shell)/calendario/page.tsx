import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { CoachCalendarBoardView } from "@/components/coach/CoachCalendarBoardView";
import { redirectIfShellRoleNotAllowed } from "@/lib/auth/redirect-role-gate";

export const metadata: Metadata = { title: "Calendar" };

/**
 * Voce account-fissa del coach. Calendario operativo: board a due colonne — pannello sorgenti
 * (sedute di libreria) a sinistra, griglia settimana × atleti (sola lettura) a destra.
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
