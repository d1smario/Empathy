"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cn } from "@/lib/cn";
import type { BillingInterval, ProductKind, ProductRow } from "@/components/admin/products/product-types";

const COPY = {
  titleNew: "Aggiungi prodotto",
  titleEdit: "Modifica prodotto",
  close: "Chiudi",
  cancel: "Annulla",
  save: "Salva prodotto",
  saving: "Salvataggio…",
  // Sezioni
  secIdentity: "Identità",
  secPricing: "Prezzo e fatturazione",
  secFlags: "Cosa include",
  secCommissions: "Commissioni (importi fissi)",
  secStatus: "Stato e ordinamento",
  // Campi
  code: "Codice (slug)",
  codePh: "es. gold-mensile",
  name: "Nome",
  namePh: "es. Gold",
  subtitle: "Sottotitolo",
  subtitlePh: "Una riga sotto il nome (opzionale)",
  description: "Punti della card (un campo = un badge)",
  descriptionPh: "es. Piani alimentari automatici",
  descriptionAdd: "Aggiungi badge",
  descriptionRemove: "Rimuovi badge",
  // Traduzione EN — tutti i campi opzionali: vuoto → gli utenti EN vedono il testo italiano
  secTranslationEn: "Traduzione inglese (EN)",
  secTranslationEnHint: "Campi opzionali: se vuoti, gli utenti EN vedono il testo italiano.",
  nameEn: "Nome (EN)",
  nameEnPh: "es. Gold",
  subtitleEn: "Sottotitolo (EN)",
  subtitleEnPh: "es. Automated nutrition by Empathy",
  descriptionEn: "Punti della card (EN) — un campo = un badge",
  descriptionEnPh: "es. Automated meal plans",
  kind: "Tipo",
  kindBase: "Base",
  kindAddon: "Add-on",
  price: "Prezzo",
  currency: "Valuta",
  interval: "Intervallo",
  intervalMonth: "Mensile",
  intervalYear: "Annuale",
  intervalOneTime: "Una tantum",
  durationDays: "Durata (giorni)",
  durationDaysPh: "es. 90 — vuoto se non a tempo",
  includesOwnCoach: "Include coach proprio",
  includesEmpathyCoach: "Include coach Empathy",
  showAddons: "Add-on visibili al checkout",
  commissionCoach: "Commissione coach Empathy (importo fisso)",
  commissionPromoter: "Commissione promoter (importo fisso — ruolo in arrivo)",
  amount: "Importo",
  isActive: "Prodotto attivo (vendibile)",
  isHidden: "Nascosto dalla pagina pubblica",
  isHiddenHint: "Non compare nei piani pubblici: vendibile solo tramite codice promo di sblocco.",
  isHiddenInactiveWarn:
    "Attenzione: un prodotto nascosto e disattivo non è vendibile nemmeno tramite codice di sblocco. Attivalo per renderlo riscattabile.",
  sortOrder: "Ordinamento",
  // Errori
  errCodeRequired: "Il codice è obbligatorio.",
  errCodeKebab: "Il codice deve essere in kebab-case: solo minuscole, numeri e trattini (es. gold-mensile).",
  errNameRequired: "Il nome è obbligatorio.",
  errPrice: "Il prezzo è obbligatorio e deve essere un numero maggiore o uguale a 0.",
  errDuration: "La durata in giorni deve essere un numero intero positivo (o lasciata vuota).",
  errCommissionCoach: "La commissione coach deve essere un numero maggiore o uguale a 0.",
  errCommissionPromoter: "La commissione promoter deve essere un numero maggiore o uguale a 0.",
  errSortOrder: "L'ordinamento deve essere un numero intero.",
  errCodeUnique: "Esiste già un prodotto con questo codice: scegline un altro.",
  errSavePrefix: "Salvataggio non riuscito",
} as const;

const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const INPUT =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-purple-400/60 focus:outline-none";
const LABEL = "mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-500";
const SECTION = "font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gray-400";

type ProductDraft = {
  code: string;
  name: string;
  subtitle: string;
  /** Un elemento = un badge della card (persistito in `description`, una riga per badge). */
  descriptionItems: string[];
  /** Traduzione EN opzionale (vuoto → fallback italiano per gli utenti EN). */
  nameEn: string;
  subtitleEn: string;
  /** Badge EN (persistiti in `description_en`, una riga per badge). */
  descriptionItemsEn: string[];
  kind: ProductKind;
  price: string;
  currency: string;
  billing_interval: BillingInterval;
  duration_days: string;
  includes_own_coach: boolean;
  includes_empathy_coach: boolean;
  show_addons: boolean;
  commission_coach_amount: string;
  commission_coach_currency: string;
  commission_promoter_amount: string;
  commission_promoter_currency: string;
  is_active: boolean;
  is_hidden: boolean;
  sort_order: string;
};

/** Da testo multiriga a lista badge (una riga = un badge); sempre almeno un campo per l'editor. */
function splitBadges(text: string | null | undefined): string[] {
  const items = (text ?? "")
    .split(/\r?\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  return items.length > 0 ? items : [""];
}

/** Da lista badge a testo multiriga per il DB (null se nessun badge compilato). */
function joinBadges(items: string[]): string | null {
  return (
    items
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n") || null
  );
}

function draftFromProduct(p: ProductRow | null): ProductDraft {
  if (!p) {
    return {
      code: "",
      name: "",
      subtitle: "",
      descriptionItems: [""],
      nameEn: "",
      subtitleEn: "",
      descriptionItemsEn: [""],
      kind: "base",
      price: "",
      currency: "CHF",
      billing_interval: "month",
      duration_days: "",
      includes_own_coach: false,
      includes_empathy_coach: false,
      show_addons: false,
      commission_coach_amount: "",
      commission_coach_currency: "CHF",
      commission_promoter_amount: "",
      commission_promoter_currency: "CHF",
      is_active: true,
      is_hidden: false,
      sort_order: "0",
    };
  }
  return {
    code: p.code ?? "",
    name: p.name ?? "",
    subtitle: p.subtitle ?? "",
    descriptionItems: splitBadges(p.description),
    nameEn: p.name_en ?? "",
    subtitleEn: p.subtitle_en ?? "",
    descriptionItemsEn: splitBadges(p.description_en),
    kind: p.kind,
    price: p.price != null ? String(p.price) : "",
    currency: p.currency ?? "CHF",
    billing_interval: p.billing_interval,
    duration_days: p.duration_days != null ? String(p.duration_days) : "",
    includes_own_coach: Boolean(p.includes_own_coach),
    includes_empathy_coach: Boolean(p.includes_empathy_coach),
    show_addons: Boolean(p.show_addons),
    commission_coach_amount: p.commission_coach_amount != null ? String(p.commission_coach_amount) : "",
    commission_coach_currency: p.commission_coach_currency ?? "CHF",
    commission_promoter_amount: p.commission_promoter_amount != null ? String(p.commission_promoter_amount) : "",
    commission_promoter_currency: p.commission_promoter_currency ?? "CHF",
    is_active: Boolean(p.is_active),
    is_hidden: Boolean(p.is_hidden),
    sort_order: String(p.sort_order ?? 0),
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

/** Editor lista badge (un input = un badge, con rimozione/aggiunta riga) — pattern condiviso IT/EN. */
function BadgeListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={item}
            onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
            placeholder={placeholder}
            className={INPUT}
          />
          <button
            type="button"
            onClick={() => onChange(items.length > 1 ? items.filter((_, j) => j !== i) : [""])}
            title={COPY.descriptionRemove}
            aria-label={COPY.descriptionRemove}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-500 transition hover:border-rose-500/40 hover:text-rose-300"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-200 transition hover:border-purple-400/50 hover:bg-purple-500/15"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {COPY.descriptionAdd}
      </button>
    </div>
  );
}

/**
 * Dialog crea/modifica prodotto: TUTTI i campi della tabella `products`,
 * validazioni italiane, INSERT/UPDATE diretti via Supabase browser (DB-first).
 */
export function AdminProductFormDialog({
  supabase,
  product,
  onClose,
  onSaved,
}: {
  supabase: SupabaseClient;
  /** null → creazione, valorizzato → modifica precompilata. */
  product: ProductRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ProductDraft>(() => draftFromProduct(product));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    const found: string[] = [];
    const code = draft.code.trim();
    if (!code) found.push(COPY.errCodeRequired);
    else if (!KEBAB_RE.test(code)) found.push(COPY.errCodeKebab);
    if (!draft.name.trim()) found.push(COPY.errNameRequired);

    const price = parseDecimal(draft.price);
    if (price == null || Number.isNaN(price) || price < 0) found.push(COPY.errPrice);

    const durationRaw = draft.duration_days.trim();
    const duration = durationRaw ? Number(durationRaw) : null;
    if (duration != null && (!Number.isInteger(duration) || duration <= 0)) found.push(COPY.errDuration);

    const coachAmount = parseDecimal(draft.commission_coach_amount) ?? 0;
    if (Number.isNaN(coachAmount) || coachAmount < 0) found.push(COPY.errCommissionCoach);
    const promoterAmount = parseDecimal(draft.commission_promoter_amount) ?? 0;
    if (Number.isNaN(promoterAmount) || promoterAmount < 0) found.push(COPY.errCommissionPromoter);

    const sortRaw = draft.sort_order.trim();
    const sortOrder = sortRaw ? Number(sortRaw) : 0;
    if (!Number.isInteger(sortOrder)) found.push(COPY.errSortOrder);

    if (found.length > 0) {
      setErrors(found);
      return;
    }

    const payload = {
      code,
      name: draft.name.trim(),
      subtitle: draft.subtitle.trim() || null,
      description: joinBadges(draft.descriptionItems),
      // Traduzione EN opzionale: stringa vuota → null (fallback italiano per gli utenti EN)
      name_en: draft.nameEn.trim() || null,
      subtitle_en: draft.subtitleEn.trim() || null,
      description_en: joinBadges(draft.descriptionItemsEn),
      kind: draft.kind,
      price: price as number,
      currency: (draft.currency.trim() || "CHF").toUpperCase(),
      billing_interval: draft.billing_interval,
      duration_days: duration,
      includes_own_coach: draft.includes_own_coach,
      includes_empathy_coach: draft.includes_empathy_coach,
      show_addons: draft.show_addons,
      commission_coach_amount: coachAmount,
      commission_coach_currency: (draft.commission_coach_currency.trim() || "CHF").toUpperCase(),
      commission_promoter_amount: promoterAmount,
      commission_promoter_currency: (draft.commission_promoter_currency.trim() || "CHF").toUpperCase(),
      is_active: draft.is_active,
      is_hidden: draft.is_hidden,
      sort_order: sortOrder,
    };

    setSaving(true);
    setErrors([]);
    try {
      const { error } = product
        ? await supabase
            .from("products")
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq("id", product.id)
        : await supabase.from("products").insert(payload);
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
      aria-label={product ? COPY.titleEdit : COPY.titleNew}
    >
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-bold text-white">{product ? COPY.titleEdit : COPY.titleNew}</h2>
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

          {/* Identità */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secIdentity}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={COPY.code}>
                <input
                  type="text"
                  value={draft.code}
                  onChange={(e) => set("code", e.target.value)}
                  placeholder={COPY.codePh}
                  className={cn(INPUT, "font-mono")}
                />
              </Field>
              <Field label={COPY.name}>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={COPY.namePh}
                  className={INPUT}
                />
              </Field>
            </div>
            <Field label={COPY.subtitle}>
              <input
                type="text"
                value={draft.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
                placeholder={COPY.subtitlePh}
                className={INPUT}
              />
            </Field>
            <Field label={COPY.description}>
              <BadgeListEditor
                items={draft.descriptionItems}
                onChange={(items) => set("descriptionItems", items)}
                placeholder={COPY.descriptionPh}
              />
            </Field>
          </section>

          {/* Traduzione inglese — tutti i campi opzionali: vuoto → fallback italiano per gli utenti EN */}
          <section className="space-y-3">
            <div>
              <p className={SECTION}>{COPY.secTranslationEn}</p>
              <p className="mt-0.5 text-xs text-gray-500">{COPY.secTranslationEnHint}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={COPY.nameEn}>
                <input
                  type="text"
                  value={draft.nameEn}
                  onChange={(e) => set("nameEn", e.target.value)}
                  placeholder={COPY.nameEnPh}
                  className={INPUT}
                />
              </Field>
              <Field label={COPY.subtitleEn}>
                <input
                  type="text"
                  value={draft.subtitleEn}
                  onChange={(e) => set("subtitleEn", e.target.value)}
                  placeholder={COPY.subtitleEnPh}
                  className={INPUT}
                />
              </Field>
            </div>
            <Field label={COPY.descriptionEn}>
              <BadgeListEditor
                items={draft.descriptionItemsEn}
                onChange={(items) => set("descriptionItemsEn", items)}
                placeholder={COPY.descriptionEnPh}
              />
            </Field>
          </section>

          {/* Prezzo e fatturazione */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secPricing}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={COPY.kind}>
                <select
                  value={draft.kind}
                  onChange={(e) => set("kind", e.target.value as ProductKind)}
                  className={INPUT}
                >
                  <option value="base">{COPY.kindBase}</option>
                  <option value="addon">{COPY.kindAddon}</option>
                </select>
              </Field>
              <Field label={COPY.price}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(e) => set("price", e.target.value)}
                  placeholder="0.00"
                  className={INPUT}
                />
              </Field>
              <Field label={COPY.currency}>
                <input
                  type="text"
                  value={draft.currency}
                  onChange={(e) => set("currency", e.target.value)}
                  placeholder="CHF"
                  maxLength={8}
                  className={cn(INPUT, "font-mono uppercase")}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={COPY.interval}>
                <select
                  value={draft.billing_interval}
                  onChange={(e) => set("billing_interval", e.target.value as BillingInterval)}
                  className={INPUT}
                >
                  <option value="month">{COPY.intervalMonth}</option>
                  <option value="year">{COPY.intervalYear}</option>
                  <option value="one_time">{COPY.intervalOneTime}</option>
                </select>
              </Field>
              <Field label={COPY.durationDays}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.duration_days}
                  onChange={(e) => set("duration_days", e.target.value)}
                  placeholder={COPY.durationDaysPh}
                  className={INPUT}
                />
              </Field>
            </div>
          </section>

          {/* Flag inclusioni */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secFlags}</p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={draft.includes_own_coach}
                  onChange={(e) => set("includes_own_coach", e.target.checked)}
                  className="h-4 w-4 accent-purple-500"
                />
                {COPY.includesOwnCoach}
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={draft.includes_empathy_coach}
                  onChange={(e) => set("includes_empathy_coach", e.target.checked)}
                  className="h-4 w-4 accent-purple-500"
                />
                {COPY.includesEmpathyCoach}
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={draft.show_addons}
                  onChange={(e) => set("show_addons", e.target.checked)}
                  className="h-4 w-4 accent-purple-500"
                />
                {COPY.showAddons}
              </label>
            </div>
          </section>

          {/* Commissioni — importi FISSI in valuta, non percentuali */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secCommissions}</p>
            <div>
              <span className={LABEL}>{COPY.commissionCoach}</span>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft.commission_coach_amount}
                  onChange={(e) => set("commission_coach_amount", e.target.value)}
                  placeholder="0.00"
                  aria-label={`${COPY.commissionCoach} — ${COPY.amount}`}
                  className={INPUT}
                />
                <input
                  type="text"
                  value={draft.commission_coach_currency}
                  onChange={(e) => set("commission_coach_currency", e.target.value)}
                  placeholder="CHF"
                  maxLength={8}
                  aria-label={`${COPY.commissionCoach} — ${COPY.currency}`}
                  className={cn(INPUT, "font-mono uppercase")}
                />
              </div>
            </div>
            <div>
              <span className={LABEL}>{COPY.commissionPromoter}</span>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft.commission_promoter_amount}
                  onChange={(e) => set("commission_promoter_amount", e.target.value)}
                  placeholder="0.00"
                  aria-label={`${COPY.commissionPromoter} — ${COPY.amount}`}
                  className={INPUT}
                />
                <input
                  type="text"
                  value={draft.commission_promoter_currency}
                  onChange={(e) => set("commission_promoter_currency", e.target.value)}
                  placeholder="CHF"
                  maxLength={8}
                  aria-label={`${COPY.commissionPromoter} — ${COPY.currency}`}
                  className={cn(INPUT, "font-mono uppercase")}
                />
              </div>
            </div>
          </section>

          {/* Stato e ordinamento */}
          <section className="space-y-3">
            <p className={SECTION}>{COPY.secStatus}</p>
            <div className="grid items-end gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => set("is_active", e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                {COPY.isActive}
              </label>
              <Field label={COPY.sortOrder}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.sort_order}
                  onChange={(e) => set("sort_order", e.target.value)}
                  placeholder="0"
                  className={INPUT}
                />
              </Field>
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={draft.is_hidden}
                onChange={(e) => set("is_hidden", e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-500"
              />
              <span>
                {COPY.isHidden}
                <span className="mt-0.5 block text-xs text-gray-500">{COPY.isHiddenHint}</span>
              </span>
            </label>
            {draft.is_hidden && !draft.is_active ? (
              <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {COPY.isHiddenInactiveWarn}
              </p>
            ) : null}
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
