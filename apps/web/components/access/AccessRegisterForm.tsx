"use client";

import { useMemo, useState } from "react";
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

function formatSignupError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already exists")) {
    return "This email is already registered. Try signing in.";
  }
  if (m.includes("invalid api key") || m.includes("invalid api")) {
    return "Invalid Supabase keys: contact support.";
  }
  if (m.includes("redirect") && (m.includes("not allowed") || m.includes("disallowed") || m.includes("url"))) {
    return "Redirect URL not allowed in the Supabase configuration.";
  }
  if (m.includes("password")) {
    return "Invalid password: use at least 8 characters.";
  }
  return message;
}

const labelClass = "mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500";
const inputClass =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none";
/** Variante con spazio a destra per il pulsante occhio (evita conflitto px-4 vs pr-*). */
const inputIconClass =
  "w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pl-4 pr-11 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none";

/**
 * Form di registrazione (porta unica, ruolo sempre `private`).
 * Raccoglie nome, cognome, email, password + conferma, con semaforo robustezza
 * e consenso obbligatorio a Privacy + Termini di Servizio.
 */
export function AccessRegisterForm() {
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
      notify("Missing Supabase configuration.");
      return;
    }
    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim();
    // Codice coach opzionale: normalizziamo a uppercase (la colonna è citext lato DB).
    const coachCodeNorm = coachCode.trim().toUpperCase();
    if (!fn || !ln) {
      notify("Enter your first and last name.");
      return;
    }
    if (!em) {
      notify("Enter a valid email.");
      return;
    }
    if (password.length < 8) {
      notify("The password must be at least 8 characters long.");
      return;
    }
    if (password !== password2) {
      notify("The passwords do not match.");
      return;
    }
    if (!consent) {
      notify("You must accept the Privacy Policy and Terms of Service to register.");
      return;
    }

    setBusy(true);
    // Strada A: ogni registrazione nasce `private`. Coach/admin concessi dalla piattaforma.
    setPendingAppRoleCookieClient("private");
    const origin = accessAppOriginFromWindow();
    const signupNext = postSignupRegistrationPath("private");
    const { data, error } = await supabase.auth.signUp({
      email: em,
      password,
      options: {
        // coach_code finisce in user_metadata: /auth/callback lo rilegge nel ramo conferma-email.
        data: coachCodeNorm
          ? { first_name: fn, last_name: ln, coach_code: coachCodeNorm }
          : { first_name: fn, last_name: ln },
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(signupNext)}`,
      },
    });
    if (error) {
      setBusy(false);
      notify(formatSignupError(error.message));
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
            // Ramo sessione-immediata: il codice coach viaggia nel body (riconvalidato server-side).
            coachCode: coachCodeNorm || null,
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
        <h2 className="text-lg font-bold text-white">Check your email</h2>
        <p className="text-sm leading-relaxed text-gray-300">
          We&apos;ve sent a confirmation link to <strong className="text-white">{sentTo}</strong>. Open it to
          activate your account, then come back to sign in.
        </p>
        <p className="text-xs text-gray-500">
          Can&apos;t find it? Check your spam folder. The link may take a few minutes to arrive.
        </p>
        <Link
          href="/access"
          className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-center text-sm font-medium text-gray-200 transition-colors hover:border-purple-500/40 hover:text-white"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-md"
      aria-label="Registration"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-left">
          <span className={labelClass}>First name</span>
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
          <span className={labelClass}>Last name</span>
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
          placeholder="name@example.com"
        />
      </label>

      <label className="text-left">
        <span className={labelClass}>Coach code (optional)</span>
        <input
          type="text"
          autoComplete="off"
          value={coachCode}
          onChange={(e) => setCoachCode(e.target.value.toUpperCase())}
          disabled={busy}
          className={`${inputClass} font-mono uppercase tracking-[0.15em]`}
          placeholder="E.G. COACH-7K2P"
        />
      </label>

      <label className="text-left">
        <span className={labelClass}>Password</span>
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
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-200"
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        <PasswordStrengthMeter level={strength.level} label={strength.label} />
      </label>

      <label className="text-left">
        <span className={labelClass}>Confirm password</span>
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
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-200"
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        {password2 && password !== password2 ? (
          <span className="mt-1 block text-[0.65rem] text-red-400">The passwords do not match.</span>
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
          I accept the{" "}
          <Link href="/privacy" target="_blank" className="text-cyan-300/90 underline-offset-2 hover:underline">
            Privacy Policy
          </Link>{" "}
          and the{" "}
          <Link href="/termini" target="_blank" className="text-cyan-300/90 underline-offset-2 hover:underline">
            Terms of Service
          </Link>
          .
        </span>
      </label>

      <Pro2Button type="submit" disabled={busy || !consent} className="w-full justify-center">
        {busy ? "Creating account…" : "Sign up"}
      </Pro2Button>

      <Link
        href="/access"
        className="text-center text-xs text-gray-500 transition-colors hover:text-gray-300"
      >
        Already have an account? <span className="text-gray-300">Sign in</span>
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
