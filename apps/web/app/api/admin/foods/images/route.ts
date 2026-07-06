import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "food-images";

/**
 * GET /api/admin/foods/images
 * Lista le immagini del bucket storage `food-images` (root + cartella `fdc/`
 * dove finiscono gli upload da console, max 1000 per cartella).
 * Risposta: { ok, images: [{ name, publicUrl }] }
 */
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

  const listOptions = { limit: 1000, sortBy: { column: "name", order: "asc" as const } };
  const [rootRes, fdcRes, libRes] = await Promise.all([
    admin.storage.from(BUCKET).list("", listOptions),
    admin.storage.from(BUCKET).list("fdc", listOptions),
    admin.storage.from(BUCKET).list("library", listOptions),
  ]);
  if (rootRes.error) {
    return NextResponse.json({ ok: false as const, error: rootRes.error.message }, { status: 500 });
  }

  const toImage = (prefix: string) => (obj: { name: string }) => {
    const path = prefix ? `${prefix}/${obj.name}` : obj.name;
    return { name: path, publicUrl: admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
  };

  // Esclude sottocartelle (id null) e placeholder vuoti.
  const isFile = (obj: { id: string | null; name: string }) => obj.id !== null && !obj.name.startsWith(".");

  const images = [
    ...(rootRes.data ?? []).filter(isFile).map(toImage("")),
    ...(libRes.error ? [] : (libRes.data ?? []).filter(isFile).map(toImage("library"))),
    ...(fdcRes.error ? [] : (fdcRes.data ?? []).filter(isFile).map(toImage("fdc"))),
  ];

  return NextResponse.json({ ok: true as const, images });
}
