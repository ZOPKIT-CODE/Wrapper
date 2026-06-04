/**
 * Tenant-UUID-stamping regression tests (wrapper publisher chokepoint).
 *
 * These guard the root-cause fix for the cross-app tenant_id divergence:
 * the wrapper must (a) translate the envelope tenantId to the idpOrgId form that
 * downstream apps join on, AND (b) stamp the canonical wrapper UUID onto
 * `eventData.wrapperTenantId` so FA can pin its (text) tenant_id to the SAME id —
 * even for incremental events that arrive before tenant.onboarded.
 */

import { describe, it, expect } from 'vitest';
import { resolveEnvelopeTenant, applyCanonicalStamp } from './tenant-stamp';

const WRAPPER_UUID = '58f6ac21-0e74-4358-8c27-f2db5f66dfc5';
const IDP_ORG_ID   = 'org_tata_1780503798032';

describe('resolveEnvelopeTenant', () => {
  it('UUID input → envelope becomes idpOrgId, canonical UUID captured', () => {
    const r = resolveEnvelopeTenant({ tenantId: WRAPPER_UUID, idpOrgIdForUuid: IDP_ORG_ID });
    expect(r.envelopeTenantId).toBe(IDP_ORG_ID);     // downstream joins on idpOrgId
    expect(r.wrapperTenantId).toBe(WRAPPER_UUID);    // canonical id preserved for pinning
  });

  it('UUID input with no idpOrgId on file → envelope stays the UUID, still captures canonical', () => {
    const r = resolveEnvelopeTenant({ tenantId: WRAPPER_UUID, idpOrgIdForUuid: null });
    expect(r.envelopeTenantId).toBe(WRAPPER_UUID);
    expect(r.wrapperTenantId).toBe(WRAPPER_UUID);
  });

  it('idpOrgId input → envelope unchanged, canonical UUID resolved via reverse lookup', () => {
    const r = resolveEnvelopeTenant({ tenantId: IDP_ORG_ID, uuidForIdpOrg: WRAPPER_UUID });
    expect(r.envelopeTenantId).toBe(IDP_ORG_ID);
    expect(r.wrapperTenantId).toBe(WRAPPER_UUID);
  });

  it('idpOrgId input with no matching tenant → no canonical id (undefined, never invented)', () => {
    const r = resolveEnvelopeTenant({ tenantId: IDP_ORG_ID, uuidForIdpOrg: null });
    expect(r.envelopeTenantId).toBe(IDP_ORG_ID);
    expect(r.wrapperTenantId).toBeUndefined();
  });

  it('non-uuid, non-org input → passed through unchanged', () => {
    const r = resolveEnvelopeTenant({ tenantId: 'legacy-slug' });
    expect(r.envelopeTenantId).toBe('legacy-slug');
    expect(r.wrapperTenantId).toBeUndefined();
  });

  it('empty input → safe passthrough', () => {
    const r = resolveEnvelopeTenant({ tenantId: '' });
    expect(r.envelopeTenantId).toBe('');
    expect(r.wrapperTenantId).toBeUndefined();
  });
});

describe('applyCanonicalStamp', () => {
  it('adds wrapperTenantId when absent', () => {
    const out = applyCanonicalStamp({ userId: 'u1' }, WRAPPER_UUID);
    expect(out.wrapperTenantId).toBe(WRAPPER_UUID);
    expect(out.userId).toBe('u1');
  });

  it('does NOT mutate the caller object', () => {
    const input = { userId: 'u1' };
    const out = applyCanonicalStamp(input, WRAPPER_UUID);
    expect(input).not.toHaveProperty('wrapperTenantId'); // original untouched
    expect(out).not.toBe(input);                         // new object
  });

  it('never overwrites an explicit wrapperTenantId the caller supplied', () => {
    const explicit = 'caller-supplied-uuid';
    const out = applyCanonicalStamp({ wrapperTenantId: explicit }, WRAPPER_UUID);
    expect(out.wrapperTenantId).toBe(explicit);
  });

  it('no-op when there is no canonical id to stamp', () => {
    const input = { userId: 'u1' };
    const out = applyCanonicalStamp(input, undefined);
    expect(out).toBe(input);                  // returns the same ref (no clone)
    expect(out).not.toHaveProperty('wrapperTenantId');
  });
});

describe('end-to-end stamping contract (the bug this prevents)', () => {
  it('an org.assignment published with the wrapper UUID carries wrapperTenantId downstream', () => {
    // Simulate the publisher chokepoint for an org.assignment.created whose caller
    // passed the wrapper UUID. FA must receive both the idpOrgId envelope AND the
    // canonical UUID so it never mints a divergent tenant_id.
    const resolution = resolveEnvelopeTenant({ tenantId: WRAPPER_UUID, idpOrgIdForUuid: IDP_ORG_ID });
    const eventData = applyCanonicalStamp({ userId: 'u1', email: 'a@b.com' }, resolution.wrapperTenantId);

    expect(resolution.envelopeTenantId).toBe(IDP_ORG_ID);
    expect(eventData.wrapperTenantId).toBe(WRAPPER_UUID);
  });
});
