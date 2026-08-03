import type { Metadata } from "next";
import { AdminAlertsView } from "@/components/admin/alerts/AdminAlertsView";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Alert · Admin",
  description: "Alert non letti di tutta la piattaforma: sonno, allenamento, piano nutrizionale.",
};

/**
 * Pannello Alert: la vista d'insieme che il coach NON ha (lui vede solo i suoi atleti) e che
 * l'admin non aveva da nessuna parte — la shell lo confina in /admin, quindi la dashboard coach
 * non è la sua superficie. Letture Supabase dirette dal browser (DB-first), abilitate dalla
 * policy `athlete_alerts_admin_read` (migrazione 20260803120000).
 */
export default function AdminAlertPage() {
  return (
    <Pro2ModulePageShell
      eyebrow="Alert · Admin"
      eyebrowClassName="text-rose-400"
      title="Alert"
      description={
        <span className="text-sm text-gray-400">
          Alert non letti delle ultime 48 ore su tutta la piattaforma, dal più recente: chi li ha
          generati, quando sono arrivati e di quanto si è fuori. Dal nome si apre la scheda «Oggi»
          dell&apos;atleta.
        </span>
      }
    >
      <AdminAlertsView />
    </Pro2ModulePageShell>
  );
}
