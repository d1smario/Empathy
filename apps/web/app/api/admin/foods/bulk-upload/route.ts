import { NextResponse } from "next/server";
import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "food-images";
const LIBRARY_PREFIX = "library";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per file
const MAX_FILES = 200;

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "avif"] as const;
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function resolveExtension(file: File): string | null {
  const fromName = (file.name.split(".").pop() ?? "").toLowerCase();
  if ((ALLOWED_EXTENSIONS as readonly string[]).includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  return MIME_TO_EXT[file.type] ?? null;
}

/** Nome file → slug sicuro (mantiene leggibilità: `Pollo Petto.jpg` → `pollo-petto`). */
function slugFromName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return (
    base
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "img"
  );
}

/**
 * POST /api/admin/foods/bulk-upload — multipart/form-data { files: File[] }
 * Carica in blocco una LIBRERIA di immagini nel bucket `food-images/library/`.
 * Non tocca nessun alimento: popola solo il bucket, così poi in ogni scheda si
 * usa «Seleziona dal bucket» invece di caricare una a una.
 * Risposta: { ok, uploaded: [{ name, publicUrl }], failed: [{ name, error }] }
 */
export async function POST(req: Request) {
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

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { ok: false as const, error: "Body non valido: attesa una form multipart/form-data." },
      { status: 400 },
    );
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) {
    return NextResponse.json({ ok: false as const, error: "Nessun file ricevuto." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { ok: false as const, error: `Troppi file in una volta: massimo ${MAX_FILES}.` },
      { status: 400 },
    );
  }

  const uploaded: { name: string; publicUrl: string }[] = [];
  const failed: { name: string; error: string }[] = [];
  const usedSlugs = new Set<string>();

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      failed.push({ name: file.name, error: "non è un'immagine" });
      continue;
    }
    if (file.size > MAX_BYTES) {
      failed.push({ name: file.name, error: "oltre 5 MB" });
      continue;
    }
    const ext = resolveExtension(file);
    if (!ext) {
      failed.push({ name: file.name, error: "formato non supportato" });
      continue;
    }
    // Slug unico dentro questo batch (evita che due file omonimi si sovrascrivano).
    let slug = slugFromName(file.name);
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${slugFromName(file.name)}-${n++}`;
    usedSlugs.add(slug);

    const path = `${LIBRARY_PREFIX}/${slug}.${ext}`;
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
        contentType: file.type,
        upsert: true,
      });
      if (error) {
        failed.push({ name: file.name, error: error.message });
        continue;
      }
      const publicUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      uploaded.push({ name: path, publicUrl });
    } catch (e) {
      failed.push({ name: file.name, error: e instanceof Error ? e.message : "upload fallito" });
    }
  }

  return NextResponse.json({ ok: true as const, uploaded, failed });
}
