"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
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

function acceptErrorMessage(reason: string | undefined, t: (key: string) => string): string {
  switch (reason) {
    case "cannot_self":
      return t("errorCannotSelf");
    case "consumed":
      return t("errorConsumed");
    case "expired":
      return t("errorExpired");
    case "not_found":
      return t("errorNotFound");
    case "not_authenticated":
      return t("errorNotAuthenticated");
    default:
      return t("errorDefault");
  }
}

export function CoachInviteTokenClient({ token }: { token: string }) {
  const t = useTranslations("CoachInviteTokenClient");
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
      setAcceptError(t("supabaseNotConfigured"));
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
        setAcceptError(acceptErrorMessage(outcome.reason, t));
        return;
      }
      setAccepted(outcome);
    } catch {
      setAcceptError(t("networkError"));
    } finally {
      setBusy(false);
    }
  }, [busy, token, t]);

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
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-gray-500">{t("eyebrow")}</p>
        <h1 className="max-w-md bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-2xl font-light tracking-tight text-transparent sm:text-3xl">
          {status === "valid" && athleteName
            ? t("titleInvited", { athleteName })
            : t("titleDefault")}
        </h1>

        {status === "loading" ? <p className="max-w-md text-sm text-gray-500">{t("verifying")}</p> : null}
        {status === "misconfigured" ? (
          <p className="max-w-md text-sm text-amber-300/90">
            {t("misconfigured")}
          </p>
        ) : null}
        {status === "error" ? (
          <p className="max-w-md text-sm text-amber-300/90">{t("verificationFailed")}</p>
        ) : null}
        {status === "not_found" ? (
          <p className="max-w-md text-sm text-amber-300/90">
            {t("linkNotValid")}
          </p>
        ) : null}
        {status === "expired" ? (
          <p className="max-w-md text-sm text-amber-300/90">
            {expiresLabel ? t("expiredWithDate", { expiresLabel }) : t("expiredNoDate")}
          </p>
        ) : null}
        {status === "consumed" ? (
          <p className="max-w-md text-sm text-gray-400">{t("alreadyUsed")}</p>
        ) : null}

        {status === "valid" && !accepted ? (
          <div className="flex max-w-md flex-col items-center gap-4">
            {expiresLabel ? (
              <p className="text-xs text-gray-500">{t("inviteValidUntil", { expiresLabel })}</p>
            ) : null}
            {signedIn === false ? (
              <>
                <p className="text-sm text-gray-400">
                  {t("signInPrompt")}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href={accessHref}
                    className="rounded-full border border-purple-500/40 bg-purple-500/15 px-6 py-2.5 text-sm font-bold text-purple-100 transition hover:border-purple-400/60"
                  >
                    {t("signIn")}
                  </Link>
                  <Link
                    href="/registrati"
                    className="rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-bold text-white transition hover:border-purple-500/40 hover:bg-white/10"
                  >
                    {t("signUp")}
                  </Link>
                </div>
                <p className="text-xs text-gray-500">
                  {t("signUpHint")}
                </p>
              </>
            ) : null}
            {signedIn === true ? (
              <>
                <p className="text-sm text-gray-400">
                  {t("acceptExplanation", { athleteName: athleteName ?? t("theAthlete") })}
                </p>
                <Pro2Button type="button" disabled={busy} onClick={() => void accept()} className="min-w-[12rem]">
                  {busy ? t("processing") : t("acceptInvite")}
                </Pro2Button>
              </>
            ) : null}
            {signedIn === null ? <p className="text-sm text-gray-500">{t("verifyingSession")}</p> : null}
          </div>
        ) : null}

        {accepted ? (
          <div className="flex max-w-md flex-col items-center gap-4">
            <p className="text-sm text-emerald-300/90" role="status">
              {accepted.coachStatus === "pending"
                ? t("linkedPending")
                : t("linkedDone")}
            </p>
            <Link
              href="/athletes"
              className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-6 py-2.5 text-sm font-bold text-emerald-100 transition hover:border-emerald-400/60"
            >
              {t("goToAthletes")}
            </Link>
          </div>
        ) : null}

        {acceptError ? (
          <p className="max-w-md text-sm text-amber-300/90" role="alert">
            {acceptError}
          </p>
        ) : null}

        <Link href="/" className="text-xs text-gray-500 underline-offset-4 hover:text-gray-400 hover:underline">
          {t("backToHome")}
        </Link>
      </main>
    </BrutalistAppBackdrop>
  );
}
