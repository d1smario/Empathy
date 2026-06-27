/**
 * Virya Annual Plan kit — regione PURA estratta da ViryaAnnualPlanOrchestrator.
 *
 * Contiene esclusivamente tipi, costanti e funzioni helper PURE (zero React, JSX
 * o stato) usate dall'orchestratore del piano annuale Virya. È stato scorporato
 * dal God-component `ViryaAnnualPlanOrchestrator.tsx` per decomporlo: il
 * componente importa da qui invece di dichiarare tutto inline.
 *
 * VERBATIM: ogni dichiarazione è copiata identica dal componente sorgente; l'unica
 * modifica è l'aggiunta di `export` davanti a ciascuna. Questo modulo NON deve
 * importare dal componente (no cicli): solo da lib/contracts/types.
 */
import { addIsoDays } from "@/lib/dates/iso-day-arithmetic";
import {
  LIFESTYLE_DISCIPLINES,
  TECHNICAL_SPORT_DISCIPLINES,
} from "@/lib/training/libraries";
import type {
  LifestyleDayModule,
  TechnicalDayModule,
} from "@/lib/training/virya/virya-day-module-types";

export type PhaseType = "base" | "build" | "refine" | "peak" | "deload" | "second_peak";
export type RaceType = "warmup" | "test" | "goal" | "milestone";

/** Obiettivi focali settimanali (tabella programma). */
export type WeekObjectiveKey =
  | "forza"
  | "aerobico"
  | "anaerobico"
  | "lattato"
  | "sprint_agilita"
  | "neuromotorio"
  | "tecnico_tattico"
  | "recupero";

export type ViryaRetuneProposalWeek = {
  weekStart: string;
  week: number;
  phase: string;
  currentTss: number;
  proposedTss: number;
  currentSessions: number;
  proposedSessions: number;
  objectives: WeekObjectiveKey[];
  rationale: string[];
};

export type ViryaRetuneProposal = {
  mode: string;
  status: "idle" | "automatic";
  targetWeeks: ViryaRetuneProposalWeek[];
  adaptationControlPct: 0 | 50 | 70 | 100;
  approvalPolicy: "automatic_by_data_with_coach_policy";
};

export const WEEK_FOCUS_OPTIONS: { id: WeekObjectiveKey; label: string }[] = [
  { id: "forza", label: "Forza" },
  { id: "aerobico", label: "Aerobico" },
  { id: "anaerobico", label: "Anaerobico" },
  { id: "lattato", label: "Lattato" },
  { id: "sprint_agilita", label: "Sprint / agilità" },
  { id: "neuromotorio", label: "Neuromotorio" },
  { id: "tecnico_tattico", label: "Tecnico-tattico" },
  { id: "recupero", label: "Recupero" },
];

/** Stili chip attivo/off per contrasto rosa / arancio su fondo scuro. */
export const WEEK_FOCUS_CHIP_STYLES: Record<WeekObjectiveKey, { on: string; off: string }> = {
  forza: {
    on: "border-fuchsia-400 bg-fuchsia-500/35 text-fuchsia-50 shadow-[0_0_14px_rgba(232,121,249,0.35)]",
    off: "border-fuchsia-500/25 bg-black/50 text-fuchsia-200/35 hover:border-fuchsia-400/45 hover:text-fuchsia-200/70",
  },
  aerobico: {
    on: "border-orange-400 bg-orange-500/35 text-orange-50 shadow-[0_0_14px_rgba(251,146,60,0.35)]",
    off: "border-orange-500/25 bg-black/50 text-orange-200/35 hover:border-orange-400/45 hover:text-orange-200/70",
  },
  anaerobico: {
    on: "border-rose-400 bg-rose-500/35 text-rose-50 shadow-[0_0_14px_rgba(251,113,133,0.35)]",
    off: "border-rose-500/25 bg-black/50 text-rose-200/35 hover:border-rose-400/45 hover:text-rose-200/70",
  },
  lattato: {
    on: "border-pink-400 bg-pink-500/30 text-pink-50 shadow-[0_0_14px_rgba(244,114,182,0.35)]",
    off: "border-pink-500/25 bg-black/50 text-pink-200/35 hover:border-pink-400/45 hover:text-pink-200/70",
  },
  sprint_agilita: {
    on: "border-amber-400 bg-amber-500/30 text-amber-50 shadow-[0_0_14px_rgba(251,191,36,0.35)]",
    off: "border-amber-500/25 bg-black/50 text-amber-200/35 hover:border-amber-400/45 hover:text-amber-200/70",
  },
  neuromotorio: {
    on: "border-violet-400 bg-violet-500/35 text-violet-50 shadow-[0_0_14px_rgba(167,139,250,0.35)]",
    off: "border-violet-500/25 bg-black/50 text-violet-200/35 hover:border-violet-400/45 hover:text-violet-200/70",
  },
  tecnico_tattico: {
    on: "border-cyan-400 bg-cyan-500/25 text-cyan-50 shadow-[0_0_14px_rgba(34,211,238,0.28)]",
    off: "border-cyan-600/30 bg-black/50 text-cyan-200/35 hover:border-cyan-400/45 hover:text-cyan-200/70",
  },
  recupero: {
    on: "border-emerald-400 bg-emerald-500/25 text-emerald-50 shadow-[0_0_14px_rgba(52,211,153,0.28)]",
    off: "border-emerald-600/30 bg-black/50 text-emerald-200/35 hover:border-emerald-400/45 hover:text-emerald-200/70",
  },
};
export type SportFamily = "aerobic" | "strength" | "technical" | "lifestyle";
export type GymPrimaryGoal = "massa" | "forza" | "potenza" | "rapidita" | "definizione" | "resistenza";
export type GymMacroObjective =
  | "forza"
  | "massa"
  | "definizione"
  | "potenza"
  | "ipertrofia_miofibrillare"
  | "ipertrofia_sarcoplasmatica"
  | "neuromuscolare"
  | "posturale"
  | "stretching"
  | "mobilita";

export type PhasePlan = {
  id: string;
  start: string;
  end: string;
  phase: PhaseType;
  macroObjective?: string;
  mesocycle: string;
  weeklyTss: number;
  sessionsPerWeek: number;
  notes: string;
};

export type RacePlan = {
  id: string;
  date: string;
  name: string;
  raceType: RaceType;
  priority: "A" | "B" | "C";
};

export type GoalTargets = {
  distanceKm: number | null;
  durationMin: number | null;
  speedAvgKmh: number | null;
  powerAvgW: number | null;
  elevationM: number | null;
  workKj: number | null;
};

export type MultiSportTarget = {
  sport: string;
  loadSharePct: number | null;
  distanceKm: number | null;
  durationMin: number | null;
  speedAvgKmh: number | null;
  powerAvgW: number | null;
  elevationM: number | null;
  workKj: number | null;
};

/** Etichetta prodotto per carico pianificato (campo DB resta `tss_target`). */
export const VIRYA_LOAD_LABEL = "Carico di lavoro";
export const VIRYA_LOAD_SHORT = "Carico";

export const phaseLabels: Record<PhaseType, string> = {
  base: "Base",
  build: "Costruzione",
  refine: "Rifinitura",
  peak: "Forma",
  deload: "Scarico",
  second_peak: "Secondo picco",
};

export const sportFamilies: { id: SportFamily; label: string; sports: string[] }[] = [
  {
    id: "aerobic",
    label: "A · Sport aerobico / anaerobico",
    sports: ["Ciclismo", "Running", "MTB", "Gravel", "Triathlon", "Nuoto", "XC Ski", "Alpinismo", "Canoa"],
  },
  {
    id: "strength",
    label: "B · Gym & Performance",
    sports: ["Gym", "Hyrox", "Crossfit", "Powerlifting"],
  },
  {
    id: "technical",
    label: "C · Sport tecnici / tattici",
    sports: [...TECHNICAL_SPORT_DISCIPLINES],
  },
  {
    id: "lifestyle",
    label: "D · Lifestyle",
    sports: [...LIFESTYLE_DISCIPLINES],
  },
];
export const allSports = Array.from(new Set(sportFamilies.flatMap((f) => f.sports)));
export const gymGoalLabels: Array<{ id: GymPrimaryGoal; label: string }> = [
  { id: "massa", label: "Massa" },
  { id: "forza", label: "Forza" },
  { id: "potenza", label: "Potenza" },
  { id: "rapidita", label: "Rapidita" },
  { id: "definizione", label: "Definizione" },
  { id: "resistenza", label: "Resistenza" },
];
export const gymMacroObjectiveLabels: Array<{ id: GymMacroObjective; label: string }> = [
  { id: "forza", label: "Forza" },
  { id: "massa", label: "Massa" },
  { id: "definizione", label: "Definizione" },
  { id: "potenza", label: "Potenza" },
  { id: "ipertrofia_miofibrillare", label: "Ipertrofia miofibrillare" },
  { id: "ipertrofia_sarcoplasmatica", label: "Ipertrofia sarcoplasmatica" },
  { id: "neuromuscolare", label: "Neuromuscolare" },
  { id: "posturale", label: "Posturale" },
  { id: "stretching", label: "Stretching" },
  { id: "mobilita", label: "Mobilita" },
];
export const gymDistrictOptions = [
  "Petto",
  "Spalle",
  "Dorsali",
  "Schiena",
  "Addominali",
  "Gambe",
  "Polpacci",
  "Glutei",
  "Femorali",
  "Quadricipiti",
  "Braccia",
  "Avambraccia",
  "Full body",
  "Total body",
];
export const gymDistrictObjectiveOptions = [
  "Forza",
  "Massa",
  "Definizione",
  "Potenza",
  "Neuromuscolare",
  "Posturale",
  "Stretching",
  "Mobilita",
];
export const gymExerciseTypeOptions = ["Corpo libero", "Pesi", "Macchine", "Cavi", "Isometrico", "Pliometria", "Crossfit", "Hyrox"];
export const gymMethodologyOptions = [
  "Lento controllato",
  "Max velocita",
  "Superserie",
  "Discesa lenta",
  "Spinta veloce",
  "Isometrico",
  "Pliometrico",
  "Circuito",
];
export const technicalObjectiveOptions = [
  "Condizione fisica",
  "Aerobico",
  "Anaerobico",
  "Velocita",
  "Forza",
  "Recupero",
  "Tecnica con modulo",
  "Fase offensiva",
  "Fase difensiva",
  "Schemi",
  "Partita",
];
export const technicalExerciseTypeOptions = [
  "Riscaldamento tecnico",
  "Rondo/possesso",
  "Lavoro tecnico individuale",
  "Situazionale",
  "Small sided game",
  "Lavoro tattico a reparti",
  "Transizioni",
  "Partita a tema",
  "Partita libera",
  "Defaticamento",
];
export const technicalIntensityOptions = ["Bassa", "Media", "Alta", "Massimale"];
export const technicalMethodologyOptions = [
  "Progressivo",
  "Intermittente",
  "Blocco tecnico",
  "Blocco tattico",
  "Circuito",
  "Partita condizionata",
];
export const lifestyleObjectiveOptions = [
  "Recupero autonomico",
  "Mobilita articolare",
  "Flessibilita",
  "Core stability",
  "Controllo posturale",
  "Riduzione stress",
  "Controllo respiratorio",
  "Consapevolezza corporea",
];
export const lifestylePracticeOptions = ["Yoga Hatha", "Yoga Vinyasa", "Yoga Yin", "Pilates Mat", "Pilates Reformer", "Breathwork", "Meditazione guidata", "Mobility flow"];
export const lifestyleBreathingOptions = ["Naso 4:6", "Naso 5:5", "Box 4:4:4:4", "Diaframmatica lenta", "Coerenza 6:6"];
export const lifestyleHoldFlowOptions = ["Tenute 20-40s", "Tenute 45-90s", "Flow continuo", "Flow + pause", "Isometrie respirate"];
export const lifestyleMethodologyOptions = ["Progressivo", "Rigenerativo", "Tecnica controllata", "Mind-body", "Recovery focus"];

export function sportIcon(name: string): string {
  const map: Record<string, string> = {
    Ciclismo: "🚴",
    Running: "🏃",
    MTB: "🚵",
    Gravel: "🚴",
    Triathlon: "🏊",
    Nuoto: "🏊",
    "XC Ski": "⛷️",
    Alpinismo: "🧗",
    Canoa: "🚣",
    Gym: "🏋️",
    Hyrox: "💥",
    Crossfit: "🔥",
    Powerlifting: "🏋️",
    Calcio: "⚽",
    Tennis: "🎾",
    Pallavolo: "🏐",
    Basket: "🏀",
    Boxe: "🥊",
    Karate: "🥋",
    Judo: "🥋",
    "Muay Thai": "🥊",
    Yoga: "🧘",
    Meditazione: "🧠",
    Pilates: "🤸",
    Breathwork: "🫁",
    Mobility: "🌀",
  };
  return map[name] ?? "•";
}

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  return addIsoDays(dateStr, days);
}

export function weeksBetween(a: string, b: string): number {
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.max(1, Math.ceil((end - start + 1) / (1000 * 60 * 60 * 24 * 7)));
}

/** Durata predefinita passo 3 (piano medio-corto). */
export const DEFAULT_AEROBIC_PLAN_WEEKS = 12;

export function planWindowEndForWeeks(start: string, weeks: number): string {
  return addDays(start, Math.max(1, weeks) * 7 - 1);
}

export function aerobicPhasesMatchWindow(phases: PhasePlan[], windowStart: string, windowEnd: string): boolean {
  if (!phases.length || !windowStart || !windowEnd) return false;
  return (
    phases[0]!.start === windowStart &&
    phases[phases.length - 1]!.end === windowEnd &&
    weeksBetween(phases[0]!.start, phases[phases.length - 1]!.end) === weeksBetween(windowStart, windowEnd)
  );
}

export function phaseColor(phase: PhaseType): string {
  const map: Record<PhaseType, string> = {
    base: "#00c2ff",
    build: "#00e08d",
    refine: "#ffd60a",
    peak: "#ff9e00",
    deload: "#9ca3af",
    second_peak: "#ff00a8",
  };
  return map[phase];
}

/** Sfondo riga / tint input da fase (hex + alpha 8 cifre). */
export function phaseRowBackground(phase: PhaseType): string {
  return `${phaseColor(phase)}18`;
}

export function phaseCellBorder(phase: PhaseType): string {
  return `${phaseColor(phase)}55`;
}

export function tssColor(tss: number): string {
  if (tss >= 560) return "#ff00a8";
  if (tss >= 500) return "#ff9e00";
  if (tss >= 420) return "#ffd60a";
  if (tss >= 300) return "#00e08d";
  return "#9ca3af";
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function demandScore(target: GoalTargets) {
  const distanceScore = target.distanceKm != null ? clamp(target.distanceKm / 180, 0, 1.6) : 0;
  const durationScore = target.durationMin != null ? clamp(target.durationMin / 360, 0, 1.6) : 0;
  const speedScore = target.speedAvgKmh != null ? clamp(target.speedAvgKmh / 34, 0, 1.5) : 0;
  const powerScore = target.powerAvgW != null ? clamp(target.powerAvgW / 280, 0, 1.6) : 0;
  const elevationScore = target.elevationM != null ? clamp(target.elevationM / 2500, 0, 1.4) : 0;
  const workScore = target.workKj != null ? clamp(target.workKj / 2600, 0, 1.6) : 0;

  const weighted =
    0.2 * distanceScore +
    0.15 * durationScore +
    0.18 * speedScore +
    0.22 * powerScore +
    0.1 * elevationScore +
    0.15 * workScore;
  return clamp(weighted, 0.25, 1.7);
}

export function targetSummary(target: GoalTargets) {
  const bits: string[] = [];
  if (target.distanceKm != null) bits.push(`${target.distanceKm}km`);
  if (target.durationMin != null) bits.push(`${target.durationMin}min`);
  if (target.speedAvgKmh != null) bits.push(`${target.speedAvgKmh}kmh`);
  if (target.powerAvgW != null) bits.push(`${target.powerAvgW}W`);
  if (target.elevationM != null) bits.push(`${target.elevationM}m D+`);
  if (target.workKj != null) bits.push(`${target.workKj}kJ`);
  return bits.length ? bits.join(" · ") : "target non specificato";
}

export function emptyTargetSport(sport = ""): MultiSportTarget {
  return {
    sport,
    loadSharePct: null,
    distanceKm: null,
    durationMin: null,
    speedAvgKmh: null,
    powerAvgW: null,
    elevationM: null,
    workKj: null,
  };
}

export function aggregateGoalTargets(targets: MultiSportTarget[]): GoalTargets {
  const sum = {
    distanceKm: 0,
    durationMin: 0,
    speedAvgKmhWeighted: 0,
    powerAvgWWeighted: 0,
    elevationM: 0,
    workKj: 0,
    speedWeight: 0,
    powerWeight: 0,
  };
  for (const t of targets) {
    const share = clamp((t.loadSharePct ?? 0) / 100, 0, 1);
    if ((t.distanceKm ?? 0) > 0) sum.distanceKm += t.distanceKm ?? 0;
    if ((t.durationMin ?? 0) > 0) sum.durationMin += t.durationMin ?? 0;
    if ((t.elevationM ?? 0) > 0) sum.elevationM += t.elevationM ?? 0;
    if ((t.workKj ?? 0) > 0) sum.workKj += t.workKj ?? 0;
    if ((t.speedAvgKmh ?? 0) > 0) {
      sum.speedAvgKmhWeighted += (t.speedAvgKmh ?? 0) * Math.max(share, 0.0001);
      sum.speedWeight += Math.max(share, 0.0001);
    }
    if ((t.powerAvgW ?? 0) > 0) {
      sum.powerAvgWWeighted += (t.powerAvgW ?? 0) * Math.max(share, 0.0001);
      sum.powerWeight += Math.max(share, 0.0001);
    }
  }
  return {
    distanceKm: sum.distanceKm > 0 ? Math.round(sum.distanceKm) : null,
    durationMin: sum.durationMin > 0 ? Math.round(sum.durationMin) : null,
    speedAvgKmh: sum.speedWeight > 0 ? Math.round((sum.speedAvgKmhWeighted / sum.speedWeight) * 10) / 10 : null,
    powerAvgW: sum.powerWeight > 0 ? Math.round(sum.powerAvgWWeighted / sum.powerWeight) : null,
    elevationM: sum.elevationM > 0 ? Math.round(sum.elevationM) : null,
    workKj: sum.workKj > 0 ? Math.round(sum.workKj) : null,
  };
}

/** Quattro macro-fasi aerobiche ripartite sulla finestra passo 3 (base · costruzione · rifinitura · forma). */
export function buildAerobicClassicPhases(s: string, e: string): PhasePlan[] {
  const startMs = new Date(s).getTime();
  const endMs = new Date(e).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return [];
  }
  const totalDays = Math.max(7, Math.floor((endMs - startMs) / 86400000) + 1);
  let n1 = Math.max(7, Math.floor(totalDays * 0.28));
  let n2 = Math.max(7, Math.floor(totalDays * 0.36));
  let n3 = Math.max(5, Math.floor(totalDays * 0.16));
  let n4 = totalDays - n1 - n2 - n3;
  if (n4 < 7) {
    n4 = 7;
    n2 = Math.max(7, n2 - (7 - (totalDays - n1 - n2 - n3)));
  }
  const baseEnd = addDays(s, n1 - 1);
  const buildEnd = addDays(baseEnd, n2);
  const taperEnd = addDays(buildEnd, n3);
  return [
    {
      id: crypto.randomUUID(),
      start: s,
      end: baseEnd,
      phase: "base",
      mesocycle: "M1",
      weeklyTss: 460,
      sessionsPerWeek: 6,
      notes: "Volume progressivo + lavori estensivi",
    },
    {
      id: crypto.randomUUID(),
      start: addDays(baseEnd, 1),
      end: buildEnd,
      phase: "build",
      mesocycle: "M2",
      weeklyTss: 560,
      sessionsPerWeek: 7,
      notes: "Incremento qualità + intensità controllata",
    },
    {
      id: crypto.randomUUID(),
      start: addDays(buildEnd, 1),
      end: taperEnd,
      phase: "refine",
      mesocycle: "M3",
      weeklyTss: 510,
      sessionsPerWeek: 6,
      notes: "Rifinitura specifica evento",
    },
    {
      id: crypto.randomUUID(),
      start: addDays(taperEnd, 1),
      end: e,
      phase: "peak",
      mesocycle: "M4",
      weeklyTss: 430,
      sessionsPerWeek: 5,
      notes: "Picco forma + taper graduale",
    },
  ];
}

export function defaultPhases(start: string): PhasePlan[] {
  return buildAerobicClassicPhases(start, planWindowEndForWeeks(start, DEFAULT_AEROBIC_PLAN_WEEKS));
}

export function phasesCoverGymWindow(phases: PhasePlan[], gymStart: string, gymEnd: string): boolean {
  if (!phases.length || !gymStart || !gymEnd) return false;
  const ps = phases[0]?.start ?? "";
  const pe = phases[phases.length - 1]?.end ?? "";
  return ps <= gymStart && pe >= gymEnd;
}

export function buildTechnicalDayModules(daysPerWeek: number): TechnicalDayModule[] {
  const safeDays = clamp(daysPerWeek, 1, 7);
  return Array.from({ length: safeDays }, (_, idx) => ({
    dayIndex: idx + 1,
    objectives: idx % 3 === 0 ? ["Condizione fisica", "Tecnica con modulo"] : idx % 3 === 1 ? ["Fase offensiva", "Schemi"] : ["Fase difensiva", "Partita"],
    exerciseType: idx % 2 === 0 ? "Lavoro tattico a reparti" : "Small sided game",
    intensity: idx % 2 === 0 ? "Media" : "Alta",
    methodology: "Progressivo",
  }));
}

export function buildLifestyleDayModules(daysPerWeek: number): LifestyleDayModule[] {
  const safeDays = clamp(daysPerWeek, 1, 7);
  return Array.from({ length: safeDays }, (_, idx) => ({
    dayIndex: idx + 1,
    objective: idx % 2 === 0 ? "Mobilita articolare" : "Recupero autonomico",
    practiceType: idx % 2 === 0 ? "Yoga Hatha" : "Pilates Mat",
    intensityRpe: idx % 3 === 0 ? 4 : 3,
    breathingCadence: "Naso 5:5",
    holdOrFlow: "Tenute 20-40s",
    methodology: "Rigenerativo",
  }));
}

export function buildGymMacroPhases(start: string, end: string, phaseCount: number): PhasePlan[] {
  const count = Math.max(1, Math.min(8, Math.round(phaseCount)));
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    return defaultPhases(isoToday());
  }
  const totalDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const chunk = Math.max(7, Math.floor(totalDays / count));
  return Array.from({ length: count }, (_, i) => {
    const phaseStart = addDays(start, i * chunk);
    const rawEnd = i === count - 1 ? end : addDays(phaseStart, Math.max(6, chunk - 1));
    const phaseTypes: PhaseType[] = ["base", "build", "refine", "peak", "deload", "second_peak"];
    const pType = phaseTypes[Math.min(i, phaseTypes.length - 1)];
    const objective = gymMacroObjectiveLabels[Math.min(i, gymMacroObjectiveLabels.length - 1)]?.id ?? "forza";
    return {
      id: crypto.randomUUID(),
      start: phaseStart,
      end: rawEnd,
      phase: pType,
      macroObjective: objective,
      mesocycle: `M${i + 1}`,
      weeklyTss: pType === "peak" ? 420 : pType === "build" ? 560 : pType === "deload" ? 320 : 500,
      sessionsPerWeek: pType === "deload" ? 4 : 5,
      notes: `Gym phase objective ${objective}`,
    };
  });
}
