import type { Metadata } from "next";
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
  return (
    <Pro2ModulePageShell
      eyebrow="Commissioni · Coach"
      eyebrowClassName="text-amber-400"
      title="Commissioni"
      description={
        <span className="text-sm text-gray-400">
          I compensi maturati dalle vendite collegate al tuo account: richiedi il pagamento delle commissioni
          maturate e segui lo stato delle richieste.
        </span>
      }
    >
      <CoachCommissionsView />
    </Pro2ModulePageShell>
  );
}
