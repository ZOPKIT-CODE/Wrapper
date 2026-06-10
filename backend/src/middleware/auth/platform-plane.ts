// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM PLANE identity
//
// "Platform admin" is an INTERNAL operator plane that is completely distinct from
// any tenant-scoped role. It is NOT `isSuperAdmin` — that flag means "has a
// system role *within a tenant*" and every tenant's founding admin has it, so it
// must never gate cross-tenant actions.
//
// The canonical platform-admin signal is membership of a dedicated Cognito group
// (`COGNITO_PLATFORM_ADMIN_GROUP`, default `platform-admins`), surfaced via the
// native `cognito:groups` token claim. A small break-glass email allowlist
// (`PLATFORM_ADMIN_BOOTSTRAP_EMAILS`) exists ONLY to seat the first admin or
// recover access; it should be emptied once the Cognito group is populated.
// ─────────────────────────────────────────────────────────────────────────────

function platformAdminGroup(): string {
  return (process.env.COGNITO_PLATFORM_ADMIN_GROUP || 'platform-admins').trim();
}

function bootstrapEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_BOOTSTRAP_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * True when the authenticated identity is an internal platform admin — i.e. a
 * member of the platform-admin Cognito group, or (break-glass) on the bootstrap
 * email allowlist. This is the ONLY source of `userContext.isPlatformAdmin`.
 */
export function isPlatformAdminIdentity(input: { groups?: string[] | null; email?: string | null }): boolean {
  const group = platformAdminGroup();
  if (Array.isArray(input.groups) && input.groups.includes(group)) return true;

  const email = input.email?.trim().toLowerCase();
  if (email && bootstrapEmails().includes(email)) return true;

  return false;
}
