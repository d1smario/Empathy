/**
 * Regressione persist V2 → nutrition_plan.inputs_provenance.
 * La colonna prod è `jsonb NOT NULL DEFAULT '{}'`: con day-engine ASSENTE (mode=off,
 * il kill switch, o ramo day-engine caduto in catch) il persist deve scrivere `{}`,
 * MAI null — null → 23502 not-null violation → OGNI generazione della Edge Function
 * risponderebbe 500 e la route Next servirebbe piani mai persistiti (Oggi vuoto).
 *
 * Copre anche la guardia FK `meal_item.fdc_id` e la sua rete di sicurezza per-riga: la
 * regola di fondo è che NESSUN percorso possa restituire `ok: true` con una giornata a
 * zero `meal_item` (Nutrizione piena, Oggi vuota), che è il difetto da eliminare.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MealPlanV2ComposedSlot } from "@empathy/contracts";
import type { MealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";
import type { DayEngineProvenance } from "@/lib/nutrition/v2/day-engine-integration";
import { persistV2PlanToDb } from "@/lib/nutrition/v2/persist-v2-plan-to-db";

type Captured = {
  planInsert?: Record<string, unknown>;
  planInserts: Record<string, unknown>[];
  planUpdates: Record<string, unknown>[];
  itemInserts: Array<Record<string, unknown>>;
  /** Insert su meal_item riusciti (esclusi i tentativi rifiutati): è ciò che resta nel DB. */
  itemsPersisted: Array<Record<string, unknown>>;
  itemDeletes: number;
};

function emptyCaptured(): Captured {
  return { planInserts: [], planUpdates: [], itemInserts: [], itemsPersisted: [], itemDeletes: 0 };
}

/** Client finto: cattura l'insert su nutrition_plan, risponde ok su tutto il resto.
 *  `failInsertsWithResponsePayloadColumn`: simula un ambiente PRE-migration (42703,
 *  colonna response_payload assente) → l'insert col payload fallisce, quello senza passa.
 *  `fdcFoodIds`: righe presenti in `fdc_food` (bersaglio della FK di meal_item.fdc_id);
 *  assente → la guardia vede tutti gli fdc_id come validi; `[]` → probe a ZERO righe, che è
 *  come si presenta il diniego RLS (nessun errore, nessuna riga).
 *  `dbRejectsFdcIds`: fdc_id che il DB rifiuta davvero all'insert (FK) — la riga passa solo
 *  se riproposta con fdc_id NULL.
 *  `dbRejectsLabels`: righe irrecuperabili (rifiutate anche senza fdc_id, es. CHECK grams). */
function makeFakeAdmin(
  captured: Captured,
  opts?: {
    failInsertsWithResponsePayloadColumn?: boolean;
    /** Simula un ambiente PRE-migration per le colonne `basis_*` (42703). */
    failInsertsWithBasisColumns?: boolean;
    fdcFoodIds?: number[];
    dbRejectsFdcIds?: number[];
    dbRejectsLabels?: string[];
  },
): SupabaseClient {
  const rejectsFdc = new Set(opts?.dbRejectsFdcIds ?? []);
  const rejectsLabel = new Set(opts?.dbRejectsLabels ?? []);
  const rowError = (row: Record<string, unknown>): { message: string } | null => {
    if (typeof row.label === "string" && rejectsLabel.has(row.label)) {
      return { message: 'new row violates check constraint "meal_item_grams_check"' };
    }
    if (typeof row.fdc_id === "number" && rejectsFdc.has(row.fdc_id)) {
      return { message: 'insert violates foreign key constraint "meal_item_fdc_id_fkey"' };
    }
    return null;
  };
  const fake = {
    from(table: string) {
      if (table === "fdc_food") {
        return {
          select: () => ({
            in: async (_col: string, ids: number[]) => ({
              data: (opts?.fdcFoodIds ?? ids).filter((id) => ids.includes(id)).map((fdc_id) => ({ fdc_id })),
              error: null,
            }),
          }),
        };
      }
      if (table === "nutrition_plan") {
        return {
          delete() {
            const chain = {
              eq: () => chain,
              then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
            };
            return chain;
          },
          insert(payload: Record<string, unknown>) {
            captured.planInsert = payload;
            captured.planInserts.push(payload);
            const missingColumn =
              opts?.failInsertsWithResponsePayloadColumn === true && "response_payload" in payload
                ? "response_payload"
                : opts?.failInsertsWithBasisColumns === true && "basis_kcal" in payload
                  ? "basis_kcal"
                  : null;
            return {
              select: () => ({
                single: async () =>
                  missingColumn
                    ? {
                        data: null,
                        error: {
                          message: `column "${missingColumn}" of relation "nutrition_plan" does not exist`,
                        },
                      }
                    : { data: { id: "plan-1" }, error: null },
              }),
            };
          },
          update(payload: Record<string, unknown>) {
            captured.planUpdates.push(payload);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (table === "meal") {
        return {
          insert: (rows: Array<{ slot: string }>) => ({
            select: async () => ({
              data: rows.map((r, i) => ({ id: `meal-${i + 1}`, slot: r.slot })),
              error: null,
            }),
          }),
        };
      }
      // meal_item
      return {
        insert: async (rows: Record<string, unknown> | Array<Record<string, unknown>>) => {
          const list = Array.isArray(rows) ? rows : [rows];
          captured.itemInserts.push(...list);
          // L'insert in blocco è ATOMICO: una riga rifiutata e non passa niente.
          const firstError = list.map(rowError).find((e) => e !== null);
          if (firstError) return { error: firstError };
          captured.itemsPersisted.push(...list);
          return { error: null };
        },
        delete: () => ({
          in: async () => {
            captured.itemDeletes += 1;
            captured.itemsPersisted.length = 0;
            return { error: null };
          },
        }),
      };
    },
  };
  return fake as unknown as SupabaseClient;
}

function makeProduction(dayEngine?: DayEngineProvenance): MealPlanV2Production {
  const slot: MealPlanV2ComposedSlot = {
    slot: "breakfast",
    labelIt: "Colazione",
    targetKcal: 500,
    items: [
      {
        fdcId: 123,
        description: "Fiocchi d'avena",
        grams: 80,
        kcal: 300,
        choG: 50,
        proG: 10,
        fatG: 6,
      },
    ],
    totals: { kcal: 300, choG: 50, proG: 10, fatG: 6 },
  };
  return {
    engine: "nutrition_v2",
    algorithmVersion: "nutrition_meal_plan_v2_production",
    taxonomyVersion: "test",
    // Il persist non legge requirements: fixture minimale.
    requirements: {} as MealPlanV2Production["requirements"],
    dietMealSlotBudgets: [],
    composedMealPlan: [slot],
    ...(dayEngine ? { dayEngine } : {}),
  };
}

/** Produzione con più voci nello stesso slot, per la guardia FK. */
function makeProductionWithItems(items: MealPlanV2ComposedSlot["items"]): MealPlanV2Production {
  const base = makeProduction();
  return { ...base, composedMealPlan: [{ ...base.composedMealPlan[0]!, items }] };
}

const OK_ONE_ITEM = { ok: true, planId: "plan-1", itemsWritten: 1, fdcCleared: 0, droppedItems: 0 };

test("persist: day-engine ASSENTE (mode off / catch) → inputs_provenance {} e mai null", async () => {
  const captured = emptyCaptured();
  const res = await persistV2PlanToDb(makeFakeAdmin(captured), "ath-1", "2026-08-10", makeProduction());
  assert.deepEqual(res, OK_ONE_ITEM);
  assert.ok(captured.planInsert, "insert nutrition_plan atteso");
  assert.notEqual(captured.planInsert!.inputs_provenance, null, "MAI null: colonna jsonb NOT NULL");
  assert.deepEqual(captured.planInsert!.inputs_provenance, {}, "identico al default '{}' della colonna");
});

test("persist: day-engine presente → inputs_provenance.day_engine = report QA", async () => {
  const dayEngine: DayEngineProvenance = {
    engine: "day_classification_v1",
    mode: "shadow",
    applied: false,
    applicable: false,
    reason: "lean_mass_missing",
    strategiaPct: 100,
    fuelingChoG: 0,
    flags: [],
    slots: [],
  };
  const captured = emptyCaptured();
  const res = await persistV2PlanToDb(
    makeFakeAdmin(captured),
    "ath-1",
    "2026-08-10",
    makeProduction(dayEngine),
  );
  assert.deepEqual(res, OK_ONE_ITEM);
  assert.deepEqual(captured.planInsert!.inputs_provenance, { day_engine: dayEngine });
});

/* ── Read-first (8 ago): response_payload persistito insieme al piano ─────────── */

test("persist: responsePayload passato → scritto in response_payload nella STESSA insert (mai update a due tempi)", async () => {
  const captured = emptyCaptured();
  const payload = { layer: "deterministic_meal_assembly_v1", slots: [], solverBasis: { source: "nutrition_meal_plan_solver" } };
  const res = await persistV2PlanToDb(makeFakeAdmin(captured), "ath-1", "2026-08-10", makeProduction(), {
    responsePayload: payload,
  });
  assert.deepEqual(res, OK_ONE_ITEM);
  assert.equal(captured.planInserts.length, 1, "una sola scrittura del piano");
  assert.deepEqual(captured.planInsert!.response_payload, payload);
  // Regressione: il canale inputs_provenance resta intatto ({} senza day-engine).
  assert.deepEqual(captured.planInsert!.inputs_provenance, {});
  assert.equal(captured.planUpdates.length, 0, "nessun update a due tempi nel caso normale");
});

test("persist: responsePayload assente (chiamante legacy) → response_payload NULL, insert ok", async () => {
  const captured = emptyCaptured();
  const res = await persistV2PlanToDb(makeFakeAdmin(captured), "ath-1", "2026-08-10", makeProduction());
  assert.deepEqual(res, OK_ONE_ITEM);
  assert.equal(captured.planInsert!.response_payload, null);
});

test("persist: ambiente pre-migration (colonna assente, 42703) → retry senza payload, piano persistito comunque", async () => {
  const captured = emptyCaptured();
  const res = await persistV2PlanToDb(
    makeFakeAdmin(captured, { failInsertsWithResponsePayloadColumn: true }),
    "ath-1",
    "2026-08-10",
    makeProduction(),
    { responsePayload: { layer: "deterministic_meal_assembly_v1" } },
  );
  assert.deepEqual(res, OK_ONE_ITEM);
  assert.equal(captured.planInserts.length, 2, "primo insert col payload fallisce, il retry senza payload passa");
  assert.ok(!("response_payload" in captured.planInserts[1]!), "il retry non deve contenere la colonna mancante");
});

/* ── Guardia FK meal_item.fdc_id (11 ago): un alimento difettoso non azzera la giornata ── */

test("persist: un fdc_id assente da fdc_food perde SOLO il legame FDC, il cibo resta nel piatto", async () => {
  const captured = emptyCaptured();
  const production = makeProductionWithItems([
    { fdcId: 170645, description: "Pasta", grams: 100, kcal: 350, choG: 70, proG: 12, fatG: 2 },
    // Riga CIQUAL con fdc_id sintetico: esiste in nutrition_fdc_foods, NON in fdc_food.
    { fdcId: 900011043, description: "Formaggio fresco", grams: 60, kcal: 150, choG: 2, proG: 10, fatG: 11 },
    { fdcId: 170379, description: "Broccoli", grams: 150, kcal: 45, choG: 8, proG: 4, fatG: 1 },
  ]);
  const res = await persistV2PlanToDb(
    makeFakeAdmin(captured, { fdcFoodIds: [170645, 170379] }),
    "ath-1",
    "2026-08-10",
    production,
  );
  assert.deepEqual(res, { ok: true, planId: "plan-1", itemsWritten: 3, fdcCleared: 1, droppedItems: 0 });
  assert.deepEqual(
    captured.itemsPersisted.map((r) => r.fdc_id),
    [170645, null, 170379],
    "la giornata conserva TUTTI gli alimenti; l'irrisolvibile va con fdc_id NULL",
  );
  assert.equal(captured.itemsPersisted[1]!.label, "Formaggio fresco", "Oggi lo mostra con la label salvata");
  const provenance = captured.planInsert!.inputs_provenance as Record<string, unknown>;
  assert.deepEqual(provenance.meal_item_fdc_cleared, {
    reason: "fdc_id_missing_in_fdc_food",
    cleared_count: 1,
    cleared: [{ slot: "breakfast", fdc_id: 900011043, label: "Formaggio fresco", canonical_key: null }],
  });
});

test("persist: giornata di SOLI fdc_id irrisolvibili → scritta comunque (mai ok con zero meal_item)", async () => {
  // È il caso che prima usciva `ok: true` con ZERO voci: Nutrizione piena, Oggi vuota,
  // segnalato come successo. Qui la probe torna zero righe (verdetto ignorato: non si
  // distingue un diniego RLS da un catalogo tutto sintetico) e il rifiuto arriva dal DB:
  // la rete per-riga recupera ogni voce senza il legame FDC.
  const captured = emptyCaptured();
  const production = makeProductionWithItems([
    { fdcId: 900011043, description: "Formaggio fresco", grams: 60, kcal: 150, choG: 2, proG: 10, fatG: 11 },
    { fdcId: 900011044, description: "Yogurt CIQUAL", grams: 125, kcal: 80, choG: 6, proG: 5, fatG: 3 },
  ]);
  const res = await persistV2PlanToDb(
    makeFakeAdmin(captured, { fdcFoodIds: [], dbRejectsFdcIds: [900011043, 900011044] }),
    "ath-1",
    "2026-08-10",
    production,
  );
  assert.deepEqual(res, { ok: true, planId: "plan-1", itemsWritten: 2, fdcCleared: 2, droppedItems: 0 });
  assert.equal(captured.itemsPersisted.length, 2, "la giornata NON è vuota");
  assert.deepEqual(
    captured.itemsPersisted.map((r) => r.label),
    ["Formaggio fresco", "Yogurt CIQUAL"],
  );
});

test("persist: guardia che riconosce l'fdc sintetico → stessa giornata piena, senza passare dalla rete", async () => {
  // Variante con probe attendibile (almeno un alimento noto): il verdetto si applica prima
  // di scrivere, quindi niente insert fallito e niente retry — stesso esito per l'atleta.
  const captured = emptyCaptured();
  const production = makeProductionWithItems([
    { fdcId: 170645, description: "Pasta", grams: 100, kcal: 350, choG: 70, proG: 12, fatG: 2 },
    { fdcId: 900011043, description: "Formaggio fresco", grams: 60, kcal: 150, choG: 2, proG: 10, fatG: 11 },
    { fdcId: 900011044, description: "Yogurt CIQUAL", grams: 125, kcal: 80, choG: 6, proG: 5, fatG: 3 },
  ]);
  const res = await persistV2PlanToDb(
    makeFakeAdmin(captured, { fdcFoodIds: [170645], dbRejectsFdcIds: [900011043, 900011044] }),
    "ath-1",
    "2026-08-10",
    production,
  );
  assert.deepEqual(res, { ok: true, planId: "plan-1", itemsWritten: 3, fdcCleared: 2, droppedItems: 0 });
  assert.equal(captured.itemDeletes, 0, "nessun retry: la guardia ha già evitato il rifiuto");
  assert.equal(captured.planUpdates.length, 0, "niente update di recupero");
});

test("persist: nessuno scarto → inputs_provenance senza meal_item_fdc_cleared (caso normale invariato)", async () => {
  const captured = emptyCaptured();
  const res = await persistV2PlanToDb(
    makeFakeAdmin(captured, { fdcFoodIds: [123] }),
    "ath-1",
    "2026-08-10",
    makeProduction(),
  );
  assert.deepEqual(res, OK_ONE_ITEM);
  assert.deepEqual(captured.planInsert!.inputs_provenance, {});
  assert.equal(captured.itemsPersisted.length, 1);
});

test("persist: probe a ZERO righe (diniego RLS) → verdetto ignorato, gli fdc_id buoni restano", async () => {
  // `fdc_food` ha RLS con la sola policy platform-admin: un client non service-role legge
  // zero righe SENZA errore. Prenderlo per buono vorrebbe dire azzerare l'fdc_id di tutta
  // la giornata; qui il DB accetta le righe e i legami FDC devono sopravvivere.
  const captured = emptyCaptured();
  const production = makeProductionWithItems([
    { fdcId: 170645, description: "Pasta", grams: 100, kcal: 350, choG: 70, proG: 12, fatG: 2 },
    { fdcId: 170379, description: "Broccoli", grams: 150, kcal: 45, choG: 8, proG: 4, fatG: 1 },
  ]);
  const res = await persistV2PlanToDb(
    makeFakeAdmin(captured, { fdcFoodIds: [] }),
    "ath-1",
    "2026-08-10",
    production,
  );
  assert.deepEqual(res, { ok: true, planId: "plan-1", itemsWritten: 2, fdcCleared: 0, droppedItems: 0 });
  assert.deepEqual(
    captured.itemsPersisted.map((r) => r.fdc_id),
    [170645, 170379],
    "nessun legame FDC perso per colpa di una probe cieca",
  );
  assert.deepEqual(captured.planInsert!.inputs_provenance, {});
});

/* ── Rete di sicurezza per-riga: l'insert in blocco cade per una riga imprevista ───── */

test("persist: bulk rifiutato da una FK non prevista → pulizia, retry per-riga, voce salvata senza fdc_id", async () => {
  // Probe cieca (zero righe → verdetto ignorato) + DB che rifiuta davvero l'fdc sintetico:
  // è il percorso che porta l'errore fino all'insert, dove la rete deve recuperare.
  const captured = emptyCaptured();
  const production = makeProductionWithItems([
    { fdcId: 170645, description: "Pasta", grams: 100, kcal: 350, choG: 70, proG: 12, fatG: 2 },
    { fdcId: 900011043, description: "Formaggio fresco", grams: 60, kcal: 150, choG: 2, proG: 10, fatG: 11 },
  ]);
  const res = await persistV2PlanToDb(
    makeFakeAdmin(captured, { fdcFoodIds: [], dbRejectsFdcIds: [900011043] }),
    "ath-1",
    "2026-08-10",
    production,
  );
  assert.deepEqual(res, { ok: true, planId: "plan-1", itemsWritten: 2, fdcCleared: 1, droppedItems: 0 });
  assert.equal(captured.itemDeletes, 1, "pulizia prima del retry: niente doppioni se il bulk avesse committato");
  assert.deepEqual(
    captured.itemsPersisted.map((r) => r.fdc_id),
    [170645, null],
    "la voce rifiutata rientra senza legame FDC invece di sparire",
  );
  const update = captured.planUpdates[0]!.inputs_provenance as Record<string, unknown>;
  const recovery = update.meal_item_insert_recovery as Record<string, unknown>;
  assert.equal(recovery.cleared_on_retry, 1);
  assert.equal(recovery.dropped_count, 0);
});

test("persist: riga irrecuperabile (rifiutata anche senza fdc_id) → cade da sola, il resto della giornata si salva", async () => {
  const captured = emptyCaptured();
  const production = makeProductionWithItems([
    { fdcId: 170645, description: "Pasta", grams: 100, kcal: 350, choG: 70, proG: 12, fatG: 2 },
    { fdcId: 170379, description: "Broccoli", grams: 150, kcal: 45, choG: 8, proG: 4, fatG: 1 },
  ]);
  const res = await persistV2PlanToDb(
    makeFakeAdmin(captured, { dbRejectsLabels: ["Broccoli"] }),
    "ath-1",
    "2026-08-10",
    production,
  );
  assert.deepEqual(res, { ok: true, planId: "plan-1", itemsWritten: 1, fdcCleared: 0, droppedItems: 1 });
  assert.deepEqual(captured.itemsPersisted.map((r) => r.label), ["Pasta"]);
  const update = captured.planUpdates[0]!.inputs_provenance as Record<string, unknown>;
  const recovery = update.meal_item_insert_recovery as Record<string, unknown>;
  assert.equal(recovery.dropped_count, 1);
  assert.deepEqual(
    (recovery.failures as Array<{ label: unknown }>).map((f) => f.label),
    ["Broccoli"],
  );
  // Regressione: gli altri canali di provenienza non vengono sovrascritti dall'update.
  assert.deepEqual((update.meal_item_fdc_cleared ?? null), null);
});

test("persist: nessuna riga scrivibile (tutte rifiutate) → ok:false, mai un successo con giornata vuota", async () => {
  const captured = emptyCaptured();
  const production = makeProductionWithItems([
    { fdcId: 170645, description: "Pasta", grams: 100, kcal: 350, choG: 70, proG: 12, fatG: 2 },
    { fdcId: 170379, description: "Broccoli", grams: 150, kcal: 45, choG: 8, proG: 4, fatG: 1 },
  ]);
  const res = await persistV2PlanToDb(
    makeFakeAdmin(captured, { dbRejectsLabels: ["Pasta", "Broccoli"] }),
    "ath-1",
    "2026-08-10",
    production,
  );
  assert.equal(res.ok, false, "il chiamante deve vedere un errore, non un 200 con Oggi vuota");
  assert.match((res as { error: string }).error, /insert voci/);
  assert.equal(captured.itemsPersisted.length, 0);
});

/* ── E2: il target del motore in colonna (basis_*) ──────────────────────────────────
 * `kcal_target` contiene il SERVITO (Σ meal_item): verificato su 721 piani, zero scarti
 * oltre 3 kcal. Il TARGET vero — gli slot che il motore ha davvero usato — viveva solo
 * dentro `response_payload.solverBasis.slots`, illeggibile in SQL. Da qui in avanti nasce
 * anche in colonna: target e servito sono due cose diverse e devono convivere, entrambe
 * dichiarate per quello che sono.
 */

/** Produzione con la BASE del solver (gli slot passati al composer) e un servito diverso. */
function makeProductionWithBasis(
  budgets: MealPlanV2Production["dietMealSlotBudgets"],
  dayEngine?: DayEngineProvenance,
): MealPlanV2Production {
  return { ...makeProduction(dayEngine), dietMealSlotBudgets: budgets };
}

const BASIS_TWO_SLOTS: MealPlanV2Production["dietMealSlotBudgets"] = [
  { key: "breakfast", label: "Colazione", pct: 25, kcal: 620.4, carbs: 80.24, protein: 30.16, fat: 18.32 },
  { key: "lunch", label: "Pranzo", pct: 40, kcal: 1000.6, carbs: 130.31, protein: 55.44, fat: 28.21 },
];

test("persist: basis_* = somma degli slot della base del solver, e resta diverso da kcal_target (il servito)", async () => {
  const captured = emptyCaptured();
  const res = await persistV2PlanToDb(
    makeFakeAdmin(captured),
    "ath-1",
    "2026-08-10",
    makeProductionWithBasis(BASIS_TWO_SLOTS),
  );
  assert.deepEqual(res, OK_ONE_ITEM);
  const plan = captured.planInsert!;
  // Σ degli slot della base, con gli stessi arrotondamenti del payload (solverBasis.slots):
  // 620 + 1001 = 1621 kcal; 80,2 + 130,3 = 210,5 CHO; 30,2 + 55,4 = 85,6 PRO; 18,3 + 28,2 = 46,5 FAT.
  assert.equal(plan.basis_kcal, 1621);
  assert.equal(plan.basis_carbs_g, 210.5);
  assert.equal(plan.basis_protein_g, 85.6);
  assert.equal(plan.basis_fat_g, 46.5);
  // Il servito resta dov'era: la colonna `*_target` continua a contenere Σ meal_item (300 kcal
  // dell'unico item della fixture). Le due informazioni convivono, e sono diverse.
  assert.equal(plan.kcal_target, 300);
  assert.notEqual(plan.basis_kcal, plan.kcal_target);
});

test("persist: basis_source = 'diet_slots' quando il day-engine non si è applicato", async () => {
  const captured = emptyCaptured();
  const shadow: DayEngineProvenance = {
    engine: "day_classification_v1",
    mode: "shadow",
    applied: false,
    applicable: true,
    strategiaPct: 100,
    fuelingChoG: 0,
    flags: [],
    slots: [],
  };
  await persistV2PlanToDb(
    makeFakeAdmin(captured),
    "ath-1",
    "2026-08-10",
    makeProductionWithBasis(BASIS_TWO_SLOTS, shadow),
  );
  assert.equal(captured.planInsert!.basis_source, "diet_slots");
});

test("persist: basis_source = 'day_engine' quando gli slot serviti sono quelli del day-engine", async () => {
  const captured = emptyCaptured();
  const applied: DayEngineProvenance = {
    engine: "day_classification_v1",
    mode: "on",
    applied: true,
    applicable: true,
    strategiaPct: 100,
    fuelingChoG: 0,
    flags: [],
    slots: [],
  };
  await persistV2PlanToDb(
    makeFakeAdmin(captured),
    "ath-1",
    "2026-08-10",
    makeProductionWithBasis(BASIS_TWO_SLOTS, applied),
  );
  assert.equal(captured.planInsert!.basis_source, "day_engine");
});

test("persist: nessuno slot di base (chiamante legacy) → basis_* NULL, mai uno zero che sembra un target", async () => {
  const captured = emptyCaptured();
  const res = await persistV2PlanToDb(makeFakeAdmin(captured), "ath-1", "2026-08-10", makeProduction());
  assert.deepEqual(res, OK_ONE_ITEM);
  assert.equal(captured.planInsert!.basis_kcal, null);
  assert.equal(captured.planInsert!.basis_carbs_g, null);
  assert.equal(captured.planInsert!.basis_protein_g, null);
  assert.equal(captured.planInsert!.basis_fat_g, null);
  assert.equal(captured.planInsert!.basis_source, null);
});

test("persist: ambiente senza le colonne basis_* (pre-migration) → retry senza, il piano si persiste comunque", async () => {
  // Stesso patto di response_payload: il codice arriva in produzione prima della migrazione,
  // e una generazione NON deve mai fallire per una colonna che non c'è ancora.
  const captured = emptyCaptured();
  const res = await persistV2PlanToDb(
    makeFakeAdmin(captured, { failInsertsWithBasisColumns: true }),
    "ath-1",
    "2026-08-10",
    makeProductionWithBasis(BASIS_TWO_SLOTS),
    { responsePayload: { layer: "deterministic_meal_assembly_v1" } },
  );
  assert.deepEqual(res, OK_ONE_ITEM);
  assert.equal(captured.planInserts.length, 2, "primo insert con basis_* fallisce, il retry senza passa");
  assert.ok(!("basis_kcal" in captured.planInserts[1]!), "il retry non contiene le colonne mancanti");
  assert.ok(!("basis_source" in captured.planInserts[1]!), "nemmeno la provenienza della base");
  assert.deepEqual(
    captured.planInserts[1]!.response_payload,
    { layer: "deterministic_meal_assembly_v1" },
    "si toglie SOLO il gruppo che manca: il payload read-first resta",
  );
});
