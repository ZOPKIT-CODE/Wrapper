# Credit Expiry Behavior

## Key Terms


| Term                          | Meaning                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Org pool**                  | The master credit balance held in the `credits` table for the organization                                   |
| **FA allocation**             | Credits transferred from the org pool to Financial Accounting via `credit.allocated` SNS event               |
| `seasonal_credit_allocations` | Wrapper-side record tracking each allocation batch — holds `allocated_credits`, `used_credits`, `expires_at` |


---

## Scenario 1 — Single batch, partial usage

### Setup

- Admin grants org **1,000 free credits**, expiry = 14 days
- Admin allocates **250 credits to FA**
- FA uses **140 credits**

### State at Day 0 → Day 13


| Who                                   | Credits                                                              |
| ------------------------------------- | -------------------------------------------------------------------- |
| Org pool                              | 750 (1000 − 250 allocated)                                           |
| FA (in FA's own ledger)               | 110 remaining (250 − 140 used)                                       |
| Wrapper `seasonal_credit_allocations` | allocated=250, used_credits=**0** (never updated — see Gap #2 below) |


### What happens on Day 14 (expiry cron runs)

1. Cron finds the allocation: `allocated=250, used_credits=0` → `unusedCredits = 250 − 0 = **250`**
2. Sends `credit.expired { expiredCredits: 250 }` to FA via SNS
3. FA receives the event and must revoke 250 credits from its balance
4. FA has 110 remaining → FA balance goes to **−140** (or is clamped to 0, depending on FA's implementation)
5. The 140 credits FA already consumed are gone — they were valid usage before expiry, no recovery

**Org pool:** Separately, the org's remaining 750 free credits are also deducted by `deductExpiredCredits()` → org pool goes to **0**

### Correct expected behavior (not current)

Wrapper should know FA used 140, so `unusedCredits = 250 − 140 = 110`.  
FA should receive `credit.expired { expiredCredits: 110 }` and end up at **0**, not negative.

---

## Scenario 2 — Mixed batches, same FA allocation

### Setup

- Admin grants org **1,000 free credits**, expiry = 14 days → allocates **250 to FA** (Batch A)
- Admin purchases **1,000 more credits**, expiry = 1 year → allocates **250 to FA** (Batch B)
- FA total allocated: **500 credits**
- FA uses **140 credits** (from mixed pool, no per-batch tracking on FA side)

### State before Day 14


| Who                         | Credits                                            |
| --------------------------- | -------------------------------------------------- |
| Org pool                    | 1,500 − 500 = **1,000** (750 free + 250 purchased) |
| FA (in FA's own ledger)     | **360** remaining (500 − 140)                      |
| Wrapper: Batch A allocation | allocated=250, used_credits=0                      |
| Wrapper: Batch B allocation | allocated=250, used_credits=0                      |


### What happens on Day 14 (Batch A expires, Batch B does not)

1. Cron finds **only Batch A** expired: `allocated=250, used_credits=0` → `unusedCredits = 250`
2. Sends `credit.expired { expiredCredits: 250 }` to FA
3. FA has 360 remaining → FA deducts 250 → **FA balance = 110**

**Correct expected behavior:**
FA consumed 140 from the combined pool. If using FIFO (consume earliest-expiring first), all 140 came from Batch A.  
Batch A unused = 250 − 140 = **110**. FA should end up at **360 − 110 = 250** (Batch B intact).  
Instead FA ends up at **110** — 140 credits short, those belonged to Batch B.

**Org pool:** The free credits still in the org pool (750) also expire → deducted. Purchased credits (250 remaining in org) stay.

---

## The Two Gaps

### Gap 1 — `expiresAt` not sent in `credit.allocated` event

`allocateCreditsToApplication()` publishes this to FA via SNS:

```json
{
  "deltaAmount": 250,
  "allocatedAt": "2026-04-05T...",
  "allocationId": "app_alloc_..."
}
```

`expiresAt` is **not included**. FA cannot:

- Show users "your credits expire on X"
- Send pre-expiry warnings
- Order consumption (use-soonest-expiring-first)

### Gap 2 — `used_credits` in wrapper is never updated from FA consumption

When FA consumes 140 credits it records them in its own ledger (`accounting_credit_usage`).  
**No event is sent back to wrapper.** The wrapper's `seasonal_credit_allocations.used_credits` stays at **0**.

At expiry time, `processExpiredAllocation()` computes:

```
unusedCredits = allocatedCredits − usedCredits
             = 250 − 0
             = 250   ← wrong, should be 110
```

So `credit.expired` always revokes the **full originally-allocated amount**, ignoring any credits FA legitimately consumed.

---

## Summary


| Scenario                                                            | Expected FA balance after expiry | Current FA balance after expiry |
| ------------------------------------------------------------------- | -------------------------------- | ------------------------------- |
| 250 allocated, 140 used, single batch                               | 0                                | −140 (or 0 if clamped)          |
| 500 allocated (250 free + 250 purchased), 140 used, Batch A expires | 250 (Batch B intact)             | 110 (over-revoked)              |


**Root cause:** Wrapper revokes `allocatedCredits` not `allocatedCredits − actualUsed`, because FA never reports consumption back to wrapper.

---

## What Needs to Change

1. **Include `expiresAt` in `credit.allocated` SNS event** — so FA knows per-batch expiry and can display/warn users.
2. **FA must report consumption back to wrapper** — either via a `credit.consumed` event per operation, or a periodic sync of `used_credits`. Wrapper then updates `seasonal_credit_allocations.used_credits`.
3. **FA should track credits per allocation batch** (using `allocationId`) — so when a batch expires, FA can revoke exactly the unused credits from that batch, not a blended pool amount.

