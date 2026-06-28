// Edge Function: stripe-webhook (verify_jwt DISATTIVO — deploy con --no-verify-jwt)
//
// Riceve gli eventi Stripe, verifica la firma (HMAC SHA-256 manuale, schema v1,
// tolleranza 5 minuti) e:
//   - logga OGNI evento in `stripe_webhook_events` (insert idempotente);
//   - checkout.session.completed → sales 'paid' + upsert billing_subscriptions
//     (stessa forma del persist web: base_plan_id = product_code, coach_addon_id
//     = primo add-on) + commissioni fisse coach/promoter;
//   - invoice.paid con billing_reason='subscription_cycle' → nuova riga sales
//     'Rinnovo' + commissioni + aggiorna billing_subscriptions.current_period_end.
//     billing_reason='subscription_create' è ignorato (già coperto dal checkout).
//
// Idempotenza vendite: nessun duplicato su stripe_session_id / payment_intent /
// invoice id nella note.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

type ProductRow = {
  id: string;
  code: string;
  name: string;
  price: number;
  currency: string;
  commission_coach_amount: number;
  commission_coach_currency: string;
  commission_promoter_amount: number;
  commission_promoter_currency: string;
};

type SaleMetadata = {
  userId: string | null;
  productCode: string | null;
  addonCodes: string[];
  athleteId: string | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Verifica firma Stripe (schema v1) ────────────────────────────────────────

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;

  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signatures.some((sig) => timingSafeEqualHex(sig, expected));
}

// ── Stripe REST (lettura subscription per periodo/stato) ─────────────────────

// deno-lint-ignore no-explicit-any
async function stripeGet(path: string): Promise<any | null> {
  if (!STRIPE_SECRET_KEY) return null;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

function unixToIso(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}

/** current_period_end: top-level (API classiche) o sul primo item (API Basil 2025+). */
// deno-lint-ignore no-explicit-any
function subscriptionPeriodEnd(subscription: any): string | null {
  return unixToIso(subscription?.current_period_end) ??
    unixToIso(subscription?.items?.data?.[0]?.current_period_end);
}

/** subscription id dell'invoice: top-level (API classiche) o in parent (API Basil 2025+). */
// deno-lint-ignore no-explicit-any
function invoiceSubscriptionId(invoice: any): string | null {
  return asTrimmedString(invoice?.subscription) ??
    asTrimmedString(invoice?.parent?.subscription_details?.subscription);
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readSaleMetadata(metadata: Record<string, unknown> | null | undefined): SaleMetadata {
  const addonCsv = asTrimmedString(metadata?.addon_codes) ?? "";
  return {
    userId: asTrimmedString(metadata?.user_id),
    productCode: asTrimmedString(metadata?.product_code),
    addonCodes: addonCsv.split(",").map((c) => c.trim()).filter((c) => c !== ""),
    athleteId: asTrimmedString(metadata?.athlete_id),
  };
}

// ── Persistenza ──────────────────────────────────────────────────────────────

async function loadProducts(
  admin: SupabaseClient,
  codes: string[],
): Promise<Map<string, ProductRow>> {
  if (codes.length === 0) return new Map();
  const { data, error } = await admin
    .from("products")
    .select(
      "id, code, name, price, currency, commission_coach_amount, commission_coach_currency, commission_promoter_amount, commission_promoter_currency",
    )
    .in("code", codes);
  if (error) throw new Error(`Lettura prodotti fallita: ${error.message}`);
  return new Map(((data ?? []) as ProductRow[]).map((p) => [p.code, p]));
}

async function findCoachForAthlete(admin: SupabaseClient, athleteId: string | null): Promise<string | null> {
  if (!athleteId) return null;
  const { data } = await admin
    .from("coach_athletes")
    .select("coach_user_id, created_at")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { coach_user_id: string } | null)?.coach_user_id ?? null;
}

/** Commissioni fisse per ogni prodotto venduto (base + add-on) con importo > 0. */
async function insertCommissions(
  admin: SupabaseClient,
  saleId: string,
  soldProducts: ProductRow[],
  coachUserId: string | null,
): Promise<void> {
  const rows: Record<string, unknown>[] = [];
  for (const product of soldProducts) {
    const coachAmount = Number(product.commission_coach_amount) || 0;
    if (coachAmount > 0) {
      rows.push({
        sale_id: saleId,
        beneficiary_kind: "coach",
        beneficiary_user_id: coachUserId,
        amount: coachAmount,
        currency: product.commission_coach_currency,
        status: "accrued",
        note: `Prodotto ${product.code}`,
      });
    }
    const promoterAmount = Number(product.commission_promoter_amount) || 0;
    if (promoterAmount > 0) {
      rows.push({
        sale_id: saleId,
        beneficiary_kind: "promoter",
        beneficiary_user_id: null, // ruolo promoter non ancora in piattaforma
        amount: promoterAmount,
        currency: product.commission_promoter_currency,
        status: "accrued",
        note: `Prodotto ${product.code}`,
      });
    }
  }
  if (rows.length === 0) return;
  const { error } = await admin.from("commissions").insert(rows);
  if (error) throw new Error(`Insert commissions fallita: ${error.message}`);
}

// ── Handler: checkout.session.completed ──────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function handleCheckoutCompleted(admin: SupabaseClient, session: any): Promise<string> {
  const sessionId: string | null = asTrimmedString(session?.id);
  if (!sessionId) return "session_senza_id";

  // Idempotenza: vendita già registrata per questa sessione.
  const { data: existing } = await admin
    .from("sales")
    .select("id")
    .eq("stripe_session_id", sessionId)
    .limit(1)
    .maybeSingle();
  if (existing) return "gia_registrata";

  const meta = readSaleMetadata(session?.metadata);
  if (!meta.userId || !meta.productCode) return "metadata_incompleti";

  const products = await loadProducts(admin, [meta.productCode, ...meta.addonCodes]);
  const base = products.get(meta.productCode) ?? null;
  const addons = meta.addonCodes
    .map((code) => products.get(code))
    .filter((p): p is ProductRow => Boolean(p));

  const subscriptionId = asTrimmedString(session?.subscription);
  const paymentIntentId = asTrimmedString(session?.payment_intent);
  const amount = typeof session?.amount_total === "number" ? session.amount_total / 100 : 0;
  const currency = (asTrimmedString(session?.currency) ?? base?.currency ?? "chf").toUpperCase();

  const coachUserId = await findCoachForAthlete(admin, meta.athleteId);

  const { data: saleRow, error: saleError } = await admin
    .from("sales")
    .insert({
      user_id: meta.userId,
      athlete_id: meta.athleteId,
      product_id: base?.id ?? null,
      product_code: meta.productCode,
      product_name: base?.name ?? meta.productCode,
      addons: addons.length > 0
        ? addons.map((a) => ({ code: a.code, name: a.name, price: Number(a.price) || 0, currency: a.currency }))
        : null,
      amount,
      currency,
      source: "stripe",
      status: "paid",
      stripe_session_id: sessionId,
      stripe_subscription_id: subscriptionId,
      stripe_payment_intent_id: paymentIntentId,
      coach_user_id: coachUserId,
    })
    .select("id")
    .single();
  if (saleError) throw new Error(`Insert sales fallita: ${saleError.message}`);
  const saleId = (saleRow as { id: string }).id;

  // billing_subscriptions: stessa forma del persist web (stripe-billing-persist.ts).
  if (subscriptionId) {
    const subscription = await stripeGet(`subscriptions/${subscriptionId}`);
    const customerId = asTrimmedString(subscription?.customer) ?? asTrimmedString(session?.customer);
    if (customerId) {
      const { error: subError } = await admin.from("billing_subscriptions").upsert(
        {
          user_id: meta.userId,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          status: asTrimmedString(subscription?.status) ?? "active",
          current_period_end: subscriptionPeriodEnd(subscription),
          cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
          base_plan_id: meta.productCode,
          coach_addon_id: meta.addonCodes[0] ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" },
      );
      if (subError) throw new Error(`Upsert billing_subscriptions fallita: ${subError.message}`);
    }
  }

  const soldProducts = base ? [base, ...addons] : addons;
  await insertCommissions(admin, saleId, soldProducts, coachUserId);

  // Redenzione codice promo: contata QUI, a pagamento avvenuto (non alla creazione
  // della sessione → un checkout abbandonato non brucia una redenzione). Idempotente:
  // se la vendita per questa sessione esiste già usciamo prima ("gia_registrata"),
  // quindi nessun doppio incremento sulle ridistribuzioni Stripe.
  const promoCode = asTrimmedString(session?.metadata?.promo_code);
  if (promoCode) {
    const { error: redeemError } = await admin.rpc("redeem_promo_code", { p_code: promoCode });
    if (redeemError) console.error("redeem_promo_code error:", redeemError.message);
  }

  return "registrata";
}

// ── Handler: invoice.paid (solo rinnovi subscription_cycle) ──────────────────

// deno-lint-ignore no-explicit-any
async function handleInvoicePaid(admin: SupabaseClient, invoice: any): Promise<string> {
  const billingReason = asTrimmedString(invoice?.billing_reason);
  if (billingReason !== "subscription_cycle") {
    // subscription_create è già coperto da checkout.session.completed.
    return `ignorata_billing_reason_${billingReason ?? "sconosciuta"}`;
  }

  const invoiceId = asTrimmedString(invoice?.id);
  const subscriptionId = invoiceSubscriptionId(invoice);
  const paymentIntentId = asTrimmedString(invoice?.payment_intent);
  if (!invoiceId || !subscriptionId) return "invoice_incompleta";

  // Idempotenza: stesso payment_intent o invoice id già in note.
  if (paymentIntentId) {
    const { data: byIntent } = await admin
      .from("sales")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .limit(1)
      .maybeSingle();
    if (byIntent) return "gia_registrata";
  }
  const { data: byNote } = await admin
    .from("sales")
    .select("id")
    .like("note", `%${invoiceId}%`)
    .limit(1)
    .maybeSingle();
  if (byNote) return "gia_registrata";

  // Metadata dalla subscription (replicati dal checkout); fallback su DB.
  const subscription = await stripeGet(`subscriptions/${subscriptionId}`);
  let meta = readSaleMetadata(subscription?.metadata);

  if (!meta.userId || !meta.productCode) {
    const { data: subRow } = await admin
      .from("billing_subscriptions")
      .select("user_id, base_plan_id, coach_addon_id")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    const row = subRow as { user_id: string; base_plan_id: string; coach_addon_id: string | null } | null;
    if (!row) return "subscription_sconosciuta";
    meta = {
      userId: meta.userId ?? row.user_id,
      productCode: meta.productCode ?? row.base_plan_id,
      addonCodes: meta.addonCodes.length > 0 ? meta.addonCodes : (row.coach_addon_id ? [row.coach_addon_id] : []),
      athleteId: meta.athleteId,
    };
  }
  if (!meta.userId || !meta.productCode) return "metadata_incompleti";

  if (!meta.athleteId) {
    const { data: appProfile } = await admin
      .from("app_user_profiles")
      .select("athlete_id")
      .eq("user_id", meta.userId)
      .maybeSingle();
    meta.athleteId = (appProfile as { athlete_id: string | null } | null)?.athlete_id ?? null;
  }

  const products = await loadProducts(admin, [meta.productCode, ...meta.addonCodes]);
  const base = products.get(meta.productCode) ?? null;
  const addons = meta.addonCodes
    .map((code) => products.get(code))
    .filter((p): p is ProductRow => Boolean(p));

  const amount = typeof invoice?.amount_paid === "number" ? invoice.amount_paid / 100 : 0;
  const currency = (asTrimmedString(invoice?.currency) ?? base?.currency ?? "chf").toUpperCase();

  const coachUserId = await findCoachForAthlete(admin, meta.athleteId);

  const { data: saleRow, error: saleError } = await admin
    .from("sales")
    .insert({
      user_id: meta.userId,
      athlete_id: meta.athleteId,
      product_id: base?.id ?? null,
      product_code: meta.productCode,
      product_name: base?.name ?? meta.productCode,
      addons: addons.length > 0
        ? addons.map((a) => ({ code: a.code, name: a.name, price: Number(a.price) || 0, currency: a.currency }))
        : null,
      amount,
      currency,
      source: "stripe",
      status: "paid",
      stripe_subscription_id: subscriptionId,
      stripe_payment_intent_id: paymentIntentId,
      coach_user_id: coachUserId,
      note: `Rinnovo — invoice ${invoiceId}`,
    })
    .select("id")
    .single();
  if (saleError) throw new Error(`Insert sales (rinnovo) fallita: ${saleError.message}`);
  const saleId = (saleRow as { id: string }).id;

  const soldProducts = base ? [base, ...addons] : addons;
  await insertCommissions(admin, saleId, soldProducts, coachUserId);

  // Aggiorna il periodo corrente dell'abbonamento.
  const periodEnd = subscriptionPeriodEnd(subscription) ??
    unixToIso(invoice?.lines?.data?.[0]?.period?.end);
  if (periodEnd) {
    await admin
      .from("billing_subscriptions")
      .update({
        current_period_end: periodEnd,
        status: asTrimmedString(subscription?.status) ?? "active",
        cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", subscriptionId);
  }

  return "rinnovo_registrato";
}

// ── Ciclo di vita abbonamento (updated/deleted) ──────────────────────────────
// Mantiene `billing_subscriptions` fresco quando Stripe cambia stato fuori dal
// ciclo di incasso: pagamento fallito (past_due/unpaid), disdetta a fine periodo
// (cancel_at_period_end), cancellazione (deleted → status canceled).
// L'entitlement scade comunque da solo via current_period_end: questo handler
// evita solo stati zombie e fa vedere all'admin la verità in Abbonamenti.
// deno-lint-ignore no-explicit-any
async function handleSubscriptionLifecycle(
  admin: SupabaseClient,
  // deno-lint-ignore no-explicit-any
  subscription: any,
  deleted: boolean,
): Promise<string> {
  const subscriptionId = asTrimmedString(subscription?.id);
  if (!subscriptionId) return "subscription_senza_id";

  const update: Record<string, unknown> = {
    status: deleted ? "canceled" : (asTrimmedString(subscription?.status) ?? "active"),
    cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
    updated_at: new Date().toISOString(),
  };
  const periodEnd = subscriptionPeriodEnd(subscription);
  if (periodEnd) update.current_period_end = periodEnd;

  const { error } = await admin
    .from("billing_subscriptions")
    .update(update)
    .eq("stripe_subscription_id", subscriptionId);
  if (error) throw new Error(`billing_subscriptions lifecycle update: ${error.message}`);

  return deleted ? "abbonamento_cancellato" : "stato_abbonamento_aggiornato";
}

// ── Entry point ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const payload = await req.text();
  const signatureOk = await verifyStripeSignature(
    payload,
    req.headers.get("stripe-signature"),
    STRIPE_WEBHOOK_SECRET,
  );
  if (!signatureOk) {
    return jsonResponse({ error: "Firma Stripe non valida." }, 400);
  }

  // deno-lint-ignore no-explicit-any
  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return jsonResponse({ error: "Payload non valido." }, 400);
  }
  const eventId = asTrimmedString(event?.id);
  const eventType = asTrimmedString(event?.type) ?? "unknown";

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Log idempotente di OGNI evento (pk = event id).
  if (eventId) {
    const { error: logError } = await admin
      .from("stripe_webhook_events")
      .upsert({ id: eventId }, { onConflict: "id", ignoreDuplicates: true });
    if (logError) console.error("stripe_webhook_events log error:", logError.message);
  }

  try {
    let outcome = "ignorato";
    if (eventType === "checkout.session.completed") {
      outcome = await handleCheckoutCompleted(admin, event?.data?.object);
    } else if (eventType === "invoice.paid") {
      outcome = await handleInvoicePaid(admin, event?.data?.object);
    } else if (eventType === "customer.subscription.updated") {
      outcome = await handleSubscriptionLifecycle(admin, event?.data?.object, false);
    } else if (eventType === "customer.subscription.deleted") {
      outcome = await handleSubscriptionLifecycle(admin, event?.data?.object, true);
    }
    return jsonResponse({ received: true, outcome });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`stripe-webhook ${eventType} error:`, message);
    // 500 → Stripe ritenta: le scritture sono idempotenti.
    return jsonResponse({ error: message }, 500);
  }
});
