"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { accessAppOriginFromWindow } from "@/lib/auth/access-app-origin";
import { clearPendingAppRoleCookieClient } from "@/lib/auth/pending-app-role-client";
import type { PendingAppRole } from "@/lib/auth/pending-role-cookie";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { resolvePostLoginDestination } from "@/lib/auth/post-login-destination";
import { isMobileBrowserClient } from "@/lib/shell/mobile-detect";
import { Pro2Button } from "@/components/ui/empathy";

type Props = {
  redirectAfterLogin: string;
};

type MsgTone = "info" | "success" | "warning";

type AccessFormTranslator = (key: string) => string;

function formatAuthErrorMessage(t: AccessFormTranslator, message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid api key") || m.includes("invalid api")) {
    return t("errSupabaseKeysClient");
  }
  if (m.includes("redirect") && (m.includes("not allowed") || m.includes("disallowed") || m.includes("url"))) {
    return t("errRedirectNotAllowed");
  }
  if (m.includes("invalid login credentials") || m.includes("invalid credentials")) {
    return t("errInvalidCredentials");
  }
  if (m.includes("email not confirmed")) {
    return t("errEmailNotConfirmed");
  }
  return message;
}

type PostLoginIdentity = {
  /** false = sessione assente dopo il login (errore reale, blocca). */
  sessionOk: boolean;
  role: PendingAppRole;
  isPlatformAdmin: boolean;
};

/**
 * Identità post-login + bootstrap profilo, ottimizzati per latenza.
 * - Platform admin: NESSUN bootstrap atleta (non è un atleta) → ingresso immediato.
 * - Profilo GIÀ esistente (login abituale): `ensure-profile` parte in BACKGROUND
 *   (keepalive: sopravvive alla navigazione) e NON viene atteso — per design un suo
 *   fallimento non blocca il login (la shell lo ritenta al mount via ActiveAthleteProvider).
 * - Profilo ASSENTE (primo login): si attende il bootstrap, perché decide il ruolo.
 */
async function resolvePostLoginIdentity(): Promise<PostLoginIdentity> {
  const fallback: PostLoginIdentity = { sessionOk: false, role: "private", isPlatformAdmin: false };
  const supabase = createEmpathyBrowserSupabase();
  if (!supabase) return fallback;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const u = session?.user;
  if (!u?.id) return fallback;

  const { data: existingProfile } = await supabase
    .from("app_user_profiles")
    .select("role, is_platform_admin")
    .eq("user_id", u.id)
    .maybeSingle();
  const profile = existingProfile as { role?: PendingAppRole; is_platform_admin?: boolean } | null;
  const storedRole: PendingAppRole = profile?.role === "coach" ? "coach" : "private";

  if (profile?.is_platform_admin === true) {
    return { sessionOk: true, role: storedRole, isPlatformAdmin: true };
  }

  const meta = u.user_metadata as Record<string, unknown>;
  const ensureProfile = fetch("/api/access/ensure-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    keepalive: true,
    body: JSON.stringify({
      userId: u.id,
      role: storedRole,
      email: u.email ?? null,
      firstName: typeof meta?.first_name === "string" ? meta.first_name : null,
      lastName: typeof meta?.last_name === "string" ? meta.last_name : null,
    }),
  });

  if (profile) {
    // Login abituale: il ruolo è già nel DB, il bootstrap gira in background.
    ensureProfile.catch(() => {
      console.warn("[access] ensure-profile non raggiungibile — la shell ritenterà.");
    });
    return { sessionOk: true, role: storedRole, isPlatformAdmin: false };
  }

  // Primo login (nessuna riga profilo): il bootstrap decide il ruolo effettivo.
  try {
    const res = await ensureProfile;
    if (res.ok) {
      const j = (await res.json()) as { role?: PendingAppRole };
      return { sessionOk: true, role: j.role === "coach" ? "coach" : storedRole, isPlatformAdmin: false };
    }
    console.warn("[access] ensure-profile non riuscito (status", res.status, ") — la shell ritenterà.");
  } catch {
    console.warn("[access] ensure-profile non raggiungibile — la shell ritenterà.");
  }
  return { sessionOk: true, role: storedRole, isPlatformAdmin: false };
}

/**
 * Login Supabase con email + password (`signInWithPassword`).
 * Porta unica: il routing post-login è deciso solo dall'identità nel DB
 * (admin → /admin, coach → /athletes, cliente → /dashboard, utente → gate piano).
 */
export function AccessPasswordForm({ redirectAfterLogin }: Props) {
  const t = useTranslations("AccessForm");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<MsgTone>("warning");
  const [busy, setBusy] = useState(false);
  /** "signin" = login; "reset" = modulo dedicato per ricevere il link di reset. */
  const [view, setView] = useState<"signin" | "reset">("signin");
  /** Countdown anti-spam: segue il rate-limit Supabase (60s tra un invio e l'altro). */
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function notify(text: string, tone: MsgTone = "warning") {
    setMsg(text);
    setMsgTone(tone);
  }

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      notify(t("msgSupabaseMissing"));
      return;
    }
    const em = email.trim();
    if (!em || !password) {
      notify(t("msgEnterEmailAndPassword"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: em, password });
    if (error) {
      setBusy(false);
      notify(formatAuthErrorMessage(t, error.message));
      return;
    }

    // Identità ed entitlement partono in PARALLELO (l'entitlement dipende solo dal
    // cookie di sessione, non dal profilo): niente cascata di roundtrip sequenziali.
    // NIENTE `repair=1` qui: la riconciliazione Stripe è roba da post-checkout
    // (/access/plan con session_id), al login basta la lettura DB — il gate paywall
    // server-side nella shell resta comunque l'autorità finale.
    const identityPromise = resolvePostLoginIdentity();
    const entitlementPromise = fetch("/api/billing/entitlement", { cache: "no-store" })
      .then(async (res) => {
        const j = (await res.json()) as {
          ok?: boolean;
          hasAthleteAccess?: boolean;
          hasOperatorAccess?: boolean;
        };
        return res.ok && j.ok ? j : null;
      })
      .catch(() => null);

    const identity = await identityPromise;
    if (!identity.sessionOk) {
      setBusy(false);
      notify(t("msgSessionNotReady"));
      return;
    }
    clearPendingAppRoleCookieClient();
    const redirectRole = identity.role;
    const isPlatformAdmin = identity.isPlatformAdmin;

    let hasAthleteAccess = false;
    let hasOperatorAccess = false;
    if (isPlatformAdmin) {
      // admin → /admin: nessun entitlement da leggere.
    } else if (redirectRole === "coach") {
      hasOperatorAccess = true;
    } else {
      const ent = await entitlementPromise;
      if (ent) {
        hasAthleteAccess = Boolean(ent.hasAthleteAccess);
        hasOperatorAccess = Boolean(ent.hasOperatorAccess);
      }
      /* gate piano se entitlement non leggibile */
    }
    const target = resolvePostLoginDestination({
      next: redirectAfterLogin,
      appRole: redirectRole,
      hasAthleteAccess,
      hasOperatorAccess,
      isPlatformAdmin,
      preferMobile: isMobileBrowserClient(),
    });
    window.location.assign(target);
  }

  async function onResetPassword(e?: React.FormEvent) {
    e?.preventDefault();
    setMsg(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      notify(t("msgSupabaseMissing"));
      return;
    }
    const em = email.trim();
    if (!em) {
      notify(t("msgEnterEmailForReset"));
      return;
    }
    setBusy(true);
    const origin = accessAppOriginFromWindow();
    /** Dopo il click sul link, `auth/callback` scambia il `code` e reindirizza qui per `updateUser({ password })`. */
    const { error } = await supabase.auth.resetPasswordForEmail(em, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/set-password")}`,
    });
    setBusy(false);
    if (error) {
      // Rate-limit Supabase: "...you can only request this after N seconds."
      const waitMatch = error.message.match(/after (\d+) second/i);
      if (waitMatch) {
        const wait = Number(waitMatch[1]) || 60;
        setCooldown(wait);
        notify(`Please wait ${wait} seconds before requesting a new link.`);
        return;
      }
      notify(error.message);
      return;
    }
    notify(t("msgResetSent"), "success");
    setCooldown(60);
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-md">
      {view === "signin" ? (
        <>
          <form onSubmit={onSignIn} className="flex flex-col gap-3" aria-label={t("ariaSignIn")}>
            <label className="text-left">
              <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">{t("fieldEmail")}</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none"
                placeholder={t("emailPlaceholder")}
              />
            </label>
            <label className="text-left">
              <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">{t("fieldPassword")}</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none"
                placeholder={t("passwordPlaceholder")}
              />
            </label>
            <Pro2Button type="submit" disabled={busy} className="w-full justify-center">
              {busy ? t("btnSignInBusy") : t("btnSignIn")}
            </Pro2Button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMsg(null);
                setView("reset");
              }}
              className="text-center text-xs font-medium text-cyan-300/90 underline-offset-2 hover:underline"
            >
              {t("forgotPassword")}
            </button>
          </form>

          <Link
            href="/registrati"
            className="text-center text-xs text-gray-500 transition-colors hover:text-gray-300"
          >
            First time here? <span className="text-gray-300">Sign up</span>
          </Link>
        </>
      ) : (
        <form onSubmit={(e) => void onResetPassword(e)} className="flex flex-col gap-3" aria-label="Reset password">
          <div className="text-left">
            <h2 className="text-sm font-bold text-white">Reset your password</h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              Enter your account email and we&apos;ll send you a link to set a new password.
            </p>
          </div>
          <label className="text-left">
            <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">{t("fieldEmail")}</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none"
              placeholder={t("emailPlaceholder")}
            />
          </label>
          <Pro2Button type="submit" disabled={busy || cooldown > 0} className="w-full justify-center">
            {busy ? "Sending…" : cooldown > 0 ? `Retry in ${cooldown}s` : "Send reset link"}
          </Pro2Button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMsg(null);
              setView("signin");
            }}
            className="text-center text-xs text-gray-500 transition-colors hover:text-gray-300"
          >
            ← Back to sign in
          </button>
        </form>
      )}

      {msg ? (
        <p
          className={`text-center text-xs leading-relaxed ${msgTone === "success" ? "text-emerald-300/90" : "text-amber-300/90"}`}
          role="status"
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}
