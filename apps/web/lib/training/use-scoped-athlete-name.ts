import { useMemo } from "react";
import { useActiveAthlete } from "@/lib/use-active-athlete";

/**
 * Nome dell'atleta quando lo si guarda IN SCOPE (coach/admin su /athletes/[id]/… o
 * /admin/utenti/[id]/…): serve alla copy coach→atleta («Crea la seduta per {nome}»,
 * «Le sedute di {nome}»). Ritorna `null` quando NON è in scope (l'atleta sul proprio
 * /training) → in quel caso la copy resta in prima persona («le tue sedute»).
 */
export function useScopedAthleteName(): string | null {
  const { athleteId, adminScoped, athletes } = useActiveAthlete();
  return useMemo(() => {
    if (!adminScoped || !athleteId) return null;
    const a = athletes.find((x) => x.id === athleteId);
    if (!a) return null;
    const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
    return name || a.email || null;
  }, [athletes, athleteId, adminScoped]);
}
