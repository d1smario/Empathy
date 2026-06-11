import type { Metadata } from "next";
import { AdminCoachManagement } from "@/components/admin/AdminCoachManagement";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Coach · Admin",
  description: "Convalida ruoli e gestione richieste coach.",
};

/**
 * Pannello Coach, flusso porta-unica: elenco coach con azioni di stato +
 * nomina di nuovi coach scegliendo dall'elenco utenti (nessuna auto-candidatura).
 */
export default function AdminCoachPage() {
  return (
    <Pro2ModulePageShell
      eyebrow="Coach · Admin"
      eyebrowClassName="text-rose-400"
      title="Coach"
      description={
        <span className="text-sm text-gray-400">
          I coach della piattaforma e la nomina di nuovi coach dagli utenti registrati: approva, sospendi o
          revoca il ruolo.
        </span>
      }
    >
      <AdminCoachManagement />
    </Pro2ModulePageShell>
  );
}
