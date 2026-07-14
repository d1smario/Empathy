import type { AbstractIntlMessages } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { resolveRequestLocale } from "@/lib/i18n/resolve-request-locale";
import { DEFAULT_LOCALE, FALLBACK_LOCALE, type SupportedLocale } from "@/lib/i18n/supported-locales";

type MsgTree = Record<string, unknown>;

/** Fonde `over` su `base` (over vince, ricorsivo sugli oggetti; array/scalari sostituiti). */
function deepMerge(base: MsgTree, over: MsgTree): MsgTree {
  const out: MsgTree = { ...base };
  for (const key of Object.keys(over)) {
    const b = base[key];
    const o = over[key];
    out[key] =
      b && typeof b === "object" && !Array.isArray(b) && o && typeof o === "object" && !Array.isArray(o)
        ? deepMerge(b as MsgTree, o as MsgTree)
        : o;
  }
  return out;
}

async function loadMessages(locale: SupportedLocale): Promise<AbstractIntlMessages> {
  try {
    const loc = (await import(`../messages/${locale}.json`)).default as MsgTree;
    // Lingue con file PARZIALE (solo vetrina, es. tr) → fondi sopra il fallback universale EN,
    // così le chiavi non tradotte cadono su inglese invece di rompere le pagine app.
    if (locale !== DEFAULT_LOCALE && locale !== FALLBACK_LOCALE) {
      const base = (await import(`../messages/${FALLBACK_LOCALE}.json`)).default as MsgTree;
      return deepMerge(base, loc) as AbstractIntlMessages;
    }
    return loc as AbstractIntlMessages;
  } catch {
    return (await import(`../messages/${DEFAULT_LOCALE}.json`)).default as AbstractIntlMessages;
  }
}

export default getRequestConfig(async () => {
  const locale = await resolveRequestLocale();
  const messages = await loadMessages(locale);
  return {
    locale,
    messages,
    timeZone: "Europe/Zurich",
  };
});
