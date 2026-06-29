import type { Metadata } from "next";
import { CoachAthletesModulePanel } from "@/components/coach/CoachAthletesModulePanel";
import { redirectIfShellRoleNotAllowed } from "@/lib/auth/redirect-role-gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Atleti" };

/**
 * Roster coach (shell mobile): stesso pannello del desktop, ma i link "Apri schede"
 * puntano alla shell mobile (basePath /m/athletes → /m/athletes/[id]/dashboard).
 * Solo coach (gate); l'atleta non vede questa rotta nella sua nav.
 */
export default async function MobileAthletesPage() {
  await redirectIfShellRoleNotAllowed(["coach"]);
  return (
    <div className="mx-auto max-w-lg px-2 pb-4 pt-2">
      <CoachAthletesModulePanel basePath="/m/athletes" />
    </div>
  );
}
