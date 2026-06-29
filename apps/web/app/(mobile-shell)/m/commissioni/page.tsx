import type { Metadata } from "next";
import { CoachCommissionsView } from "@/components/coach/CoachCommissionsView";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { redirectIfShellRoleNotAllowed } from "@/lib/auth/redirect-role-gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Commissioni" };

/** Commissioni del coach (shell mobile): stessa vista del desktop. Solo coach. */
export default async function MobileCommissioniPage() {
  await redirectIfShellRoleNotAllowed(["coach"]);
  return (
    <Pro2ModulePageShell
      eyebrow="Commissioni · Coach"
      eyebrowClassName="text-amber-400"
      title="Commissioni"
      description={
        <span className="text-sm text-gray-400">
          I compensi maturati dalle vendite collegate al tuo account: richiedi il pagamento e segui lo stato.
        </span>
      }
    >
      <CoachCommissionsView />
    </Pro2ModulePageShell>
  );
}
