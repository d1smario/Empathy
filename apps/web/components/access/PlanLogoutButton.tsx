"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { clearPro2ClientSessionKeys } from "@/lib/app-session";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Logout dalla pagina piani: chiude la sessione Supabase, pulisce le chiavi
 * client e torna ad /access (che ora, senza sessione, mostra il login).
 * (Un semplice link ad /access non funzionerebbe: la porta unica rimbalza
 * subito gli utenti loggati di nuovo qui.)
 */
export function PlanLogoutButton() {
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      const sb = createEmpathyBrowserSupabase();
      if (sb) await sb.auth.signOut();
    } finally {
      clearPro2ClientSessionKeys();
      window.location.assign("/access");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onLogout()}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-gray-400 transition hover:border-rose-500/40 hover:text-white disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" aria-hidden />
      {busy ? "Uscita…" : "Esci"}
    </button>
  );
}
