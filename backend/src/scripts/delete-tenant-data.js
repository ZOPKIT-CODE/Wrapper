#!/usr/bin/env node

/**
 * 🗑️ COMPREHENSIVE TENANT DATA DELETION SCRIPT
 * 
 * This script deletes all data associated with a tenant ID in the correct order
 * to satisfy foreign key constraints.
 * 
 * Usage:
 *   node backend/src/scripts/delete-tenant-data.js <tenantId>
 * 
 * Example:
 *   node backend/src/scripts/delete-tenant-data.js "395031ab-dad1-4b9a-b1b5-e3878477edad"
 * 
 * ⚠️ WARNING: This operation is IRREVERSIBLE. Use with caution!
 */

import { systemDbConnection } from '../db/index.js';
import {
  // Core tenant tables
  tenants,
  tenantUsers,
  customRoles,
  userRoleAssignments,
  subscriptions,
  payments,
  
  // Unified entities system
  entities,
  organizationMemberships,
  
  // Credits system
  credits,
  creditTransactions,
  creditPurchases,
  creditUsage,
  // REMOVED: creditAllocations, creditAllocationTransactions - Application-specific allocations removed
  creditConfigurations,
  
  // Responsible persons
  responsiblePersons,
  
  // Other related tables
  tenantInvitations,
  auditLogs,
  notifications,
  eventTracking,
  userSessions,
  organizationApplications,
  userApplicationPermissions,
  webhookLogs,
} from '../db/schema/index.js';

// Import membership and responsibility tables from their specific files
import { 
  membershipInvitations, 
  membershipHistory 
} from '../db/schema/organizations/organization_memberships.js';

import { 
  responsibilityHistory, 
  responsibilityNotifications 
} from '../db/schema/organizations/responsible_persons.js';
import { eq, or, inArray, sql } from 'drizzle-orm';

/**
 * Delete all data for a tenant in the correct order
 */
async function deleteTenantData(tenantId) {
  console.log(`\n🗑️  Starting comprehensive deletion for tenant: ${tenantId}\n`);
  
  const deletionResults = {
    tenantId,
    deletedRecords: {},
    startTime: new Date(),
    endTime: null,
    success: false,
    errors: []
  };

  try {
    // Check if tenant row exists (optional - we still cleanup child data if missing)
    const [tenant] = await systemDbConnection
      .select({ tenantId: tenants.tenantId, companyName: tenants.companyName })
      .from(tenants)
      .where(eq(tenants.tenantId, tenantId))
      .limit(1);

    if (!tenant) {
      console.log(`⚠️  Tenant row not found; cleaning up any remaining child data for ${tenantId}...\n`);
    } else {
      console.log(`✅ Found tenant: ${tenant.companyName}`);
    }
    console.log(`📋 Starting deletion process...\n`);

    // Use transaction to ensure atomicity
    await systemDbConnection.transaction(async (tx) => {
      
      // ========================================================================
      // STEP 1: Delete child records that reference users/entities
      // ========================================================================
      
      // Get all user IDs for this tenant
      const tenantUserIds = await tx
        .select({ userId: tenantUsers.userId })
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId));
      
      const userIds = tenantUserIds.map(row => row.userId);
      console.log(`📊 Found ${userIds.length} users for this tenant`);

      // Get all entity IDs for this tenant
      const tenantEntities = await tx
        .select({ entityId: entities.entityId, entityLevel: entities.entityLevel })
        .from(entities)
        .where(eq(entities.tenantId, tenantId));
      
      const entityIds = tenantEntities.map(row => row.entityId);
      console.log(`📊 Found ${entityIds.length} entities for this tenant`);

      // Get all responsible person assignment IDs for this tenant
      const responsiblePersonAssignments = await tx
        .select({ assignmentId: responsiblePersons.assignmentId })
        .from(responsiblePersons)
        .where(eq(responsiblePersons.tenantId, tenantId));
      
      // Get all membership IDs for this tenant (needed for membership history and invitations)
      const tenantMemberships = await tx
        .select({ membershipId: organizationMemberships.membershipId })
        .from(organizationMemberships)
        .where(eq(organizationMemberships.tenantId, tenantId));
      
      console.log(`📊 Found ${responsiblePersonAssignments.length} responsible person assignments`);
      console.log(`📊 Found ${tenantMemberships.length} organization memberships\n`);

      // 1.1 Delete responsibility notifications (references responsiblePersons by assignmentId)
      
      if (responsiblePersonAssignments.length > 0) {
        console.log('🔄 [1.1] Deleting responsibility notifications...');
        const assignmentIds = responsiblePersonAssignments.map(a => a.assignmentId);
        const result = await tx
          .delete(responsibilityNotifications)
          .where(inArray(responsibilityNotifications.assignmentId, assignmentIds))
          .returning({ id: responsibilityNotifications.notificationId });
        deletionResults.deletedRecords.responsibilityNotifications = result.length;
        console.log(`   ✅ Deleted ${result.length} responsibility notifications`);
      } else {
        deletionResults.deletedRecords.responsibilityNotifications = 0;
      }

      // 1.2 Delete responsibility history (references responsiblePersons by assignmentId)
      if (responsiblePersonAssignments.length > 0) {
        console.log('🔄 [1.2] Deleting responsibility history...');
        const assignmentIds = responsiblePersonAssignments.map(a => a.assignmentId);
        const result = await tx
          .delete(responsibilityHistory)
          .where(inArray(responsibilityHistory.assignmentId, assignmentIds))
          .returning({ id: responsibilityHistory.historyId });
        deletionResults.deletedRecords.responsibilityHistory = result.length;
        console.log(`   ✅ Deleted ${result.length} responsibility history records`);
      } else {
        deletionResults.deletedRecords.responsibilityHistory = 0;
      }

      // 1.3 Delete membership history (references organizationMemberships by membershipId)
      if (tenantMemberships.length > 0) {
        console.log('🔄 [1.3] Deleting membership history...');
        const membershipIds = tenantMemberships.map(m => m.membershipId);
        const membershipHistoryResult = await tx
          .delete(membershipHistory)
          .where(inArray(membershipHistory.membershipId, membershipIds))
          .returning({ id: membershipHistory.historyId });
        deletionResults.deletedRecords.membershipHistory = membershipHistoryResult.length;
        console.log(`   ✅ Deleted ${membershipHistoryResult.length} membership history records`);
      } else {
        deletionResults.deletedRecords.membershipHistory = 0;
        console.log('🔄 [1.3] No membership history to delete');
      }

      // 1.4 Delete membership invitations (references organizationMemberships by membershipId)
      if (tenantMemberships.length > 0) {
        console.log('🔄 [1.4] Deleting membership invitations...');
        const membershipIds = tenantMemberships.map(m => m.membershipId);
        const membershipInvitationsResult = await tx
          .delete(membershipInvitations)
          .where(inArray(membershipInvitations.membershipId, membershipIds))
          .returning({ id: membershipInvitations.invitationId });
        deletionResults.deletedRecords.membershipInvitations = membershipInvitationsResult.length;
        console.log(`   ✅ Deleted ${membershipInvitationsResult.length} membership invitations`);
      } else {
        deletionResults.deletedRecords.membershipInvitations = 0;
        console.log('🔄 [1.4] No membership invitations to delete');
      }

      // REMOVED: 1.5 Delete credit allocation transactions - Table removed
      deletionResults.deletedRecords.creditAllocationTransactions = 0;

      // 1.6 Delete credit transactions (references credits and users via initiated_by)
      console.log('🔄 [1.6] Deleting credit transactions...');
      const creditTxResult = await tx
        .delete(creditTransactions)
        .where(
          userIds.length > 0
            ? or(
                eq(creditTransactions.tenantId, tenantId),
                inArray(creditTransactions.initiatedBy, userIds)
              )
            : eq(creditTransactions.tenantId, tenantId)
        )
        .returning({ id: creditTransactions.transactionId });
      deletionResults.deletedRecords.creditTransactions = creditTxResult.length;
      console.log(`   ✅ Deleted ${creditTxResult.length} credit transactions`);

      // ========================================================================
      // STEP 2: Delete records that reference users
      // ========================================================================

      // 2.1 Delete user role assignments
      if (userIds.length > 0) {
        console.log('🔄 [2.1] Deleting user role assignments...');
        const result = await tx
          .delete(userRoleAssignments)
          .where(inArray(userRoleAssignments.userId, userIds))
          .returning({ id: userRoleAssignments.id });
        deletionResults.deletedRecords.userRoleAssignments = result.length;
        console.log(`   ✅ Deleted ${result.length} user role assignments`);
      } else {
        deletionResults.deletedRecords.userRoleAssignments = 0;
      }

      // 2.2 Delete user application permissions
      if (userIds.length > 0) {
        console.log('🔄 [2.2] Deleting user application permissions...');
        const result = await tx
          .delete(userApplicationPermissions)
          .where(inArray(userApplicationPermissions.userId, userIds))
          .returning({ id: userApplicationPermissions.id });
        deletionResults.deletedRecords.userApplicationPermissions = result.length;
        console.log(`   ✅ Deleted ${result.length} user application permissions`);
      } else {
        deletionResults.deletedRecords.userApplicationPermissions = 0;
      }

      // 2.3 Delete credit usage (references users)
      if (userIds.length > 0) {
        console.log('🔄 [2.3] Deleting credit usage records...');
        const result = await tx
          .delete(creditUsage)
          .where(
            or(
              eq(creditUsage.tenantId, tenantId),
              inArray(creditUsage.userId, userIds)
            )
          )
          .returning({ id: creditUsage.usageId });
        deletionResults.deletedRecords.creditUsage = result.length;
        console.log(`   ✅ Deleted ${result.length} credit usage records`);
      } else {
        deletionResults.deletedRecords.creditUsage = 0;
      }

      // 2.4 Delete user sessions
      console.log('🔄 [2.4] Deleting user sessions...');
      const userSessionsResult = await tx
        .delete(userSessions)
        .where(eq(userSessions.tenantId, tenantId))
        .returning({ id: userSessions.sessionId });
      deletionResults.deletedRecords.userSessions = userSessionsResult.length;
      console.log(`   ✅ Deleted ${userSessionsResult.length} user sessions`);

      // ========================================================================
      // STEP 3: Delete records that reference entities
      // ========================================================================

      // REMOVED: 3.1 Delete credit allocations - Table removed
      deletionResults.deletedRecords.creditAllocations = 0;

      // 3.2 Delete credits (references entities)
      if (entityIds.length > 0) {
        console.log('🔄 [3.2] Deleting credits...');
        const result = await tx
          .delete(credits)
          .where(
            or(
              eq(credits.tenantId, tenantId),
              inArray(credits.entityId, entityIds)
            )
          )
          .returning({ id: credits.creditId });
        deletionResults.deletedRecords.credits = result.length;
        console.log(`   ✅ Deleted ${result.length} credit records`);
      } else {
        deletionResults.deletedRecords.credits = 0;
      }

      // 3.3 Delete credit purchases (references entities and users via requested_by)
      console.log('🔄 [3.3] Deleting credit purchases...');
      const creditPurchasesResult = await tx
        .delete(creditPurchases)
        .where(
          userIds.length > 0
            ? or(
                eq(creditPurchases.tenantId, tenantId),
                inArray(creditPurchases.requestedBy, userIds)
              )
            : eq(creditPurchases.tenantId, tenantId)
        )
        .returning({ id: creditPurchases.purchaseId });
      deletionResults.deletedRecords.creditPurchases = creditPurchasesResult.length;
      console.log(`   ✅ Deleted ${creditPurchasesResult.length} credit purchases`);

      // 3.4 Delete organization memberships (references entities)
      console.log('🔄 [3.4] Deleting organization memberships...');
      const orgMembershipsResult = await tx
        .delete(organizationMemberships)
        .where(eq(organizationMemberships.tenantId, tenantId))
        .returning({ id: organizationMemberships.membershipId });
      deletionResults.deletedRecords.organizationMemberships = orgMembershipsResult.length;
      console.log(`   ✅ Deleted ${orgMembershipsResult.length} organization memberships`);

      // 3.5 Delete responsible persons (references entities)
      console.log('🔄 [3.5] Deleting responsible persons...');
      const responsiblePersonsResult = await tx
        .delete(responsiblePersons)
        .where(eq(responsiblePersons.tenantId, tenantId))
        .returning({ id: responsiblePersons.assignmentId });
      deletionResults.deletedRecords.responsiblePersons = responsiblePersonsResult.length;
      console.log(`   ✅ Deleted ${responsiblePersonsResult.length} responsible persons`);

      // ========================================================================
      // STEP 4: Delete tenant-level records
      // ========================================================================

      // 4.1 Delete audit logs
      console.log('🔄 [4.1] Deleting audit logs...');
      const auditLogsResult = await tx
        .delete(auditLogs)
        .where(eq(auditLogs.tenantId, tenantId))
        .returning({ id: auditLogs.logId });
      deletionResults.deletedRecords.auditLogs = auditLogsResult.length;
      console.log(`   ✅ Deleted ${auditLogsResult.length} audit logs`);

      // 4.2 Delete notifications
      console.log('🔄 [4.3] Deleting notifications...');
      const notificationsResult = await tx
        .delete(notifications)
        .where(eq(notifications.tenantId, tenantId))
        .returning({ id: notifications.notificationId });
      deletionResults.deletedRecords.notifications = notificationsResult.length;
      console.log(`   ✅ Deleted ${notificationsResult.length} notifications`);

      // 4.4 Delete event tracking (tenantId is varchar, not uuid)
      console.log('🔄 [4.4] Deleting event tracking records...');
      // Count first to get accurate count
      const [eventTrackingCount] = await tx
        .select({ count: sql`count(*)` })
        .from(eventTracking)
        .where(eq(eventTracking.tenantId, tenantId.toString()));
      const countBefore = Number(eventTrackingCount?.count || 0);
      
      // Delete without returning (to avoid column name issues)
      await tx
        .delete(eventTracking)
        .where(eq(eventTracking.tenantId, tenantId.toString()));
      
      deletionResults.deletedRecords.eventTracking = countBefore;
      console.log(`   ✅ Deleted ${countBefore} event tracking records`);

      // 4.5 Note: webhookLogs table doesn't have tenantId field, skipping deletion
      deletionResults.deletedRecords.webhookLogs = 0;
      console.log('🔄 [4.5] Skipping webhook logs (no tenantId field in schema)');

      // 4.6 Delete tenant invitations
      console.log('🔄 [4.6] Deleting tenant invitations...');
      const tenantInvitationsResult = await tx
        .delete(tenantInvitations)
        .where(eq(tenantInvitations.tenantId, tenantId))
        .returning({ id: tenantInvitations.invitationId });
      deletionResults.deletedRecords.tenantInvitations = tenantInvitationsResult.length;
      console.log(`   ✅ Deleted ${tenantInvitationsResult.length} tenant invitations`);

      // 4.7 Delete organization applications
      console.log('🔄 [4.7] Deleting organization applications...');
      const orgAppsResult = await tx
        .delete(organizationApplications)
        .where(eq(organizationApplications.tenantId, tenantId))
        .returning({ id: organizationApplications.id });
      deletionResults.deletedRecords.organizationApplications = orgAppsResult.length;
      console.log(`   ✅ Deleted ${orgAppsResult.length} organization applications`);

      // 4.8 Delete credit configurations (references users via created_by and updated_by)
      console.log('🔄 [4.8] Deleting credit configurations...');
      const creditConfigsResult = await tx
        .delete(creditConfigurations)
        .where(
          userIds.length > 0
            ? or(
                eq(creditConfigurations.tenantId, tenantId),
                inArray(creditConfigurations.createdBy, userIds),
                inArray(creditConfigurations.updatedBy, userIds)
              )
            : eq(creditConfigurations.tenantId, tenantId)
        )
        .returning({ id: creditConfigurations.configId });
      deletionResults.deletedRecords.creditConfigurations = creditConfigsResult.length;
      console.log(`   ✅ Deleted ${creditConfigsResult.length} credit configurations`);

      // 4.9 Nullify primary_organization_id references in tenant_users before deleting entities
      // This prevents FK constraint violations when deleting entities
      console.log('🔄 [4.9] Nullifying primary_organization_id references in tenant_users...');
      if (userIds.length > 0) {
        const nullifyResult = await tx
          .update(tenantUsers)
          .set({ primaryOrganizationId: null })
          .where(eq(tenantUsers.tenantId, tenantId))
          .returning({ id: tenantUsers.userId });
        deletionResults.deletedRecords.nullifiedPrimaryOrgRefs = nullifyResult.length;
        console.log(`   ✅ Nullified ${nullifyResult.length} primary_organization_id references`);
      } else {
        deletionResults.deletedRecords.nullifiedPrimaryOrgRefs = 0;
        console.log('   ✅ No tenant users to update');
      }

      // ========================================================================
      // STEP 5: Delete entities (must be before users due to FK constraints)
      // ========================================================================

      // 5.1 Delete entities (handle hierarchy - delete children first)
      console.log('🔄 [5.1] Deleting entities (handling hierarchy)...');
      // Delete entities in reverse level order (children first)
      const maxLevel = Math.max(...tenantEntities.map(e => e.entityLevel || 1), 1);
      for (let level = maxLevel; level >= 1; level--) {
        const entitiesAtLevel = tenantEntities.filter(e => (e.entityLevel || 1) === level);
        if (entitiesAtLevel.length > 0) {
          const entityIdsAtLevel = entitiesAtLevel.map(e => e.entityId);
          const result = await tx
            .delete(entities)
            .where(inArray(entities.entityId, entityIdsAtLevel))
            .returning({ id: entities.entityId });
          console.log(`   ✅ Deleted ${result.length} entities at level ${level}`);
        }
      }
      deletionResults.deletedRecords.entities = tenantEntities.length;

      // ========================================================================
      // STEP 6: Delete roles and users
      // ========================================================================

      // 6.1 Delete custom roles (references users via created_by and last_modified_by)
      console.log('🔄 [6.1] Deleting custom roles...');
      const customRolesResult = await tx
        .delete(customRoles)
        .where(
          userIds.length > 0
            ? or(
                eq(customRoles.tenantId, tenantId),
                inArray(customRoles.createdBy, userIds),
                inArray(customRoles.lastModifiedBy, userIds)
              )
            : eq(customRoles.tenantId, tenantId)
        )
        .returning({ id: customRoles.roleId });
      deletionResults.deletedRecords.customRoles = customRolesResult.length;
      console.log(`   ✅ Deleted ${customRolesResult.length} custom roles`);

      // 6.2 Delete tenant users
      console.log('🔄 [6.2] Deleting tenant users...');
      const tenantUsersResult = await tx
        .delete(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId))
        .returning({ id: tenantUsers.userId });
      deletionResults.deletedRecords.tenantUsers = tenantUsersResult.length;
      console.log(`   ✅ Deleted ${tenantUsersResult.length} tenant users`);

      // ========================================================================
      // STEP 7: Delete payments and subscriptions
      // ========================================================================

      // 7.1 Delete payments (references subscriptions)
      console.log('🔄 [7.1] Deleting payments...');
      const paymentsResult = await tx
        .delete(payments)
        .where(eq(payments.tenantId, tenantId))
        .returning({ id: payments.paymentId });
      deletionResults.deletedRecords.payments = paymentsResult.length;
      console.log(`   ✅ Deleted ${paymentsResult.length} payments`);

      // 7.2 Delete subscriptions
      console.log('🔄 [7.2] Deleting subscriptions...');
      const subscriptionsResult = await tx
        .delete(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .returning({ id: subscriptions.subscriptionId });
      deletionResults.deletedRecords.subscriptions = subscriptionsResult.length;
      console.log(`   ✅ Deleted ${subscriptionsResult.length} subscriptions`);

      // ========================================================================
      // STEP 8: Finally, delete the tenant itself
      // ========================================================================

      console.log('🔄 [8.1] Deleting tenant record...');
      const tenantResult = await tx
        .delete(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .returning({ id: tenants.tenantId });
      deletionResults.deletedRecords.tenants = tenantResult.length;
      console.log(`   ✅ Deleted ${tenantResult.length} tenant record`);
    });

    deletionResults.success = true;
    deletionResults.endTime = new Date();
    
    const duration = deletionResults.endTime - deletionResults.startTime;
    const totalRecords = Object.values(deletionResults.deletedRecords).reduce((sum, count) => sum + count, 0);
    
    console.log('\n🎉 Tenant deletion completed successfully!');
    console.log('\n📊 Deletion Summary:');
    console.log('═'.repeat(60));
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Total Records Deleted: ${totalRecords}`);
    console.log('\n📋 Breakdown by Table:');
    Object.entries(deletionResults.deletedRecords).forEach(([table, count]) => {
      console.log(`   ${table.padEnd(40)} ${count}`);
    });
    console.log('═'.repeat(60));

    return deletionResults;

  } catch (error) {
    deletionResults.success = false;
    deletionResults.endTime = new Date();
    deletionResults.errors.push(error.message);
    
    console.error('\n🚨 Tenant deletion failed!');
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    throw error;
  }
}

// Main execution
async function main() {
  const tenantId = process.argv[2];

  if (!tenantId) {
    console.error('❌ Error: Tenant ID is required');
    console.error('\nUsage:');
    console.error('  node backend/src/scripts/delete-tenant-data.js <tenantId>');
    console.error('\nExample:');
    console.error('  node backend/src/scripts/delete-tenant-data.js "395031ab-dad1-4b9a-b1b5-e3878477edad"');
    process.exit(1);
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tenantId)) {
    console.error('❌ Error: Invalid UUID format');
    console.error(`Provided: ${tenantId}`);
    process.exit(1);
  }

  try {
    await deleteTenantData(tenantId);
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed');
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { deleteTenantData };

