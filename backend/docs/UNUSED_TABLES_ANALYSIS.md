# Unused / removable tables

Analysis of backend schema vs actual usage (imports, `.from()`, `.insert()`, `.update()`, `.delete()`). Tables below have **no application CRUD** and are candidates for removal after you confirm they are not used by other systems or future plans.

---

## 1. Safe to remove (no app usage)

| Table | Notes |
|-------|--------|
| **credit_allocations_backup** | Only in `migrations/schema.ts`. No references in app code. Legacy backup table. |
| **user_manager_relationships** | Defined in `core/users.ts` + types. No `.from()` / insert / update / delete anywhere. |
| **usage_metrics_daily** | Schema + types + RLS list only. No reads or writes in app. |
| **usage_logs** | Schema + types + RLS list only. No app CRUD. |
| **change_log** | Schema + types only. No app inserts or reads. |
| **responsibility_notifications** | Only in Drizzle relations and schema. No app CRUD. |
| **membership_history** | Only relations/schema/types. No app CRUD. |
| **membership_invitations** | Only relations/schema/types/RLS. No app CRUD. |
| **external_applications** | Schema + types only. No routes or services use it. |
| **tenant_template_customizations** | Schema + types; `notification_templates` has FK to it. No app CRUD on this table. |

---

## 2. Deprecated (code says REMOVED, tables still in schema)

| Table | Notes |
|-------|--------|
| **credit_allocations** | Comments in code: "REMOVED", "applications manage their own credits". No active queries; seasonal/credit services throw or use other paths. |
| **credit_allocation_transactions** | Only in migrations schema; code says "Tables removed". No app usage. |

If you have migrated to application-managed credits and no longer need these, they can be dropped.

---

## 3. Tables that are used (do not remove)

- **webhook_logs** – used by webhook-processor, subscription-plan-change  
- **event_tracking** – used by event-tracking-service, inter-app-event-service, health, app-fastify cleanup  
- **user_sessions** – used by tenant-cleanup, RLS  
- **onboarding_events** – used by unified-onboarding-service  
- **onboarding_form_data** – used by unified-onboarding-service, status-management, data-management  
- **contact_submissions** – used by contact, demo, admin dashboard  
- **notification_templates** – used by notification-template-service  
- **platform_staff** – used by platform-staff-management, platform-permission-middleware  
- **platform_audit_logs** – used by platform-permission-middleware, platform-staff-management  
- **seasonal_credit_campaigns** – used by SeasonalCreditService  
- **seasonal_credit_allocations** – used by SeasonalCreditService, credit-balance, credit-expiry-service  
- **user_application_permissions** – used by permissions, custom-role-service, user-classification-service, tenant-cleanup  
- **responsible_persons** – used by tenant-service, entity-scope, unified-onboarding-service  
- **responsibility_history** – used by tenant-service  

---

## 4. Recommended next steps

1. **Confirm** no external scripts, reports, or other DB clients use the tables in sections 1 and 2.  
2. **Back up** the database (or at least schema) before dropping.  
3. **Drop in order** (respect FKs):
   - Drop **credit_allocation_transactions** before **credit_allocations** (if you drop them).
   - Drop **tenant_template_customizations** only if you are sure you will not use per-tenant template overrides (and adjust `notification_templates` FK if needed).
4. **Remove or stub** the corresponding Drizzle schema definitions and any relations/types that reference dropped tables, then run migrations as needed.

If you want, I can draft a SQL migration that drops only the tables in section 1 (and optionally section 2) in a safe order.
