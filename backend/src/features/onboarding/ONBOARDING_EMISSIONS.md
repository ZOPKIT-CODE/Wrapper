# Onboarding — Event & Snapshot Emissions Reference

Every event, message, and payload object emitted during the onboarding flow, with exact field names, types, and source locations.

---

## Table of Contents

1. [Emission Overview](#1-emission-overview)
2. [Event 1 — `tenant.app.provisioned` (per-app thin event)](#2-event-1--tenantappprovisioned)
3. [Event 2 — `tenant.onboarded` (full snapshot push)](#3-event-2--tenantonboarded)
4. [Snapshot Object — Full Field Reference](#4-snapshot-object--full-field-reference)
5. [Event 3 — `onboarding_phase_trial` (completion tracking)](#5-event-3--onboarding_phase_trial)
6. [Welcome Notification](#6-welcome-notification)
7. [AMQP Wire Format (all events)](#7-amqp-wire-format-all-events)
8. [Outbox Row (event_tracking table)](#8-outbox-row-event_tracking-table)
9. [Emission Sequence & Timing](#9-emission-sequence--timing)
10. [Which Emissions are Fatal vs Non-Fatal](#10-which-emissions-are-fatal-vs-non-fatal)

---

## 1. Emission Overview

| # | Event / Action | Target | Fatal? | Source |
|---|---------------|--------|--------|--------|
| 1 | `tenant.app.provisioned` (one per enabled app) | Per-app Amazon MQ queue | No | `publishAppProvisioningEvents()` |
| 2 | `tenant.onboarded` (full snapshot) | `accounting` Amazon MQ queue | No | Post-response async block |
| 3 | `onboarding_phase_trial` (completion metric) | `event_tracking` table | No | `trackOnboardingCompletion()` |
| 4 | Welcome notification | `notifications` table | No | After transaction commits |

All four happen **after** the main transaction commits. None can roll back onboarding if they fail.

---

## 2. Event 1 — `tenant.app.provisioned`

**When**: Immediately after the DB transaction commits, one event per app the tenant has enabled in `organization_applications`.

**Source**: `unified-onboarding-service.ts` → `publishAppProvisioningEvents()` (line ~623)

**Purpose**: Thin provisioning signal — no domain data. The receiving app bootstraps lazily on first user login.

**Routing key**: `<appCode>.tenant.app.provisioned` (e.g. `accounting.tenant.app.provisioned`)

### Top-Level Event Fields

```
eventType:         'tenant.app.provisioned'
sourceApplication: 'wrapper'
targetApplication: <appCode>           // e.g. 'accounting', 'hr', 'crm'
tenantId:          <uuid>
entityId:          <tenantId>          // same as tenantId for this event
publishedBy:       <userId>            // admin user's userId
```

### `eventData` Payload

```
appCode:          string    // e.g. 'accounting'
tenantId:         string    // Wrapper tenant UUID
plan:             string    // e.g. 'free', 'starter', 'growth'
subscriptionTier: string | null   // from organization_applications.subscription_tier
enabledModules:   string[]        // from organization_applications.enabled_modules (JSON array)
expiresAt:        string | null   // ISO timestamp or null if no expiry
onboardedAt:      string          // ISO timestamp (new Date().toISOString())
bootstrapHint:    'lazy — call POST /api/sync/tenants/:id/bootstrap on first user login'
```

**Example**:
```json
{
  "eventType": "tenant.app.provisioned",
  "sourceApplication": "wrapper",
  "targetApplication": "accounting",
  "tenantId": "a1b2c3d4-...",
  "entityId": "a1b2c3d4-...",
  "publishedBy": "u9f8e7d6-...",
  "eventData": {
    "appCode": "accounting",
    "tenantId": "a1b2c3d4-...",
    "plan": "starter",
    "subscriptionTier": null,
    "enabledModules": ["journals", "reports"],
    "expiresAt": null,
    "onboardedAt": "2026-04-04T10:23:45.000Z",
    "bootstrapHint": "lazy — call POST /api/sync/tenants/:id/bootstrap on first user login"
  }
}
```

> **Note**: This is intentionally thin. The receiving app MUST call `POST /api/sync/tenants/:id/bootstrap` on first login to pull the full data snapshot.

---

## 3. Event 2 — `tenant.onboarded`

**When**: Fire-and-forget, after the transaction commits and the response is sent to the frontend.

**Source**: `unified-onboarding-service.ts` post-response async block (line ~1564)

**Purpose**: Push-based bootstrap — sends the complete initial data snapshot directly to `accounting` so it does not need to pull on first login.

**Routing key**: `accounting.tenant.onboarded`

### Top-Level Event Fields

```
eventType:         'tenant.onboarded'
sourceApplication: 'wrapper'
targetApplication: 'accounting'
tenantId:          <uuid>
entityId:          <tenantId>
publishedBy:       <adminUserId>    // falls back to 'system' if userId unavailable
```

### `eventData` Payload

```
tenantId:       string          // Wrapper tenant UUID
tenantName:     string          // Company name
onboardedAt:    string          // ISO timestamp
adminEmail:     string | null
kindeOrgId:     string | null   // Kinde organization code
subdomain:      string | null   // e.g. 'acme' (not full URL)
wrapperTenantId: string         // same as tenantId (explicit alias for FA schema)
snapshot:       SnapshotObject  // see Section 4
```

---

## 4. Snapshot Object — Full Field Reference

**Source**: `bootstrap-service.ts` → `BootstrapService.assemble('accounting')` (line ~343)

The snapshot is assembled inside a single `READ COMMITTED` Postgres transaction for consistency. It is identical to what `POST /api/sync/tenants/:id/bootstrap` returns — no field drift.

```
snapshot: {
  snapshotAt:          string          // ISO timestamp when assembled
  tenantId:            string
  appCode:             string          // 'accounting'
  tenant:              TenantRecord | null
  organizations:       Organization[]
  users:               User[]
  roles:               Role[]
  employeeAssignments: EmployeeAssignment[]
  roleAssignments:     RoleAssignment[]
  creditConfigs:       CreditConfig[]
  entityCredits:       EntityCredit[]
  recordCounts:        RecordCounts
  warnings:            Warning[]
}
```

---

### 4.1 `tenant` (TenantRecord)

Source table: `tenants` + `subscriptions`

```
tenantId:    string          // PK
tenantName:  string          // from tenants.company_name (FA reads 'tenantName', not 'companyName')
kindeOrgId:  string | null   // Kinde org code for SSO
isActive:    boolean
planName:    string | null   // most recent subscription plan name

subscription: {
  plan:           string | null    // 'free' | 'starter' | 'growth' | 'enterprise'
  status:         string | null    // 'active' | 'trialing' | 'canceled' | ...
  billingCycle:   string | null    // 'monthly' | 'annual'
  isTrialUser:    boolean
  trialStartedAt: string | null    // ISO timestamp
  trialEndsAt:    string | null    // ISO timestamp
} | null
```

> `tenantName` is the canonical field name. FA's DB column is `tenant_name`. Do NOT use `companyName`.

---

### 4.2 `organizations` (Organization[])

Source table: `entities` (where `entity_type = 'organization'` or all entity rows, scoped to tenant)

```
entityId:  string          // Wrapper UUID — use as FK for wrapper_entities.entity_id in FA
orgCode:   string          // same as entityId (entity_code column was dropped in migration 0015)
orgName:   string          // from entities.entity_name
parentId:  string | null   // parent entity UUID, or null for root
level:     number | null   // hierarchy depth (1 = root)
country:   string | null   // ISO 3166-1 alpha-2
currency:  string | null   // ISO 4217 (e.g. 'INR', 'USD')
isActive:  boolean
```

---

### 4.3 `users` (User[])

Source table: `tenant_users`

```
userId:        string          // Wrapper user UUID
kindeId:       string | null   // Kinde user ID for auth lookup
email:         string
firstName:     string
lastName:      string
isTenantAdmin: boolean
isActive:      boolean
```

---

### 4.4 `roles` (Role[])

Source table: `custom_roles`, filtered and scoped to `appCode`

```
roleId:       string     // Wrapper role UUID
roleName:     string
permissions:  string[]   // Flat permission strings scoped to appCode
                         // e.g. ["accounting.journals.create", "accounting.reports.view"]
priority:     number
isSystemRole: boolean
```

> Permissions are pre-filtered to only include entries relevant to `appCode`. Cross-app permissions are stripped.

---

### 4.5 `employeeAssignments` (EmployeeAssignment[])

Source table: `organization_memberships`

```
assignmentId:   string
userId:         string          // FK → users.userId
entityId:       string          // FK → organizations.entityId
membershipType: string          // e.g. 'employee', 'contractor'
isPrimary:      boolean
accessLevel:    string | null
```

---

### 4.6 `roleAssignments` (RoleAssignment[])

Source table: `user_role_assignments`

```
assignmentId: string
userId:       string          // FK → users.userId
roleId:       string          // FK → roles.roleId
entityId:     string | null   // org-scoped assignment or null for tenant-wide
assignedAt:   string | null   // ISO timestamp (Date serialized)
isActive:     boolean
```

---

### 4.7 `creditConfigs` (CreditConfig[])

Source table: `credit_configurations` (tenant-specific overrides merged with global defaults from `BUSINESS_SUITE_MATRIX`)

```
configId:      string | null    // null for matrix-derived defaults
operationCode: string           // e.g. 'invoice.generate'
operationName: string           // human-readable name
creditCost:    number
unit:          string           // e.g. 'per_invoice'
isGlobal:      boolean          // true = platform default, false = tenant override
source:        'global' | 'tenant' | 'default'
```

---

### 4.8 `entityCredits` (EntityCredit[])

Source table: `credits`

```
entityId:         string    // FK → organizations.entityId
allocatedCredits: number
usedCredits:      number
availableCredits: number
isActive:         boolean
```

---

### 4.9 `recordCounts`

```
recordCounts: {
  tenant:              number   // 0 or 1
  organizations:       number
  users:               number
  roles:               number
  employeeAssignments: number
  roleAssignments:     number
  creditConfigs:       number
  entityCredits:       number
}
```

---

### 4.10 `warnings`

Per-collection fetch errors that did not abort the snapshot. FA should log these but not fail.

```
warnings: Array<{
  collection: string   // e.g. 'creditConfigs', 'entityCredits'
  error:      string   // error message
}>
```

---

## 5. Event 3 — `onboarding_phase_trial`

**When**: Fire-and-forget, part of the post-response async block.

**Source**: `unified-onboarding-service.ts` → `trackOnboardingCompletion()` → `onboarding-tracking-service.ts` → `trackOnboardingPhase()`

**Purpose**: Internal analytics — records that this tenant completed onboarding. Written to the `event_tracking` table only (not published to MQ).

### Row written to `event_tracking`

```
eventId:           string    // uuidv4
eventType:         'onboarding_phase_trial'
tenantId:          string
streamKey:         'onboarding'
sourceApplication: 'onboarding'
targetApplication: 'platform'
publishedBy:       null       // userId unavailable at tracking time
status:            'published'
acknowledged:      false

eventData: {
  phase:            'trial'
  status:           'completed'
  userId:           null
  sessionId:        null
  onboardingType:   string    // 'frontend' | 'api' | etc.
  companyName:      string
  adminEmail:       string
  subdomain:        string
  selectedPlan:     string
  creditAmount:     number
  completedAt:      string    // ISO timestamp
  source:           string    // e.g. 'unified_frontend_onboarding'
  version:          '2.0'
  completionRate:   100
  stepNumber:       4
  totalSteps:       4
}

metadata: {
  ipAddress:  null
  userAgent:  null
}
```

---

## 6. Welcome Notification

**When**: After the DB transaction commits (within the same request, before response).

**Source**: `unified-onboarding-service.ts` (line ~464), insert into `notifications` table.

**Purpose**: In-app welcome message shown to the admin user on first login.

### Row written to `notifications`

```
tenantId:     string    // new tenant UUID
targetUserId: string    // admin user UUID
type:         'welcome'
title:        'Welcome to the platform!'
message:      'Your workspace "<companyName>" is ready. Start by exploring the dashboard.'
isRead:       false     // default
```

---

## 7. AMQP Wire Format (all events)

Every event published to Amazon MQ (events 1 and 2) is serialized as JSON with this envelope:

```
{
  eventId:           string    // generated: 'inter_<timestamp>_<random>' or caller-supplied
  eventType:         string    // e.g. 'tenant.app.provisioned'
  sourceApplication: string    // 'wrapper'
  targetApplication: string    // e.g. 'accounting'
  tenantId:          string
  entityId:          string
  timestamp:         string    // ISO timestamp set at publish time
  eventData:         object    // the eventData payload (see above per event type)
  publishedBy:       string
}
```

**AMQP message properties** (set on the channel publish call):

```
persistent:  true          // survives broker restart
mandatory:   true          // returned if no queue matches routing key
messageId:   <eventId>
timestamp:   <unix ms>
headers: {
  sourceApp: string
  targetApp: string
  tenantId:  string
  entityId:  string
  eventType: string
}
```

**Routing key format**: `<targetApplication>.<eventType>`
- `accounting.tenant.app.provisioned`
- `accounting.tenant.onboarded`

---

## 8. Outbox Row (`event_tracking` table)

Every MQ publish also writes a row to `event_tracking` as an outbox record (via `EventTrackingService`).

```
eventId:           string    // same eventId as AMQP message
eventType:         string
tenantId:          string
entityId:          string | null
streamKey:         string
sourceApplication: string
targetApplication: string
eventData:         jsonb     // full eventData object
publishedBy:       string | null
metadata:          jsonb     {
                               ...callerMetadata,
                               outbox: true
                             }
status:            'pending'
acknowledged:      false
createdAt:         timestamp (auto)
```

---

## 9. Emission Sequence & Timing

```
Frontend submits onboarding form
        │
        ▼
[REQUEST BOUNDARY]
        │
        ├─ Phase 1–5: Kinde setup + atomic DB transaction
        │
        ├─ Phase 6: Mark onboardingCompleted = true in tenants
        │
        ├─ Phase 7: Delete onboarding_form_data
        │
        │  ← HTTP 200 response sent to frontend ─────────────────┐
        │                                                        │
[ASYNC / FIRE-AND-FORGET — does NOT block response]             │
        │                                                        │
        ├─ Insert welcome notification                           │
        │                                                        │
        ├─ publishAppProvisioningEvents()                        │
        │    └─ For each enabled app:                           │
        │         ├─ Publish tenant.app.provisioned → MQ        │
        │         └─ Write outbox row → event_tracking          │
        │                                                        │
        ├─ Publish tenant.onboarded (snapshot) → MQ             │
        │    └─ Write outbox row → event_tracking               │
        │                                                        │
        └─ trackOnboardingCompletion()                          │
             └─ Write onboarding_phase_trial → event_tracking   │
                                                                 │
[FRONTEND receives 200] ◄────────────────────────────────────────┘
```

---

## 10. Which Emissions are Fatal vs Non-Fatal

| Emission | Fatal to Onboarding? | Behavior on Failure |
|----------|---------------------|---------------------|
| Welcome notification | No | Logged as warning, onboarding succeeds |
| `tenant.app.provisioned` | No | Logged per-app, other apps still get their event |
| `tenant.onboarded` (snapshot) | No | FA falls back to pull-based bootstrap on first login |
| `onboarding_phase_trial` tracking | No | Logged as warning, ignored |

If Amazon MQ is down during onboarding, the outbox row in `event_tracking` remains with `status = 'pending'`. A background job or retry mechanism should re-publish unacknowledged outbox rows.
