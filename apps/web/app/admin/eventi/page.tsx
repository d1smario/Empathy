import type { Metadata } from "next";
import { AdminEventsManager } from "@/components/admin/events/AdminEventsManager";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eventi · Admin",
  description: "Gestione dei prossimi eventi della vetrina (blog IT/EN con immagine).",
};

/** Pannello Eventi: crea/modifica i prossimi eventi mostrati su /faq. */
export default function AdminEventiPage() {
  return (
    <Pro2ModulePageShell
      eyebrow="Eventi · Admin"
      eyebrowClassName="text-rose-400"
      title="Prossimi eventi"
      description={
        <span className="text-sm text-gray-400">
          Crea eventi in stile blog (immagine + testo, IT ed EN), con data e luogo. Compaiono nella sezione
          <span className="font-mono text-gray-300"> Prossimi eventi</span> della pagina pubblica{" "}
          <span className="font-mono text-gray-300">/faq</span>.
        </span>
      }
    >
      <AdminEventsManager />
    </Pro2ModulePageShell>
  );
}
