"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, CreditCard, Sparkles, UserCheck, UserPlus } from "lucide-react";
import {
  isBillingProfileComplete,
  OPEN_BILLING_PROFILE_EVENT,
  type BillingProfileRow,
} from "@/lib/account/billing-profile";
import { Pro2Button } from "@/components/ui/empathy";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/cn";

const CHECKOUT_UNAVAILABLE = "Checkout non ancora attivo su questo ambiente.";
const BILLING_INCOMPLETE =
  "Per acquistare completa prima i tuoi dati di fatturazione — si aprono dall'icona profilo in alto a destra.";

/** Riga `products` letta dal DB (policy pubblica sui soli prodotti attivi). */
type ProductRow = {
  id: string;
  code: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  kind: "base" | "addon";
  price: number | string;
  currency: string;
  billing_interval: "one_time" | "month" | "year";
  duration_days: number | null;
  includes_own_coach: boolean;
  includes_empathy_coach: boolean;
  show_addons: boolean;
  sort_order: number;
};

/** Chip informativi della card, guidati dai flag DB del prodotto. */
function productChips(p: ProductRow): { label: string; icon: typeof UserPlus }[] {
  const chips: { label: string; icon: typeof UserPlus }[] = [];
  if (Number(p.price) === 0) chips.push({ label: "Senza carta", icon: CreditCard });
  if (p.includes_own_coach) chips.push({ label: "Invita il tuo coach", icon: UserPlus });
  if (p.includes_empathy_coach) chips.push({ label: "Coach Empathy dedicato", icon: UserCheck });
  if (p.show_addons) chips.push({ label: "Pacchetti coach aggiuntivi", icon: Sparkles });
  return chips;
}

type SignupPlanCardsProps = {
  billingFlash?: "success" | "cancel";
};

function productPrice(p: ProductRow): number {
  const n = Number(p.price);
  return Number.isFinite(n) ? n : 0;
}

/** Prezzo formattato it-CH (CHF ecc.), senza decimali se intero. */
function formatProductPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("it-CH", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/** Bullet della card dal campo `description` (una riga per feature). */
function productFeatures(p: ProductRow): string[] {
  if (!p.description) return [];
  return p.description
    .split(/\r?\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

/**
 * Gate post-registrazione DB-driven: card piani da `products` (kind 'base'),
 * carrello add-on coach per i prodotti con `show_addons`, checkout via Edge
 * Function `stripe-checkout-session` (Stripe o attivazione gratuita).
 */
export function SignupPlanCards({ billingFlash }: SignupPlanCardsProps) {
  const t = useTranslations("Checkout");
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [addonCodes, setAddonCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState<false | string>(false);
  const [err, setErr] = useState<string | null>(null);

  // Accesso già attivo (es. webhook Stripe arrivato in ritardo) → dentro.
  useEffect(() => {
    if (billingFlash === "success") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/entitlement?repair=1", { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; hasAthleteAccess?: boolean };
        if (!cancelled && res.ok && data.ok && data.hasAthleteAccess) {
          window.location.assign("/dashboard?welcome=1");
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [billingFlash]);

  // Prodotti attivi dal DB (policy products_public_read_active).
  useEffect(() => {
    const sb = createEmpathyBrowserSupabase();
    if (!sb) {
      setLoadErr("Configurazione Supabase mancante: impossibile caricare i piani.");
      setProducts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await sb
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (cancelled) return;
      if (error) {
        setLoadErr("Impossibile caricare i piani in questo momento. Riprova più tardi.");
        setProducts([]);
        return;
      }
      setProducts((data ?? []) as ProductRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const basePlans = useMemo(() => (products ?? []).filter((p) => p.kind === "base"), [products]);
  const addons = useMemo(() => (products ?? []).filter((p) => p.kind === "addon"), [products]);

  const selectedPlan = basePlans.find((p) => p.code === selectedCode) ?? basePlans[0] ?? null;
  const selectedAddons = selectedPlan?.show_addons
    ? addons.filter((a) => addonCodes.includes(a.code))
    : [];
  const cartTotal = selectedPlan
    ? productPrice(selectedPlan) + selectedAddons.reduce((sum, a) => sum + productPrice(a), 0)
    : 0;

  function priceSuffix(p: ProductRow): string {
    const parts: string[] = [];
    if (p.billing_interval === "month") parts.push(t("perMonthSuffix"));
    if (p.billing_interval === "year") parts.push(" / anno");
    if (p.duration_days != null && p.duration_days > 0) parts.push(` · ${p.duration_days} giorni`);
    return parts.join("");
  }

  function toggleAddon(code: string) {
    setAddonCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function goCheckout(plan: ProductRow) {
    setErr(null);
    setSelectedCode(plan.code);
    const sb = createEmpathyBrowserSupabase();
    if (!sb) {
      setErr(CHECKOUT_UNAVAILABLE);
      return;
    }

    // Piani a pagamento: anagrafica completa obbligatoria (fattura/ricevuta CH).
    if (productPrice(plan) > 0) {
      const {
        data: { session },
      } = await sb.auth.getSession();
      const { data: bp } = await sb
        .from("user_billing_profiles")
        .select("first_name,last_name,address_line1,postal_code,city,country_code")
        .eq("user_id", session?.user?.id ?? "")
        .maybeSingle();
      if (!isBillingProfileComplete(bp as Partial<BillingProfileRow> | null)) {
        setErr(BILLING_INCOMPLETE);
        window.dispatchEvent(new CustomEvent(OPEN_BILLING_PROFILE_EVENT));
        return;
      }
    }

    setLoading(plan.code);
    let navigating = false;
    try {
      const origin = window.location.origin;
      const { data, error } = await sb.functions.invoke("stripe-checkout-session", {
        body: {
          productCode: plan.code,
          addonCodes: plan.show_addons ? addonCodes : [],
          successUrl: `${origin}/access/plan?billing=success`,
          cancelUrl: `${origin}/access/plan?billing=cancel`,
        },
      });
      if (error) {
        let detail: string | null = null;
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            const body = (await ctx.json()) as { error?: string };
            if (typeof body?.error === "string" && body.error.trim()) detail = body.error;
          }
        } catch {
          /* ignore */
        }
        setErr(detail ?? CHECKOUT_UNAVAILABLE);
        return;
      }
      const res = data as { url?: string; freeActivated?: boolean; error?: string } | null;
      if (res?.freeActivated) {
        navigating = true;
        window.location.assign("/dashboard?welcome=1");
        return;
      }
      if (res?.url) {
        navigating = true;
        window.location.href = res.url;
        return;
      }
      setErr(typeof res?.error === "string" && res.error.trim() ? res.error : CHECKOUT_UNAVAILABLE);
    } catch {
      setErr(CHECKOUT_UNAVAILABLE);
    } finally {
      if (!navigating) setLoading(false);
    }
  }

  return (
    <section id="access-plan-checkout" className="scroll-mt-24">
      {billingFlash === "success" ? (
        <p
          className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          role="status"
        >
          {t("signupBillingSuccess")}
        </p>
      ) : null}
      {billingFlash === "cancel" ? (
        <p
          className="mb-6 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          role="status"
        >
          {t("billingCancel")}
        </p>
      ) : null}
      {loadErr ? (
        <p className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90">
          {loadErr}
        </p>
      ) : null}

      {products === null ? (
        <p className="py-10 text-center text-sm text-gray-500">Caricamento piani…</p>
      ) : null}
      {products !== null && basePlans.length === 0 && !loadErr ? (
        <p className="py-10 text-center text-sm text-gray-500">
          Nessun piano disponibile al momento. Riprova più tardi.
        </p>
      ) : null}

      {/* ── Card piani (DB-driven) ───────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {basePlans.map((plan) => {
          const price = productPrice(plan);
          const isFree = price === 0;
          const isGold = /gold/i.test(plan.code) || /gold/i.test(plan.name);
          const selected = selectedPlan?.code === plan.code;
          const features = productFeatures(plan);
          return (
            <div
              key={plan.code}
              onClick={() => setSelectedCode(plan.code)}
              className={cn(
                "relative flex cursor-pointer flex-col rounded-2xl border p-6 backdrop-blur-md transition",
                isFree
                  ? "border-purple-400/50 bg-gradient-to-b from-purple-500/[0.12] to-white/[0.03] shadow-lg shadow-purple-500/15 ring-2 ring-purple-500/30"
                  : isGold
                    ? "border-orange-400/35 bg-white/[0.03] shadow-lg shadow-orange-500/10"
                    : "border-white/10 bg-white/[0.03]",
                selected && !isFree && "border-purple-400/60 ring-2 ring-purple-500/30",
              )}
            >
              {isFree ? (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full border border-purple-400/50 bg-[#17101f] px-3 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-purple-200">
                  <Sparkles className="h-3 w-3 text-orange-300" aria-hidden />
                  {t("recommended")}
                </span>
              ) : null}
              <span
                className={cn(
                  "font-mono text-[0.6rem] uppercase tracking-[0.2em]",
                  isFree ? "text-purple-300/90" : isGold ? "text-orange-300/90" : "text-gray-400",
                )}
              >
                {plan.name}
              </span>
              <span className="mt-2 text-3xl font-black text-white sm:text-4xl">
                {formatProductPrice(price, plan.currency)}
                <span className="text-sm font-semibold text-gray-500 sm:text-base">{priceSuffix(plan)}</span>
              </span>
              {plan.subtitle ? (
                <span className="mt-3 text-sm leading-relaxed text-gray-300">{plan.subtitle}</span>
              ) : null}
              {productChips(plan).length > 0 || features.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {/* Badge dai flag del prodotto… */}
                  {productChips(plan).map((c) => {
                    const ChipIcon = c.icon;
                    return (
                      <span
                        key={c.label}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[0.65rem] font-medium text-gray-300"
                      >
                        <ChipIcon className="h-3 w-3 text-purple-300" aria-hidden />
                        {c.label}
                      </span>
                    );
                  })}
                  {/* …e dai punti testo del prodotto (Admin → Prodotti: un campo = un badge). */}
                  {features.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[0.65rem] font-medium text-gray-300"
                    >
                      <Check className="h-3 w-3 text-emerald-400" aria-hidden />
                      {f}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-auto pt-6">
                <Pro2Button
                  type="button"
                  variant={isFree ? "primary" : "secondary"}
                  className={cn(
                    "w-full justify-center",
                    isGold && "border border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/15",
                  )}
                  disabled={loading !== false}
                  onClick={() => goCheckout(plan)}
                >
                  {loading === plan.code ? t("redirecting") : isFree ? "Attiva il piano gratuito" : t("subscribeCta")}
                </Pro2Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Carrello add-on coach (solo prodotto con show_addons) ────────── */}
      {selectedPlan?.show_addons && addons.length > 0 ? (
        <div className="mt-12">
          <h3 className="text-lg font-bold text-white">Potenzia con un coach Empathy</h3>
          <p className="mt-1 text-sm text-gray-500">
            Aggiungi uno o più livelli di supporto al piano {selectedPlan.name}.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {addons.map((a) => {
              const checked = addonCodes.includes(a.code);
              const aPrice = productPrice(a);
              const aFeatures = productFeatures(a);
              return (
                <label
                  key={a.code}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-2xl border p-4 transition",
                    checked
                      ? "border-purple-400/60 bg-purple-500/10 ring-2 ring-purple-500/30"
                      : "border-white/10 bg-black/20 hover:border-white/20",
                  )}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-white">{a.name}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAddon(a.code)}
                      className="mt-1 h-4 w-4 shrink-0 accent-purple-500"
                      aria-label={`Aggiungi ${a.name}`}
                    />
                  </span>
                  <span className="mt-1 block text-sm text-gray-400">
                    +{formatProductPrice(aPrice, a.currency)}
                    {priceSuffix(a)}
                  </span>
                  {a.subtitle ? (
                    <span className="mt-2 text-xs leading-relaxed text-gray-500">{a.subtitle}</span>
                  ) : null}
                  {aFeatures.length > 0 ? (
                    <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-gray-500">
                      {aFeatures.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  ) : null}
                </label>
              );
            })}
          </div>

          {/* Riepilogo carrello */}
          <div className="mt-8 max-w-md rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <h4 className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-400">
              Riepilogo carrello
            </h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-baseline justify-between gap-4">
                <span className="text-gray-300">{selectedPlan.name}</span>
                <span className="font-semibold text-white">
                  {formatProductPrice(productPrice(selectedPlan), selectedPlan.currency)}
                  <span className="text-xs font-normal text-gray-500">{priceSuffix(selectedPlan)}</span>
                </span>
              </li>
              {selectedAddons.map((a) => (
                <li key={a.code} className="flex items-baseline justify-between gap-4">
                  <span className="text-gray-300">{a.name}</span>
                  <span className="font-semibold text-white">
                    +{formatProductPrice(productPrice(a), a.currency)}
                    <span className="text-xs font-normal text-gray-500">{priceSuffix(a)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-white/10 pt-4">
              <span className="text-sm font-bold uppercase tracking-wide text-gray-300">Totale</span>
              <span className="text-2xl font-black text-white">
                {formatProductPrice(cartTotal, selectedPlan.currency)}
                {selectedPlan.billing_interval === "month" ? (
                  <span className="text-sm font-semibold text-gray-500">{t("perMonthSuffix")}</span>
                ) : null}
              </span>
            </div>
            <Pro2Button
              type="button"
              variant="primary"
              className="mt-5 w-full justify-center"
              disabled={loading !== false}
              onClick={() => goCheckout(selectedPlan)}
            >
              {loading === selectedPlan.code ? t("redirecting") : "Vai al checkout"}
            </Pro2Button>
          </div>
        </div>
      ) : null}

      {err ? (
        <p className="mt-6 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}
    </section>
  );
}
