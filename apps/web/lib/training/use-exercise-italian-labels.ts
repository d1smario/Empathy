"use client";

import { useEffect, useState } from "react";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

export type ExerciseItalianLabel = {
  nameIt: string;
  howToIt: string | null;
  commonMistakeIt: string | null;
};

/**
 * Nome italiano ed esecuzione degli esercizi, per la scheda che l'atleta legge.
 *
 * L'aggancio è per NOME, non per id, perché i piani salvati dal Builder contengono solo
 * l'etichetta testuale (nei `notes` c'è `"label":"Back Squat"`, nessun `exerciseId`):
 * chiedere l'id qui vorrebbe dire non trovare niente sul 100% dei piani già scritti.
 * Il confronto è case-insensitive: nel catalogo lo stesso esercizio esiste sia come
 * «Dumbbell Bench Press» sia come «Dumbbell bench press», nate dalla fusione di due
 * librerie.
 *
 * Legge `exercise_public`, la vista che espone i soli campi mostrabili: `public.exercise`
 * ha RLS senza policy e dal browser non è leggibile.
 *
 * Nessun testo tradotto ⇒ mappa vuota ⇒ la scheda mostra il nome inglese, cioè
 * esattamente quello che mostrava prima. Un errore di rete non rompe la pagina.
 */
export function useExerciseItalianLabels(labels: readonly string[]): Map<string, ExerciseItalianLabel> {
  const [map, setMap] = useState<Map<string, ExerciseItalianLabel>>(new Map());
  // Chiave stabile: senza, un array ricreato a ogni render rifà la query all'infinito.
  const key = [...new Set(labels.map((l) => l.trim().toLowerCase()).filter(Boolean))].sort().join("|");

  useEffect(() => {
    const wanted = key.split("|").filter(Boolean);
    if (wanted.length === 0) {
      setMap(new Map());
      return;
    }
    let annullato = false;
    const db = createEmpathyBrowserSupabase();
    if (!db) return;
    void (async () => {
      const { data, error } = await db
        .from("exercise_public")
        .select("name, name_it, how_to_it, common_mistake_it")
        .not("name_it", "is", null);
      if (annullato || error || !Array.isArray(data)) return;
      const next = new Map<string, ExerciseItalianLabel>();
      for (const row of data as Array<Record<string, unknown>>) {
        const nome = typeof row.name === "string" ? row.name.trim().toLowerCase() : "";
        const nameIt = typeof row.name_it === "string" ? row.name_it.trim() : "";
        if (!nome || !nameIt || !wanted.includes(nome)) continue;
        next.set(nome, {
          nameIt,
          howToIt: typeof row.how_to_it === "string" ? row.how_to_it.trim() : null,
          commonMistakeIt: typeof row.common_mistake_it === "string" ? row.common_mistake_it.trim() : null,
        });
      }
      setMap(next);
    })();
    return () => {
      annullato = true;
    };
  }, [key]);

  return map;
}
