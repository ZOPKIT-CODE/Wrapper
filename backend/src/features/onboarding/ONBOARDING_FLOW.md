# Onboarding Flow — Deep-Dive Reference

> Complete technical reference: data points, DB writes, event emissions, and flow diagrams
> for the frontend onboarding pipeline.  
> Source of truth: `unified-onboarding-service.ts` + `core-onboarding.ts`

---

## Table of Contents

1. [Overview](#1-overview)
2. [API Endpoints](#2-api-endpoints)
3. [5-Step Frontend Form](#3-5-step-frontend-form)
4. [End-to-End Workflow (8 Orchestration Phases)](#4-end-to-end-workflow-8-orchestration-phases)
5. [Database Transaction — 10 Writes](#5-database-transaction--10-writes)
6. [Field-to-Table Mapping](#6-field-to-table-mapping)
7. [Event Tracking — What Is Emitted](#7-event-tracking--what-is-emitted)
8. [Flow Diagram](#8-flow-diagram)
9. [Failure & Retry Handling](#9-failure--retry-handling)
10. [Verification Checks](#10-verification-checks)
11. [Post-Onboarding Async Work](#11-post-onboarding-async-work)
12. [Known Gaps](#12-known-gaps)

---

## 1. Overview

Onboarding converts a Kinde-authenticated user into a fully provisioned tenant.
A single HTTP call (`POST /api/onboarding/onboard-frontend`) triggers an 8-phase
orchestration that creates **12+ database rows across 10 tables** inside one atomic
transaction, then fires async events to downstream apps.

**Single entry point:**  
`UnifiedOnboardingService.completeOnboardingWorkflow()` — `unified-onboarding-service.ts`

---

## 2. API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/onboarding/onboard-frontend/validate-step` | Bearer token | Per-step validation before advancing |
| `POST` | `/api/onboarding/onboard-frontend` | Bearer token | **Main: complete onboarding** |
| `GET`  | `/api/onboarding/onboard-frontend/retry-data` | Bearer token | Retrieve saved form data after failure |
| `POST` | `/api/onboarding/onboard-frontend/retry` | Bearer token | Retry using stored form data |

---

## 3. 5-Step Frontend Form

The form collects data across 5 steps. Each step is independently validated
via `POST /validate-step` before the user advances.

### Step 1 — Company Information
| Field | Required | Validation |
|-------|----------|------------|
| `legalCompanyName` | ✅ | Non-empty string |
| `companySize` | ✅ | Enum: `1-10`, `11-50`, `51-200`, `201-1000`, `1000+` |
| `businessType` | ✅ | Non-empty string |
| `companyType` | ❌ | Optional |
| `website` | ❌ | Optional URL |

### Step 2 — Admin / Personal Information
| Field | Required | Validation |
|-------|----------|------------|
| `firstName` | ✅ | Non-empty |
| `lastName` | ✅ | Non-empty |
| `email` / `adminEmail` | ✅ | Valid email + duplicate check against `tenants.admin_email` |
| `panNumber` | ❌ | Regex `[A-Z]{5}[0-9]{4}[A-Z]`, 10 chars, verified via external API |
| `adminMobile` | ❌ | Phone number |
| `contactJobTitle` | ❌ | |
| `contactSalutation/MiddleName/Department/DirectPhone/MobilePhone/AuthorityLevel` | ❌ | Extended contact |

### Step 3 — Tax Information
| Field | Required | Validation |
|-------|----------|------------|
| `taxRegistered` | ❌ | Boolean, default `false` |
| `vatGstRegistered` | ❌ | Boolean, default `false` |
| `hasGstin` | ❌ | Boolean |
| `gstin` | ❌ (if `hasGstin`) | Regex `[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]`, 15 chars, API verified |
| `taxRegistrationDetails` | ❌ | JSONB `{ pan, country, ... }` |

### Step 4 — Preferences / Address
| Field | Required | Validation |
|-------|----------|------------|
| `country` | ✅ | Non-empty |
| `timezone` | ✅ | Non-empty |
| `currency` | ✅ | Non-empty |
| `defaultLanguage` | ❌ | Default `en` |
| `defaultLocale` | ❌ | Default `en-IN` |
| `billingStreet/City/State/Zip/Country` | ❌ | Billing address |
| `mailingAddressSameAsRegistered` | ❌ | Boolean, default `true` |
| `mailingStreet/City/State/Zip/Country` | ❌ | Only if different |
| `billingEmail` | ❌ | |
| `supportEmail` | ❌ | |
| `preferredContactMethod` | ❌ | `email` / `phone` / `sms` |

### Step 5 — Terms & Review
| Field | Required | Validation |
|-------|----------|------------|
| `termsAccepted` | ✅ | Must be `true` |

---

## 4. End-to-End Workflow (8 Orchestration Phases)

```
POST /api/onboarding/onboard-frontend
         │
         ▼
   preValidation hook
   (strip empty/null optional fields from body)
         │
         ▼
UnifiedOnboardingService.completeOnboardingWorkflow()
         │
         ├─ Phase 1 ─ VALIDATE INPUT
         │    └─ OnboardingValidationService.validateCompleteOnboarding()
         │         ├─ Duplicate email check → tenants.admin_email
         │         ├─ Subdomain uniqueness check → tenants.subdomain
         │         ├─ PAN / GSTIN format validation
         │         └─ Terms accepted check
         │
         ├─ Phases 2+3 ─ PARALLEL ─────────────────────────────────────┐
         │    ├─ Generate unique subdomain                              │
         │    │    └─ slugify(companyName) → check DB uniqueness        │
         │    └─ Extract + validate Kinde Bearer token                  │
         │         └─ kindeService.validateToken(token) ───────────────┘
         │
         ├─ Phase 4 ─ KINDE SETUP (external API)
         │    ├─ kindeService.createOrganization({ name, external_id })
         │    │    → returns orgCode (e.g. org_ce7e7125...)
         │    └─ kindeService.addUserToOrganization(kindeUserId, orgCode)
         │         (fallback: org_<subdomain>_<timestamp> if Kinde fails)
         │
         ├─ Phase 5 ─ DATABASE TRANSACTION  ← see Section 5
         │    └─ 10 atomic writes across 10 tables
         │
         ├─ Phase 6 ─ VERIFICATION
         │    └─ OnboardingVerificationService.verifyOnboardingCompletion()
         │         ├─ Checks all 10 DB records exist
         │         └─ Auto-fix if minor issues found
         │
         ├─ Phase 7 ─ MARK COMPLETE
         │    └─ UPDATE tenants SET onboarding_completed = true
         │
         └─ Phase 8 ─ ASYNC WORK (fire-and-forget, non-blocking)
              ├─ trackOnboardingCompletion() → event_tracking
              ├─ INSERT welcome notification → notifications
              └─ publishAppProvisioningEvents() → MQ + event_tracking
                   (one event per enabled app: tenant.app.provisioned)
```

---

## 5. Database Transaction — 10 Writes

All 10 writes execute inside **one `systemDbConnection.transaction()`** with
`isolationLevel: 'read committed'`. If any step throws, the entire transaction
rolls back and form data is saved to `onboarding_form_data` for retry.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SINGLE ATOMIC TRANSACTION                            │
│                                                                         │
│  Step 1 ─ INSERT tenants                                                │
│            → 1 row with all company + contact + address + billing data  │
│                                                                         │
│  Step 2 ─ INSERT entities (organization)                                │
│            → 1 root organization row linked to tenant                   │
│            → SET app.tenant_id config for RLS                           │
│                                                                         │
│  Step 3 ─ INSERT tenant_users (admin)                                   │
│            → 1 row; preferences JSONB stores onboarding form snapshot   │
│          ─ UPDATE entities SET created_by, updated_by = adminUser.userId│
│                                                                         │
│  Step 4 ─ INSERT custom_roles (Organization Admin)                      │
│            → system role with full permissions JSON                     │
│                                                                         │
│  Step 5 ─ INSERT user_role_assignments                                  │
│            → links admin user → Organization Admin role                 │
│                                                                         │
│  Step 6 ─ INSERT organization_memberships                               │
│            → access_level: admin, is_primary: true                     │
│          ─ UPDATE tenant_users SET primary_organization_id              │
│                                                                         │
│  Step 7 ─ INSERT responsible_persons                                    │
│            → full scope + auto_permissions JSON                         │
│          ─ UPDATE entities SET responsible_person_id                    │
│                                                                         │
│  Step 8 ─ INSERT subscriptions                                          │
│            → plan: free, status: active, 3-month trial period          │
│                                                                         │
│  Step 9 ─ INSERT credits                                                │
│            → available_credits: 1000 (free plan)                       │
│          ─ INSERT credit_transactions                                   │
│            → type: allocation, operation_code: onboarding              │
│                                                                         │
│  Step 10 ─ INSERT organization_applications                             │
│             → one row per app enabled for the plan                     │
│             → enabled_modules populated from PLAN_ACCESS_MATRIX        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Field-to-Table Mapping

### `tenants` table

| Column | Source Field | Notes |
|--------|-------------|-------|
| `tenant_id` | generated | `uuidv4()` |
| `company_name` | `legalCompanyName` | |
| `subdomain` | generated | slugified + uniqueness-checked |
| `kinde_org_id` | Kinde API response | `org_ce7e7125...` format |
| `admin_email` | `adminEmail` / `email` | |
| `legal_company_name` | `legalCompanyName` | same as company_name |
| `gstin` | `gstin` | uppercased; null if `hasGstin=false` |
| `company_type` | `companyType` | |
| `industry` | `businessType` | reused for backward compat |
| `website` | `website` | |
| `organization_size` | `companySize` | `1-10`, `11-50`, etc. |
| `phone` | `contactDirectPhone` → `contactMobilePhone` → `adminMobile` | first non-null |
| `default_timezone` | `timezone` | default `Asia/Kolkata` |
| `default_currency` | `currency` | default `INR` |
| `default_language` | `defaultLanguage` | default `en` |
| `default_locale` | `defaultLocale` | default `en-IN` |
| `tax_registered` | `taxRegistered` | |
| `vat_gst_registered` | `vatGstRegistered` | |
| `tax_registration_details` | `taxRegistrationDetails` / `panNumber` | JSONB `{ pan, country }` |
| `billing_email` | `billingEmail` | |
| `billing_street/city/state/zip/country` | `billingStreet/City/State/Zip/Country` | |
| `mailing_address_same_as_registered` | `mailingAddressSameAsRegistered` | default `true` |
| `mailing_street/city/state/zip/country` | `mailingStreet/City/State/Zip/Country` | ⚠️ state falls back to `state` field |
| `support_email` | `supportEmail` | |
| `contact_job_title` | `contactJobTitle` | |
| `preferred_contact_method` | `preferredContactMethod` | |
| `contact_salutation/middle_name/department` | `contactSalutation/MiddleName/Department` | |
| `contact_direct_phone/mobile_phone/authority_level` | `contactDirectPhone/MobilePhone/AuthorityLevel` | |
| `contact_mobile_phone` | `contactMobilePhone` → `adminMobile` | fallback chain |
| `onboarding_completed` | hardcoded `false` | set to `true` in Phase 7 |
| `onboarded_at` | `currentTime` | set at transaction start |
| `onboarding_started_at` | `formStartedAt` → `currentTime - 30s` | |
| `first_login_at` | `currentTime` | |
| `settings` | hardcoded `{}` | |
| `primary_color` | not set | defaults to `#2563eb` |
| `logo_url` | not collected | remains null |
| `stripe_customer_id` | not set | remains null |

---

### `entities` table (root organization)

| Column | Source / Value |
|--------|---------------|
| `entity_id` | `uuidv4()` |
| `tenant_id` | from tenant insert |
| `entity_type` | `'organization'` |
| `entity_name` | `companyName` |
| `entity_level` | `1` |
| `hierarchy_path` | `entityId` (UUID string) |
| `full_hierarchy_path` | `companyName` |
| `description` | `'Root organization created during frontend onboarding'` |
| `legal_name` | `companyName` |
| `country` | `country` |
| `currency` | `currency` / `'INR'` |
| `timezone` | `timezone` / `'Asia/Kolkata'` |
| `language` | `defaultLanguage` / `'en'` |
| `fiscal_year_end` | `'12-31'` (hardcoded) |
| `tax_id` | `gstin` (if `hasGstin`) |
| `contact_email` | `adminEmail` |
| `contact_phone` | first non-null of direct/mobile/adminMobile |
| `contact_website` | `website` |
| `is_active` | `true` |
| `created_by` / `updated_by` | set after admin user created |
| `responsible_person_id` | set after responsible_persons insert |

---

### `tenant_users` table (admin user)

| Column | Source / Value |
|--------|---------------|
| `user_id` | `uuidv4()` |
| `tenant_id` | from tenant insert |
| `kinde_user_id` | from Kinde auth token |
| `email` | `adminEmail` |
| `first_name` | `firstName` |
| `last_name` | `lastName` |
| `phone` | `adminMobile` → `contactMobilePhone` → `contactDirectPhone` |
| `is_active` | `true` |
| `is_verified` | `true` |
| `is_tenant_admin` | `true` |
| `onboarding_completed` | `true` |
| `preferences` | JSONB snapshot (see below) |
| `primary_organization_id` | set via UPDATE after entity created |

**`preferences` JSONB snapshot** (stored on the user row):
```json
{
  "onboarding": {
    "formData": {
      "companySize": "1-10",
      "businessType": "healthcare",
      "hasGstin": false,
      "gstin": null,
      "country": "IN",
      "timezone": "Asia/Kolkata",
      "currency": "INR",
      "firstName": "Dinesh",
      "lastName": "Reddy",
      "termsAccepted": true,
      "contactSalutation": null,
      "contactMobilePhone": "8074683901"
    },
    "completedAt": "2026-04-03T16:07:07.684Z",
    "onboardingType": "frontend"
  }
}
```

---

### `custom_roles` table

| Column | Value |
|--------|-------|
| `role_id` | `uuidv4()` |
| `tenant_id` | tenant ID |
| `role_name` | `'Organization Admin'` |
| `is_system_role` | `true` |
| `permissions` | Full permissions matrix from `createSuperAdminRoleConfig()` |
| `created_by` | admin user ID |

---

### `user_role_assignments` table

| Column | Value |
|--------|-------|
| `user_id` | admin user ID |
| `role_id` | Organization Admin role ID |
| `organization_id` | tenant ID |
| `assigned_by` | admin user ID (self-assigned) |
| `scope` | `'organization'` |
| `is_active` | `true` |

---

### `organization_memberships` table

| Column | Value |
|--------|-------|
| `user_id` | admin user ID |
| `tenant_id` | tenant ID |
| `entity_id` | organization entity ID |
| `entity_type` | `'organization'` |
| `role_id` | Organization Admin role ID |
| `membership_type` | `'direct'` |
| `membership_status` | `'active'` |
| `access_level` | `'admin'` |
| `is_primary` | `true` |
| `can_access_sub_entities` | `true` |
| `created_by` | admin user ID |
| `joined_at` | `currentTime` |

---

### `responsible_persons` table

| Column | Value |
|--------|-------|
| `tenant_id` | tenant ID |
| `entity_type` | `'organization'` |
| `entity_id` | organization entity ID |
| `user_id` | admin user ID |
| `responsibility_level` | `'primary'` |
| `scope` | `{ creditManagement, userManagement, auditAccess, configurationManagement, reportingAccess }` — all `true` |
| `auto_permissions` | `{ canApproveTransfers, canPurchaseCredits, canManageUsers, canViewAllAuditLogs, canConfigureEntity, canGenerateReports }` — all `true` |
| `assigned_by` | admin user ID |
| `is_active` | `true` |
| `is_confirmed` | `true` |
| `can_delegate` | `true` |
| `assignment_reason` | `'Initial assignment during onboarding - admin user is responsible for primary organization'` |

---

### `subscriptions` table

| Column | Value (free plan) |
|--------|------------------|
| `plan` | `'free'` |
| `status` | `'active'` |
| `billing_cycle` | `'monthly'` |
| `yearly_price` | `'0.00'` |
| `is_trial_user` | `true` |
| `trial_started_at` | `currentTime` |
| `trial_ends_at` | `currentTime + 90 days` (free plan) |
| `current_period_start` | `currentTime` |
| `current_period_end` | `currentTime + 90 days` |
| `stripe_subscription_id` | null |
| `stripe_customer_id` | null |

For paid plans: `status: 'trialing'`, trial = 14 days (prod) / 5 min (dev).

---

### `credits` table

| Column | Value |
|--------|-------|
| `tenant_id` | tenant ID |
| `entity_id` | organization entity ID |
| `available_credits` | `1000` (free plan) |
| `is_active` | `true` |

---

### `credit_transactions` table

| Column | Value |
|--------|-------|
| `transaction_type` | `'allocation'` |
| `amount` | `1000` |
| `previous_balance` | `0` |
| `new_balance` | `1000` |
| `operation_code` | `'onboarding'` |
| `initiated_by` | `null` (system-initiated) |

---

### `organization_applications` table

One row per app enabled for the selected plan (from `PLAN_ACCESS_MATRIX`).

| Column | Value |
|--------|-------|
| `tenant_id` | tenant ID |
| `app_id` | resolved from `applications` table by `appCode` |
| `subscription_tier` | plan name (`'free'`) |
| `is_enabled` | `true` |
| `enabled_modules` | array of module codes from permission matrix |
| `expires_at` | `+12 months` (free) / `+24 months` (enterprise) |

**Free plan apps:** `crm`, `hr` (from `PLAN_ACCESS_MATRIX.free.applications`)

---

## 7. Event Tracking — What Is Emitted

### During onboarding (async, post-transaction)

#### A. Onboarding Completion Tracking
Written to `event_tracking` by `trackOnboardingCompletion()`:

```json
{
  "event_type": "onboarding_phase_profile",
  "stream_key": "onboarding",
  "source_application": "onboarding",
  "target_application": "platform",
  "status": "published",
  "event_data": {
    "phase": "profile",
    "status": "completed",
    "userId": "<kindeUserId>",
    "sessionId": null
  },
  "metadata": {
    "ipAddress": null,
    "userAgent": null
  }
}
```

**Tracked phases:** `profile`, `payment`, `upgrade`, `trial`

---

#### B. Per-App Provisioning Events
For each app in `organization_applications`, published to SNS **and** written to `event_tracking`:

```json
{
  "event_type": "tenant.app.provisioned",
  "source_application": "wrapper",
  "target_application": "<appCode>",
  "routing_key": "<appCode>.tenant.app.provisioned",
  "event_data": {
    "appCode": "crm",
    "tenantId": "<uuid>",
    "plan": "free",
    "subscriptionTier": "free",
    "enabledModules": ["leads", "contacts", "dashboard"],
    "expiresAt": "2027-04-03T16:07:07.000Z",
    "onboardedAt": "2026-04-03T16:07:07.000Z",
    "bootstrapHint": "lazy — call POST /api/sync/tenants/:id/bootstrap on first user login"
  }
}
```

**Why thin events (not one fat snapshot):**
- Each event routes only to the target app's MQ queue
- Apps bootstrap lazily on first user login via `POST /api/sync/tenants/:id/bootstrap`
- Receiving the event twice is safe (idempotent DB upsert on app side)
- If one app's event fails to publish, others still succeed

---

#### C. Welcome Notification
Written to `notifications` table (fire-and-forget):

```json
{
  "tenant_id": "<uuid>",
  "target_user_id": "<adminUserId>",
  "type": "welcome",
  "title": "Welcome to the platform!",
  "message": "Your workspace \"<companyName>\" is ready. Start by exploring the dashboard.",
  "is_read": false,
  "is_active": true
}
```

---

### Progress tracking (on-demand read)

`OnboardingTrackingService.getOnboardingProgress()` reads `event_tracking` where
`event_type LIKE 'onboarding_phase_%'` and calculates:

```json
{
  "totalPhases": 4,
  "completedPhases": 1,
  "progressPercentage": 25,
  "completedPhaseList": ["profile"],
  "remainingPhases": ["payment", "upgrade", "trial"]
}
```

---

## 8. Flow Diagram

```
Frontend (React)
│
│  Step 1–5: collect form data
│  Each step: POST /validate-step → 400 with errors or 200 ok
│
│  Final submit: POST /onboard-frontend
│
└──────────────────────────────────────────────────────────────▶ Backend
                                                                    │
                                              preValidation hook: strip empty fields
                                                                    │
                                                    Phase 1: VALIDATE
                                                    ┌───────────────────────────────┐
                                                    │ OnboardingValidationService   │
                                                    │ • duplicate email → tenants   │
                                                    │ • subdomain uniqueness        │
                                                    │ • PAN/GSTIN format            │
                                                    │ • termsAccepted               │
                                                    └───────────────────────────────┘
                                                                    │
                                             ┌──── Phase 2+3: PARALLEL ────┐
                                             │                             │
                                     Generate subdomain          Validate Kinde token
                                     slugify(companyName)        kindeService.validateToken()
                                     + uniqueness check          → kindeUserId
                                             │                             │
                                             └────────────┬────────────────┘
                                                          │
                                              Phase 4: KINDE SETUP
                                              ┌────────────────────────────┐
                                              │ createOrganization()       │
                                              │   → kindeOrgId             │
                                              │ addUserToOrganization()    │
                                              │   (non-fatal if fails)     │
                                              └────────────────────────────┘
                                                          │
                                              Phase 5: DB TRANSACTION
                                        ┌─────────────────────────────────────┐
                                        │  1. INSERT tenants                  │
                                        │  2. INSERT entities (org)           │
                                        │     SET app.tenant_id (RLS)         │
                                        │  3. INSERT tenant_users             │
                                        │     UPDATE entities (created_by)    │
                                        │  4. INSERT custom_roles             │
                                        │  5. INSERT user_role_assignments    │
                                        │  6. INSERT organization_memberships │
                                        │     UPDATE tenant_users (primaryOrg)│
                                        │  7. INSERT responsible_persons      │
                                        │     UPDATE entities (resp_person_id)│
                                        │  8. INSERT subscriptions            │
                                        │  9. INSERT credits                  │
                                        │     INSERT credit_transactions      │
                                        │ 10. INSERT organization_applications│
                                        └─────────────────────────────────────┘
                                                          │
                                                    ┌─────┴──────┐
                                                  SUCCESS      FAILURE
                                                    │            │
                                                    │      Store form data
                                                    │      → onboarding_form_data
                                                    │      Throw (rolls back TX)
                                                    │
                                              Phase 6: VERIFY
                                              OnboardingVerificationService
                                              .verifyOnboardingCompletion()
                                              • check all 10 DB records exist
                                              • auto-fix if minor gap
                                                    │
                                              Phase 7: MARK COMPLETE
                                              UPDATE tenants
                                              SET onboarding_completed = true
                                                    │
                                              Phase 8: ASYNC (fire-and-forget)
                                              ┌──────────────────────────────┐
                                              │ trackOnboardingCompletion()  │
                                              │  → INSERT event_tracking     │
                                              │                              │
                                              │ INSERT notifications         │
                                              │  (welcome message)           │
                                              │                              │
                                              │ publishAppProvisioningEvents │
                                              │  per app in org_applications:│
                                              │  → MQ: tenant.app.provisioned│
                                              │  → INSERT event_tracking     │
                                              └──────────────────────────────┘
                                                    │
                                              201 Response
                                              {
                                                tenantId,
                                                adminUserId,
                                                organizationId,
                                                adminRoleId,
                                                subdomain,
                                                redirectUrl: "/dashboard",
                                                creditAllocated: 1000
                                              }
                                                    │
                                              invalidateUserCache(kindeUserId)
```

---

## 9. Failure & Retry Handling

### On transaction failure

1. Form data is written to `onboarding_form_data` table:
   ```json
   {
     "kinde_user_id": "<kindeUserId>",
     "email": "<adminEmail>",
     "form_data": { /* full payload */ },
     "step_data": {
       "error": { "message": "...", "name": "...", "step": "database_transaction_failed" },
       "lastAttempt": "2026-04-03T16:07:07.000Z"
     },
     "current_step": "failed",
     "flow_type": "frontend"
   }
   ```
2. Kinde org may already be created at this point (not cleaned up — user can retry)

### Retry flow

```
GET /onboard-frontend/retry-data?email=<email>
  → returns saved formData + stepData + currentStep

POST /onboard-frontend/retry
  → merges stored formData with any new overrides
  → calls completeOnboardingWorkflow() again
  → deletes onboarding_form_data on success
```

### On validation failure (before transaction)

Returns `400` with structured error array — no DB writes, no form data saved.

### Already-onboarded detection

If `tenants.admin_email` already exists with `onboarding_completed = true`,
returns `200` with `{ alreadyOnboarded: true, redirectTo: '/dashboard' }`.

---

## 10. Verification Checks

`OnboardingVerificationService.verifyOnboardingCompletion()` checks:

| Check | Table / Condition |
|-------|------------------|
| Tenant exists | `tenants WHERE tenant_id = ?` |
| Organization exists | `entities WHERE tenant_id = ?` |
| Admin user exists | `tenant_users WHERE tenant_id = ? AND is_tenant_admin = true` |
| Admin role exists | `custom_roles WHERE tenant_id = ?` |
| Role assignment exists | `user_role_assignments WHERE user_id = ?` |
| Org membership exists | `organization_memberships WHERE tenant_id = ?` |
| Subscription exists | `subscriptions WHERE tenant_id = ?` |
| Credits allocated | `credits WHERE tenant_id = ?` |
| App assignments exist | `organization_applications WHERE tenant_id = ?` |

If any check fails, `autoFixOnboardingIssues()` attempts to create the missing record
before failing the entire onboarding.

---

## 11. Post-Onboarding Async Work

All of the following run **after** the 201 response is sent (fire-and-forget):

| Task | Table Written | Blocking? |
|------|--------------|-----------|
| `trackOnboardingCompletion()` | `event_tracking` | No |
| Welcome notification | `notifications` | No |
| `publishAppProvisioningEvents()` | `event_tracking` + SNS | No |

Failures in async work are logged as warnings but never surfaced to the user.
The tenant is already fully provisioned by this point.

---

## 12. Known Gaps

| # | Gap | Location | Impact |
|---|-----|----------|--------|
| 1 | ~~Transaction body sets `entity_code`, `organization_type`, `is_default`, `is_headquarters` — all dropped in migration 0015~~ | **Fixed** — removed from both entity INSERT paths and the `DbOnboardingResult` interface | — |
| 2 | `mailing_state` fallback uses `state` field, but `mailing_city/zip/country` don't have a fallback | `tenants insert:1163-1164` | `mailing_address_same_as_registered=true` tenants get state but no city/zip/country in mailing fields |
| 3 | `credit_transactions.initiated_by` is always `null` | `credit_transactions insert:1512` | Audit trail shows system credit as anonymous |
| 4 | `tenant_users.is_responsible_person` never set to `true` during onboarding | `tenant_users insert:1271-1291` | Flag mismatch vs `responsible_persons` table |
| 5 | `logo_url`, `primary_color` not collected from user | `tenants insert` | Branding always defaults |
| 6 | Kinde org not cleaned up on transaction failure | Phase 5 error handler | Orphan Kinde org if DB fails |
| 7 | `onboarding_form_data` not deleted on Phase 6/7 failure | After verification | Stale form data persists |
| 8 | `fiscal_year_start/end_month/day` columns not populated during onboarding | transaction | Columns are in DB schema but never written |
