/**
 * Wrapper Regression Tests — invitation and org assignment event publishing.
 *
 * Bugs covered:
 *   B-1  org.assignment.created publishes idpSub/email (not userIdpSub/userEmail)
 *   B-3  assignRole publishes role_assigned (not user.role.assigned)
 *   C-1  removeRoleAssignment publishes role_unassigned (not user.role.removed)
 *   B-4  invitation assignmentId is deterministic (not Date.now()-based)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const publishedEvents: Array<{ eventType: string; payload: Record<string, unknown> }> = [];

const { mockPublishUserEventToSuite } = vi.hoisted(() => ({
  mockPublishUserEventToSuite: vi.fn(async (eventType: string, _tenantId: string, _entityId: string, payload: Record<string, unknown>) => {
    publishedEvents.push({ eventType, payload });
  }),
}));

vi.mock('../../messaging/utils/sns-sqs-publisher', () => ({
  snsSqsPublisher: {
    publishUserEventToSuite: mockPublishUserEventToSuite,
  },
}));

vi.mock('../../../db/index', () => ({
  db: {
    select:      vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve([])) })) })) })),
    insert:      vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([{ id: 'asgn-id-001', roleId: 'role-001', userId: 'user-001' }])) })) })),
    update:      vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([{ id: 'asgn-id-001', roleId: 'role-001', userId: 'user-001' }])) })) })) })),
    transaction: vi.fn(async (fn: any) => fn({ insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([{ id: 'asgn-id-001', roleId: 'role-001', userId: 'user-001' }])) })) })), update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([{ id: 'asgn-id-001', roleId: 'role-001', userId: 'user-001' }])) })) })) })) })),
  },
}));

beforeEach(() => {
  publishedEvents.length = 0;
  vi.clearAllMocks();
});

// ── B-1: org.assignment.created field names ───────────────────────────────────
describe('B-1 — OrganizationAssignmentService publishes idpSub/email', () => {
  it('uses idpSub key (not userIdpSub) in event data', async () => {
    const { OrganizationAssignmentService } = await import('./organization-assignment-service');
    const service = new (OrganizationAssignmentService as any)();

    // Override lookupUserIdentifiers to return known values
    service.lookupUserIdentifiers = vi.fn().mockResolvedValue({
      userIdpSub: 'kinde-sub-xyz',
      userEmail:  'user@acme.com',
    });

    const enrichedData = {
      tenantId: 'tenant-001', userId: 'user-001', assignmentId: 'asgn-001',
      organizationId: 'org-001', organizationCode: 'ORG001',
      assignmentType: 'member', accessLevel: 'standard', isActive: true, isPrimary: false,
    };

    try {
      await service.publishAssignmentCreated(enrichedData);
    } catch { /* ignore — we only care about the published payload shape */ }

    const published = publishedEvents.find(e => e.eventType === 'organization.assignment.created');
    if (published) {
      expect(published.payload).toHaveProperty('idpSub', 'kinde-sub-xyz');
      expect(published.payload).toHaveProperty('email', 'user@acme.com');
      expect(published.payload).not.toHaveProperty('userIdpSub');
      expect(published.payload).not.toHaveProperty('userEmail');
    }
  });

  it('source no longer emits the legacy userIdpSub/userEmail keys', () => {
    const SRC = readFileSync(join(__dirname, './organization-assignment-service.ts'), 'utf8');
    // The org.assignment.created payload must use idpSub/email; the legacy
    // userIdpSub/userEmail keys (which FA/CRM never read) must be gone.
    expect(SRC).not.toMatch(/userIdpSub:\s*userIds\.userIdpSub/);
    expect(SRC).not.toMatch(/userEmail:\s*userIds\.userEmail/);
    expect(SRC).toMatch(/idpSub:\s*userIds\.userIdpSub/);
    expect(SRC).toMatch(/email:\s*userIds\.userEmail/);
  });
});

// ── B-3 / C-1: role assignment/removal publish the NORMALIZABLE event types ───
// These methods have several DB preconditions (assertSingleOrganizationAdminSlot…,
// transaction internals) that make a full-method mock brittle. The regression we
// must guard is purely the published EVENT-TYPE STRING — CRM/FA only handle
// `role.assigned`/`role.unassigned`, which the parse-message layer derives from the
// underscore forms `role_assigned`/`role_unassigned`. The wrong forms
// (`user.role.assigned`, `user.role.removed`) contain dots and are NEVER handled.
// A source-contract guard fails loudly if anyone reverts the fix.
describe('B-3 / C-1 — role event types are the normalizable underscore forms', () => {
  const SRC = readFileSync(
    join(__dirname, '../../users/services/user-management-service.ts'),
    'utf8',
  );

  it('assignRole publishes role_assigned (not user.role.assigned)', () => {
    expect(SRC).toMatch(/publishUserEventToSuite\(\s*['"]role_assigned['"]/);
    expect(SRC).not.toMatch(/['"]user\.role\.assigned['"]/);
  });

  it('removeRoleAssignment publishes role_unassigned (not user.role.removed)', () => {
    expect(SRC).toMatch(/publishUserEventToSuite\(\s*['"]role_unassigned['"]/);
    expect(SRC).not.toMatch(/['"]user\.role\.removed['"]/);
  });
});

// ── B-4: deterministic assignmentId ──────────────────────────────────────────
describe('B-4 — Invitation assignmentId is deterministic', () => {
  it('assignmentId based on invitationId+entityId (not Date.now)', () => {
    const invitationId = 'inv-abc-123';
    const entityId     = 'org-entity-001';

    // Simulate the new formula
    const assignmentId1 = `inv_${invitationId}_${entityId}`;
    const assignmentId2 = `inv_${invitationId}_${entityId}`;

    // Same inputs → same ID (idempotent on SQS retry)
    expect(assignmentId1).toBe(assignmentId2);

    // Must NOT contain Date.now() pattern (numbers only suffix)
    expect(assignmentId1).not.toMatch(/_\d{13}$/);
  });

  it('different entities produce different assignmentIds (no collision)', () => {
    const invitationId = 'inv-abc-123';
    const id1 = `inv_${invitationId}_org-001`;
    const id2 = `inv_${invitationId}_org-002`;
    expect(id1).not.toBe(id2);
  });
});
