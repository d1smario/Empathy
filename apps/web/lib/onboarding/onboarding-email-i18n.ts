/**
 * Traduttore Onboarding **server-side** per la mail cron: risolve la locale dell'atleta
 * (IT/EN) e restituisce un `t` legato al namespace `Onboarding`, senza dipendere dal
 * contesto di richiesta (il cron gira fuori da una sessione utente).
 *
 * Usa `createTranslator` di next-intl con i messaggi caricati direttamente dai file locale
 * (stessa fonte di `i18n/request.ts`), così la mail e la «sala d'attesa» condividono le stringhe.
 */
import { createTranslator } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import { DEFAULT_LOCALE, coerceLocale, type SupportedLocale } from "@/lib/i18n/supported-locales";
import type { OnboardingEmailTranslator } from "./onboarding-email-content";

async function loadMessages(locale: SupportedLocale): Promise<AbstractIntlMessages> {
  try {
    return (await import(`../../messages/${locale}.json`)).default as AbstractIntlMessages;
  } catch {
    return (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default as AbstractIntlMessages;
  }
}

/**
 * Traduttore Onboarding per la locale indicata (free-form → normalizzata, fallback `it`).
 * Il chiamante può cacheare il risultato per locale a monte del loop atleti.
 */
export async function loadOnboardingEmailTranslator(
  rawLocale: string | null | undefined,
): Promise<OnboardingEmailTranslator> {
  const locale = coerceLocale(rawLocale, DEFAULT_LOCALE);
  const messages = await loadMessages(locale);
  const translator = createTranslator({ locale, messages, namespace: "Onboarding" });
  return translator as unknown as OnboardingEmailTranslator;
}
