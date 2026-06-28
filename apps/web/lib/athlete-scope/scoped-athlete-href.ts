/**
 * URL delle schede atleta in scope COACH (/athletes/[athleteId]/...) e ADMIN
 * (/admin/utenti/[userId]/...). Usati dalle viste riusate (staging/review e module views)
 * per navigare restando nello scope invece di uscire nella shell globale.
 *
 * Coach: chiavato su athleteId (già nel context). Admin: chiavato su userId, che le viste
 * NON conoscono di per sé → il context lo espone come `scopeOwnerUserId` (vedi
 * ActiveAthleteScopeProvider), così anche lo scope admin è ricostruibile (parità con il coach).
 */
export function coachAthleteModuleHref(athleteId: string, module: string): string {
  return `/athletes/${athleteId}/${module}`;
}

export function coachAthleteStagingHref(athleteId: string, module: string, runId: string): string {
  return `/athletes/${athleteId}/${module}/staging/${runId}`;
}

export function adminUserModuleHref(userId: string, module: string): string {
  return `/admin/utenti/${userId}/${module}`;
}

export function adminUserStagingHref(userId: string, module: string, runId: string): string {
  return `/admin/utenti/${userId}/${module}/staging/${runId}`;
}

type ScopeHrefOpts = {
  athleteId: string | null;
  adminScoped: boolean;
  platformAdminView: boolean;
  /** userId dell'utente selezionato (scope admin): richiesto per ricostruire gli href admin. */
  scopeOwnerUserId?: string | null;
};

/**
 * Riscrive un reviewUrl globale (`/<module>/staging/<runId>`) nella variante scoped del
 * chiamante (coach: /athletes/<id>/...; admin: /admin/utenti/<userId>/...). Fuori scope
 * (atleta proprio) ritorna l'URL invariato; in scope admin senza scopeOwnerUserId ritorna
 * l'URL invariato (impossibile ricostruire).
 */
export function scopedReviewUrl(reviewUrl: string, opts: ScopeHrefOpts): string {
  if (!opts.adminScoped) return reviewUrl;
  const m = reviewUrl.match(/^\/([^/]+)\/staging\/([^/?#]+)/);
  if (!m) return reviewUrl;
  if (opts.platformAdminView) {
    return opts.scopeOwnerUserId ? adminUserStagingHref(opts.scopeOwnerUserId, m[1]!, m[2]!) : reviewUrl;
  }
  return opts.athleteId ? coachAthleteStagingHref(opts.athleteId, m[1]!, m[2]!) : reviewUrl;
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
 * Risolve un href cross-shell verso lo scope corrente per i link riusati (back-link e CTA).
 * Ritorna:
 *  - l'href invariato fuori scope (atleta proprio),
 *  - la variante scoped coach (/athletes/<id>/...) o admin (/admin/utenti/<userId>/...),
 *  - `null` quando il link non è scopabile o manca l'id per ricostruirlo → il chiamante rende inerte.
 * Riconosce solo `/<module>` e `/<module>/staging/<runId>` per moduli atleta noti.
 */
export function scopedShellHref(href: string, opts: ScopeHrefOpts): string | null {
  if (!opts.adminScoped) return href;

  const staging = href.match(/^\/([^/?#]+)\/staging\/([^/?#]+)/);
  const root = href.match(/^\/([^/?#]+)\/?$/);
  const stagingSlug = staging && ATHLETE_MODULE_SLUGS.has(staging[1]!) ? staging[1]! : null;
  const rootSlug = root && ATHLETE_MODULE_SLUGS.has(root[1]!) ? root[1]! : null;

  if (opts.platformAdminView) {
    if (!opts.scopeOwnerUserId) return null;
    if (staging && stagingSlug) return adminUserStagingHref(opts.scopeOwnerUserId, stagingSlug, staging[2]!);
    if (root && rootSlug) return adminUserModuleHref(opts.scopeOwnerUserId, normalizeScopedModule(rootSlug));
    return null;
  }

  if (!opts.athleteId) return null;
  if (staging && stagingSlug) return coachAthleteStagingHref(opts.athleteId, stagingSlug, staging[2]!);
  if (root && rootSlug) return coachAthleteModuleHref(opts.athleteId, normalizeScopedModule(rootSlug));
  return null;
}
