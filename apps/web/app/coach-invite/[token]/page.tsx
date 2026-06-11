import type { Metadata } from "next";
import { CoachInviteTokenClient } from "./CoachInviteTokenClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invito coach — Empathy",
  description: "Un atleta ti ha invitato a diventare il suo coach su Empathy.",
};

/**
 * Pagina PUBBLICA "Invita il tuo coach" (flusso inverso di /invite: qui è
 * l'ATLETA che segnala il proprio coach, prodotto Silver). DB-first: lookup e
 * accettazione via RPC Supabase direttamente dal browser, nessuna API route.
 */
export default function CoachInvitePage({ params }: { params: { token: string } }) {
  return <CoachInviteTokenClient token={(params.token ?? "").trim()} />;
}
