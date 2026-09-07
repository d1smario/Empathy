import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOCALE, coerceLocale, isKnownLocale } from "@/lib/i18n/supported-locales";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nome cookie locale (mirror di lib/i18n/resolve-request-locale.ts, che è server-only e pesante). */
const LOCALE_COOKIE_NAME = "EMPATHY_LOCALE";

/**
 * Imposta la lingua scelta **lato server** (Set-Cookie affidabile) e reindirizza alla pagina
 * di provenienza. Robusto dove il cookie client-side non arriva (service worker PWA, browser
 * automatici, cache). Usato dal selettore lingua della vetrina.
 *
 * ⚠️ Perché scrive ANCHE il profilo: `resolveRequestLocale()` dà la precedenza a
 * `app_user_profiles.preferred_locale` sul cookie. Per un utente loggato il solo cookie
 * veniva quindi ignorato e il selettore sembrava rotto (cambiava bandierina, non la lingua).
 * Un clic sul selettore È una preferenza esplicita: la persistiamo, così le due fonti
 * concordano e la scelta segue l'utente anche su un altro dispositivo.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const nextParam = url.searchParams.get("next") ?? "/";
  // anti open-redirect: solo path interni same-origin.
  const safeNext = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  const locale = isKnownLocale(code) ? code : coerceLocale(code, DEFAULT_LOCALE);

  // Se c'è una sessione, allinea la preferenza salvata. Best-effort: un errore qui non
  // deve impedire il cambio lingua via cookie (che resta la garanzia per gli anonimi).
  try {
    const supabase = createSupabaseCookieClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        const db = createSupabaseAdminClient() ?? supabase;
        await db.from("app_user_profiles").update({ preferred_locale: locale }).eq("user_id", user.id);
      }
    }
  } catch {
    /* nessuna sessione o DB non raggiungibile: prosegue col solo cookie */
  }

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
