import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Impostazioni consolidate nel Profilo (un'unica pagina account): /settings
 * reindirizza a /profile, così vecchi link/bookmark continuano a funzionare.
 */
export default function SettingsRedirectPage(): never {
  redirect("/profile");
}
