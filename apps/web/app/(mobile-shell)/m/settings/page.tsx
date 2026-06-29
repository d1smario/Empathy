import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Impostazioni assorbite nel Profilo (come desktop /settings → /profile): nessuna voce nav
 * dedicata. /m/settings reindirizza a /m/profile, così vecchi link/bookmark continuano a
 * funzionare. (Il toggle "Versione desktop" vive nel footer del drawer.)
 */
export default function MobileSettingsRedirectPage(): never {
  redirect("/m/profile");
}
