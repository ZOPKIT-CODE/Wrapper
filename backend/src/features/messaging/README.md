# Messaging Feature

Amazon MQ (RabbitMQ)-based messaging infrastructure for inter-application events, job queues, and event tracking. This feature has no HTTP routes — it provides services and utilities consumed by other features.

## Directory Structure

```
messaging/
├── index.ts                                  # Feature exports
├── services/
│   ├── amazon-mq-consumer.ts                 # Event consumer from wrapper-events queue
│   ├── amazon-mq-job-queue.ts                # Job queue (immediate/bulk/scheduled)
│   ├── event-tracking-service.ts             # Event tracking with zero-db-success policy
│   └── inter-app-event-service.ts            # Inter-app event publishing and tracking
└── utils/
    └── amazon-mq-publisher.ts                # Amazon MQ publisher (topic + fanout exchanges)
```

## Endpoints

This feature does not define any HTTP routes. It is used internally by other features (credits, notifications, roles, organizations, etc.).

## Services

| Service | Description |
|---------|-------------|
| **AmazonMQConsumer** | Consumes from `wrapper-events` queue; handles event types: `user.created`, `user.deactivated`, `credit.allocated`, `org.created`, `role.*`. Acknowledges via InterAppEventService; retries then DLQ on failure |
| **AmazonMQJobQueue** | Job queue over Amazon MQ with exchange/queue declarations for immediate, bulk, and scheduled jobs. Used for notification processing. Supports add, schedule, cancel, and stats |
| **EventTrackingService** | Tracks published events with "zero-db-success" policy — only failed events are stored in DB. Provides event status, unacknowledged events, sync health metrics, and cleanup |
| **InterAppEventService** | High-level event API: publishEvent (via Amazon MQ), trackPublishedEvent, acknowledgeInterAppEvent, getCommunicationMatrix (tenant event counts and success rates by source/target app) |

## Utilities

| Utility | Description |
|---------|-------------|
| **AmazonMQPublisher** | Single publisher for Amazon MQ: topic exchange `inter-app-events`, fanout `inter-app-broadcast`. Publishes role, user, org, credit, and org-assignment events to applications. Handles routing keys, reconnection, and status |

## Event Contract: `accounting.entity.provision.requested`

This event is emitted by Wrapper when an eligible organization entity is created and should be auto-provisioned in the Accounting app.

- **sourceApplication:** `wrapper`
- **targetApplication:** `accounting`
- **eventType:** `accounting.entity.provision.requested`
- **idempotency:** `eventData.idempotencyKey = acct-provision:<tenantId>:<entityId>`

### Publish Rules

Wrapper publishes this event only when all conditions are true:

1. `entityType === "organization"`
2. `subType` is one of:
   - `subsidiary`
   - `branch`
   - `division`
   - `parent`
   - `business_unit`

### Payload Schema

```json
{
  "eventType": "accounting.entity.provision.requested",
  "sourceApplication": "wrapper",
  "targetApplication": "accounting",
  "tenantId": "uuid",
  "entityId": "uuid",
  "eventData": {
    "idempotencyKey": "acct-provision:<tenantId>:<entityId>",
    "entity": {
      "entityId": "uuid",
      "entityCode": "string",
      "entityName": "string",
      "entityType": "organization",
      "subType": "subsidiary|branch|division|parent|business_unit",
      "parentId": "uuid|null",
      "description": "string|null",
      "createdAt": "ISO-8601 string",
      "createdBy": "uuid|string|null"
    },
    "requestedBy": "wrapper.entity.created"
  }
}
```

### Consumer Requirements (Accounting)

- Treat `idempotencyKey` as the primary de-duplication key.
- Upsert by `(tenantId, entity.entityId)` or by `idempotencyKey`.
- Validate `entity.entityType === "organization"` and supported `subType` before provisioning.
- Resolve accounting parent linkage using `entity.parentId` if present; otherwise create as root/top-level.
- Acknowledge the event even when already provisioned (idempotent success).

## Ports and Adapters Convention

- Define messaging contracts in `ports/` (for example `ports/message-bus.ts`).
- Implement broker-specific details in `adapters/` (for example `adapters/amazon-mq-adapter.ts`).
- Services should rely on `MessageBusPort` accessors (`getMessageBus()`) rather than direct broker utilities where possible.
- New brokers must be introduced as additional adapters behind the same message bus port.
