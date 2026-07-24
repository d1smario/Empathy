/**
 * Microciclo VIRYA deterministico: pattern giorni Lun–Dom, ripartizione carico Q/V, budget settimanale.
 */

import type {
  ViryaMacroPhase,
  ViryaSessionRole,
  ViryaSportFamily,
  ViryaWeekdayPatternId,
} from "@/lib/training/virya/virya-builder-session-brief";
import { normalizeWeeklyLoad } from "@/lib/training/virya/virya-load-normalize";

// Riconciliazione carichi estratta in virya-load-normalize (condivisa col motore
// L2 bundle-abile, che NON può importare questo file: qui vive la copia hardcoded
// di pattern/sequenze/pesi che il blueprint esclude dal bundle). Re-export per
// compatibilità con i consumer storici.
export { normalizeWeeklyLoad };

export type ViryaMicrocycleSlotPlan = {
  weekdayOffset: number;
  slotIndex: number;
  loadTarget: number;
  sessionRole: ViryaSessionRole;
};

export type ViryaWeekGenerationPlan = {
  patternId: ViryaWeekdayPatternId;
  weekdayOffsets: number[];
  weeklyBudgetLoad: number;
  slots: ViryaMicrocycleSlotPlan[];
  loadSum: number;
};

/** Giorni allenamento (offset da lunedì weekStart). */
export const VIRYA_WEEKDAY_PATTERN_OFFSETS: Record<ViryaWeekdayPatternId, readonly number[]> = {
  "3d": [0, 2, 4],
  "4d": [0, 2, 4, 6],
  "5d": [0, 1, 3, 4, 6],
  "6d": [0, 1, 2, 3, 4, 5],
};

const ROLE_SEQUENCES: Record<number, ViryaSessionRole[]> = {
  1: ["quality"],
  2: ["quality", "volume"],
  3: ["quality", "volume", "quality"],
  4: ["quality", "volume", "volume", "quality"],
  5: ["quality", "volume", "quality", "volume", "quality"],
  6: ["quality", "volume", "quality", "volume", "volume", "quality"],
  7: ["quality", "volume", "quality", "volume", "quality", "volume", "quality"],
};

function roleWeight(role: ViryaSessionRole, phase: ViryaMacroPhase): number {
  if (role === "recovery") return phase === "deload" ? 0.35 : 0.45;
  if (role === "quality") {
    if (phase === "deload") return 0.85;
    if (phase === "peak" || phase === "build") return 1.32;
    return 1.22;
  }
  if (phase === "deload") return 0.5;
  return 0.58;
}

export function defaultWeekdayPatternForSessions(sessionCount: number): ViryaWeekdayPatternId {
  const n = Math.max(1, Math.min(7, Math.round(sessionCount) || 1));
  if (n <= 3) return "3d";
  if (n === 4) return "4d";
  if (n === 5) return "5d";
  return "6d";
}

export function resolveWeekdayOffsets(
  sessionsPerWeek: number,
  patternId?: ViryaWeekdayPatternId,
): { patternId: ViryaWeekdayPatternId; offsets: number[] } {
  const n = Math.max(1, Math.min(7, Math.round(sessionsPerWeek) || 1));
  const pid = patternId ?? defaultWeekdayPatternForSessions(n);
  const template = [...VIRYA_WEEKDAY_PATTERN_OFFSETS[pid]];
  const offsets = template.slice(0, n);
  while (offsets.length < n) {
    offsets.push(template[template.length - 1] ?? 0);
  }
  return { patternId: pid, offsets };
}

export function sessionRolesForWeek(sessionCount: number, phase: ViryaMacroPhase): ViryaSessionRole[] {
  const n = Math.max(1, Math.min(7, Math.round(sessionCount) || 1));
  const seq = ROLE_SEQUENCES[n] ?? ROLE_SEQUENCES[5]!;
  if (phase === "deload") {
    return seq.map((r, i) => (i % 2 === 1 ? "recovery" : "volume"));
  }
  return seq;
}

export function distributeWeeklyLoad(input: {
  weeklyBudgetLoad: number;
  roles: ViryaSessionRole[];
  phase: ViryaMacroPhase;
}): number[] {
  const budget = Math.max(0, Math.round(input.weeklyBudgetLoad));
  const roles = input.roles;
  if (!roles.length) return [];
  const weights = roles.map((r) => roleWeight(r, input.phase));
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (budget * w) / sumW);
  return normalizeWeeklyLoad(raw.map((x) => Math.max(1, Math.round(x))), budget);
}

export function buildWeekGenerationPlan(input: {
  weeklyBudgetLoad: number;
  sessionsPerWeek: number;
  phase: ViryaMacroPhase;
  family: ViryaSportFamily;
  patternId?: ViryaWeekdayPatternId;
}): ViryaWeekGenerationPlan {
  const weeklyBudgetLoad = Math.max(0, Math.round(input.weeklyBudgetLoad));
  const { patternId, offsets: weekdayOffsets } = resolveWeekdayOffsets(
    input.sessionsPerWeek,
    input.patternId,
  );
  const roles = sessionRolesForWeek(weekdayOffsets.length, input.phase);
  const loads = distributeWeeklyLoad({ weeklyBudgetLoad, roles, phase: input.phase });
  const slots: ViryaMicrocycleSlotPlan[] = weekdayOffsets.map((weekdayOffset, slotIndex) => ({
    weekdayOffset,
    slotIndex,
    loadTarget: loads[slotIndex] ?? Math.max(1, Math.round(weeklyBudgetLoad / weekdayOffsets.length)),
    sessionRole: roles[slotIndex] ?? "volume",
  }));
  const loadSum = slots.reduce((a, s) => a + s.loadTarget, 0);
  return { patternId, weekdayOffsets, weeklyBudgetLoad, slots, loadSum };
}
