import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

export type AdjacentSessionDates = { prevDate: string | null; nextDate: string | null };

const EMPTY: AdjacentSessionDates = { prevDate: null, nextDate: null };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * DB-first: trova il giorno-con-seduta immediatamente PRECEDENTE e SUCCESSIVO a `date`
 * per l'atleta, guardando SIA il pianificato SIA l'eseguito (RLS access-scoped, come il
 * resto del dettaglio seduta). Legge solo la colonna `date`, una riga per direzione/tabella
 * → quattro query minuscole. Serve alle frecce «precedente / successivo» del dettaglio seduta,
 * che saltano i giorni vuoti restando in ordine di data.
 */
export async function fetchAdjacentSessionDates(
  athleteId: string,
  date: string,
): Promise<AdjacentSessionDates> {
  const supabase = createEmpathyBrowserSupabase();
  if (!supabase || !athleteId || !ISO_DATE.test(date)) return EMPTY;

  const nearest = async (
    table: "planned_workouts" | "executed_workouts",
    dir: "prev" | "next",
  ): Promise<string | null> => {
    const base = supabase.from(table).select("date").eq("athlete_id", athleteId);
    const ordered =
      dir === "prev"
        ? base.lt("date", date).order("date", { ascending: false })
        : base.gt("date", date).order("date", { ascending: true });
    const { data, error } = await ordered.limit(1).maybeSingle();
    if (error || !data) return null;
    const d = (data as { date?: string | null }).date;
    return typeof d === "string" && d ? d.slice(0, 10) : null;
  };

  const [prevPlanned, prevExecuted, nextPlanned, nextExecuted] = await Promise.all([
    nearest("planned_workouts", "prev"),
    nearest("executed_workouts", "prev"),
    nearest("planned_workouts", "next"),
    nearest("executed_workouts", "next"),
  ]);

  // ISO date = ordinabile lessicograficamente. prev = la più GRANDE tra le precedenti;
  // next = la più PICCOLA tra le successive.
  const prevs = [prevPlanned, prevExecuted].filter((x): x is string => Boolean(x)).sort();
  const nexts = [nextPlanned, nextExecuted].filter((x): x is string => Boolean(x)).sort();
  return {
    prevDate: prevs.length ? prevs[prevs.length - 1]! : null,
    nextDate: nexts.length ? nexts[0]! : null,
  };
}
