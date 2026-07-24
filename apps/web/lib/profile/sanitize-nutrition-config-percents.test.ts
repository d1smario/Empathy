import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeNutritionConfigPercentsForAthlete } from "./sanitize-nutrition-config-percents";

const coachMon = {
  meal_count_mode: "4",
  day_type: "normocaloric-100",
  caloric_distribution: { breakfast: 30, lunch: 35, dinner: 25, snacks: 10 },
  daily_macros: { cho_pct: 50, pro_pct: 25, fat_pct: 25 },
  meal_macro_custom: { breakfast: { cho_pct: 60 } },
};

test("atleta che riscrive le % del giorno: valori ri-forzati a quelli del DB", () => {
  const stored = { week_plan: { Mon: coachMon } };
  const incoming = {
    week_plan: {
      Mon: {
        ...coachMon,
        caloric_distribution: { breakfast: 90, lunch: 5, dinner: 5, snacks: 0 },
        daily_macros: { cho_pct: 80, pro_pct: 10, fat_pct: 10 },
        meal_macro_custom: { breakfast: { cho_pct: 100 } },
      },
    },
  };
  const res = sanitizeNutritionConfigPercentsForAthlete(incoming, stored);
  assert.equal(res.changed, true);
  const mon = (res.config.week_plan as Record<string, Record<string, unknown>>).Mon;
  assert.deepEqual(mon.caloric_distribution, coachMon.caloric_distribution);
  assert.deepEqual(mon.daily_macros, coachMon.daily_macros);
  assert.deepEqual(mon.meal_macro_custom, coachMon.meal_macro_custom);
});

test("campi NON protetti restano scrivibili dall'atleta", () => {
  const stored = { week_plan: { Mon: coachMon }, excluded_fdc_foods: [1] };
  const incoming = {
    week_plan: { Mon: { ...coachMon, meal_count_mode: "6", day_type: "hypocaloric-80", day_type_pct: 80 } },
    excluded_fdc_foods: [1, 2, 3],
    prep_time: "quick",
  };
  const res = sanitizeNutritionConfigPercentsForAthlete(incoming, stored);
  const mon = (res.config.week_plan as Record<string, Record<string, unknown>>).Mon;
  assert.equal(mon.meal_count_mode, "6");
  assert.equal(mon.day_type, "hypocaloric-80");
  assert.equal(mon.day_type_pct, 80);
  assert.deepEqual(res.config.excluded_fdc_foods, [1, 2, 3]);
  assert.equal(res.config.prep_time, "quick");
  // Le % non erano state toccate → nessun enforcement segnalato.
  assert.equal(res.changed, false);
});

test("merge-by-day: i giorni del coach assenti nel payload sopravvivono con le sole chiavi protette", () => {
  const stored = {
    week_plan: {
      Mon: coachMon,
      Tue: { caloric_distribution: { breakfast: 25, lunch: 40, dinner: 25, snacks: 10 } },
    },
  };
  // L'atleta manda solo Mon (es. salvataggio parziale): Tue non deve perdere le %.
  const incoming = { week_plan: { Mon: coachMon } };
  const res = sanitizeNutritionConfigPercentsForAthlete(incoming, stored);
  const week = res.config.week_plan as Record<string, Record<string, unknown>>;
  assert.deepEqual(week.Tue, { caloric_distribution: { breakfast: 25, lunch: 40, dinner: 25, snacks: 10 } });
  assert.equal(res.changed, true);
});

test("giorno nuovo non configurato dal coach: le % dell'atleta vengono strippate, il resto resta", () => {
  const stored = { week_plan: { Mon: coachMon } };
  const incoming = {
    week_plan: {
      Mon: coachMon,
      Wed: {
        meal_count_mode: "3",
        caloric_distribution: { breakfast: 50, lunch: 25, dinner: 25, snacks: 0 },
      },
    },
  };
  const res = sanitizeNutritionConfigPercentsForAthlete(incoming, stored);
  const week = res.config.week_plan as Record<string, Record<string, unknown>>;
  assert.deepEqual(week.Wed, { meal_count_mode: "3" });
  assert.equal(res.changed, true);
});

test("chiavi legacy root e meal_plan (caloric_split/macro_split) forzate ai valori del DB", () => {
  const stored = {
    caloric_split: { breakfast_pct: 30, lunch_pct: 35, dinner_pct: 25, snacks_pct: 10 },
    macro_split: { carbs_pct: 55, protein_pct: 20, fat_pct: 25 },
    meal_plan: { meal_strategy: "4-meals", caloric_split: { breakfast_pct: 20 } },
  };
  const incoming = {
    caloric_split: { breakfast_pct: 100 },
    macro_split: { carbs_pct: 90 },
    meal_plan: { meal_strategy: "6-meals", caloric_split: { breakfast_pct: 99 }, macro_split: { carbs_pct: 99 } },
  };
  const res = sanitizeNutritionConfigPercentsForAthlete(incoming, stored);
  assert.deepEqual(res.config.caloric_split, stored.caloric_split);
  assert.deepEqual(res.config.macro_split, stored.macro_split);
  const mealPlan = res.config.meal_plan as Record<string, unknown>;
  // meal_strategy resta scrivibile, le % no; macro_split assente nel DB → rimossa.
  assert.equal(mealPlan.meal_strategy, "6-meals");
  assert.deepEqual(mealPlan.caloric_split, { breakfast_pct: 20 });
  assert.equal("macro_split" in mealPlan, false);
  assert.equal(res.changed, true);
});

test("anti-wipe: payload vuoto/assente non cancella le % del coach (replace integrale del writer)", () => {
  const stored = {
    week_plan: { Mon: coachMon },
    caloric_split: { breakfast_pct: 30 },
    meal_plan: { caloric_split: { breakfast_pct: 20 } },
  };
  const res = sanitizeNutritionConfigPercentsForAthlete(undefined, stored);
  assert.equal(res.changed, true);
  const week = res.config.week_plan as Record<string, Record<string, unknown>>;
  assert.deepEqual(week.Mon, {
    caloric_distribution: coachMon.caloric_distribution,
    daily_macros: coachMon.daily_macros,
    meal_macro_custom: coachMon.meal_macro_custom,
  });
  assert.deepEqual(res.config.caloric_split, { breakfast_pct: 30 });
  assert.deepEqual(res.config.meal_plan, { caloric_split: { breakfast_pct: 20 } });
});

test("retro-compat: atleta senza config coach e senza % nel payload → passthrough identico", () => {
  const incoming = {
    week_plan: { Mon: { meal_count_mode: "4", day_type: "normocaloric-100" } },
    excluded_food_classes: ["dairy"],
  };
  const res = sanitizeNutritionConfigPercentsForAthlete(incoming, {});
  assert.equal(res.changed, false);
  assert.deepEqual(res.config, incoming);
});

test("payload identico al DB → changed=false (nessun warning per la UI onesta)", () => {
  const stored = { week_plan: { Mon: coachMon } };
  const incoming = { week_plan: { Mon: { ...coachMon } } };
  const res = sanitizeNutritionConfigPercentsForAthlete(incoming, stored);
  assert.equal(res.changed, false);
  assert.deepEqual(res.config, incoming);
});

test("config come stringa JSON (tolleranza JSONB) viene parsato prima dell'enforcement", () => {
  const stored = JSON.stringify({ week_plan: { Mon: coachMon } });
  const incoming = JSON.stringify({
    week_plan: { Mon: { ...coachMon, caloric_distribution: { breakfast: 99, lunch: 1, dinner: 0, snacks: 0 } } },
  });
  const res = sanitizeNutritionConfigPercentsForAthlete(incoming, stored);
  const mon = (res.config.week_plan as Record<string, Record<string, unknown>>).Mon;
  assert.deepEqual(mon.caloric_distribution, coachMon.caloric_distribution);
  assert.equal(res.changed, true);
});
