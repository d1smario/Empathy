import { notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session-profile";

export const dynamic = "force-dynamic";

/**
 * Virya solo per coach/admin, gemello di `training/builder/layout.tsx`.
 *
 * Prima l'unica difesa viveva DENTRO la vista: la pagina si caricava e poi il browser
 * rimandava al calendario. Non è una difesa — è un sipario che si chiude dopo che lo
 * spettacolo è iniziato: il server aveva già mandato la pagina, e chi guardava la risposta
 * grezza (o navigava senza JavaScript) la vedeva comunque. Qui il 404 è del server.
 *
 * Il coach ci arriva scoped via /athletes/[id]/training/vyria.
 */
export default async function TrainingViryaLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionProfile();
  if (session.role !== "coach" && !session.isPlatformAdmin) {
    notFound();
  }
  return <>{children}</>;
}
