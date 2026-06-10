import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";

export const metadata: Metadata = { title: "Calendario" };

/**
 * Voce account-fissa del coach. Calendario operativo del coach (contenuto in definizione).
 * Placeholder volutamente neutro finché non è specificato il modello dati.
 */
export default function CalendarioPage() {
  return (
    <Pro2ModulePageShell
      eyebrow="Calendario · Coach"
      title="Calendario"
      description={
        <span className="text-sm text-gray-400">
          Agenda del coach. Modulo in arrivo: qui troverai appuntamenti, sessioni e impegni del tuo account.
        </span>
      }
    >
      <Pro2SectionCard accent="cyan" title="In arrivo" subtitle="Calendario del coach" icon={CalendarDays}>
        <p className="text-sm leading-relaxed text-gray-400">
          Stiamo definendo il calendario operativo del coach. Resta una voce fissa del tuo account, indipendente
          dall&apos;atleta selezionato.
        </p>
      </Pro2SectionCard>
    </Pro2ModulePageShell>
  );
}
