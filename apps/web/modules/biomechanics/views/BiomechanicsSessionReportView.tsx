"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import {
  BiomechanicsReportPanels,
  sessionToReportData,
} from "@/modules/biomechanics/components/BiomechanicsReportPanels";
import { fetchBiomechanicsSessionDetail } from "@/modules/biomechanics/services/biomechanics-module-api";

// Cache cross-mount del report sessione: ri-atterrando sulla pagina i dati
// compaiono subito (niente spinner "Caricamento report..."); il refresh avviene in
// background silenzioso. La chiave è composta (athleteId|sessionId) per non mostrare
// mai i dati di un atleta o di una sessione diversa.
type BiomechReportCacheEntry = {
  reportData: ReturnType<typeof sessionToReportData> | null;
  signedUrl: string | null;
  error: string | null;
};
let biomechReportCacheKey: string | null = null;
let biomechReportCache: BiomechReportCacheEntry | null = null;

export default function BiomechanicsSessionReportView({ sessionId }: { sessionId: string }) {
  const { athleteId, loading: athleteLoading } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReturnType<typeof sessionToReportData> | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (athleteLoading || !athleteId) return;
    let cancelled = false;
    const cacheKey = `${athleteId}|${sessionId}`;
    const cached = biomechReportCacheKey === cacheKey ? biomechReportCache : null;
    if (cached) {
      // Dati in cache per la stessa chiave: mostrali subito (niente spinner);
      // sotto si prosegue comunque col fetch per il refresh in background.
      setReportData(cached.reportData);
      setSignedUrl(cached.signedUrl);
      setError(cached.error);
      setLoading(false);
    } else {
      setLoading(true);
      setError(null);
    }
    (async () => {
      const result = await fetchBiomechanicsSessionDetail({ athleteId, sessionId });
      if (cancelled) return;
      let nextEntry: BiomechReportCacheEntry;
      if (!result.ok || !result.session) {
        nextEntry = { reportData: null, signedUrl: null, error: result.error ?? "Report non disponibile" };
      } else {
        nextEntry = {
          reportData: sessionToReportData(result.session),
          signedUrl: result.signedUrl ?? null,
          error: null,
        };
      }
      setReportData(nextEntry.reportData);
      setSignedUrl(nextEntry.signedUrl);
      setError(nextEntry.error);
      biomechReportCache = nextEntry;
      biomechReportCacheKey = cacheKey;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, athleteLoading, sessionId]);

  return (
    <Pro2ModulePageShell
      eyebrow="Biomechanics · Report"
      eyebrowClassName={moduleEyebrowClass("biomechanics")}
      title="Report sessione biomeccanica"
      description="KPI deterministici, ROM articolare e rischio per distretto — esportabile in PDF."
      headerActions={
        <div className="flex flex-wrap gap-2 print:hidden">
          <Pro2Link href="/biomechanics#biomech-report" variant="secondary" className="justify-center border border-white/15">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Archivio
          </Pro2Link>
        </div>
      }
    >
      <div className="print:text-black">
        {loading ? <p className="text-sm text-gray-400">Caricamento report...</p> : null}
        {error ? (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}{" "}
            <Link href="/biomechanics" className="underline">
              Torna a Biomechanics
            </Link>
          </p>
        ) : null}
        {reportData ? <BiomechanicsReportPanels data={reportData} mode="confirmed" videoUrl={signedUrl} /> : null}
        <div className="mt-6 flex flex-wrap items-center gap-3 print:hidden">
          <Pro2Button
            variant="secondary"
            className="justify-center border border-white/15"
            onClick={() => window.print()}
            disabled={!reportData}
          >
            <Printer className="mr-2 h-4 w-4" />
            Salva PDF
          </Pro2Button>
          <small className="text-xs text-gray-500">Esporta il report come PDF.</small>
        </div>
      </div>
    </Pro2ModulePageShell>
  );
}
