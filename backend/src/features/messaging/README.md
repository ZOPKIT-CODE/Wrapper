# Messaging Feature

AWS SNS + SQS-based messaging infrastructure for inter-application events, job queues, and event tracking. This feature has no HTTP routes — it provides services and utilities consumed by other features.

## Architecture at a glance

- **SNS (topics)** is used for fan-out publishing.
  - `SNS_INTER_APP_TOPIC_ARN` — targeted inter-app events. Each subscribed app's SQS queue filters by `MessageAttributes.targetApplication`.
  - `SNS_BROADCAST_TOPIC_ARN` — events every app needs (e.g. `tenant.onboarded`, `role.*`).
- **SQS (queues)** is used for two distinct things:
  - **Per-app inbox** — each app (wrapper / FA / CRM) has its own queue subscribed to the SNS topics above and long-polled by `SqsInterAppConsumer`.
  - **Direct job queue** — `sqs-job-queue.ts` sends straight to a queue (no SNS in front) for single-pool workloads like notification processing.
- **Durability** — every inter-app event is written to the `inter_app_outbox` table _before_ the SNS publish. If publish fails, `OutboxPoller` retries the row on its tick. Cluster-wide single-runner is enforced via Postgres advisory locks.
- **Large payloads** — events over ~200 KB are offloaded to S3 via `large-payload-store.ts` (claim-check pattern) so they fit under SQS's 256 KB limit.

## Directory Structure

```
messaging/
├── index.ts                                  # Feature exports
├── ports/
│   └── message-bus.ts                        # MessageBusPort contract
├── adapters/
│   └── sns-sqs-adapter.ts                    # MessageBusPort → snsSqsPublisher
├── services/
│   ├── sqs-consumer.ts                       # Per-app SQS inbox consumer (long-polls SNS-wrapped messages)
│   ├── sqs-job-queue.ts                      # Direct SQS job queue (immediate/bulk/scheduled)
│   ├── outbox-poller.ts                      # Retries unpublished inter_app_outbox rows
│   ├── outbox-replay-worker.ts               # Replay worker for failed event_tracking rows
│   ├── event-tracking-service.ts             # Event tracking with zero-db-success policy
│   ├── inter-app-event-service.ts            # High-level publish/ack API
│   ├── tenant-application-event-service.ts   # Tenant-application event emission
│   ├── accounting-entity-provisioning-service.ts # Emits accounting.entity.provision.requested
│   └── event-id.ts                           # Deterministic outbox event IDs
└── utils/
    ├── sns-sqs-publisher.ts                  # SNS PublishCommand wrapper (targeted + broadcast)
    └── large-payload-store.ts                # S3 claim-check for >200 KB payloads
```

## Endpoints

This feature does not define any HTTP routes. It is used internally by other features (credits, notifications, roles, organizations, etc.).

## Services

| Service | Description |
|---------|-------------|
| **SqsInterAppConsumer** | Long-polls the app's SQS inbox (`SQS_WRAPPER_QUEUE_URL`), unwraps the SNS notification envelope, and dispatches to handlers for event types: `user.created`, `user.deactivated`, `credit.allocated`, `org.created`, `role.*`, etc. Retries with visibility-timeout backoff, then DLQ on max receive count |
| **SqsJobQueue** | Direct SQS job queue (no SNS) for immediate, bulk, and scheduled jobs. Used for notification processing. Supports add, schedule, cancel, and stats |
| **OutboxPoller** | Re-publishes inter-app events whose initial SNS publish failed. Reads `inter_app_outbox` rows with `published_at IS NULL`, retries via `snsSqsPublisher`, applies a per-row backoff. Single-runner via `pg_try_advisory_lock(8001)` |
| **OutboxReplayWorker** | Replays failed `event_tracking` rows. Cluster-deduplicated via a session-level advisory lock (`0x57524b52` — "WRKR") |
| **EventTrackingService** | Tracks published events with "zero-db-success" policy — only failed events are stored in DB. Provides event status, unacknowledged events, sync health metrics, and cleanup |
| **InterAppEventService** | High-level event API: `publishEvent` (writes outbox row, publishes via SNS), `trackPublishedEvent`, `acknowledgeInterAppEvent`, `getCommunicationMatrix` (tenant event counts and success rates by source/target app) |
| **TenantApplicationEventService** | Emits tenant-application lifecycle events (plan changes, module assignments, permission updates, bulk and removal flows) |
| **AccountingEntityProvisioningService** | Emits `accounting.entity.provision.requested` for eligible org entities (see contract below) |

## Utilities

| Utility | Description |
|---------|-------------|
| **snsSqsPublisher** | Single publisher: calls `PublishCommand` against `SNS_INTER_APP_TOPIC_ARN` (targeted) and `SNS_BROADCAST_TOPIC_ARN` (broadcast). Sets `MessageAttributes` (`targetApplication`, `eventType`) so subscribed SQS queues filter correctly. Handles reconnect status and circuit breaker |
| **largePayloadStore** | Claim-check for SNS/SQS payloads >200 KB. Uploads `eventData` to S3, replaces it with `{ _s3Ref: { bucket, key } }` in the SNS message. Consumer resolves the pointer transparently before invoking handlers. Backward compatible — payloads under threshold pass through unchanged |

## Required environment

| Variable | Purpose |
|---|---|
| `SNS_INTER_APP_TOPIC_ARN` | Topic used for targeted inter-app publishes |
| `SNS_BROADCAST_TOPIC_ARN` | Topic used for broadcasts to every app |
| `SQS_WRAPPER_QUEUE_URL` | This app's inbox; consumer disables itself when unset |
| `SQS_MAX_MESSAGES` / `SQS_VISIBILITY_TIMEOUT` / `SQS_WAIT_TIME_SECONDS` | Long-poll tuning (defaults: 10 / 30s / 20s) |
| `SNS_LARGE_PAYLOAD_BUCKET` | S3 bucket for claim-check offload; offload disabled when unset |
| `AWS_MESSAGING_ACCESS_KEY_ID` / `AWS_MESSAGING_SECRET_ACCESS_KEY` | Messaging-scoped AWS credentials (falls back to `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) |
| `OUTBOX_POLL_INTERVAL_MS` / `OUTBOX_POLL_BATCH` / `OUTBOX_RETRY_BACKOFF_SECONDS` | Outbox poller tuning |

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
- Implement broker-specific details in `adapters/` (currently `adapters/sns-sqs-adapter.ts`).
- Services should rely on `MessageBusPort` accessors (`getMessageBus()`) rather than direct broker utilities where possible.
- New brokers must be introduced as additional adapters behind the same message bus port.
