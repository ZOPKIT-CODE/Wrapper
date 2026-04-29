# Credit Allocation & Expiry — Wrapper to Downstream Apps

> How Financial Accounting (and other downstream apps) receive credit allocations from Wrapper and handle expiry locally.

---

## Table of Contents

1. [How It Works](#1-how-it-works)
2. [What Wrapper Sends](#2-what-wrapper-sends)
3. [What FA Needs To Do](#3-what-fa-needs-to-do)
4. [Expiry Strategy](#4-expiry-strategy)
5. [Payload Reference](#5-payload-reference)
6. [FA Database Schema](#6-fa-database-schema)
7. [Scale Considerations](#7-scale-considerations)
8. [Wrapper Internals](#8-wrapper-internals)
9. [Configuration](#9-configuration)
10. [Testing Checklist](#10-testing-checklist)

---

## 1. How It Works

```
Admin allocates 300 credits to Financial Accounting
                    |
                    v
        Wrapper (credit-operations.ts)
        ├─ Deducts 300 from org pool balance
        ├─ Creates app-specific credit_batch (expires_at inherited)
        └─ Publishes credit.allocated event to SNS
                    |
                    v
              AWS SNS Topic
              (filtered by targetApplication = "accounting")
                    |
                    v
           FA's SQS Queue
                    |
                    v
        FA Event Handler
        ├─ Stores: +300 credits, expiresAt = 2026-04-08T16:51:00Z
        └─ Done. FA now owns these credits.
                    
        ... time passes ...

        FA's Own Cron Job (runs periodically)
        ├─ Finds allocations where expiresAt <= NOW()
        ├─ Zeros remaining credits
        └─ Logs expiry in FA audit trail
```

**Key insight**: Wrapper sends the allocation with `expiresAt`. FA stores it. FA's own cron expires it. No second event needed.

Wrapper's cron ALSO marks the batch as expired on its side (for the Billing UI), but FA doesn't depend on that — it handles expiry independently.

---

## 2. What Wrapper Sends

**One event**: `credit.allocated` — that's all FA needs.

This event contains:
- **How many credits**: `deltaAmount` (additive — FA adds this to its local balance)
- **When they expire**: `expiresAt` (ISO 8601 timestamp — FA stores this and runs its own cron)
- **Which allocation**: `allocationId` (UUID from `credit_batches` — FA uses this as a foreign key)
- **Which entity**: `entityId` (the organization these credits belong to)
- **Which tenant**: `tenantId`

FA already handles events like `organization.created`, `role.updated`, etc. This is the same pattern — just a different event type.

---

## 3. What FA Needs To Do

### On receiving `credit.allocated`:

```typescript
async function handleCreditAllocated(event: CreditAllocatedEvent) {
  const { entityId, deltaAmount, allocationId, expiresAt } = event.eventData;
  const { tenantId } = event;

  // Upsert a credit allocation record
  await db.wrapperCreditAllocations.upsert({
    where: { allocationId },
    create: {
      allocationId,
      tenantId,
      entityId,
      allocatedCredits: deltaAmount,
      usedCredits: 0,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isExpired: false,
      receivedAt: new Date(),
    },
    update: {
      // If same allocationId arrives twice (retry), add delta
      allocatedCredits: { increment: deltaAmount },
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    },
  });
}
```

### On FA's own cron (expiry):

```typescript
// Run every 15 minutes or hourly
async function expireCreditAllocations() {
  const now = new Date();

  const expired = await db.wrapperCreditAllocations.findMany({
    where: {
      expiresAt: { lte: now },
      isExpired: false,
    },
  });

  for (const alloc of expired) {
    const remaining = alloc.allocatedCredits - alloc.usedCredits;

    await db.wrapperCreditAllocations.update({
      where: { allocationId: alloc.allocationId },
      data: { isExpired: true },
    });

    // Log in FA's own audit trail
    await db.creditAuditLog.create({
      data: {
        tenantId: alloc.tenantId,
        entityId: alloc.entityId,
        action: 'credit_expired',
        revokedCredits: remaining,
        allocationId: alloc.allocationId,
        expiredAt: now,
      },
    });
  }
}
```

### On credit consumption (FA's existing flow):

When a user performs an action that costs credits:

```typescript
async function consumeCredits(tenantId: string, entityId: string, amount: number) {
  // FA already has this logic — just update usedCredits
  // on the oldest non-expired allocation (FIFO)
  const allocation = await db.wrapperCreditAllocations.findFirst({
    where: {
      tenantId, entityId, isExpired: false,
      allocatedCredits: { gt: db.raw('used_credits') },
    },
    orderBy: { expiresAt: 'asc' }, // FIFO: use soonest-expiring first
  });

  if (!allocation) throw new Error('Insufficient credits');

  await db.wrapperCreditAllocations.update({
    where: { allocationId: allocation.allocationId },
    data: { usedCredits: { increment: amount } },
  });
}
```

---

## 4. Expiry Strategy

### Why FA handles its own expiry (not Wrapper)

| Approach | Pros | Cons |
|----------|------|------|
| **Wrapper publishes `credit.expired` event** | Simple for FA | FA depends on Wrapper's cron timing; if SNS message is lost, credits never expire in FA; creates tight coupling |
| **FA runs its own expiry cron** (recommended) | FA is self-sufficient; works even if Wrapper is down; FA controls timing | FA must store `expiresAt` locally |

**Recommended**: FA stores `expiresAt` from the `credit.allocated` event and runs its own expiry cron. This is the same pattern FA already uses for other time-based operations.

### What about Wrapper's `credit.expired` event?

Wrapper's cron still runs and marks batches as expired on its side (for the Billing UI). It also publishes `credit.expired` to SNS for app-specific batches. FA can:

- **Option A (recommended)**: Ignore `credit.expired` events entirely — FA's own cron handles it.
- **Option B**: Use `credit.expired` as a secondary confirmation / safety net, but don't depend on it.

---

## 5. Payload Reference

### `credit.allocated` — The main event FA consumes

```json
{
  "eventId": "inter_1712567890123_a1b2c3d4",
  "eventType": "credit.allocated",
  "sourceApplication": "wrapper",
  "targetApplication": "accounting",
  "tenantId": "7b5a5c75-62a5-45a8-90cb-003b5c2869e5",
  "entityId": "22505f39-90c7-4d6e-8498-82cb8671b179",
  "timestamp": "2026-04-08T11:00:59.673Z",
  "publishedBy": "system",
  "eventData": {
    "entityId": "22505f39-90c7-4d6e-8498-82cb8671b179",
    "targetApplication": "accounting",
    "deltaAmount": 300,
    "allocatedCredits": 300,
    "allocationType": "organization",
    "allocationId": "d5a1ba11-175d-4527-a37c-a95dcaedd53d",
    "expiresAt": "2026-04-08T16:51:00.000Z",
    "allocationPurpose": "Credit allocation to accounting",
    "allocationSource": "admin_allocation",
    "allocatedBy": "user-uuid",
    "allocatedAt": "2026-04-08T11:00:59.673Z",
    "metadata": {
      "sourceEntityId": "22505f39-90c7-4d6e-8498-82cb8671b179",
      "previousEntityBalance": 500,
      "newEntityBalance": 200,
      "purpose": "admin_allocation"
    }
  }
}
```

### Fields FA must store:

| Field | Type | Why FA needs it |
|-------|------|-----------------|
| `eventData.deltaAmount` | number | Credits to add (additive) |
| `eventData.allocationId` | UUID | Links to Wrapper's `credit_batches.allocation_id` — use as FK |
| `eventData.expiresAt` | ISO 8601 / null | When to expire locally — `null` means never |
| `eventData.entityId` | UUID | Which organization owns these credits |
| `tenantId` | UUID | Tenant context |

### Fields FA can ignore:

| Field | Why |
|-------|-----|
| `allocatedCredits` | Same as `deltaAmount` — backward compat only |
| `metadata.previousEntityBalance` | Wrapper's internal state, not relevant to FA |
| `metadata.newEntityBalance` | Wrapper's internal state |
| `allocationSource` | Informational only |

---

## 6. FA Database Schema (Recommended)

### `wrapper_credit_allocations`

```sql
CREATE TABLE wrapper_credit_allocations (
  allocation_id   UUID PRIMARY KEY,          -- From eventData.allocationId
  tenant_id       UUID NOT NULL,
  entity_id       UUID NOT NULL,
  allocated_credits DECIMAL(12,4) NOT NULL,  -- Running total (sum of deltas)
  used_credits     DECIMAL(12,4) DEFAULT 0,  -- FA tracks its own consumption
  expires_at       TIMESTAMPTZ,              -- From eventData.expiresAt
  is_expired       BOOLEAN DEFAULT FALSE,
  received_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  CONSTRAINT idx_wca_tenant_entity UNIQUE (tenant_id, entity_id, allocation_id)
);

CREATE INDEX idx_wca_expiry ON wrapper_credit_allocations (expires_at)
  WHERE is_expired = false AND expires_at IS NOT NULL;

CREATE INDEX idx_wca_available ON wrapper_credit_allocations (tenant_id, entity_id)
  WHERE is_expired = false AND allocated_credits > used_credits;
```

### Credit availability query:

```sql
SELECT 
  SUM(allocated_credits - used_credits) as available_credits
FROM wrapper_credit_allocations
WHERE tenant_id = $1
  AND entity_id = $2
  AND is_expired = false
  AND allocated_credits > used_credits;
```

---

## 7. Scale Considerations

### Problems you'll face and how to handle them

#### 1. SNS message loss (rare but real)

**Problem**: If a `credit.allocated` message is lost, FA's balance drifts from Wrapper permanently.

**Solution**: Build a reconciliation endpoint on Wrapper that FA can call periodically:

```
GET /api/credits/app-allocations?targetApplication=accounting&since=2026-04-01
```

Returns all `credit_batches` where `targetApplication = 'accounting'`. FA compares against its local records and corrects drift. Run daily or on-demand.

*This endpoint doesn't exist yet — build it when you need it.*

#### 2. Event ordering at high volume

**Problem**: At scale, SQS doesn't guarantee strict ordering. Two rapid allocations might arrive out of order.

**Solution**: Use `allocationId` as an idempotency key. Each allocation creates a separate record — order doesn't matter. FA's `deltaAmount` is additive per-allocation, not a running total.

#### 3. Expiry timing mismatch

**Problem**: Wrapper's cron runs hourly. FA's cron might run every 15 minutes. Credits could be expired in FA before Wrapper's UI reflects it.

**Solution**: This is fine. FA is the source of truth for its own consumption. Wrapper's Billing UI shows Wrapper's view. They converge within one hour.

#### 4. Hot partition on entity_id

**Problem**: Large tenants with one entity receiving thousands of allocations could create database hotspots.

**Solution**: FA's `wrapper_credit_allocations` table is per-allocation (not per-entity aggregate). Reads use the composite index. This scales well to millions of rows.

#### 5. Duplicate events (SQS at-least-once delivery)

**Problem**: SQS may deliver the same message twice.

**Solution**: `allocationId` is a UUID primary key. `INSERT ... ON CONFLICT (allocation_id) DO UPDATE SET allocated_credits = allocated_credits + deltaAmount` is idempotent if you use a processed-events table:

```sql
-- Track processed event IDs
CREATE TABLE processed_events (
  event_id VARCHAR(100) PRIMARY KEY,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- In handler: check before processing
INSERT INTO processed_events (event_id) VALUES ($eventId)
ON CONFLICT DO NOTHING
RETURNING event_id;
-- If no row returned, skip (already processed)
```

---

## 8. Wrapper Internals (For Reference)

### What happens in Wrapper when admin allocates credits to an app

```
allocateCreditsToApplication()
  │
  ├─ BEGIN TRANSACTION
  │   ├─ credits.available_credits -= 300         (org pool deducted)
  │   ├─ credit_transactions: 'allocation' record (audit trail)
  │   ├─ credit_batches: source batch usedCredits += 300 (FIFO)
  │   └─ credit_batches: INSERT new row           (targetApplication = 'accounting')
  │       - allocated_credits = 300
  │       - expires_at = inherited from source batch
  │       - Returns allocation_id UUID
  │
  ├─ COMMIT
  │
  └─ Publish credit.allocated to SNS             (outside transaction)
      - includes allocationId (the batch UUID)
      - includes expiresAt (from source batch)
```

### What happens when credits expire in Wrapper

```
CreditExpiryManager cron (hourly)
  │
  └─ processExpiredCredits()
      │
      ├─ Find batches: is_active=true, is_expired=false, expires_at <= NOW()
      │
      ├─ For org-pool batches (targetApplication = NULL):
      │   └─ BEGIN TRANSACTION
      │       ├─ Mark isExpired=true, isActive=false
      │       └─ Deduct unusedCredits from credits.available_credits
      │       COMMIT
      │
      └─ For app-specific batches (targetApplication = 'accounting'):
          ├─ BEGIN TRANSACTION
          │   └─ Mark isExpired=true, isActive=false
          │   COMMIT
          └─ Publish credit.expired to SNS (safety net — FA ignores if using own cron)
```

### Wrapper's `credit_batches` table for reference

| Column | Example Value | Relevance to FA |
|--------|---------------|-----------------|
| `allocation_id` | `d5a1ba11-...` | This is the `allocationId` in the event — FA's FK |
| `target_application` | `'accounting'` | Identifies this as FA's batch |
| `allocated_credits` | `300.0000` | Matches `deltaAmount` in event |
| `used_credits` | `0.0000` | Wrapper's view — FA tracks its own |
| `expires_at` | `2026-04-08 16:51:00` | Matches `expiresAt` in event |
| `is_expired` | `false` → `true` | Wrapper marks this when cron runs |

---

## 9. Configuration

### Wrapper env vars

| Variable | Default | Description |
|----------|---------|-------------|
| `CREDIT_EXPIRY_CRON` | `0 * * * *` | Wrapper's expiry cron (hourly). Set to `* * * * *` for dev. |
| `SNS_INTER_APP_TOPIC_ARN` | — | AWS SNS topic for inter-app events |
| `BUSINESS_SUITE_TARGET_APPS` | `crm,accounting,ops` | Apps that receive credit events |

### FA side

| What to configure | Value |
|-------------------|-------|
| SQS queue | Subscribe to SNS topic with filter: `targetApplication = "accounting"` |
| Expiry cron | Every 15 min recommended: check `expires_at <= NOW()` and mark expired |
| Reconciliation | Daily job: compare local allocations against Wrapper API (when endpoint exists) |

---

## 10. Testing Checklist

### Happy path
- [ ] Admin allocates 300 credits to FA from Wrapper
- [ ] FA receives `credit.allocated` event with correct `deltaAmount` and `expiresAt`
- [ ] FA stores allocation with expiry date
- [ ] FA can consume credits from the allocation
- [ ] FA's cron expires credits when `expiresAt` passes
- [ ] Wrapper's Billing UI shows correct remaining after expiry

### Edge cases
- [ ] Allocation with `expiresAt = null` (paid credits — never expire)
- [ ] Multiple allocations to same entity — FA tracks each separately
- [ ] Duplicate event (same `eventId`) — FA handles idempotently
- [ ] FA cron runs before Wrapper cron — credits expire in FA first (acceptable)
- [ ] SNS message lost — reconciliation corrects drift (when endpoint exists)
- [ ] Very short expiry (2 min in dev mode) — FA's cron picks it up within cycle

### Dev mode quick test
1. Create campaign with `minutesUntilExpiry: 5`
2. Allocate to FA from Wrapper
3. Check FA received event with `expiresAt` 5 min from now
4. Wait 5 min
5. Verify FA's cron expired the allocation
6. Verify Wrapper's Billing UI shows expired batch

---

## File References

| File | What it does |
|------|-------------|
| `backend/src/features/credits/services/credit-operations.ts` | `allocateCreditsToApplication()` — deducts, creates batch, publishes event |
| `backend/src/features/credits/services/credit-expiry-service.ts` | Wrapper's expiry cron — marks batches expired, publishes `credit.expired` |
| `backend/src/utils/credit-expiry-manager.ts` | Cron scheduling (hourly default) |
| `backend/src/features/messaging/utils/sns-sqs-publisher.ts` | SNS event publishing with circuit breaker |
| `frontend/src/features/billing/components/ExpiryBreakdownTab.tsx` | Billing UI showing per-entity credit expiry |
