import {
  Activity,
  Apple,
  BatteryCharging,
  Bug,
  Flame,
  FlaskConical,
  Infinity as InfinityIcon,
  Moon,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { DashboardAreaKey } from "@/lib/dashboard/dashboard-scores";

export type AreaTheme = {
  ring: string;
  text: string;
  border: string;
  glow: string;
};

export type AreaSlot = {
  color: string;
  icon: LucideIcon;
  /** Posizione orizzontale in percentuale nel viewBox. */
  bx: number;
  /** Posizione verticale in percentuale nel viewBox. */
  by: number;
  /** Punto del corpo a cui collegare la linea. */
  anchor: { x: number; y: number };
  label: string;
};

export const AREA_THEME: Record<DashboardAreaKey, AreaTheme> = {
  performance: {
    ring: "#fb7185",
    text: "text-rose-300",
    border: "border-rose-500/40",
    glow: "rgba(251,113,133,0.25)",
  },
  recovery: {
    ring: "#a78bfa",
    text: "text-violet-300",
    border: "border-violet-500/40",
    glow: "rgba(167,139,250,0.25)",
  },
  sleep: {
    ring: "#60a5fa",
    text: "text-sky-300",
    border: "border-sky-500/40",
    glow: "rgba(96,165,250,0.25)",
  },
  stress: {
    ring: "#c084fc",
    text: "text-purple-300",
    border: "border-purple-500/40",
    glow: "rgba(192,132,252,0.25)",
  },
  biomarkers: {
    ring: "#fb923c",
    text: "text-orange-300",
    border: "border-orange-500/40",
    glow: "rgba(251,146,60,0.25)",
  },
  hormones: {
    ring: "#2dd4bf",
    text: "text-teal-300",
    border: "border-teal-500/40",
    glow: "rgba(45,212,191,0.25)",
  },
  microbiome: {
    ring: "#f472b6",
    text: "text-pink-300",
    border: "border-pink-500/40",
    glow: "rgba(244,114,182,0.25)",
  },
  nutrition: {
    ring: "#34d399",
    text: "text-emerald-300",
    border: "border-emerald-500/40",
    glow: "rgba(52,211,153,0.25)",
  },
  longevity: {
    ring: "#fbbf24",
    text: "text-amber-300",
    border: "border-amber-500/40",
    glow: "rgba(251,191,36,0.25)",
  },
};

/** Joint points dello scheletro point-cloud, nel viewBox 680×540. */
const J = {
  neck: { x: 340, y: 176 },
  shL: { x: 300, y: 194 },
  shR: { x: 380, y: 194 },
  elL: { x: 284, y: 262 },
  elR: { x: 396, y: 262 },
  haL: { x: 298, y: 326 },
  haR: { x: 382, y: 326 },
  hpL: { x: 320, y: 312 },
  hpR: { x: 360, y: 312 },
  knL: { x: 324, y: 398 },
  knR: { x: 356, y: 398 },
  anL: { x: 322, y: 476 },
  anR: { x: 358, y: 476 },
  ftL: { x: 305, y: 490 },
  ftR: { x: 375, y: 490 },
};

export const AREA_SLOT: Record<DashboardAreaKey, AreaSlot> = {
  performance: { color: "#ec4899", icon: Activity, bx: 50, by: 7, anchor: { x: 340, y: 120 }, label: "Performance" },
  stress: { color: "#a855f7", icon: Zap, bx: 20, by: 24, anchor: J.shL, label: "Stress" },
  biomarkers: { color: "#f59e0b", icon: FlaskConical, bx: 14, by: 44, anchor: J.elL, label: "Biomarcatori" },
  nutrition: { color: "#84cc16", icon: Apple, bx: 16, by: 64, anchor: J.hpL, label: "Nutrizione" },
  microbiome: { color: "#f472b6", icon: Bug, bx: 24, by: 84, anchor: J.knL, label: "Microbioma" },
  recovery: { color: "#8b5cf6", icon: BatteryCharging, bx: 80, by: 24, anchor: J.shR, label: "Recovery" },
  sleep: { color: "#3b82f6", icon: Moon, bx: 86, by: 44, anchor: J.elR, label: "Sleep" },
  hormones: { color: "#14b8a6", icon: Flame, bx: 84, by: 64, anchor: J.hpR, label: "Hormones" },
  longevity: { color: "#f97316", icon: InfinityIcon, bx: 76, by: 84, anchor: J.knR, label: "Longevity" },
};

export const AREA_ORDER: DashboardAreaKey[] = [
  "performance",
  "recovery",
  "sleep",
  "stress",
  "biomarkers",
  "hormones",
  "microbiome",
  "nutrition",
  "longevity",
];
