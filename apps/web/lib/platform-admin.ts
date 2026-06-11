import "server-only";

/**
 * Accesso `/admin` e `/api/admin/*`: la fonte di verità è SOLO il database —
 * `app_user_profiles.is_platform_admin`, modificabile unicamente via service_role
 * (trigger `app_user_profiles_protect_platform_fields`, migration 024).
 * Nessuna allowlist email di deploy: chi è admin lo decide il DB, il front-end legge.
 */
export function resolvePlatformAdminAccess(input: { profileIsAdmin?: boolean | null }): boolean {
  return input.profileIsAdmin === true;
}
