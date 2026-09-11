/**
 * Un file Excel vero (.xlsx), senza librerie di foglio di calcolo.
 *
 * Un .xlsx è uno zip di pochi file XML. Qui si scrive il minimo che Excel, Numbers, LibreOffice
 * e Google Sheets aprono senza chiedere «riparazioni»: cartella di lavoro, stili (grassetto per
 * l'intestazione, testo a capo per le celle), un foglio per ogni tabella con la prima riga
 * bloccata e le colonne già larghe. Tutte le celle sono testo in linea: un testo che comincia
 * con «=» resta un testo, non diventa una formula.
 *
 * Pura: dipende solo da `fflate` per lo zip, gira identica nel browser e sul server.
 */
import { strToU8, zipSync } from "fflate";

export type XlsxSheet = {
  name: string;
  /** Riga 0 = intestazione (in grassetto, bloccata allo scorrimento). */
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>;
  /** Larghezza delle colonne in caratteri. */
  columnWidths?: ReadonlyArray<number>;
};

/** Excel non accetta più di 32.767 caratteri in una cella. */
const MAX_CELL_CHARS = 32_767;

/**
 * I caratteri di controllo non ammessi in XML 1.0 renderebbero il file illeggibile: si
 * tolgono. Tab (9), a capo (10) e ritorno (13) restano, sono ammessi.
 */
function cleanXmlText(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    const forbidden =
      (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0xfffe || code === 0xffff;
    if (!forbidden) out += ch;
  }
  return out;
}

export function escapeXml(s: string): string {
  return cleanXmlText(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Nome di foglio valido: niente `: \ / ? * [ ]`, massimo 31 caratteri, mai vuoto, mai doppio. */
export function sanitizeSheetName(name: string, taken: Set<string>): string {
  const base = name.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Foglio";
  let candidate = base;
  let i = 2;
  while (taken.has(candidate.toLowerCase())) {
    const suffix = ` (${i++})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

function cellXml(ref: string, value: string | number | null | undefined, style: number): string {
  if (value == null || value === "") return "";
  const text = String(value).slice(0, MAX_CELL_CHARS);
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function sheetXml(sheet: XlsxSheet): string {
  const cols = (sheet.columnWidths ?? [])
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(4, Math.min(120, w))}" customWidth="1"/>`)
    .join("");
  const rows = sheet.rows
    .map((row, r) => {
      const style = r === 0 ? 1 : 2;
      const cells = row.map((v, c) => cellXml(`${columnLetter(c)}${r + 1}`, v, style)).join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' +
    "</sheetView></sheetViews>" +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${rows}</sheetData>` +
    "</worksheet>"
  );
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const DOC_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const SHEET_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";

export function buildXlsx(sheets: ReadonlyArray<XlsxSheet>): Uint8Array {
  if (!sheets.length) throw new Error("buildXlsx: serve almeno un foglio");
  const taken = new Set<string>();
  const names = sheets.map((s) => sanitizeSheetName(s.name, taken));
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      xml +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${SHEET_CT}"/>`).join("") +
        "</Types>",
    ),
    "_rels/.rels": strToU8(
      xml +
        `<Relationships xmlns="${REL_NS}">` +
        `<Relationship Id="rId1" Type="${DOC_REL}/officeDocument" Target="xl/workbook.xml"/>` +
        "</Relationships>",
    ),
    "xl/workbook.xml": strToU8(
      xml +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${DOC_REL}"><sheets>` +
        names.map((n, i) => `<sheet name="${escapeXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
        "</sheets></workbook>",
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      xml +
        `<Relationships xmlns="${REL_NS}">` +
        sheets
          .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${DOC_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
          .join("") +
        `<Relationship Id="rId${sheets.length + 1}" Type="${DOC_REL}/styles" Target="styles.xml"/>` +
        "</Relationships>",
    ),
    "xl/styles.xml": strToU8(STYLES_XML),
  };
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s));
  });
  return zipSync(files, { level: 6 });
}
