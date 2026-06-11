"use client";

import { useCallback, useEffect, useState } from "react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Button } from "@/components/ui/empathy";
import { coachOrgIdForClient } from "@/lib/coach-org-id";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { UserPlus } from "lucide-react";

type CoachReferralInviteRow = {
  id: string;
  token: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

const INVITE_TTL_DAYS = 14;

function randomInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function inviteHref(token: string): string {
  if (typeof window === "undefined") return `/coach-invite/${token}`;
  return `${window.location.origin}/coach-invite/${token}`;
}

function formatDateIt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function inviteStatus(invite: CoachReferralInviteRow): { label: string; className: string; active: boolean } {
  if (invite.consumed_at) {
    return { label: "Consumato", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200", active: false };
  }
  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    return { label: "Scaduto", className: "border-amber-500/40 bg-amber-500/10 text-amber-200", active: false };
  }
  return {
    label: `Attivo fino al ${formatDateIt(invite.expires_at)}`,
    className: "border-cyan-500/40 bg-cyan-500/10 text-cyan-100",
    active: true,
  };
}

/**
 * Card "Invita il tuo coach" (profilo atleta, prodotto Silver): genera link con token
 * su `coach_referral_invites` (RLS: solo le proprie righe). Il coach apre il link,
 * si registra o accede e viene collegato; l'attivazione finale resta all'admin Empathy.
 */
export function InviteCoachCard() {
  const { athleteId, userId } = useActiveAthlete();
  const [invites, setInvites] = useState<CoachReferralInviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setError("Supabase non configurato: inviti coach non disponibili.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: readError } = await supabase
      .from("coach_referral_invites")
      .select("id, token, expires_at, consumed_at, created_at")
      .order("created_at", { ascending: false });
    if (readError) {
      setError(readError.message);
      setInvites([]);
    } else {
      setError(null);
      setInvites((data as CoachReferralInviteRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const generateInvite = useCallback(async () => {
    if (busy) return;
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setError("Supabase non configurato: inviti coach non disponibili.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? userId;
      if (!uid) {
        setError("Sessione non disponibile: riprova dopo il login.");
        return;
      }
      if (!athleteId) {
        setError("Profilo atleta non ancora pronto: riprova tra qualche secondo.");
        return;
      }
      const token = randomInviteToken();
      const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { error: insertError } = await supabase.from("coach_referral_invites").insert({
        athlete_user_id: uid,
        athlete_id: athleteId,
        org_id: coachOrgIdForClient(),
        token,
        expires_at: expiresAt,
      });
      if (insertError) {
        setError(insertError.message);
        return;
      }
      setLastToken(token);
      await loadInvites();
    } finally {
      setBusy(false);
    }
  }, [athleteId, busy, loadInvites, userId]);

  const copyInviteLink = useCallback(async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteHref(token));
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken((current) => (current === token ? null : current)), 2500);
    } catch {
      setError("Copia non riuscita: seleziona e copia il link manualmente.");
    }
  }, []);

  const deleteInvite = useCallback(
    async (invite: CoachReferralInviteRow) => {
      const supabase = createEmpathyBrowserSupabase();
      if (!supabase) return;
      const { error: deleteError } = await supabase.from("coach_referral_invites").delete().eq("id", invite.id);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
      if (lastToken === invite.token) setLastToken(null);
      await loadInvites();
    },
    [lastToken, loadInvites],
  );

  return (
    <Pro2SectionCard
      accent="emerald"
      icon={UserPlus}
      title="Invita il tuo coach"
      subtitle="Prodotto Silver: collega il coach con cui ti alleni"
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-gray-400">
          Genera un link personale e invialo al <span className="font-semibold text-gray-200">tuo coach</span>: aprendolo si
          registra su Empathy (o accede se ha già un account) e viene collegato al tuo profilo. L&apos;attivazione finale del suo
          account coach la fa Empathy con l&apos;approvazione dell&apos;admin.
        </p>

        {error ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Pro2Button type="button" disabled={busy || !athleteId} onClick={() => void generateInvite()}>
            {busy ? "Generazione…" : "Genera link invito"}
          </Pro2Button>
          {!athleteId ? <span className="text-xs text-gray-500">Profilo atleta in caricamento…</span> : null}
        </div>

        {lastToken ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-200">Link generato</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <code className="min-w-0 break-all rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-emerald-100">
                {inviteHref(lastToken)}
              </code>
              <Pro2Button type="button" variant="secondary" onClick={() => void copyInviteLink(lastToken)}>
                {copiedToken === lastToken ? "Copiato!" : "Copia link"}
              </Pro2Button>
            </div>
          </div>
        ) : null}

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">I tuoi inviti</p>
          {loading ? (
            <p className="mt-2 text-sm text-gray-500">Caricamento inviti…</p>
          ) : invites.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">Nessun invito generato finora.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {invites.map((invite) => {
                const status = inviteStatus(invite);
                return (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide ${status.className}`}
                    >
                      {status.label}
                    </span>
                    <span className="text-xs text-gray-500">Creato il {formatDateIt(invite.created_at)}</span>
                    <span className="min-w-0 flex-1 break-all font-mono text-[0.65rem] text-gray-600">
                      …{invite.token.slice(-12)}
                    </span>
                    {status.active ? (
                      <Pro2Button type="button" variant="ghost" onClick={() => void copyInviteLink(invite.token)}>
                        {copiedToken === invite.token ? "Copiato!" : "Copia"}
                      </Pro2Button>
                    ) : null}
                    {!invite.consumed_at ? (
                      <Pro2Button
                        type="button"
                        variant="ghost"
                        className="text-rose-300 hover:text-rose-200"
                        onClick={() => void deleteInvite(invite)}
                      >
                        Elimina
                      </Pro2Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Pro2SectionCard>
  );
}
