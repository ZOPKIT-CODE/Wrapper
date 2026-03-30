import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  connectMock,
  acknowledgeInterAppEventMock,
  publishInterAppEventMock,
  channelState,
} = vi.hoisted(() => {
  const channelState = {
    consumeHandler: null as ((msg: any) => Promise<void> | void) | null,
  };

  const ack = vi.fn();
  const nack = vi.fn();
  const sendToQueue = vi.fn(() => true);
  const assertQueue = vi.fn(async () => undefined);
  const prefetch = vi.fn(async () => undefined);
  const cancel = vi.fn(async () => undefined);
  const closeChannel = vi.fn(async () => undefined);

  const channel = {
    assertQueue,
    prefetch,
    consume: vi.fn(async (_queue: string, handler: (msg: any) => Promise<void>, _opts: any) => {
      channelState.consumeHandler = handler;
      return { consumerTag: 'ctag-1' };
    }),
    ack,
    nack,
    sendToQueue,
    cancel,
    close: closeChannel,
  };

  const closeConnection = vi.fn(async () => undefined);
  const on = vi.fn();
  const connection = {
    createChannel: vi.fn(async () => channel),
    on,
    close: closeConnection,
    readyState: 'open',
  };

  const connectMock = vi.fn(async () => connection);
  const acknowledgeInterAppEventMock = vi.fn(async () => undefined);
  const publishInterAppEventMock = vi.fn(async () => ({ success: true }));

  return {
    connectMock,
    acknowledgeInterAppEventMock,
    publishInterAppEventMock,
    channelState,
  };
});

vi.mock('amqplib', () => ({
  default: {
    connect: connectMock,
  },
}));

vi.mock('./inter-app-event-service.js', () => ({
  InterAppEventService: {
    acknowledgeInterAppEvent: acknowledgeInterAppEventMock,
  },
}));

vi.mock('../utils/amazon-mq-publisher.js', () => ({
  amazonMQPublisher: {
    publishInterAppEvent: publishInterAppEventMock,
  },
}));

import AmazonMQInterAppConsumer from './amazon-mq-consumer.js';

function buildMsg(payload: unknown, headers?: Record<string, unknown>) {
  return {
    content: Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)),
    properties: {
      messageId: 'msg-1',
      headers: headers || {},
    },
    fields: {
      deliveryTag: 1,
      routingKey: 'wrapper.events.user.created',
    },
  };
}

describe('amazon-mq-consumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelState.consumeHandler = null;
    process.env.AMAZON_MQ_URL = 'amqps://user:pass@mq.example.com:5671';
  });

  it('connects and configures queues/prefetch', async () => {
    const consumer = new AmazonMQInterAppConsumer();

    await consumer.connect();

    expect(connectMock).toHaveBeenCalledWith('amqps://user:pass@mq.example.com:5671');
    expect(consumer.channel!.assertQueue).toHaveBeenCalledWith('wrapper-events', expect.any(Object));
    expect(consumer.channel!.assertQueue).toHaveBeenCalledWith('wrapper-events.retry', expect.any(Object));
    expect(consumer.channel!.prefetch).toHaveBeenCalledWith(10);
  });

  it('acks message after successful processing', async () => {
    const consumer = new AmazonMQInterAppConsumer();
    const handleSpy = vi.spyOn(consumer, 'handleEventByType').mockResolvedValue(undefined);

    await consumer.start();
    const handler = channelState.consumeHandler;
    expect(handler).toBeTruthy();

    await handler!(
      buildMsg({
        eventId: 'evt-1',
        eventType: 'user.created',
        sourceApplication: 'ops',
        targetApplication: 'wrapper',
        tenantId: 't-1',
      })
    );

    expect(handleSpy).toHaveBeenCalledTimes(1);
    expect(consumer.channel!.ack).toHaveBeenCalledTimes(1);
    expect(consumer.channel!.nack).not.toHaveBeenCalled();
  });

  it('sends message to retry queue when processing fails below max retries', async () => {
    const consumer = new AmazonMQInterAppConsumer();
    vi.spyOn(consumer, 'handleEventByType').mockRejectedValue(new Error('transient failure'));

    await consumer.start();
    const handler = channelState.consumeHandler;
    expect(handler).toBeTruthy();

    await handler!(
      buildMsg(
        {
          eventId: 'evt-2',
          eventType: 'credit.allocated',
          sourceApplication: 'ops',
          targetApplication: 'wrapper',
          tenantId: 't-2',
        },
        { 'x-retry-count': 0 }
      )
    );

    expect(consumer.channel!.sendToQueue).toHaveBeenCalledWith(
      'wrapper-events.retry',
      expect.any(Buffer),
      expect.objectContaining({
        messageId: 'msg-1',
        headers: expect.objectContaining({ 'x-retry-count': 1 }),
      })
    );
    expect(consumer.channel!.ack).toHaveBeenCalledTimes(1);
    expect(consumer.channel!.nack).not.toHaveBeenCalled();
  });

  it('publishes failure event and nacks when max retries are exceeded', async () => {
    const consumer = new AmazonMQInterAppConsumer();
    vi.spyOn(consumer, 'handleEventByType').mockRejectedValue(new Error('permanent failure'));

    await consumer.start();
    const handler = channelState.consumeHandler;
    expect(handler).toBeTruthy();

    await handler!(
      buildMsg(
        {
          eventId: 'evt-3',
          eventType: 'org.created',
          sourceApplication: 'ops',
          targetApplication: 'wrapper',
          tenantId: 't-3',
          entityId: 'e-3',
        },
        { 'x-retry-count': 2 }
      )
    );

    expect(publishInterAppEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'event.processing.failed',
        sourceApplication: 'wrapper',
        targetApplication: 'ops',
        tenantId: 't-3',
        entityId: 'e-3',
      })
    );
    expect(consumer.channel!.nack).toHaveBeenCalledWith(expect.any(Object), false, false);
  });

  it('stops consumer by cancelling and closing channel/connection', async () => {
    const consumer = new AmazonMQInterAppConsumer();

    await consumer.start();
    await consumer.stop();

    expect(consumer.channel).toBeNull();
    expect(consumer.connection).toBeNull();
  });
});

