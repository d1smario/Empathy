import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin → parametri di tuning del motore menù (public.nutrition_engine_config).
 * GET: lista completa. PATCH: aggiorna `value` con clamp su min/max.
 */

type ConfigRow = {
  key: string;
  value: number;
  label_it: string | null;
  description_it: string | null;
  min_value: number | null;
  max_value: number | null;
};

const SELECT_COLUMNS = "key, value, label_it, description_it, min_value, max_value";

/** GET /api/admin/engine-config → { ok, config: ConfigRow[] } */
export async function GET() {
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

  const { data, error } = await admin
    .from("nutrition_engine_config")
    .select(SELECT_COLUMNS)
    .order("key", { ascending: true });
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, config: (data ?? []) as ConfigRow[] });
}

/**
 * PATCH /api/admin/engine-config
 * Body: { key, value } — value viene clampato su [min_value, max_value] della riga.
 * Risposta: { ok, row, clamped }
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

  const body = (await req.json().catch(() => ({}))) as { key?: string; value?: number | string };
  const key = (body.key ?? "").trim();
  const valueRaw = Number(body.value);

  if (!key) {
    return NextResponse.json({ ok: false as const, error: "key mancante." }, { status: 400 });
  }
  if (!Number.isFinite(valueRaw)) {
    return NextResponse.json({ ok: false as const, error: "value non numerico." }, { status: 400 });
  }

  const { data: existing, error: readErr } = await admin
    .from("nutrition_engine_config")
    .select(SELECT_COLUMNS)
    .eq("key", key)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ ok: false as const, error: readErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ ok: false as const, error: "Parametro non trovato." }, { status: 404 });
  }

  const row = existing as ConfigRow;
  let value = valueRaw;
  if (row.min_value !== null && Number.isFinite(Number(row.min_value))) {
    value = Math.max(value, Number(row.min_value));
  }
  if (row.max_value !== null && Number.isFinite(Number(row.max_value))) {
    value = Math.min(value, Number(row.max_value));
  }

  const { data: updated, error: updErr } = await admin
    .from("nutrition_engine_config")
    .update({ value })
    .eq("key", key)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (updErr) {
    return NextResponse.json({ ok: false as const, error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true as const,
    row: updated as ConfigRow,
    clamped: value !== valueRaw,
  });
}
