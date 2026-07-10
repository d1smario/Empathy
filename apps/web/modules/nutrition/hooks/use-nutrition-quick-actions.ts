"use client";

import { useCallback, useRef, useState } from "react";
import { record } from "@/lib/nutrition/nutrition-view-helpers";
import { saveNutritionProfileConfig } from "@/modules/nutrition/services/nutrition-actions-api";

export type NutritionQuickActionsProfile = {
  nutrition_config: Record<string, unknown> | null | undefined;
  routine_config: Record<string, unknown> | null | undefined;
};

export function useNutritionQuickActions(input: {
  athleteId: string | null;
  date: string;
  profile: NutritionQuickActionsProfile | null;
  onConfigChange?: (nextConfig: Record<string, unknown>) => void;
}) {
  const { athleteId, date, profile, onConfigChange } = input;

  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [hydrationBusy, setHydrationBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Ref locale per accumulare le mutazioni tra un click e l'altro senza aspettare React. */
  const configRef = useRef<Record<string, unknown> | null>(null);
  /** Coda FIFO per serializzare le PATCH su nutrition_config (evita race). */
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const enqueueSave = useCallback(<T,>(job: () => Promise<T>): Promise<T> => {
    const next = queueRef.current.then(job, job);
    queueRef.current = next.catch(() => undefined);
    return next;
  }, []);

  const currentConfig = useCallback((): Record<string, unknown> => {
    if (configRef.current) return configRef.current;
    return record(profile?.nutrition_config);
  }, [profile]);

  const confirmMeal = useCallback(
    async (slotKey: string, nextConfirmed: boolean) => {
      if (!athleteId || !profile) return;
      setBusySlot(slotKey);
      setError(null);
      const prevSnapshot = configRef.current;
      try {
        const existingNutrition = currentConfig();
        const prevAll = record(existingNutrition.meal_confirmations);
        const prevDay = record(prevAll[date]);
        const nextDay: Record<string, unknown> = { ...prevDay };
        if (nextConfirmed) {
          nextDay[slotKey] = { confirmed: true, at: new Date().toISOString() };
        } else {
          delete nextDay[slotKey];
        }
        const merged: Record<string, unknown> = { ...prevAll };
        if (Object.keys(nextDay).length > 0) {
          merged[date] = nextDay;
        } else {
          delete merged[date];
        }
        const nextConfig = { ...existingNutrition, meal_confirmations: merged };
        configRef.current = nextConfig;
        await enqueueSave(() =>
          saveNutritionProfileConfig({
            athleteId,
            nutrition_config: nextConfig,
            routine_config: record(profile.routine_config),
          }),
        );
        onConfigChange?.(nextConfig);
      } catch (err) {
        configRef.current = prevSnapshot;
        setError(err instanceof Error ? err.message : "Failed to save meal confirmation");
      }
      setBusySlot(null);
    },
    [athleteId, profile, date, currentConfig, enqueueSave, onConfigChange],
  );

  const addHydration = useCallback(
    async (deltaMl: number) => {
      if (!athleteId || !profile) return;
      setHydrationBusy(true);
      setError(null);
      const prevSnapshot = configRef.current;
      try {
        const existingNutrition = currentConfig();
        const prevAll = record(existingNutrition.hydration_intake);
        const prevMl = Number(record(prevAll[date]).ml);
        const nextMl = Math.max(0, Math.min(20000, (Number.isFinite(prevMl) ? prevMl : 0) + deltaMl));
        const merged: Record<string, unknown> = { ...prevAll };
        if (nextMl > 0) {
          merged[date] = { ml: nextMl, at: new Date().toISOString() };
        } else {
          delete merged[date];
        }
        const nextConfig = { ...existingNutrition, hydration_intake: merged };
        configRef.current = nextConfig;
        await enqueueSave(() =>
          saveNutritionProfileConfig({
            athleteId,
            nutrition_config: nextConfig,
            routine_config: record(profile.routine_config),
          }),
        );
        onConfigChange?.(nextConfig);
      } catch (err) {
        configRef.current = prevSnapshot;
        setError(err instanceof Error ? err.message : "Failed to save hydration intake");
      }
      setHydrationBusy(false);
    },
    [athleteId, profile, date, currentConfig, enqueueSave, onConfigChange],
  );

  return { confirmMeal, addHydration, busySlot, hydrationBusy, error };
}
