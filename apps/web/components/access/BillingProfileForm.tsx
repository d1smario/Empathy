"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, CircleAlert } from "lucide-react";
import {
  BILLING_REQUIRED_FIELDS,
  isBillingProfileComplete,
  type BillingProfileRow,
} from "@/lib/account/billing-profile";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { Pro2Button } from "@/components/ui/empathy";
import { cn } from "@/lib/cn";

const EMPTY: BillingProfileRow = {
  first_name: null,
  last_name: null,
  company_name: null,
  vat_number: null,
  address_line1: null,
  address_line2: null,
  postal_code: null,
  city: null,
  region: null,
  country_code: "CH",
  phone: null,
};

const labelClass = "mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500";
const inputClass =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none";

type FieldDef = {
  key: keyof BillingProfileRow;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  half?: boolean;
};

const FIELDS: FieldDef[] = [
  { key: "first_name", label: "fieldFirstName", autoComplete: "given-name", half: true },
  { key: "last_name", label: "fieldLastName", autoComplete: "family-name", half: true },
  { key: "company_name", label: "fieldCompany", autoComplete: "organization", half: true },
  { key: "vat_number", label: "fieldVat", placeholder: "CHE-...", half: true },
  { key: "address_line1", label: "fieldAddress", autoComplete: "address-line1" },
  { key: "address_line2", label: "fieldAddressLine2", autoComplete: "address-line2" },
  { key: "postal_code", label: "fieldPostalCode", autoComplete: "postal-code", half: true },
  { key: "city", label: "fieldCity", autoComplete: "address-level2", half: true },
  { key: "region", label: "fieldRegion", autoComplete: "address-level1", half: true },
  { key: "country_code", label: "fieldCountry", placeholder: "CH", autoComplete: "country", half: true },
  { key: "phone", label: "fieldPhone", autoComplete: "tel" },
];

/**
 * "I tuoi dati · fatturazione": l'utente completa/aggiorna la propria anagrafica
 * (user_billing_profiles, RLS own-row — lettura/scrittura DIRETTE dal browser).
 * I campi * sono richiesti per l'acquisto: fatture/ricevute CH vogliono
 * intestatario e indirizzo. Il checkout dei piani a pagamento li verifica.
 */
export function BillingProfileForm({ onCompletenessChange }: { onCompletenessChange?: (complete: boolean) => void }) {
  const t = useTranslations("BillingProfileForm");
  const [row, setRow] = useState<BillingProfileRow>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<"success" | "warning">("warning");

  const complete = useMemo(() => isBillingProfileComplete(row), [row]);

  useEffect(() => {
    onCompletenessChange?.(complete);
  }, [complete, onCompletenessChange]);

  useEffect(() => {
    const sb = createEmpathyBrowserSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();
        if (!session?.user?.id || cancelled) return;
        const { data } = await sb
          .from("user_billing_profiles")
          .select(
            "first_name,last_name,company_name,vat_number,address_line1,address_line2,postal_code,city,region,country_code,phone",
          )
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (data) {
          setRow({ ...EMPTY, ...(data as Partial<BillingProfileRow>) });
        } else {
          // Pre-compila nome/cognome dalla registrazione, se presenti.
          const meta = session.user.user_metadata as Record<string, unknown>;
          setRow((prev) => ({
            ...prev,
            first_name: typeof meta?.first_name === "string" ? meta.first_name : prev.first_name,
            last_name: typeof meta?.last_name === "string" ? meta.last_name : prev.last_name,
          }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function setField(key: keyof BillingProfileRow, value: string) {
    setRow((prev) => ({ ...prev, [key]: value }));
    setMsg(null);
  }

  async function onSave() {
    setMsg(null);
    const sb = createEmpathyBrowserSupabase();
    if (!sb) {
      setMsgTone("warning");
      setMsg(t("errSupabaseMissing"));
      return;
    }
    const missing = BILLING_REQUIRED_FIELDS.filter((f) => !(row[f] ?? "").toString().trim());
    if (missing.length > 0) {
      setMsgTone("warning");
      setMsg(t("errMissingFields"));
      return;
    }
    setSaving(true);
    try {
      const {
        data: { session },
      } = await sb.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) {
        setMsgTone("warning");
        setMsg(t("errSessionExpired"));
        return;
      }
      const payload: Record<string, unknown> = { user_id: uid, updated_at: new Date().toISOString() };
      for (const f of FIELDS) {
        const v = (row[f.key] ?? "").toString().trim();
        payload[f.key] = v.length > 0 ? (f.key === "country_code" ? v.toUpperCase() : v) : null;
      }
      const { error } = await sb.from("user_billing_profiles").upsert(payload, { onConflict: "user_id" });
      if (error) {
        setMsgTone("warning");
        setMsg(t("errSaveFailed", { message: error.message }));
        return;
      }
      setMsgTone("success");
      setMsg(t("saved"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      id="billing-profile"
      aria-labelledby="billing-profile-heading"
      className="scroll-mt-24 rounded-2xl border border-cyan-400/20 bg-white/[0.02] p-6 backdrop-blur-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-cyan-300/80">
            {t("eyebrow")}
          </p>
          <h3 id="billing-profile-heading" className="mt-1 text-lg font-bold text-white">
            {t("title")}
          </h3>
          <p className="mt-1 max-w-xl text-sm text-gray-400">
            {t("subtitle")}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
            complete
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
              : "border-amber-400/40 bg-amber-500/10 text-amber-200",
          )}
        >
          {complete ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <CircleAlert className="h-3.5 w-3.5" aria-hidden />}
          {complete ? t("statusComplete") : t("statusIncomplete")}
        </span>
      </div>

      {loading ? (
        <p className="mt-6 text-xs text-gray-500">{t("loading")}</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className={cn("text-left", !f.half && "sm:col-span-2")}>
                <span className={labelClass}>{t(f.label)}</span>
                <input
                  type="text"
                  autoComplete={f.autoComplete}
                  value={(row[f.key] ?? "") as string}
                  onChange={(e) => setField(f.key, e.target.value)}
                  disabled={saving}
                  placeholder={f.placeholder}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Pro2Button type="button" variant="secondary" className="px-6" disabled={saving} onClick={() => void onSave()}>
              {saving ? t("saving") : t("save")}
            </Pro2Button>
            {msg ? (
              <p
                className={cn("text-xs", msgTone === "success" ? "text-emerald-300/90" : "text-amber-300/90")}
                role="status"
              >
                {msg}
              </p>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
