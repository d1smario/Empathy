import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Longevity & Fitness assorbito nella Dashboard (check-in di oggi + indice EPI):
 * /longevity reindirizza a /dashboard, così vecchi link/bookmark continuano a
 * funzionare.
 */
export default function LongevityRedirectPage(): never {
  redirect("/dashboard");
}
