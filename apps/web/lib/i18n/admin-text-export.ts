/**
 * La tabella che finisce nell'esportazione dei testi (Excel e CSV).
 *
 * Una riga per chiave. Per ogni lingua, IL TESTO CHE IL SITO MOSTRA ADESSO: il pubblicato se
 * c'è, altrimenti l'originale del repo. Vuoto quando la lingua non ha un suo testo — lì il sito
 * mostra l'inglese, e una cella vuota dice «da tradurre» meglio di un inglese ricopiato. Le
 * bozze non ancora pubblicate stanno in una colonna a parte: non sono online, ma chi lavora sui
 * testi deve vederle.
 *
 * Pura: importa solo tipi.
 */
import type { AdminTextItem, AdminTextLocaleValue } from "@/lib/i18n/admin-text-items";

export const TEXT_EXPORT_SCOPE_LABEL: Record<string, string> = {
  vetrina: "Vetrina",
  app: "App",
};

/** Il testo che il sito mostra adesso in quella lingua; "" se la lingua non ha un suo testo. */
export function onlineTextValue(v: AdminTextLocaleValue | undefined): string {
  if (!v) return "";
  if (v.published !== null) return v.published;
  return v.isFallback ? "" : v.base;
}

/** Le bozze non pubblicate, una per riga: «IT: …». Vuoto se non ce ne sono. */
export function pendingDraftsText(item: AdminTextItem, locales: readonly string[]): string {
  const lines: string[] = [];
  for (const loc of locales) {
    const v = item.values[loc];
    if (v && v.draft !== null && v.draft !== v.published) lines.push(`${loc.toUpperCase()}: ${v.draft}`);
  }
  return lines.join("\n");
}

export type TextExportTable = { header: string[]; rows: string[][]; columnWidths: number[] };

export function buildTextExportTable(
  items: readonly AdminTextItem[],
  locales: readonly string[],
  opts?: { includeScope?: boolean },
): TextExportTable {
  const withScope = opts?.includeScope === true;
  const header = [
    ...(withScope ? ["Ambito"] : []),
    "Sezione",
    "Chiave",
    ...locales.map((l) => l.toUpperCase()),
    "Bozze non pubblicate",
  ];
  const rows = items.map((item) => [
    ...(withScope ? [TEXT_EXPORT_SCOPE_LABEL[item.scope] ?? item.scope] : []),
    item.namespace,
    item.key,
    ...locales.map((loc) => onlineTextValue(item.values[loc])),
    pendingDraftsText(item, locales),
  ]);
  const columnWidths = [...(withScope ? [10] : []), 26, 46, ...locales.map(() => 60), 48];
  return { header, rows, columnWidths };
}
