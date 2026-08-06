import test from "node:test";
import assert from "node:assert/strict";
import {
  loadNutritionAthleteProfile,
  NUTRITION_ATHLETE_PROFILE_SELECT,
} from "./load-nutrition-athlete-profile";

/**
 * Mock minimale del client Supabase (stesso pattern di reduction-run.test.ts),
 * esteso per REGISTRARE la chain (select/eq/order/limit) e per iniettare errori:
 * qui il punto è proprio verificare cosa chiediamo a PostgREST e che gli errori
 * non vengano più ingoiati.
 */
type RecordedCall = {
  table: string;
  select?: string;
  eq?: [string, unknown];
  order?: [string, { ascending: boolean } | undefined];
  limit?: number;
};

type CannedResult = { data: unknown; error: { message: string } | null };

function makeDb(canned: Record<string, CannedResult>, calls: RecordedCall[]) {
  function chain(table: string): unknown {
    const call: RecordedCall = { table };
    calls.push(call);
    const res = canned[table] ?? { data: null, error: null };
    const c: Record<string, unknown> = {
      select: (cols: string) => {
        call.select = cols;
        return c;
      },
      eq: (k: string, v: unknown) => {
        call.eq = [k, v];
        return c;
      },
      order: (k: string, o?: { ascending: boolean }) => {
        call.order = [k, o];
        return c;
      },
      limit: (n: number) => {
        call.limit = n;
        return c;
      },
      maybeSingle: () => Promise.resolve(res),
    };
    return c;
  }
  return { from: (t: string) => chain(t) } as never;
}

const PROFILE_ROW = {
  birth_date: "1990-05-01",
  sex: "male",
  height_cm: 180,
  weight_kg: 74,
  body_fat_pct: 12,
  timezone: "Europe/Rome",
  routine_config: { lifestyle_activity_class: "active", meal_times: { dinner: "20:00" } },
  nutrition_config: { week_plan: {} },
  preferred_meal_count: 4,
  diet_type: "omnivore",
  supplement_config: null,
  intolerances: null,
  allergies: null,
  food_exclusions: null,
  food_preferences: null,
  supplements: null,
};

test("la select su athlete_profiles NON chiede le colonne inesistenti (ftp_watts, lifestyle_activity_class)", async () => {
  const calls: RecordedCall[] = [];
  const db = makeDb(
    {
      athlete_profiles: { data: PROFILE_ROW, error: null },
      physiological_profiles: { data: { ftp_watts: 285 }, error: null },
    },
    calls,
  );
  await loadNutritionAthleteProfile(db, "a1");

  const profileCall = calls.find((c) => c.table === "athlete_profiles");
  assert.ok(profileCall?.select, "select su athlete_profiles registrata");
  assert.ok(!/ftp_watts/.test(profileCall.select!), "niente ftp_watts nella select");
  assert.ok(!/lifestyle_activity_class/.test(profileCall.select!), "niente lifestyle_activity_class nella select");
  assert.equal(profileCall.select, NUTRITION_ATHLETE_PROFILE_SELECT);
  assert.deepEqual(profileCall.eq, ["id", "a1"]);
  // Colonne che i 5 call site consumano: devono esserci tutte.
  for (const col of [
    "birth_date", "sex", "height_cm", "weight_kg", "body_fat_pct", "timezone",
    "routine_config", "nutrition_config", "preferred_meal_count", "diet_type",
    "supplement_config", "intolerances", "allergies", "food_exclusions",
    "food_preferences", "supplements",
  ]) {
    assert.ok(profileCall.select!.includes(col), `select contiene ${col}`);
  }
});

test("ftp risolto dalla riga corrente di physiological_profiles (updated_at desc, limit 1)", async () => {
  const calls: RecordedCall[] = [];
  const db = makeDb(
    {
      athlete_profiles: { data: PROFILE_ROW, error: null },
      physiological_profiles: { data: { ftp_watts: 285 }, error: null },
    },
    calls,
  );
  const r = await loadNutritionAthleteProfile(db, "a1");

  assert.equal(r.ftpWatts, 285);
  const physCall = calls.find((c) => c.table === "physiological_profiles");
  assert.ok(physCall, "query su physiological_profiles eseguita");
  assert.deepEqual(physCall!.eq, ["athlete_id", "a1"]);
  assert.equal(physCall!.order?.[0], "updated_at");
  assert.equal(physCall!.order?.[1]?.ascending, false);
  assert.equal(physCall!.limit, 1);
});

test("ftp numeric-as-string (PostgREST) e valori non positivi", async () => {
  const asString = await loadNutritionAthleteProfile(
    makeDb(
      {
        athlete_profiles: { data: PROFILE_ROW, error: null },
        physiological_profiles: { data: { ftp_watts: "287.5" }, error: null },
      },
      [],
    ),
    "a1",
  );
  assert.equal(asString.ftpWatts, 287.5);

  const zero = await loadNutritionAthleteProfile(
    makeDb(
      {
        athlete_profiles: { data: PROFILE_ROW, error: null },
        physiological_profiles: { data: { ftp_watts: 0 }, error: null },
      },
      [],
    ),
    "a1",
  );
  assert.equal(zero.ftpWatts, null);
});

test("lifestyle estratto da routine_config.lifestyle_activity_class", async () => {
  const withClass = await loadNutritionAthleteProfile(
    makeDb({ athlete_profiles: { data: PROFILE_ROW, error: null } }, []),
    "a1",
  );
  assert.equal(withClass.lifestyleActivityClass, "active");

  const withoutClass = await loadNutritionAthleteProfile(
    makeDb(
      {
        athlete_profiles: {
          data: { ...PROFILE_ROW, routine_config: { meal_times: {} } },
          error: null,
        },
      },
      [],
    ),
    "a1",
  );
  assert.equal(withoutClass.lifestyleActivityClass, null);
  // Il resto del profilo resta disponibile anche senza lifestyle.
  assert.equal(withoutClass.profile?.weight_kg, 74);
});

test("errore query → console.error e campi null, nessun throw", async () => {
  const db = makeDb(
    {
      athlete_profiles: { data: null, error: { message: "column athlete_profiles.boom does not exist" } },
      physiological_profiles: { data: null, error: { message: "permission denied" } },
    },
    [],
  );
  const seen: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    seen.push(args.map(String).join(" "));
  };
  try {
    const r = await loadNutritionAthleteProfile(db, "athlete-err");
    assert.equal(r.profile, null);
    assert.equal(r.ftpWatts, null);
    assert.equal(r.lifestyleActivityClass, null);
  } finally {
    console.error = original;
  }
  assert.equal(seen.length, 2, "un console.error per tabella fallita");
  assert.ok(seen.some((s) => s.includes("athlete_profiles") && s.includes("athlete-err") && s.includes("does not exist")));
  assert.ok(seen.some((s) => s.includes("physiological_profiles") && s.includes("athlete-err") && s.includes("permission denied")));
});

test("profilo inesistente (data null, nessun errore) → tutto null senza log", async () => {
  const seen: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    seen.push(args.map(String).join(" "));
  };
  try {
    const r = await loadNutritionAthleteProfile(makeDb({}, []), "a-missing");
    assert.equal(r.profile, null);
    assert.equal(r.ftpWatts, null);
    assert.equal(r.lifestyleActivityClass, null);
  } finally {
    console.error = original;
  }
  assert.equal(seen.length, 0, "nessun errore loggato quando il profilo semplicemente non c'è");
});
