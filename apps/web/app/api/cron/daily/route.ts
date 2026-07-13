import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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
  const origin = req.nextUrl.origin;
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

  return NextResponse.json({
    ok: results.every((r) => r.ok),
    ranAt: new Date().toISOString(),
    isTuesday,
    results,
  });
}
