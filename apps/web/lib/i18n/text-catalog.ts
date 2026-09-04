/**
 * Catalogo dei testi UI per il pannello Admin → Testi.
 *
 * Nessun import server-only: lo usano sia le route admin sia (per i tipi e la
 * validazione) il client. La FONTE dei testi resta `messages/<locale>.json`;
 * qui ci sono solo gli strumenti per navigarli, classificarli e validarli.
 */

export type TextScope = "vetrina" | "app";

/**
 * Namespace del SITO PUBBLICO. I primi 7 sono esattamente quelli tradotti nei
 * file parziali (tr/de/fr); gli ultimi 3 sono pagine pubbliche presenti solo in
 * it/en. Tutto il resto è piattaforma interna → scope "app".
 */
export const VETRINA_NAMESPACES: readonly string[] = [
  "Vetrina",
  "Marketing",
  "AthleteCanvas",
  "FooterSection",
  "WatchLabSection",
  "Navbar",
  "EmpathyProMarketingDemo",
  "Pricing",
  "TerminiPage",
  "RegistratiPage",
];

const VETRINA_SET = new Set(VETRINA_NAMESPACES);

/** Lo scope si decide dal namespace di primo livello del dot-path. */
export function scopeForKey(key: string): TextScope {
  const root = key.split(".")[0] ?? "";
  return VETRINA_SET.has(root) ? "vetrina" : "app";
}

export type FlatText = {
  /** Dot-path completo, es. `Vetrina.home.heroTitle` (segmenti numerici = indici array). */
  key: string;
  value: string;
};

/**
 * Appiattisce l'albero dei messaggi in foglie stringa. Gli array diventano
 * segmenti numerici (`...audienceAthletePoints.0`), così ogni voce è indirizzabile.
 */
export function flattenMessages(tree: unknown, prefix = ""): FlatText[] {
  const out: FlatText[] = [];
  if (typeof tree === "string") {
    if (prefix) out.push({ key: prefix, value: tree });
    return out;
  }
  if (Array.isArray(tree)) {
    tree.forEach((child, i) => out.push(...flattenMessages(child, prefix ? `${prefix}.${i}` : String(i))));
    return out;
  }
  if (tree && typeof tree === "object") {
    for (const [k, v] of Object.entries(tree as Record<string, unknown>)) {
      out.push(...flattenMessages(v, prefix ? `${prefix}.${k}` : k));
    }
  }
  return out;
}

/** Legge il valore a un dot-path; `undefined` se il percorso non esiste. */
export function getMessageAtPath(tree: unknown, key: string): string | undefined {
  let node: unknown = tree;
  for (const seg of key.split(".")) {
    if (Array.isArray(node)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= node.length) return undefined;
      node = node[idx];
      continue;
    }
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[seg];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Segnaposto ICU: cattura il nome all'apertura di ogni graffa, quindi copre sia
 * `{nome}` sia le forme `{count, plural, ...}`.
 */
export function extractPlaceholders(value: string): string[] {
  return [...value.matchAll(/\{\s*([A-Za-z0-9_]+)/g)].map((m) => m[1]).sort();
}

/**
 * Tag rich-text: NON sono HTML, sono nomi risolti in codice da `t.rich` (es.
 * `<cat>`, `<tss>`, `<link>`). Eliminarne o rinominarne uno fa esplodere il render.
 */
export function extractTags(value: string): string[] {
  return [...new Set([...value.matchAll(/<\/?([A-Za-z][A-Za-z0-9]*)\s*\/?>/g)].map((m) => m[1]))].sort();
}

export type OverrideValidation = { ok: true } | { ok: false; error: string };

/**
 * Un override è valido solo se conserva ESATTAMENTE gli stessi segnaposto e tag
 * dell'originale: sono contratti col codice, non decorazioni.
 */
export function validateOverrideValue(baseValue: string, nextValue: string): OverrideValidation {
  const trimmed = nextValue.trim();
  if (!trimmed) return { ok: false, error: "Il testo non può essere vuoto." };
  if (trimmed.length > 4000) return { ok: false, error: "Il testo supera i 4000 caratteri." };

  const basePh = extractPlaceholders(baseValue).join("|");
  const nextPh = extractPlaceholders(nextValue).join("|");
  if (basePh !== nextPh) {
    return {
      ok: false,
      error: `Segnaposto alterati. L'originale usa: ${basePh || "nessuno"} — servono gli stessi, scritti uguali.`,
    };
  }

  const baseTags = extractTags(baseValue).join("|");
  const nextTags = extractTags(nextValue).join("|");
  if (baseTags !== nextTags) {
    return {
      ok: false,
      error: `Tag di formattazione alterati. L'originale usa: ${baseTags || "nessuno"} — vanno mantenuti identici.`,
    };
  }
  return { ok: true };
}
