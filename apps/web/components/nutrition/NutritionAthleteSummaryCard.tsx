"use client";

import {
  formatNutritionConstraintsLine,
  formatNutritionPlanLine,
  nutritionConstraintsFromDbRow,
  nutritionPlanFromDbRow,
  type NutritionConstraints,
  type NutritionConstraintsDbRow,
  type NutritionPlan,
  type NutritionPlanDbRow,
} from "@empathy/domain-nutrition";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { useActiveAthlete } from "@/lib/use-active-athlete";

// Cache cross-mount del riepilogo nutrizione: ri-atterrando sulla pagina i dati
// compaiono subito (niente spinner/"refresh"); il refetch in background gira
// comunque, così eventuali aggiornamenti restano riflessi senza spinner.
let nutritionSummaryCacheId: string | null = null;
let nutritionSummaryCache: {
  constraints: NutritionConstraints | null;
  plans: NutritionPlan[];
} | null = null;

export function NutritionAthleteSummaryCard() {
  const t = useTranslations("NutritionAthleteSummaryCard");
  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [constraints, setConstraints] = useState<NutritionConstraints | null>(null);
  const [plans, setPlans] = useState<NutritionPlan[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (ctxLoading) return;
    if (!athleteId) {
      setConstraints(null);
      setPlans([]);
      setErr(t("noActiveAthlete"));
      setLoading(false);
      return;
    }
    let c = false;
    // Se i dati di questo atleta sono già in cache, mostrali SUBITO (niente
    // spinner); il fetch sotto gira comunque in background e aggiorna stato+cache.
    const cached = nutritionSummaryCacheId === athleteId ? nutritionSummaryCache : null;
    if (cached) {
      setConstraints(cached.constraints);
      setPlans(cached.plans);
      setErr(null);
      setLoading(false);
    } else {
      setLoading(true);
      setErr(null);
    }
    (async () => {
      try {
        // Lettura diretta browser→Supabase (RLS scoped sull'atleta): vincoli + ultimi piani.
        const supabase = createEmpathyBrowserSupabase();
        if (!supabase) {
          if (!c && !cached) {
            setConstraints(null);
            setPlans([]);
            setErr(t("readFailed"));
          }
          return;
        }
        const [cRes, pRes] = await Promise.all([
          supabase.from("nutrition_constraints").select("*").eq("athlete_id", athleteId).maybeSingle(),
          supabase
            .from("nutrition_plans")
            .select("id, athlete_id, from_date, to_date, goal, constraints_snapshot, created_at, updated_at")
            .eq("athlete_id", athleteId)
            .order("from_date", { ascending: false })
            .limit(8),
        ]);
        if (c) return;
        const errMsg = cRes.error?.message ?? pRes.error?.message ?? null;
        if (errMsg) {
          if (!cached) {
            setConstraints(null);
            setPlans([]);
            setErr(errMsg || t("readFailed"));
          }
          return;
        }
        const constraintsRow = cRes.data as NutritionConstraintsDbRow | null;
        const nextConstraints = constraintsRow ? nutritionConstraintsFromDbRow(constraintsRow) : null;
        const nextPlans = ((pRes.data ?? []) as NutritionPlanDbRow[]).map(nutritionPlanFromDbRow);
        setConstraints(nextConstraints);
        setPlans(nextPlans);
        setErr(null);
        nutritionSummaryCache = { constraints: nextConstraints, plans: nextPlans };
        nutritionSummaryCacheId = athleteId;
      } catch {
        if (!c && !cached) setErr(t("networkError"));
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [athleteId, ctxLoading]);

  return (
    <section
      className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/30 p-6 text-left backdrop-blur-md"
      aria-label={t("ariaLabel")}
    >
      <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-amber-400">{t("kicker")}</p>
      <h2 className="mt-2 text-lg font-bold text-white">{t("title")}</h2>

      {ctxLoading || loading ? (
        <div className="mt-4 space-y-2">
          <div className="h-2 w-44 animate-pulse rounded-full bg-white/10" />
        </div>
      ) : null}

      {!ctxLoading && !loading && err ? (
        <p className="mt-4 text-sm text-amber-300/90" role="alert">
          {err}
        </p>
      ) : null}

      {!ctxLoading && !loading && !err && !constraints && plans.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">{t("emptyState")}</p>
      ) : null}

      {!ctxLoading && !loading && !err && constraints ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("constraintsHeading")}</h3>
          <p className="mt-1 text-sm text-gray-200">{formatNutritionConstraintsLine(constraints)}</p>
        </div>
      ) : null}

      {!ctxLoading && !loading && !err && plans.length > 0 ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">{t("recentPlansHeading")}</h3>
          <ul className="mt-2 space-y-2">
            {plans.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200"
              >
                {formatNutritionPlanLine(p)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
