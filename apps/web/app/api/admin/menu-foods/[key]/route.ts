import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MENU_FOOD_SERVING_BASIS_SET } from "@/lib/nutrition/v2/menu-food-pools";
import { fetchFdcMacros, normalizePoolKeys, toAdminMenuFoodRow } from "../route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin → Gestione Menù, riga singola (canonical_key = [key]).
 * PATCH: aggiorna i campi whitelisted; DELETE: rimuove la riga.
 * Il fdc_id NON è modificabile (cambierebbe l'identità del cibo → si crea una riga
 * nuova via POST e si elimina la vecchia).
 */

const NO_STORE = { "Cache-Control": "no-store" as const };

const MENU_SELECT_COLUMNS =
  "canonical_key, fdc_id, label_it, serving_basis, pool_keys, rotation_key, carb_family, is_meat, is_fish, is_animal_product, sort_priority, is_active";

/** PATCH /api/admin/menu-foods/[key] — aggiorna campi whitelisted della riga. */
export async function PATCH(req: Request, { params }: { params: { key: string } }) {
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
  const key = (params.key ?? "").trim();
  if (!key) {
    return NextResponse.json({ ok: false as const, error: "key mancante." }, { status: 400, headers: NO_STORE });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const update: Record<string, unknown> = {};

  if ("label_it" in body) {
    if (typeof body.label_it !== "string" || !body.label_it.trim()) {
      return NextResponse.json(
        { ok: false as const, error: "label_it non può essere vuota." },
        { status: 400, headers: NO_STORE },
      );
    }
    update.label_it = body.label_it.trim();
  }

  if ("serving_basis" in body) {
    const sb = typeof body.serving_basis === "string" ? body.serving_basis.trim() : "";
    if (!MENU_FOOD_SERVING_BASIS_SET.has(sb)) {
      return NextResponse.json(
        { ok: false as const, error: "serving_basis non valido (dry_grams|cooked_grams|ml)." },
        { status: 400, headers: NO_STORE },
      );
    }
    update.serving_basis = sb;
  }

  if ("pool_keys" in body) {
    const poolCheck = normalizePoolKeys(body.pool_keys);
    if (poolCheck.error) {
      return NextResponse.json({ ok: false as const, error: poolCheck.error }, { status: 400, headers: NO_STORE });
    }
    update.pool_keys = poolCheck.keys;
  }

  // rotation_key / carb_family: stringa non vuota o null (svuotare = null esplicito).
  for (const field of ["rotation_key", "carb_family"] as const) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (raw !== null && typeof raw !== "string") {
      return NextResponse.json(
        { ok: false as const, error: `${field}: deve essere testo o null.` },
        { status: 400, headers: NO_STORE },
      );
    }
    update[field] = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }

  for (const field of ["is_meat", "is_fish", "is_animal_product", "is_active"] as const) {
    if (!(field in body)) continue;
    if (typeof body[field] !== "boolean") {
      return NextResponse.json(
        { ok: false as const, error: `${field}: deve essere booleano.` },
        { status: 400, headers: NO_STORE },
      );
    }
    update[field] = body[field];
  }

  if ("sort_priority" in body) {
    const sp = Number(body.sort_priority);
    if (!Number.isFinite(sp)) {
      return NextResponse.json(
        { ok: false as const, error: "sort_priority: deve essere un numero." },
        { status: 400, headers: NO_STORE },
      );
    }
    update.sort_priority = Math.trunc(sp);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { ok: false as const, error: "Nessun campo da aggiornare." },
      { status: 400, headers: NO_STORE },
    );
  }

  const { data, error } = await admin
    .from("nutrition_menu_foods")
    .update(update)
    .eq("canonical_key", key)
    .select(MENU_SELECT_COLUMNS)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }
  if (!data) {
    return NextResponse.json({ ok: false as const, error: "Cibo del menù non trovato." }, { status: 404, headers: NO_STORE });
  }

  // Macro joinate nella risposta così il client aggiorna la riga senza rifare la GET.
  const row = data as Parameters<typeof toAdminMenuFoodRow>[0];
  const { map: macroMap } = await fetchFdcMacros(admin, [Number(row.fdc_id)]);
  const food = toAdminMenuFoodRow(row, macroMap.get(Number(row.fdc_id)));
  return NextResponse.json({ ok: true as const, food }, { headers: NO_STORE });
}

/** DELETE /api/admin/menu-foods/[key] — elimina la riga del menù. */
export async function DELETE(_req: Request, { params }: { params: { key: string } }) {
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
  const key = (params.key ?? "").trim();
  if (!key) {
    return NextResponse.json({ ok: false as const, error: "key mancante." }, { status: 400, headers: NO_STORE });
  }

  const { error } = await admin.from("nutrition_menu_foods").delete().eq("canonical_key", key);
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true as const }, { headers: NO_STORE });
}
