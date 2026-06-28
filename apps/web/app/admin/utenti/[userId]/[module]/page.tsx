import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserRound } from "lucide-react";
import { ScopedAthleteModuleView } from "@/components/athlete-scope/ScopedAthleteModuleView";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { SCOPED_ATHLETE_TABS } from "@/core/navigation/module-registry";
import { getAdminSelectedUser } from "@/lib/admin/selected-user";

export const dynamic = "force-dynamic";

type PageProps = { params: { userId: string; module: string } };

export function generateMetadata({ params }: PageProps): Metadata {
  const tab = SCOPED_ATHLETE_TABS.find((x) => x.module === params.module);
  return { title: tab ? `${tab.label} · Utente · Admin` : "Utente · Admin" };
}

/**
 * Scheda modulo dell'utente selezionato: monta la STESSA vista del coach/atleta
 * ("fotocopia") nello scope dell'atleta preso dall'URL. I tab provengono da
 * SCOPED_ATHLETE_TABS (Dashboard + 6 moduli) → identici a quelli dell'atleta.
 * Identità e tab vivono nella barra contestuale (layout). L'admin legge e modifica
 * tutto: policy DB `platform_admin_all` (078) + gate API `canAccessAthleteData`.
 */
export default async function AdminSelectedUserModulePage({ params }: PageProps) {
  const moduleItem = SCOPED_ATHLETE_TABS.find((x) => x.module === params.module);
  if (!moduleItem) notFound();

  const user = await getAdminSelectedUser(params.userId);
  if (!user) notFound();

  // Account senza profilo atleta: niente dati da mostrare in nessun modulo.
  if (!user.athleteId) {
    return (
      <Pro2ModulePageShell
        eyebrow={`${moduleItem.label} · Utente`}
        eyebrowClassName="text-rose-400"
        title={moduleItem.label}
        description={
          <span className="text-sm text-gray-400">
            <strong className="text-gray-200">{user.email ?? user.userId}</strong> non ha ancora un profilo
            atleta collegato: nessun dato da mostrare.
          </span>
        }
      >
        <Pro2SectionCard accent="slate" title="Profilo atleta assente" subtitle="Si crea al primo accesso dell'utente" icon={UserRound}>
          <p className="text-sm leading-relaxed text-gray-400">
            Il profilo atleta nasce al primo login dell&apos;utente (bootstrap automatico). Appena esiste, questa
            scheda mostrerà i suoi dati.
          </p>
        </Pro2SectionCard>
      </Pro2ModulePageShell>
    );
  }

  return (
    <ScopedAthleteModuleView module={moduleItem.module} athleteId={user.athleteId} scopeOwnerUserId={user.userId} />
  );
}
