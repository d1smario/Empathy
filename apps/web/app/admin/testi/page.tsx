import type { Metadata } from "next";

import { AdminTextsManager } from "@/components/admin/testi/AdminTextsManager";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Testi · Admin",
  description: "Modifica i testi del sito e della piattaforma in tutte le lingue, senza deploy.",
};

/**
 * Pagina Testi: editor dei messaggi UI per lingua. Le modifiche restano BOZZE
 * finché non si preme «Pubblica»; da lì `i18n/request.ts` le fonde sopra i JSON
 * del repo a ogni richiesta, senza bisogno di un deploy.
 */
export default function AdminTestiPage() {
  return (
    <Pro2ModulePageShell
      contentMaxWidthClassName="max-w-none"
      eyebrow="Testi · Admin"
      eyebrowClassName="text-rose-400"
      title="Testi"
      description={
        <span className="text-sm text-gray-400">
          Tutti i testi del sito e della piattaforma, con le rispettive traduzioni. Modifica una lingua,
          salva la bozza e premi <strong className="text-gray-200">Pubblica</strong>: il cambiamento va
          online senza passare da un rilascio.
        </span>
      }
    >
      <AdminTextsManager />
    </Pro2ModulePageShell>
  );
}
