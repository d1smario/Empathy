import type { Metadata } from "next";
import { AdminFaqManager } from "@/components/admin/faq/AdminFaqManager";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FAQ · Admin",
  description: "Gestione domande e risposte della vetrina, bilingue IT/EN.",
};

/** Pannello FAQ: CRUD delle domande frequenti pubblicate su /faq. */
export default function AdminFaqPage() {
  return (
    <Pro2ModulePageShell
      eyebrow="FAQ · Admin"
      eyebrowClassName="text-rose-400"
      title="FAQ"
      description={
        <span className="text-sm text-gray-400">
          Scrivi domande e risposte (IT ed EN), decidi l&apos;ordine e cosa pubblicare. Compaiono sulla pagina
          pubblica <span className="font-mono text-gray-300">/faq</span>.
        </span>
      }
    >
      <AdminFaqManager />
    </Pro2ModulePageShell>
  );
}
