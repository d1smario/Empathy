import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Bioenergetica (box "Striscia 24 h") assorbita nella Dashboard mobile:
 * /m/bioenergetics reindirizza a /m/dashboard, così vecchi link/bookmark continuano a funzionare.
 */
export default function MobileBioenergeticsRedirectPage(): never {
  redirect("/m/dashboard");
}
