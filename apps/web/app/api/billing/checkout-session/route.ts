import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DEPRECATO — Path B ritirato (decisione 2026-07-01). Il checkout canonico è `/access/plan`:
 * piani dal DB `products` via edge `stripe-checkout-session`, con gate anagrafica di
 * fatturazione. Questa route legacy usava un catalogo HARDCODED Silver/Gold e NON aveva il
 * gate anagrafica → poteva far pagare senza fattura completa. Non crea più sessioni: 410 +
 * `redirectUrl` verso il flusso corretto (backstop contro chiamate residue/dirette).
 */
export async function POST() {
  return NextResponse.json(
    { error: "Checkout spostato: usa /access/plan.", deprecated: true, redirectUrl: "/access/plan" },
    { status: 410 },
  );
}
