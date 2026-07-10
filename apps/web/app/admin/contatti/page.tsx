import type { Metadata } from "next";
import { AdminContactList } from "@/components/admin/contact/AdminContactList";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contatti · Admin",
  description: "Messaggi dai form Contattaci e Collabora con Empathy.",
};

/** Pannello Contatti: submission dei form pubblici (Contattaci / Collabora). */
export default function AdminContattiPage() {
  return (
    <Pro2ModulePageShell
      eyebrow="Contatti · Admin"
      eyebrowClassName="text-rose-400"
      title="Contatti & Collaborazioni"
      description={
        <span className="text-sm text-gray-400">
          I messaggi inviati dai form pubblici <span className="font-mono text-gray-300">Contattaci</span> e{" "}
          <span className="font-mono text-gray-300">Collabora con Empathy</span>. Filtra, leggi e archivia.
        </span>
      }
    >
      <AdminContactList />
    </Pro2ModulePageShell>
  );
}
