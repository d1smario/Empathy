import type { Metadata } from "next";
import { AdminExercisesManager } from "@/components/admin/exercises/AdminExercisesManager";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Esercizi · Admin",
  description: "Catalogo unificato del motore allenamenti: ricerca, creazione, modifica ed eliminazione.",
};

/**
 * Pannello Esercizi: gestione del catalogo unificato del motore allenamenti,
 * parametrico da DB (tabella `exercise`) — lista paginata, ricerca, filtro dominio,
 * creazione/modifica con form completo ed eliminazione protetta dai riferimenti workout.
 */
export default function AdminEserciziPage() {
  return (
    <Pro2ModulePageShell
      contentMaxWidthClassName="max-w-none"
      eyebrow="Esercizi · Admin"
      eyebrowClassName="text-rose-400"
      title="Esercizi"
      description={
        <span className="text-sm text-gray-400">
          Il catalogo esercizi del motore allenamenti: <span className="text-violet-300">domini</span>, pattern
          di movimento, gruppi muscolari, sistemi e carichi. Tutto parametrico da database.
        </span>
      }
    >
      <AdminExercisesManager />
    </Pro2ModulePageShell>
  );
}
