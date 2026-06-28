// Edge Function: stripe-checkout-session (verify_jwt=false — l'utente è verificato
// manualmente via Authorization header con authClient.auth.getUser(), 401 se assente)
//
// Crea una Stripe Checkout Session per il prodotto base + add-on scelti,
// con price_data AL VOLO dalle righe `products` (zero hardcode prezzi).
// Caso prodotto gratuito (totale 0): niente Stripe — registra la vendita in
// `sales` (status 'free') e l'accesso in `subscription_grants` (kind 'comp').
//
// Codice promo (opzionale, ereditato dalla scelta piano): RIVALIDATO sempre
// server-side rileggendo `promo_codes` via service role (mai fidarsi del client).
//   - kind 'discount': sconto (percent o importo) applicato sull'unit_amount
//     del prodotto base (Stripe) o sul totale (attivazione gratuita).
//   - kind 'unlock': consente l'acquisto del prodotto nascosto (is_hidden)
//     quando coincide con il target del codice.
//   - Quando il codice viene effettivamente speso (sessione Stripe creata o
//     attivazione gratuita andata a buon fine) incrementa `redemption_count`.
//
// Input  JSON: { productCode: string, addonCodes?: string[], promoCode?: string, successUrl: string, cancelUrl: string }
// Output JSON: { url } (Stripe) oppure { freeActivated: true } (gratuito)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ProductRow = {
  id: string;
  code: string;
  name: string;
  subtitle: string | null;
  kind: "base" | "addon";
  price: number;
  currency: string;
  billing_interval: "one_time" | "month" | "year";
  duration_days: number | null;
  show_addons: boolean;
  is_active: boolean;
  is_hidden: boolean;
};

type PromoRow = {
  id: string;
  code: string;
  kind: "discount" | "unlock";
  target_product_id: string | null;
  discount_type: "percent" | "amount" | null;
  discount_value: number | null;
  discount_currency: string | null;
  expires_at: string | null;
  max_redemptions: number | null;
  redemption_count: number | null;
  is_active: boolean;
};

type CheckoutInput = {
  productCode?: unknown;
  addonCodes?: unknown;
  promoCode?: unknown;
  successUrl?: unknown;
  cancelUrl?: unknown;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function badRequest(message: string): Response {
  return jsonResponse({ error: message }, 400);
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v !== "");
}

type PromoOk = { ok: true; promo: PromoRow | null };
type PromoErr = { ok: false; response: Response };

/**
 * Rivalida il codice promo server-side (lettura fresca da `promo_codes`,
 * service role). Ritorna { promo: null } se nessun codice è stato passato.
 * Non incrementa nulla: la redenzione avviene dopo lo "spesa" del codice.
 */
// deno-lint-ignore no-explicit-any
async function validatePromo(admin: any, rawCode: string | null): Promise<PromoOk | PromoErr> {
  if (!rawCode) return { ok: true, promo: null };

  const { data: rows, error } = await admin
    .from("promo_codes")
    .select(
      "id, code, kind, target_product_id, discount_type, discount_value, discount_currency, expires_at, max_redemptions, redemption_count, is_active",
    )
    .ilike("code", rawCode)
    .limit(1);
  if (error) {
    return { ok: false, response: jsonResponse({ error: `Lettura codice promo fallita: ${error.message}` }, 500) };
  }
  const promo = ((rows ?? []) as PromoRow[])[0] ?? null;
  if (!promo) return { ok: false, response: jsonResponse({ error: "Codice promo non valido." }, 404) };
  if (!promo.is_active) return { ok: false, response: badRequest("Questo codice promo non è più attivo.") };
  if (promo.expires_at && new Date(promo.expires_at) <= new Date()) {
    return { ok: false, response: jsonResponse({ error: "Questo codice promo è scaduto." }, 410) };
  }
  const max = promo.max_redemptions ?? null;
  const count = Number(promo.redemption_count) || 0;
  if (max != null && count >= max) {
    return { ok: false, response: jsonResponse({ error: "Codice promo: limite di utilizzi raggiunto." }, 409) };
  }
  return { ok: true, promo };
}

/**
 * Sconto sull'importo del prodotto base (in unità di valuta, non centesimi).
 * Percentuale clampata 0..100, importo fisso clampato al prezzo base. Non
 * scende mai sotto zero.
 */
function discountedBasePrice(basePrice: number, promo: PromoRow | null): number {
  if (!promo || promo.kind !== "discount") return basePrice;
  const value = Number(promo.discount_value) || 0;
  if (value <= 0) return basePrice;
  if (promo.discount_type === "amount") {
    return Math.max(0, basePrice - value);
  }
  // percent
  const pct = Math.min(100, Math.max(0, value));
  return Math.max(0, basePrice * (1 - pct / 100));
}

/**
 * Incremento ATOMICO di redemption_count via RPC `redeem_promo_code` (un solo UPDATE
 * con guard `< max_redemptions`): niente read-modify-write, niente superamento del
 * limite anche con redenzioni concorrenti.
 */
// deno-lint-ignore no-explicit-any
async function bumpRedemption(admin: any, promo: PromoRow): Promise<void> {
  const { error } = await admin.rpc("redeem_promo_code", { p_code: promo.code });
  if (error) console.error("redeem_promo_code error:", error.message);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let input: CheckoutInput;
  try {
    input = await req.json();
  } catch {
    return badRequest("Body JSON non valido.");
  }

  const productCode = asTrimmedString(input.productCode);
  const successUrl = asTrimmedString(input.successUrl);
  const cancelUrl = asTrimmedString(input.cancelUrl);
  const addonCodes = asStringArray(input.addonCodes);
  const promoCode = asTrimmedString(input.promoCode);
  if (!productCode) return badRequest("productCode mancante.");
  if (!successUrl || !cancelUrl) return badRequest("successUrl/cancelUrl mancanti.");

  // Whitelisting redirect: gli URL devono stare sull'origin chiamante.
  const origin = req.headers.get("origin");
  if (!origin || !successUrl.startsWith(origin) || !cancelUrl.startsWith(origin)) {
    return badRequest("successUrl/cancelUrl devono appartenere all'origin della richiesta.");
  }

  // ── Utente dall'Authorization header ────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  const user = userData?.user ?? null;
  if (userError || !user) {
    return jsonResponse({ error: "Utente non autenticato." }, 401);
  }

  // ── Prodotti dal DB (service role) ──────────────────────────────────────
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Codice promo: SEMPRE rivalidato server-side (mai fidarsi del client).
  const promoCheck = await validatePromo(admin, promoCode);
  if (!promoCheck.ok) return promoCheck.response;
  const promo = promoCheck.promo;

  const wantedCodes = [productCode, ...addonCodes];
  const { data: productRows, error: productsError } = await admin
    .from("products")
    .select(
      "id, code, name, subtitle, kind, price, currency, billing_interval, duration_days, show_addons, is_active, is_hidden",
    )
    .in("code", wantedCodes);
  if (productsError) {
    return jsonResponse({ error: `Lettura prodotti fallita: ${productsError.message}` }, 500);
  }

  const byCode = new Map<string, ProductRow>(
    ((productRows ?? []) as ProductRow[]).map((p) => [p.code, p]),
  );

  const base = byCode.get(productCode);
  if (!base || base.kind !== "base" || !base.is_active) {
    return badRequest("Prodotto base inesistente o non attivo.");
  }

  // Prodotto NASCOSTO (is_hidden): vendibile solo con un codice 'unlock' che
  // punta proprio a questo prodotto. Senza codice valido → non acquistabile.
  if (base.is_hidden) {
    const unlockOk = promo && promo.kind === "unlock" && promo.target_product_id === base.id;
    if (!unlockOk) {
      return badRequest("Questo prodotto richiede un codice di sblocco valido.");
    }
  }

  const addons: ProductRow[] = [];
  for (const code of addonCodes) {
    const addon = byCode.get(code);
    if (!addon || addon.kind !== "addon" || !addon.is_active) {
      return badRequest(`Add-on '${code}' inesistente o non attivo.`);
    }
    addons.push(addon);
  }
  if (addons.length > 0 && !base.show_addons) {
    return badRequest("Il prodotto base scelto non ammette add-on.");
  }

  // Sconto applicato SOLO al prodotto base (non agli add-on coach).
  const rawBasePrice = Number(base.price) || 0;
  const basePrice = discountedBasePrice(rawBasePrice, promo);
  const total = addons.reduce((sum, a) => sum + (Number(a.price) || 0), basePrice);

  // athlete_id dell'utente (può essere null: account senza profilo atleta).
  const { data: appProfile } = await admin
    .from("app_user_profiles")
    .select("athlete_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const athleteId: string | null = (appProfile as { athlete_id: string | null } | null)?.athlete_id ?? null;

  // ── PRODOTTO GRATUITO: niente Stripe, sale 'free' + subscription_grant ──
  if (total <= 0) {
    // Una sola attivazione per prodotto gratuito per utente: la prova non si
    // ripete (né doppioni da doppio click — la vendita precedente fa da lock).
    const { data: prior } = await admin
      .from("sales")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_code", base.code)
      .limit(1);
    if (prior && prior.length > 0) {
      return badRequest("Hai già utilizzato questo piano gratuito. Scegli un piano per continuare.");
    }

    const { error: saleError } = await admin.from("sales").insert({
      user_id: user.id,
      athlete_id: athleteId,
      product_id: base.id,
      product_code: base.code,
      product_name: base.name,
      addons: addons.length > 0
        ? addons.map((a) => ({ code: a.code, name: a.name, price: Number(a.price) || 0, currency: a.currency }))
        : null,
      amount: 0,
      currency: base.currency,
      source: "manual",
      status: "free",
      note: promo
        ? `Attivazione checkout — prodotto gratuito · codice ${promo.code}`
        : "Attivazione checkout — prodotto gratuito",
      created_by: user.id,
    });
    if (saleError) {
      return jsonResponse({ error: `Registrazione vendita fallita: ${saleError.message}` }, 500);
    }

    // Codice speso: la vendita gratuita è andata a buon fine.
    if (promo) await bumpRedemption(admin, promo);

    const durationDays = base.duration_days ?? 30;
    const now = new Date();
    const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const { error: grantError } = await admin.from("subscription_grants").insert({
      user_id: user.id,
      kind: "comp",
      starts_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      note: base.name,
      granted_by_email: "checkout@empathy",
    });
    if (grantError) {
      return jsonResponse({ error: `Attivazione accesso fallita: ${grantError.message}` }, 500);
    }

    return jsonResponse({ freeActivated: true });
  }

  // ── A PAGAMENTO: Stripe Checkout Session (REST, price_data al volo) ─────
  if (!STRIPE_SECRET_KEY) {
    return jsonResponse({ error: "STRIPE_SECRET_KEY non configurata." }, 500);
  }

  const isRecurringBase = base.billing_interval === "month" || base.billing_interval === "year";
  const mode = isRecurringBase ? "subscription" : "payment";

  const params = new URLSearchParams();
  params.set("mode", mode);
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  if (user.email) params.set("customer_email", user.email);

  const lineItems: ProductRow[] = [base, ...addons];
  lineItems.forEach((item, i) => {
    const prefix = `line_items[${i}]`;
    // Lo sconto promo vale solo sul prodotto base (i == 0); gli add-on a prezzo pieno.
    const unitPrice = i === 0 ? basePrice : (Number(item.price) || 0);
    params.set(`${prefix}[quantity]`, "1");
    params.set(`${prefix}[price_data][currency]`, item.currency.toLowerCase());
    params.set(`${prefix}[price_data][unit_amount]`, String(Math.round(unitPrice * 100)));
    params.set(`${prefix}[price_data][product_data][name]`, item.name);
    if (item.subtitle) {
      params.set(`${prefix}[price_data][product_data][description]`, item.subtitle);
    }
    // In mode=subscription ogni line item ricorrente dichiara l'intervallo.
    if (mode === "subscription" && (item.billing_interval === "month" || item.billing_interval === "year")) {
      params.set(`${prefix}[price_data][recurring][interval]`, item.billing_interval);
    }
  });

  // Nome/cognome fatturazione (se presenti) → metadata.
  const { data: billingProfile } = await admin
    .from("user_billing_profiles")
    .select("first_name, last_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const fullName = [
    (billingProfile as { first_name?: string | null } | null)?.first_name ?? "",
    (billingProfile as { last_name?: string | null } | null)?.last_name ?? "",
  ].join(" ").trim();

  const metadata: Record<string, string> = {
    user_id: user.id,
    product_code: base.code,
    addon_codes: addons.map((a) => a.code).join(","),
    athlete_id: athleteId ?? "",
  };
  if (fullName) metadata.customer_name = fullName;
  if (promo) metadata.promo_code = promo.code;

  for (const [key, value] of Object.entries(metadata)) {
    params.set(`metadata[${key}]`, value);
    if (mode === "subscription") {
      // Replica sulla subscription: serve ai rinnovi (invoice.paid).
      params.set(`subscription_data[metadata][${key}]`, value);
    }
  }

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const stripeBody = await stripeRes.json().catch(() => null);
  if (!stripeRes.ok || !stripeBody?.url) {
    const detail = stripeBody?.error?.message ?? `HTTP ${stripeRes.status}`;
    return jsonResponse({ error: `Creazione sessione Stripe fallita: ${detail}` }, 502);
  }

  // La redenzione del codice promo viene contata dal webhook su
  // checkout.session.completed (a PAGAMENTO avvenuto), NON alla creazione della
  // sessione: così un checkout abbandonato non brucia una redenzione.

  return jsonResponse({ url: stripeBody.url as string });
});
