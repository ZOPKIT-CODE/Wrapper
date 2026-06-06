/**
 * tx-bound publish path (dual-write fix): when a caller threads its domain
 * transaction, the outbox row is written via that tx (atomic with the domain
 * write) and the synchronous SNS publish is SKIPPED — the outbox poller delivers
 * after commit. This closes the dual-write window.
 *
 * The real AWS SNS/S3 SDKs are mocked only so the publisher imports under vitest
 * (the @smithy ESM subpath doesn't resolve in vitest); the tx logic under test is
 * the real code.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient: class { send = vi.fn(async () => ({ MessageId: 'should-not-be-used' })); },
  PublishCommand: class { constructor(public input: unknown) {} },
  GetTopicAttributesCommand: class { constructor(public input: unknown) {} },
}));
vi.mock('./large-payload-store.js', () => ({
  maybeOffloadToS3: async (_id: string, eventData: unknown) => ({ eventData }),
}));

vi.mock('@sentry/node', () => ({
  addBreadcrumb: vi.fn(), withScope: vi.fn((cb: (s: unknown) => void) => cb({ setTag: vi.fn(), setContext: vi.fn() })),
  captureException: vi.fn(), setTag: vi.fn(), setContext: vi.fn(),
  // Producer-span wrapper around publish — pass through to the callback so the
  // tx/outbox logic under test runs unchanged.
  startSpan: vi.fn((_opts: unknown, cb: (span: unknown) => unknown) =>
    cb({ setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() })),
}));

import { snsSqsPublisher } from './sns-sqs-publisher';

beforeAll(() => {
  process.env.SNS_INTER_APP_TOPIC_ARN ||= 'arn:aws:sns:us-east-1:000000000000:test';
});

describe('publishInterAppEvent — tx-bound (atomic) path', () => {
  it('writes inter_app_outbox via the caller tx and SKIPS the SNS publish', async () => {
    const sendSpy = (snsSqsPublisher as any).client.send as ReturnType<typeof vi.fn>;
    sendSpy.mockClear();
    let lastSql = '';
    const fakeTx = {
      execute: vi.fn(async (q: unknown) => {
        lastSql = JSON.stringify((q as { queryChunks?: unknown })?.queryChunks ?? q).toLowerCase();
        return { rows: [] };
      }),
    };

    const res = await snsSqsPublisher.publishInterAppEvent({
      eventType: 'role.created',
      sourceApplication: 'wrapper',
      targetApplication: 'crm',
      tenantId: 'org_test', // org_ form → skips the idpOrgId DB translation (no real DB)
      entityId: 'role-1',
      eventData: { roleId: 'role-1' },
      eventId: 'evt-tx-1',
      tx: fakeTx as never,
    });

    expect(fakeTx.execute).toHaveBeenCalledTimes(1);
    expect(lastSql).toContain('inter_app_outbox');
    expect(sendSpy).not.toHaveBeenCalled();
    expect(res).toEqual({ success: true, eventId: 'evt-tx-1', routingKey: expect.any(String), messageId: 'evt-tx-1' });
  });
});

describe('publishRoleEventToSuite — tx-bound (atomic) path', () => {
  const apps = (snsSqsPublisher as unknown as { businessSuiteApps: string[] }).businessSuiteApps;

  it('writes one outbox row per business-suite app via the tx and SKIPS SNS', async () => {
    const sendSpy = (snsSqsPublisher as any).client.send as ReturnType<typeof vi.fn>;
    sendSpy.mockClear();
    const fakeTx = { execute: vi.fn(async () => ({ rows: [] })) };

    const results = await snsSqsPublisher.publishRoleEventToSuite(
      'role_updated', 'org_x', 'role-1', { roleName: 'R' }, 'system', fakeTx as never,
    );

    expect(fakeTx.execute).toHaveBeenCalledTimes(apps.length); // one outbox INSERT per app
    expect(sendSpy).not.toHaveBeenCalled();                     // SNS skipped — poller delivers
    expect(results).toHaveLength(apps.length);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('PROPAGATES a failed outbox insert in tx mode (so the caller transaction rolls back)', async () => {
    const badTx = { execute: vi.fn(async () => { throw new Error('db down'); }) };
    await expect(
      snsSqsPublisher.publishRoleEventToSuite('role_updated', 'org_x', 'role-1', { roleName: 'R' }, 'system', badTx as never),
    ).rejects.toThrow(); // NOT swallowed — atomicity depends on this
  });
});

describe('publishUserEventToSuite — tx-bound (atomic) path', () => {
  const apps = (snsSqsPublisher as unknown as { businessSuiteApps: string[] }).businessSuiteApps;

  it('writes one outbox row per business-suite app via the tx and SKIPS SNS', async () => {
    const sendSpy = (snsSqsPublisher as any).client.send as ReturnType<typeof vi.fn>;
    sendSpy.mockClear();
    const fakeTx = { execute: vi.fn(async () => ({ rows: [] })) };

    const results = await snsSqsPublisher.publishUserEventToSuite(
      'user.updated', 'org_x', 'user-1', { email: 'a@b.c' }, 'system', fakeTx as never,
    );

    expect(fakeTx.execute).toHaveBeenCalledTimes(apps.length);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(results).toHaveLength(apps.length);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('PROPAGATES a failed outbox insert in tx mode (rolls the caller transaction back)', async () => {
    const badTx = { execute: vi.fn(async () => { throw new Error('db down'); }) };
    await expect(
      snsSqsPublisher.publishUserEventToSuite('user.updated', 'org_x', 'user-1', { email: 'a@b.c' }, 'system', badTx as never),
    ).rejects.toThrow();
  });
});

describe('publishOrgAssignmentEventToSuite — tx-bound (atomic) path', () => {
  const apps = (snsSqsPublisher as unknown as { businessSuiteApps: string[] }).businessSuiteApps;

  it('writes one outbox row per business-suite app via the tx and SKIPS SNS', async () => {
    const sendSpy = (snsSqsPublisher as any).client.send as ReturnType<typeof vi.fn>;
    sendSpy.mockClear();
    const fakeTx = { execute: vi.fn(async () => ({ rows: [] })) };

    const results = await snsSqsPublisher.publishOrgAssignmentEventToSuite(
      'organization.assignment.created', 'org_x', { assignmentId: 'a1', userId: 'u1' }, 'system', fakeTx as never,
    );

    expect(fakeTx.execute).toHaveBeenCalledTimes(apps.length);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(results).toHaveLength(apps.length);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('PROPAGATES a failed outbox insert in tx mode (rolls the caller transaction back)', async () => {
    const badTx = { execute: vi.fn(async () => { throw new Error('db down'); }) };
    await expect(
      snsSqsPublisher.publishOrgAssignmentEventToSuite('organization.assignment.created', 'org_x', { assignmentId: 'a1', userId: 'u1' }, 'system', badTx as never),
    ).rejects.toThrow();
  });
});
