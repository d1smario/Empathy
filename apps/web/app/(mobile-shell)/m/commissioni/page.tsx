import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CoachCommissionsView } from "@/components/coach/CoachCommissionsView";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { redirectIfShellRoleNotAllowed } from "@/lib/auth/redirect-role-gate";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MCommissioniPage");
  return { title: t("metaTitle") };
}

/** Commissioni del coach (shell mobile): stessa vista del desktop. Solo coach. */
export default async function MobileCommissioniPage() {
  await redirectIfShellRoleNotAllowed(["coach"]);
  const t = await getTranslations("MCommissioniPage");
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
