import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { flagMissingSleepForDate } from "@/lib/alerts/athlete-alerts-writers";
import { cronSelfCallOrigin } from "@/lib/cron-self-call-origin";
import { recordEmpathyEvent } from "@/lib/observability/empathy-event-trace";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Nessun maxDuration esplicito: si usa il default del piano (evita il rischio che una
// dichiarazione oltre il cap Hobby faccia fallire il build). I job partono comunque in
// invocazioni serverless separate e proseguono anche se il dispatcher chiude prima.

/**
 * Dispatcher cron UNICO — vincolo piano Vercel **Hobby** (numero di cron limitato,
 * frequenza max ~1 volta/giorno). Invece di 5 cron separati (che Hobby rifiuta),
 * un solo cron giornaliero (05:00 UTC) orchestra tutti i job del giorno.
 *
 * Auth: Vercel invoca GET con `Authorization: Bearer <CRON_SECRET>`. Lo **stesso**
 * bearer viene inoltrato ai sotto-cron (garmin/whoop/onboarding/nutrition usano tutti
 * la medesima verifica `Bearer CRON_SECRET`). CRON_SECRET è già impostato su Vercel
 * (i pull device girano già in produzione con questo schema).
 *
 * Esecuzione: i job partono in **parallelo** via `fetch` sulla stessa origin. Ogni
 * fetch scatena una invocazione serverless separata per quel route → ciascun job ha
 * il proprio budget di timeout; il dispatcher attende il più lento (non la somma).
 *
 * Il martedì (UTC) aggiunge la ripianificazione settimanale della nutrizione.
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return (req.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}

type JobResult = { job: string; ok: boolean; status?: number; error?: string };

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const secret = (process.env.CRON_SECRET ?? "").trim();
  // MAI `req.nextUrl.origin`: Vercel invoca il cron sull'URL del deployment, che con la
  // protezione SSO attiva (all_except_custom_domains) risponde 302 verso il login. Le
  // fetch figlie non raggiungevano l'applicazione e OGNI job moriva prima di iniziare —
  // due settimane di notti a vuoto senza un errore visibile. Vedi cron-self-call-origin.ts.
  const origin = cronSelfCallOrigin();
  const isTuesday = new Date().getUTCDay() === 2; // 0=dom … 2=mar

  const jobs: { name: string; path: string }[] = [
    { name: "garmin-pull", path: "/api/integrations/garmin/pull/cron" },
    { name: "whoop-pull", path: "/api/integrations/whoop/pull/cron" },
    { name: "onboarding-email", path: "/api/onboarding/email/cron?send=true" },
    { name: "onboarding-plan", path: "/api/onboarding/plan/cron?run=true" },
  ];
  if (isTuesday) {
    jobs.push({ name: "weekly-replan", path: "/api/nutrition/weekly-replan/cron?run=true" });
  }

  const results: JobResult[] = await Promise.all(
    jobs.map(async (j): Promise<JobResult> => {
      try {
        const res = await fetch(`${origin}${j.path}`, {
          method: "GET",
          headers: { authorization: `Bearer ${secret}` },
          cache: "no-store",
        });
        return { job: j.name, ok: res.ok, status: res.status };
      } catch (e) {
        return { job: j.name, ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  // Fallback alert «sonno mancante» per IERI (UTC) — dopo i pull device (le fetch sopra
  // attendono la risposta dei sotto-cron, quindi i pull sono già passati). Best-effort:
  // qualunque errore qui non tocca l'esito dei job.
  let sleepMissing: { checked: number; flagged: number } | null = null;
  try {
    const db = createSupabaseAdminClient();
    if (db) {
      const y = new Date(Date.now() - 86_400_000);
      const yesterday = `${y.getUTCFullYear()}-${String(y.getUTCMonth() + 1).padStart(2, "0")}-${String(y.getUTCDate()).padStart(2, "0")}`;
      sleepMissing = await flagMissingSleepForDate(db, yesterday);
    }
  } catch {
    /* best-effort */
  }

  // TRACCIA DURATURA DELL'ESITO. Finora l'unica prova che il cron avesse lavorato erano
  // gli alert «sonno mancante», che stanno DOPO i job e giravano anche quando i job non
  // partivano: dall'esterno sembrava tutto a posto mentre da due settimane non veniva
  // generato più nulla. I log runtime di Vercel scadono in circa un'ora, questa riga no.
  // Best-effort come il blocco sopra: un errore qui non cambia l'esito del cron.
  const okAll = results.every((r) => r.ok);
  try {
    const db = createSupabaseAdminClient();
    if (db) {
      await recordEmpathyEvent(db, {
        eventType: "cron.daily.run",
        payload: {
          origin,
          isTuesday,
          ok: okAll,
          jobs: results.map((r) => ({ job: r.job, ok: r.ok, status: r.status ?? null, error: r.error ?? null })),
          sleepMissing,
        },
      });
    }
  } catch {
    /* best-effort */
  }

  return NextResponse.json({
    ok: okAll,
    ranAt: new Date().toISOString(),
    isTuesday,
    origin,
    results,
    sleepMissing,
  });
}
