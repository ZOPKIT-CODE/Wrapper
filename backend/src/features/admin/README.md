# Admin Feature

Platform-wide administration surface for managing tenants, entities, credits, notifications, roles, users, trials, and the System Administrator promotion workflow.

## Directory Structure

```
admin/
├── index.ts                          # Feature exports
├── routes/
│   ├── admin.ts                      # Core registrar – mounts org/trial/user/tenant/role sub-routes
│   ├── admin-org-routes.ts           # Auth context, user tenants, organization management
│   ├── admin-promotion.ts            # System Administrator promotion workflow
│   ├── admin-role-routes.ts          # Custom role CRUD and audit logs
│   ├── company-tenant-settings-routes.ts  # Company-user self-service: own tenant info, settings, onboarding status, deletion
│   ├── admin-trial-routes.ts         # Trial expiry, reminders, monitoring
│   ├── admin-user-routes.ts          # User invites, roles, org assignments
│   ├── admin-notifications.ts        # Send/bulk-send notifications, templates, AI
│   ├── application-assignment.ts     # Assign apps/modules to tenants
│   ├── credit-configuration.ts       # Tenant and global credit configs, templates
│   ├── credit-overview.ts            # Credit overview, analytics, alerts
│   ├── dashboard.ts                  # Platform dashboard stats and activity
│   ├── entity-management.ts          # Entity listing, hierarchy, status
│   ├── operation-costs.ts            # Global/tenant operation cost configs
│   ├── seasonal-credits.ts           # Seasonal credit campaigns and distribution
│   ├── tenant-management.ts          # Tenant listing, details, export, bulk status
│   └── tenants.ts                    # Current-tenant operations (profile, users, invites)
└── services/
    ├── CreditAdminService.ts         # Credit overview, distribution, alerts, analytics
    ├── DashboardService.ts           # Dashboard overview stats and recent activity
    ├── EntityAdminService.ts         # Entity listing, details, hierarchy, stats
    ├── SeasonalCreditService.ts      # Campaign CRUD, credit distribution, expiry
    ├── TenantAdminService.ts         # Tenant listing, details, stats, activity logs
    └── admin-promotion-service.ts    # System Admin promotion, validation, audit
```

## Endpoints

### Dashboard (`/api/admin/dashboard`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/overview` | Platform overview: tenant/entity/credit stats, recent activity |
| GET | `/recent-activity` | Recent activity across all tenants |
| GET | `/contact-submissions` | Contact form and demo submissions (paginated) |

### Tenant Management (`/api/admin/tenants`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/comprehensive` | Paginated tenant list with relationships and credit data |
| GET | `/:tenantId/details` | Tenant details with users, entities, credit summary |
| GET | `/:tenantId/stats` | Tenant statistics |
| GET | `/:tenantId/activity` | Tenant activity/audit logs |
| GET | `/:tenantId/export` | Export tenant data as JSON |
| GET | `/:tenantId/credit-debug` | Debug credit calculation for a tenant |
| PATCH | `/:tenantId/status` | Update tenant active status |
| POST | `/bulk/status` | Bulk update tenant statuses |
| POST | `/:tenantId/clean-orphaned-credits` | Clean orphaned credit records |

### Entity Management (`/api/admin/entities`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/all` | All entities with filters and pagination |
| GET | `/search` | Search entities across tenants |
| GET | `/stats/overview` | Entity statistics overview |
| GET | `/hierarchy/:tenantId` | Entity hierarchy for a tenant |
| GET | `/hierarchy/current` | Entity hierarchy for current tenant |
| GET | `/:entityId/details` | Entity details with hierarchy and children |
| PATCH | `/:entityId/status` | Update entity active status |
| POST | `/bulk/status` | Bulk update entity statuses |

### Credit Overview (`/api/admin/credits`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/overview` | Credit overview across tenants |
| GET | `/analytics` | Credit usage analytics (by period/group) |
| GET | `/alerts` | Credit alerts (critical, warning, inactive) |
| GET | `/entity-balances` | Entity credit balances |
| GET | `/transactions` | Credit transaction history |
| GET | `/application-allocations` | Application credit allocations |
| GET | `/entity/:entityId/application-allocations` | Application allocations for an entity |
| GET | `/expiring-summary` | Summary of expiring credits and subscriptions |
| POST | `/bulk-allocate` | Bulk allocate credits to entities |
| POST | `/process-expiries` | Trigger credit expiry processing |

### Credit Configuration (`/api/admin/credit-configurations`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:tenantId` | Tenant credit configs (current + inherited) |
| GET | `/templates` | Configuration templates |
| GET | `/applications` | Global application credit configs |
| GET | `/global/by-app` | Global credit configs by app |
| PUT | `/:tenantId/operation/:operationCode` | Update tenant operation-level config |
| PUT | `/:tenantId/module/:moduleCode` | Update tenant module-level config |
| PUT | `/:tenantId/app/:appCode` | Update tenant app-level config |
| PUT | `/:tenantId/bulk` | Bulk update tenant configs |
| PUT | `/applications/:appCode` | Update application credit config |
| PUT | `/applications/:appCode/modules/:moduleCode` | Update module credit config |
| POST | `/:tenantId/apply-template` | Apply config template to tenant |
| POST | `/tenant/:tenantId/operations` | Create tenant-specific operation cost |
| POST | `/initialize-credits/:tenantId` | Initialize credits for tenant |
| DELETE | `/:tenantId/:configType/:configCode` | Reset tenant config to global default |

### Application Assignment (`/api/admin/application-assignments`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/overview` | Application assignment overview |
| GET | `/tenants` | Tenants with application assignments |
| GET | `/tenant/:tenantId` | Assignments for a tenant |
| GET | `/tenant-apps/:tenantId` | Tenant apps with modules and permissions |
| GET | `/applications` | Available applications |
| GET | `/tenant-modules/:tenantId` | Modules assigned to a tenant |
| POST | `/assign` | Assign application to tenant |
| POST | `/bulk-assign` | Bulk assign apps to tenants |
| POST | `/assign-module` | Assign module to tenant |
| PUT | `/:assignmentId` | Update application assignment |
| PUT | `/update-module-permissions` | Update module permissions |
| DELETE | `/:assignmentId` | Remove application assignment |
| DELETE | `/remove-module` | Remove module from tenant |

### Operation Costs (`/api/admin/operation-costs`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | All operation costs |
| GET | `/global` | Global operation cost configs |
| GET | `/tenant/:tenantId` | Tenant-specific operation costs |
| GET | `/analytics` | Operation cost analytics |
| GET | `/templates` | Cost configuration templates |
| GET | `/export` | Export operation costs as CSV |
| POST | `/` | Create operation cost |
| POST | `/apply-template` | Apply cost template |
| PUT | `/:configId` | Update operation cost |
| DELETE | `/:configId` | Delete operation cost |

### Seasonal Credits (`/api/admin/seasonal-credits`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/campaigns` | List campaigns |
| GET | `/campaigns/:campaignId` | Campaign details |
| GET | `/campaigns/:campaignId/status` | Campaign distribution status |
| GET | `/expiring-soon` | Credits expiring soon |
| GET | `/tenant-allocations` | Current tenant seasonal allocations |
| GET | `/types` | Available credit types |
| POST | `/campaigns` | Create seasonal credit campaign |
| POST | `/campaigns/:campaignId/distribute` | Distribute credits to tenants |
| POST | `/send-warnings` | Send expiry warnings |
| POST | `/process-expiries` | Process credit expiries |
| PUT | `/campaigns/:campaignId/extend` | Extend campaign expiry |

### Admin Notifications (`/api/admin/notifications`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sent` | Sent notifications history |
| GET | `/stats` | Notification statistics |
| GET | `/templates` | Notification templates |
| GET | `/templates/categories` | Template categories |
| GET | `/templates/:templateId` | Get one template |
| GET | `/analytics` | Notification analytics dashboard |
| POST | `/send` | Send notification to one tenant |
| POST | `/bulk-send` | Send to multiple tenants |
| POST | `/preview` | Preview notification |
| POST | `/templates` | Create template |
| POST | `/templates/:templateId/render` | Render template with variables |
| POST | `/ai/generate` | AI-generate content |
| POST | `/ai/personalize` | AI-personalize for tenant |
| POST | `/ai/suggest-targets` | AI suggest target tenants |
| POST | `/ai/analyze-sentiment` | Analyze content sentiment |
| POST | `/templates/ai-generate` | AI-generate template |
| PUT | `/templates/:templateId` | Update template |
| DELETE | `/templates/:templateId` | Delete template |

### Core Admin Sub-Routes (`/api/admin`)

#### Organization Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth-status` | Auth status and permissions |
| GET | `/user-tenants` | Tenants the user can access |
| GET | `/test-context` | Current user context (debug) |
| GET | `/organizations/all` | All organizations for tenant |
| GET | `/organizations/current/users` | Organization users |
| POST | `/organizations/current/invite-user` | Invite user to current org |

#### Trial Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/trials/:tenantId/status` | Trial status for a tenant |
| GET | `/trials/current/status` | Current tenant trial status |
| GET | `/trials/check-before-load` | Check trial before app load |
| GET | `/trials/system-status` | Trial system health |
| POST | `/trials/check-expired` | Run trial expiry check |
| POST | `/trials/send-reminders` | Send trial reminders |
| POST | `/trials/:tenantId/expire` | Manually expire tenant trial |
| POST | `/trials/:tenantId/expire-in-one-minute` | Quick expire (testing) |
| POST | `/trials/restart-monitoring` | Restart trial monitoring |

#### User Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List tenant users |
| GET | `/users/:userId` | User details |
| GET | `/users/:userId/roles` | User's roles |
| GET | `/users/:userId/organizations` | User's org assignments |
| POST | `/invite-user` | Invite user |
| POST | `/users/assign-role` | Assign role to user |
| POST | `/users/assign-organization` | Assign org to user |
| POST | `/users/:userId/organizations` | Add org assignment |
| PUT | `/users/:userId/role` | Update user admin status |
| PUT | `/users/:userId/organizations/:membershipId` | Update org assignment role |
| DELETE | `/users/:userId` | Remove user from tenant |
| DELETE | `/users/:userId/roles/:roleId` | Deassign role |
| DELETE | `/users/:userId/organizations/:membershipId` | Remove org assignment |

#### Tenant Settings Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tenant` | Tenant info |
| GET | `/tenant/onboarding-status` | Onboarding and trial status |
| GET | `/tenant/:tenantId/data-summary` | Tenant data summary |
| PUT | `/tenant` | Update tenant settings |
| DELETE | `/tenant/complete-deletion/:tenantId` | Delete tenant and all data |

#### Role Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/roles` | Custom roles for tenant |
| GET | `/roles/all` | All roles with user counts |
| GET | `/audit-logs` | Audit logs |
| POST | `/roles` | Create custom role |
| PUT | `/roles/:roleId` | Update custom role |
| DELETE | `/roles/:roleId` | Delete custom role |

### Tenants (`/api/tenants`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all tenants |
| GET | `/current` | Current tenant info |
| GET | `/current/timeline` | User journey timeline |
| GET | `/current/users` | Tenant users |
| GET | `/current/invitations` | Pending invitations |
| GET | `/current/organization-assignments` | Organization assignments |
| GET | `/current/users/export` | Export users CSV |
| GET | `/usage` | Tenant usage statistics |
| PUT | `/current/settings` | Update tenant settings |
| PATCH | `/current` | Partial update tenant details |
| POST | `/current/users/invite` | Invite user |
| POST | `/invite/:token/accept` | Accept invitation |
| POST | `/current/invitations/:id/resend` | Resend invitation |
| POST | `/test/kinde-organization` | Test Kinde org assignment |
| POST | `/current/users/:userId/promote` | Promote user to admin |
| POST | `/current/users/:userId/deactivate` | Deactivate user |
| POST | `/current/users/:userId/reactivate` | Reactivate user |
| POST | `/current/users/:userId/resend-invite` | Resend invite for user |
| POST | `/current/users/:userId/assign-roles` | Assign roles to user |
| POST | `/current/users/:userId/assign-organization` | Assign user to organization |
| POST | `/current/users/bulk-assign-organizations` | Bulk assign users to orgs |
| PUT | `/current/users/:userId/role` | Update user role |
| PUT | `/current/users/:userId` | Update user details |
| PUT | `/current/users/:userId/update-organization` | Update org assignment |
| DELETE | `/current/invitations/:invitationId` | Cancel invitation |
| DELETE | `/current/users/:userId` | Remove user |
| DELETE | `/current/users/:userId/remove-organization` | Remove user from organization |

### Admin Promotion (`/api/admin-promotion`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/current-admin` | Current System Administrator |
| GET | `/eligible-users` | Eligible users for System Administrator |
| GET | `/admin-status` | Admin status and promotion options |
| GET | `/history` | Promotion history |
| POST | `/preview` | Preview promotion impact |
| POST | `/promote-system-admin` | Promote to System Administrator (enhanced) |
| POST | `/promote` | Promote to System Administrator (legacy) |
| POST | `/emergency-recovery` | Emergency recovery when no admin exists |

## Services

| Service | Description |
|---------|-------------|
| **DashboardService** | Aggregates platform-wide stats (tenants, entities, credits, low balances) and recent activity for the admin dashboard |
| **TenantAdminService** | Tenant listing with filters/pagination, tenant details, statistics, activity logs |
| **EntityAdminService** | Entity listing with filters/pagination, entity details, hierarchy, statistics |
| **CreditAdminService** | Credit overview, distribution tracking, low balance alerts, transaction history, analytics |
| **SeasonalCreditService** | Campaign lifecycle (create, distribute, extend, expire), expiry warnings, tenant allocations |
| **AdminPromotionService** | System Administrator promotion with validation, Kinde sync, audit trail, emergency recovery |
