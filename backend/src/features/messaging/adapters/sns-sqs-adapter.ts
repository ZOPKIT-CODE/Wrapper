import { snsSqsPublisher } from '../utils/sns-sqs-publisher.js';
import type { MessageBusPort } from '../ports/message-bus.js';

class SnsSqsMessageBusAdapter implements MessageBusPort {
  isConfigured(): boolean {
    return snsSqsPublisher.isConfigured();
  }

  initializeAtStartup(): Promise<boolean> {
    return snsSqsPublisher.initializeAtStartup();
  }

  publishInterAppEvent(payload: {
    eventType: string;
    sourceApplication: string;
    targetApplication: string;
    tenantId: string;
    entityId: string;
    eventData?: Record<string, unknown>;
    publishedBy?: string;
    eventId?: string;
  }): Promise<{ success: boolean; eventId: string; routingKey: string; messageId: string }> {
    return snsSqsPublisher.publishInterAppEvent(payload);
  }

  publishBroadcast(
    eventType: string,
    eventData: Record<string, unknown>,
    publishedBy = 'system'
  ): Promise<{ success: boolean; eventType: string }> {
    return snsSqsPublisher.publishBroadcast(eventType, eventData, publishedBy);
  }

  disconnect(): Promise<void> {
    return snsSqsPublisher.disconnect();
  }
}

let messageBus: MessageBusPort | null = null;

export function getMessageBus(): MessageBusPort {
  if (!messageBus) {
    messageBus = new SnsSqsMessageBusAdapter();
  }
  return messageBus;
}

export function setMessageBus(bus: MessageBusPort): void {
  messageBus = bus;
}

export function resetMessageBus(): void {
  messageBus = null;
}
