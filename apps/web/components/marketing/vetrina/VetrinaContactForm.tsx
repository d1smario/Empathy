"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Kind = "contact" | "collaborate";

/** Form Contatti / Collabora con Empathy (client). POST → /api/contact. */
export function VetrinaContactForm({ initialKind = "contact" }: { initialKind?: Kind }) {
  const t = useTranslations("Vetrina.contact");
  const [kind, setKind] = useState<Kind>(initialKind);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | Kind>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "", organization: "", message: "", company: "" });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, ...form }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? t("error"));
        return;
      }
      setDone(kind);
      setForm({ name: "", email: "", role: "", organization: "", message: "", company: "" });
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-gray-100 outline-none transition-colors placeholder:text-gray-600 focus:border-pink-400/50 disabled:opacity-50";
  const isCollab = kind === "collaborate";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
      {/* tabs */}
      <div className="mb-6 inline-flex rounded-full border border-white/10 bg-black/30 p-1">
        {(["contact", "collaborate"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              setDone(null);
              setError(null);
            }}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              kind === k ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {t(k === "contact" ? "tabContact" : "tabCollaborate")}
          </button>
        ))}
      </div>

      <p className="mb-5 text-sm text-gray-400">{t(isCollab ? "collaborateIntro" : "contactIntro")}</p>

      {done ? (
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/5 p-6 text-center">
          <p className="text-sm font-medium text-emerald-300">
            {t(done === "collaborate" ? "successCollaborate" : "successContact")}
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-gray-500">{t("nameLabel")}</span>
              <input className={inputCls} value={form.name} onChange={set("name")} disabled={busy} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-gray-500">{t("emailLabel")}</span>
              <input className={inputCls} type="email" value={form.email} onChange={set("email")} disabled={busy} required />
            </label>
          </div>
          {isCollab ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-gray-500">{t("roleLabel")}</span>
                <input className={inputCls} value={form.role} onChange={set("role")} disabled={busy} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-gray-500">{t("orgLabel")}</span>
                <input className={inputCls} value={form.organization} onChange={set("organization")} disabled={busy} />
              </label>
            </div>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-xs text-gray-500">{t("messageLabel")}</span>
            <textarea
              className={`${inputCls} min-h-[120px] resize-y`}
              value={form.message}
              onChange={set("message")}
              disabled={busy}
              placeholder={t(isCollab ? "collaborateMessagePlaceholder" : "contactMessagePlaceholder")}
              required
            />
          </label>
          {/* honeypot anti-bot: nascosto agli utenti */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            value={form.company}
            onChange={set("company")}
            className="hidden"
          />
          {error ? (
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="empathy-btn-gradient w-full rounded-full px-6 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/25 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {busy ? t("submitting") : t("submit")}
          </button>
        </form>
      )}
    </div>
  );
}
