import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/navigation/ModulePlaceholder";
import { redirectIfShellRoleNotAllowed } from "@/lib/auth/redirect-role-gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Atleti" };

/**
 * Hub coach: stato account, roster e inviti (stessa superficie che il catch-all
 * [module] rendeva prima). Pagina dedicata perché sotto vive la selezione
 * atleta a URL: /athletes/[athleteId]/[module].
 */
export default async function AthletesPage() {
  await redirectIfShellRoleNotAllowed(["coach"]);
  return <ModulePlaceholder module="athletes" />;
}
