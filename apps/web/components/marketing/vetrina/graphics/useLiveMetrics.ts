"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveMetrics } from "@/components/marketing/WatchLabSection";

type Spec = { key: keyof LiveMetrics; min: number; max: number; step: number; decimals: number };

const SPECS: Spec[] = [
  { key: "hr", min: 138, max: 163, step: 3, decimals: 0 }, // battito: piccoli salti realistici
  { key: "spd", min: 29, max: 41, step: 0.7, decimals: 1 },
  { key: "pwr", min: 230, max: 345, step: 14, decimals: 0 },
  { key: "cad", min: 84, max: 97, step: 2, decimals: 0 },
];

const INITIAL: LiveMetrics = { hr: 149, spd: 34.2, pwr: 286, cad: 91 };

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/**
 * Metriche "live" con random walk limitato: i numeri saltano in modo realistico
 * (es. 149 → 151 → 148…) invece di contare da 0. Rispetta prefers-reduced-motion.
 */
export function useLiveMetrics(intervalMs = 950): LiveMetrics {
  const [metrics, setMetrics] = useState<LiveMetrics>(INITIAL);
  const ref = useRef<LiveMetrics>(INITIAL);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const t = setInterval(() => {
      const next = { ...ref.current };
      for (const s of SPECS) {
        const cur = ref.current[s.key];
        const delta = (Math.random() * 2 - 1) * s.step;
        next[s.key] = round(Math.max(s.min, Math.min(s.max, cur + delta)), s.decimals);
      }
      ref.current = next;
      setMetrics(next);
    }, intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return metrics;
}
