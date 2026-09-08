import assert from "node:assert/strict";
import test from "node:test";

import {
  redistributeSuppressedSlotBudgets,
  SUPPRESSED_SLOT_MAX_RECEIVER_GROWTH,
  SUPPRESSED_SLOT_REDISTRIBUTION_MIN_KCAL,
} from "@/lib/nutrition/v2/redistribute-suppressed-slot-budgets";

type Row = { key: string; kcal: number; carbs: number; protein: number; fat: number };

const day = (): Row[] => [
  { key: "breakfast", kcal: 600, carbs: 75, protein: 30, fat: 17 },
  { key: "snack_am", kcal: 250, carbs: 31, protein: 13, fat: 7 },
  { key: "lunch", kcal: 800, carbs: 100, protein: 40, fat: 22 },
  { key: "dinner", kcal: 600, carbs: 75, protein: 30, fat: 17 },
];

const sum = (rows: Row[], k: keyof Row): number => rows.reduce((s, r) => s + (r[k] as number), 0);

test("lo slot soppresso resta a zero e la giornata conserva le sue kcal", () => {
  const before = day();
  const after = redistributeSuppressedSlotBudgets(before, { suppressedKeys: ["snack_am"] });
  const snack = after.find((r) => r.key === "snack_am")!;
  assert.equal(snack.kcal, 0, "lo slot dentro la finestra resta senza budget: non si serve nulla");
  assert.equal(snack.carbs + snack.protein + snack.fat, 0);
  assert.equal(sum(after, "kcal"), sum(before, "kcal"), "il totale del giorno non cambia di una kcal");
});

test("il residuo va agli altri pasti in proporzione alle loro kcal, macro compresi", () => {
  const after = redistributeSuppressedSlotBudgets(day(), { suppressedKeys: ["snack_am"] });
  const bk = after.find((r) => r.key === "breakfast")!;
  const lu = after.find((r) => r.key === "lunch")!;
  // 250 kcal su 2000 di riceventi: +12,5% a ciascuno, in proporzione.
  assert.equal(bk.kcal, 675);
  assert.equal(lu.kcal, 900);
  // La ripartizione dello slot non cambia: i macro seguono le kcal.
  assert.ok(Math.abs(bk.carbs / bk.kcal - 75 / 600) < 0.002, "la quota CHO dello slot resta la sua");
  assert.ok(Math.abs(lu.protein / lu.kcal - 40 / 800) < 0.002, "la quota proteica dello slot resta la sua");
});

test("gli slot a protocollo (pre-gara, recovery) non ricevono: il protocollo non insegue il budget", () => {
  const after = redistributeSuppressedSlotBudgets(day(), {
    suppressedKeys: ["snack_am"],
    excludeKeys: ["lunch"],
  });
  assert.equal(after.find((r) => r.key === "lunch")!.kcal, 800, "il pranzo a protocollo resta intatto");
  assert.equal(sum(after, "kcal"), sum(day(), "kcal"), "il totale resta comunque quello");
});

test("nessun ricevente ammesso → si lascia tutto com'è (meglio uno scarto onesto di un pasto inventato)", () => {
  const rows: Row[] = [
    { key: "snack_am", kcal: 250, carbs: 31, protein: 13, fat: 7 },
    { key: "lunch", kcal: 800, carbs: 100, protein: 40, fat: 22 },
  ];
  const after = redistributeSuppressedSlotBudgets(rows, { suppressedKeys: ["snack_am"], excludeKeys: ["lunch"] });
  assert.deepEqual(after, rows);
});

test("sotto la soglia non si sposta nulla (rumore di arrotondamento)", () => {
  const rows: Row[] = [
    { key: "snack_am", kcal: SUPPRESSED_SLOT_REDISTRIBUTION_MIN_KCAL - 1, carbs: 3, protein: 1, fat: 0 },
    { key: "lunch", kcal: 800, carbs: 100, protein: 40, fat: 22 },
  ];
  assert.deepEqual(redistributeSuppressedSlotBudgets(rows, { suppressedKeys: ["snack_am"] }), rows);
});

test("nessuno slot soppresso → identità", () => {
  const rows = day();
  assert.deepEqual(redistributeSuppressedSlotBudgets(rows, { suppressedKeys: [] }), rows);
});

test("più slot soppressi nello stesso giorno: si sposta solo quello che i riceventi sanno servire", () => {
  const before = day();
  // 850 kcal da ricollocare su 1.400 di riceventi: il tetto (+35%) ne accoglie 490.
  const after = redistributeSuppressedSlotBudgets(before, { suppressedKeys: ["snack_am", "dinner"] });
  const bk = after.find((r) => r.key === "breakfast")!;
  const lu = after.find((r) => r.key === "lunch")!;
  assert.equal(bk.kcal, Math.round(600 * (1 + SUPPRESSED_SLOT_MAX_RECEIVER_GROWTH)), "colazione al tetto, non oltre");
  assert.equal(lu.kcal, Math.round(800 * (1 + SUPPRESSED_SLOT_MAX_RECEIVER_GROWTH)), "pranzo al tetto, non oltre");
  assert.equal(sum(after, "kcal"), sum(before, "kcal"), "nessuna kcal inventata né persa: il resto resta sui donatori");
});

test("oltre il tetto il resto RESTA sui donatori: lo scarto si dichiara, non si serve in porzioni impossibili", () => {
  // Giornata di gara: pranzo e spuntino dentro la finestra, tre pasti soli a raccogliere.
  const race: Row[] = [
    { key: "breakfast", kcal: 900, carbs: 112, protein: 45, fat: 25 },
    { key: "snack_am", kcal: 650, carbs: 81, protein: 32, fat: 18 },
    { key: "lunch", kcal: 1350, carbs: 168, protein: 67, fat: 37 },
    { key: "dinner", kcal: 900, carbs: 112, protein: 45, fat: 25 },
  ];
  const after = redistributeSuppressedSlotBudgets(race, { suppressedKeys: ["snack_am", "lunch"] });
  const dinner = after.find((r) => r.key === "dinner")!;
  assert.ok(dinner.kcal <= Math.round(900 * (1 + SUPPRESSED_SLOT_MAX_RECEIVER_GROWTH)) , `cena ${dinner.kcal}: mai oltre il tetto`);
  assert.ok(dinner.kcal < 1300, "niente cene da 2.000 kcal: il tetto tiene la porzione servibile");
  const stillOnDonors =
    after.find((r) => r.key === "snack_am")!.kcal + after.find((r) => r.key === "lunch")!.kcal;
  assert.ok(stillOnDonors > 0, "quello che non ci sta resta visibile sui donatori, non evapora e non si serve");
  assert.equal(sum(after, "kcal"), sum(race, "kcal"));
});
