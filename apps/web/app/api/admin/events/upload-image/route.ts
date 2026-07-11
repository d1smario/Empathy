import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "event-images";
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

const ALLOWED = ["jpg", "jpeg", "png", "webp", "gif", "avif"] as const;
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function resolveExt(file: File): string | null {
  const fromName = (file.name.split(".").pop() ?? "").toLowerCase();
  if ((ALLOWED as readonly string[]).includes(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
  return MIME_TO_EXT[file.type] ?? null;
}

/**
 * POST /api/admin/events/upload-image — multipart/form-data { file }
 * Carica l'immagine di un evento su `event-images` e ritorna la public URL.
 * Riservato al platform admin (service role). Risposta: { ok, publicUrl, path }.
 */
export async function POST(req: Request) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403 });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false as const, error: "Attesa una form multipart con 'file'." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false as const, error: "Immagine troppo grande (max 6 MB)." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false as const, error: "Il file deve essere un'immagine." }, { status: 400 });
  }
  const ext = resolveExt(file);
  if (!ext) {
    return NextResponse.json({ ok: false as const, error: "Formato non supportato (jpg, png, webp, gif, avif)." }, { status: 400 });
  }

  const path = `events/${randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: true,
    cacheControl: "31536000",
  });
  if (upErr) {
    return NextResponse.json({ ok: false as const, error: upErr.message }, { status: 500 });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true as const, publicUrl: data.publicUrl, path });
}
