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
      return "You can't accept your own invite: this link should be sent to your coach.";
    case "consumed":
      return "This invite has already been used by another account.";
    case "expired":
      return "This invite has expired: ask the athlete to generate a new one from their profile.";
    case "not_found":
      return "This invite doesn't exist or has been deleted.";
    case "not_authenticated":
      return "You need to sign in before accepting the invite.";
    default:
      return "Acceptance failed: please try again in a moment.";
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
      setAcceptError("Supabase not configured: please try again later.");
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
      setAcceptError("Network error: please try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, token]);

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  return (
    <BrutalistAppBackdrop matrix>
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16 text-center outline-none"
      >
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-gray-500">Coach invite</p>
        <h1 className="max-w-md bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-2xl font-light tracking-tight text-transparent sm:text-3xl">
          {status === "valid" && athleteName
            ? `You've been invited to become ${athleteName}'s coach on Empathy`
            : "Become a coach on Empathy"}
        </h1>

        {status === "loading" ? <p className="max-w-md text-sm text-gray-500">Verifying the invite…</p> : null}
        {status === "misconfigured" ? (
          <p className="max-w-md text-sm text-amber-300/90">
            Invites unavailable: Supabase configuration missing on this environment.
          </p>
        ) : null}
        {status === "error" ? (
          <p className="max-w-md text-sm text-amber-300/90">Verification failed: reload the page and try again.</p>
        ) : null}
        {status === "not_found" ? (
          <p className="max-w-md text-sm text-amber-300/90">
            This link isn&apos;t valid: check that you copied it in full, or ask the athlete for a new invite.
          </p>
        ) : null}
        {status === "expired" ? (
          <p className="max-w-md text-sm text-amber-300/90">
            This invite has expired{expiresLabel ? ` (valid until ${expiresLabel})` : ""}. Ask the athlete to
            generate a new one from their profile.
          </p>
        ) : null}
        {status === "consumed" ? (
          <p className="max-w-md text-sm text-gray-400">This invite has already been used.</p>
        ) : null}

        {status === "valid" && !accepted ? (
          <div className="flex max-w-md flex-col items-center gap-4">
            {expiresLabel ? (
              <p className="text-xs text-gray-500">Invite valid until {expiresLabel}.</p>
            ) : null}
            {signedIn === false ? (
              <>
                <p className="text-sm text-gray-400">
                  Sign in with your coach account or create one: once you&apos;re in, the athlete will be linked to your
                  roster and Empathy will activate your coach account (admin approval).
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href={accessHref}
                    className="rounded-full border border-purple-500/40 bg-purple-500/15 px-6 py-2.5 text-sm font-bold text-purple-100 transition hover:border-purple-400/60"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/registrati"
                    className="rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-bold text-white transition hover:border-purple-500/40 hover:bg-white/10"
                  >
                    Sign up
                  </Link>
                </div>
                <p className="text-xs text-gray-500">
                  If you sign up now: after confirming via email, reopen this link to complete the connection.
                </p>
              </>
            ) : null}
            {signedIn === true ? (
              <>
                <p className="text-sm text-gray-400">
                  By accepting, {athleteName ?? "the athlete"} is linked to your roster. The final activation of your
                  coach account is handled by Empathy (admin approval).
                </p>
                <Pro2Button type="button" disabled={busy} onClick={() => void accept()} className="min-w-[12rem]">
                  {busy ? "Processing…" : "Accept the invite"}
                </Pro2Button>
              </>
            ) : null}
            {signedIn === null ? <p className="text-sm text-gray-500">Verifying session…</p> : null}
          </div>
        ) : null}

        {accepted ? (
          <div className="flex max-w-md flex-col items-center gap-4">
            <p className="text-sm text-emerald-300/90" role="status">
              {accepted.coachStatus === "pending"
                ? "Linked! Your coach account is awaiting approval from Empathy."
                : "Athlete linked to your roster."}
            </p>
            <Link
              href="/athletes"
              className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-6 py-2.5 text-sm font-bold text-emerald-100 transition hover:border-emerald-400/60"
            >
              Go to Athletes
            </Link>
          </div>
        ) : null}

        {acceptError ? (
          <p className="max-w-md text-sm text-amber-300/90" role="alert">
            {acceptError}
          </p>
        ) : null}

        <Link href="/" className="text-xs text-gray-500 underline-offset-4 hover:text-gray-400 hover:underline">
          ← Back to home
        </Link>
      </main>
    </BrutalistAppBackdrop>
  );
}
