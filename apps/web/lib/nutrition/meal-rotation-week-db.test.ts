import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isoWeekRangeForDate,
  loadWeeklyStapleCountsFromDb,
  mergeWeeklyStapleCounts,
} from "@/lib/nutrition/meal-rotation-week-db";

test("isoWeekRangeForDate: lunedì→domenica della settimana ISO", () => {
  // 2026-07-22 è mercoledì → settimana 2026-07-20 (lun) .. 2026-07-26 (dom).
  assert.deepEqual(isoWeekRangeForDate("2026-07-22"), { start: "2026-07-20", end: "2026-07-26" });
  // Lunedì e domenica restano nella stessa settimana.
  assert.deepEqual(isoWeekRangeForDate("2026-07-20"), { start: "2026-07-20", end: "2026-07-26" });
  assert.deepEqual(isoWeekRangeForDate("2026-07-26"), { start: "2026-07-20", end: "2026-07-26" });
  // Cavallo d'anno: 2027-01-01 è venerdì → settimana parte lunedì 2026-12-28.
  assert.deepEqual(isoWeekRangeForDate("2027-01-01"), { start: "2026-12-28", end: "2027-01-03" });
  // Data invalida → range degenerato, nessun crash.
  assert.deepEqual(isoWeekRangeForDate("not-a-date"), { start: "not-a-date", end: "not-a-date" });
});

test("mergeWeeklyStapleCounts: MAX per chiave, sanitizzazione, undefined se vuoto", () => {
  const merged = mergeWeeklyStapleCounts(
    { "carb:pasta": 2, "prot:pollo": 1 },
    { "carb:pasta": 1, "carb:riso": 3 },
  );
  assert.deepEqual(merged, { "carb:pasta": 2, "prot:pollo": 1, "carb:riso": 3 });

  // Valori non validi scartati, cap 21, chiavi troppo lunghe fuori.
  const longKey = "x".repeat(80);
  const sanitized = mergeWeeklyStapleCounts({ "carb:pasta": 99, [longKey]: 2, "prot:x": -1, "prot:y": NaN });
  assert.deepEqual(sanitized, { "carb:pasta": 21 });

  assert.equal(mergeWeeklyStapleCounts(undefined, undefined), undefined);
  assert.equal(mergeWeeklyStapleCounts({}, {}), undefined);
});

type FakeQueryResult = { data: unknown; error: unknown };

function fakeDb(result: FakeQueryResult, capture?: { filters: Array<[string, string, string]> }) {
  const builder = {
    select: () => builder,
    eq: (col: string, val: string) => {
      capture?.filters.push(["eq", col, val]);
      return builder;
    },
    gte: (col: string, val: string) => {
      capture?.filters.push(["gte", col, val]);
      return builder;
    },
    lte: (col: string, val: string) => {
      capture?.filters.push(["lte", col, val]);
      return builder;
    },
    neq: (col: string, val: string) => {
      capture?.filters.push(["neq", col, val]);
      return builder;
    },
    then: (resolve: (v: FakeQueryResult) => void) => resolve(result),
  };
  return { from: () => builder } as unknown as SupabaseClient;
}

test("loadWeeklyStapleCountsFromDb: aggrega canonical_key per giorno in chiavi rotation", async () => {
  const capture = { filters: [] as Array<[string, string, string]> };
  const db = fakeDb(
    {
      data: [
        {
          plan_date: "2026-07-20",
          meal: [
            { meal_item: [{ canonical_key: "pasta_dry" }, { canonical_key: "chicken_breast" }] },
            { meal_item: [{ canonical_key: "pasta_dry" }] }, // duplicato stesso giorno → 1 sola occorrenza
          ],
        },
        {
          plan_date: "2026-07-21",
          meal: [{ meal_item: [{ canonical_key: "pasta_dry" }, { canonical_key: "spinach_raw" }] }],
        },
      ],
      error: null,
    },
    capture,
  );
  const counts = await loadWeeklyStapleCountsFromDb(db, "athlete-1", "2026-07-22");
  assert.equal(counts["carb:pasta"], 2); // 1 per giorno, non per item
  assert.equal(counts["prot:pollo"], 1);
  assert.equal(counts["spinach_raw"], 1); // senza rotationKey → canonical key
  // Filtri: settimana ISO di planDate, escluso il giorno in rigenerazione.
  assert.deepEqual(capture.filters, [
    ["eq", "athlete_id", "athlete-1"],
    ["gte", "plan_date", "2026-07-20"],
    ["lte", "plan_date", "2026-07-26"],
    ["neq", "plan_date", "2026-07-22"],
  ]);
});

test("loadWeeklyStapleCountsFromDb: errore o dati malformati → {} (best-effort)", async () => {
  assert.deepEqual(await loadWeeklyStapleCountsFromDb(fakeDb({ data: null, error: { message: "boom" } }), "a", "2026-07-22"), {});
  assert.deepEqual(await loadWeeklyStapleCountsFromDb(fakeDb({ data: [{ plan_date: "x", meal: "junk" }], error: null }), "a", "2026-07-22"), {});
});
