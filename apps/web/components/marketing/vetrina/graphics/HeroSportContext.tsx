"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type HeroSportValue = { sport: number; setSport: (n: number) => void };

const HeroSportCtx = createContext<HeroSportValue>({ sport: 0, setSport: () => {} });

/**
 * Condivide quale clip/sport è attiva nell'hero: HeroVideo la imposta a ogni crossfade,
 * EngineHud la legge per mostrare le metriche coerenti (ciclismo/palestra/corsa).
 * Senza provider il default è 0 (ciclismo), quindi i componenti restano usabili da soli.
 */
export function HeroSportProvider({ children }: { children: ReactNode }) {
  const [sport, setSport] = useState(0);
  return <HeroSportCtx.Provider value={{ sport, setSport }}>{children}</HeroSportCtx.Provider>;
}

export function useHeroSport(): HeroSportValue {
  return useContext(HeroSportCtx);
}
