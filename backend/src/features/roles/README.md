# Roles Feature

Role and permission management: templates, custom roles from apps/modules, role assignments, permission matrix, permission sync, and tier-based access. Supports CRM-style permissions and publishes role events to applications via SNS.

## Directory Structure

```
roles/
├── index.ts                                  # Feature exports
├── routes/
│   ├── roles.ts                              # Role CRUD, templates, bulk operations
│   ├── custom-roles.ts                       # Role builder and user-specific permissions
│   ├── permissions.ts                        # Permission management and assignments
│   ├── permission-matrix.ts                  # Permission matrix, context, CRM sync
│   └── permission-sync.ts                    # Automated permission sync and tier changes
└── services/
    ├── permission-service.ts                 # Core role/permission CRUD and assignments
    ├── custom-role-service.ts                # Role builder and user overrides
    ├── permission-matrix-service.ts          # Permission context resolution and checking
    └── permission-sync-service.ts            # Automated sync and tier management
```

## Endpoints

### Roles (`/api/roles`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/templates` | Get role templates (optional category, includeInactive) |
| GET | `/permissions/available` | Available permissions grouped by tool/resource/operation |
| GET | `/` | Get tenant roles with filtering/pagination |
| POST | `/from-template` | Create role from template with customizations |
| POST | `/` | Create custom role (advanced permissions) |
| POST | `/:roleId/clone` | Clone role with optional modifications |
| POST | `/:roleId/validate` | Validate role access in a context |
| POST | `/bulk` | Bulk role operations |
| POST | `/bulk/delete` | Bulk delete roles |
| POST | `/bulk/deactivate` | Bulk deactivate roles |
| POST | `/bulk/export` | Bulk export roles |
| PUT | `/:roleId` | Update role |
| DELETE | `/:roleId` | Delete role (optional force, transferUsersTo) |

### Custom Roles (`/api/custom-roles`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/builder-options` | Role builder options (apps/modules for tenant) |
| GET | `/user-permissions/:userId` | User's resolved permissions (roles + overrides) |
| GET | `/demonstrate-usage` | Educational: explain table usage and workflow |
| GET | `/example-payload` | Example role creation and user-override payloads |
| POST | `/create-from-builder` | Create role from builder selection |
| POST | `/assign-user-permissions` | Assign user-specific permission overrides |
| PUT | `/update-from-builder/:roleId` | Update role from builder payload |

### Permissions (`/api/permissions`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/available` | Full permission structure (apps/modules/operations) |
| GET | `/applications` | Tenant's applications with modules and permissions |
| GET | `/users` | Tenant users for permission management |
| GET | `/users/:userId/permissions` | User's application/module permissions |
| GET | `/templates` | Permission templates |
| GET | `/roles` | Tenant roles with pagination/search |
| GET | `/assignments` | Role assignments (filter by userId, roleId) |
| GET | `/audit` | Permission audit log |
| GET | `/user/:userId/effective` | User's effective permissions |
| GET | `/summary` | Permission summary (counts by application) |
| POST | `/bulk-assign` | Bulk assign permissions |
| POST | `/users/:userId/apply-template` | Apply permission template to user |
| POST | `/assignments` | Assign role to user |
| POST | `/assignments/bulk` | Bulk role assignment |
| POST | `/check` | Check if user has given permissions |
| POST | `/migrate-role-permissions` | Migrate permissions to hierarchical format |
| PUT | `/roles/:roleId` | Update role |
| DELETE | `/users/:userId/permissions` | Remove user permissions |
| DELETE | `/roles/:roleId` | Delete role |
| DELETE | `/assignments/:assignmentId` | Remove role assignment by ID |
| DELETE | `/assignments/user/:userId/role/:roleId` | Remove role assignment by user and role |

### Permission Matrix (`/api/permission-matrix`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/matrix` | Full permission matrix and plan access |
| GET | `/user-context` | User permission context |
| GET | `/test-flattening` | Debug: test permission flattening |
| GET | `/user-applications` | Current user's accessible applications |
| GET | `/role-templates` | Available role templates |
| GET | `/analytics` | Permission analytics for tenant |
| GET | `/validate` | Validate permission matrix |
| GET | `/plan-access/:planId` | Plan access and permissions |
| POST | `/crm-sync` | CRM permission sync for a target user |
| POST | `/check-permission` | Check single permission |
| POST | `/test-permission-sync` | Test permission sync |
| POST | `/check-permissions` | Check multiple permissions (any/all) |
| POST | `/assign-template` | Assign role template to user |
| POST | `/revoke-user-permissions` | Revoke all permissions for a user |

### Permission Sync (`/api/permission-sync`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tier-configuration` | Permission tier configuration |
| GET | `/check-module-access` | Check if module is accessible for a tier |
| POST | `/sync` | Full permission sync with auto-updates |
| POST | `/update-organization-access` | Update organization access by tier |
| POST | `/subscription-tier-change` | Handle subscription tier change |
| POST | `/clear-caches` | Clear permission caches |
| POST | `/scheduled-sync` | Run scheduled sync (API key auth) |

## Services

| Service | Description |
|---------|-------------|
| **PermissionService** | Core role/permission CRUD: templates, tenant roles, create from template, advanced create/update/delete, clone, validate access, bulk operations, role assignments, audit log, check permissions, effective permissions, migration. Publishes role events to SNS |
| **CustomRoleService** | Role builder: get creation options (apps/modules for tenant), create/update roles from app/module selections, user-specific permission overrides, resolve user permissions, update organization access by subscription tier |
| **PermissionMatrixService** | Resolve user permission context from roles, flatten nested permissions, hasPermission/hasAll/hasAny checks, accessible applications, role template assignment, permission analytics, revoke all |
| **AutoPermissionSyncService** | Automated permission sync: matrix sync, update all organization access, subscription tier change handling, cache clearing, scheduled sync. Integrates with CustomRoleService for org access and tier config |
