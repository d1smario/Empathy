"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Pro2Button } from "@/components/ui/empathy";
import { cn } from "@/lib/cn";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { type DirectoryEntry, type ProductRow, fmtAmount } from "./sales-shared";

const COPY = {
  title: "Genera vendita",
  intro: "Registra una vendita manuale: prodotto, cliente, prezzo e accesso alla piattaforma.",
  productLabel: "Prodotto",
  productPlaceholder: "Seleziona un prodotto…",
  productsLoading: "Caricamento prodotti…",
  productsEmpty: "Nessun prodotto attivo — creane uno in Prodotti.",
  clientLabel: "Cliente (cerca per email)",
  clientPlaceholder: "es. mario@",
  searchBtn: "Cerca",
  searching: "Cerco…",
  noResults: "Nessun utente trovato.",
  selectedClient: "Cliente selezionato",
  changeClient: "Cambia",
  priceLabel: "Prezzo",
  priceHintFree: "Importo 0 → vendita registrata come Gratuita.",
  coachLabel: "Coach (opzionale)",
  coachNone: "Nessun coach",
  noteLabel: "Nota",
  notePlaceholder: "es. vendita concordata a voce",
  cancel: "Annulla",
  save: "Registra vendita",
  saving: "Registro…",
  errNoSupabase: "Configurazione Supabase mancante: impossibile registrare la vendita.",
  errNoProduct: "Seleziona un prodotto.",
  errNoClient: "Seleziona un cliente.",
  errBadPrice: "Prezzo non valido: usa un numero ≥ 0.",
} as const;

type LookupUser = {
  userId: string;
  email: string;
  role: "private" | "coach" | null;
};

type CreateSaleDialogProps = {
  /** Mappa userId → entry dalla directory admin (per athlete_id e dropdown coach). */
  directory: Map<string, DirectoryEntry>;
  onClose: () => void;
  /** Vendita registrata: `warning` valorizzato se commissione/accesso non sono andati a buon fine. */
  onCreated: (result: { warning: string | null }) => void;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60";

/** Converte duration_days del prodotto nei mesi accettati da POST /api/admin/grants (1-36). */
function grantMonthsFromDays(durationDays: number | null | undefined): number {
  const days = Number(durationDays ?? 0) > 0 ? Number(durationDays) : 30;
  return Math.min(36, Math.max(1, Math.round(days / 30)));
}

/**
 * Dialog "Genera vendita": INSERT diretto su `sales` (+ `commissions` se il prodotto
 * prevede commissione coach e un coach è selezionato), poi attiva l'accesso del
 * cliente via POST /api/admin/grants (kind 'comp'). Se il grant fallisce la vendita
 * resta valida e viene mostrato un warning.
 */
export function CreateSaleDialog({ directory, onClose, onCreated }: CreateSaleDialogProps) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productId, setProductId] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [results, setResults] = useState<LookupUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [client, setClient] = useState<LookupUser | null>(null);
  const [price, setPrice] = useState("");
  const [coachUserId, setCoachUserId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Prodotti attivi (lettura diretta supabase, ordina per sort_order).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createEmpathyBrowserSupabase();
      if (!supabase) {
        if (!cancelled) {
          setErr(COPY.errNoSupabase);
          setProductsLoading(false);
        }
        return;
      }
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, code, name, subtitle, kind, price, currency, billing_interval, duration_days, commission_coach_amount, commission_coach_currency, is_active, sort_order",
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (cancelled) return;
      if (error) {
        setErr(`Errore caricamento prodotti: ${error.message}`);
      } else {
        setProducts((data ?? []) as ProductRow[]);
      }
      setProductsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );

  const coaches = useMemo(() => {
    const list: { userId: string; email: string }[] = [];
    for (const [userId, entry] of Array.from(directory.entries())) {
      if (entry.role === "coach") list.push({ userId, email: entry.email ?? userId });
    }
    return list.sort((a, b) => a.email.localeCompare(b.email));
  }, [directory]);

  const onProductChange = useCallback(
    (id: string) => {
      setProductId(id);
      const p = products.find((x) => x.id === id);
      // Prezzo default = prezzo prodotto, sempre modificabile.
      if (p) setPrice(String(p.price ?? 0));
    },
    [products],
  );

  const runSearch = useCallback(async () => {
    const q = clientQuery.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/users/lookup?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean; users?: LookupUser[]; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? `Ricerca utente fallita (${res.status}).`);
        setResults([]);
      } else {
        setResults(j.users ?? []);
      }
    } catch {
      setErr("Ricerca utente non riuscita: errore di rete.");
    } finally {
      setSearching(false);
    }
  }, [clientQuery]);

  const priceNum = useMemo(() => {
    const n = Number(price.replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }, [price]);

  const save = useCallback(async () => {
    if (!selectedProduct) {
      setErr(COPY.errNoProduct);
      return;
    }
    if (!client) {
      setErr(COPY.errNoClient);
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setErr(COPY.errBadPrice);
      return;
    }
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setErr(COPY.errNoSupabase);
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const createdBy = sessionData.session?.user.id ?? null;
      const athleteId = directory.get(client.userId)?.athleteId ?? null;
      const status = priceNum === 0 ? "free" : "paid";

      // a) Vendita manuale con snapshot prodotto.
      const { data: sale, error: saleErr } = await supabase
        .from("sales")
        .insert({
          user_id: client.userId,
          athlete_id: athleteId,
          product_id: selectedProduct.id,
          product_code: selectedProduct.code,
          product_name: selectedProduct.name,
          amount: priceNum,
          currency: selectedProduct.currency ?? "CHF",
          source: "manual",
          status,
          coach_user_id: coachUserId || null,
          note: note.trim() || null,
          created_by: createdBy,
        })
        .select("id")
        .single();
      if (saleErr || !sale) {
        setErr(`Vendita non registrata: ${saleErr?.message ?? "insert fallita"}.`);
        return;
      }

      const warnings: string[] = [];

      // b) Commissione coach maturata (accrued), se prevista dal prodotto.
      if (Number(selectedProduct.commission_coach_amount ?? 0) > 0 && coachUserId) {
        const { error: commErr } = await supabase.from("commissions").insert({
          sale_id: sale.id,
          beneficiary_kind: "coach",
          beneficiary_user_id: coachUserId,
          amount: selectedProduct.commission_coach_amount,
          currency: selectedProduct.commission_coach_currency ?? selectedProduct.currency ?? "CHF",
          status: "accrued",
        });
        if (commErr) {
          warnings.push(`Commissione coach non creata: ${commErr.message}.`);
        }
      }

      // c) Accesso al cliente via API grants esistente (kind 'comp').
      //    duration_days del prodotto se presente, altrimenti 30 giorni.
      try {
        const res = await fetch("/api/admin/grants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: client.userId,
            kind: "comp",
            durationMonths: grantMonthsFromDays(selectedProduct.duration_days),
            note: `Vendita manuale — ${selectedProduct.name}`,
          }),
        });
        const j = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          warnings.push(
            `Accesso non attivato (${j.error ?? `errore ${res.status}`}): concedilo manualmente da Abbonamenti.`,
          );
        }
      } catch {
        warnings.push("Accesso non attivato (errore di rete): concedilo manualmente da Abbonamenti.");
      }

      onCreated({ warning: warnings.length > 0 ? warnings.join(" ") : null });
    } catch {
      setErr("Errore inatteso durante la registrazione della vendita.");
    } finally {
      setSaving(false);
    }
  }, [selectedProduct, client, priceNum, directory, coachUserId, note, onCreated]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-sale-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-white/15 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="create-sale-title" className="text-lg font-semibold text-white">
              {COPY.title}
            </h2>
            <p className="mt-1 text-xs text-gray-500">{COPY.intro}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={COPY.cancel}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:border-white/25 hover:text-white"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        {err ? (
          <p className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm text-amber-200" role="alert">
            {err}
          </p>
        ) : null}

        {/* 1. Prodotto */}
        <label className="block text-[11px] uppercase tracking-wider text-zinc-400">
          {COPY.productLabel}
          <select value={productId} onChange={(e) => onProductChange(e.target.value)} className={inputClass}>
            <option value="">{productsLoading ? COPY.productsLoading : COPY.productPlaceholder}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {fmtAmount(p.price, p.currency)}
              </option>
            ))}
          </select>
        </label>
        {!productsLoading && products.length === 0 ? (
          <p className="text-xs text-gray-500">{COPY.productsEmpty}</p>
        ) : null}

        {/* 2. Cliente */}
        {client ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/[0.05] px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-emerald-300">{COPY.selectedClient}</p>
              <p className="truncate text-sm font-medium text-white">{client.email}</p>
            </div>
            <Pro2Button
              type="button"
              variant="secondary"
              className="px-3 py-1.5 text-xs"
              onClick={() => {
                setClient(null);
                setResults([]);
              }}
            >
              {COPY.changeClient}
            </Pro2Button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-[11px] uppercase tracking-wider text-zinc-400">
              {COPY.clientLabel}
              <span className="mt-1 flex gap-2">
                <input
                  type="search"
                  inputMode="email"
                  autoComplete="off"
                  placeholder={COPY.clientPlaceholder}
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void runSearch();
                  }}
                  className={cn(inputClass, "mt-0 flex-1")}
                />
                <Pro2Button
                  type="button"
                  variant="secondary"
                  className="px-4 py-2 text-xs"
                  disabled={searching || clientQuery.trim().length < 2}
                  onClick={() => void runSearch()}
                >
                  {searching ? COPY.searching : COPY.searchBtn}
                </Pro2Button>
              </span>
            </label>
            {results.length > 0 ? (
              <ul className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-1.5">
                {results.map((u) => (
                  <li key={u.userId}>
                    <button
                      type="button"
                      onClick={() => setClient(u)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-200 transition hover:bg-white/10"
                    >
                      <span className="truncate">{u.email}</span>
                      <span className="shrink-0 text-[11px] uppercase text-zinc-500">{u.role ?? "—"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {!searching && results.length === 0 && clientQuery.trim().length >= 2 ? (
              <p className="text-xs text-gray-500">{COPY.noResults}</p>
            ) : null}
          </div>
        )}

        {/* 3. Prezzo */}
        <label className="block text-[11px] uppercase tracking-wider text-zinc-400">
          {COPY.priceLabel}
          {selectedProduct ? (
            <span className="ml-1 normal-case text-gray-600">({selectedProduct.currency ?? "CHF"})</span>
          ) : null}
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputClass}
          />
        </label>
        {Number.isFinite(priceNum) && priceNum === 0 ? (
          <p className="text-xs text-cyan-300">{COPY.priceHintFree}</p>
        ) : null}

        {/* 4. Coach opzionale */}
        <label className="block text-[11px] uppercase tracking-wider text-zinc-400">
          {COPY.coachLabel}
          <select value={coachUserId} onChange={(e) => setCoachUserId(e.target.value)} className={inputClass}>
            <option value="">{COPY.coachNone}</option>
            {coaches.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.email}
              </option>
            ))}
          </select>
        </label>
        {selectedProduct && Number(selectedProduct.commission_coach_amount ?? 0) > 0 ? (
          <p className="text-xs text-gray-500">
            Commissione coach prevista:{" "}
            {fmtAmount(
              selectedProduct.commission_coach_amount,
              selectedProduct.commission_coach_currency ?? selectedProduct.currency,
            )}{" "}
            (maturata se selezioni un coach).
          </p>
        ) : null}

        {/* 5. Nota */}
        <label className="block text-[11px] uppercase tracking-wider text-zinc-400">
          {COPY.noteLabel}
          <input
            type="text"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={COPY.notePlaceholder}
            className={inputClass}
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Pro2Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {COPY.cancel}
          </Pro2Button>
          <Pro2Button
            type="button"
            disabled={saving || !selectedProduct || !client}
            onClick={() => void save()}
          >
            {saving ? COPY.saving : COPY.save}
          </Pro2Button>
        </div>
      </div>
    </div>
  );
}
