/**
 * Invio email transazionale via Postmark — DETERMINISTICO, nessuna AI.
 *
 * Legge la configurazione da env (`POSTMARK_SERVER_TOKEN`, `ONBOARDING_EMAIL_FROM`).
 * Se manca, NON lancia: restituisce `{ skipped }` così i cron/preview girano in dev
 * senza inviare nulla finché il mittente Postmark non è configurato in produzione.
 */

const POSTMARK_URL = "https://api.postmarkapp.com/email";

export type PostmarkSendInput = {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  /** Tag Postmark per raggruppare (es. "onboarding-d1"). */
  tag?: string;
  /** Stream Postmark; per le transazionali di norma "outbound". */
  messageStream?: string;
};

export type PostmarkSendResult =
  | { ok: true; messageId: string }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped?: false; error: string };

export function isPostmarkConfigured(): boolean {
  return Boolean(process.env.POSTMARK_SERVER_TOKEN?.trim() && process.env.ONBOARDING_EMAIL_FROM?.trim());
}

export async function sendTransactionalEmail(input: PostmarkSendInput): Promise<PostmarkSendResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
  const from = process.env.ONBOARDING_EMAIL_FROM?.trim();
  if (!token || !from) {
    return { ok: false, skipped: true, reason: "POSTMARK_SERVER_TOKEN / ONBOARDING_EMAIL_FROM non configurati" };
  }
  try {
    const res = await fetch(POSTMARK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Postmark-Server-Token": token,
      },
      body: JSON.stringify({
        From: from,
        To: input.to,
        Subject: input.subject,
        HtmlBody: input.htmlBody,
        TextBody: input.textBody,
        MessageStream: input.messageStream ?? "outbound",
        ...(input.tag ? { Tag: input.tag } : {}),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { MessageID?: string; Message?: string };
    if (!res.ok) {
      return { ok: false, error: `Postmark ${res.status}: ${json?.Message ?? "errore sconosciuto"}` };
    }
    return { ok: true, messageId: String(json?.MessageID ?? "") };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "errore di rete" };
  }
}
