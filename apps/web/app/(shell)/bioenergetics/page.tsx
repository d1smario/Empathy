import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Bioenergetica assorbita nella Dashboard (box "Striscia 24 h"):
 * /bioenergetics reindirizza a /dashboard, così vecchi link/bookmark
 * continuano a funzionare.
 */
export default function BioenergeticsRedirectPage(): never {
  redirect("/dashboard");
}
