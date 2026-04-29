# Credit Expiry — Dev Testing Guide

How to test the full credit expiry lifecycle in minutes instead of waiting weeks or months for real expiry dates to pass.

---

## Table of Contents

1. [Overview](#1-overview)
2. [How It Works — The Two Sides](#2-how-it-works--the-two-sides)
3. [Prerequisites](#3-prerequisites)
4. [Wrapper Dev Endpoints](#4-wrapper-dev-endpoints)
5. [Test Scenario A — Org Pool Expiry (No App Involved)](#5-test-scenario-a--org-pool-expiry-no-app-involved)
6. [Test Scenario B — App Allocation + App-Side Expiry](#6-test-scenario-b--app-allocation--app-side-expiry)
7. [Test Scenario C — Mixed FIFO Allocation](#7-test-scenario-c--mixed-fifo-allocation)
8. [Test Scenario D — Paid Credits Expire With Plan](#8-test-scenario-d--paid-credits-expire-with-plan)
9. [Application (FA) Side — What to Implement and Test](#9-application-fa-side--what-to-implement-and-test)
10. [SNS Event Reference](#10-sns-event-reference)
11. [Database State Reference](#11-database-state-reference)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Overview

Credits flow through three stages:

```
Admin grants credits
  → Org pool (credit_batches, targetApplication = NULL)

Admin allocates credits to an app
  → Org pool balance deducted
  → App-level batch created (targetApplication = 'crm' | 'accounting' | etc.)
  → credit.allocated SNS event sent to app (per batch, includes expiresAt)

Expiry time arrives
  → Wrapper cron: org-level batches → deduct unused from org pool
  → App cron:     app-level batches → app zeroes its own balance internally
```

**Key principle — no cross-communication at expiry:**  
The wrapper never sends a "credits expired" event to the app. The app received `expiresAt` in the original `credit.allocated` event and handles its own expiry independently via its own cron job.

---

## 2. How It Works — The Two Sides

### Wrapper side

| Event | What happens |
|-------|-------------|
| `addCreditsToEntity()` called | `credits.available_credits` increased; one `credit_batches` row created with `creditType` + `expiresAt` |
| `allocateCreditsToApplication()` called | FIFO walks org batches (seasonal → free → paid, soonest-expiring first); deducts from `credits.available_credits`; creates one app-level row **and** publishes one `credit.allocated` event **per source batch** |
| Wrapper expiry cron fires | For **org-level** expired rows: `unusedCredits = allocatedCredits - usedCredits` → deducted from org pool. For **app-level** expired rows: audit record only (app owns its own balance) |
| Subscription renews/cancels | `syncPaidCreditBatchExpiry()` bulk-updates all paid batch `expiresAt` → sends `credit.expiry_updated` to apps holding paid batches |

### Application (FA) side

| Event | What FA must do |
|-------|----------------|
| Receives `credit.allocated` | Store `{ allocationId, amount, creditType, expiresAt }` locally. May receive **multiple events per admin allocation** if FIFO spans multiple source batches |
| Receives `credit.expiry_updated` | Update the locally-stored `expiresAt` for the given `allocationId` |
| FA's own cron fires | Find all local batches where `expiresAt <= now` and `isExpired = false` → `unusedCredits = allocatedCredits - usedCredits` → deduct from FA balance → mark batch as expired |
| FA consumes credits (FIFO) | Sort local batches by `expiresAt ASC NULLS LAST` → consume from soonest-expiring batch first |

---

## 3. Prerequisites

- `NODE_ENV` must **not** be `production` (dev or test is fine)
- You must be logged in with a valid dev session (normal Kinde login)
- You need an `entityId` (UUID of an org-level entity in your tenant) — grab it from the UI or via the batches endpoint
- The wrapper server must be running locally: `pnpm --filter wrapper-backend dev`
- Your database must have the **`credit_batches`** table (and related migrations). Older environments may still use `seasonal_credit_allocations`; the app expects **`credit_batches`** — align schema with `backend/src/db/schema/billing/credit-batches.ts` before using dev seed.

---

## 4. Wrapper Dev Endpoints

All endpoints are mounted at `/api/dev/credits`. They return 404 in production.  
All require authentication — attach your normal Bearer token.

**Reading org balance:** use **`GET /api/credits/current`** (not `/api/credits/balance`). The response includes `data.entityId` and `data.availableCredits`. Confirm `entityId` matches the org entity you are testing (especially if the tenant has multiple entities).

**`POST /api/dev/credits/trigger-expiry` runs globally:** it calls `CreditExpiryService.processExpiredCredits()` with **no tenant filter**, so every eligible expired batch in the database is processed. Use an isolated dev database or expect other tenants’ rows to run in the same invocation.

---

### `GET /api/dev/credits/batches`

List all credit batches for your tenant. Use this to find `allocationId` values.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "allocationId": "uuid-1",
      "creditType": "seasonal",
      "allocatedCredits": "500",
      "usedCredits": "500",
      "expiresAt": "2025-06-15T10:00:00.000Z",
      "targetApplication": null,
      "isActive": false,
      "isExpired": true
    },
    {
      "allocationId": "uuid-2",
      "creditType": "free",
      "allocatedCredits": "300",
      "usedCredits": "0",
      "expiresAt": "9999-12-31T00:00:00.000Z",
      "targetApplication": null,
      "isActive": true,
      "isExpired": false
    }
  ]
}
```

**Reading the output:**
- `targetApplication: null` = org pool batch (not yet sent to any app)
- `targetApplication: "crm"` = app-level batch (already allocated to the CRM app)
- `expiresAt: "9999-12-31..."` = never-expires sentinel
- `usedCredits` on org batches = how much was drawn out via FIFO allocation

---

### `POST /api/dev/credits/seed`

Create one batch of each credit type with short expiry windows so you can test expiry quickly.

**Body:**
```json
{
  "entityId": "<your-org-entity-uuid>",
  "minutesUntilSeasonalExpiry": 2
}
```

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `entityId` | Yes | — | UUID of the org entity to receive credits |
| `minutesUntilSeasonalExpiry` | No | `2` | Drives all expiry windows (see table below) |

**What gets created:**

| Type | Amount | Expires in |
|------|--------|-----------|
| `seasonal` | 500 credits | `N` minutes (e.g. 2m) |
| `free` | 300 credits | `N + 5` minutes (e.g. 7m) |
| `paid` | 200 credits | Tied to active subscription's `currentPeriodEnd`; falls back to `N + 10` minutes if no active subscription |

**Implementation note:** Each seed call uses `addCreditsToEntity()`, which first commits the **`credits`** balance and **`credit_transactions`** row, then inserts the org-pool row into **`credit_batches`**. If the batch insert fails (e.g. missing table or column), your balance may increase without a matching batch — fix schema and reconcile before relying on totals.

**Response:**
```json
{
  "success": true,
  "message": "Seeded 500 seasonal (expires in 2m), 300 free (expires in 7m), 200 paid (expires at subscription period end)",
  "expiries": {
    "seasonal": "2025-06-15T10:02:00.000Z",
    "free":     "2025-06-15T10:07:00.000Z",
    "paid":     "2026-06-15T00:00:00.000Z"
  }
}
```

---

### `POST /api/dev/credits/backdate`

Move a specific batch's `expiresAt` into the past so the next expiry cron run will process it.

**Body:**
```json
{
  "allocationId": "<uuid-from-batches-endpoint>",
  "minutesAgo": 1
}
```

| Field | Required | Default |
|-------|----------|---------|
| `allocationId` | Yes | — |
| `minutesAgo` | No | `1` |

**Response:**
```json
{
  "success": true,
  "message": "Batch uuid-1 backdated to 2025-06-15T09:59:00.000Z — run /trigger-expiry to process it"
}
```

**Security:** The endpoint checks that the batch belongs to your tenant. You cannot backdate another tenant's batch.

---

### `POST /api/dev/credits/backdate-subscription`

Move your tenant's active subscription `currentPeriodEnd` into the past to simulate plan expiry. Also immediately calls `syncPaidCreditBatchExpiry` so all paid credit batches (both org-level and app-level) have their `expiresAt` updated to match. Apps holding paid batches will receive a `credit.expiry_updated` SNS event.

**Body:**
```json
{
  "minutesAgo": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription currentPeriodEnd moved to 2025-06-15T09:59:00.000Z and paid credit batches synced — run /trigger-expiry to process"
}
```

**What happens internally:**
1. `subscriptions.currentPeriodEnd` set to `now - minutesAgo`
2. All active paid **`credit_batches`** rows updated: `expiresAt = now - minutesAgo`
3. For every **app-level** paid batch (`target_application` is not null): `credit.expiry_updated` SNS event published

---

### `POST /api/dev/credits/trigger-expiry`

Immediately fire `CreditExpiryService.processExpiredCredits()` — no waiting for the scheduled cron job. Returns the full report.

**No body required.**

**Response:**
```json
{
  "success": true,
  "data": {
    "processedCount": 2,
    "errorCount": 0,
    "totalExpired": 2,
    "applicationExpiryMap": {
      "crm": { "count": 1, "totalUnusedCredits": 150 }
    },
    "expiredPurchases": {
      "processedCount": 0,
      "errorCount": 0
    },
    "timestamp": "2025-06-15T10:01:00.000Z"
  }
}
```

**Reading the output:**
- `processedCount` = batches successfully marked expired
- `applicationExpiryMap` = summary of app-level batches that were processed (audit records written)
- `expiredPurchases` = separately processed `credit_purchases` rows with passed `expiryDate`

---

## 5. Test Scenario A — Org Pool Expiry (No App Involved)

**Goal:** Verify that credits in the org pool are deducted when their batch expires.

### Steps

**Step 1 — Check your starting balance**
```
GET /api/credits/current
```
Note down `data.availableCredits` and confirm `data.entityId` equals `<your-entity-uuid>`.

**Step 2 — Seed test batches**
```
POST /api/dev/credits/seed
{ "entityId": "<your-entity-uuid>", "minutesUntilSeasonalExpiry": 2 }
```
Your balance should now be `startingBalance + 1000` (500 seasonal + 300 free + 200 paid).

**Step 3 — Backdate the seasonal batch**
```
GET /api/dev/credits/batches
```
Find the batch with `creditType: "seasonal"` and `targetApplication: null`. Copy its `allocationId`.

```
POST /api/dev/credits/backdate
{ "allocationId": "<seasonal-batch-uuid>", "minutesAgo": 1 }
```

**Step 4 — Fire the expiry cron**
```
POST /api/dev/credits/trigger-expiry
```

**Step 5 — Verify balance deduction**
```
GET /api/credits/current
```

**Expected:**  
`availableCredits` decreased by 500 (the seasonal batch's `allocatedCredits - usedCredits = 500 - 0 = 500`).

**Step 6 — Verify batch status**
```
GET /api/dev/credits/batches
```
The seasonal batch should now show `isExpired: true`, `isActive: false`.

**Step 7 — Verify audit trail**
Check `credit_transactions` — there should be a row with:
```
transactionType: "expiry"
amount: "-500"
operationCode: "credit_expiry:primary_org:<allocationId>"
```

---

## 6. Test Scenario B — App Allocation + App-Side Expiry

**Goal:** Verify the full flow: org grants credits → admin allocates to app → app receives `credit.allocated` event with `expiresAt` → app expires its own batch.

### Wrapper side

**Step 1 — Seed free credits with short expiry**
```
POST /api/dev/credits/seed
{ "entityId": "<org-entity-uuid>", "minutesUntilSeasonalExpiry": 3 }
```

**Step 2 — Allocate 400 credits to the CRM app**
```
POST /api/credits/allocate/application
{
  "sourceEntityId": "<org-entity-uuid>",
  "targetApplication": "crm",
  "creditAmount": 400,
  "allocationPurpose": "dev test"
}
```

**Expected response:**
```json
{
  "success": true,
  "creditAmount": 400,
  "previousBalance": 1000,
  "newBalance": 600,
  "batches": [
    {
      "allocationId": "app-batch-uuid-1",
      "creditType": "seasonal",
      "expiresAt": "2025-06-15T10:03:00.000Z",
      "amount": 400
    }
  ]
}
```

**Step 3 — Verify two SNS events were NOT sent (only one)**  
Since 400 ≤ 500 (full seasonal batch), FIFO only pulled from the seasonal batch. One `credit.allocated` event was published to the CRM queue.

**Step 4 — Wrapper side: backdate the app batch and run expiry cron**
```
GET /api/dev/credits/batches
```
Find the batch with `targetApplication: "crm"`. Copy its `allocationId`.

```
POST /api/dev/credits/backdate
{ "allocationId": "<app-batch-uuid>", "minutesAgo": 1 }

POST /api/dev/credits/trigger-expiry
```

**Expected wrapper behavior:**  
- Batch marked `isExpired: true`
- Org pool balance **NOT changed** (credits left the pool at allocation time)
- Audit record in `credit_transactions` with `operationCode: "credit_expiry:crm:<allocationId>"`
- **No SNS event published** (app manages its own balance)

### Application (FA/CRM) side

**Step 5 — Simulate app receiving the `credit.allocated` event**

When the allocation in Step 2 was made, the app's MQ queue received:
```json
{
  "eventType": "credit.allocated",
  "payload": {
    "allocationId": "app-batch-uuid-1",
    "entityId": "<org-entity-uuid>",
    "targetApplication": "crm",
    "deltaAmount": 400,
    "allocatedCredits": 400,
    "creditType": "seasonal",
    "expiresAt": "2025-06-15T10:03:00.000Z",
    "neverExpires": false
  }
}
```

The app should store this locally:
```
local_batches table:
  allocationId:      app-batch-uuid-1
  amount:            400
  usedCredits:       0
  creditType:        seasonal
  expiresAt:         2025-06-15T10:03:00.000Z
  isExpired:         false
```

**Step 6 — App consumes some credits**

The app internally uses 150 credits for operations:
```
local_batches:
  usedCredits: 150
  
app_balance: 400 → 250
```

**Step 7 — App's expiry cron fires**

The app's cron finds `allocationId app-batch-uuid-1` where `expiresAt <= now`:
```
unusedCredits = 400 - 150 = 250
app_balance: 250 → 0
local_batches.isExpired = true
```

**Result: app balance = 0. No communication back to wrapper needed.**

---

## 7. Test Scenario C — Mixed FIFO Allocation

**Goal:** Verify that when a single allocation request spans multiple source batches, the app receives one `credit.allocated` event per batch.

### Setup

```
POST /api/dev/credits/seed
{ "entityId": "<org-entity-uuid>", "minutesUntilSeasonalExpiry": 2 }
```

This creates:
- 500 seasonal credits (expires in 2m)
- 300 free credits (expires in 7m)
- 200 paid credits (expires with subscription)

Org pool: **1000 credits total**

### Allocate 650 credits to the app

```
POST /api/credits/allocate/application
{
  "sourceEntityId": "<org-entity-uuid>",
  "targetApplication": "accounting",
  "creditAmount": 650
}
```

**FIFO selection:**

| Source batch | Type | Available | Take | Remaining needed |
|-------------|------|-----------|------|-----------------|
| Seasonal batch | seasonal | 500 | 500 | 150 |
| Free batch | free | 300 | 150 | 0 |

**Expected response:**
```json
{
  "success": true,
  "creditAmount": 650,
  "previousBalance": 1000,
  "newBalance": 350,
  "batches": [
    {
      "allocationId": "app-uuid-A",
      "creditType": "seasonal",
      "expiresAt": "2025-06-15T10:02:00.000Z",
      "amount": 500
    },
    {
      "allocationId": "app-uuid-B",
      "creditType": "free",
      "expiresAt": "2025-06-15T10:07:00.000Z",
      "amount": 150
    }
  ]
}
```

**Two `credit.allocated` SNS events published** — one per source batch.

### What the app stores

```
local_batches:
  app-uuid-A: { amount: 500, creditType: seasonal, expiresAt: T+2m }
  app-uuid-B: { amount: 150, creditType: free,     expiresAt: T+7m }
  
app_balance: 650
```

### App consumes 400 credits (FIFO inside FA)

App sorts by `expiresAt ASC`, so consumes from `app-uuid-A` first:
```
app-uuid-A: usedCredits = 400 (100 remaining)
app_balance: 650 → 250
```

### T+2 minutes — app's expiry cron fires

```
app-uuid-A expired: 500 - 400 = 100 unused → deduct 100 → app_balance: 250 → 150
app-uuid-A.isExpired = true
```

### T+2 minutes — wrapper expiry cron fires (`/trigger-expiry`)

```
Org seasonal batch: usedCredits=500, allocatedCredits=500 → unusedCredits=0 → nothing to deduct
App batch app-uuid-A: audit record only
```

### T+7 minutes — app's cron fires again

```
app-uuid-B expired: 150 - 0 = 150 unused → deduct 150 → app_balance: 150 → 0
app-uuid-B.isExpired = true
```

### T+7 minutes — wrapper expiry cron fires

```
Org free batch: usedCredits=150, allocatedCredits=300 → unusedCredits=150 → deduct 150 from org pool
App batch app-uuid-B: audit record only
```

**Final state:**
- App balance: **0** ✓
- Org pool: **350** (only the untouched paid batch remains) ✓

---

## 8. Test Scenario D — Paid Credits Expire With Plan

**Goal:** Verify that backdating the subscription syncs paid batch expiry and notifies apps.

### Setup

```
POST /api/dev/credits/seed
{ "entityId": "<org-entity-uuid>", "minutesUntilSeasonalExpiry": 60 }
```

Then allocate 200 paid credits to an app (if paid batch was seeded with a real subscription end date):
```
POST /api/credits/allocate/application
{
  "sourceEntityId": "<org-entity-uuid>",
  "targetApplication": "crm",
  "creditAmount": 200
}
```

This allocates from the paid batch (seasonal and free were set to 60m expiry; paid is furthest out by subscription date). Adjust `creditAmount` based on your setup.

### Simulate plan expiry

```
POST /api/dev/credits/backdate-subscription
{ "minutesAgo": 1 }
```

**What happens:**
1. `subscriptions.currentPeriodEnd` → `now - 1m`
2. All active paid batches (**org-level** with `targetApplication` null, and **app-level** such as `targetApplication = 'crm'`) → `expiresAt = now - 1m`
3. `credit.expiry_updated` SNS event sent to CRM app:
   ```json
   {
     "eventType": "credit.expiry_updated",
     "payload": {
       "allocationId": "app-uuid-paid",
       "entityId": "<org-entity-uuid>",
       "creditType": "paid",
       "newExpiresAt": "2025-06-15T09:59:00.000Z",
       "reason": "subscription_expiry_sync"
     }
   }
   ```

### Application handles `credit.expiry_updated`

The app must update its local record:
```
local_batches.app-uuid-paid.expiresAt = 2025-06-15T09:59:00.000Z
```

On the next app cron run, this batch will be expired.

### Run wrapper expiry cron

```
POST /api/dev/credits/trigger-expiry
```

The org-level paid batch (unused portion) gets deducted from the org pool.

---

## 9. Application (FA) Side — What to Implement and Test

### Events to consume

| Event | When | Action |
|-------|------|--------|
| `credit.allocated` | Admin allocates to your app | Store batch locally with `allocationId`, `amount`, `creditType`, `expiresAt` |
| `credit.expiry_updated` | Subscription renews or cancels | Update `expiresAt` for the given `allocationId` in local storage |

### Local storage schema (minimum)

```sql
CREATE TABLE credit_batches (
  allocation_id   UUID PRIMARY KEY,
  credit_type     VARCHAR(20) NOT NULL,  -- 'seasonal' | 'free' | 'paid'
  allocated       INTEGER NOT NULL,
  used            INTEGER NOT NULL DEFAULT 0,
  expires_at      TIMESTAMP,             -- NULL means never expires
  is_expired      BOOLEAN NOT NULL DEFAULT false,
  received_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Credit consumption (FIFO inside FA)

When performing an operation that costs credits:
```sql
SELECT * FROM credit_batches
WHERE is_expired = false
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY expires_at ASC NULLS LAST
```
Deduct from the first batch with remaining credits.

### Expiry cron (run daily or more frequently)

```
Find all local batches where:
  - expires_at <= NOW()
  - is_expired = false

For each:
  unusedCredits = allocated - used
  if unusedCredits > 0:
    deduct unusedCredits from app_balance
  mark is_expired = true
```

### App-side test checklist

- [ ] On `credit.allocated`: batch stored with correct `creditType`, `amount`, `expiresAt`
- [ ] On `credit.allocated` with `neverExpires: true` (or `expiresAt: null`): batch stored without expiry
- [ ] Multiple `credit.allocated` events from one allocation (FIFO split): each batch stored separately
- [ ] On `credit.expiry_updated`: `expiresAt` updated for matching `allocationId`
- [ ] Expiry cron: unused credits deducted when `expiresAt <= now`
- [ ] Expiry cron: batch with 0 unused credits (all consumed) → no balance change, still marked expired
- [ ] FIFO consumption: soonest-expiring batch consumed first
- [ ] Balance never goes below 0

### Testing the app side against wrapper dev endpoints

1. Start the app locally and connect to the dev MQ instance
2. Run `POST /api/dev/credits/seed` on the wrapper to create batches
3. Allocate to your app: `POST /api/credits/allocate/application` — app receives events
4. Use `POST /api/dev/credits/backdate-subscription` to test `credit.expiry_updated`
5. Watch your local DB for the stored batches and updated `expiresAt`
6. Trigger your app's expiry cron manually (or wait for it to run)
7. Verify app balance matches expectations

---

## 10. SNS Event Reference

### `credit.allocated`

Published when an admin allocates credits from an org pool to an application.  
**One event per source batch** — if FIFO spans 3 batches, FA receives 3 events.

```json
{
  "eventType": "credit.allocated",
  "tenantId": "<uuid>",
  "publishedBy": "<userId>",
  "timestamp": "2025-06-15T10:00:00.000Z",
  "payload": {
    "allocationId":       "<uuid>",
    "entityId":           "<org-entity-uuid>",
    "targetApplication":  "crm",
    "deltaAmount":        400,
    "allocatedCredits":   400,
    "creditType":         "seasonal",
    "expiresAt":          "2025-06-15T10:02:00.000Z",
    "allocationType":     "organization",
    "allocationPurpose":  "Q2 campaign allocation",
    "allocationSource":   "admin_allocation",
    "allocatedBy":        "<admin-user-uuid>",
    "allocatedAt":        "2025-06-15T10:00:00.000Z",
    "metadata": {
      "sourceEntityId":        "<org-entity-uuid>",
      "previousEntityBalance": 1000,
      "newEntityBalance":       600,
      "neverExpires":           false
    }
  }
}
```

**Fields app must store:**

| Field | Purpose |
|-------|---------|
| `allocationId` | Primary key for this batch locally |
| `deltaAmount` | Credits received in this batch |
| `creditType` | `seasonal` / `free` / `paid` — determines FIFO priority |
| `expiresAt` | When to expire this batch. `null` = never expires |
| `neverExpires` | Convenience flag: `true` when `expiresAt` is null |

---

### `credit.expiry_updated`

Published when a subscription renewal or cancellation changes paid credit expiry.

```json
{
  "eventType": "credit.expiry_updated",
  "tenantId": "<uuid>",
  "publishedBy": "system",
  "timestamp": "2025-06-15T10:00:00.000Z",
  "payload": {
    "allocationId":   "<uuid>",
    "entityId":       "<org-entity-uuid>",
    "creditType":     "paid",
    "newExpiresAt":   "2026-06-15T00:00:00.000Z",
    "reason":         "subscription_expiry_sync"
  }
}
```

**App action:** Update `expires_at` in your local `credit_batches` table for the matching `allocationId`.

---

## 11. Database State Reference

### `credit_batches` key columns

Wrapper batch tracking lives in **`credit_batches`** (replaces legacy `seasonal_credit_allocations` in current schema).

| Column | Meaning |
|--------|---------|
| `target_application` | `NULL` = org pool batch. `"crm"` / `"accounting"` = app-level batch |
| `credit_type` | `seasonal` / `free` / `paid` |
| `allocated_credits` | Total credits in this batch |
| `used_credits` | For org batches: how much was drawn out via FIFO allocation. For app batches: not updated by wrapper |
| `expires_at` | `9999-12-31` = never expires (sentinel). Anything before `9998-01-01` = real expiry |
| `is_active` | `false` once expired |
| `is_expired` | `true` once processed by expiry cron |

### `credits` table

| Column | Meaning |
|--------|---------|
| `available_credits` | Running balance for the entity. Decremented at allocation time (not at expiry for app batches) |

### `credit_transactions` audit trail

| `transaction_type` | `operation_code` pattern | When created |
|--------------------|--------------------------|--------------|
| `purchase` | `purchase` | `addCreditsToEntity()` |
| `allocation` | `application_allocation:<appName>` | `allocateCreditsToApplication()` |
| `expiry` | `credit_expiry:primary_org:<allocationId>` | Org batch expires (balance deducted) |
| `expiry` | `credit_expiry:<appName>:<allocationId>` | App batch expires (audit only, balance not changed) |

---

## 12. Troubleshooting

**Expiry cron processed 0 batches even though I backdated**

- Check that the batch `isActive = true` and `isExpired = false` before backdating
- Check that `expiresAt` is before `9998-01-01` — the cron skips the sentinel date
- Verify you called `/trigger-expiry` after backdating, not before

**Balance did not decrease after org batch expired**

- Check `usedCredits` on the batch — if `usedCredits = allocatedCredits`, then `unusedCredits = 0` and no deduction happens (all credits were already allocated to apps)
- This is correct behavior: credits left the pool when they were allocated, not when they expired

**App did not receive `credit.allocated` event**

- Check the MQ connection and queue binding for the app
- Check wrapper logs for `⚠️ Failed to publish credit.allocated event` — the allocation itself succeeded even if MQ publish failed
- Re-run the allocation or manually re-publish from the outbox

**`credit.expiry_updated` event not received after `/backdate-subscription`**

- Event is only sent for **app-level** paid batches (`targetApplication IS NOT NULL`)
- If no credits were ever allocated to apps from paid batches, no events are sent
- Check the `/batches` response for rows with `creditType: "paid"` and a non-null `targetApplication`

**App balance went negative**

- App is not correctly FIFO-consuming within the available balance of each batch
- Check that `used + new_consumption <= allocated` before deducting

**Paid batch `expiresAt` did not update after `/backdate-subscription`**

- Verify the batch has `isActive: true`, `isExpired: false`, `creditType: "paid"`
- If the batch was already expired before the subscription was backdated, it won't be updated (correct behavior — already processed)

**`POST /api/dev/credits/seed` returns 500 (missing table/column)**

- Ensure migrations created **`credit_batches`** with **`credit_type`** (and related columns). Compare live DB to `backend/src/db/schema/billing/credit-batches.ts`.
- If the error mentioned `seasonal_credit_allocations`, the database is behind the current app — run the migration that introduces **`credit_batches`** or rename/migrate data per your deployment docs.

**Balance went up after a failed seed**

- `addCreditsToEntity` may have committed the **`credits`** / **`credit_transactions`** update before the **`credit_batches`** insert failed. Adjust balance or insert a matching batch after fixing schema (dev-only cleanup).
