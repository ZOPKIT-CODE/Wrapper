# Credit Expiry — Implementation Guide

## Three Credit Types

| Type | Origin | Typical Expiry | FIFO Order |
|------|--------|---------------|------------|
| **Seasonal** | Admin campaign (e.g. "Summer Promo") | Days to weeks | Consumed **first** |
| **Free** | Admin grant, onboarding, trial | Weeks or none | Consumed **second** |
| **Paid** | Stripe purchase | Months/years or none | Consumed **last** |

FIFO = "use the soonest-expiring credits first." When an org has a mix of all three types in its pool, allocating to an app draws from seasonal first, then free, then paid.

---

## Architecture

```
Admin grants credits
  → addCreditsToEntity(creditType, expiresAt)
  → credits.available_credits += N           (fast-read balance)
  → seasonal_credit_allocations row created  (batch tracking with type + expiry)

Admin allocates credits to an app
  → allocateCreditsToApplication(amount)
  → FIFO: reads org-level batches ordered by expiresAt ASC, then type priority
  → deducts from credits.available_credits
  → updates used_credits on each source org batch
  → creates one app-level seasonal_credit_allocations row per source batch
  → sends one credit.allocated SNS event per batch (with creditType + expiresAt)

App (FA cron) — handles its own expiry
  → reads stored allocationId batches where expiresAt <= NOW()
  → zeroes out remaining credits from that batch

Wrapper expiry cron — handles org pool
  → org-level batches (targetApplication IS NULL): deducts unused from org pool
  → app-level batches (targetApplication SET): writes audit record only
```

---

## What Was Changed

### Files Modified

| File | Change |
|------|--------|
| `migrations/credit_expiry_tracking.sql` | Makes `campaign_id` nullable |
| `migrations/credit_type_column.sql` | Adds `credit_type VARCHAR(20)` to `seasonal_credit_allocations` |
| `schema/billing/seasonal-credits.ts` | `campaignId` optional; `creditType` field added |
| `credit-operations.ts` — `addCreditsToEntity` | New params: `creditType`, `expiresAt`. Creates org-level batch record after adding to pool. |
| `credit-operations.ts` — `purchaseCredits` | Passes `creditType: 'paid'` and `expiresAt` to `addCreditsToEntity` |
| `credit-operations.ts` — `allocateCreditsToApplication` | Full rewrite: FIFO batch selection, per-batch app records, per-batch SNS events |
| `credit-expiry-service.ts` | App-specific allocations write audit only (no SNS event). Never-expires sentinel filter added. |
| `SeasonalCreditService.ts` | All inserts now set `creditType: 'seasonal'` |

---

## How Each Credit Type Enters the System

### Seasonal credits

Created by an admin campaign via `SeasonalCreditService.distributeCreditsToTenants()`.

```
seasonal_credit_allocations row:
  creditType        = 'seasonal'
  targetApplication = null         (org pool)
  expiresAt         = campaign.expiresAt
  campaignId        = <uuid>
```

### Free credits

Created via `addCreditsToEntity({ creditType: 'free', expiresAt: ... })`.
Used for: onboarding initialization, admin manual grants, trial credits.

```
seasonal_credit_allocations row:
  creditType        = 'free'
  targetApplication = null         (org pool)
  expiresAt         = provided date, or 9999-12-31 (never expires)
  campaignId        = null
```

### Paid credits

Created via `purchaseCredits()` → internally calls `addCreditsToEntity({ creditType: 'paid', expiresAt })`.
`expiresAt` can be set at purchase time (e.g. 1 year from purchase) or left null.

```
seasonal_credit_allocations row:
  creditType        = 'paid'
  targetApplication = null         (org pool)
  expiresAt         = purchase.expiresAt, or 9999-12-31 (never expires)
  campaignId        = null
```

---

## How Allocation to an App Works (FIFO)

When an admin calls `POST /api/credits/allocate/application` with `{ creditAmount: 350 }`:

### Org pool before allocation

| Batch | Type | Available | Expires |
|-------|------|-----------|---------|
| A | seasonal | 100 | Day 7 |
| B | free | 200 | Day 30 |
| C | paid | 500 | Day 365 |

### FIFO selection for 350 credits

| Source | Type | Take | Remaining needed |
|--------|------|------|-----------------|
| Batch A | seasonal | 100 | 250 |
| Batch B | free | 200 | 50 |
| Batch C | paid | 50 | 0 |

### Result

- `credits.available_credits` reduced by 350
- Batch A, B, C `used_credits` updated
- **3 app-level `seasonal_credit_allocations` rows** created (one per source)
- **3 `credit.allocated` SNS events** sent to FA

Each SNS event carries its own `allocationId`, `creditType`, and `expiresAt`:

```json
// Event 1
{ "allocationId": "uuid-1", "deltaAmount": 100, "creditType": "seasonal", "expiresAt": "Day 7" }

// Event 2
{ "allocationId": "uuid-2", "deltaAmount": 200, "creditType": "free",     "expiresAt": "Day 30" }

// Event 3
{ "allocationId": "uuid-3", "deltaAmount": 50,  "creditType": "paid",     "expiresAt": "Day 365" }
```

---

## Expiry

### App side (FA's own cron)

FA stores the three batches from the events above. Its cron runs daily:

```
Day 7:  allocationId uuid-1 expires → FA zeroes 100 (or less if some was consumed)
Day 30: allocationId uuid-2 expires → FA zeroes remaining
Day 365: allocationId uuid-3 expires → FA zeroes remaining
```

No communication back to wrapper. FA is fully autonomous.

### Wrapper side (org pool cron)

`CreditExpiryService.processExpiredCredits()` runs on a schedule.

For **org-level** (`targetApplication IS NULL`) expired rows:
- `unusedCredits = allocatedCredits - usedCredits`
- Deducts from `credits.available_credits`
- e.g. Batch A had 100 allocated, 100 was taken by the allocation → `usedCredits = 100`, `unusedCredits = 0` → nothing to deduct

For **app-level** (`targetApplication IS SET`) expired rows:
- Writes audit record in `credit_transactions` only
- App already handled its own balance via its cron

Never-expires batches (sentinel `9999-12-31`) are excluded from both paths.

---

## Scenario Walkthroughs

### Scenario 1 — Single free batch, partial usage

```
Admin grants: 1,000 free credits, expires Day 14
  → org pool = 1,000
  → batch F1: type=free, allocated=1000, used=0, expiresAt=Day14

Admin allocates 250 to FA
  → FIFO: takes 250 from batch F1
  → batch F1: used_credits = 250
  → org pool = 750
  → App batch A1: type=free, allocated=250, expiresAt=Day14
  → SNS: credit.allocated { allocationId: A1, deltaAmount: 250, creditType: free, expiresAt: Day14 }

FA consumes 140 credits from A1 (FA tracks internally)

Day 14 — FA cron:
  → A1 expired, 110 remaining → FA zeroes 110 → FA balance = 0

Day 14 — Wrapper cron:
  → Batch F1: used=250, allocated=1000, unusedCredits=750 → deducts 750 from org pool
  → App batch A1: writes audit record only
```

**Result:** FA = 0 ✓  Org pool = 0 ✓

---

### Scenario 2 — Mixed batch allocation

```
Admin grants: 500 seasonal credits, expires Day 7
Admin grants: 300 free credits, expires Day 30
Admin purchases: 1,000 paid credits, no expiry

Org pool batches:
  S1: seasonal, 500, Day 7
  F1: free, 300, Day 30
  P1: paid, 1000, never

Admin allocates 600 to FA:
  FIFO → take 500 from S1, then 100 from F1
  S1: used_credits = 500
  F1: used_credits = 100
  App batches:
    A1: seasonal, 500, expiresAt=Day7
    A2: free, 100, expiresAt=Day30

FA consumes 400 credits (FIFO inside FA: 400 from A1)

Day 7 — FA cron:
  → A1 expired: FA consumed 400, remaining 100 → FA zeroes 100
  → A2 untouched: 100 credits remain

Day 7 — Wrapper cron:
  → S1 expired: used=500, allocated=500, unusedCredits=0 → nothing to deduct ✓
  → A1 app batch: audit record

Day 30 — FA cron:
  → A2 expired: FA consumed 0, remaining 100 → FA zeroes 100

Day 30 — Wrapper cron:
  → F1 expired: used=100, allocated=300, unusedCredits=200 → deducts 200 from org pool
  → A2 app batch: audit record
```

**Result on Day 7:** FA = 100 (only A2 remains) ✓  
**Result on Day 30:** FA = 0 ✓  
**P1 (paid, no expiry): fully intact in org pool** ✓

---

## API Reference

### `POST /api/credits/allocate/application`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `sourceEntityId` | UUID | Yes | Org to draw from |
| `targetApplication` | string | Yes | `accounting`, `crm`, etc. |
| `creditAmount` | number | Yes | Total to allocate |
| `allocationPurpose` | string | No | Label |

`expiresAt` is **not** a parameter here — expiry is inherited from source batches automatically via FIFO.

**Response:**
```json
{
  "success": true,
  "creditAmount": 600,
  "previousBalance": 1800,
  "newBalance": 1200,
  "batches": [
    { "allocationId": "...", "creditType": "seasonal", "expiresAt": "...", "amount": 500 },
    { "allocationId": "...", "creditType": "free",     "expiresAt": "...", "amount": 100 }
  ]
}
```

### `addCreditsToEntity` params (new)

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `creditType` | `'free' \| 'paid' \| 'seasonal'` | `'free'` | Origin of the credits |
| `expiresAt` | `Date \| null` | `null` | null = never expires (sentinel stored) |

### `purchaseCredits` params (new)

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `expiresAt` | `Date \| null` | `null` | Expiry for this paid credit batch |

---

## What FA Must Implement

### On receiving `credit.allocated`
Store each batch locally:
```
{ allocationId, amount, creditType, expiresAt }
```
FA may receive **multiple events per admin allocation** when the admin's request spans multiple source batches.

### When consuming credits (FIFO inside FA)
Sort batches by `expiresAt ASC NULLS LAST` → consume from soonest-expiring first.

### FA expiry cron
```
Find all local batches where expiresAt <= NOW() and isExpired = false
  unusedCredits = allocatedCredits - usedCredits
  Deduct unusedCredits from FA balance
  Mark batch as isExpired = true
```
