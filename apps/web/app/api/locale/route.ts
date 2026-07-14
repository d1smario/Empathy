import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOCALE, coerceLocale, isKnownLocale } from "@/lib/i18n/supported-locales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nome cookie locale (mirror di lib/i18n/resolve-request-locale.ts, che è server-only e pesante). */
const LOCALE_COOKIE_NAME = "EMPATHY_LOCALE";

/**
 * Imposta la lingua scelta **lato server** (Set-Cookie affidabile) e reindirizza alla pagina
 * di provenienza. Robusto dove il cookie client-side non arriva (service worker PWA, browser
 * automatici, cache). Usato dal selettore lingua della vetrina.
 */
export function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const nextParam = url.searchParams.get("next") ?? "/";
  // anti open-redirect: solo path interni same-origin.
  const safeNext = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  const locale = isKnownLocale(code) ? code : coerceLocale(code, DEFAULT_LOCALE);

  const res = NextResponse.redirect(new URL(safeNext, req.url), { status: 303 });
  res.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  // niente cache lungo il percorso (SW /api è NetworkOnly, ma per sicurezza)
  res.headers.set("cache-control", "no-store");
  return res;
}
