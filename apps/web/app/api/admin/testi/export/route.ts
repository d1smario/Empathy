import { NextResponse } from "next/server";

import { requirePlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { toCsv } from "@/lib/export/csv-writer";
import { buildXlsx } from "@/lib/export/xlsx-writer";
import { buildTextExportTable, TEXT_EXPORT_SCOPE_LABEL } from "@/lib/i18n/admin-text-export";
import { loadAdminTextItems } from "@/lib/i18n/admin-text-items";
import type { TextScope } from "@/lib/i18n/text-catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };
const SCOPES: TextScope[] = ["vetrina", "app"];

/** Data del giorno a Roma, per il nome del file: «empathy-testi-2026-09-11.xlsx». */
function romeToday(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
}

/**
 * GET /api/admin/testi/export?format=xlsx|csv — tutti i testi di vetrina e app, in tutte le
 * lingue abilitate, con le bozze non ancora pubblicate. Solo amministratori.
 *
 * - Excel: un foglio per ambito (Vetrina, App), intestazione bloccata, testo a capo.
 * - CSV: una tabella sola con la colonna «Ambito», UTF-8 con BOM (Excel legge gli accenti).
 */
export async function GET(request: Request) {
  const session = await requirePlatformAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 403, headers: NO_STORE });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false as const, error: "Manca SUPABASE_SERVICE_ROLE_KEY sul server." },
      { status: 503, headers: NO_STORE },
    );
  }

  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const loaded = await loadAdminTextItems(admin, SCOPES);
  if (!loaded.ok) {
    return NextResponse.json({ ok: false as const, error: loaded.error }, { status: 500, headers: NO_STORE });
  }

  const fileBase = `empathy-testi-${romeToday()}`;

  if (format === "csv") {
    const table = buildTextExportTable(loaded.items, loaded.locales, { includeScope: true });
    const body = toCsv([table.header, ...table.rows]);
    return new Response(body, {
      headers: {
        ...NO_STORE,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileBase}.csv"`,
      },
    });
  }

  const sheets = SCOPES.map((scope) => {
    const table = buildTextExportTable(
      loaded.items.filter((i) => i.scope === scope),
      loaded.locales,
    );
    return {
      name: TEXT_EXPORT_SCOPE_LABEL[scope] ?? scope,
      rows: [table.header, ...table.rows],
      columnWidths: table.columnWidths,
    };
  });
  // Copia su un ArrayBuffer tutto suo: la risposta vuole un BodyInit, e una vista su un buffer
  // più grande spedirebbe anche i byte che non le appartengono.
  const bytes = buildXlsx(sheets).slice().buffer as ArrayBuffer;
  return new Response(bytes, {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileBase}.xlsx"`,
    },
  });
}
