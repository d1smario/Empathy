/**
 * CSV secondo RFC 4180: virgola, righe CRLF, campi fra virgolette quando contengono
 * separatore, virgolette o a capo (le virgolette interne si raddoppiano).
 *
 * Il BOM iniziale non è decorativo: senza, Excel apre un CSV UTF-8 come se fosse Windows-1252
 * e ogni lettera accentata dei testi italiani diventa spazzatura.
 */
export function toCsv(
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
  opts?: { bom?: boolean },
): string {
  const escape = (raw: string | number | null | undefined): string => {
    const s = raw == null ? "" : String(raw);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((r) => r.map(escape).join(",")).join("\r\n");
  const bom = opts?.bom === false ? "" : String.fromCharCode(0xfeff);
  return bom + body + "\r\n";
}
