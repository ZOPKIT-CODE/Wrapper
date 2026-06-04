/**
 * Pure helpers for the inter-app envelope tenantId translation + canonical-UUID
 * stamping. Kept in a dependency-free module (no AWS SDK, no DB) so they can be
 * unit-tested exhaustively and reused by the publisher chokepoint.
 *
 * Why this exists — the cross-app tenant_id divergence fix:
 * Downstream apps (CRM, FA) join on the idpOrgId, but FA's `tenant_id` is a TEXT
 * PK that must equal the wrapper's canonical UUID. The publisher therefore both
 * translates the envelope to the idpOrgId AND stamps the canonical UUID onto
 * `eventData.wrapperTenantId`, so a consumer never has to invent (and diverge) an id.
 */

export const TENANT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pure decision for the envelope tenantId translation + canonical-UUID capture.
 * The publisher supplies the DB lookup results; this function has no side effects.
 *
 *   - org_* input  → envelope stays the idpOrgId; canonical UUID is the reverse
 *     lookup result (`uuidForIdpOrg`) if any.
 *   - UUID input   → envelope becomes the idpOrgId (`idpOrgIdForUuid`) when known,
 *     and the input UUID itself is the canonical wrapper id.
 *   - anything else → passed through unchanged, no canonical id.
 */
export function resolveEnvelopeTenant(input: {
  tenantId: string;
  idpOrgIdForUuid?: string | null;
  uuidForIdpOrg?: string | null;
}): { envelopeTenantId: string; wrapperTenantId?: string } {
  const { tenantId } = input;
  if (!tenantId) return { envelopeTenantId: tenantId };
  if (tenantId.startsWith('org_')) {
    return { envelopeTenantId: tenantId, wrapperTenantId: input.uuidForIdpOrg ?? undefined };
  }
  if (TENANT_UUID_RE.test(tenantId)) {
    return { envelopeTenantId: input.idpOrgIdForUuid ?? tenantId, wrapperTenantId: tenantId };
  }
  return { envelopeTenantId: tenantId };
}

/**
 * Stamp the canonical wrapper UUID onto the payload without mutating the
 * caller's object and without overwriting an explicit value already present.
 */
export function applyCanonicalStamp<T extends Record<string, unknown>>(
  eventData: T,
  wrapperTenantId: string | undefined,
): T {
  if (wrapperTenantId && eventData?.wrapperTenantId === undefined) {
    return { ...eventData, wrapperTenantId };
  }
  return eventData;
}
