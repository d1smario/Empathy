// Edge Function: redeem-promo-code (verify_jwt=false — l'utente è verificato
// manualmente via Authorization header con authClient.auth.getUser(), 401 se assente)
//
// Valida un codice promo a SCELTA PIANO (pagina /access/plan) e ne ritorna
// l'effetto, leggendo `promo_codes` via service role (bypass RLS) — così
// funziona anche per i prodotti `is_hidden` (sblocco).
//
//   kind = 'unlock'   → ritorna il prodotto target (anche se nascosto), così
//                       la UI può mostrarlo/aggiungerlo alla lista e attivarlo.
//   kind = 'discount' → ritorna { discount_type, discount_value,
//                       discount_currency, targetProduct? } per il badge sconto.
//
// La REDENZIONE (incremento redemption_count) NON avviene qui: questo è solo
// un check non distruttivo. Il conteggio viene incrementato dopo, in
// `stripe-checkout-session`, quando il codice viene effettivamente speso.
//
// Input  JSON: { code: string }
// Output JSON: { kind, code, discount?, targetProduct? }

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PromoKind = "discount" | "unlock";
type DiscountType = "percent" | "amount";

type PromoRow = {
  id: string;
  code: string;
  kind: PromoKind;
  target_product_id: string | null;
  discount_type: DiscountType | null;
  discount_value: number | null;
  discount_currency: string | null;
  expires_at: string | null;
  max_redemptions: number | null;
  redemption_count: number | null;
  is_active: boolean;
};

type ProductRow = {
  id: string;
  code: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  kind: "base" | "addon";
  price: number;
  currency: string;
  billing_interval: "one_time" | "month" | "year";
  duration_days: number | null;
  includes_own_coach: boolean;
  includes_empathy_coach: boolean;
  show_addons: boolean;
  sort_order: number;
  is_active: boolean;
  is_hidden: boolean;
};

type RedeemInput = { code?: unknown };

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let input: RedeemInput;
  try {
    input = await req.json();
  } catch {
    return badRequest("Body JSON non valido.");
  }

  const code = asTrimmedString(input.code);
  if (!code) return badRequest("Inserisci un codice promo.");

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

  // ── Promo dal DB (service role: bypassa RLS, vede anche prodotti nascosti) ─
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Match case-insensitive sul codice (i codici si scrivono come capita).
  const { data: promoRows, error: promoError } = await admin
    .from("promo_codes")
    .select(
      "id, code, kind, target_product_id, discount_type, discount_value, discount_currency, expires_at, max_redemptions, redemption_count, is_active",
    )
    .ilike("code", code)
    .limit(1);
  if (promoError) {
    return jsonResponse({ error: `Lettura codice promo fallita: ${promoError.message}` }, 500);
  }

  const promo = ((promoRows ?? []) as PromoRow[])[0] ?? null;
  if (!promo) return jsonResponse({ error: "Codice promo non valido." }, 404);

  if (!promo.is_active) return badRequest("Questo codice promo non è più attivo.");

  if (promo.expires_at && new Date(promo.expires_at) <= new Date()) {
    return jsonResponse({ error: "Questo codice promo è scaduto." }, 410);
  }

  const maxRedemptions = promo.max_redemptions ?? null;
  const redemptionCount = Number(promo.redemption_count) || 0;
  if (maxRedemptions != null && redemptionCount >= maxRedemptions) {
    return jsonResponse({ error: "Questo codice promo ha raggiunto il limite di utilizzi." }, 409);
  }

  // Prodotto target (se presente): letto via service role così include anche
  // i prodotti nascosti (is_hidden) destinati allo sblocco.
  let targetProduct: ProductRow | null = null;
  if (promo.target_product_id) {
    const { data: prodRow, error: prodError } = await admin
      .from("products")
      .select(
        "id, code, name, subtitle, description, kind, price, currency, billing_interval, duration_days, includes_own_coach, includes_empathy_coach, show_addons, sort_order, is_active, is_hidden",
      )
      .eq("id", promo.target_product_id)
      .maybeSingle();
    if (prodError) {
      return jsonResponse({ error: `Lettura prodotto sbloccato fallita: ${prodError.message}` }, 500);
    }
    targetProduct = (prodRow as ProductRow | null) ?? null;
  }

  if (promo.kind === "unlock") {
    if (!targetProduct) {
      return badRequest("Il codice di sblocco non punta a nessun prodotto valido.");
    }
    if (!targetProduct.is_active) {
      return badRequest("Il prodotto sbloccato non è attivo.");
    }
    return jsonResponse({
      kind: "unlock" as const,
      code: promo.code,
      targetProduct,
    });
  }

  // kind === 'discount'
  const discountType: DiscountType = promo.discount_type === "amount" ? "amount" : "percent";
  const discountValue = Number(promo.discount_value) || 0;
  if (discountValue <= 0) {
    return badRequest("Questo codice sconto non ha un valore valido.");
  }
  if (discountType === "percent" && discountValue > 100) {
    return badRequest("Lo sconto percentuale del codice non è valido.");
  }

  return jsonResponse({
    kind: "discount" as const,
    code: promo.code,
    discount: {
      discount_type: discountType,
      discount_value: discountValue,
      discount_currency: asTrimmedString(promo.discount_currency)?.toUpperCase() ?? "CHF",
      target_product_id: promo.target_product_id,
    },
    // Se lo sconto è legato a un prodotto specifico, la UI può evidenziarlo.
    targetProduct: targetProduct && targetProduct.is_active ? targetProduct : null,
  });
});
