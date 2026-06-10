import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";

export const metadata: Metadata = { title: "Commissioni" };

/**
 * Voce account-fissa del coach. Gestione commissioni/compensi (feature da costruire).
 * Placeholder volutamente neutro finché non esiste il modello dati / API.
 */
export default function CommissioniPage() {
  return (
    <Pro2ModulePageShell
      eyebrow="Commissioni · Coach"
      title="Commissioni"
      description={
        <span className="text-sm text-gray-400">
          Compensi e commissioni del tuo account coach. Modulo in arrivo.
        </span>
      }
    >
      <Pro2SectionCard accent="slate" title="In arrivo" subtitle="Commissioni del coach" icon={Wallet}>
        <p className="text-sm leading-relaxed text-gray-400">
          Qui gestirai le commissioni legate al tuo account. Resta una voce fissa, indipendente dall&apos;atleta
          selezionato.
        </p>
      </Pro2SectionCard>
    </Pro2ModulePageShell>
  );
}
