"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { accessAppOriginFromWindow } from "@/lib/auth/access-app-origin";
import {
  clearPendingAppRoleCookieClient,
  setPendingAppRoleCookieClient,
} from "@/lib/auth/pending-app-role-client";
import { postSignupRegistrationPath } from "@/lib/auth/post-registration-redirects";
import { passwordStrength } from "@/lib/auth/password-strength";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { PasswordStrengthMeter } from "@/components/access/PasswordStrengthMeter";
import { Pro2Button } from "@/components/ui/empathy";

type MsgTone = "info" | "success" | "warning";

function formatSignupError(message: string, t: (key: string) => string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already exists")) {
    return t("errorAlreadyRegistered");
  }
  if (m.includes("invalid api key") || m.includes("invalid api")) {
    return t("errorInvalidApiKey");
  }
  if (m.includes("redirect") && (m.includes("not allowed") || m.includes("disallowed") || m.includes("url"))) {
    return t("errorRedirectNotAllowed");
  }
  if (m.includes("password")) {
    return t("errorInvalidPassword");
  }
  return message;
}

const labelClass = "mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500";
const inputClass =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none";
/** Variante con spazio a destra per il pulsante occhio (evita conflitto px-4 vs pr-*). */
const inputIconClass =
  "w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pl-4 pr-11 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none";

type AccessRegisterFormProps = {
  /** Token di invito coach (dal link `/invite/<token>` → `/registrati?invite=…`). */
  inviteToken?: string | null;
  /** Nome del coach invitante, per il banner "sei stato invitato da X". */
  invitedByName?: string | null;
};

/**
 * Form di registrazione (porta unica, ruolo sempre `private`).
 * Raccoglie nome, cognome, email, password + conferma, con semaforo robustezza
 * e consenso obbligatorio a Privacy + Termini di Servizio.
 *
 * Con `inviteToken` (arrivo da link coach): nasconde il campo codice, mostra un
 * banner col nome del coach e collega l'atleta in automatico a fine registrazione.
 */
export function AccessRegisterForm({ inviteToken = null, invitedByName = null }: AccessRegisterFormProps = {}) {
  const t = useTranslations("AccessRegisterForm");
  const invited = Boolean(inviteToken);
  const inviteName = (invitedByName ?? "").trim() || t("inviteBannerFallbackName");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [coachCode, setCoachCode] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<MsgTone>("warning");
  const [busy, setBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentTo, setSentTo] = useState("");

  const strength = useMemo(() => passwordStrength(password), [password]);

  function notify(text: string, tone: MsgTone = "warning") {
    setMsg(text);
    setMsgTone(tone);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      notify(t("errorMissingConfig"));
      return;
    }
    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim();
    // Codice coach opzionale: normalizziamo a uppercase (la colonna è citext lato DB).
    const coachCodeNorm = coachCode.trim().toUpperCase();
    if (!fn || !ln) {
      notify(t("errorEnterName"));
      return;
    }
    if (!em) {
      notify(t("errorEnterEmail"));
      return;
    }
    if (password.length < 8) {
      notify(t("errorPasswordTooShort"));
      return;
    }
    if (password !== password2) {
      notify(t("errorPasswordsMismatch"));
      return;
    }
    if (!consent) {
      notify(t("errorConsentRequired"));
      return;
    }

    setBusy(true);
    // Strada A: ogni registrazione nasce `private`. Coach/admin concessi dalla piattaforma.
    setPendingAppRoleCookieClient("private");
    const origin = accessAppOriginFromWindow();
    const signupNext = postSignupRegistrationPath("private");
    // coach_code / invite_token finiscono in user_metadata: /auth/callback li rilegge
    // nel ramo conferma-email per collegare l'atleta al coach. Dal link usiamo il token
    // (auto-collegamento, zero codici); il codice resta per l'inserimento manuale.
    const signupMeta: Record<string, string> = { first_name: fn, last_name: ln };
    if (invited && inviteToken) signupMeta.invite_token = inviteToken;
    else if (coachCodeNorm) signupMeta.coach_code = coachCodeNorm;
    const { data, error } = await supabase.auth.signUp({
      email: em,
      password,
      options: {
        data: signupMeta,
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(signupNext)}`,
      },
    });
    if (error) {
      setBusy(false);
      notify(formatSignupError(error.message, t));
      return;
    }
    if (data.session) {
      // Sessione immediata (conferma email disabilitata): bootstrap profilo + redirect.
      try {
        await fetch("/api/access/ensure-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            userId: data.session.user.id,
            role: "private",
            email: em,
            firstName: fn,
            lastName: ln,
            // Ramo sessione-immediata: codice coach / token invito nel body (riconvalidati server-side).
            coachCode: invited ? null : coachCodeNorm || null,
            inviteToken: invited ? inviteToken : null,
          }),
        });
      } catch {
        /* il bootstrap riprova lato shell */
      }
      clearPendingAppRoleCookieClient();
      window.location.assign(signupNext);
      return;
    }
    // Conferma email richiesta: mostra il pannello "controlla la posta" e blocca nuovi invii.
    setBusy(false);
    setSentTo(em);
    setEmailSent(true);
  }

  if (emailSent) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-emerald-400/25 bg-black/30 p-6 text-center backdrop-blur-md">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15">
          <MailCheck className="h-6 w-6 text-emerald-300" aria-hidden />
        </span>
        <h2 className="text-lg font-bold text-white">{t("emailSentTitle")}</h2>
        <p className="text-sm leading-relaxed text-gray-300">
          {t.rich("emailSentBody", {
            email: sentTo,
            b: (chunks) => <strong className="text-white">{chunks}</strong>,
          })}
        </p>
        <p className="text-xs text-gray-500">{t("emailSentSpamHint")}</p>
        <Link
          href="/access"
          className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-center text-sm font-medium text-gray-200 transition-colors hover:border-purple-500/40 hover:text-white"
        >
          {t("goToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-md"
      aria-label={t("formAriaLabel")}
    >
      {invited ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-purple-400/25 bg-gradient-to-r from-purple-500/15 via-pink-500/10 to-orange-500/10 p-3 text-left"
          role="status"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-purple-400/40 bg-purple-500/20 text-sm">
            🤝
          </span>
          <p className="text-xs leading-relaxed text-gray-200">
            {t.rich("inviteBanner", {
              name: inviteName,
              b: (chunks) => <strong className="font-semibold text-white">{chunks}</strong>,
            })}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-left">
          <span className={labelClass}>{t("firstNameLabel")}</span>
          <input
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={busy}
            className={inputClass}
          />
        </label>
        <label className="text-left">
          <span className={labelClass}>{t("lastNameLabel")}</span>
          <input
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={busy}
            className={inputClass}
          />
        </label>
      </div>

      <label className="text-left">
        <span className={labelClass}>Email</span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          className={inputClass}
          placeholder={t("emailPlaceholder")}
        />
      </label>

      {invited ? null : (
        <label className="text-left">
          <span className={labelClass}>{t("coachCodeLabel")}</span>
          <input
            type="text"
            autoComplete="off"
            value={coachCode}
            onChange={(e) => setCoachCode(e.target.value.toUpperCase())}
            disabled={busy}
            className={`${inputClass} font-mono uppercase tracking-[0.15em]`}
            placeholder={t("coachCodePlaceholder")}
          />
        </label>
      )}

      <label className="text-left">
        <span className={labelClass}>{t("passwordLabel")}</span>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            className={inputIconClass}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            aria-pressed={showPassword}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-200"
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        <PasswordStrengthMeter level={strength.level} label={strength.label} />
      </label>

      <label className="text-left">
        <span className={labelClass}>{t("confirmPasswordLabel")}</span>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            disabled={busy}
            className={inputIconClass}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            aria-pressed={showPassword}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-200"
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        {password2 && password !== password2 ? (
          <span className="mt-1 block text-[0.65rem] text-red-400">{t("errorPasswordsMismatch")}</span>
        ) : null}
      </label>

      <label className="flex items-start gap-2.5 text-left text-xs leading-relaxed text-gray-400">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={busy}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-purple-500"
        />
        <span>
          {t.rich("consentText", {
            privacy: (chunks) => (
              <Link href="/privacy" target="_blank" className="text-cyan-300/90 underline-offset-2 hover:underline">
                {chunks}
              </Link>
            ),
            terms: (chunks) => (
              <Link href="/termini" target="_blank" className="text-cyan-300/90 underline-offset-2 hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>

      <Pro2Button type="submit" disabled={busy || !consent} className="w-full justify-center">
        {busy ? t("submitBusy") : t("submit")}
      </Pro2Button>

      <Link
        href="/access"
        className="text-center text-xs text-gray-500 transition-colors hover:text-gray-300"
      >
        {t.rich("alreadyHaveAccount", {
          signin: (chunks) => <span className="text-gray-300">{chunks}</span>,
        })}
      </Link>

      {msg ? (
        <p
          className={`text-center text-xs leading-relaxed ${
            msgTone === "success" ? "text-emerald-300/90" : "text-amber-300/90"
          }`}
          role="status"
        >
          {msg}
        </p>
      ) : null}
    </form>
  );
}
