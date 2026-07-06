"use client";

import { useEffect, useState } from "react";
import { fetchProfileViewModel } from "@/modules/profile/services/profile-api";
import { isUsableAthleteFtpWatts } from "@/lib/training/physiology/resolve-athlete-ftp-watts";

/** FTP dell'atleta attivo da memoria fisiologica (stesso percorso del Builder). */
export function useAthleteFtpWatts(athleteId: string | null | undefined): number | null {
  const [ftpW, setFtpW] = useState<number | null>(null);

  useEffect(() => {
    if (!athleteId) {
      setFtpW(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const vm = await fetchProfileViewModel(athleteId);
        if (cancelled) return;
        // FTP da tutte le fonti reali (come ProfilePageView): il payload lo espone in
        // physiology.ftp_watts e physiologyState.metabolicProfile.ftpWatts, non sempre
        // in physiologicalProfile → leggerne una sola faceva sparire l'FTP (e con esso IF/kcal).
        const ps = vm.physiologyState;
        const candidates: unknown[] = [
          ps?.metabolicProfile?.ftpWatts,
          ps?.physiologicalProfile?.ftpWatts,
          vm.athleteMemory?.physiology?.physiologicalProfile?.ftpWatts,
          (vm.physiology as Record<string, unknown> | null)?.ftp_watts,
        ];
        let next: number | null = null;
        for (const candidate of candidates) {
          const n = Number(candidate);
          if (isUsableAthleteFtpWatts(n)) {
            next = Math.round(n);
            break;
          }
        }
        setFtpW(next);
      } catch {
        if (!cancelled) setFtpW(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  return ftpW;
}
