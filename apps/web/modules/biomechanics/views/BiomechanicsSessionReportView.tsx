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

export default function BiomechanicsSessionReportView({ sessionId }: { sessionId: string }) {
  const { athleteId, loading: athleteLoading } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReturnType<typeof sessionToReportData> | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (athleteLoading || !athleteId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const result = await fetchBiomechanicsSessionDetail({ athleteId, sessionId });
      if (cancelled) return;
      if (!result.ok || !result.session) {
        setError(result.error ?? "Report non disponibile");
        setReportData(null);
        setSignedUrl(null);
      } else {
        setReportData(sessionToReportData(result.session));
        setSignedUrl(result.signedUrl ?? null);
      }
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
