"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  phaseColor,
  phaseRowBackground,
  type PhaseType,
} from "@/lib/training/virya/virya-annual-plan-kit";

export type ViryaMasterPlanWeekRow = {
  week: number;
  weekStart: string;
  phase: string;
  phaseType: PhaseType;
  displaySessions: number;
  displayTss: number;
};

export type ViryaMasterPlanCardProps = {
  programWeekRows: ViryaMasterPlanWeekRow[];
};

export function ViryaMasterPlanCard({
  programWeekRows,
}: ViryaMasterPlanCardProps) {
  const t = useTranslations("ViryaMasterPlanCard");
  return (
        <article className="viz-card builder-panel">
          <h3 className="viz-title">{t("title")}</h3>
          <div style={{ maxHeight: "340px", overflowY: "auto" }}>
            <table className="table-shell">
              <thead>
                <tr>
                  <th>{t("colWeek")}</th>
                  <th>{t("colStart")}</th>
                  <th>{t("colPhase")}</th>
                  <th>{t("colSessions")}</th>
                  <th>Carico</th>
                  <th>{t("colOpen")}</th>
                </tr>
              </thead>
              <tbody>
                {programWeekRows.slice(0, 52).map((w) => {
                  const pc = phaseColor(w.phaseType);
                  return (
                  <tr key={`${w.week}-${w.weekStart}`} style={{ backgroundColor: phaseRowBackground(w.phaseType) }}>
                    <td style={{ color: pc, fontWeight: 700 }}>W{w.week}</td>
                    <td style={{ color: `${pc}cc` }}>{new Date(w.weekStart).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}</td>
                    <td>
                      <span
                        className="builder-zone-chip"
                        style={{
                          borderColor: pc,
                          color: pc,
                          backgroundColor: `${pc}28`,
                          fontWeight: 700,
                        }}
                      >
                        {w.phase}
                      </span>
                    </td>
                    <td style={{ color: "#f1f5f9", fontWeight: 600 }}>{w.displaySessions}</td>
                    <td style={{ color: pc, fontWeight: 800 }}>{w.displayTss}</td>
                    <td>
                      <Link href={`/training/calendar?date=${w.weekStart}`} style={{ color: pc, textDecoration: "none", fontWeight: 600 }}>
                        {t("openLink")}
                      </Link>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: "10px", color: "var(--empathy-text-muted)", fontSize: "12px" }}>
            {t("hint")}
          </p>
        </article>
  );
}
