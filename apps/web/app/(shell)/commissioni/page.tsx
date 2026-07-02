import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CoachCommissionsView } from "@/components/coach/CoachCommissionsView";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { redirectIfShellRoleNotAllowed } from "@/lib/auth/redirect-role-gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Commissioni" };

/**
 * Voce account-fissa del coach: TUTTE le sue commissioni (la dashboard mostra
 * solo le ultime) con filtri di stato, cerca-tutto e richiesta pagamento. DB-first.
 */
export default async function CommissioniPage() {
  await redirectIfShellRoleNotAllowed(["coach"]);
  const t = await getTranslations("CommissioniPage");
  return (
    <Pro2ModulePageShell
      eyebrow={t("eyebrow")}
      eyebrowClassName="text-amber-400"
      title={t("title")}
      description={
        <span className="text-sm text-gray-400">
          {t("description")}
        </span>
      }
    >
      <CoachCommissionsView />
    </Pro2ModulePageShell>
  );
}
