import { db } from '../../../db/index.js';
import { tenants, tenantUsers, customRoles, userRoleAssignments, entities, credits } from '../../../db/schema/index.js';
// REMOVED: creditAllocations - Table removed, applications manage their own credits
import { eq, and, sql } from 'drizzle-orm';

export interface TriggerTenantSyncOptions {
  skipReferenceData?: boolean;
  forceSync?: boolean;
  requestedBy?: string;
}

export interface SyncResults {
  tenantId: string;
  startedAt: Date;
  completedAt: Date | null;
  duration: number;
  success: boolean;
  error?: string;
  phases: {
    essential: { success: boolean; data: Record<string, unknown> };
    reference: { success: boolean; data: Record<string, unknown>; skipped?: boolean };
    validation: { success: boolean; validation: Record<string, unknown> };
  };
}

/**
 * Wrapper CRM Data Synchronization Service
 * Handles progressive sync of tenant data from Wrapper to CRM
 */
export class WrapperSyncService {

  /**
   * Trigger full tenant data synchronization
   */
  static async triggerTenantSync(tenantId: string, options: TriggerTenantSyncOptions = {}): Promise<SyncResults> {
    const { skipReferenceData = false, forceSync = false, requestedBy } = options;

    console.log(`🔄 Starting tenant sync for ${tenantId}`, {
      skipReferenceData,
      forceSync,
      requestedBy
    });

    const startTime = Date.now();
    const results: SyncResults = {
      tenantId,
      startedAt: new Date(),
      completedAt: null,
      duration: 0,
      success: false,
      phases: {
        essential: { success: false, data: {} },
        reference: { success: false, data: {} },
        validation: { success: false, validation: {} }
      }
    };

    try {
      // Phase 1: Essential Data (Blocking)
      console.log('📋 Phase 1: Syncing essential data...');
      results.phases.essential = await this.syncEssentialData(tenantId, requestedBy);
      console.log('✅ Phase 1 completed:', results.phases.essential);

      // Phase 2: Reference Data (Non-blocking)
      if (!skipReferenceData) {
        console.log('📋 Phase 2: Syncing reference data...');
        results.phases.reference = await this.syncReferenceData(tenantId, requestedBy);
        console.log('✅ Phase 2 completed:', results.phases.reference);
      } else {
        console.log('⏭️ Phase 2 skipped (skipReferenceData=true)');
        results.phases.reference = { success: true, data: {}, skipped: true };
      }

      // Phase 3: Validation
      console.log('📋 Phase 3: Validating sync...');
      results.phases.validation = await this.validateSync(tenantId);
      console.log('✅ Phase 3 completed:', results.phases.validation);

      // Calculate overall success
      results.success = results.phases.essential.success &&
                       (skipReferenceData || results.phases.reference.success) &&
                       results.phases.validation.success;

      results.completedAt = new Date();
      results.duration = results.completedAt.getTime() - startTime;

      console.log(`🎉 Tenant sync completed for ${tenantId}`, {
        success: results.success,
        duration: `${results.duration}ms`,
        phases: (Object.keys(results.phases) as Array<keyof typeof results.phases>).map(phase => ({
          phase,
          success: results.phases[phase].success
        }))
      });

      return results;

    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Tenant sync failed for ${tenantId}:`, error);
      results.completedAt = new Date();
      results.duration = results.completedAt.getTime() - startTime;
      results.error = error.message;
      throw error;
    }
  }

  /**
   * Sync essential data (tenant info, user profiles, organizations)
   */
  static async syncEssentialData(tenantId: string, _requestedBy?: string): Promise<{ success: boolean; data: Record<string, unknown> }> {
    const results: { success: boolean; data: Record<string, unknown> } = { success: false, data: {} };

    try {
      // 1. Sync tenant information
      console.log(`🏢 Syncing tenant info for ${tenantId}...`);
      const tenantResult = await this.syncTenantInfo(tenantId);
      results.data.tenant = tenantResult;
      console.log(`✅ Tenant synced: ${(tenantResult as { success?: boolean }).success ? 'success' : 'failed'}`);

      // 2. Sync user profiles
      console.log(`👥 Syncing user profiles for ${tenantId}...`);
      const userProfilesResult = await this.syncUserProfiles(tenantId);
      results.data.userProfiles = userProfilesResult;
      console.log(`✅ User profiles synced: ${(userProfilesResult as { count?: number }).count} records`);

      // 3. Sync organizations
      console.log(`🏛️ Syncing organizations for ${tenantId}...`);
      const orgsResult = await this.syncOrganizations(tenantId);
      results.data.organizations = orgsResult;
      console.log(`✅ Organizations synced: ${(orgsResult as { count?: number }).count} records`);

      results.success = Boolean((tenantResult as { success?: boolean }).success) &&
                       Boolean((userProfilesResult as { success?: boolean }).success) &&
                       Boolean((orgsResult as { success?: boolean }).success);

      return results;

    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Essential data sync failed for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Sync reference data (detailed users, credits, assignments, etc.)
   */
  static async syncReferenceData(tenantId: string, _requestedBy?: string): Promise<{ success: boolean; data: Record<string, unknown>; error?: string }> {
    const results: { success: boolean; data: Record<string, unknown>; error?: string } = { success: false, data: {} };

    try {
      // 1. Sync detailed tenant users
      console.log(`👤 Syncing detailed tenant users for ${tenantId}...`);
      const tenantUsersResult = await this.syncTenantUsers(tenantId);
      results.data.tenantUsers = tenantUsersResult;
      console.log(`✅ Detailed users synced: ${(tenantUsersResult as { count?: number }).count} records`);

      // 2. Sync credit configurations
      console.log(`💳 Syncing credit configurations for ${tenantId}...`);
      const creditConfigsResult = await this.syncCreditConfigs(tenantId);
      results.data.creditConfigs = creditConfigsResult;
      console.log(`✅ Credit configs synced: ${(creditConfigsResult as { count?: number }).count} records`);

      // 3. Sync entity credits
      console.log(`💰 Syncing entity credits for ${tenantId}...`);
      const entityCreditsResult = await this.syncEntityCredits(tenantId);
      results.data.entityCredits = entityCreditsResult;
      console.log(`✅ Entity credits synced: ${(entityCreditsResult as { count?: number }).count} records`);

      // 4. Sync employee assignments
      console.log(`👷 Syncing employee assignments for ${tenantId}...`);
      const employeeAssignmentsResult = await this.syncEmployeeAssignments(tenantId);
      results.data.employeeAssignments = employeeAssignmentsResult;
      console.log(`✅ Employee assignments synced: ${(employeeAssignmentsResult as { count?: number }).count} records`);

      // 5. Sync role assignments
      console.log(`🎭 Syncing role assignments for ${tenantId}...`);
      const roleAssignmentsResult = await this.syncRoleAssignments(tenantId);
      results.data.roleAssignments = roleAssignmentsResult;
      console.log(`✅ Role assignments synced: ${(roleAssignmentsResult as { count?: number }).count} records`);

      results.success = true; // Reference data sync is non-blocking

      return results;

    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Reference data sync failed for ${tenantId}:`, error);
      (results as { error?: string }).error = error.message;
      return results;
    }
  }

  /**
   * Validate sync completeness and data integrity
   */
  static async validateSync(tenantId: string): Promise<{ success: boolean; validation: { completeness: number; issues: string[] } }> {
    const validation: { success: boolean; validation: { completeness: number; issues: string[] } } = {
      success: false,
      validation: {
        completeness: 0,
        issues: [] as string[]
      }
    };

    try {
      // Check essential data completeness
      const [tenantCount] = await db
        .select({ count: sql`count(*)` })
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId));

      const [userCount] = await db
        .select({ count: sql`count(*)` })
        .from(tenantUsers)
        .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.isActive, true)));

      const [orgCount] = await db
        .select({ count: sql`count(*)` })
        .from(entities)
        .where(and(eq(entities.tenantId, tenantId), eq(entities.isActive, true)));

      // Calculate completeness percentage
      const essentialChecks = [
        { name: 'tenant', required: true, count: tenantCount.count },
        { name: 'users', required: true, count: userCount.count },
        { name: 'organizations', required: true, count: orgCount.count }
      ];

      const requiredItems = essentialChecks.filter(check => check.required);
      const completedItems = requiredItems.filter(check => Number(check.count) > 0);

      validation.validation.completeness = Math.round((completedItems.length / requiredItems.length) * 100);

      // Check for issues
      if (Number(tenantCount.count) === 0) {
        validation.validation.issues.push('Missing tenant record');
      }
      if (Number(userCount.count) === 0) {
        validation.validation.issues.push('No active users found');
      }
      if (Number(orgCount.count) === 0) {
        validation.validation.issues.push('No organizations found');
      }

      validation.success = validation.validation.completeness === 100 && validation.validation.issues.length === 0;

      return validation;

    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Validation failed for ${tenantId}:`, error);
      validation.validation.issues.push('Validation error: ' + error.message);
      return validation;
    }
  }

  /**
   * Sync tenant information
   */
  static async syncTenantInfo(tenantId: string): Promise<{ success: boolean; error?: string; count: number; data?: unknown }> {
    try {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (!tenant) {
        return { success: false, error: 'Tenant not found', count: 0 };
      }

      return { success: true, count: 1, data: tenant };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Error syncing tenant info for ${tenantId}:`, error);
      return { success: false, error: error.message, count: 0 };
    }
  }

  /**
   * Sync user profiles
   */
  static async syncUserProfiles(tenantId: string): Promise<{ success: boolean; count: number; data?: unknown; error?: string }> {
    try {
      const users = await db
        .select({
          userId: tenantUsers.userId,
          employeeCode: sql`COALESCE(${tenantUsers.userId}::text, ${tenantUsers.userId}::text)`,
          personalInfo: sql`json_build_object(
            'firstName', ${tenantUsers.firstName},
            'lastName', ${tenantUsers.lastName},
            'email', ${tenantUsers.email}
          )`,
          organization: sql`json_build_object(
            'orgCode', COALESCE(${tenantUsers.primaryOrganizationId}, ${tenantId}::text)
          )`,
          status: sql`json_build_object(
            'isActive', ${tenantUsers.isActive}
          )`,
          roles: sql`(SELECT json_agg(json_build_object(
            'roleId', ${customRoles.roleId},
            'roleName', ${customRoles.roleName},
            'permissions', COALESCE(${customRoles.permissions}, '[]'::jsonb),
            'isActive', true,
            'priority', COALESCE(${customRoles.priority}, 0)
          )) FROM ${customRoles}
          LEFT JOIN ${userRoleAssignments} ON ${customRoles.roleId} = ${userRoleAssignments.roleId}
          WHERE ${userRoleAssignments.userId} = ${tenantUsers.userId})`,
          permissions: sql`json_build_object(
            'effective', (SELECT array_agg(DISTINCT permission) FROM ${userRoleAssignments} ura
                         LEFT JOIN ${customRoles} cr ON ura.roleId = cr.roleId
                         WHERE ura.userId = ${tenantUsers.userId}
                         AND cr.permissions IS NOT NULL),
            'inherited', '[]'::jsonb
          )`
        })
        .from(tenantUsers)
        .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.isActive, true)));

      return { success: true, count: users.length, data: users };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Error syncing user profiles for ${tenantId}:`, error);
      return { success: false, error: error.message, count: 0 };
    }
  }

  /**
   * Sync organizations
   */
  static async syncOrganizations(tenantId: string): Promise<{ success: boolean; count: number; data?: unknown; error?: string }> {
    try {
      const organizations = await db
        .select({
          orgCode: entities.entityId,
          orgName: entities.entityName,
          parentId: entities.parentEntityId,
          status: sql`CASE WHEN ${entities.isActive} THEN 'active' ELSE 'inactive' END`,
          hierarchy: sql`json_build_object(
            'level', ${entities.entityLevel},
            'path', ${entities.hierarchyPath},
            'children', '[]'::jsonb
          )`,
          metadata: sql`json_build_object(
            'description', ${entities.description},
            'type', ${entities.entityType}
          )`
        })
        .from(entities)
        .where(and(eq(entities.tenantId, tenantId), eq(entities.isActive, true)));

      return { success: true, count: organizations.length, data: organizations };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Error syncing organizations for ${tenantId}:`, error);
      return { success: false, error: error.message, count: 0 };
    }
  }

  /**
   * Sync detailed tenant users
   */
  static async syncTenantUsers(tenantId: string): Promise<{ success: boolean; count: number; data?: unknown; error?: string }> {
    try {
      const tenantUsersData = await db
        .select({
          userId: tenantUsers.userId,
          tenantId: tenantUsers.tenantId,
          kindeId: tenantUsers.kindeUserId,
          email: tenantUsers.email,
          firstName: tenantUsers.firstName,
          lastName: tenantUsers.lastName,
          primaryOrganizationId: tenantUsers.primaryOrganizationId,
          isResponsiblePerson: sql`CASE WHEN ${tenantUsers.isTenantAdmin} THEN true ELSE false END`,
          isTenantAdmin: tenantUsers.isTenantAdmin,
          isVerified: sql`true`,
          onboardingCompleted: tenantUsers.onboardingCompleted,
          preferences: sql`COALESCE(${tenantUsers.preferences}, '{}'::jsonb)`,
          profile: sql`json_build_object('employeeCode', COALESCE(${tenantUsers.userId}::text, ''))`,
          security: sql`json_build_object(
            'isActive', ${tenantUsers.isActive}
          )`,
          metadata: sql`json_build_object('name', COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.firstName}, ${tenantUsers.lastName}, ''))`
        })
        .from(tenantUsers)
        .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.isActive, true)));

      return { success: true, count: tenantUsersData.length, data: tenantUsersData };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Error syncing detailed tenant users for ${tenantId}:`, error);
      return { success: false, error: error.message, count: 0 };
    }
  }

  /**
   * Sync credit configurations
   */
  static async syncCreditConfigs(tenantId: string): Promise<{ success: boolean; count: number; data?: unknown[]; error?: string }> {
    try {
      // For now, return default credit configurations
      const creditConfigs = [{
        configId: `default_${tenantId}`,
        tenantId: tenantId,
        entityId: tenantId,
        configName: 'Default Credit Configuration',
        creditLimit: 1000,
        resetPeriod: 'monthly',
        resetDay: 1,
        lastResetAt: null,
        isActive: true,
        metadata: {
          description: 'Default credit configuration for tenant',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }];

      return { success: true, count: creditConfigs.length, data: creditConfigs };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Error syncing credit configs for ${tenantId}:`, error);
      return { success: false, error: error.message, count: 0 };
    }
  }

  /**
   * Sync entity credits
   */
  static async syncEntityCredits(tenantId: string): Promise<{ success: boolean; count: number; data?: unknown[]; error?: string }> {
    // REMOVED: creditAllocations table queries
    // Applications now manage their own credit consumption
    // Use credits table instead for organization-level credits
    try {
      const entityCredits = await db
        .select({
          tenantId: credits.tenantId,
          entityId: credits.entityId,
          availableCredits: credits.availableCredits,
          isActive: credits.isActive
        })
        .from(credits)
        .where(eq(credits.tenantId, tenantId));

      return { success: true, count: entityCredits.length, data: entityCredits };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Error syncing entity credits for ${tenantId}:`, error);
      return { success: false, error: error.message, count: 0 };
    }
  }

  /**
   * Sync employee assignments
   */
  static async syncEmployeeAssignments(tenantId: string): Promise<{ success: boolean; count: number; data?: unknown[]; error?: string }> {
    try {
      const assignments = await db
        .select({
          assignmentId: sql`${tenantUsers.userId} || '_' || COALESCE(${tenantUsers.primaryOrganizationId}, ${tenantId}::text)`,
          tenantId: tenantUsers.tenantId,
          userId: tenantUsers.userId,
          entityId: sql`COALESCE(${tenantUsers.primaryOrganizationId}, ${tenantId}::text)`,
          assignmentType: sql`'primary'`,
          isActive: tenantUsers.isActive,
          assignedAt: tenantUsers.createdAt,
          expiresAt: sql`NULL`,
          assignedBy: sql`NULL`,
          deactivatedAt: sql`NULL`,
          deactivatedBy: sql`NULL`,
          priority: sql`1`,
          metadata: sql`json_build_object(
            'employeeCode', COALESCE(${tenantUsers.userId}::text, ${tenantUsers.userId}::text)
          )`
        })
        .from(tenantUsers)
        .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.isActive, true)));

      return { success: true, count: assignments.length, data: assignments };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Error syncing employee assignments for ${tenantId}:`, error);
      return { success: false, error: error.message, count: 0 };
    }
  }

  /**
   * Sync role assignments
   */
  static async syncRoleAssignments(tenantId: string): Promise<{ success: boolean; count: number; data?: unknown[]; error?: string }> {
    try {
      const roleAssignments = await db
        .select({
          assignmentId: sql`${userRoleAssignments.userId} || '_' || ${userRoleAssignments.roleId}`,
          tenantId: tenantUsers.tenantId,
          userId: userRoleAssignments.userId,
          roleId: userRoleAssignments.roleId,
          entityId: sql`COALESCE(${tenantUsers.primaryOrganizationId}, ${tenantId}::text)`,
          assignedBy: userRoleAssignments.assignedBy,
          assignedAt: userRoleAssignments.assignedAt,
          expiresAt: sql`NULL`,
          isActive: userRoleAssignments.isActive,
          metadata: sql`json_build_object(
            'userEmail', ${tenantUsers.email},
            'userName', COALESCE(${tenantUsers.firstName} || ' ' || ${tenantUsers.lastName}, ${tenantUsers.firstName}, ${tenantUsers.lastName}, ''),
            'roleName', ${customRoles.roleName}
          )`
        })
        .from(userRoleAssignments)
        .innerJoin(tenantUsers, eq(userRoleAssignments.userId, tenantUsers.userId))
        .innerJoin(customRoles, eq(userRoleAssignments.roleId, customRoles.roleId))
        .where(and(
          eq(tenantUsers.tenantId, tenantId),
          eq(userRoleAssignments.isActive, true)
        ));

      return { success: true, count: roleAssignments.length, data: roleAssignments };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Error syncing role assignments for ${tenantId}:`, error);
      return { success: false, error: error.message, count: 0 };
    }
  }

  /**
   * Get sync status for tenant
   */
  static async getSyncStatus(tenantId: string): Promise<Record<string, unknown>> {
    try {
      // Check last sync timestamp and data counts
      const [tenantCount] = await db
        .select({ count: sql`count(*)` })
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId));

      const [userCount] = await db
        .select({ count: sql`count(*)` })
        .from(tenantUsers)
        .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.isActive, true)));

      const [orgCount] = await db
        .select({ count: sql`count(*)` })
        .from(entities)
        .where(and(eq(entities.tenantId, tenantId), eq(entities.isActive, true)));

      // REMOVED: creditAllocations table query
      // Use credits table instead
      const [creditConfigCount] = await db
        .select({ count: sql`count(*)` })
        .from(credits)
        .where(eq(credits.tenantId, tenantId));

      const tc = Number(tenantCount.count);
      const uc = Number(userCount.count);
      const oc = Number(orgCount.count);
      const cc = Number(creditConfigCount.count);
      return {
        lastSync: new Date(),
        isComplete: tc > 0 && uc > 0 && oc > 0,
        dataCounts: {
          users: uc,
          organizations: oc,
          tenantUsers: uc,
          creditConfigs: 1,
          entityCredits: cc,
          employeeAssignments: uc,
          roleAssignments: await this.getRoleAssignmentCount(tenantId)
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Error getting sync status for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get role assignment count for tenant
   */
  static async getRoleAssignmentCount(tenantId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(userRoleAssignments)
        .innerJoin(tenantUsers, eq(userRoleAssignments.userId, tenantUsers.userId))
        .where(and(eq(tenantUsers.tenantId, tenantId), eq(userRoleAssignments.isActive, true)));

      return Number((result[0] as { count: unknown })?.count ?? 0);
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ Error getting role assignment count for ${tenantId}:`, error);
      return 0;
    }
  }

  /**
   * Get data requirements specification
   */
  static getDataRequirements(): Record<string, unknown> {
    return {
      essentialData: {
        tenant: {
          required: true,
          description: 'Basic tenant information',
          fields: [
            'tenantId', 'tenantName', 'status', 'settings', 'subscription',
            'organization', 'hierarchy'
          ]
        },
        userProfiles: {
          required: true,
          description: 'User profiles with permissions',
          fields: [
            'userId', 'employeeCode', 'personalInfo', 'organization',
            'status', 'permissions', 'roles'
          ]
        },
        organizations: {
          required: true,
          description: 'Organization hierarchy',
          fields: [
            'orgCode', 'orgName', 'parentId', 'status', 'hierarchy', 'metadata'
          ]
        }
      },
      referenceData: {
        tenantUsers: {
          required: false,
          description: 'Detailed user information',
          fields: [
            'userId', 'tenantId', 'kindeId', 'email', 'firstName', 'lastName',
            'primaryOrganizationId', 'isResponsiblePerson', 'isTenantAdmin',
            'isVerified', 'onboardingCompleted', 'lastLoginAt', 'loginCount',
            'preferences', 'profile', 'security', 'metadata'
          ]
        },
        roles: {
          required: false,
          description: 'Role definitions',
          fields: [
            'roleId', 'roleName', 'permissions', 'priority', 'isActive', 'description'
          ]
        },
        creditConfigs: {
          required: false,
          description: 'Credit operation configurations',
          fields: [
            'configId', 'tenantId', 'entityId', 'configName', 'creditLimit',
            'resetPeriod', 'resetDay', 'lastResetAt', 'isActive', 'metadata'
          ]
        },
        entityCredits: {
          required: false,
          description: 'Entity credit allocations',
          fields: [
            'tenantId', 'entityId', 'allocatedCredits', 'targetApplication',
            'usedCredits', 'availableCredits', 'allocationType', 'allocationPurpose',
            'expiresAt', 'isActive', 'allocationSource', 'allocatedBy',
            'allocatedAt', 'metadata'
          ]
        },
        employeeAssignments: {
          required: false,
          description: 'User-organization relationships',
          fields: [
            'assignmentId', 'tenantId', 'userId', 'entityId', 'assignmentType',
            'isActive', 'assignedAt', 'expiresAt', 'assignedBy', 'deactivatedAt',
            'deactivatedBy', 'priority', 'metadata'
          ]
        },
        roleAssignments: {
          required: false,
          description: 'User role assignments',
          fields: [
            'assignmentId', 'tenantId', 'userId', 'roleId', 'entityId',
            'assignedBy', 'assignedAt', 'expiresAt', 'isActive', 'metadata'
          ]
        }
      },
      syncConfiguration: {
        batchSize: 50,
        timeout: 30000,
        progressiveSync: true,
        errorHandling: 'continue',
        validation: true
      }
    };
  }
}
