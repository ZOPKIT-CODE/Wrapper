# FA Bootstrap — Architectural Decision: AWS MQ vs Bootstrap API

**Decision**: AWS MQ push is the primary path. Bootstrap API is the recovery fallback.

---

## Table of Contents

1. [The Decision & Why](#1-the-decision--why)
2. [Why Not Bootstrap API as Primary](#2-why-not-bootstrap-api-as-primary)
3. [Why AWS MQ as Primary](#3-why-aws-mq-as-primary)
4. [Architecture Diagram](#4-architecture-diagram)
5. [What Wrapper Emits (FA's Input)](#5-what-wrapper-emits-fas-input)
6. [How FA Must Consume the Events](#6-how-fa-must-consume-the-events)
7. [Idempotency — The Most Critical Requirement](#7-idempotency--the-most-critical-requirement)
8. [Retry and DLQ Strategy](#8-retry-and-dlq-strategy)
9. [Fallback: Bootstrap API](#9-fallback-bootstrap-api)
10. [FA Consumer Implementation Spec](#10-fa-consumer-implementation-spec)
11. [Queue & Exchange Topology](#11-queue--exchange-topology)
12. [What FA Stores After Consuming](#12-what-fa-stores-after-consuming)
13. [Failure Scenarios & Recovery](#13-failure-scenarios--recovery)

---

## 1. The Decision & Why

**Use AWS MQ (RabbitMQ/AMQP) as the primary bootstrap path. Use the Bootstrap API only as a recovery mechanism.**

The infrastructure for this already exists in Wrapper:
- `tenant.onboarded` event is already emitted post-onboarding with the full snapshot
- `event_tracking` outbox table persists every event — retries are possible even after MQ restarts
- `AmazonMQInterAppConsumer` shows the exact consumer pattern FA should mirror
- `POST /api/sync/tenants/:id/bootstrap` exists as a pull fallback

The decision is not between two equally valid options. Push via MQ is strictly better for a multi-tenant SaaS at scale. The Bootstrap API exists to handle the cases where MQ delivery fails — not to replace it.

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

## 3. Why AWS MQ as Primary

| Property | What It Gives FA |
|----------|-----------------|
| **Decoupling** | FA receives data with no runtime HTTP dependency on Wrapper |
| **Pre-warmed data** | By the time first user logs in, FA already has tenant data in its own DB |
| **Durability** | RabbitMQ durable queues + Wrapper's outbox table = at-least-once delivery even if FA was down for hours |
| **Fault isolation** | Wrapper's consumer pattern already handles retry with DLQ (3 retries, 15s delay) — FA mirrors this |
| **No thundering herd** | 100 tenants onboarding → 100 events queued, FA processes them at its own concurrency limit |
| **Single source of truth** | Snapshot assembled by `BootstrapService.assemble()` is identical to what the API returns — zero drift |
| **Idempotent by design** | `eventId` in every message → FA can safely deduplicate |

---

## 4. Architecture Diagram

```
WRAPPER (onboarding completes)
        │
        ├─ 1. Write outbox row to event_tracking (status: pending)
        │
        ├─ 2. Publish to Amazon MQ exchange
        │       routing key: accounting.tenant.onboarded
        │
        └─ 3. outbox-replay-worker watches event_tracking
               and re-publishes any pending rows on interval
               (handles transient MQ failures)

AMAZON MQ (RabbitMQ)
        │
        exchange: inter-app-events (topic)
        │
        └─ queue: accounting-events
               bindings:
                 accounting.tenant.onboarded
                 accounting.tenant.app.provisioned

FA (consumer process)
        │
        ├─ Receives tenant.app.provisioned
        │     → Record that this tenant has been provisioned (thin, fast)
        │     → Schedule bootstrap if needed
        │
        ├─ Receives tenant.onboarded (with full snapshot)
        │     → DB transaction: upsert all 8 collections
        │     → Mark eventId as processed
        │     → ACK message
        │
        └─ On failure (parse error, DB error):
               retry queue (x3, 15s delay)
                   └─ DLQ
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

FA will receive two event types from Wrapper. Both arrive on the `accounting-events` queue.

### Event A: `tenant.app.provisioned` (thin, arrives first)

Routing key: `accounting.tenant.app.provisioned`

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

Routing key: `accounting.tenant.onboarded`

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

---

## 6. How FA Must Consume the Events

FA's consumer must follow the same pattern as Wrapper's `AmazonMQInterAppConsumer`. Here is the exact contract.

### Connection

```
broker:   Amazon MQ (same broker as Wrapper — shared AMQP endpoint)
protocol: amqps (TLS)
env vars: AMAZON_MQ_URL or AMAZON_MQ_HOSTNAME/USERNAME/PASSWORD
```

### Queue Setup (assert on startup)

FA must assert these queues on startup to ensure they exist before consuming:

```
queue: accounting-events
  durable: true
  arguments:
    x-dead-letter-exchange: ''
    x-dead-letter-routing-key: accounting-events-dlq

queue: accounting-events.retry
  durable: true
  arguments:
    x-dead-letter-exchange: ''
    x-dead-letter-routing-key: accounting-events    ← routes back to main queue
    x-message-ttl: 15000                            ← 15 second delay

queue: accounting-events-dlq
  durable: true
```

### Bindings (what events FA receives)

```
exchange: inter-app-events (topic)
queue:    accounting-events

bindings:
  routing key: accounting.tenant.onboarded
  routing key: accounting.tenant.app.provisioned
```

### Prefetch

```
channel.prefetch(5)
```

Do not set this too high — snapshot payloads are large (potentially 100KB+). Processing 5 concurrently is safe.

### Message Processing Flow

```
1. Receive message from accounting-events queue
2. Parse JSON envelope (eventId, eventType, tenantId, eventData)
3. Check idempotency: SELECT 1 FROM processed_events WHERE event_id = $eventId
   → If found: ACK and return (already processed)
4. Route by eventType:
   - 'tenant.app.provisioned' → handleProvisioned()
   - 'tenant.onboarded'       → handleOnboarded()
   - anything else            → log and ACK (ignore unknown events)
5. On success: INSERT INTO processed_events (event_id, ...) ; ACK message
6. On failure: see retry strategy below
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

ACK immediately — no blocking work.
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

All steps in one transaction. Commit → ACK. Rollback → NACK.
```

---

## 7. Idempotency — The Most Critical Requirement

Wrapper uses at-least-once delivery (outbox + MQ). FA **will** receive the same event more than once in these situations:
- Outbox replay worker re-publishes a pending event that was already delivered
- Network partition causes MQ to redeliver an unacknowledged message
- FA crashed after processing but before ACKing

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
  -- If found: ROLLBACK + ACK
  -- If not found: process + INSERT processed_events + COMMIT
```

The `FOR UPDATE` lock prevents two concurrent consumer threads from processing the same event simultaneously.

---

## 8. Retry and DLQ Strategy

Mirror what Wrapper's consumer already does (from `amazon-mq-consumer.ts`):

```
Attempt 1: process message
  → success: ACK
  → failure: check x-retry-count header

x-retry-count = 0 → send to accounting-events.retry (15s TTL) → ACK original
x-retry-count = 1 → send to accounting-events.retry (15s TTL) → ACK original
x-retry-count = 2 → max retries exceeded → NACK (requeue=false) → goes to accounting-events-dlq

DLQ handler:
  - Alert ops team
  - Log tenantId, eventId, error
  - Optionally trigger Bootstrap API fallback for that tenantId
```

### What to retry vs not retry

| Error | Retry? | Reason |
|-------|--------|--------|
| DB connection timeout | Yes | Transient |
| DB constraint violation | No | Data error — retrying won't fix it |
| JSON parse error | No | Malformed message — retrying won't fix it |
| Snapshot missing `tenant` field | No | Wrapper bug — alert, don't loop |
| Network timeout to DB | Yes | Transient |
| Duplicate key on upsert (wrong logic) | No | Code bug |

NACK unrecoverable errors immediately (requeue=false). Do not send them to retry queue.

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

FA processes the response body using exactly the same `handleOnboarded()` logic — it's the same payload shape. The only difference is it's a direct HTTP call rather than a queue message.

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

This ensures that even if the MQ event was lost entirely, a user can still log in. This is the last resort, not the normal path.

---

## 10. FA Consumer Implementation Spec

```typescript
// fa-wrapper-consumer.ts

class FaWrapperConsumer {
  queueName     = 'accounting-events';
  retryQueue    = 'accounting-events.retry';
  dlqName       = 'accounting-events-dlq';
  maxRetries    = 3;
  retryDelayMs  = 15000;
  prefetch      = 5;

  async start(): Promise<void> {
    // 1. connect(AMAZON_MQ_URL)
    // 2. assertQueues() — main, retry, dlq
    // 3. assertExchangeBindings() — bind accounting.* routing keys
    // 4. channel.prefetch(this.prefetch)
    // 5. channel.consume(this.queueName, this.onMessage, { noAck: false })
  }

  async onMessage(msg: ConsumeMessage): Promise<void> {
    const event = JSON.parse(msg.content.toString());
    const retryCount = msg.properties.headers?.['x-retry-count'] ?? 0;

    try {
      // Idempotency check first
      const alreadyProcessed = await db.query(
        'SELECT 1 FROM processed_events WHERE event_id = $1', [event.eventId]
      );
      if (alreadyProcessed.rows.length > 0) {
        channel.ack(msg); // safe to ignore
        return;
      }

      // Route
      switch (event.eventType) {
        case 'tenant.app.provisioned':
          await this.handleProvisioned(event);
          break;
        case 'tenant.onboarded':
          await this.handleOnboarded(event);
          break;
        default:
          // Unknown event — ACK and move on
          channel.ack(msg);
          return;
      }

      channel.ack(msg);

    } catch (err) {
      if (this.isUnrecoverable(err)) {
        // NACK immediately → DLQ
        channel.nack(msg, false, false);
        return;
      }

      if (retryCount < this.maxRetries) {
        // Send to retry queue with incremented counter
        channel.sendToQueue(this.retryQueue, msg.content, {
          persistent: true,
          headers: { ...msg.properties.headers, 'x-retry-count': retryCount + 1 }
        });
        channel.ack(msg);
      } else {
        // Max retries hit → DLQ
        channel.nack(msg, false, false);
        await this.alertOps(event, err);
      }
    }
  }

  async handleOnboarded(event: InterAppEvent): Promise<void> {
    const { snapshot } = event.eventData;
    const { tenantId } = event;

    await db.transaction(async (tx) => {
      // upsert all 8 collections
      await this.upsertTenant(tx, snapshot.tenant);
      await this.upsertOrganizations(tx, tenantId, snapshot.organizations);
      await this.upsertUsers(tx, tenantId, snapshot.users);
      await this.upsertRoles(tx, tenantId, snapshot.roles);
      await this.upsertEmployeeAssignments(tx, tenantId, snapshot.employeeAssignments);
      await this.upsertRoleAssignments(tx, tenantId, snapshot.roleAssignments);
      await this.upsertCreditConfigs(tx, tenantId, snapshot.creditConfigs);
      await this.upsertEntityCredits(tx, tenantId, snapshot.entityCredits);

      // Record that this event was processed (inside same transaction)
      await tx.execute(
        'INSERT INTO processed_events (event_id, tenant_id, event_type) VALUES ($1, $2, $3)',
        [event.eventId, tenantId, event.eventType]
      );
    });
  }

  private isUnrecoverable(err: unknown): boolean {
    const msg = (err as Error).message ?? '';
    // JSON parse errors, schema validation errors → don't retry
    return msg.includes('JSON') || msg.includes('SyntaxError') || msg.includes('violates');
  }
}
```

---

## 11. Queue & Exchange Topology

This is the complete topology FA needs to set up once on its consumer startup. Wrapper's exchange already exists — FA only needs to create its own queues and bindings.

```
Exchange (already exists in Wrapper):
  name:    inter-app-events
  type:    topic
  durable: true

Queues FA must assert:
  accounting-events          (main)
  accounting-events.retry    (delayed retry via x-message-ttl)
  accounting-events-dlq      (dead letters)

Bindings on inter-app-events exchange → accounting-events queue:
  accounting.tenant.onboarded
  accounting.tenant.app.provisioned
  accounting.#                        ← optional: catch all future accounting.* events
```

The binding `accounting.#` future-proofs FA to receive any new event Wrapper adds with the `accounting.*` prefix, without requiring a redeployment.

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
| FA consumer is down during onboarding | Event sits in durable `accounting-events` queue | FA picks it up automatically when it reconnects |
| Amazon MQ broker is down during onboarding | Wrapper's outbox replay worker retries when MQ recovers | `event_tracking` row stays `pending` until published |
| FA DB is down during event processing | NACK → retry queue (x3) → DLQ | Ops triggers Bootstrap API call for that tenantId |
| Snapshot is malformed (Wrapper bug) | JSON parse error → unrecoverable → DLQ immediately | Fix Wrapper, replay from outbox |
| FA receives duplicate `tenant.onboarded` | `processed_events` check finds existing row → ACK, skip | No action needed |
| User logs in before event is processed | Bootstrap API fallback in FA auth middleware | Transparent to user, ~500ms extra latency |
| DLQ fires for a tenant | Ops alert triggered | Manual: call `POST /api/sync/tenants/:id/bootstrap` for that tenant |
| Wrapper outbox row stuck in `pending` | `outbox-replay-worker.ts` re-publishes on interval | Automatic, no manual intervention |
