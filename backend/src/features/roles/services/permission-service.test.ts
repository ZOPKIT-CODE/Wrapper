import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../db/index.js', () => ({
  db: {},
}));

vi.mock('../../messaging/utils/sns-sqs-publisher.js', () => ({
  snsSqsPublisher: {},
}));

import permissionService from './permission-service.js';

describe('permission-service pure logic', () => {
  it('validates time restrictions by hour/day/weekend', () => {
    const blockedHour = permissionService.validateTimeRestrictions(
      { allowedHours: [9, 10], allowedDays: [1, 2, 3, 4, 5] },
      new Date('2026-03-08T07:00:00.000Z'),
    );
    expect(blockedHour.allowed).toBe(false);

    const blockedWeekend = permissionService.validateTimeRestrictions(
      { blockWeekends: true },
      new Date('2026-03-08T10:00:00.000Z'),
    );
    expect(blockedWeekend.allowed).toBe(false);
  });

  it('validates IP restrictions allow/block behavior', () => {
    const denied = permissionService.validateIPRestrictions(
      { blockedIPs: ['10.0.0.1'] },
      '10.0.0.1',
    );
    expect(denied.allowed).toBe(false);

    const allowed = permissionService.validateIPRestrictions(
      { allowedIPs: ['10.0.0.2'] },
      '10.0.0.2',
    );
    expect(allowed.allowed).toBe(true);
  });

  it('validates resource permission level and operation', () => {
    const perms = {
      'crm.contacts': {
        level: 'read',
        operations: ['view'],
        scope: 'own',
      },
    };

    const canView = permissionService.validateResourcePermission(perms, 'crm.contacts', 'view');
    const canDelete = permissionService.validateResourcePermission(perms, 'crm.contacts', 'delete');

    expect(canView.allowed).toBe(true);
    expect(canDelete.allowed).toBe(false);
  });

  it('converts flat permission arrays to structured resources', () => {
    const structured = permissionService.convertArrayPermissionsToStructured([
      'crm.contacts.read',
      'crm.contacts.create',
      'crm.leads.read',
    ]);

    expect(structured['crm.contacts']).toBeDefined();
    expect((structured['crm.contacts'] as { operations: string[] }).operations).toContain('crm.contacts.read');
    expect(structured['crm.leads']).toBeDefined();
  });
});
