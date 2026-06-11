import type { Metadata } from "next";
import { AdminMailLogManager } from "@/components/admin/mail/AdminMailLogManager";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mail Log · Admin",
  description: "Storico eventi email Postmark: consegne, aperture, click, bounce e spam.",
};

/**
 * Pannello Mail Log: eventi webhook Postmark dalla tabella `email_log` —
 * ricerca per destinatario/oggetto, filtri per tipo evento e stream,
 * dettaglio payload per riga.
 */
export default function AdminMailLogPage() {
  return (
    <Pro2ModulePageShell
      eyebrow="Mail Log · Admin"
      eyebrowClassName="text-rose-400"
      title="Mail Log"
      description={
        <span className="text-sm text-gray-400">
          Storico delle email inviate dalla piattaforma (webhook Postmark): consegne, aperture, click,
          bounce e segnalazioni spam, con payload completo per ogni evento.
        </span>
      }
    >
      <AdminMailLogManager />
    </Pro2ModulePageShell>
  );
}
