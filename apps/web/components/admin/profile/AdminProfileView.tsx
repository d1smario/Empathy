"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, LogOut, ShieldCheck } from "lucide-react";
import { PasswordStrengthMeter } from "@/components/access/PasswordStrengthMeter";
import { passwordStrength } from "@/lib/auth/password-strength";
import { clearPro2ClientSessionKeys } from "@/lib/app-session";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { Pro2Button } from "@/components/ui/empathy";

const COPY = {
  noSupabase: "Configurazione Supabase mancante: profilo non disponibile.",
  loading: "Caricamento profilo…",
  noSession: "Nessuna sessione attiva. Accedi di nuovo per vedere il profilo.",
  accountTitle: "Account",
  badgeAdmin: "Platform admin",
  email: "Email",
  userId: "User ID",
  registeredAt: "Registrazione",
  lastSignInAt: "Ultimo accesso",
  passwordTitle: "Cambio password",
  passwordIntro: "Imposta una nuova password per il tuo account operatore.",
  newPassword: "Nuova password",
  confirmPassword: "Conferma password",
  showPassword: "Mostra password",
  hidePassword: "Nascondi password",
  mismatch: "Le password non coincidono.",
  tooShort: "La password deve avere almeno 8 caratteri.",
  submit: "Aggiorna password",
  submitting: "Aggiornamento…",
  success: "Password aggiornata.",
  genericError: "Aggiornamento password non riuscito. Riprova.",
  sessionTitle: "Sessione",
  sessionIntro: "Chiudi la sessione su questo dispositivo.",
  signOut: "Esci",
  signingOut: "Uscita…",
} as const;

type AccountInfo = {
  email: string | null;
  userId: string;
  createdAt: string | null;
  lastSignInAt: string | null;
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-CH", { dateStyle: "medium" }).format(d);
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-CH", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

/** Traduce in italiano gli errori più comuni di `auth.updateUser({ password })`. */
function formatUpdateError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("different from the old password") || m.includes("should be different")) {
    return "La nuova password deve essere diversa da quella attuale.";
  }
  if (m.includes("password") && (m.includes("at least") || m.includes("too short") || m.includes("length"))) {
    return COPY.tooShort;
  }
  if (m.includes("session") || m.includes("not authenticated") || m.includes("jwt")) {
    return "Sessione scaduta: accedi di nuovo e riprova.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Troppi tentativi: attendi qualche minuto e riprova.";
  }
  return COPY.genericError;
}

const labelClass = "mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500";
/** Input con spazio a destra per il pulsante occhio (stesso pattern dell'access). */
const inputIconClass =
  "w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pl-4 pr-11 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none";
const cardClass = "rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md";
const sectionLabelClass = "font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500";

/**
 * Profilo dell'account admin loggato: dati account (da `auth.getSession()`),
 * cambio password con semaforo robustezza e uscita dalla sessione.
 * L'admin è un operatore: nessuna anagrafica fatturazione né dati atleta.
 */
export function AdminProfileView() {
  const configured = useMemo(() => Boolean(createEmpathyBrowserSupabase()), []);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<AccountInfo | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  const [signingOut, setSigningOut] = useState(false);

  const strength = useMemo(() => passwordStrength(newPassword), [newPassword]);

  useEffect(() => {
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        const user = data.session?.user ?? null;
        setAccount(
          user
            ? {
                email: user.email ?? null,
                userId: user.id,
                createdAt: user.created_at ?? null,
                lastSignInAt: user.last_sign_in_at ?? null,
              }
            : null,
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setMsg({ text: COPY.noSupabase, tone: "error" });
      return;
    }
    if (newPassword.length < 8) {
      setMsg({ text: COPY.tooShort, tone: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ text: COPY.mismatch, tone: "error" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) {
      setMsg({ text: formatUpdateError(error.message), tone: "error" });
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setMsg({ text: COPY.success, tone: "success" });
  }

  // Stesso pattern di SidebarSessionActions, con redirect pieno alla porta di accesso.
  async function signOut() {
    setSigningOut(true);
    const supabase = createEmpathyBrowserSupabase();
    if (supabase) await supabase.auth.signOut();
    clearPro2ClientSessionKeys();
    window.location.assign("/access");
  }

  if (!configured) {
    return (
      <p className="text-sm text-amber-300/90" role="alert">
        {COPY.noSupabase}
      </p>
    );
  }

  const eyeButton = (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? COPY.hidePassword : COPY.showPassword}
      aria-pressed={showPassword}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-200"
    >
      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
    </button>
  );

  const accountRows: { label: string; value: string; mono?: boolean }[] = account
    ? [
        { label: COPY.email, value: account.email ?? "—" },
        { label: COPY.userId, value: account.userId, mono: true },
        { label: COPY.registeredAt, value: fmtDate(account.createdAt) },
        { label: COPY.lastSignInAt, value: fmtDateTime(account.lastSignInAt) },
      ]
    : [];

  return (
    <div className="max-w-2xl space-y-4">
      <section className={cardClass} aria-label={COPY.accountTitle}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={sectionLabelClass}>{COPY.accountTitle}</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-rose-200">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            {COPY.badgeAdmin}
          </span>
        </div>
        {loading ? (
          <p className="mt-4 text-xs text-gray-500">{COPY.loading}</p>
        ) : !account ? (
          <p className="mt-4 text-sm text-amber-300/90" role="alert">
            {COPY.noSession}
          </p>
        ) : (
          <dl className="mt-4 space-y-3">
            {accountRows.map((row) => (
              <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <dt className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500">{row.label}</dt>
                <dd
                  className={
                    row.mono ? "break-all font-mono text-[0.7rem] text-gray-400" : "text-sm font-medium text-gray-200"
                  }
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className={cardClass} aria-label={COPY.passwordTitle}>
        <h2 className={sectionLabelClass}>{COPY.passwordTitle}</h2>
        <p className="mt-2 text-xs text-gray-500">{COPY.passwordIntro}</p>
        <form onSubmit={onSubmitPassword} className="mt-4 flex flex-col gap-3">
          <label className="text-left">
            <span className={labelClass}>{COPY.newPassword}</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={busy}
                className={inputIconClass}
              />
              {eyeButton}
            </div>
            <PasswordStrengthMeter level={strength.level} label={strength.label} />
          </label>

          <label className="text-left">
            <span className={labelClass}>{COPY.confirmPassword}</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={busy}
                className={inputIconClass}
              />
              {eyeButton}
            </div>
            {confirmPassword && newPassword !== confirmPassword ? (
              <span className="mt-1 block text-[0.65rem] text-red-400">{COPY.mismatch}</span>
            ) : null}
          </label>

          <Pro2Button type="submit" disabled={busy} className="w-full justify-center">
            {busy ? COPY.submitting : COPY.submit}
          </Pro2Button>

          {msg ? (
            <p
              className={`text-center text-xs leading-relaxed ${
                msg.tone === "success" ? "text-emerald-300/90" : "text-red-400"
              }`}
              role={msg.tone === "error" ? "alert" : "status"}
            >
              {msg.text}
            </p>
          ) : null}
        </form>
      </section>

      <section className={cardClass} aria-label={COPY.sessionTitle}>
        <h2 className={sectionLabelClass}>{COPY.sessionTitle}</h2>
        <p className="mt-2 text-xs text-gray-500">{COPY.sessionIntro}</p>
        <Pro2Button
          type="button"
          variant="secondary"
          disabled={signingOut}
          onClick={() => void signOut()}
          className="mt-4 w-full justify-center text-xs"
        >
          <LogOut className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          {signingOut ? COPY.signingOut : COPY.signOut}
        </Pro2Button>
      </section>
    </div>
  );
}
