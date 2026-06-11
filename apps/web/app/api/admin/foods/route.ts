import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin → Gestione Alimenti (public.fdc_food).
 * GET: lista paginata con ricerca testuale e filtro categoria.
 * PATCH: modifica campi whitelisted di un alimento.
 */

const NUMERIC_FIELDS = [
  "kcal_100g",
  "carbs_100g",
  "protein_100g",
  "fat_100g",
  "fiber_100g",
  "sugars_100g",
  "sodium_mg_100g",
] as const;

const TEXT_FIELDS = ["description", "food_category", "image_url"] as const;

const SELECT_COLUMNS =
  "fdc_id, description, food_category, kcal_100g, carbs_100g, protein_100g, fat_100g, fiber_100g, sugars_100g, sodium_mg_100g, image_url, source_dataset, refreshed_at";

/**
 * GET /api/admin/foods?q=&category=&limit=50&offset=0&include=categories
 * - q: ricerca ilike su description (con escape di % e _).
 * - category: match esatto su food_category.
 * - include=categories: aggiunge l'elenco distinct delle categorie (per i filtri a pill).
 * Risposta: { ok, foods, total, limit, offset, categories? }
 */
export async function GET(req: Request) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  const includeCategories = (url.searchParams.get("include") ?? "") === "categories";

  const limitRaw = Number(url.searchParams.get("limit") ?? 50);
  const offsetRaw = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;

  let query = admin
    .from("fdc_food")
    .select(SELECT_COLUMNS, { count: "exact" })
    .order("description", { ascending: true })
    .range(offset, offset + limit - 1);
  if (q) query = query.ilike("description", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  if (category) query = query.eq("food_category", category);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }

  /**
   * Categorie via RPC dedicata (group by sul DB): il vecchio fetch di 20k righe
   * veniva TRONCATO a 1000 da PostgREST (max-rows) → solo le prime 3 categorie
   * alfabetiche nelle pill. `selectableCount` espone l'idoneità al motore menù
   * (Baby Foods & co. restano nel DB ma sono escluse dalla generazione).
   */
  let categories: { name: string; total: number; selectableCount: number }[] | undefined;
  if (includeCategories) {
    const { data: catRows, error: catErr } = await admin.rpc("fdc_food_categories");
    if (!catErr && catRows) {
      categories = (catRows as { food_category: string; total: number; selectable_count: number }[]).map(
        (r) => ({
          name: r.food_category,
          total: Number(r.total) || 0,
          selectableCount: Number(r.selectable_count) || 0,
        }),
      );
    }
  }

  return NextResponse.json({
    ok: true as const,
    foods: data ?? [],
    total: count ?? 0,
    limit,
    offset,
    ...(categories ? { categories } : {}),
  });
}

/**
 * PATCH /api/admin/foods
 * Body: { fdcId, patch: { description?, food_category?, kcal_100g?, carbs_100g?, protein_100g?,
 *         fat_100g?, fiber_100g?, sugars_100g?, sodium_mg_100g?, image_url? } }
 * Whitelist campi + validazione numerica (>= 0). Ritorna la riga aggiornata.
 * I tag derivati (fdc_food_tagged) vanno ricalcolati a parte: POST /api/admin/foods/refresh-tags.
 */
export async function PATCH(req: Request) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    fdcId?: number | string;
    patch?: Record<string, unknown>;
  };

  const fdcId = Number(body.fdcId);
  if (!Number.isFinite(fdcId) || fdcId <= 0) {
    return NextResponse.json({ ok: false as const, error: "fdcId mancante o non valido." }, { status: 400 });
  }
  const rawPatch = body.patch;
  if (!rawPatch || typeof rawPatch !== "object" || Array.isArray(rawPatch)) {
    return NextResponse.json({ ok: false as const, error: "patch mancante." }, { status: 400 });
  }

  const update: Record<string, string | number | null> = {};

  for (const field of NUMERIC_FIELDS) {
    if (!(field in rawPatch)) continue;
    const raw = rawPatch[field];
    if (raw === null || raw === "") {
      update[field] = null;
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json(
        { ok: false as const, error: `Campo ${field}: deve essere un numero >= 0.` },
        { status: 400 },
      );
    }
    update[field] = value;
  }

  for (const field of TEXT_FIELDS) {
    if (!(field in rawPatch)) continue;
    const raw = rawPatch[field];
    if (raw !== null && typeof raw !== "string") {
      return NextResponse.json(
        { ok: false as const, error: `Campo ${field}: deve essere testo.` },
        { status: 400 },
      );
    }
    const value = typeof raw === "string" ? raw.trim() : null;
    if (field === "description" && !value) {
      return NextResponse.json(
        { ok: false as const, error: "description non può essere vuota." },
        { status: 400 },
      );
    }
    update[field] = value || null;
  }

  const fields = Object.keys(update);
  if (fields.length === 0) {
    return NextResponse.json(
      { ok: false as const, error: "Nessun campo modificabile nel patch." },
      { status: 400 },
    );
  }

  const { data, error } = await admin
    .from("fdc_food")
    .update(update)
    .eq("fdc_id", fdcId)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false as const, error: "Alimento non trovato." }, { status: 404 });
  }

  return NextResponse.json({ ok: true as const, food: data, tagsStale: true });
}
