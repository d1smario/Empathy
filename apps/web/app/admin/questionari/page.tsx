import type { Metadata } from "next";
import { AdminQuestionnairesManager } from "@/components/admin/questionnaires/AdminQuestionnairesManager";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Questionari · Admin",
  description: "Gestione dei questionari per gli atleti (domande e risposte, ultima-vince).",
};

/** Pannello Questionari: crea/modifica questionari e domande per gli atleti. */
export default function AdminQuestionariPage() {
  return (
    <Pro2ModulePageShell
      eyebrow="Questionari · Admin"
      eyebrowClassName="text-rose-400"
      title="Questionari"
      description={
        <span className="text-sm text-gray-400">
          Definisci questionari e domande (testo, numero, sì/no, scelta) per gli atleti. Ogni atleta ha
          una sola risposta per domanda, che si sovrascrive; il coach vede le risposte dei propri atleti.
        </span>
      }
    >
      <AdminQuestionnairesManager />
    </Pro2ModulePageShell>
  );
}
