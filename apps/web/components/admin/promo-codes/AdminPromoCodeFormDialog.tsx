"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cn } from "@/lib/cn";
import type {
  DiscountType,
  PromoCodeRow,
  PromoKind,
} from "@/components/admin/promo-codes/promo-code-types";

const COPY = {
  titleNew: "Aggiungi codice promo",
  titleEdit: "Modifica codice promo",
  close: "Chiudi",
  cancel: "Annulla",
  save: "Salva codice",
  saving: "Salvataggio…",
  // Sezioni
  secIdentity: "Codice e tipo",
  secDiscount: "Sconto",
  secUnlock: "Prodotto da sbloccare",
  secLimits: "Limiti e validità",
  // Campi
  code: "Codice",
  codePh: "es. WELCOME20",
  kind: "Tipo",
  kindDiscount: "Sconto",
  kindUnlock: "Sblocco prodotto nascosto",
  discountType: "Tipo sconto",
  discountTypePercent: "Percentuale (%)",
  discountTypeAmount: "Importo fisso",
  discountValue: "Valore",
  discountValuePercentPh: "es. 20",
  discountValueAmountPh: "es. 30.00",
  discountCurrency: "Valuta (importo fisso)",
  targetProduct: "Prodotto",
  targetProductNone: "— Nessuno (sconto su qualsiasi piano) —",
  targetProductUnlockHint: "Lo sblocco deve puntare a un prodotto nascosto.",
  targetProductDiscountHint: "Opzionale: limita lo sconto a un solo prodotto.",
  expiresAt: "Scadenza (opzionale)",
  maxRedemptions: "Utilizzi massimi (vuoto = illimitati)",
  maxRedemptionsPh: "es. 100",
  isActive: "Codice attivo",
  // Errori
  errCodeRequired: "Il codice è obbligatorio.",
  errCodeFormat: "Il codice può contenere solo lettere, numeri, trattini e underscore.",
  errDiscountValue: "Per lo sconto serve un valore maggiore di 0.",
  errDiscountPercent: "Lo sconto percentuale deve essere tra 0 e 100.",
  errUnlockProduct: "Per lo sblocco devi scegliere il prodotto target.",
  errMaxRedemptions: "Gli utilizzi massimi devono essere un intero positivo (o vuoto).",
  errCodeUnique: "Esiste già un codice con questo valore: scegline un altro.",
  errSavePrefix: "Salvataggio non riuscito",
} as const;

const CODE_RE = /^[A-Za-z0-9_-]+$/;

const INPUT =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-purple-400/60 focus:outline-none";
const LABEL = "mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500";
const SECTION = "font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-400";

/** Prodotto minimale per il picker target. */
export type PromoProductOption = {
  id: string;
  code: string;
  name: string;
  is_hidden: boolean;
};

type PromoDraft = {
  code: string;
  kind: PromoKind;
  target_product_id: string;
  discount_type: DiscountType;
  discount_value: string;
  discount_currency: string;
  expires_at: string;
  max_redemptions: string;
  is_active: boolean;
};

/** ISO → valore per <input type="datetime-local"> (yyyy-MM-ddTHH:mm), ora locale. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function draftFromPromo(p: PromoCodeRow | null): PromoDraft {
  if (!p) {
    return {
      code: "",
      kind: "discount",
      target_product_id: "",
      discount_type: "percent",
      discount_value: "",
      discount_currency: "CHF",
      expires_at: "",
      max_redemptions: "",
      is_active: true,
    };
  }
  return {
    code: p.code ?? "",
    kind: p.kind,
    target_product_id: p.target_product_id ?? "",
    discount_type: p.discount_type ?? "percent",
    discount_value: p.discount_value != null ? String(p.discount_value) : "",
    discount_currency: p.discount_currency ?? "CHF",
    expires_at: isoToLocalInput(p.expires_at),
    max_redemptions: p.max_redemptions != null ? String(p.max_redemptions) : "",
    is_active: Boolean(p.is_active),
  };
}

/** Parse decimale IT-friendly ("12,50" → 12.5). null se vuoto, NaN se non valido. */
function parseDecimal(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  return Number(t.replace(",", "."));
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <span className={LABEL}>{label}</span>
      {children}
    </div>
  );
}

/**
 * Dialog crea/modifica codice promo: un solo campo "codice" per due usi
 * (sconto o sblocco prodotto nascosto). INSERT/UPDATE diretti via Supabase
 * browser (DB-first, RLS platform_admin). Stesso scaffolding del form prodotti.
 */
export function AdminPromoCodeFormDialog({
  supabase,
  promo,
  products,
  onClose,
  onSaved,
}: {
  supabase: SupabaseClient;
  /** null → creazione, valorizzato → modifica precompilata. */
  promo: PromoCodeRow | null;
  products: PromoProductOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<PromoDraft>(() => draftFromPromo(promo));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof PromoDraft>(key: K, value: PromoDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const isUnlock = draft.kind === "unlock";

  const save = async () => {
    const found: string[] = [];
    const code = draft.code.trim();
    if (!code) found.push(COPY.errCodeRequired);
    else if (!CODE_RE.test(code)) found.push(COPY.errCodeFormat);

    const value = parseDecimal(draft.discount_value);
    if (!isUnlock) {
      if (value == null || Number.isNaN(value) || value <= 0) found.push(COPY.errDiscountValue);
      else if (draft.discount_type === "percent" && value > 100) found.push(COPY.errDiscountPercent);
    }

    if (isUnlock && !draft.target_product_id) found.push(COPY.errUnlockProduct);

    const maxRaw = draft.max_redemptions.trim();
    const maxRedemptions = maxRaw ? Number(maxRaw) : null;
    if (maxRedemptions != null && (!Number.isInteger(maxRedemptions) || maxRedemptions <= 0)) {
      found.push(COPY.errMaxRedemptions);
    }

    if (found.length > 0) {
      setErrors(found);
      return;
    }

    const payload = {
      code,
      kind: draft.kind,
      target_product_id: draft.target_product_id || null,
      discount_type: isUnlock ? null : draft.discount_type,
      discount_value: isUnlock ? null : (value as number),
      discount_currency:
        isUnlock || draft.discount_type !== "amount"
          ? null
          : (draft.discount_currency.trim() || "CHF").toUpperCase(),
      expires_at: draft.expires_at ? new Date(draft.expires_at).toISOString() : null,
      max_redemptions: maxRedemptions,
      is_active: draft.is_active,
    };

    setSaving(true);
    setErrors([]);
    try {
      const { error } = promo
        ? await supabase
            .from("promo_codes")
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq("id", promo.id)
        : await supabase.from("promo_codes").insert(payload);
      if (error) {
        setErrors([error.code === "23505" ? COPY.errCodeUnique : `${COPY.errSavePrefix}: ${error.message}`]);
        return;
      }
      onSaved();
    } catch {
      setErrors([`${COPY.errSavePrefix}: richiesta non riuscita.`]);
    } finally {
      setSaving(false);
    }
  };

  const dialogContent = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={promo ? COPY.titleEdit : COPY.titleNew}
    >
      <div className="my-8 w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-bold text-white">{promo ? COPY.titleEdit : COPY.titleNew}</h2>
          <button
            type="button"
            onClick={onClose}
            title={COPY.close}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/25 hover:text-white"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          {errors.length > 0 ? (
            <ul className="space-y-1 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3" role="alert">
              {errors.map((e) => (
                <li key={e} className="text-sm text-red-300">
                  {e}
                </li>
              ))}
            </ul>
          ) : null}

          {/* Codice e tipo */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secIdentity}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={COPY.code}>
                <input
                  type="text"
                  value={draft.code}
                  onChange={(e) => set("code", e.target.value)}
                  placeholder={COPY.codePh}
                  className={cn(INPUT, "font-mono uppercase")}
                />
              </Field>
              <Field label={COPY.kind}>
                <select
                  value={draft.kind}
                  onChange={(e) => set("kind", e.target.value as PromoKind)}
                  className={INPUT}
                >
                  <option value="discount">{COPY.kindDiscount}</option>
                  <option value="unlock">{COPY.kindUnlock}</option>
                </select>
              </Field>
            </div>
          </section>

          {/* Sconto (solo kind=discount) */}
          {!isUnlock ? (
            <section className="space-y-3">
              <p className={SECTION}>{COPY.secDiscount}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={COPY.discountType}>
                  <select
                    value={draft.discount_type}
                    onChange={(e) => set("discount_type", e.target.value as DiscountType)}
                    className={INPUT}
                  >
                    <option value="percent">{COPY.discountTypePercent}</option>
                    <option value="amount">{COPY.discountTypeAmount}</option>
                  </select>
                </Field>
                <Field label={COPY.discountValue}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draft.discount_value}
                    onChange={(e) => set("discount_value", e.target.value)}
                    placeholder={
                      draft.discount_type === "percent"
                        ? COPY.discountValuePercentPh
                        : COPY.discountValueAmountPh
                    }
                    className={INPUT}
                  />
                </Field>
                {draft.discount_type === "amount" ? (
                  <Field label={COPY.discountCurrency}>
                    <input
                      type="text"
                      value={draft.discount_currency}
                      onChange={(e) => set("discount_currency", e.target.value)}
                      placeholder="CHF"
                      maxLength={8}
                      className={cn(INPUT, "font-mono uppercase")}
                    />
                  </Field>
                ) : null}
              </div>
              <Field label={COPY.targetProduct}>
                <select
                  value={draft.target_product_id}
                  onChange={(e) => set("target_product_id", e.target.value)}
                  className={INPUT}
                >
                  <option value="">{COPY.targetProductNone}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}){p.is_hidden ? " · nascosto" : ""}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-gray-500">{COPY.targetProductDiscountHint}</span>
              </Field>
            </section>
          ) : null}

          {/* Prodotto da sbloccare (solo kind=unlock) */}
          {isUnlock ? (
            <section className="space-y-3">
              <p className={SECTION}>{COPY.secUnlock}</p>
              <Field label={COPY.targetProduct}>
                <select
                  value={draft.target_product_id}
                  onChange={(e) => set("target_product_id", e.target.value)}
                  className={INPUT}
                >
                  <option value="">{COPY.targetProductNone}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}){p.is_hidden ? " · nascosto" : ""}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-gray-500">{COPY.targetProductUnlockHint}</span>
              </Field>
            </section>
          ) : null}

          {/* Limiti e validità */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secLimits}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={COPY.expiresAt}>
                <input
                  type="datetime-local"
                  value={draft.expires_at}
                  onChange={(e) => set("expires_at", e.target.value)}
                  className={cn(INPUT, "[color-scheme:dark]")}
                />
              </Field>
              <Field label={COPY.maxRedemptions}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.max_redemptions}
                  onChange={(e) => set("max_redemptions", e.target.value)}
                  placeholder={COPY.maxRedemptionsPh}
                  className={INPUT}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => set("is_active", e.target.checked)}
                className="h-4 w-4 accent-emerald-500"
              />
              {COPY.isActive}
            </label>
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
          >
            {COPY.cancel}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg border border-purple-400/60 bg-purple-500/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500/25 disabled:opacity-50"
          >
            {saving ? COPY.saving : COPY.save}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(dialogContent, document.body);
}
