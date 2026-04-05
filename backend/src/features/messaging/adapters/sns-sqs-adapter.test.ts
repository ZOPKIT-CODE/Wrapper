import { beforeEach, describe, expect, it, vi } from 'vitest';

const { snsSqsPublisherMock } = vi.hoisted(() => ({
  snsSqsPublisherMock: {
    isConfigured: vi.fn(() => true),
    initializeAtStartup: vi.fn(async () => true),
    publishInterAppEvent: vi.fn(async () => ({
      success: true,
      eventId: 'e1',
      routingKey: 'ops.user.created',
      messageId: 'm1',
    })),
    publishBroadcast: vi.fn(async () => ({ success: true, eventType: 'system.ping' })),
    disconnect: vi.fn(async () => undefined),
  },
}));

vi.mock('../utils/sns-sqs-publisher.js', () => ({
  snsSqsPublisher: snsSqsPublisherMock,
}));

import { getMessageBus, resetMessageBus, setMessageBus } from './sns-sqs-adapter.js';

describe('sns-sqs-adapter', () => {
  beforeEach(() => {
    resetMessageBus();
    vi.clearAllMocks();
  });

  it('publishes inter-app events via message-bus port', async () => {
    const bus = getMessageBus();
    const result = await bus.publishInterAppEvent({
      eventType: 'user.created',
      sourceApplication: 'wrapper',
      targetApplication: 'ops',
      tenantId: 't1',
      entityId: 'u1',
      eventData: { email: 'u@example.com' },
      publishedBy: 'test',
    });

    expect(snsSqsPublisherMock.publishInterAppEvent).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  it('allows bus replacement for isolated tests', async () => {
    const customBus = {
      isConfigured: vi.fn(() => true),
      initializeAtStartup: vi.fn(async () => true),
      publishInterAppEvent: vi.fn(async () => ({ success: true, eventId: 'x', routingKey: 'x', messageId: 'x' })),
      publishBroadcast: vi.fn(async () => ({ success: true, eventType: 'x' })),
      disconnect: vi.fn(async () => undefined),
    };
    setMessageBus(customBus);

    const bus = getMessageBus();
    await bus.publishBroadcast('health.check', { ok: true }, 'tester');

    expect(customBus.publishBroadcast).toHaveBeenCalledWith('health.check', { ok: true }, 'tester');
  });
});
