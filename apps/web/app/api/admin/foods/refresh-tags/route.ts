import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/foods/refresh-tags
 * Ricalcola la materialized view dei tag derivati (public.fdc_food_tagged)
 * via RPC `refresh_fdc_food_tagged`. Da chiamare dopo modifiche ai valori nutrizionali.
 */
export async function POST() {
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

  const { error } = await admin.rpc("refresh_fdc_food_tagged");
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, refreshedAt: new Date().toISOString() });
}
