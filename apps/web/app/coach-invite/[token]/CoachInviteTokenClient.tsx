"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { Pro2Button } from "@/components/ui/empathy";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

type LookupRow = {
  valid: boolean;
  reason: string;
  athlete_first_name: string | null;
  athlete_last_name: string | null;
  expires_at: string | null;
};

type LookupStatus = "loading" | "valid" | "not_found" | "expired" | "consumed" | "misconfigured" | "error";

type AcceptOutcome = {
  ok: boolean;
  reason?: string;
  coachStatus?: string;
  linked?: boolean;
};

function acceptErrorMessage(reason: string | undefined): string {
  switch (reason) {
    case "cannot_self":
      return "Non puoi accettare il tuo stesso invito: questo link va inviato al tuo coach.";
    case "consumed":
      return "Questo invito è già stato usato da un altro account.";
    case "expired":
      return "Questo invito è scaduto: chiedi all'atleta di generarne uno nuovo dal suo profilo.";
    case "not_found":
      return "Questo invito non esiste o è stato eliminato.";
    case "not_authenticated":
      return "Devi accedere prima di accettare l'invito.";
    default:
      return "Accettazione non riuscita: riprova tra qualche istante.";
  }
}

export function CoachInviteTokenClient({ token }: { token: string }) {
  const [status, setStatus] = useState<LookupStatus>("loading");
  const [athleteName, setAthleteName] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<AcceptOutcome | null>(null);

  const accessHref = `/access?next=${encodeURIComponent(`/coach-invite/${token}`)}`;

  useEffect(() => {
    let cancelled = false;
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setStatus("misconfigured");
      setSignedIn(false);
      return;
    }
    void (async () => {
      const [{ data, error }, sessionResult] = await Promise.all([
        supabase.rpc("lookup_coach_referral", { p_token: token }),
        supabase.auth.getSession(),
      ]);
      if (cancelled) return;
      setSignedIn(Boolean(sessionResult.data.session?.user));
      if (error) {
        setStatus("error");
        return;
      }
      const row = (Array.isArray(data) ? data[0] : data) as LookupRow | null | undefined;
      if (!row) {
        setStatus("not_found");
        return;
      }
      const fullName = [row.athlete_first_name, row.athlete_last_name].filter(Boolean).join(" ");
      setAthleteName(fullName || null);
      setExpiresAt(row.expires_at);
      if (row.valid) {
        setStatus("valid");
      } else if (row.reason === "expired") {
        setStatus("expired");
      } else if (row.reason === "consumed") {
        setStatus("consumed");
      } else {
        setStatus("not_found");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = useCallback(async () => {
    if (busy) return;
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setAcceptError("Supabase non configurato: riprova più tardi.");
      return;
    }
    setBusy(true);
    setAcceptError(null);
    try {
      const { data, error } = await supabase.rpc("accept_coach_referral", { p_token: token });
      if (error) {
        setAcceptError(error.message);
        return;
      }
      const outcome = (data ?? {}) as AcceptOutcome;
      if (!outcome.ok) {
        setAcceptError(acceptErrorMessage(outcome.reason));
        return;
      }
      setAccepted(outcome);
    } catch {
      setAcceptError("Errore di rete: riprova.");
    } finally {
      setBusy(false);
    }
  }, [busy, token]);

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  return (
    <BrutalistAppBackdrop matrix>
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16 text-center outline-none"
      >
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-gray-500">Invito coach</p>
        <h1 className="max-w-md bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-2xl font-light tracking-tight text-transparent sm:text-3xl">
          {status === "valid" && athleteName
            ? `Sei stato invitato a diventare il coach di ${athleteName} su Empathy`
            : "Diventa coach su Empathy"}
        </h1>

        {status === "loading" ? <p className="max-w-md text-sm text-gray-500">Verifica dell&apos;invito…</p> : null}
        {status === "misconfigured" ? (
          <p className="max-w-md text-sm text-amber-300/90">
            Inviti non disponibili: configurazione Supabase mancante su questo ambiente.
          </p>
        ) : null}
        {status === "error" ? (
          <p className="max-w-md text-sm text-amber-300/90">Verifica non riuscita: ricarica la pagina e riprova.</p>
        ) : null}
        {status === "not_found" ? (
          <p className="max-w-md text-sm text-amber-300/90">
            Questo link non è valido: controlla di averlo copiato per intero o chiedi all&apos;atleta un nuovo invito.
          </p>
        ) : null}
        {status === "expired" ? (
          <p className="max-w-md text-sm text-amber-300/90">
            Questo invito è scaduto{expiresLabel ? ` (valido fino al ${expiresLabel})` : ""}. Chiedi all&apos;atleta di
            generarne uno nuovo dal suo profilo.
          </p>
        ) : null}
        {status === "consumed" ? (
          <p className="max-w-md text-sm text-gray-400">Questo invito è già stato usato.</p>
        ) : null}

        {status === "valid" && !accepted ? (
          <div className="flex max-w-md flex-col items-center gap-4">
            {expiresLabel ? (
              <p className="text-xs text-gray-500">Invito valido fino al {expiresLabel}.</p>
            ) : null}
            {signedIn === false ? (
              <>
                <p className="text-sm text-gray-400">
                  Accedi con il tuo account coach oppure registrati: una volta dentro, l&apos;atleta verrà collegato al tuo
                  roster e Empathy attiverà il tuo account coach (approvazione admin).
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href={accessHref}
                    className="rounded-full border border-purple-500/40 bg-purple-500/15 px-6 py-2.5 text-sm font-bold text-purple-100 transition hover:border-purple-400/60"
                  >
                    Accedi
                  </Link>
                  <Link
                    href="/registrati"
                    className="rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-bold text-white transition hover:border-purple-500/40 hover:bg-white/10"
                  >
                    Registrati
                  </Link>
                </div>
                <p className="text-xs text-gray-500">
                  Se ti registri ora: dopo la conferma via email riapri questo link per completare il collegamento.
                </p>
              </>
            ) : null}
            {signedIn === true ? (
              <>
                <p className="text-sm text-gray-400">
                  Accettando, {athleteName ?? "l'atleta"} viene collegato al tuo roster. L&apos;attivazione finale del tuo
                  account coach la fa Empathy (approvazione admin).
                </p>
                <Pro2Button type="button" disabled={busy} onClick={() => void accept()} className="min-w-[12rem]">
                  {busy ? "Elaborazione…" : "Accetta l'invito"}
                </Pro2Button>
              </>
            ) : null}
            {signedIn === null ? <p className="text-sm text-gray-500">Verifica sessione…</p> : null}
          </div>
        ) : null}

        {accepted ? (
          <div className="flex max-w-md flex-col items-center gap-4">
            <p className="text-sm text-emerald-300/90" role="status">
              {accepted.coachStatus === "pending"
                ? "Collegato! Il tuo account coach è in attesa di approvazione da parte di Empathy."
                : "Atleta collegato al tuo roster."}
            </p>
            <Link
              href="/athletes"
              className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-6 py-2.5 text-sm font-bold text-emerald-100 transition hover:border-emerald-400/60"
            >
              Vai ad Athletes
            </Link>
          </div>
        ) : null}

        {acceptError ? (
          <p className="max-w-md text-sm text-amber-300/90" role="alert">
            {acceptError}
          </p>
        ) : null}

        <Link href="/" className="text-xs text-gray-500 underline-offset-4 hover:text-gray-400 hover:underline">
          ← Torna alla home
        </Link>
      </main>
    </BrutalistAppBackdrop>
  );
}
