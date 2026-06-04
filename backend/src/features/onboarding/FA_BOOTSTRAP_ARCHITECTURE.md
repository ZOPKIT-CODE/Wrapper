# FA Bootstrap — Architectural Decision: SNS+SQS vs Bootstrap API

**Decision**: SNS+SQS push is the primary path. Bootstrap API is the recovery fallback.

---

## Table of Contents

1. [The Decision & Why](#1-the-decision--why)
2. [Why Not Bootstrap API as Primary](#2-why-not-bootstrap-api-as-primary)
3. [Why SNS+SQS as Primary](#3-why-snssqs-as-primary)
4. [Architecture Diagram](#4-architecture-diagram)
5. [What Wrapper Emits (FA's Input)](#5-what-wrapper-emits-fas-input)
6. [How FA Must Consume the Events](#6-how-fa-must-consume-the-events)
7. [Idempotency — The Most Critical Requirement](#7-idempotency--the-most-critical-requirement)
8. [Retry and DLQ Strategy](#8-retry-and-dlq-strategy)
9. [Fallback: Bootstrap API](#9-fallback-bootstrap-api)
10. [FA Consumer Implementation Spec](#10-fa-consumer-implementation-spec)
11. [Topic, Queue & Subscription Topology](#11-topic-queue--subscription-topology)
12. [What FA Stores After Consuming](#12-what-fa-stores-after-consuming)
13. [Failure Scenarios & Recovery](#13-failure-scenarios--recovery)

---

## 1. The Decision & Why

**Use AWS SNS + SQS as the primary bootstrap path. Use the Bootstrap API only as a recovery mechanism.**

The infrastructure for this already exists in Wrapper:
- `tenant.onboarded` event is already emitted post-onboarding with the full snapshot, published to the `SNS_INTER_APP_TOPIC_ARN` topic
- `inter_app_outbox` table persists every event — `OutboxPoller` retries unpublished rows even after transient SNS or network failures
- `SqsInterAppConsumer` shows the exact consumer pattern FA should mirror
- `POST /api/sync/tenants/:id/bootstrap` exists as a pull fallback

The decision is not between two equally valid options. Push via SNS+SQS is strictly better for a multi-tenant SaaS at scale. The Bootstrap API exists to handle the cases where SNS delivery fails — not to replace it.

---

## 2. Why Not Bootstrap API as Primary

The pull model creates a **synchronous HTTP dependency at the worst possible moment** — first user login.

| Problem | Impact |
|---------|--------|
| FA must call Wrapper at login time | If Wrapper is degraded, FA's first login fails |
| Cold-start latency | First user login is always slower than subsequent ones (extra HTTP round-trip) |
| Thundering herd | 100 tenants all onboarding in a window → 100 simultaneous bootstrap calls to Wrapper at login time |
| Tight temporal coupling | FA is blocked until Wrapper responds |
| No buffering | If FA is down during first login, the request fails — there is no queue to absorb it |
| Polling risk | If FA retries the bootstrap API on failure, it amplifies load on Wrapper under pressure |

The Bootstrap API is a fine **reconciliation** tool. It is a bad **primary delivery** mechanism.

---

## 3. Why SNS+SQS as Primary

| Property | What It Gives FA |
|----------|-----------------|
| **Decoupling** | FA receives data with no runtime HTTP dependency on Wrapper |
| **Pre-warmed data** | By the time first user logs in, FA already has tenant data in its own DB |
| **Durability** | SQS persists messages for up to 14 days + Wrapper's outbox table = at-least-once delivery even if FA was down for hours |
| **Fault isolation** | SQS visibility timeout + `maxReceiveCount` redrive to a DLQ is exactly the retry pattern Wrapper's consumer already uses (3 receives, then DLQ) |
| **No thundering herd** | 100 tenants onboarding → 100 messages queued; FA pulls them at its own concurrency limit |
| **Single source of truth** | Snapshot assembled by `BootstrapService.assemble()` is identical to what the API returns — zero drift |
| **Idempotent by design** | `eventId` in every message → FA can safely deduplicate |
| **Server-side filtering** | SNS subscription filter on `targetApplication` means FA's queue only receives events targeted at it — no client-side filtering needed |

---

## 4. Architecture Diagram

```
WRAPPER (onboarding completes)
        │
        ├─ 1. Insert row into inter_app_outbox (published_at: NULL)
        │
        ├─ 2. Publish to SNS topic (SNS_INTER_APP_TOPIC_ARN)
        │       MessageAttributes:
        │         targetApplication = "accounting"
        │         eventType         = "tenant.onboarded"
        │     → On success: UPDATE outbox SET published_at = now()
        │
        └─ 3. OutboxPoller watches inter_app_outbox
               and re-publishes any rows with published_at IS NULL
               (handles transient SNS / network failures)

SNS (inter-app-events topic)
        │
        └─ Subscription: fa-accounting-events queue
               Filter policy:
                 { "targetApplication": ["accounting"] }
               Raw message delivery: false  (so we keep the SNS envelope)

SQS (fa-accounting-events queue)
        │
        Configuration:
          VisibilityTimeout:  30s
          ReceiveMessageWaitTimeSeconds: 20  (long-poll)
          RedrivePolicy:
            deadLetterTargetArn: fa-accounting-events-dlq
            maxReceiveCount:     3

FA (consumer process)
        │
        ├─ Long-polls fa-accounting-events queue
        │
        ├─ Receives tenant.app.provisioned
        │     → Record that this tenant has been provisioned (thin, fast)
        │     → DeleteMessage
        │
        ├─ Receives tenant.onboarded (with full snapshot)
        │     → DB transaction: upsert all 8 collections
        │     → Mark eventId as processed
        │     → DeleteMessage
        │
        └─ On failure (parse error, DB error):
               • Recoverable error: let visibility timeout expire → SQS redelivers
                 (after maxReceiveCount=3 receives → goes to DLQ)
               • Unrecoverable error: DeleteMessage + log/alert (don't loop)

DLQ (fa-accounting-events-dlq)
        │
        └─ Alert + manual replay or call Bootstrap API

BOOTSTRAP API (fallback only)
        POST /api/sync/tenants/:id/bootstrap
        │
        Called when:
          - DLQ fires for a specific tenant
          - FA missed an event (extended downtime)
          - Manual admin re-sync request
          - Periodic reconciliation (optional)
```

---

## 5. What Wrapper Emits (FA's Input)

FA will receive two event types from Wrapper. Both arrive on the `fa-accounting-events` SQS queue, wrapped in an SNS notification envelope.

### SNS envelope shape (what SQS actually delivers)

```json
{
  "Type": "Notification",
  "MessageId": "...",
  "TopicArn": "arn:aws:sns:us-east-1:...:inter-app-events",
  "Message": "<JSON string — the event payload below>",
  "MessageAttributes": {
    "targetApplication": { "Type": "String", "Value": "accounting" },
    "eventType":         { "Type": "String", "Value": "tenant.onboarded" }
  }
}
```

The consumer must `JSON.parse(message.Body)` to get the envelope, then `JSON.parse(envelope.Message)` to get the event payload.

### Event A: `tenant.app.provisioned` (thin, arrives first)

```json
{
  "eventId":           "outbox_1712345678_abc123",
  "eventType":         "tenant.app.provisioned",
  "sourceApplication": "wrapper",
  "targetApplication": "accounting",
  "tenantId":          "a1b2c3d4-...",
  "entityId":          "a1b2c3d4-...",
  "timestamp":         "2026-04-04T10:23:00.000Z",
  "publishedBy":       "u9f8e7d6-...",
  "eventData": {
    "appCode":          "accounting",
    "tenantId":         "a1b2c3d4-...",
    "plan":             "starter",
    "subscriptionTier": null,
    "enabledModules":   ["journals", "reports", "ledger"],
    "expiresAt":        null,
    "onboardedAt":      "2026-04-04T10:23:00.000Z",
    "bootstrapHint":    "lazy — call POST /api/sync/tenants/:id/bootstrap on first user login"
  }
}
```

**FA action**: Upsert a `tenant_provisioning` row (tenantId, plan, enabledModules, onboardedAt, status: 'pending_bootstrap'). This is a lightweight signal — full data arrives next in Event B.

---

### Event B: `tenant.onboarded` (full snapshot)

```json
{
  "eventId":           "outbox_1712345999_xyz789",
  "eventType":         "tenant.onboarded",
  "sourceApplication": "wrapper",
  "targetApplication": "accounting",
  "tenantId":          "a1b2c3d4-...",
  "entityId":          "a1b2c3d4-...",
  "timestamp":         "2026-04-04T10:23:45.000Z",
  "publishedBy":       "u9f8e7d6-...",
  "eventData": {
    "tenantId":        "a1b2c3d4-...",
    "tenantName":      "Acme Corp",
    "onboardedAt":     "2026-04-04T10:23:45.000Z",
    "adminEmail":      "admin@acme.com",
    "kindeOrgId":      "org_abc123",
    "subdomain":       "acme",
    "wrapperTenantId": "a1b2c3d4-...",
    "snapshot": {
      "snapshotAt":          "2026-04-04T10:23:40.000Z",
      "tenantId":            "a1b2c3d4-...",
      "appCode":             "accounting",
      "tenant":              { ... },
      "organizations":       [ ... ],
      "users":               [ ... ],
      "roles":               [ ... ],
      "employeeAssignments": [ ... ],
      "roleAssignments":     [ ... ],
      "creditConfigs":       [ ... ],
      "entityCredits":       [ ... ],
      "recordCounts":        { ... },
      "warnings":            []
    }
  }
}
```

**FA action**: Parse snapshot, run a DB transaction upsert across all 8 collections, mark tenant status as 'active'. See full field reference in `ONBOARDING_EMISSIONS.md`.

> **Note on payload size.** If `snapshot` is large (>200 KB), Wrapper offloads `eventData` to S3 via the claim-check pattern (`large-payload-store.ts`) and the message contains `{ _s3Ref: { bucket, key } }` instead. FA must check for `_s3Ref` and pull the full payload from S3 before processing. See the messaging feature README for details.

---

## 6. How FA Must Consume the Events

FA's consumer must follow the same pattern as Wrapper's `SqsInterAppConsumer`. Here is the exact contract.

### Connection

```
service:  Amazon SQS (long-polling receive)
SDK:      @aws-sdk/client-sqs
env vars: SQS_FA_QUEUE_URL          ← FA's own queue
          AWS_REGION
          AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY  (or IAM role on EC2/EKS)
          SQS_MAX_MESSAGES             (default 10)
          SQS_VISIBILITY_TIMEOUT       (default 30s)
          SQS_WAIT_TIME_SECONDS        (default 20s — long-poll)
```

### Infrastructure setup (one-time, via Terraform / CDK / console)

FA does **not** "assert queues on startup" the way AMQP consumers do. The SNS topic, SQS queue, subscription, filter policy, and redrive policy are provisioned once by infrastructure code.

```
SNS topic (already exists in Wrapper):
  arn: inter-app-events
  → see SNS_INTER_APP_TOPIC_ARN

SQS queues (FA must provision):
  fa-accounting-events
    VisibilityTimeout:             30
    ReceiveMessageWaitTimeSeconds: 20
    RedrivePolicy:
      deadLetterTargetArn: fa-accounting-events-dlq
      maxReceiveCount:     3
    Policy: allow SNS:SendMessage from the inter-app-events topic ARN

  fa-accounting-events-dlq
    MessageRetentionPeriod: 1209600   ← 14 days, max
```

### Subscription + filter policy

```
SNS subscription:
  topic:    inter-app-events
  endpoint: fa-accounting-events (SQS queue ARN)
  protocol: sqs
  raw message delivery: false       ← keep the SNS envelope so we get MessageAttributes
  filter policy:
    {
      "targetApplication": ["accounting"]
    }
```

The filter policy means SNS only delivers messages to `fa-accounting-events` when their `targetApplication` MessageAttribute is `"accounting"` — server-side filtering, no wasted SQS receives.

### Long-poll configuration

```
ReceiveMessageCommand:
  MaxNumberOfMessages: 5    ← don't set too high, snapshots can be 100KB+
  WaitTimeSeconds:     20   ← long-poll, reduces empty receives + cost
  VisibilityTimeout:   30   ← time to process before SQS redelivers
```

### Message Processing Flow

```
1. ReceiveMessage from fa-accounting-events (long-poll, up to 5 at a time)
2. For each message:
   a. Parse SNS envelope:  envelope = JSON.parse(msg.Body)
   b. Parse event payload: event    = JSON.parse(envelope.Message)
   c. Resolve _s3Ref claim-check if present (see messaging README)
   d. Idempotency: SELECT 1 FROM processed_events WHERE event_id = $eventId
      → If found: DeleteMessage + return (already processed)
   e. Route by eventType:
      - 'tenant.app.provisioned' → handleProvisioned()
      - 'tenant.onboarded'       → handleOnboarded()
      - anything else            → log, DeleteMessage (ignore unknown events)
   f. On success: INSERT INTO processed_events + DeleteMessage
   g. On failure: see retry strategy below
```

### Handler: `handleProvisioned()`

```
Input: eventData.appCode, tenantId, plan, enabledModules, expiresAt, onboardedAt

Action:
  UPSERT INTO tenant_provisioning
    (tenant_id, plan, enabled_modules, expires_at, onboarded_at, status)
  VALUES (...)
  ON CONFLICT (tenant_id) DO UPDATE SET
    plan = excluded.plan,
    enabled_modules = excluded.enabled_modules,
    status = 'pending_bootstrap',
    updated_at = now()

DeleteMessage immediately — no blocking work.
```

### Handler: `handleOnboarded()`

```
Input: eventData.snapshot (all 8 collections + metadata)

Action — single DB transaction:
  1. UPSERT tenants using snapshot.tenant
  2. UPSERT organizations using snapshot.organizations
  3. UPSERT users using snapshot.users
  4. UPSERT roles (filter permissions to accounting.* prefix)
  5. UPSERT employee_assignments using snapshot.employeeAssignments
  6. UPSERT role_assignments using snapshot.roleAssignments
  7. UPSERT credit_configs using snapshot.creditConfigs
  8. UPSERT entity_credits using snapshot.entityCredits
  9. INSERT INTO processed_events (event_id, tenant_id, processed_at)
  10. UPDATE tenant_provisioning SET status = 'active'

All steps in one transaction. Commit → DeleteMessage. Rollback → don't delete; let SQS redeliver.
```

---

## 7. Idempotency — The Most Critical Requirement

Wrapper uses at-least-once delivery (outbox + SNS + SQS). FA **will** receive the same event more than once in these situations:
- OutboxPoller re-publishes a row whose initial publish appeared to fail but actually succeeded
- SQS redelivers a message whose `DeleteMessage` was lost (network blip after processing)
- FA crashed after processing but before deleting the message
- SQS standard queues offer at-least-once delivery, not exactly-once

FA must be idempotent for every event type.

### Required table in FA

```sql
CREATE TABLE processed_events (
  event_id      TEXT PRIMARY KEY,
  tenant_id     UUID NOT NULL,
  event_type    TEXT NOT NULL,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON processed_events (tenant_id);
-- Optional: auto-expire old rows after 30 days
-- ALTER TABLE processed_events ADD COLUMN expires_at TIMESTAMPTZ DEFAULT now() + interval '30 days';
```

### Check before every handler

```
BEGIN;
  SELECT 1 FROM processed_events WHERE event_id = $eventId FOR UPDATE;
  -- If found: ROLLBACK + DeleteMessage
  -- If not found: process + INSERT processed_events + COMMIT + DeleteMessage
```

The `FOR UPDATE` lock prevents two concurrent consumer threads from processing the same event simultaneously.

---

## 8. Retry and DLQ Strategy

SQS handles retry differently than AMQP — there's no app-managed retry queue, the broker does it automatically.

```
Receive 1: process message
  → success: DeleteMessage. Done.
  → failure (recoverable):
        Don't delete. Let the visibility timeout (30s) expire.
        SQS redelivers the message; ApproximateReceiveCount increments.

Receive 2 / Receive 3: same flow. By Receive 3 the visibility window
  has elapsed twice, giving the system ~60s of total backoff.

After 3 unsuccessful receives (maxReceiveCount), SQS automatically moves
  the message to fa-accounting-events-dlq.

DLQ handler:
  - Alert ops team
  - Log tenantId, eventId, error
  - Optionally trigger Bootstrap API fallback for that tenantId
```

If you want longer backoff between receives, either:
- Bump `VisibilityTimeout` (e.g. to 120s); or
- Call `ChangeMessageVisibilityCommand` on transient failures to extend the timeout dynamically.

### What to retry vs not retry

| Error | Retry? | Reason |
|-------|--------|--------|
| DB connection timeout | Yes | Transient — don't delete, let SQS redeliver |
| DB constraint violation | No | Data error — DeleteMessage + alert |
| JSON parse error | No | Malformed message — DeleteMessage + alert |
| Snapshot missing `tenant` field | No | Wrapper bug — DeleteMessage + alert |
| Network timeout to DB | Yes | Transient — don't delete |
| Duplicate key on upsert (wrong logic) | No | Code bug — DeleteMessage + alert |

For unrecoverable errors, `DeleteMessage` immediately and log/alert. Do **not** let the message bounce 3 times into the DLQ just to be discarded — that's noise and adds latency.

---

## 9. Fallback: Bootstrap API

Call `POST /api/sync/tenants/:id/bootstrap` when:

1. A message lands in the DLQ and ops triggers re-sync for that tenant
2. FA detects a tenant exists in Wrapper (e.g., user logs in and JWT has `tenantId`) but FA has no record for them — this is the safeguard net
3. Manual admin re-sync via an FA admin panel

### API contract

```
POST /api/sync/tenants/:tenantId/bootstrap
Authorization: Bearer <M2M token from Kinde>
Content-Type: application/json

Body:
{
  "appCode": "accounting"
}

Response 200:
{
  "success": true,
  "data": {
    <same BootstrapPayload shape as snapshot in tenant.onboarded>
  }
}
```

FA processes the response body using exactly the same `handleOnboarded()` logic — it's the same payload shape. The only difference is it's a direct HTTP call rather than an SQS message.

### Guard at first login (safety net)

In FA's auth middleware, after verifying the user's JWT:

```
1. Extract tenantId from JWT
2. SELECT 1 FROM fa_tenants WHERE wrapper_tenant_id = tenantId
3. If NOT found:
   a. Call POST /api/sync/tenants/:tenantId/bootstrap
   b. Process response (same upsert logic)
   c. Continue login
4. If found: normal flow
```

This ensures that even if the SNS event was lost entirely, a user can still log in. This is the last resort, not the normal path.

---

## 10. FA Consumer Implementation Spec

```typescript
// fa-wrapper-consumer.ts
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';

interface SnsEnvelope {
  Type: 'Notification';
  Message: string;
  MessageAttributes?: Record<string, { Type: string; Value: string }>;
}

class FaWrapperConsumer {
  private client = new SQSClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
  private queueUrl    = process.env.SQS_FA_QUEUE_URL!;
  private maxMessages = 5;
  private waitSeconds = 20;
  private visibility  = 30;
  private running     = false;

  async start(): Promise<void> {
    this.running = true;
    while (this.running) {
      await this.tick();
    }
  }

  stop(): void { this.running = false; }

  private async tick(): Promise<void> {
    const res = await this.client.send(new ReceiveMessageCommand({
      QueueUrl:              this.queueUrl,
      MaxNumberOfMessages:   this.maxMessages,
      WaitTimeSeconds:       this.waitSeconds,
      VisibilityTimeout:     this.visibility,
      MessageAttributeNames: ['All'],
      AttributeNames:        ['ApproximateReceiveCount'],
    }));

    for (const msg of res.Messages ?? []) {
      await this.onMessage(msg);
    }
  }

  private async onMessage(msg: { Body?: string; ReceiptHandle?: string }): Promise<void> {
    let event: InterAppEvent;
    try {
      const envelope = JSON.parse(msg.Body ?? '{}') as SnsEnvelope;
      // SQS messages from SNS are wrapped — the actual event is in envelope.Message
      event = JSON.parse(envelope.Message);
    } catch (err) {
      // Malformed — delete and alert
      await this.deleteMessage(msg.ReceiptHandle);
      await this.alertOps(null, err);
      return;
    }

    try {
      // Idempotency check first
      const already = await db.query(
        'SELECT 1 FROM processed_events WHERE event_id = $1', [event.eventId]
      );
      if (already.rows.length > 0) {
        await this.deleteMessage(msg.ReceiptHandle);
        return;
      }

      // Resolve large-payload claim-check if present
      if (event.eventData?._s3Ref) {
        event.eventData = await largePayloadStore.fetch(event.eventData._s3Ref);
      }

      switch (event.eventType) {
        case 'tenant.app.provisioned':
          await this.handleProvisioned(event);
          break;
        case 'tenant.onboarded':
          await this.handleOnboarded(event);
          break;
        default:
          // Unknown event — delete and move on
          await this.deleteMessage(msg.ReceiptHandle);
          return;
      }

      await this.deleteMessage(msg.ReceiptHandle);

    } catch (err) {
      if (this.isUnrecoverable(err)) {
        // Don't loop on a poison message
        await this.deleteMessage(msg.ReceiptHandle);
        await this.alertOps(event, err);
        return;
      }
      // Transient: don't delete. Visibility timeout expires → SQS redelivers.
      // After maxReceiveCount=3, SQS moves it to the DLQ automatically.
      Logger.warn('fa-consumer', 'transient failure, letting SQS redeliver', {
        eventId: event.eventId, err: (err as Error).message,
      });
    }
  }

  private async deleteMessage(receiptHandle?: string): Promise<void> {
    if (!receiptHandle) return;
    await this.client.send(new DeleteMessageCommand({
      QueueUrl:      this.queueUrl,
      ReceiptHandle: receiptHandle,
    }));
  }

  async handleOnboarded(event: InterAppEvent): Promise<void> {
    const { snapshot } = event.eventData;
    const { tenantId } = event;

    await db.transaction(async (tx) => {
      await this.upsertTenant(tx, snapshot.tenant);
      await this.upsertOrganizations(tx, tenantId, snapshot.organizations);
      await this.upsertUsers(tx, tenantId, snapshot.users);
      await this.upsertRoles(tx, tenantId, snapshot.roles);
      await this.upsertEmployeeAssignments(tx, tenantId, snapshot.employeeAssignments);
      await this.upsertRoleAssignments(tx, tenantId, snapshot.roleAssignments);
      await this.upsertCreditConfigs(tx, tenantId, snapshot.creditConfigs);
      await this.upsertEntityCredits(tx, tenantId, snapshot.entityCredits);

      await tx.execute(
        'INSERT INTO processed_events (event_id, tenant_id, event_type) VALUES ($1, $2, $3)',
        [event.eventId, tenantId, event.eventType]
      );
    });
  }

  private isUnrecoverable(err: unknown): boolean {
    const msg = (err as Error).message ?? '';
    return msg.includes('JSON') || msg.includes('SyntaxError') || msg.includes('violates');
  }
}
```

---

## 11. Topic, Queue & Subscription Topology

This is the complete topology FA needs in its AWS account. Wrapper's SNS topic already exists — FA provisions its own queue, DLQ, subscription, and IAM policy.

```
SNS topic (already exists, owned by Wrapper):
  arn:  arn:aws:sns:<region>:<account>:inter-app-events
  type: Standard
  → exposed to FA via SNS_INTER_APP_TOPIC_ARN

SQS queues FA provisions:
  fa-accounting-events            (main)
    VisibilityTimeout:             30s
    ReceiveMessageWaitTimeSeconds: 20s
    RedrivePolicy:
      deadLetterTargetArn: <arn of fa-accounting-events-dlq>
      maxReceiveCount:     3
    Policy: allow sns.amazonaws.com to SendMessage,
            condition aws:SourceArn = <SNS_INTER_APP_TOPIC_ARN>

  fa-accounting-events-dlq        (dead-letter queue)
    MessageRetentionPeriod: 1209600  (14 days)

SNS subscription:
  topic:    inter-app-events
  endpoint: fa-accounting-events ARN
  protocol: sqs
  raw message delivery: false        ← keep envelope for MessageAttributes
  filter policy:
    {
      "targetApplication": ["accounting"]
    }
```

The filter policy means SNS only delivers events targeted at `accounting` to FA's queue. New event types added by Wrapper with `targetApplication: "accounting"` are picked up automatically — no FA redeployment needed.

---

## 12. What FA Stores After Consuming

After processing `tenant.onboarded`, FA should have these records in its own DB:

| FA Table | Populated From | Key Columns |
|----------|---------------|-------------|
| `fa_tenants` | `snapshot.tenant` | wrapper_tenant_id, tenant_name, kinde_org_id, plan, subscription |
| `fa_organizations` | `snapshot.organizations` | wrapper_entity_id, org_name, parent_id, level, country, currency |
| `fa_users` | `snapshot.users` | wrapper_user_id, kinde_id, email, first_name, last_name, is_tenant_admin |
| `fa_roles` | `snapshot.roles` | wrapper_role_id, role_name, permissions (accounting-scoped only) |
| `fa_employee_assignments` | `snapshot.employeeAssignments` | wrapper_assignment_id, user_id, entity_id, membership_type, is_primary |
| `fa_role_assignments` | `snapshot.roleAssignments` | wrapper_assignment_id, user_id, role_id, entity_id |
| `fa_credit_configs` | `snapshot.creditConfigs` | operation_code, credit_cost, unit, is_global, source |
| `fa_entity_credits` | `snapshot.entityCredits` | entity_id, allocated, used, available |
| `processed_events` | eventId | event_id, tenant_id, event_type, processed_at |

All wrapper UUIDs should be stored as-is in `wrapper_*_id` columns so FA can correlate delta events (future `user.created`, `role.updated`, etc.) without re-mapping.

---

## 13. Failure Scenarios & Recovery

| Scenario | What Happens | Recovery |
|----------|-------------|----------|
| FA consumer is down during onboarding | Message sits in `fa-accounting-events` for up to 14 days | FA picks it up automatically when it reconnects |
| SNS or SQS is degraded during onboarding | `snsSqsPublisher` publish fails; outbox row stays `published_at = NULL` | `OutboxPoller` retries on its tick once the service recovers |
| FA DB is down during event processing | Don't DeleteMessage → SQS redelivers (up to maxReceiveCount=3) → DLQ | Ops triggers Bootstrap API call for that tenantId |
| Snapshot is malformed (Wrapper bug) | JSON parse error → unrecoverable → DeleteMessage + alert | Fix Wrapper, replay from outbox |
| FA receives duplicate `tenant.onboarded` | `processed_events` check finds existing row → DeleteMessage, skip | No action needed |
| User logs in before event is processed | Bootstrap API fallback in FA auth middleware | Transparent to user, ~500ms extra latency |
| DLQ fires for a tenant | Ops alert triggered | Manual: call `POST /api/sync/tenants/:id/bootstrap` for that tenant |
| Wrapper outbox row stuck in `pending` | `OutboxPoller` re-publishes on interval, single-runner via advisory lock | Automatic, no manual intervention |
| Snapshot payload >256 KB | Wrapper offloads to S3, sends `_s3Ref` pointer | FA consumer resolves pointer before invoking handler — transparent |
