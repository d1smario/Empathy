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

/** Dettaglio seduta del giorno nello scope coach (rotta annidata sotto training). */
export function coachAthleteSessionHref(athleteId: string, date: string): string {
  return `/athletes/${athleteId}/training/session/${date}`;
}

/** Dettaglio seduta del giorno nello scope admin (chiavato su userId). */
export function adminUserSessionHref(userId: string, date: string): string {
  return `/admin/utenti/${userId}/training/session/${date}`;
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
  "analysis",
  "today",
  "health",
  "physiology",
  "training",
  "nutrition",
  "biomechanics",
  "aerodynamics",
  "bioenergetics",
  "longevity",
]);

// La Dashboard è diventata «Analisi» (e Bioenergetica/Longevity vivono lì dentro):
// un link scoped a quei moduli atterra su /analysis dell'atleta, non su una scheda
// rimossa — «dashboard» non è più in SCOPED_ATHLETE_TABS e darebbe 404.
const ABSORBED_INTO_ANALYSIS = new Set(["dashboard", "bioenergetics", "longevity"]);

function normalizeScopedModule(slug: string): string {
  return ABSORBED_INTO_ANALYSIS.has(slug) ? "analysis" : slug;
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
  const session = href.match(/^\/training\/session\/([^/?#]+)/);
  const root = href.match(/^\/([^/?#]+)\/?$/);
  const stagingSlug = staging && ATHLETE_MODULE_SLUGS.has(staging[1]!) ? staging[1]! : null;
  const rootSlug = root && ATHLETE_MODULE_SLUGS.has(root[1]!) ? root[1]! : null;

  if (opts.platformAdminView) {
    if (!opts.scopeOwnerUserId) return null;
    if (staging && stagingSlug) return adminUserStagingHref(opts.scopeOwnerUserId, stagingSlug, staging[2]!);
    if (session) return adminUserSessionHref(opts.scopeOwnerUserId, session[1]!);
    if (root && rootSlug) return adminUserModuleHref(opts.scopeOwnerUserId, normalizeScopedModule(rootSlug));
    return null;
  }

  if (!opts.athleteId) return null;
  if (staging && stagingSlug) return coachAthleteStagingHref(opts.athleteId, stagingSlug, staging[2]!);
  if (session) return coachAthleteSessionHref(opts.athleteId, session[1]!);
  if (root && rootSlug) return coachAthleteModuleHref(opts.athleteId, normalizeScopedModule(rootSlug));
  return null;
}
