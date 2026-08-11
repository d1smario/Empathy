import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadEntitledAthleteIds } from "@/lib/onboarding/onboarding-window";
import { recordEmpathyEvent } from "@/lib/observability/empathy-event-trace";
import { runWeeklyReplan } from "@/lib/nutrition/weekly-replan-run";
import {
  chunkForFanOut,
  isPlausibleOverrideDate,
  nextMondayUTC,
  OVERRIDE_DATE_WINDOW_DAYS,
  selectWeeklyReplanTargets,
  summarizeWeeklyReplanFanOut,
  type WeeklyReplanFanOutItem,
} from "@/lib/nutrition/weekly-replan-dispatch";
import { ensureTrainingContinuity } from "@/lib/training/ensure-training-continuity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * Budget esplicito, per non dipendere da un default che sta fuori dal repo (il valore di
 * progetto è modificabile dalla dashboard Vercel: Settings → Functions → Default Max
 * Duration). Serve a entrambe le facce:
 * - worker (un atleta, 7 giorni): misurato ~10-11 s end-to-end da rete pubblica
 *   (correction ~3,2 s + compose 4,6-5,7 s + persist ~2,3-2,9 s) → ~5× di margine;
 * - dispatcher: attende il ventaglio, cioè il worker più lento, non la somma.
 *
 * 60 non può far fallire il build: la tabella dei limiti su
 * vercel.com/docs/functions/configuring-functions/duration (con fluid compute, attivo di
 * default) dà 300 s di massimo su TUTTI i piani, Hobby compreso. Nota per chi legge il
 * commento gemello in `/api/cron/daily` («evita il rischio di superare il cap Hobby»):
 * quel timore si riferiva ai vecchi 10 s/60 s ed è superato dalla tabella di oggi.
 */
export const maxDuration = 60;

/**
 * Quante invocazioni figlie si avviano nello stesso tick. Tutte le fetch di un gruppo
 * partono insieme, quindi ogni atleta del gruppo ha la sua invocazione serverless già
 * avviata (e col proprio budget) anche se il dispatcher muore subito dopo. Gruppi oltre
 * il primo sono una valvola di carico: oggi la platea è ~12 atleti → un gruppo solo.
 */
const FAN_OUT_PARALLEL = 24;
/**
 * Quanto il dispatcher aspetta la risposta di un figlio: 40 s stanno dentro i 60 s del
 * dispatcher lasciando spazio per riepilogo e traccia.
 *
 * ASSUNZIONE NON MISURATA (vale anche per il ventaglio di `/api/cron/daily`, che si regge
 * sulla stessa): che l'invocazione figlia continui a lavorare anche se il chiamante
 * abbandona la connessione. Non è verificata su questo progetto. Per questo il ventaglio
 * non ci si appoggia per dire com'è andata: un figlio che non risponde finisce in
 * `unknown`, non fra i successi, e la verità sta nella riga su `empathy_events` che il
 * figlio scrive per conto suo.
 */
const CHILD_WAIT_MS = 40_000;

const EVENT_RUN = "nutrition.weekly_replan.run";
const EVENT_ATHLETE = "nutrition.weekly_replan.athlete";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return !!secret && (req.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}
function isoDateUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Cron settimanale (schedulata MARTEDÌ): ripianifica la settimana PROSSIMA della nutrizione
 * per gli atleti con piano attivo + diritto d'uso, imparando dagli ultimi 7 giorni (Decisione B).
 * Non tocca mai la settimana in corso. Dry-run di default: `?run=true` genera.
 *
 * DUE FACCE, stesso schema del dispatcher `/api/cron/daily` un livello più sotto:
 * - SENZA `athleteId` → **dispatcher**: sceglie i bersagli e fa UNA fetch per atleta. Ogni
 *   fetch scatena una invocazione serverless separata, con budget di timeout indipendente.
 * - CON `athleteId` → **worker**: fa il lavoro vero per quel solo atleta (7 giorni + continuità
 *   training) e lascia una traccia durevole su `empathy_events`.
 *
 * Prima era tutto in UNA invocazione: 12 atleti × 7 giorni = 84 generazioni sequenziali
 * (~2 minuti misurati) — veniva uccisa molto prima di finire e non scriveva nulla.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }
  const url = new URL(req.url);
  const sp = url.searchParams;
  const run = sp.get("run") === "true";
  const onlyAthlete = sp.get("athleteId")?.trim() || null; // override ops / bersaglio del worker
  const weekStartOverride = sp.get("weekStart")?.trim() || null;
  const referenceOverride = sp.get("referenceDate")?.trim() || null;
  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, error: "Service role non configurato" }, { status: 500 });
  }

  const now = new Date();
  const todayIso = isoDateUTC(now);
  // Un override malformato NON viene più ignorato in silenzio (prima ricadeva sul default,
  // e chi l'aveva digitato credeva d'aver ripianificato un'altra settimana): si risponde 400.
  // Il controllo di plausibilità sta qui perché `referenceDate` non è solo lettura — arriva
  // fino a `ensureTrainingContinuity`, che scrive pianificazione.
  for (const [name, raw] of [
    ["weekStart", weekStartOverride],
    ["referenceDate", referenceOverride],
  ] as const) {
    if (raw !== null && !isPlausibleOverrideDate(raw, todayIso)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Parametro ${name} non plausibile: attesa una data YYYY-MM-DD entro ±${OVERRIDE_DATE_WINDOW_DAYS} giorni da ${todayIso}`,
        },
        { status: 400 },
      );
    }
  }
  // Le date si calcolano UNA volta e viaggiano ai figli come parametri: se le ricalcolasse
  // ogni worker, un ventaglio a cavallo della mezzanotte UTC potrebbe spaccarsi su due settimane.
  const referenceDate = referenceOverride ?? todayIso;
  const weekStart = weekStartOverride ?? nextMondayUTC(now);

  if (onlyAthlete) {
    return runWorker(db, { athleteId: onlyAthlete, weekStart, referenceDate, run });
  }

  // Atleti con piano nutrizione attivo di recente. Platea invariata: piano negli ultimi
  // 21 giorni, poi filtro diritto d'uso.
  const sinceIso = isoDateUTC(new Date(now.getTime() - 21 * 86_400_000));
  const { data: planRows, error } = await db.from("nutrition_plan").select("athlete_id").gte("plan_date", sinceIso);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const candidateIds = [
    ...new Set(((planRows ?? []) as Array<Record<string, unknown>>).map((r) => String(r.athlete_id ?? "")).filter(Boolean)),
  ];
  const entitled = await loadEntitledAthleteIds(db, candidateIds);
  const targets = selectWeeklyReplanTargets(candidateIds, entitled);

  if (!run) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      mode: "dispatch",
      summary: { weekStart, referenceDate, candidates: candidateIds.length, entitled: targets.length, willDispatch: targets.length },
      preview: targets.slice(0, 50),
    });
  }

  const startedAt = Date.now();
  const items: WeeklyReplanFanOutItem[] = [];
  for (const group of chunkForFanOut(targets, FAN_OUT_PARALLEL)) {
    const settled = await Promise.all(
      // `nextUrl.origin` è l'origin che usa già il dispatcher `/api/cron/daily`.
      group.map((athleteId) => dispatchOne(req.nextUrl.origin, athleteId, { weekStart, referenceDate })),
    );
    items.push(...settled);
  }

  const summary = summarizeWeeklyReplanFanOut(items);
  const durationMs = Date.now() - startedAt;
  // Traccia DURATURA del run: i log runtime di Vercel scadono in ~1 ora, questa riga no.
  const traced = await recordEmpathyEvent(db, {
    eventType: EVENT_RUN,
    payload: { weekStart, referenceDate, candidates: candidateIds.length, entitled: targets.length, durationMs, ...summary },
  });

  return NextResponse.json({
    ok: summary.athletesFailed === 0,
    dryRun: false,
    mode: "dispatch",
    // `traced` va detto: se è false, cercare la riga su empathy_events e non trovarla NON
    // significa che il cron non è partito.
    summary: { weekStart, referenceDate, candidates: candidateIds.length, entitled: targets.length, durationMs, traced, ...summary },
    results: items,
  });
}

/** UNA fetch = UNA invocazione serverless per l'atleta, con budget di timeout tutto suo. */
async function dispatchOne(
  origin: string,
  athleteId: string,
  dates: { weekStart: string; referenceDate: string },
): Promise<WeeklyReplanFanOutItem> {
  const qs = new URLSearchParams({
    run: "true",
    athleteId,
    weekStart: dates.weekStart,
    referenceDate: dates.referenceDate,
  });
  try {
    const res = await fetch(`${origin}/api/nutrition/weekly-replan/cron?${qs.toString()}`, {
      method: "GET",
      headers: { authorization: `Bearer ${(process.env.CRON_SECRET ?? "").trim()}` },
      cache: "no-store",
      signal: AbortSignal.timeout(CHILD_WAIT_MS),
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const detail = (body?.athlete ?? null) as Record<string, unknown> | null;
    return {
      athleteId,
      ok: res.ok && body?.ok === true,
      days: typeof detail?.daysOk === "number" ? detail.daysOk : null,
      daysTotal: typeof detail?.daysTotal === "number" ? detail.daysTotal : null,
      status: res.status,
      error: res.ok && body?.ok === true ? undefined : String(body?.error ?? `HTTP ${res.status}`),
    };
  } catch (e) {
    // Timeout o rete: da qui NON si sa se il figlio abbia lavorato (vedi CHILD_WAIT_MS).
    // `days: null` lo manda in `unknown`, che è appunto «non lo sappiamo», non «zero».
    return { athleteId, ok: false, days: null, daysTotal: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Il lavoro vero, per UN atleta: 7 giorni di nutrizione + continuità training. */
async function runWorker(
  db: SupabaseClient,
  args: { athleteId: string; weekStart: string; referenceDate: string; run: boolean },
): Promise<NextResponse> {
  const { athleteId, weekStart, referenceDate, run } = args;
  // Anche il singolo atleta passa dal filtro diritto d'uso: l'override è per ops, non per
  // allargare la platea.
  const entitled = await loadEntitledAthleteIds(db, [athleteId]);
  if (!entitled.has(athleteId)) {
    return NextResponse.json({
      ok: false,
      mode: "worker",
      error: "Atleta senza diritto d'uso",
      athlete: { athleteId, weekStart, daysOk: 0, daysTotal: 0 },
    });
  }
  if (!run) {
    return NextResponse.json({ ok: true, dryRun: true, mode: "worker", athlete: { athleteId, weekStart, referenceDate } });
  }

  const startedAt = Date.now();
  let payload: Record<string, unknown>;
  try {
    const r = await runWeeklyReplan(db, athleteId, weekStart, referenceDate);
    // Continuità training: estende il macro se la pista futura è corta (non far seccare il piano).
    const tc = await ensureTrainingContinuity(db, athleteId, { todayIso: referenceDate });
    payload = {
      athleteId,
      weekStart,
      referenceDate,
      ok: r.ok,
      daysOk: r.days.filter((d) => d.ok).length,
      daysTotal: r.days.length,
      factor: r.correction.factor,
      daysUsed: r.correction.daysUsed,
      dayErrors: r.days.filter((d) => !d.ok).map((d) => ({ day: d.day, error: d.error ?? "errore sconosciuto" })),
      trainingExtended: tc.ok && "extended" in tc ? tc.extended : false,
      trainingError: tc.ok ? null : tc.error,
    };
  } catch (e) {
    payload = {
      athleteId,
      weekStart,
      referenceDate,
      ok: false,
      daysOk: 0,
      daysTotal: 7,
      error: e instanceof Error ? e.message : String(e),
    };
  }
  payload.durationMs = Date.now() - startedAt;

  // L'atleta sta DENTRO il payload, non nella colonna `athlete_id`: qui ci sono messaggi
  // d'errore grezzi di motore e DB, e la RLS di `empathy_events` aprirebbe in lettura
  // all'atleta (e al suo coach) proprio le righe con quella colonna valorizzata.
  const traced = await recordEmpathyEvent(db, { eventType: EVENT_ATHLETE, payload });
  // `error` in cima: è quello che il dispatcher legge per il riepilogo del ventaglio.
  const dayErrors = Array.isArray(payload.dayErrors) ? (payload.dayErrors as Array<{ error: string }>) : [];
  const topError =
    payload.ok === true
      ? undefined
      : typeof payload.error === "string"
        ? payload.error
        : dayErrors.map((d) => d.error).slice(0, 3).join(" | ") || "giorni non scritti";
  return NextResponse.json({
    ok: payload.ok === true,
    dryRun: false,
    mode: "worker",
    error: topError,
    athlete: { ...payload, traced },
  });
}
