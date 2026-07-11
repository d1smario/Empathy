/**
 * Contenuto della mail giornaliera di onboarding — DETERMINISTICO, nessuna AI.
 * Riusa il motore di completezza (M1.1): stessa verità della «sala d'attesa».
 * HTML compatibile con i client email (tabelle + stili inline).
 */
import type { OnboardingCompleteness } from "./onboarding-completeness";

export type OnboardingEmailInput = {
  firstName: string | null;
  /** Giorno della finestra (1..3); valori >3 trattati come 3. */
  dayIndex: number;
  completeness: OnboardingCompleteness;
  /** Base URL dell'app; la CTA punta a `${appUrl}/onboarding`. */
  appUrl: string;
};

export type OnboardingEmail = { subject: string; htmlBody: string; textBody: string; tag: string };

const ACCENT = "#0d8676";
const INK = "#14201f";
const INK_SOFT = "#5a6a67";
const BG = "#eef2f1";
const CARD = "#ffffff";
const LINE = "#e2e8e6";

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

type Copy = { headline: string; intro: string; subject: string };

function copyFor(day: 1 | 2 | 3, planReady: boolean, greet: string, missingCount: number): Copy {
  if (planReady) {
    return {
      headline: "Tutto pronto",
      intro:
        "Hai completato i dati essenziali. Il tuo piano di allenamento e alimentare sta per essere generato sui tuoi numeri reali — a breve lo trovi nella tua area.",
      subject: `${greet}, il tuo piano è in arrivo`,
    };
  }
  if (day === 1) {
    return {
      headline: "Benvenuto in Empathy",
      intro:
        "Nei prossimi giorni raccogliamo i tuoi numeri reali: appena ci sono, generiamo il tuo piano di allenamento e alimentare su misura — non un modello medio, il tuo. Ecco cosa serve.",
      subject: `${greet}, prepariamo il tuo piano`,
    };
  }
  if (day === 2) {
    return {
      headline: "Ci siamo quasi",
      intro: "Ancora pochi dati e il tuo piano è pronto a partire. Ecco cosa manca.",
      subject: `${greet}, ci siamo quasi — ${missingCount === 1 ? "manca 1 dato" : `mancano ${missingCount} dati`}`,
    };
  }
  return {
    headline: "Ultimo passo",
    intro: "Oggi è il giorno: completa i dati essenziali e il tuo piano parte domani.",
    subject: `${greet}, ultimo passo per sbloccare il piano`,
  };
}

function progressBar(pct: number): string {
  const filled = Math.max(0, Math.min(100, Math.round(pct)));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${LINE};border-radius:999px;">
    <tr><td style="height:10px;line-height:10px;font-size:0;padding:0;">
      <table role="presentation" width="${filled}%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr><td style="height:10px;line-height:10px;font-size:0;background:${ACCENT};border-radius:999px;">&nbsp;</td></tr>
      </table>
    </td></tr></table>`;
}

function missingList(items: OnboardingCompleteness["required"]["missing"]): string {
  if (items.length === 0) return "";
  const rows = items
    .map(
      (it) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${LINE};">
          <div style="font-size:15px;font-weight:600;color:${INK};">${esc(it.label)}</div>
          <div style="font-size:13px;color:${INK_SOFT};margin-top:2px;">${esc(it.unlocks)}</div>
        </td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 4px;">${rows}</table>`;
}

export function buildOnboardingEmail(input: OnboardingEmailInput): OnboardingEmail {
  const day = clampDay(input.dayIndex);
  const { completeness } = input;
  const greet = input.firstName ? `Ciao ${input.firstName.trim()}` : "Ciao";
  const nameOnly = input.firstName?.trim() ?? "";
  const nameSuffix = nameOnly ? `, ${nameOnly}` : "";
  const nameSuffixHtml = nameOnly ? `, ${esc(nameOnly)}` : "";
  const missing = completeness.required.missing;
  const copy = copyFor(day, completeness.planReady, greet, missing.length);
  const ctaUrl = `${input.appUrl.replace(/\/+$/, "")}/onboarding`;
  const recRemaining = completeness.recommended.total - completeness.recommended.done;

  const preheader = completeness.planReady
    ? "Il tuo piano sta per essere generato."
    : `${completeness.required.done}/${completeness.required.total} dati essenziali completati.`;

  const htmlBody = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(copy.subject)}</title></head>
<body style="margin:0;padding:0;background:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${BG};">
<tr><td align="center" style="padding:28px 16px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:560px;width:100%;">
    <tr><td style="padding:0 4px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:3px;font-weight:bold;color:${ACCENT};">EMPATHY</td></tr>
    <tr><td style="background:${CARD};border:1px solid ${LINE};border-radius:16px;padding:32px 28px;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:${ACCENT};font-weight:bold;">Prepariamo il tuo piano</div>
      <h1 style="margin:10px 0 0;font-size:24px;line-height:1.2;color:${INK};">${esc(copy.headline)}${nameSuffixHtml}.</h1>
      <p style="margin:14px 0 22px;font-size:15px;line-height:1.6;color:${INK_SOFT};">${esc(copy.intro)}</p>

      <div style="font-size:13px;color:${INK_SOFT};margin-bottom:6px;">
        <strong style="color:${INK};">${completeness.required.done}/${completeness.required.total}</strong> dati essenziali · ${completeness.progressPct}%
      </div>
      ${progressBar(completeness.progressPct)}

      ${
        completeness.planReady
          ? ""
          : `<div style="margin-top:22px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:${INK};font-weight:bold;">Cosa manca</div>${missingList(missing)}`
      }

      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:26px 0 6px;">
        <tr><td style="border-radius:10px;background:${ACCENT};">
          <a href="${esc(ctaUrl)}" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">
            ${completeness.planReady ? "Vai alla tua area" : "Completa i dati"}
          </a>
        </td></tr>
      </table>

      ${
        !completeness.planReady && recRemaining > 0
          ? `<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:${INK_SOFT};">Extra facoltativi (${recRemaining}) rendono il piano più preciso: li trovi nella stessa schermata.</p>`
          : ""
      }
    </td></tr>
    <tr><td style="padding:18px 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#9aa8a5;">
      Ricevi questa mail perché stai preparando il tuo piano su Empathy.
    </td></tr>
  </table>
</td></tr></table></body></html>`;

  const textLines = [
    `${copy.headline}${nameSuffix}.`,
    "",
    copy.intro,
    "",
    `${completeness.required.done}/${completeness.required.total} dati essenziali (${completeness.progressPct}%).`,
  ];
  if (!completeness.planReady && missing.length > 0) {
    textLines.push("", "Cosa manca:");
    for (const it of missing) textLines.push(`- ${it.label}: ${it.unlocks}`);
  }
  textLines.push("", `${completeness.planReady ? "Vai alla tua area" : "Completa i dati"}: ${ctaUrl}`);
  const textBody = textLines.join("\n");

  return { subject: copy.subject, htmlBody, textBody, tag: `onboarding-d${day}` };
}
