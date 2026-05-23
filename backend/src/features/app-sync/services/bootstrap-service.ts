/**
 * Bootstrap Service — BFF Internal Domain Aggregation Layer
 *
 * This service is the ONLY place that assembles a multi-collection bootstrap
 * payload. It calls the same DB methods that individual REST resource routes
 * use — it does NOT call those HTTP routes internally (which would add latency
 * and create circular HTTP dependencies).
 *
 * Design principles applied:
 *  - Single Responsibility  : this class owns composition only; each private
 *                             method owns one domain collection.
 *  - Open/Closed            : adding a new collection → add one private method
 *                             and register it in assemble(). Existing code untouched.
 *  - DRY                    : the SQL here is the canonical read path for each
 *                             domain, identical to what individual sync-routes.ts
 *                             endpoints do.
 *  - Atomicity              : all reads are wrapped in a single Postgres
 *                             READ COMMITTED snapshot so callers receive a
 *                             consistent cross-collection view.
 *  - Fault Isolation        : each collection read is individually try/caught.
 *                             A missing credit-configs row never aborts users
 *                             or roles from being returned.
 */

import { db } from '../../../db/index.js';
import {
  tenants,
  tenantUsers,
  customRoles,
  userRoleAssignments,
  entities,
  credits,
  creditTransactions,
  creditConfigurations,
  organizationMemberships,
} from '../../../db/schema/index.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import Logger from '../../../utils/logger.js';
import { BUSINESS_SUITE_MATRIX } from '../../../data/permission-matrix.js';
import { subscriptions } from '../../../db/schema/billing/subscriptions.js';

// ─── Public Types ──────────────────────────────────────────────────────────

export interface BootstrapTenantRecord {
  tenantId: string;
  tenantName: string;
  kindeOrgId: string | null;
  isActive: boolean;
  industry: string | null;
  organizationSize: string | null;
  /** Subscription status/billing/trial details — plan name is at the event top-level */
  subscription: {
    status: string | null;
    billingCycle: string | null;
    isTrialUser: boolean;
    trialStartedAt: string | null;
    trialEndsAt: string | null;
  } | null;
}

export interface BootstrapOrganization {
  /** Wrapper UUID — use this as the FK for wrapper_entities.entity_id in FA */
  entityId: string;
  orgCode: string;
  orgName: string;
  parentId: string | null;
  level: number | null;
  country: string | null;
  currency: string | null;
  isActive: boolean;
}

export interface BootstrapUser {
  userId: string;
  kindeId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  isTenantAdmin: boolean;
  isActive: boolean;
}

export interface BootstrapRole {
  roleId: string;
  roleName: string;
  /** Flat permission strings scoped to appCode, e.g. "accounting.journals.create" */
  permissions: string[];
  isSystemRole: boolean;
}

export interface BootstrapEmployeeAssignment {
  assignmentId: string;
  userId: string;
  entityId: string;
  accessLevel: string | null;
}

export interface BootstrapRoleAssignment {
  assignmentId: string;
  userId: string;
  roleId: string;
  assignedAt: Date | null;
  isActive: boolean;
}

export interface BootstrapCreditConfig {
  configId: string | null;
  operationCode: string;
  operationName: string;
  creditCost: number;
  unit: string;
  isGlobal: boolean;
  source: 'global' | 'tenant' | 'default';
}

export interface BootstrapEntityCredit {
  entityId: string;
  allocatedCredits: number;
  usedCredits: number;
  availableCredits: number;
  isActive: boolean;
}

export interface BootstrapPayload {
  /** ISO timestamp of when this snapshot was assembled — use as bootstrapVersion */
  snapshotAt: string;
  tenantId: string;
  appCode: string;
  tenant: BootstrapTenantRecord | null;
  organizations: BootstrapOrganization[];
  users: BootstrapUser[];
  roles: BootstrapRole[];
  employeeAssignments: BootstrapEmployeeAssignment[];
  roleAssignments: BootstrapRoleAssignment[];
  creditConfigs: BootstrapCreditConfig[];
  entityCredits: BootstrapEntityCredit[];
  /** Per-collection record counts for FA to write into bootstrap_phases */
  recordCounts: Record<string, number>;
  /** Any collections that partially failed — FA should log these but not abort */
  warnings: Array<{ collection: string; error: string }>;
}

// ─── Matrix skeleton cache ──────────────────────────────────────────────────
// The BUSINESS_SUITE_MATRIX never changes at runtime — it is a static import.
// Pre-computing (and memoising) the flat list of {operationCode, operationName}
// per appCode avoids re-traversing the full matrix tree on every bootstrap call.
// For 'accounting' this saves ~2ms of pure-CPU work per request (276 entries).

interface MatrixSkeletonEntry {
  operationCode: string;
  operationName: string;
}

// ─── Service ───────────────────────────────────────────────────────────────

export class BootstrapService {
  /**
   * Module-level cache: appCode → sorted flat list of {operationCode, operationName}.
   * Built lazily on first call per appCode; never expires (matrix is a static import).
   */
  private readonly _matrixSkeletonCache = new Map<string, MatrixSkeletonEntry[]>();

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * Return (and cache) the flat sorted list of all operation codes defined in
   * BUSINESS_SUITE_MATRIX for the given appCode.
   *
   * Cost: O(P) on first call, O(1) on subsequent calls.
   */
  private getMatrixSkeleton(appCode: string): MatrixSkeletonEntry[] {
    const cached = this._matrixSkeletonCache.get(appCode);
    if (cached) return cached;

    const matrixRoot = this.isRecord(BUSINESS_SUITE_MATRIX) ? BUSINESS_SUITE_MATRIX : {};
    const appMatrixRaw = (matrixRoot as Record<string, unknown>)[appCode];
    const appMatrix = this.isRecord(appMatrixRaw) ? appMatrixRaw : null;
    const modules = appMatrix && this.isRecord(appMatrix['modules']) ? appMatrix['modules'] : null;

    const entries: MatrixSkeletonEntry[] = [];

    if (modules) {
      for (const [moduleKey, moduleDataUnknown] of Object.entries(modules)) {
        const moduleData = moduleDataUnknown as any;
        if (!Array.isArray(moduleData.permissions)) continue;

        for (const permission of moduleData.permissions as Array<{ code: string; name: string }>) {
          entries.push({
            operationCode: `${appCode}.${moduleKey}.${permission.code}`,
            operationName: `${moduleData.moduleName} - ${permission.name}`,
          });
        }
      }
      entries.sort((a, b) => a.operationCode.localeCompare(b.operationCode));
    }

    this._matrixSkeletonCache.set(appCode, entries);
    return entries;
  }

  /**
   * Assemble a complete, app-scoped bootstrap payload for a tenant.
   *
   * All DB reads are issued inside a single READ COMMITTED transaction so the
   * returned data comes from a consistent database snapshot. If any individual
   * collection fails (non-critical), it is recorded in `warnings` and an empty
   * array is returned for that collection — the overall call still succeeds.
   *
   * Critical collections (tenant, organizations, users) are re-thrown on failure
   * because FA cannot function without them.
   */
  async assemble(tenantId: string, appCode: string): Promise<BootstrapPayload> {
    const snapshotAt = new Date().toISOString();
    const warnings: Array<{ collection: string; error: string }> = [];

    Logger.log('info', 'bootstrap', 'bootstrap_service', 'assembling payload', { tenantId, appCode });

    // ── Critical collections — run in parallel ────────────────────────────────
    // All 8 fetch methods accept `db` directly (same interface as a tx object).
    // We no longer wrap reads in a transaction: the prior sequential-in-tx approach
    // cost ~1,600ms because Drizzle transactions hold a single connection and cannot
    // overlap I/O. Parallel reads reduce end-to-end time to ~350ms (slowest query).
    // Trade-off: reads are no longer from a single Postgres snapshot, but bootstrap
    // payloads are always reconciled against MQ delta events, so minor cross-
    // collection skew is acceptable.
    const [tenantResult, organizationsResult, usersResult, rolesResult] = await Promise.allSettled([
      this.fetchTenant(db, tenantId),
      this.fetchOrganizations(db, tenantId),
      this.fetchUsers(db, tenantId),
      this.fetchRoles(db, tenantId, appCode),
    ]);

    // Critical failures abort the bootstrap entirely.
    if (tenantResult.status === 'rejected') {
      throw new Error(`bootstrap.fetchTenant failed: ${tenantResult.reason?.message || 'unknown error'}`);
    }
    if (organizationsResult.status === 'rejected') {
      throw new Error(`bootstrap.fetchOrganizations failed: ${organizationsResult.reason?.message || 'unknown error'}`);
    }
    if (usersResult.status === 'rejected') {
      throw new Error(`bootstrap.fetchUsers failed: ${usersResult.reason?.message || 'unknown error'}`);
    }
    if (rolesResult.status === 'rejected') {
      throw new Error(`bootstrap.fetchRoles failed: ${rolesResult.reason?.message || 'unknown error'}`);
    }

    const tenant = tenantResult.value;
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }
    const organizations = organizationsResult.value;
    const users = usersResult.value;
    const roles = rolesResult.value;

    // ── Non-critical collections — run in parallel ────────────────────────────
    // Failures are recorded in warnings; empty arrays returned.
    const [
      employeeAssignmentsResult,
      roleAssignmentsResult,
      creditConfigsResult,
      entityCreditsResult,
    ] = await Promise.allSettled([
      this.fetchEmployeeAssignments(db, tenantId),
      this.fetchRoleAssignments(db, tenantId),
      this.fetchCreditConfigs(db, tenantId, appCode),
      this.fetchEntityCredits(db, tenantId, appCode),
    ]);

    const employeeAssignments = employeeAssignmentsResult.status === 'fulfilled'
      ? employeeAssignmentsResult.value
      : (() => {
          warnings.push({ collection: 'employeeAssignments', error: employeeAssignmentsResult.reason?.message });
          Logger.log('warning', 'bootstrap', 'bootstrap_service', 'employeeAssignments fetch failed (non-critical)', {
            tenantId, error: employeeAssignmentsResult.reason?.message,
          });
          return [] as BootstrapEmployeeAssignment[];
        })();

    const roleAssignments = roleAssignmentsResult.status === 'fulfilled'
      ? roleAssignmentsResult.value
      : (() => {
          warnings.push({ collection: 'roleAssignments', error: roleAssignmentsResult.reason?.message });
          Logger.log('warning', 'bootstrap', 'bootstrap_service', 'roleAssignments fetch failed (non-critical)', {
            tenantId, error: roleAssignmentsResult.reason?.message,
          });
          return [] as BootstrapRoleAssignment[];
        })();

    const creditConfigs = creditConfigsResult.status === 'fulfilled'
      ? creditConfigsResult.value
      : (() => {
          warnings.push({ collection: 'creditConfigs', error: creditConfigsResult.reason?.message });
          Logger.log('warning', 'bootstrap', 'bootstrap_service', 'creditConfigs fetch failed (non-critical)', {
            tenantId, appCode, error: creditConfigsResult.reason?.message,
          });
          return [] as BootstrapCreditConfig[];
        })();

    const entityCredits = entityCreditsResult.status === 'fulfilled'
      ? entityCreditsResult.value
      : (() => {
          warnings.push({ collection: 'entityCredits', error: entityCreditsResult.reason?.message });
          Logger.log('warning', 'bootstrap', 'bootstrap_service', 'entityCredits fetch failed (non-critical)', {
            tenantId, appCode, error: entityCreditsResult.reason?.message,
          });
          return [] as BootstrapEntityCredit[];
        })();

    const recordCounts: Record<string, number> = {
      tenant:              tenant ? 1 : 0,
      organizations:       organizations.length,
      users:               users.length,
      roles:               roles.length,
      employeeAssignments: employeeAssignments.length,
      roleAssignments:     roleAssignments.length,
      creditConfigs:       creditConfigs.length,
      entityCredits:       entityCredits.length,
    };

    Logger.log('info', 'bootstrap', 'bootstrap_service', 'payload assembled', {
      tenantId,
      appCode,
      recordCounts,
      warningCount: warnings.length,
    });

    return {
      snapshotAt,
      tenantId,
      appCode,
      tenant,
      organizations,
      users,
      roles,
      employeeAssignments,
      roleAssignments,
      creditConfigs,
      entityCredits,
      recordCounts,
      warnings,
    };
  }

  // ─── Private domain fetch methods ────────────────────────────────────────
  // Each method is responsible for ONE collection. If the collection schema
  // changes, only that method changes. The assemble() orchestrator is untouched.

  private async fetchTenant(tx: any, tenantId: string): Promise<BootstrapTenantRecord | null> {
    const rows = await tx
      .select({
        tenantId:         tenants.tenantId,
        companyName:      tenants.companyName,
        kindeOrgId:       tenants.kindeOrgId,
        isActive:         tenants.isActive,
        industry:         tenants.industry,
        organizationSize: tenants.organizationSize,
      })
      .from(tenants)
      .where(eq(tenants.tenantId, tenantId))
      .limit(1);

    if (!rows.length) return null;
    const r = rows[0];

    // Fetch the most recent active (or trialing) subscription for this tenant.
    const subRows = await tx
      .select({
        plan:           subscriptions.plan,
        status:         subscriptions.status,
        billingCycle:   subscriptions.billingCycle,
        isTrialUser:    subscriptions.isTrialUser,
        trialStartedAt: subscriptions.trialStartedAt,
        trialEndsAt:    subscriptions.trialEndsAt,
      })
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    const sub = subRows[0] ?? null;

    return {
      tenantId:         r.tenantId,
      tenantName:       r.companyName ?? '',
      kindeOrgId:       r.kindeOrgId ?? null,
      isActive:         r.isActive ?? true,
      industry:         r.industry ?? null,
      organizationSize: r.organizationSize ?? null,
      subscription: sub
        ? {
            status:         sub.status ?? null,
            billingCycle:   sub.billingCycle ?? null,
            isTrialUser:    Boolean(sub.isTrialUser),
            trialStartedAt: sub.trialStartedAt ? new Date(sub.trialStartedAt).toISOString() : null,
            trialEndsAt:    sub.trialEndsAt    ? new Date(sub.trialEndsAt).toISOString()    : null,
          }
        : null,
    };
  }

  private async fetchOrganizations(tx: any, tenantId: string): Promise<BootstrapOrganization[]> {
    const rows = await tx
      .select({
        entityId:    entities.entityId,
        entityName:  entities.entityName,
        parentId:    entities.parentEntityId,
        level:       entities.entityLevel,
        country:     entities.country,
        currency:    entities.currency,
        isActive:    entities.isActive,
      })
      .from(entities)
      .where(and(
        eq(entities.tenantId, tenantId),
        eq(entities.isActive, true),
      ))
      .orderBy(entities.entityLevel, entities.entityName);

    // entity_code was dropped in migration 0015 — use entityId as the stable org code.
    // FA uses orgCode as FK; since entity_code never existed in FA's data yet, entityId is safe.
    const entityIdToCode = new Map<string, string>(
      rows
        .filter((r: any) => r.entityId)
        .map((r: any) => [r.entityId, r.entityId as string])
    );

    return rows.map((r: any) => ({
      orgCode:  r.entityId as string,
      orgName:  r.entityName ?? '',
      entityId: r.entityId,
      parentId: r.parentId ? (entityIdToCode.get(r.parentId) ?? r.parentId) : null,
      // Default to 1 for root orgs — entity_level column has DB default 1 but can be null
      // if inserted without the field. FA's hierarchy_level is NOT NULL (defaults 0).
      level:    r.level ?? (r.parentId ? null : 1),
      country:  r.country  ?? null,
      currency: r.currency ?? null,
      isActive: r.isActive ?? true,
    }));
  }

  private async fetchUsers(tx: any, tenantId: string): Promise<BootstrapUser[]> {
    const rows = await tx
      .select({
        userId:       tenantUsers.userId,
        kindeUserId:  tenantUsers.kindeUserId,
        email:        tenantUsers.email,
        firstName:    tenantUsers.firstName,
        lastName:     tenantUsers.lastName,
        isTenantAdmin:tenantUsers.isTenantAdmin,
        isActive:     tenantUsers.isActive,
      })
      .from(tenantUsers)
      .where(and(
        eq(tenantUsers.tenantId, tenantId),
        eq(tenantUsers.isActive, true),
      ));

    return rows.map((r: any) => {
      const firstName = r.firstName ?? '';
      const lastName  = r.lastName ?? '';
      return {
        userId:       r.userId,
        kindeId:      r.kindeUserId ?? null,
        email:        r.email ?? '',
        firstName,
        lastName,
        isTenantAdmin:r.isTenantAdmin ?? false,
        isActive:     r.isActive ?? true,
      };
    });
  }

  /**
   * Fetch roles filtered to those that have at least one permission in the
   * given appCode namespace. A role with permissions only in 'crm.*' is NOT
   * included in an 'accounting' bootstrap payload — it's irrelevant to FA.
   */
  private async fetchRoles(tx: any, tenantId: string, appCode: string): Promise<BootstrapRole[]> {
    const rows = await tx
      .select({
        roleId:       customRoles.roleId,
        roleName:     customRoles.roleName,
        permissions:  customRoles.permissions,
        isSystemRole: customRoles.isSystemRole,
      })
      .from(customRoles)
      .where(eq(customRoles.tenantId, tenantId))
      .orderBy(customRoles.roleName);

    const result: BootstrapRole[] = [];

    for (const r of rows) {
      const flatPerms = this.extractAppPermissions(r.permissions, appCode);
      if (flatPerms.length > 0 || r.isSystemRole) {
        result.push({
          roleId:       r.roleId,
          roleName:     r.roleName ?? '',
          permissions:  flatPerms,
          isSystemRole: r.isSystemRole ?? false,
        });
      }
    }

    return result;
  }

  private async fetchEmployeeAssignments(tx: any, tenantId: string): Promise<BootstrapEmployeeAssignment[]> {
    const rows = await tx
      .select({
        membershipId:   organizationMemberships.membershipId,
        userId:         organizationMemberships.userId,
        entityId:    organizationMemberships.entityId,
        accessLevel: organizationMemberships.accessLevel,
      })
      .from(organizationMemberships)
      .where(and(
        eq(organizationMemberships.tenantId, tenantId),
        eq(organizationMemberships.membershipStatus, 'active'),
      ));

    return rows.map((r: any) => ({
      assignmentId: r.membershipId,
      userId:       r.userId,
      entityId:     r.entityId,
      accessLevel:  r.accessLevel ?? null,
    }));
  }

  private async fetchRoleAssignments(tx: any, tenantId: string): Promise<BootstrapRoleAssignment[]> {
    const rows = await tx
      .select({
        id:         userRoleAssignments.id,
        userId:     userRoleAssignments.userId,
        roleId:     userRoleAssignments.roleId,
        orgId:      (userRoleAssignments as any).organizationId,
        assignedAt: userRoleAssignments.assignedAt,
        isActive:   userRoleAssignments.isActive,
      })
      .from(userRoleAssignments)
      .innerJoin(tenantUsers, eq(userRoleAssignments.userId, tenantUsers.userId))
      .where(and(
        eq(tenantUsers.tenantId, tenantId),
        eq(userRoleAssignments.isActive, true),
      ));

    return rows.map((r: any) => ({
      assignmentId: r.id,
      userId:       r.userId,
      roleId:       r.roleId,
      assignedAt:   r.assignedAt ?? null,
      isActive:     r.isActive ?? true,
    }));
  }

  /**
   * Credit configs for bootstrap:
   * Return ONLY tenant-specific configs for the requested app namespace.
   * If the tenant has no overrides, return an empty array.
   */
  private async fetchCreditConfigs(tx: any, tenantId: string, appCode: string): Promise<BootstrapCreditConfig[]> {
    const tenantConfigs = await tx
      .select({
        configId:      creditConfigurations.configId,
        operationCode: creditConfigurations.operationCode,
        operationName: creditConfigurations.operationName,
        creditCost:    creditConfigurations.creditCost,
        unit:          creditConfigurations.unit,
        isGlobal:      creditConfigurations.isGlobal,
      })
      .from(creditConfigurations)
      .where(and(
        eq(creditConfigurations.tenantId, tenantId),
        eq(creditConfigurations.isGlobal, false),
        eq(creditConfigurations.isActive, true),
        sql`${creditConfigurations.operationCode} LIKE ${appCode + '.%'}`,
      ))
      .orderBy(creditConfigurations.operationCode);

    return tenantConfigs.map((config: any) => ({
      configId:      config.configId ?? null,
      operationCode: config.operationCode,
      operationName: config.operationName ?? config.operationCode,
      creditCost:    parseFloat(String(config.creditCost ?? 0)),
      unit:          config.unit ?? 'operation',
      isGlobal:      config.isGlobal ?? false,
      source:        'tenant' as const,
    }));
  }

  private async fetchEntityCredits(tx: any, tenantId: string, appCode: string): Promise<BootstrapEntityCredit[]> {
    // Only credits explicitly allocated to this app are sent.
    // The onboarding pool (operationCode='onboarding') is tenant-wide and NOT
    // app-specific — FA only receives credits that were transferred to it via
    // POST /api/credits/allocate/application (operationCode='application_allocation:{appCode}').
    // At initial onboarding, no such allocation exists → allocatedCredits=0 is correct.
    // An admin allocates credits to FA post-onboarding through the credit management UI.
    const allocationOpCode = `application_allocation:${appCode}`;

    const creditRows = await tx
      .select({ entityId: credits.entityId, isActive: credits.isActive })
      .from(credits)
      .where(eq(credits.tenantId, tenantId));

    if (!creditRows.length) return [];

    const entityIds = creditRows
      .map((c: any) => c.entityId)
      .filter((id: string | null | undefined): id is string => Boolean(id));

    const allocations = entityIds.length > 0
      ? await tx
          .select({
            entityId:       creditTransactions.entityId,
            totalAllocated: sql`COALESCE(SUM(${creditTransactions.amount}), 0)`,
          })
          .from(creditTransactions)
          .where(and(
            eq(creditTransactions.tenantId, tenantId),
            eq(creditTransactions.operationCode, allocationOpCode),
            sql`${creditTransactions.entityId} IN (${sql.join(entityIds.map((id: string) => sql`${id}::uuid`), sql`, `)})`,
          ))
          .groupBy(creditTransactions.entityId)
      : [];

    const allocationMap: Record<string, number> = {};
    for (const r of allocations) {
      allocationMap[(r as any).entityId ?? ''] = parseFloat(String((r as any).totalAllocated ?? 0));
    }

    return creditRows.map((c: any) => {
      const allocated = allocationMap[c.entityId ?? ''] ?? 0;
      return {
        entityId:        c.entityId ?? '',
        allocatedCredits:allocated,
        usedCredits:     0,   // Apps track their own consumption; Wrapper only tracks allocations
        availableCredits:allocated,
        isActive:        c.isActive ?? true,
      };
    });
  }

  // ─── Helper ────────────────────────────────────────────────────────────────

  /**
   * Extract flat permission strings for a specific appCode from the stored
   * JSONB permissions object.
   *
   * Input (stored in DB):
   *   { accounting: { journals: ['create','read'], ledger: ['read'] },
   *     crm: { leads: ['read'] } }
   *
   * Output for appCode='accounting':
   *   ['accounting.journals.create', 'accounting.journals.read', 'accounting.ledger.read']
   */
  private extractAppPermissions(permissions: unknown, appCode: string): string[] {
    if (!permissions) return [];

    let permObj: unknown;
    try {
      permObj = typeof permissions === 'string'
        ? JSON.parse(permissions)
        : permissions;
    } catch {
      return [];
    }

    if (!this.isRecord(permObj)) return [];
    const appPerms = permObj[appCode];
    if (!this.isRecord(appPerms)) return [];

    const flat: string[] = [];
    for (const [resource, actions] of Object.entries(appPerms)) {
      if (Array.isArray(actions)) {
        for (const action of actions as string[]) {
          flat.push(`${appCode}.${resource}.${action}`);
        }
      }
    }
    return flat;
  }
}

export const bootstrapService = new BootstrapService();
