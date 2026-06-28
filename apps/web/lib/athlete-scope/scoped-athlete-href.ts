/**
 * URL delle schede atleta in scope COACH (selezione nell'URL /athletes/[athleteId]/...).
 * Usati dalle viste riusate (staging/review e module views) per navigare restando nello
 * scope atleta invece di uscire nella shell globale del coach.
 *
 * NB: lo scope ADMIN (/admin/utenti/[userId]/...) è chiavato su userId, non athleteId, quindi
 * non è ricostruibile da queste viste (che conoscono solo athleteId) → l'admin resta gestito
 * a parte.
 */
export function coachAthleteModuleHref(athleteId: string, module: string): string {
  return `/athletes/${athleteId}/${module}`;
}

export function coachAthleteStagingHref(athleteId: string, module: string, runId: string): string {
  return `/athletes/${athleteId}/${module}/staging/${runId}`;
}

/**
 * Riscrive un reviewUrl globale (`/<module>/staging/<runId>`) nella variante scoped coach
 * (`/athletes/<athleteId>/<module>/staging/<runId>`) quando si sta operando dentro la scheda
 * di un atleta. Fuori scope coach (atleta proprio, o admin) ritorna l'URL invariato.
 */
export function scopedReviewUrl(
  reviewUrl: string,
  opts: { athleteId: string | null; adminScoped: boolean; platformAdminView: boolean },
): string {
  if (!opts.adminScoped || opts.platformAdminView || !opts.athleteId) return reviewUrl;
  const m = reviewUrl.match(/^\/([^/]+)\/staging\/([^/?#]+)/);
  if (!m) return reviewUrl;
  return coachAthleteStagingHref(opts.athleteId, m[1]!, m[2]!);
}

const ATHLETE_MODULE_SLUGS = new Set([
  "dashboard",
  "health",
  "physiology",
  "training",
  "nutrition",
  "biomechanics",
  "aerodynamics",
  "bioenergetics",
  "longevity",
]);

// Bioenergetica e Longevity sono assorbite nella Dashboard: un link scoped a quei
// moduli atterra sulla Dashboard dell'atleta (dove vivono), non su una rotta rimossa.
const ABSORBED_INTO_DASHBOARD = new Set(["bioenergetics", "longevity"]);

function normalizeScopedModule(slug: string): string {
  return ABSORBED_INTO_DASHBOARD.has(slug) ? "dashboard" : slug;
}

/**
 * Risolve un href cross-shell verso lo scope corrente per i link riusati (back-link e CTA
 * staging). Ritorna:
 *  - l'href invariato fuori scope (atleta proprio),
 *  - la variante coach scoped (`/athletes/<id>/<module>[/staging/<runId>]`) in scope coach,
 *  - `null` quando il link non è scopabile o si è in scope admin → il chiamante rende inerte.
 * Riconosce solo `/<module>` e `/<module>/staging/<runId>` per moduli atleta noti.
 */
export function scopedShellHref(
  href: string,
  opts: { athleteId: string | null; adminScoped: boolean; platformAdminView: boolean },
): string | null {
  if (!opts.adminScoped) return href;
  if (opts.platformAdminView || !opts.athleteId) return null;
  const staging = href.match(/^\/([^/?#]+)\/staging\/([^/?#]+)/);
  if (staging && ATHLETE_MODULE_SLUGS.has(staging[1]!)) {
    return coachAthleteStagingHref(opts.athleteId, staging[1]!, staging[2]!);
  }
  const root = href.match(/^\/([^/?#]+)\/?$/);
  if (root && ATHLETE_MODULE_SLUGS.has(root[1]!)) {
    return coachAthleteModuleHref(opts.athleteId, normalizeScopedModule(root[1]!));
  }
  return null;
}
