import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import "./env-shim.ts"; // deve precedere l'import del bundle (mappa process.env → Deno.env)
import { createClient } from "npm:@supabase/supabase-js@2";
import { materializeTrainingMacro, canAccessAthleteData } from "./training-l2-engine.mjs";

// VIRYA rework F3 — materializzatore L2 come Edge Function Supabase.
//
// STESSA FUNZIONE, DUE RUNTIME: `materializeTrainingMacro` nel bundle è la
// IDENTICA funzione che il server Next chiama in-process (approve route, cron
// continuità) — vedi _build.sh. La EF non implementa niente del motore: è il
// CONTENITORE per F4 (cron sganciato dal deploy web) e per invocazioni dirette
// in QA. Dentro la funzione vivono già: gate `status ∈ {approved, active}`
// (un draft non materializza MAI, nemmeno invocando la EF a mano), purge SEMPRE
// prima dell'insert per plan_id+range [F11], skip dei giorni con seduta Builder
// del coach, commutatore motore F3 (default 'db'; 'builder' solo via secret
// TRAINING_L2_ENGINE / TRAINING_L2_BUILDER_ATHLETES — vedi env-shim.ts).
//
// Auth (verify_jwt=false al deploy, validazione QUI dentro come generate-meal-plan):
// SOLO service-role key (cron F4) oppure JWT di un utente che passa
// `canAccessAthleteData` per l'atleta del piano (coach in scope / platform admin
// / atleta proprio) — lo stesso gate unico del meal-plan.
//
// Il bundle training-l2-engine.mjs si rigenera con ./_build.sh.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

/** Codici sicuri emessi dal motore/orchestrazione (mai messaggi DB grezzi). */
const SAFE_ERROR_CODES = new Set([
  "plan_not_found",
  "plan_not_approved",
  "week_not_in_skeleton",
  "duplicate_day_slot",
  "contract_too_large",
  "aerobic_preset_not_found",
  "gym_catalog_empty",
]);

/**
 * I messaggi d'errore del motore possono trascinare dettagli interni (testo di
 * errori Postgres, nomi tabella). Fuori dalla EF escono SOLO codici: il codice
 * noto passa (anche col prefisso data `YYYY-MM-DD: codice` degli errori di slot),
 * tutto il resto collassa su un codice generico. Il dettaglio pieno va nei log
 * della funzione (console.error), dove lo legge chi ha accesso al progetto.
 */
function sanitizeErrorCode(raw: string): string {
  const dateMatch = /^(\d{4}-\d{2}-\d{2}): ([a-z0-9_]+)$/.exec(raw);
  if (dateMatch && SAFE_ERROR_CODES.has(dateMatch[2]!)) return raw;
  if (SAFE_ERROR_CODES.has(raw)) return raw;
  if (raw.startsWith("builder_engine_setup:")) return "builder_engine_setup_failed";
  if (raw.startsWith("workout_count:")) return "workout_count_update_failed";
  return "week_materialize_failed";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceKey || !anonKey) return json({ error: "env Supabase mancante" }, 500);

    const body = await req.json().catch(() => ({}));
    const planId = String(body?.planId ?? "").trim();
    if (!planId) return json({ error: "Missing planId" }, 400);
    const weekStartRaw = String(body?.weekStart ?? "").trim();
    if (weekStartRaw && !/^\d{4}-\d{2}-\d{2}$/.test(weekStartRaw)) {
      return json({ error: "Invalid weekStart" }, 400);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 0) Auth dentro la funzione (verify_jwt=false): o la service-role key
    //    (cron F4, server-to-server), o un JWT utente che passa il gate atleta.
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (bearer !== serviceKey) {
      const userClient = createClient(url, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userData } = await userClient.auth.getUser();
      const user = userData?.user ?? null;
      if (!user) return json({ error: "Non autenticato" }, 401);

      // L'atleta si legge dal PIANO (il chiamante non lo dichiara: non ci si
      // fida di un athleteId nel body per un check di accesso).
      const { data: planRow, error: planErr } = await admin
        .from("training_plan")
        .select("athlete_id")
        .eq("id", planId)
        .maybeSingle();
      if (planErr) {
        console.error("materialize-training-week: lettura piano fallita", planErr.message);
        return json({ error: "plan_lookup_failed" }, 500);
      }
      if (!planRow) return json({ error: "plan_not_found" }, 404);

      const allowed = await canAccessAthleteData(
        admin,
        user.id,
        String((planRow as { athlete_id: string }).athlete_id),
        null,
      );
      if (!allowed) return json({ error: "Accesso atleta negato" }, 403);

      // Cintura ruolo (stessa della approve route): canAccessAthleteData passa anche
      // per «atleta proprietario», ma la materializzazione purga e riscrive le righe
      // L2 — un atleta potrebbe spazzare le rifiniture del coach. Solo coach in
      // scope o platform admin (il service-role è già uscito prima).
      const { data: callerRow } = await admin
        .from("app_user_profiles")
        .select("role, is_platform_admin")
        .eq("user_id", user.id)
        .maybeSingle();
      const caller = callerRow as { role?: string | null; is_platform_admin?: boolean | null } | null;
      if (caller?.role !== "coach" && caller?.is_platform_admin !== true) {
        return json({ error: "forbidden" }, 403);
      }
    }

    // 1) Materializza: settimana esplicita se richiesta, altrimenti la pista
    //    minima «runway» (stesso default del cron di continuità in-process).
    const result = await materializeTrainingMacro(admin, {
      planId,
      weeks: weekStartRaw
        ? { mode: "explicit", weekStarts: [weekStartRaw] }
        : { mode: "runway" },
    });

    if (!result.ok) {
      // plan_not_found / plan_not_approved sono contratto; il resto è interno.
      console.error("materialize-training-week: run fallito", result.error);
      const code = SAFE_ERROR_CODES.has(result.error) ? result.error : "materialize_failed";
      const status = code === "plan_not_found" ? 404 : code === "plan_not_approved" ? 409 : 500;
      return json({ error: code }, status);
    }

    // 2) Risposta senza dettagli interni: i messaggi grezzi restano nei log.
    for (const e of result.errors) {
      console.error(`materialize-training-week: ${e.weekStart}: ${e.error}`);
    }
    return json({
      published: result.publishedCount,
      materialized: result.materialized,
      skipped: result.skipped,
      errors: result.errors.map((e) => ({
        weekStart: e.weekStart,
        error: sanitizeErrorCode(e.error),
      })),
    });
  } catch (e) {
    console.error("materialize-training-week: eccezione", e instanceof Error ? e.message : e);
    return json({ error: "internal_error" }, 500);
  }
});
