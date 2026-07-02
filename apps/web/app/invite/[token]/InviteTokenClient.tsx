"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { Pro2Button } from "@/components/ui/empathy";

export type InviteInitialStatus = "valid" | "expired" | "consumed" | "not_found" | "misconfigured";

export function InviteTokenClient({
  token,
  initialStatus,
}: {
  token: string;
  initialStatus: InviteInitialStatus;
}) {
  const t = useTranslations("InviteTokenClient");
  const router = useRouter();
  const [status, setStatus] = useState<InviteInitialStatus>(initialStatus);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  /** Profilo atleta già collegato all'account loggato: pilota l'auto-accept on-mount. */
  const [hasAthleteId, setHasAthleteId] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  /** Evita doppio auto-accept (StrictMode / re-render). */
  const autoAcceptedRef = useRef(false);

  const accessHref = `/access?next=${encodeURIComponent(`/invite/${token}`)}`;

  useEffect(() => {
    let c = false;
    (async () => {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean; signedIn?: boolean; userId?: string | null };
      if (c) return;
      const isSignedIn = j?.ok === true && Boolean(j.signedIn);
      setSignedIn(isSignedIn);
      if (!isSignedIn) {
        setHasAthleteId(false);
        return;
      }
      try {
        const { createEmpathyBrowserSupabase } = await import("@/lib/supabase/browser");
        const supabase = createEmpathyBrowserSupabase();
        if (!supabase || !j.userId) {
          if (!c) setHasAthleteId(false);
          return;
        }
        const { data } = await supabase
          .from("app_user_profiles")
          .select("athlete_id")
          .eq("user_id", j.userId)
          .maybeSingle();
        if (c) return;
        const athleteId = (data as { athlete_id?: string | null } | null)?.athlete_id?.trim() || null;
        setHasAthleteId(Boolean(athleteId));
      } catch {
        if (!c) setHasAthleteId(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const accept = useCallback(async () => {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setMsg(j.error ?? t("requestFailed"));
        setBusy(false);
        return;
      }
      setLinked(true);
      setMsg(t("linkCreated"));
      router.refresh();
    } catch {
      setMsg(t("networkError"));
    } finally {
      setBusy(false);
    }
  }, [router, t, token]);

  // Auto-accept on-mount: utente loggato con profilo atleta → collega senza click.
  // Se manca athlete_id, lasciamo il bottone come fallback (l'API lo crea comunque al volo).
  useEffect(() => {
    if (autoAcceptedRef.current) return;
    if (status !== "valid") return;
    if (signedIn !== true) return;
    if (hasAthleteId !== true) return;
    autoAcceptedRef.current = true;
    void accept();
  }, [accept, hasAthleteId, signedIn, status]);

  return (
    <BrutalistAppBackdrop matrix>
      <main
        id="main-content"
        className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16 text-center"
      >
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-gray-500">{t("eyebrow")}</p>
        <h1 className="max-w-md bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-2xl font-light tracking-tight text-transparent sm:text-3xl">
          {t("title")}
        </h1>

        {status === "misconfigured" ? (
          <p className="max-w-md text-sm text-amber-300/90">
            {t("misconfigured")}
          </p>
        ) : null}
        {status === "not_found" ? (
          <p className="max-w-md text-sm text-amber-300/90">{t("notFound")}</p>
        ) : null}
        {status === "consumed" ? (
          <p className="max-w-md text-sm text-gray-400">{t("consumed")}</p>
        ) : null}
        {status === "expired" ? (
          <p className="max-w-md text-sm text-amber-300/90">{t("expired")}</p>
        ) : null}

        {status === "valid" ? (
          <div className="flex max-w-md flex-col items-center gap-4">
            {signedIn === false ? (
              <>
                <p className="text-sm text-gray-400">{t("signInPrompt")}</p>
                <Link
                  href={accessHref}
                  className="rounded-full border border-purple-500/40 bg-purple-500/15 px-6 py-2.5 text-sm font-bold text-purple-100 transition hover:border-purple-400/60"
                >
                  {t("goToAccess")}
                </Link>
              </>
            ) : null}
            {signedIn === true && !linked ? (
              hasAthleteId === null ? (
                <p className="text-sm text-gray-500">{t("checkingAthleteProfile")}</p>
              ) : hasAthleteId === true ? (
                <p className="text-sm text-gray-400" role="status">
                  {t("linkingInProgress")}
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-400">
                    {t("confirmLinkPrompt")}
                  </p>
                  <Pro2Button type="button" disabled={busy} onClick={() => void accept()} className="min-w-[12rem]">
                    {busy ? t("processing") : t("acceptInvite")}
                  </Pro2Button>
                </>
              )
            ) : null}
            {signedIn === null ? (
              <p className="text-sm text-gray-500">{t("checkingSession")}</p>
            ) : null}
          </div>
        ) : null}

        {msg ? (
          <p className={`max-w-md text-sm ${linked ? "text-emerald-300/90" : "text-amber-300/90"}`} role="status">
            {msg}
          </p>
        ) : null}

        <Link href="/dashboard" className="text-xs text-gray-500 underline-offset-4 hover:text-gray-400 hover:underline">
          {t("backToDashboard")}
        </Link>
      </main>
    </BrutalistAppBackdrop>
  );
}
