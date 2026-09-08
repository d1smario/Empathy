"use client";

import { useEffect, useState } from "react";
import {
  ATHLETE_HR_THRESHOLDS_UNAVAILABLE,
  athleteHrThresholdsFromProfile,
  type AthleteHrThresholds,
} from "@empathy/domain-training";
import { fetchProfileViewModel } from "@/modules/profile/services/profile-api";

/**
 * Soglie FC **dell'atleta attivo** (stesso percorso di `useAthleteFtpWatts`).
 *
 * Sono l'unico input lecito dell'hrTSS: LT2 misurata → soglia dichiarata → FC max
 * anagrafica. Il picco di FC di una seduta (`trace_summary.hr_max_bpm`) NON è una
 * soglia e non compare qui — usarlo gonfiava il carico delle uscite facili fino a +150%.
 *
 * Finché il profilo non è arrivato (o l'atleta non ha soglie) il valore è
 * `ATHLETE_HR_THRESHOLDS_UNAVAILABLE`: le sedute a sola FC restano **senza carico**
 * («—»), non con un carico di ripiego.
 */
export function useAthleteHrThresholds(athleteId: string | null | undefined): AthleteHrThresholds {
  const [thresholds, setThresholds] = useState<AthleteHrThresholds>(ATHLETE_HR_THRESHOLDS_UNAVAILABLE);

  useEffect(() => {
    if (!athleteId) {
      setThresholds(ATHLETE_HR_THRESHOLDS_UNAVAILABLE);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const vm = await fetchProfileViewModel(athleteId);
        if (cancelled) return;
        setThresholds(
          athleteHrThresholdsFromProfile({
            lt2HeartRate: vm.physiologyState?.physiologicalProfile?.lt2HeartRate,
            thresholdHrBpm: vm.profile?.threshold_hr_bpm,
            // `max_hr_bpm_declared`, non `max_hr_bpm`: il secondo cade sul massimo dei
            // picchi delle ultime sedute, che è esattamente la sorgente da cui nasceva
            // il difetto. Se l'atleta non ha dichiarato nulla, qui non arriva niente.
            maxHrBpm: (vm.profile as { max_hr_bpm_declared?: number | null } | null)?.max_hr_bpm_declared,
          }),
        );
      } catch {
        if (!cancelled) setThresholds(ATHLETE_HR_THRESHOLDS_UNAVAILABLE);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  return thresholds;
}
