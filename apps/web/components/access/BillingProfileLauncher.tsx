"use client";

import { useEffect, useState } from "react";
import { UserRound, X } from "lucide-react";
import {
  isBillingProfileComplete,
  OPEN_BILLING_PROFILE_EVENT,
  type BillingProfileRow,
} from "@/lib/account/billing-profile";
import { BillingProfileForm } from "@/components/access/BillingProfileForm";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/cn";

/**
 * Icona profilo (in alto a destra della pagina acquisto): apre il modale con
 * l'anagrafica fatturazione. Il pallino segnala lo stato (verde = completa,
 * ambra = da completare). Si apre anche via evento OPEN_BILLING_PROFILE_EVENT
 * (es. dal gate del checkout quando mancano i dati).
 */
export function BillingProfileLauncher() {
  const [open, setOpen] = useState(false);
  const [complete, setComplete] = useState<boolean | null>(null);

  // Stato iniziale del pallino (check leggero, RLS own-row).
  useEffect(() => {
    const sb = createEmpathyBrowserSupabase();
    if (!sb) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!session?.user?.id || cancelled) return;
      const { data } = await sb
        .from("user_billing_profiles")
        .select("first_name,last_name,address_line1,postal_code,city,country_code")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!cancelled) setComplete(isBillingProfileComplete(data as Partial<BillingProfileRow> | null));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Apertura via evento (gate checkout) + chiusura con Escape.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_BILLING_PROFILE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_BILLING_PROFILE_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="I tuoi dati di fatturazione"
        aria-label="Apri i tuoi dati di fatturazione"
        className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-gray-300 backdrop-blur-md transition hover:border-purple-500/40 hover:text-white"
      >
        <UserRound className="h-5 w-5" aria-hidden />
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-black",
            complete === true ? "bg-emerald-400" : complete === false ? "bg-amber-400" : "bg-gray-600",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="I tuoi dati di fatturazione"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Chiudi"
              className="absolute -right-2 -top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-[#17101f] text-gray-300 transition hover:border-rose-500/40 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <div className="max-h-[85vh] overflow-y-auto rounded-2xl bg-[#0b0a10] shadow-2xl shadow-purple-500/10">
              <BillingProfileForm onCompletenessChange={setComplete} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
