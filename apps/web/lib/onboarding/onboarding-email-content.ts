/**
 * Contenuto della mail giornaliera di onboarding — DETERMINISTICO, nessuna AI.
 * Riusa il motore di completezza (M1.1): stessa verità della «sala d'attesa».
 * HTML compatibile con i client email (tabelle + stili inline).
 */
import type { OnboardingCompleteness } from "./onboarding-completeness";

/**
 * Traduttore Onboarding già risolto sulla locale dell'atleta (namespace `Onboarding`).
 * Tipo strutturale per non accoppiarsi ai generics di next-intl: il chiamante (cron mail)
 * passa il risultato di `createTranslator({ locale, messages, namespace: "Onboarding" })`.
 */
export type OnboardingEmailTranslator = {
  (key: string, values?: Record<string, string | number>): string;
  has: (key: string) => boolean;
};

export type OnboardingEmailInput = {
  firstName: string | null;
  /** Giorno della finestra (1..3); valori >3 trattati come 3. */
  dayIndex: number;
  completeness: OnboardingCompleteness;
  /** Base URL dell'app; la CTA punta a `${appUrl}/onboarding`. */
  appUrl: string;
  /** Traduttore Onboarding risolto sulla locale dell'atleta (IT/EN). */
  t: OnboardingEmailTranslator;
};

export type OnboardingEmail = { subject: string; htmlBody: string; textBody: string; tag: string };

// Palette brand Empathy: fondo scuro + gradiente viola→rosa→arancio (stesso di /access/plan).
// Il gradiente è progressive-enhancement (`background:SOLID;background:GRAD`): i client che non
// supportano linear-gradient tengono il colore solido di fallback.
const ACCENT = "#a78bfa"; // viola brand (fallback solido, leggibile su scuro)
const ACCENT_SOFT = "#c4b5fd"; // viola chiaro per eyebrow/label
const GRAD = "linear-gradient(90deg,#a78bfa 0%,#f472b6 55%,#f97316 100%)";
const INK = "#f5f5f7"; // titoli
const INK_SOFT = "#a3a3b8"; // corpo
const BG = "#0b0b0f"; // sfondo pagina (app scura)
const CARD = "#15151d"; // card
const LINE = "#2a2a37"; // bordi/divisori
const FOOTER_INK = "#6f6f82"; // footer

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function clampDay(d: number): 1 | 2 | 3 {
  if (!Number.isFinite(d) || d <= 1) return 1;
  if (d >= 3) return 3;
  return 2;
}

/** Chiave giorno per le copy tradotte (`email.*.<dayKey>`). */
function dayCopyKey(day: 1 | 2 | 3, planReady: boolean): "planReady" | "day1" | "day2" | "day3" {
  if (planReady) return "planReady";
  return day === 1 ? "day1" : day === 2 ? "day2" : "day3";
}

/** Testo item (label/unlocks) tradotto per chiave; fallback al valore IT dello spec. */
function itemText(
  t: OnboardingEmailTranslator,
  key: string,
  kind: "label" | "unlocks",
  fallback: string,
): string {
  const full = `items.${key}.${kind}`;
  return t.has(full) ? t(full) : fallback;
}

function progressBar(pct: number): string {
  const filled = Math.max(0, Math.min(100, Math.round(pct)));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${LINE};border-radius:999px;">
    <tr><td style="height:10px;line-height:10px;font-size:0;padding:0;">
      <table role="presentation" width="${filled}%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr><td style="height:10px;line-height:10px;font-size:0;background:${ACCENT};background:${GRAD};border-radius:999px;">&nbsp;</td></tr>
      </table>
    </td></tr></table>`;
}

function missingList(t: OnboardingEmailTranslator, items: OnboardingCompleteness["required"]["missing"]): string {
  if (items.length === 0) return "";
  const rows = items
    .map((it) => {
      const label = itemText(t, it.key, "label", it.label);
      const unlocks = itemText(t, it.key, "unlocks", it.unlocks);
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${LINE};">
          <div style="font-size:15px;font-weight:600;color:${INK};">${esc(label)}</div>
          <div style="font-size:13px;color:${INK_SOFT};margin-top:2px;">${esc(unlocks)}</div>
        </td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 4px;">${rows}</table>`;
}

export function buildOnboardingEmail(input: OnboardingEmailInput): OnboardingEmail {
  const day = clampDay(input.dayIndex);
  const { completeness, t } = input;
  const nameOnly = input.firstName?.trim() ?? "";
  const greet = nameOnly ? t("greetingNamed", { name: nameOnly }) : t("greeting");
  const nameSuffix = nameOnly ? `, ${nameOnly}` : "";
  const nameSuffixHtml = nameOnly ? `, ${esc(nameOnly)}` : "";
  const missing = completeness.required.missing;
  const dayKey = dayCopyKey(day, completeness.planReady);
  const headline = t(`email.headline.${dayKey}`);
  const intro = t(`email.intro.${dayKey}`);
  const subject = t(`email.subject.${dayKey}`, { greet, count: missing.length });
  const ctaLabel = completeness.planReady ? t("email.ctaGoToArea") : t("email.ctaComplete");
  const ctaUrl = `${input.appUrl.replace(/\/+$/, "")}/onboarding`;
  const logoUrl = `${input.appUrl.replace(/\/+$/, "")}/brand/empathy-wordmark-white.png`;
  const recRemaining = completeness.recommended.total - completeness.recommended.done;

  const preheader = completeness.planReady
    ? t("email.preheaderReady")
    : t("email.preheaderProgress", { done: completeness.required.done, total: completeness.required.total });

  const htmlBody = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${BG};">
<tr><td align="center" style="padding:28px 16px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:560px;width:100%;">
    <tr><td align="center" style="padding:0 4px 22px;">
      <img src="${esc(logoUrl)}" width="150" height="39" alt="Empathy" style="display:block;width:150px;height:auto;max-width:55%;border:0;outline:none;text-decoration:none;margin:0 auto;">
    </td></tr>
    <tr><td style="background:${CARD};border:1px solid ${LINE};border-radius:16px;padding:32px 28px;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:${ACCENT_SOFT};font-weight:bold;">${esc(t("eyebrow"))}</div>
      <h1 style="margin:10px 0 0;font-size:24px;line-height:1.2;color:${INK};">${esc(headline)}${nameSuffixHtml}.</h1>
      <p style="margin:14px 0 22px;font-size:15px;line-height:1.6;color:${INK_SOFT};">${esc(intro)}</p>

      <div style="font-size:13px;color:${INK_SOFT};margin-bottom:6px;">
        <strong style="color:${INK};">${completeness.required.done}/${completeness.required.total}</strong> ${esc(t("email.progressCaption", { pct: completeness.progressPct }))}
      </div>
      ${progressBar(completeness.progressPct)}

      ${
        completeness.planReady
          ? ""
          : `<div style="margin-top:22px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:${INK};font-weight:bold;">${esc(t("email.whatsMissing"))}</div>${missingList(t, missing)}`
      }

      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:26px 0 6px;">
        <tr><td style="border-radius:12px;background:${ACCENT};background:${GRAD};">
          <a href="${esc(ctaUrl)}" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0b0b0f;text-decoration:none;border-radius:12px;">
            ${esc(ctaLabel)}
          </a>
        </td></tr>
      </table>

      ${
        !completeness.planReady && recRemaining > 0
          ? `<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:${INK_SOFT};">${esc(t("email.recommendedExtra", { count: recRemaining }))}</p>`
          : ""
      }
    </td></tr>
    <tr><td align="center" style="padding:18px 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${FOOTER_INK};">
      ${esc(t("email.footer"))}
    </td></tr>
  </table>
</td></tr></table></body></html>`;

  const textLines = [
    `${headline}${nameSuffix}.`,
    "",
    intro,
    "",
    `${completeness.required.done}/${completeness.required.total} ${t("email.progressCaption", { pct: completeness.progressPct })}`,
  ];
  if (!completeness.planReady && missing.length > 0) {
    textLines.push("", `${t("email.whatsMissing")}:`);
    for (const it of missing) {
      const label = itemText(t, it.key, "label", it.label);
      const unlocks = itemText(t, it.key, "unlocks", it.unlocks);
      textLines.push(`- ${label}: ${unlocks}`);
    }
  }
  textLines.push("", `${ctaLabel}: ${ctaUrl}`);
  const textBody = textLines.join("\n");

  return { subject, htmlBody, textBody, tag: `onboarding-d${day}` };
}
