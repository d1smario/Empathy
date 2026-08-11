import type { SupabaseClient } from "@supabase/supabase-js";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { fdcIdForCanonicalKey } from "@/lib/nutrition/canonical-food-fdc-aliases";
import type { MealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";
import {
  candidateFdcIdsForFkCheck,
  clearUnknownFdcIds,
  mealItemFdcClearedTrace,
  type PendingMealItem,
} from "@/lib/nutrition/v2/meal-item-fdc-guard";
import { MEAL_SLOT_ASSEMBLY } from "@/lib/nutrition/v2/meal-slot-assembly-spec";

/**
 * Persiste il piano V2 (compositore deterministico) nelle tabelle canoniche
 * `nutrition_plan` → `meal` → `meal_item`, così che siano l'UNICA fonte di verità
 * letta sia dalla pagina Nutrizione sia dalla vista Oggi (loadTodayPersistedMeals).
 *
 * Il motore V2 è deterministico per (atleta, data) — seed dalla plan_date — quindi
 * ricomporre e ripersistere produce lo stesso piano: qui facciamo REPLACE (delete
 * a cascata + insert) per il giorno. Richiede il client service-role (RLS senza
 * policy utente su queste tabelle). Best-effort: l'errore non deve rompere la POST.
 *
 * INVARIANTE: un piano con dei cibi non può uscire da qui come `ok: true` con ZERO
 * `meal_item`. Quello è il difetto storico (Nutrizione piena da response_payload, Oggi
 * vuota) e i chiamanti si fidano dell'esito: se le voci non si scrivono, si risponde
 * errore. Un singolo alimento difettoso costa al massimo il suo `fdc_id`, mai la giornata.
 */
export type PersistV2PlanResult =
  | {
      ok: true;
      planId: string;
      /** Righe `meal_item` davvero scritte: >0 sempre, se c'erano voci da scrivere. */
      itemsWritten: number;
      /** Voci a cui è stato azzerato l'fdc_id (il cibo resta, il legame FDC no) — 0 nel caso normale. */
      fdcCleared: number;
      /** Voci perse davvero, cioè rifiutate anche senza fdc_id: 0 nel caso normale. */
      droppedItems: number;
    }
  | { ok: false; error: string };

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Riga di `meal_item` prima di conoscere il meal_id: i campi FK-rilevanti più il resto. */
type PendingMealItemRow = PendingMealItem & {
  foodRole: string;
  grams: number;
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
};

function mealItemInsertRow(row: PendingMealItemRow, mealId: string): Record<string, unknown> {
  return {
    meal_id: mealId,
    fdc_id: row.fdcId,
    label: row.label,
    canonical_key: row.canonicalKey,
    food_role: row.foodRole,
    grams: row.grams,
    kcal: row.kcal,
    carbs_g: row.carbsG,
    protein_g: row.proteinG,
    fat_g: row.fatG,
  };
}

/**
 * fdc_id realmente presenti nella tabella bersaglio della FK, con UNA sola query.
 * `null` = probe NON attendibile: in quel caso non si tocca niente a priori e resta la rete
 * per-riga sull'insert, così un problema di lettura non degrada alimenti buoni.
 *
 * Non attendibile significa due cose, non una:
 *  1. errore PostgREST (rete, permessi negati con errore);
 *  2. ZERO righe a fronte di id richiesti. `fdc_food` ha RLS attiva con la sola policy
 *     platform-admin: un client NON service-role legge zero righe SENZA errore, e prendere
 *     quel vuoto per buono vorrebbe dire «nessuno di questi alimenti esiste» → azzerare
 *     l'fdc_id di TUTTA la giornata. Oggi tutti i percorsi passano service-role, ma la
 *     rete deve reggere anche il diniego silenzioso, che è la forma in cui l'RLS si
 *     presenta. Se davvero nessun alimento esistesse, l'insert cade e la rete per-riga
 *     arriva allo stesso risultato: si perde un giro, non la giornata.
 */
async function loadFdcIdsPresentInFkTarget(
  admin: SupabaseClient,
  ids: number[],
): Promise<ReadonlySet<number> | null> {
  if (ids.length === 0) return new Set<number>();
  const { data, error } = await admin.from("fdc_food").select("fdc_id").in("fdc_id", ids);
  if (error) {
    console.warn("[nutrition v2 persist] guardia FK non disponibile", { error: error.message, ids: ids.length });
    return null;
  }
  const known = new Set<number>();
  for (const row of (data ?? []) as Array<{ fdc_id: unknown }>) {
    const n = Number(row.fdc_id);
    if (Number.isFinite(n)) known.add(n);
  }
  if (known.size === 0) {
    console.warn("[nutrition v2 persist] guardia FK: probe a zero righe, verdetto ignorato", { ids: ids.length });
    return null;
  }
  return known;
}

export async function persistV2PlanToDb(
  admin: SupabaseClient,
  athleteId: string,
  planDate: string,
  production: MealPlanV2Production,
  opts?: {
    hydrationMlTarget?: number | null;
    goal?: string | null;
    /**
     * Risposta V1-mappata COMPLETA (la stessa `result.body` che la pagina Nutrizione
     * renderizza: slots + solverBasis + nutrientRollup + mealRotationStaples…).
     * Persistita in `nutrition_plan.response_payload` per la pagina READ-FIRST
     * (decisione 8 ago): all'apertura si rilegge QUESTO payload dal DB, la
     * generazione è un evento. Va passata da TUTTI i percorsi di generazione
     * (Edge Function, route Next, headless/cron) — payload GIÀ mappato, una sola
     * scrittura insieme al piano (niente update a due tempi). Assente → NULL
     * (piani legacy): la pagina degrada a una generazione e si auto-ripara.
     */
    responsePayload?: unknown;
  },
): Promise<PersistV2PlanResult> {
  const slots = production.composedMealPlan.filter((s) => s.items.length > 0);
  if (slots.length === 0) return { ok: false, error: "Piano V2 senza pasti da persistere" };

  // Voci FEDELI: TUTTI gli item, non solo quelli con fdc_id. Un item con alias FDC va con
  // fdc_id (nome/immagine da fdc_food); un item CANONICO (staple senza alias) va con fdc_id
  // NULL + label + canonical_key → non viene scartato, così il DB contiene la lista-cibi
  // COMPLETA e Oggi mostra gli stessi cibi del Piano (stessa produzione V2).
  const pendingItems: PendingMealItemRow[] = [];
  for (const s of slots) {
    const roles = MEAL_SLOT_ASSEMBLY[s.slot as MealSlotKey] ?? [];
    s.items.forEach((it, i) => {
      const resolvedFdc = it.fdcId > 0 ? it.fdcId : it.canonicalKey ? fdcIdForCanonicalKey(it.canonicalKey) : null;
      pendingItems.push({
        slot: s.slot,
        fdcId: resolvedFdc && resolvedFdc > 0 ? resolvedFdc : null,
        label: it.description ?? null,
        canonicalKey: it.canonicalKey ?? null,
        foodRole: roles[i]?.foodRole ?? roles[roles.length - 1]?.foodRole ?? "cho_simple",
        grams: Math.round(num(it.grams)),
        kcal: Math.round(num(it.kcal)),
        carbsG: num(it.choG),
        proteinG: num(it.proG),
        fatG: num(it.fatG),
      });
    });
  }

  // Guardia FK PRIMA di scrivere (una query sola): gli alimenti del catalogo che vivono solo
  // in `nutrition_fdc_foods` (righe CIQUAL con fdc_id sintetico) non esistono in `fdc_food` e
  // la FK li rifiuta. Prima bastava uno di questi per far cadere l'insert dell'intera lista e
  // lasciare la giornata SENZA alimenti; ora cade solo lui. Il verdetto si calcola qui perché
  // entra nella provenienza dello STESSO insert del piano (niente update a due tempi).
  const candidateIds = candidateFdcIdsForFkCheck(pendingItems);
  const knownFdcIds = (await loadFdcIdsPresentInFkTarget(admin, candidateIds)) ?? new Set(candidateIds);
  const { rows: writableItems, cleared: clearedFdc } = clearUnknownFdcIds(pendingItems, knownFdcIds);
  const clearedTrace = mealItemFdcClearedTrace(clearedFdc);
  if (clearedTrace) {
    // Mai una perdita silenziosa: un piano che perde legami FDC senza dirlo sembra a posto.
    console.warn("[nutrition v2 persist] fdc_id azzerato dalla guardia FK", {
      athleteId,
      planDate,
      ...clearedTrace,
    });
  }

  // REPLACE per data: la cascata pulisce meal/meal_item collegati.
  const { error: delErr } = await admin
    .from("nutrition_plan")
    .delete()
    .eq("athlete_id", athleteId)
    .eq("plan_date", planDate);
  if (delErr) return { ok: false, error: `delete piano: ${delErr.message}` };

  const planTotals = slots.reduce(
    (acc, s) => {
      acc.kcal += num(s.totals.kcal);
      acc.cho += num(s.totals.choG);
      acc.pro += num(s.totals.proG);
      acc.fat += num(s.totals.fatG);
      return acc;
    },
    { kcal: 0, cho: 0, pro: 0, fat: 0 },
  );

  const planInsertBase = {
    athlete_id: athleteId,
    plan_date: planDate,
    algorithm_version: production.algorithmVersion,
    goal: opts?.goal ?? null,
    meal_count: slots.length,
    kcal_target: Math.round(planTotals.kcal),
    carbs_g_target: Math.round(planTotals.cho),
    protein_g_target: Math.round(planTotals.pro),
    fat_g_target: Math.round(planTotals.fat),
    hydration_ml_target: opts?.hydrationMlTarget ?? null,
    // Canale QA day-engine (shadow/on): report compatto vecchio-vs-nuovo interrogabile
    // con `select inputs_provenance->'day_engine' from nutrition_plan ...`.
    // ⚠️ La colonna prod è `jsonb NOT NULL DEFAULT '{}'`: MAI null qui (23502 → il
    // persist fallirebbe proprio con mode=off, il kill switch). Assente (mode off /
    // ramo day-engine caduto in catch) → `{}`, identico al default della colonna.
    // `meal_item_fdc_cleared` è l'altro canale (guardia FK): si AFFIANCA a day_engine, non lo
    // sostituisce, ed è assente quando non si è azzerato niente.
    inputs_provenance: {
      ...(production.dayEngine ? { day_engine: production.dayEngine } : {}),
      ...(clearedTrace ? { meal_item_fdc_cleared: clearedTrace } : {}),
    },
  };
  let { data: planRow, error: planErr } = await admin
    .from("nutrition_plan")
    .insert({
      ...planInsertBase,
      // Pagina Nutrizione read-first: la risposta renderizzabile completa si salva
      // INSIEME al piano (una sola scrittura). NULL su chiamanti legacy senza payload.
      response_payload: opts?.responsePayload ?? null,
    })
    .select("id")
    .single();
  if (planErr && /response_payload/i.test(planErr.message ?? "")) {
    // Cintura rollout: colonna `response_payload` non ancora migrata in questo ambiente
    // (42703). Degrada all'insert senza payload — il piano resta persistito e la pagina
    // read-first, non trovando payload, degrada a generazione (comportamento pre-feature).
    ({ data: planRow, error: planErr } = await admin
      .from("nutrition_plan")
      .insert(planInsertBase)
      .select("id")
      .single());
  }
  if (planErr || !planRow?.id) return { ok: false, error: `insert piano: ${planErr?.message ?? "no id"}` };
  const planId = String(planRow.id);

  // Insert pasti (uno per slot) e mappa slot → meal_id.
  const mealPayload = slots.map((s, idx) => ({
    plan_id: planId,
    slot: s.slot,
    slot_order: idx + 1,
    kcal_target: Math.round(num(s.totals.kcal)),
    carbs_g_target: Math.round(num(s.totals.choG)),
    protein_g_target: Math.round(num(s.totals.proG)),
    fat_g_target: Math.round(num(s.totals.fatG)),
  }));
  const { data: mealRows, error: mealErr } = await admin.from("meal").insert(mealPayload).select("id, slot");
  if (mealErr || !mealRows?.length) return { ok: false, error: `insert pasti: ${mealErr?.message ?? "no rows"}` };
  const mealIdBySlot = new Map<string, string>();
  for (const row of mealRows as Array<{ id: string; slot: string }>) mealIdBySlot.set(row.slot, String(row.id));

  // Righe finali: tutte le voci del giorno (quelle irrisolvibili con fdc_id già azzerato),
  // agganciate al loro meal.
  const itemPayload: Array<Record<string, unknown>> = [];
  for (const row of writableItems) {
    const mealId = mealIdBySlot.get(row.slot);
    if (!mealId) continue;
    itemPayload.push(mealItemInsertRow(row, mealId));
  }
  // Una giornata con dei cibi da scrivere ma ZERO righe scrivibili è esattamente il sintomo
  // che questo lavoro elimina (Nutrizione piena, Oggi vuota): va segnalata come errore, mai
  // restituita come successo. Con la guardia attuale non è raggiungibile (nessuna voce viene
  // scartata), quindi qui ci si arriva solo per uno slot senza meal corrispondente.
  if (itemPayload.length === 0 && pendingItems.length > 0) {
    return { ok: false, error: `insert voci: nessuna riga scrivibile per ${pendingItems.length} voci del piano` };
  }
  let itemsWritten = itemPayload.length;
  let droppedOnInsert = 0;
  let clearedOnRetry = 0;
  if (itemPayload.length > 0) {
    const { error: itemErr } = await admin.from("meal_item").insert(itemPayload);
    if (itemErr) {
      // Rete di sicurezza (non la strada principale): l'insert in blocco è caduto per una
      // riga che la guardia non aveva previsto (probe non attendibile, vincolo nuovo, dato
      // sporco). L'insert è atomico, quindi non dovrebbe essere passato niente — ma se
      // l'errore fosse arrivato DOPO il commit (timeout di rete) il riprovare duplicherebbe
      // le voci, e su `meal_item` non esiste unicità oltre alla PK: ripuliamo prima.
      const mealIds = [...new Set(itemPayload.map((r) => r.meal_id))];
      const { error: cleanErr } = await admin.from("meal_item").delete().in("meal_id", mealIds);
      if (cleanErr) console.warn("[nutrition v2 persist] pulizia pre-retry fallita", { error: cleanErr.message });

      const failures: Array<{ fdcId: unknown; label: unknown; error: string }> = [];
      for (const row of itemPayload) {
        const { error } = await admin.from("meal_item").insert(row);
        if (!error) continue;
        // Secondo tentativo SENZA fdc_id: il rifiuto quasi sempre è la FK, e la riga con
        // fdc_id NULL è legittima. Meglio l'alimento senza legame FDC che il piatto vuoto.
        if (row.fdc_id != null) {
          const { error: retryErr } = await admin.from("meal_item").insert({ ...row, fdc_id: null });
          if (!retryErr) {
            clearedOnRetry += 1;
            continue;
          }
        }
        failures.push({ fdcId: row.fdc_id, label: row.label, error: error.message });
      }
      droppedOnInsert = failures.length;
      itemsWritten = itemPayload.length - failures.length;
      if (itemsWritten === 0) return { ok: false, error: `insert voci: ${itemErr.message}` };
      console.warn("[nutrition v2 persist] insert in blocco caduto, recupero riga per riga", {
        athleteId,
        planDate,
        planId,
        bulk_error: itemErr.message,
        cleared_on_retry: clearedOnRetry,
        dropped_count: failures.length,
        failures: failures.slice(0, 24),
      });
      // La provenienza del piano è già scritta: la aggiorniamo ricostruendola da quella che
      // abbiamo appena inserito (niente read-modify-write, niente sovrascrittura in blocco
      // degli altri canali). Best-effort: se fallisce resta comunque il log.
      const { error: provErr } = await admin
        .from("nutrition_plan")
        .update({
          inputs_provenance: {
            ...planInsertBase.inputs_provenance,
            meal_item_insert_recovery: {
              bulk_error: itemErr.message,
              cleared_on_retry: clearedOnRetry,
              dropped_count: failures.length,
              failures: failures.slice(0, 24),
            },
          },
        })
        .eq("id", planId);
      if (provErr) console.warn("[nutrition v2 persist] traccia rifiuti non salvata", { error: provErr.message });
    }
  }

  return {
    ok: true,
    planId,
    itemsWritten,
    fdcCleared: clearedFdc.length + clearedOnRetry,
    droppedItems: droppedOnInsert,
  };
}
