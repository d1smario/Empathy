/**
 * Payload drag&drop del Calendario Coach (HTML5 nativo, no dnd-kit).
 *
 * Una card del pannello sinistro viene trascinata su una cella giorno×atleta: il payload
 * viaggia in `dataTransfer` sotto un MIME dedicato così da NON confondersi con drop di testo/file.
 * Due sorgenti: seduta della libreria coach (`coach-item`) o preset Empathy (`empathy-preset`).
 */
export const COACH_CALENDAR_DRAG_MIME = "application/x-empathy-coach-library";

export type CoachCalendarDragPayload =
  | { kind: "coach-item"; itemId: string; title: string }
  | { kind: "empathy-preset"; presetId: string; title: string; discipline: string };

/** Serializza il payload per `dataTransfer.setData`. */
export function encodeCoachCalendarDragPayload(payload: CoachCalendarDragPayload): string {
  return JSON.stringify(payload);
}

/** Decodifica il payload da `dataTransfer.getData`; `null` se malformato o sconosciuto. */
export function decodeCoachCalendarDragPayload(raw: string | null | undefined): CoachCalendarDragPayload | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (p.kind === "coach-item") {
    const itemId = typeof p.itemId === "string" ? p.itemId.trim() : "";
    if (!itemId) return null;
    return { kind: "coach-item", itemId, title: typeof p.title === "string" ? p.title : "" };
  }
  if (p.kind === "empathy-preset") {
    const presetId = typeof p.presetId === "string" ? p.presetId.trim() : "";
    if (!presetId) return null;
    return {
      kind: "empathy-preset",
      presetId,
      title: typeof p.title === "string" ? p.title : "",
      discipline: typeof p.discipline === "string" ? p.discipline : "",
    };
  }
  return null;
}
