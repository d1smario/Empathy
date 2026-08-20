import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  MENU_FOOD_POOL_KEY_SET,
  MENU_FOOD_SERVING_BASIS_SET,
} from "@/lib/nutrition/v2/menu-food-pools";
import type { AdminMenuFoodMealRoles, AdminMenuFoodRow } from "@/components/admin/foods/menu-food-types";
import {
  MENU_FOOD_ROLE_FIELDS,
  MENU_FOOD_SCORE_FIELDS,
  validateMenuFoodMealRoles,
  type MenuFoodMealRolesInput,
} from "@/lib/admin/menu-food-meal-roles-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin → Gestione Menù (public.nutrition_menu_foods): il catalogo curato che
 * alimenta i pool del motore meal-plan V2. Curazione = INSERT/UPDATE qui, niente
 * deploy. Scrittura SOLO service-role (gate platform admin), come il resto di /admin.
 *
 * Le macro NON stanno in questa tabella: arrivano da `nutrition_fdc_foods` via
 * `fdc_id`. Tra le due NON c'è foreign key dichiarata → niente embedded join
 * PostgREST → facciamo 2 query (menu + macro via `.in()` a chunk), esattamente
 * come `loadMenuFoodPools`.
 */

const NO_STORE = { "Cache-Control": "no-store" as const };

const MENU_SELECT_COLUMNS =
  "canonical_key, fdc_id, label_it, serving_basis, pool_keys, rotation_key, carb_family, is_meat, is_fish, is_animal_product, sort_priority, is_active";

// Chunk per stare sotto il limite di lunghezza URL su `.in()` (stesso valore del loader).
const FDC_IN_CHUNK = 200;

type MenuRow = {
  canonical_key: string;
  fdc_id: number;
  label_it: string;
  serving_basis: string;
  pool_keys: unknown;
  rotation_key: string | null;
  carb_family: string | null;
  is_meat: boolean | null;
  is_fish: boolean | null;
  is_animal_product: boolean | null;
  sort_priority: number | null;
  is_active: boolean | null;
};

/** Colonne v5 lette da `nutrition_menu_food_meal_roles` (stesse del loader motore + metadati). */
const MEAL_ROLES_V5_SELECT_COLUMNS =
  "canonical_key, score_breakfast, score_snack, score_lunch, score_dinner, score_pre_workout, score_post_workout, role_breakfast, role_snack, role_lunch, role_dinner, macro_role, frequency, max_week, prep_speed, source_version, updated_at";

/**
 * Colonne complete v5+v6 (migrazione 20260820090000). `substitutes` è in sola LETTURA
 * per l'admin (editing fuori scope): l'upsert non la scrive mai, quindi resta di Mario.
 */
const MEAL_ROLES_SELECT_COLUMNS = `${MEAL_ROLES_V5_SELECT_COLUMNS}, breakfast_cho_role, breakfast_protein_role, breakfast_fat_role, main_meal_role, snack_role, mediterranean_priority, substitution_group, generative_note, substitutes`;

/** 42703 = colonna inesistente: ambiente non ancora migrato alla v6 → select v5. */
function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  return (
    error != null &&
    (error.code === "42703" || /column .* does not exist|could not find the .* column/i.test(error.message ?? ""))
  );
}

type MealRolesDbRow = Record<string, unknown> & { canonical_key: string };

type FdcMacroRow = {
  fdc_id: number;
  description: string | null;
  kcal_100g: number | null;
  carbs_100g: number | null;
  protein_100g: number | null;
  fat_100g: number | null;
};

/**
 * Macro per 100 g dai fdc_id richiesti, a chunk. Esportato-nel-file (riusato da GET
 * e da POST) per non duplicare la logica della seconda query. Ritorna una mappa
 * fdc_id → riga FDC (o null se manca a DB).
 */
export async function fetchFdcMacros(
  admin: SupabaseClient,
  fdcIds: number[],
): Promise<{ map: Map<number, FdcMacroRow>; error: string | null }> {
  const map = new Map<number, FdcMacroRow>();
  const unique = [...new Set(fdcIds.filter((n) => Number.isFinite(n) && n > 0))];
  for (let i = 0; i < unique.length; i += FDC_IN_CHUNK) {
    const { data, error } = await admin
      .from("nutrition_fdc_foods")
      .select("fdc_id, description, kcal_100g, carbs_100g, protein_100g, fat_100g")
      .in("fdc_id", unique.slice(i, i + FDC_IN_CHUNK));
    if (error) return { map, error: error.message };
    for (const raw of (data ?? []) as FdcMacroRow[]) map.set(Number(raw.fdc_id), raw);
  }
  return { map, error: null };
}

/**
 * Righe di score per i canonical_key richiesti (tabella 1:1, FK → catalogo): a chunk
 * come le macro. Riusata da GET (tutti) e da PATCH/POST (una chiave). Mappa key → riga.
 */
export async function fetchMealRoles(
  admin: SupabaseClient,
  canonicalKeys: string[],
): Promise<{ map: Map<string, AdminMenuFoodMealRoles>; error: string | null }> {
  const map = new Map<string, AdminMenuFoodMealRoles>();
  const unique = [...new Set(canonicalKeys.filter((k) => typeof k === "string" && k))];
  // Retry v5 su 42703 (colonne v6 non ancora migrate): meglio una GET senza campi v6
  // che l'intero pannello alimenti rotto per una colonna in meno.
  let selectColumns = MEAL_ROLES_SELECT_COLUMNS;
  for (let i = 0; i < unique.length; i += FDC_IN_CHUNK) {
    let { data, error } = await admin
      .from("nutrition_menu_food_meal_roles")
      .select(selectColumns)
      .in("canonical_key", unique.slice(i, i + FDC_IN_CHUNK));
    if (isMissingColumnError(error) && selectColumns !== MEAL_ROLES_V5_SELECT_COLUMNS) {
      selectColumns = MEAL_ROLES_V5_SELECT_COLUMNS;
      ({ data, error } = await admin
        .from("nutrition_menu_food_meal_roles")
        .select(selectColumns)
        .in("canonical_key", unique.slice(i, i + FDC_IN_CHUNK)));
    }
    if (error) return { map, error: error.message };
    for (const raw of (data ?? []) as unknown as MealRolesDbRow[]) {
      const mapped = toAdminMealRoles(raw);
      if (mapped) map.set(raw.canonical_key, mapped);
    }
  }
  return { map, error: null };
}

/**
 * Riga DB → shape client. numeric(3,1) arriva da PostgREST come STRINGA: qui diventa
 * numero così il form non deve saperlo. Non valida (i CHECK DB garantiscono i set).
 */
export function toAdminMealRoles(raw: MealRolesDbRow | null | undefined): AdminMenuFoodMealRoles | null {
  if (!raw) return null;
  const num = (v: unknown): number => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : 0;
  };
  const numOrNull = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const out = {} as AdminMenuFoodMealRoles;
  for (const f of MENU_FOOD_SCORE_FIELDS) out[f] = num(raw[f]);
  for (const f of MENU_FOOD_ROLE_FIELDS) out[f] = String(raw[f] ?? "NONE") as AdminMenuFoodMealRoles[typeof f];
  out.macro_role = String(raw.macro_role ?? "MIXED") as AdminMenuFoodMealRoles["macro_role"];
  out.frequency = String(raw.frequency ?? "COMMON") as AdminMenuFoodMealRoles["frequency"];
  out.max_week = numOrNull(raw.max_week);
  out.prep_speed = numOrNull(raw.prep_speed);
  // v6 (colonne assenti nell'ambiente non migrato → default DB, il form parte da lì).
  out.breakfast_cho_role = String(raw.breakfast_cho_role ?? "NONE") as AdminMenuFoodMealRoles["breakfast_cho_role"];
  out.breakfast_protein_role = String(
    raw.breakfast_protein_role ?? "NONE",
  ) as AdminMenuFoodMealRoles["breakfast_protein_role"];
  out.breakfast_fat_role = String(raw.breakfast_fat_role ?? "NONE") as AdminMenuFoodMealRoles["breakfast_fat_role"];
  out.main_meal_role = String(raw.main_meal_role ?? "NONE") as AdminMenuFoodMealRoles["main_meal_role"];
  out.snack_role = String(raw.snack_role ?? "NONE") as AdminMenuFoodMealRoles["snack_role"];
  out.mediterranean_priority = String(
    raw.mediterranean_priority ?? "COMMON",
  ) as AdminMenuFoodMealRoles["mediterranean_priority"];
  out.substitution_group = typeof raw.substitution_group === "string" ? raw.substitution_group : null;
  out.generative_note = typeof raw.generative_note === "string" ? raw.generative_note : null;
  out.substitutes = Array.isArray(raw.substitutes)
    ? (raw.substitutes as unknown[]).filter((k): k is string => typeof k === "string")
    : [];
  out.source_version = typeof raw.source_version === "string" ? raw.source_version : null;
  out.updated_at = typeof raw.updated_at === "string" ? raw.updated_at : null;
  return out;
}

/**
 * UPSERT della riga di score di un alimento (ON CONFLICT canonical_key DO UPDATE):
 * source_version 'admin' e updated_at now() così si distingue la curazione a mano dal
 * refresh di Mario. Ritorna la riga salvata (shape client) o l'errore.
 */
export async function upsertMealRoles(
  admin: SupabaseClient,
  canonicalKey: string,
  value: MenuFoodMealRolesInput,
): Promise<{ mealRoles: AdminMenuFoodMealRoles | null; error: string | null }> {
  const { data, error } = await admin
    .from("nutrition_menu_food_meal_roles")
    .upsert(
      { canonical_key: canonicalKey, ...value, source_version: "admin", updated_at: new Date().toISOString() },
      { onConflict: "canonical_key" },
    )
    .select(MEAL_ROLES_SELECT_COLUMNS)
    .maybeSingle();
  if (error) return { mealRoles: null, error: error.message };
  return { mealRoles: toAdminMealRoles(data as MealRolesDbRow | null), error: null };
}

/** Mapping riga menù + macro + score → shape client `AdminMenuFoodRow` (fonte unica del contratto). */
export function toAdminMenuFoodRow(
  row: MenuRow,
  macro: FdcMacroRow | undefined,
  mealRoles: AdminMenuFoodMealRoles | null = null,
): AdminMenuFoodRow {
  const poolKeys = Array.isArray(row.pool_keys)
    ? (row.pool_keys as unknown[]).filter((k): k is string => typeof k === "string")
    : [];
  return {
    canonical_key: row.canonical_key,
    fdc_id: Number(row.fdc_id),
    label_it: row.label_it,
    // serving_basis è vincolato dal check DB: cast sicuro sul tipo whitelist.
    serving_basis: (row.serving_basis as AdminMenuFoodRow["serving_basis"]) ?? "dry_grams",
    pool_keys: poolKeys,
    rotation_key: row.rotation_key ?? null,
    carb_family: row.carb_family ?? null,
    is_meat: row.is_meat === true,
    is_fish: row.is_fish === true,
    is_animal_product: row.is_animal_product === true,
    sort_priority: typeof row.sort_priority === "number" ? row.sort_priority : 200,
    is_active: row.is_active !== false,
    macro: {
      kcal: macro?.kcal_100g ?? null,
      carbs: macro?.carbs_100g ?? null,
      protein: macro?.protein_100g ?? null,
      fat: macro?.fat_100g ?? null,
    },
    usdaDescription: macro?.description ?? null,
    meal_roles: mealRoles,
    has_meal_roles: mealRoles != null,
  };
}

/**
 * GET /api/admin/menu-foods
 * Lista TUTTE le righe (anche is_active=false: l'admin deve poter riattivare i
 * cibi disattivati) con macro joinate. `byPool` conta solo le righe ATTIVE per pool
 * (è la vista che conta per il motore). Ordine: sort_priority ASC, poi label_it ASC.
 */
export async function GET() {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503, headers: NO_STORE },
    );
  }

  const { data, error } = await admin
    .from("nutrition_menu_foods")
    .select(MENU_SELECT_COLUMNS)
    .order("sort_priority", { ascending: true })
    .order("label_it", { ascending: true });
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }

  const menuRows = (data ?? []) as MenuRow[];
  const { map: macroMap, error: macroErr } = await fetchFdcMacros(
    admin,
    menuRows.map((r) => Number(r.fdc_id)),
  );
  if (macroErr) {
    return NextResponse.json({ ok: false as const, error: macroErr }, { status: 500, headers: NO_STORE });
  }

  // Left join manuale con la tabella score: null = alimento senza grammatica.
  const { map: rolesMap, error: rolesErr } = await fetchMealRoles(
    admin,
    menuRows.map((r) => r.canonical_key),
  );
  if (rolesErr) {
    return NextResponse.json({ ok: false as const, error: rolesErr }, { status: 500, headers: NO_STORE });
  }

  const foods = menuRows.map((r) =>
    toAdminMenuFoodRow(r, macroMap.get(Number(r.fdc_id)), rolesMap.get(r.canonical_key) ?? null),
  );

  // Conta per pool solo gli attivi: la cifra rappresenta ciò che il motore vede.
  const byPool: Record<string, number> = {};
  for (const f of foods) {
    if (!f.is_active) continue;
    for (const key of f.pool_keys) byPool[key] = (byPool[key] ?? 0) + 1;
  }

  return NextResponse.json(
    { ok: true as const, foods, total: foods.length, byPool },
    { headers: NO_STORE },
  );
}

/** canonical_key deve essere snake_case (minuscole/cifre separate da `_`), non vuoto. */
const SNAKE_CASE_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

/**
 * Valida e normalizza `pool_keys` da un body: array non vuoto, tutte stringhe nella
 * whitelist degli 11 pool, deduplicate. Ritorna l'errore (stringa) o le chiavi pulite.
 * Riusata da POST e dal PATCH ([key]/route.ts la importa).
 */
export function normalizePoolKeys(raw: unknown): { keys: string[]; error: null } | { keys: null; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { keys: null, error: "pool_keys deve essere un array non vuoto." };
  }
  const keys: string[] = [];
  for (const k of raw) {
    if (typeof k !== "string" || !MENU_FOOD_POOL_KEY_SET.has(k)) {
      return { keys: null, error: `pool_keys: "${String(k)}" non è un pool valido.` };
    }
    if (!keys.includes(k)) keys.push(k);
  }
  return { keys, error: null };
}

/**
 * POST /api/admin/menu-foods — aggiunge un cibo al menù partendo da un fdc_id già
 * presente nel catalogo USDA locale. Body:
 * { canonical_key, fdc_id, label_it, serving_basis, pool_keys[],
 *   rotation_key?, carb_family?, is_meat?, is_fish?, is_animal_product?, sort_priority?,
 *   meal_roles? }
 * `meal_roles` (opzionale) crea la riga di score nello stesso giro, DOPO l'insert del
 * catalogo: se quella seconda scrittura fallisce l'alimento resta e la risposta porta
 * `warning` (meglio un alimento senza score che niente; si completa dal dialog Modifica).
 * Se `meal_roles` è presente ma NON valido → 400 prima di toccare il DB.
 */
export async function POST(req: Request) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503, headers: NO_STORE },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const canonicalKey = typeof body.canonical_key === "string" ? body.canonical_key.trim() : "";
  if (!canonicalKey || !SNAKE_CASE_RE.test(canonicalKey)) {
    return NextResponse.json(
      { ok: false as const, error: "canonical_key mancante o non snake_case." },
      { status: 400, headers: NO_STORE },
    );
  }

  const fdcId = Number(body.fdc_id);
  if (!Number.isFinite(fdcId) || fdcId <= 0) {
    return NextResponse.json(
      { ok: false as const, error: "fdc_id mancante o non valido." },
      { status: 400, headers: NO_STORE },
    );
  }

  const labelIt = typeof body.label_it === "string" ? body.label_it.trim() : "";
  if (!labelIt) {
    return NextResponse.json({ ok: false as const, error: "label_it mancante." }, { status: 400, headers: NO_STORE });
  }

  const servingBasis = typeof body.serving_basis === "string" ? body.serving_basis.trim() : "";
  if (!MENU_FOOD_SERVING_BASIS_SET.has(servingBasis)) {
    return NextResponse.json(
      { ok: false as const, error: "serving_basis non valido (dry_grams|cooked_grams|ml)." },
      { status: 400, headers: NO_STORE },
    );
  }

  const poolCheck = normalizePoolKeys(body.pool_keys);
  if (poolCheck.error) {
    return NextResponse.json({ ok: false as const, error: poolCheck.error }, { status: 400, headers: NO_STORE });
  }

  // Validazione score PRIMA dell'insert: un body incoerente non deve lasciare a metà.
  let mealRolesInput: MenuFoodMealRolesInput | null = null;
  if ("meal_roles" in body && body.meal_roles != null) {
    const check = validateMenuFoodMealRoles(body.meal_roles);
    if (!check.ok) {
      return NextResponse.json({ ok: false as const, error: check.error }, { status: 400, headers: NO_STORE });
    }
    mealRolesInput = check.value;
  }

  // Unicità canonical_key → 409 (la PK farebbe comunque fallire l'insert, ma un
  // messaggio esplicito è più utile dell'errore Postgres grezzo).
  const { data: existing, error: existErr } = await admin
    .from("nutrition_menu_foods")
    .select("canonical_key")
    .eq("canonical_key", canonicalKey)
    .maybeSingle();
  if (existErr) {
    return NextResponse.json({ ok: false as const, error: existErr.message }, { status: 500, headers: NO_STORE });
  }
  if (existing) {
    return NextResponse.json(
      { ok: false as const, error: `canonical_key "${canonicalKey}" già presente.` },
      { status: 409, headers: NO_STORE },
    );
  }

  // Il fdc_id deve ESISTERE nel catalogo USDA e avere kcal: senza macro il cibo non
  // sarebbe mai assemblabile dal motore → 422 (dato semanticamente inammissibile).
  const { map: macroMap, error: macroErr } = await fetchFdcMacros(admin, [fdcId]);
  if (macroErr) {
    return NextResponse.json({ ok: false as const, error: macroErr }, { status: 500, headers: NO_STORE });
  }
  const macro = macroMap.get(fdcId);
  // Soglia allineata a mapMenuFoodRows (menu-food-catalog-db.ts): il motore scarta
  // kcal <= 0, quindi un fdc con kcal 0/negativa (acqua/brodo) comparirebbe «attivo»
  // in admin ma verrebbe ignorato in generazione — meglio rifiutarlo qui (422).
  if (!macro || macro.kcal_100g == null || macro.kcal_100g <= 0) {
    return NextResponse.json(
      { ok: false as const, error: `fdc_id ${fdcId} assente in nutrition_fdc_foods o senza kcal utilizzabile.` },
      { status: 422, headers: NO_STORE },
    );
  }

  const insertPayload = {
    canonical_key: canonicalKey,
    fdc_id: fdcId,
    label_it: labelIt,
    serving_basis: servingBasis,
    pool_keys: poolCheck.keys,
    rotation_key: typeof body.rotation_key === "string" && body.rotation_key.trim() ? body.rotation_key.trim() : null,
    carb_family: typeof body.carb_family === "string" && body.carb_family.trim() ? body.carb_family.trim() : null,
    is_meat: body.is_meat === true,
    is_fish: body.is_fish === true,
    is_animal_product: body.is_animal_product === true,
    sort_priority:
      typeof body.sort_priority === "number" && Number.isFinite(body.sort_priority)
        ? Math.trunc(body.sort_priority)
        : 200,
  };

  const { data, error } = await admin
    .from("nutrition_menu_foods")
    .insert(insertPayload)
    .select(MENU_SELECT_COLUMNS)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }
  if (!data) {
    return NextResponse.json({ ok: false as const, error: "Insert non riuscito." }, { status: 500, headers: NO_STORE });
  }

  let mealRoles: AdminMenuFoodMealRoles | null = null;
  let warning: string | null = null;
  if (mealRolesInput) {
    const saved = await upsertMealRoles(admin, canonicalKey, mealRolesInput);
    if (saved.error) {
      // L'alimento è già nel catalogo: lo diciamo, non lo annulliamo.
      warning = `Alimento aggiunto, ma il salvataggio di ruoli/punteggi non è riuscito: ${saved.error}. Completali da «Modifica».`;
    } else {
      mealRoles = saved.mealRoles;
    }
  }

  const food = toAdminMenuFoodRow(data as MenuRow, macro, mealRoles);
  return NextResponse.json({ ok: true as const, food, warning }, { headers: NO_STORE });
}
