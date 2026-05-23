/**
 * **ONBOARDING DB SERVICE**
 * Handles all database operations for onboarding:
 * - createCompleteOnboardingInTransaction (primary transaction)
 * - createDatabaseRecords (legacy/deprecated)
 * - createTrialSubscription
 * - allocateTrialCredits
 * - configureSubdomainSystem
 * - storeOnboardingFormDataForRetry / getStoredOnboardingFormData / deleteStoredOnboardingFormData
 */

import { db, systemDbConnection } from '../../../db/index.js';
import { tenants, tenantUsers, customRoles, userRoleAssignments, subscriptions, entities, onboardingFormData, credits, creditTransactions } from '../../../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { CreditService } from '../../../features/credits/index.js';
import { OnboardingFileLogger } from '../../../utils/onboarding-file-logger.js';
import Logger from '../../../utils/logger.js';

export class OnboardingDbService {

  /**
   * 💾 **STORE ONBOARDING FORM DATA FOR RETRY**
   * Stores form data when onboarding fails so user can retry
   */
  static async storeOnboardingFormDataForRetry(params: { kindeUserId: string; email: string; formData: Record<string, unknown>; error: Record<string, unknown> }): Promise<void> {
    const { kindeUserId, email, formData, error } = params;
    try {
      Logger.log('info', 'general', 'storeOnboardingFormDataForRetry', 'Storing onboarding form data for retry', { kindeUserId, email });

      // Check if form data already exists
      const existing = await systemDbConnection
        .select()
        .from(onboardingFormData)
        .where(and(
          eq(onboardingFormData.kindeUserId, kindeUserId),
          eq(onboardingFormData.email, email)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Update existing record
        await systemDbConnection
          .update(onboardingFormData)
          .set({
            formData: formData,
            stepData: {
              error: error,
              lastAttempt: new Date().toISOString()
            },
            lastSaved: new Date(),
            updatedAt: new Date()
          })
          .where(eq(onboardingFormData.id, existing[0].id));
        Logger.log('info', 'general', 'storeOnboardingFormDataForRetry', 'Updated existing onboarding form data for retry');
      } else {
        // Create new record
        await systemDbConnection
          .insert(onboardingFormData)
          .values({
            kindeUserId,
            email,
            flowType: (formData.type as string) || 'frontend',
            formData: formData as Record<string, unknown>,
            stepData: {
              error: error as Record<string, unknown>,
              lastAttempt: new Date().toISOString()
            },
            currentStep: (error?.step as string) || 'failed',
            lastSaved: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          } as any);
        Logger.log('info', 'general', 'storeOnboardingFormDataForRetry', 'Stored onboarding form data for retry');
      }
    } catch (err: unknown) {
      const storeError = err as Error;
      Logger.log('error', 'general', 'storeOnboardingFormDataForRetry', 'Failed to store onboarding form data', { error: storeError.message });
      throw storeError;
    }
  }

  /**
   * 📥 **GET STORED ONBOARDING FORM DATA**
   * Retrieves stored form data for retry
   */
  static async getStoredOnboardingFormData(kindeUserId: string, email: string): Promise<Record<string, unknown> | null> {
    try {
      const [stored] = await systemDbConnection
        .select()
        .from(onboardingFormData)
        .where(and(
          eq(onboardingFormData.kindeUserId, kindeUserId),
          eq(onboardingFormData.email, email)
        ))
        .limit(1);

      if (!stored) {
        return null;
      }

      return {
        id: stored.id,
        formData: stored.formData,
        stepData: stored.stepData,
        currentStep: stored.currentStep,
        flowType: stored.flowType,
        lastSaved: stored.lastSaved
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'getStoredOnboardingFormData', 'Failed to get stored onboarding form data', { error: error.message });
      throw error;
    }
  }

  /**
   * 🗑️ **DELETE STORED ONBOARDING FORM DATA**
   * Deletes stored form data after successful retry
   */
  static async deleteStoredOnboardingFormData(kindeUserId: string, email: string): Promise<void> {
    try {
      await systemDbConnection
        .delete(onboardingFormData)
        .where(and(
          eq(onboardingFormData.kindeUserId, kindeUserId),
          eq(onboardingFormData.email, email)
        ));
      Logger.log('info', 'general', 'deleteStoredOnboardingFormData', 'Deleted stored onboarding form data');
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'deleteStoredOnboardingFormData', 'Failed to delete stored onboarding form data', { error: error.message });
      throw error;
    }
  }

  /**
   * 🏗️ **CREATE COMPLETE ONBOARDING IN SINGLE TRANSACTION**
   * Wraps ALL database operations in one transaction for atomicity
   * If any step fails, everything rolls back automatically
   */
  static async createCompleteOnboardingInTransaction(params: {
    type: string;
    companyName: string;
    subdomain: string;
    adminEmail: string;
    adminName: string;
    firstName?: string;
    lastName?: string;
    termsAccepted?: boolean;
    kindeUserId: string;
    kindeOrgId: string;
    selectedPlan: string;
    gstin?: string | null;
    hasGstin?: boolean;
    companyType?: string | null;
    companySize?: string | null;
    businessType?: string | null;
    primaryUseCase?: string | null;
    industry?: string | null;
    website?: string | null;
    country?: string | null;
    state?: string | null;
    timezone?: string | null;
    currency?: string | null;
    defaultLanguage?: string | null;
    defaultLocale?: string | null;
    taxRegistered?: boolean;
    vatGstRegistered?: boolean;
    billingEmail?: string | null;
    adminMobile?: string | null;
    supportEmail?: string | null;
    contactJobTitle?: string | null;
    preferredContactMethod?: string | null;
    mailingAddressSameAsRegistered?: boolean;
    mailingStreet?: string | null;
    mailingCity?: string | null;
    mailingState?: string | null;
    mailingZip?: string | null;
    mailingCountry?: string | null;
    billingStreet?: string | null;
    billingCity?: string | null;
    billingState?: string | null;
    billingZip?: string | null;
    billingCountry?: string | null;
    contactSalutation?: string | null;
    contactMiddleName?: string | null;
    contactDepartment?: string | null;
    contactDirectPhone?: string | null;
    contactMobilePhone?: string | null;
    contactPreferredContactMethod?: string | null;
    contactAuthorityLevel?: string | null;
    taxRegistrationDetails?: Record<string, unknown>;
    panNumber?: string | null;
    maxUsers?: number;
    maxProjects?: number;
    planName?: string;
    planPrice?: number;
  }, logger: OnboardingFileLogger | null = null): Promise<Record<string, unknown>> {
    const {
    type,
    companyName,
    subdomain,
    adminEmail,
    adminName,
    firstName,
    lastName,
    termsAccepted,
    kindeUserId,
    kindeOrgId,
    selectedPlan,
    gstin,
    hasGstin,
    companyType,
    companySize,
    businessType,
    industry: _industry,
    website,
    country,
    state,
    timezone,
    currency,
    defaultLanguage,
    defaultLocale,
    taxRegistered,
    vatGstRegistered,
    billingEmail,
    adminMobile,
    supportEmail,
    contactJobTitle,
    preferredContactMethod,
    mailingAddressSameAsRegistered,
    mailingStreet,
    mailingCity,
    mailingState,
    mailingZip,
    mailingCountry,
    billingStreet,
    billingCity,
    billingState,
    billingZip,
    billingCountry,
    contactSalutation,
    contactMiddleName,
    contactDepartment,
    contactDirectPhone,
    contactMobilePhone,
    contactPreferredContactMethod,
    contactAuthorityLevel,
    taxRegistrationDetails,
    panNumber,
    maxUsers,
    maxProjects,
    planName,
    planPrice
  } = params;
    Logger.log('info', 'general', 'createCompleteOnboardingInTransaction', 'Creating complete onboarding in single transaction', { companyName });

    const currentTime = new Date();

    // Wrap ALL database operations in a single transaction.
    // isolationLevel 'read committed' prevents postgres.js v3 from silently retrying the
    // transaction body on serialization/deadlock errors — without this, the 14-step body
    // was executing 3× on every request, adding ~6s of latency.
    const result = await systemDbConnection.transaction(async (tx) => {
      // ============================================
      // STEP 1: CREATE TENANT
      // ============================================
      const [tenant] = await tx
        .insert(tenants)
        .values({
          tenantId: uuidv4(),
          companyName,
          subdomain,
          kindeOrgId,
          adminEmail,
          legalCompanyName: companyName,
          companyType: companyType || null,
          gstin: hasGstin && gstin ? gstin.toUpperCase() : null,
          industry: businessType || null, // Use businessType for backward compatibility
          website: website || null,
          organizationSize: companySize || null,
          defaultTimeZone: timezone || 'Asia/Kolkata',
          defaultCurrency: currency || 'INR',
          defaultLanguage: defaultLanguage || 'en',
          defaultLocale: defaultLocale || 'en-IN',
          phone: contactDirectPhone || contactMobilePhone || adminMobile || null,
          onboardingCompleted: false,
          onboardedAt: currentTime,
          // Use formStartedAt if provided by frontend; otherwise approximate 30s before completion
          onboardingStartedAt: (params as { formStartedAt?: string }).formStartedAt
            ? new Date((params as { formStartedAt?: string }).formStartedAt as string)
            : new Date(currentTime.getTime() - 30_000),
          firstLoginAt: currentTime,
          taxRegistered: taxRegistered || false,
          vatGstRegistered: vatGstRegistered || false,
          billingEmail: billingEmail || null,
          contactJobTitle: contactJobTitle || null,
          preferredContactMethod: preferredContactMethod || null,
          mailingAddressSameAsRegistered: mailingAddressSameAsRegistered !== undefined ? mailingAddressSameAsRegistered : true,
          mailingStreet: mailingStreet || null,
          mailingCity: mailingCity || null,
          mailingState: mailingState || state || null,
          mailingZip: mailingZip || null,
          mailingCountry: mailingCountry || null,
          billingStreet: billingStreet || null,
          billingCity: billingCity || null,
          billingState: billingState || state || null,
          billingZip: billingZip || null,
          billingCountry: billingCountry || country || null,
          supportEmail: supportEmail || null,
          contactSalutation: contactSalutation || null,
          contactMiddleName: contactMiddleName || null,
          contactDepartment: contactDepartment || null,
          contactDirectPhone: contactDirectPhone || null,
          contactMobilePhone: contactMobilePhone || adminMobile || null,
          contactAuthorityLevel: contactAuthorityLevel || null,
          taxRegistrationDetails: taxRegistrationDetails || (panNumber ? { pan: panNumber, country: country || 'IN' } : {}),
          // No application-level data stored here. Each concern has its own table:
          //   Subscription / trial → subscriptions table
          //   Features enabled     → organization_applications table
          //   Onboarding step      → tenant_users.onboardingStep column
          //   Onboarding progress  → onboarding_form_data table
          //   Plan details         → subscriptions.plan column
          //   Completed at         → tenants.onboardedAt column
          settings: {}
        })
        .returning({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          subdomain: tenants.subdomain,
          kindeOrgId: tenants.kindeOrgId,
          adminEmail: tenants.adminEmail,
          onboardingCompleted: tenants.onboardingCompleted,
          onboardedAt: tenants.onboardedAt,
        });

      // Set tenant context for RLS within transaction
      await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenant.tenantId}, false)`);

      // ============================================
      // STEP 2: CREATE PRIMARY ORGANIZATION
      // ============================================
      const organizationEntityId = uuidv4();
      const [organization] = await tx
        .insert(entities)
        .values({
          entityId: organizationEntityId,
          tenantId: tenant.tenantId,
          parentEntityId: null,
          entityLevel: 1,
          hierarchyPath: organizationEntityId.toString(),
          fullHierarchyPath: companyName,
          entityName: companyName,
          description: `Root organization created during ${type} onboarding`,
          entityType: 'organization',
          isActive: true,
          // Carry over fields available from onboarding
          legalName: companyName,
          country: country || null,
          currency: currency || 'INR',
          timezone: timezone || 'Asia/Kolkata',
          language: defaultLanguage || 'en',
          fiscalYearEnd: '12-31',
          taxId: hasGstin && gstin ? gstin.toUpperCase() : null,
          contactEmail: adminEmail,
          contactPhone: contactDirectPhone || contactMobilePhone || adminMobile || null,
          contactWebsite: website || null,
          createdBy: null,
          updatedBy: null
        })
        .returning({
          organizationId: entities.entityId,
          organizationName: entities.entityName,
        });

      if (!organization || !organization.organizationId) {
        throw new Error('Failed to create root organization entity');
      }

      // ============================================
      // STEP 3: CREATE ADMIN USER
      // ============================================
      const formData: Record<string, unknown> = {};
      if (companySize) formData.companySize = companySize;
      if (businessType) formData.businessType = businessType;
      if (hasGstin !== undefined) formData.hasGstin = hasGstin;
      if (gstin) formData.gstin = gstin;
      if (country) formData.country = country;
      if (timezone) formData.timezone = timezone;
      if (currency) formData.currency = currency;
      if (firstName) formData.firstName = firstName;
      if (lastName) formData.lastName = lastName;
      if (termsAccepted !== undefined) formData.termsAccepted = termsAccepted;
      if (contactSalutation) formData.contactSalutation = contactSalutation;
      if (contactMiddleName) formData.contactMiddleName = contactMiddleName;
      if (contactDepartment) formData.contactDepartment = contactDepartment;
      if (contactDirectPhone) formData.contactDirectPhone = contactDirectPhone;
      if (contactMobilePhone) formData.contactMobilePhone = contactMobilePhone;
      if (contactPreferredContactMethod) formData.contactPreferredContactMethod = contactPreferredContactMethod;
      if (contactAuthorityLevel) formData.contactAuthorityLevel = contactAuthorityLevel;

      const [adminUser] = await tx
        .insert(tenantUsers)
        .values({
          tenantId: tenant.tenantId,
          kindeUserId,
          email: adminEmail,
          firstName: firstName ?? null,
          lastName: lastName ?? null,
          phone: adminMobile ?? contactMobilePhone ?? contactDirectPhone ?? null,
          isActive: true,
          isVerified: true,
          isTenantAdmin: true,
          onboardingCompleted: true,
          preferences: Object.keys(formData).length > 0 ? {
            onboarding: {
              formData,
              completedAt: currentTime.toISOString(),
              onboardingType: type
            }
          } : undefined
        })
        .returning();

      // Update organization with user reference
      await tx
        .update(entities)
        .set({
          createdBy: adminUser.userId,
          updatedBy: adminUser.userId
        })
        .where(eq(entities.entityId, organization.organizationId));

      // ============================================
      // STEP 4: CREATE SUPER ADMIN ROLE
      // ============================================
      // FIXED: Import from permission-matrix.js instead of utils folder
      const { createSuperAdminRoleConfig } = await import('../../../data/permission-matrix.js');
      const roleConfig = createSuperAdminRoleConfig(selectedPlan, tenant.tenantId, adminUser.userId) as Record<string, unknown>;
      roleConfig.organizationId = tenant.tenantId;

      const [adminRole] = await tx
        .insert(customRoles)
        .values(roleConfig as any)
        .returning();

      // ============================================
      // STEP 5: ASSIGN ROLE TO ADMIN USER
      // ============================================
      const [roleAssignment] = await tx
        .insert(userRoleAssignments)
        .values({
          userId: adminUser.userId,
          roleId: adminRole.roleId,
          assignedBy: adminUser.userId,
          organizationId: tenant.tenantId
        })
        .returning();

      // ============================================
      // STEP 6: CREATE ORGANIZATION MEMBERSHIP
      // ============================================
      const { organizationMemberships } = await import('../../../db/schema/organizations/organization_memberships.js');
      const [orgMembership] = await tx
        .insert(organizationMemberships)
        .values({
          userId: adminUser.userId,
          tenantId: tenant.tenantId,
          entityId: organization.organizationId,
          entityType: 'organization',
          roleId: adminRole.roleId,
          membershipType: 'direct',
          membershipStatus: 'active',
          accessLevel: 'admin',
          isPrimary: true,
          canAccessSubEntities: true,
          createdBy: adminUser.userId,
          joinedAt: currentTime,
          createdAt: currentTime,
          updatedAt: currentTime
        })
        .returning();

      // Update tenantUsers with primary organization reference
      await tx
        .update(tenantUsers)
        .set({
          primaryOrganizationId: organization.organizationId
        })
        .where(eq(tenantUsers.userId, adminUser.userId));

      // ============================================
      // STEP 7: ASSIGN RESPONSIBLE PERSON
      // ============================================
      const { responsiblePersons } = await import('../../../db/schema/organizations/responsible_persons.js');
      const [responsiblePerson] = await tx
        .insert(responsiblePersons)
        .values({
          tenantId: tenant.tenantId,
          entityType: 'organization',
          entityId: organization.organizationId,
          userId: adminUser.userId,
          responsibilityLevel: 'primary',
          scope: {
            creditManagement: true,
            userManagement: true,
            auditAccess: true,
            configurationManagement: true,
            reportingAccess: true
          },
          autoPermissions: {
            canApproveTransfers: true,
            canPurchaseCredits: true,
            canManageUsers: true,
            canViewAllAuditLogs: true,
            canConfigureEntity: true,
            canGenerateReports: true
          },
          assignedBy: adminUser.userId,
          assignedAt: currentTime,
          assignmentReason: 'Initial assignment during onboarding - admin user is responsible for primary organization',
          isActive: true,
          isConfirmed: true,
          confirmedAt: currentTime,
          isTemporary: false,
          canDelegate: true
        })
        .returning();

      // Update organization entity with responsible person reference
      await tx
        .update(entities)
        .set({
          responsiblePersonId: adminUser.userId
        })
        .where(eq(entities.entityId, organization.organizationId));

      // ============================================
      // STEP 8: CREATE SUBSCRIPTION
      // ============================================
      let subscription;
      const trialStartDate = currentTime;
      // Free plan: 3-month trial. Paid plan: 14-day trial (5 min in dev).
      const trialDurationMs = selectedPlan === 'free'
        ? 3 * 30 * 24 * 60 * 60 * 1000
        : (process.env.NODE_ENV === 'production' ? 14 * 24 * 60 * 60 * 1000 : 5 * 60 * 1000);
      const trialEndDate = new Date(trialStartDate.getTime() + trialDurationMs);

      if (selectedPlan === 'free') {
        [subscription] = await tx
          .insert(subscriptions)
          .values({
            subscriptionId: uuidv4(),
            tenantId: tenant.tenantId,
            plan: 'free',
            status: 'active',
            yearlyPrice: '0.00',
            billingCycle: 'monthly',
            isTrialUser: true,
            trialStartedAt: trialStartDate,
            trialEndsAt: trialEndDate,
            currentPeriodStart: trialStartDate,
            currentPeriodEnd: trialEndDate,
          })
          .returning();
      } else {
        const { getPlan } = await import('../../../data/plans.js');
        const planDef = getPlan(selectedPlan);
        const annualUsd = planDef?.yearlyPrice ?? planPrice ?? 0;

        [subscription] = await tx
          .insert(subscriptions)
          .values({
            subscriptionId: uuidv4(),
            tenantId: tenant.tenantId,
            plan: selectedPlan,
            status: 'trialing',
            yearlyPrice: String(annualUsd),
            billingCycle: 'yearly',
            isTrialUser: true,
            trialStartedAt: trialStartDate,
            trialEndsAt: trialEndDate,
            currentPeriodStart: trialStartDate,
            currentPeriodEnd: trialEndDate,
          })
          .returning();
      }

      // ============================================
      // STEP 9: ALLOCATE CREDITS TO ORGANIZATION
      // ============================================
      const { PermissionMatrixUtils } = await import('../../../data/permission-matrix.js');
      const planCredits = PermissionMatrixUtils.getPlanCredits(selectedPlan);
      const actualCreditAmount = selectedPlan === 'free' ? 1000 : (planCredits.free || 1000);

      // Check if credit record exists
      const existingCredits = await tx
        .select()
        .from(credits)
        .where(and(
          eq(credits.tenantId, tenant.tenantId),
          eq(credits.entityId, organization.organizationId)
        ))
        .limit(1);

      const previousBalance = existingCredits.length > 0 ? parseFloat(existingCredits[0].availableCredits || '0') : 0;
      const newBalance = previousBalance + actualCreditAmount;

      if (existingCredits.length > 0) {
        // Update existing credit record
        await tx
          .update(credits)
          .set({
            availableCredits: newBalance.toString(),
            lastUpdatedAt: currentTime
          })
          .where(eq(credits.creditId, existingCredits[0].creditId));
      } else {
        // Create new credit record
        await tx
          .insert(credits)
          .values({
            creditId: uuidv4(),
            tenantId: tenant.tenantId,
            entityId: organization.organizationId,
            availableCredits: actualCreditAmount.toString(),
            isActive: true,
            lastUpdatedAt: currentTime
          });
      }

      // Create credit transaction record
      await tx
        .insert(creditTransactions)
        .values({
          transactionId: uuidv4(),
          tenantId: tenant.tenantId,
          entityId: organization.organizationId,
          transactionType: 'allocation',
          amount: actualCreditAmount.toString(),
          previousBalance: previousBalance.toString(),
          newBalance: newBalance.toString(),
          operationCode: 'onboarding',
          initiatedBy: null // System-initiated, no user ID
        });

      // ============================================
      // STEP 10: CONFIGURE APPLICATIONS WITH MODULES
      // ============================================
      const { PLAN_ACCESS_MATRIX } = await import('../../../data/permission-matrix.js');
      const resolvedPlan = selectedPlan ?? 'free';
      const planAccess = (PLAN_ACCESS_MATRIX as Record<string, { applications?: string[]; modules?: Record<string, unknown> }>)[resolvedPlan];

      global.logToES('info', '[onboarding] step10.plan_resolved', {
        tenantId: tenant.tenantId,
        resolvedPlan,
        planFound: !!planAccess,
        applicationsInMatrix: planAccess?.applications ?? [],
      });

      if (!planAccess) {
        throw Object.assign(new Error(`Plan ${resolvedPlan} not found in PLAN_ACCESS_MATRIX`), {
          statusCode: 500,
          code: 'PLAN_NOT_FOUND',
        });
      }

      const appCodes = planAccess.applications ?? [];
      const modulesByApp = planAccess.modules ?? {};

      if (appCodes.length === 0) {
        global.logToES('warn', '[onboarding] step10.no_apps_in_plan', {
          tenantId: tenant.tenantId,
          resolvedPlan,
        });
      }

      const { applications, organizationApplications, applicationModules } = await import('../../../db/schema/core/suite-schema.js');

      // Get application IDs from app codes
      const appRecords = await tx
        .select({ appId: applications.appId, appCode: applications.appCode })
        .from(applications)
        .where(eq(applications.status, 'active'));

      const appCodeToIdMap: Record<string, string> = {};
      appRecords.forEach(app => {
        appCodeToIdMap[app.appCode] = app.appId;
      });

      global.logToES('info', '[onboarding] step10.active_apps_in_db', {
        tenantId: tenant.tenantId,
        activeAppsInDb: Object.keys(appCodeToIdMap),
        planAppCodes: appCodes,
      });

      const normalizeAppCode = (code: string): string => {
        const codeMap: Record<string, string> = {
          'affiliateconnect': 'affiliateConnect',
          'affiliate': 'affiliateConnect',
        };
        return codeMap[code.toLowerCase()] || code;
      };

      // Calculate expiry date
      const expiryDate = new Date();
      const expiryMonths = resolvedPlan === 'enterprise' ? 24 : 12;
      expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);

      // Insert organization applications with enabled modules
      const applicationsToInsert: Array<Record<string, unknown>> = [];
      for (const appCode of appCodes) {
        const normalizedCode = normalizeAppCode(appCode as string);
        const appId = appCodeToIdMap[normalizedCode];

        if (!appId) {
          global.logToES('warn', '[onboarding] step10.app_not_in_db', {
            tenantId: tenant.tenantId,
            appCode,
            normalizedCode,
          });
          continue;
        }

        const enabledModules = modulesByApp[appCode] || [];
        let finalEnabledModules: string[] | unknown = enabledModules;

        if (enabledModules === '*') {
          const allModules = await tx
            .select({ moduleCode: applicationModules.moduleCode })
            .from(applicationModules)
            .where(eq(applicationModules.appId, appId));
          finalEnabledModules = allModules.map(m => m.moduleCode);
        }

        applicationsToInsert.push({
          id: uuidv4(),
          tenantId: tenant.tenantId,
          appId,
          subscriptionTier: resolvedPlan,
          isEnabled: true,
          enabledModules: finalEnabledModules,
          customPermissions: {},
          expiresAt: expiryDate,
        });
      }

      global.logToES('info', '[onboarding] step10.inserting_apps', {
        tenantId: tenant.tenantId,
        appsToInsert: applicationsToInsert.length,
        appCodes: applicationsToInsert.map(a => a['appId']),
      });

      if (applicationsToInsert.length > 0) {
        await tx
          .insert(organizationApplications)
          .values(applicationsToInsert);
      }

      // POST-CONDITION: Verify rows were actually committed within this transaction
      const { count: countFn } = await import('drizzle-orm');
      const [{ seededCount }] = await tx
        .select({ seededCount: countFn() })
        .from(organizationApplications)
        .where(eq(organizationApplications.tenantId, tenant.tenantId));

      global.logToES('info', '[onboarding] step10.post_condition', {
        tenantId: tenant.tenantId,
        resolvedPlan,
        expectedApps: applicationsToInsert.length,
        seededCount: Number(seededCount),
      });

      if (applicationsToInsert.length > 0 && Number(seededCount) === 0) {
        throw Object.assign(
          new Error('ONBOARDING_INTEGRITY_FAIL: organization_applications empty after seed'),
          {
            statusCode: 500,
            code: 'ONBOARDING_INTEGRITY_FAIL',
            tenantId: tenant.tenantId,
          }
        );
      }

      // Return all created records
      return {
        tenant,
        organization,
        adminUser,
        adminRole,
        roleAssignment,
        orgMembership,
        responsiblePerson,
        subscription,
        creditResult: {
          amount: actualCreditAmount,
          creditType: 'free',
          planId: selectedPlan
        },
        applicationsConfigured: applicationsToInsert.length
      };
    }, { isolationLevel: 'read committed' });

    Logger.log('info', 'general', 'createCompleteOnboardingInTransaction', 'Complete onboarding transaction committed successfully');

    // Note: consolidated tenant.onboarded (provisioning metadata + snapshot) for accounting
    // is now published inside publishAppProvisioningEvents() alongside the thin events for
    // other apps. No separate publish block needed here.

    // Clean up temporary onboarding_form_data now that the tenant is fully created.
    // Non-fatal: form data is only needed during the onboarding wizard.
    try {
      const adminKindeUserId = result.adminUser?.kindeUserId;
      if (adminKindeUserId) {
        await db.delete(onboardingFormData).where(eq(onboardingFormData.kindeUserId, adminKindeUserId));
        Logger.log('info', 'general', 'createCompleteOnboardingInTransaction', 'Cleaned up onboarding_form_data', { kindeUserId: adminKindeUserId });
      }
    } catch (cleanupErr: any) {
      Logger.log('warning', 'general', 'createCompleteOnboardingInTransaction', 'Failed to clean up onboarding_form_data (non-fatal)', { error: cleanupErr?.message });
    }

    return result;
  }

  /**
   * 🏗️ **CREATE DATABASE RECORDS** (LEGACY - DEPRECATED)
   * Use createCompleteOnboardingInTransaction instead
   * Kept for backward compatibility
   */
  static async createDatabaseRecords(params: {
    type: string;
    companyName: string;
    subdomain: string;
    adminEmail: string;
    adminName: string;
    firstName?: string;
    lastName?: string;
    termsAccepted?: boolean;
    kindeUserId: string;
    kindeOrgId: string;
    selectedPlan: string;
    gstin?: string | null;
    hasGstin?: boolean;
    companySize?: string | null;
    businessType?: string | null;
    primaryUseCase?: string | null;
    country?: string | null;
    timezone?: string | null;
    currency?: string | null;
    taxRegistered?: boolean;
    vatGstRegistered?: boolean;
    billingEmail?: string | null;
    contactJobTitle?: string | null;
    preferredContactMethod?: string | null;
    mailingAddressSameAsRegistered?: boolean;
    mailingStreet?: string | null;
    mailingCity?: string | null;
    mailingState?: string | null;
    mailingZip?: string | null;
    mailingCountry?: string | null;
    supportEmail?: string | null;
    contactSalutation?: string | null;
    contactMiddleName?: string | null;
    contactDepartment?: string | null;
    contactDirectPhone?: string | null;
    contactMobilePhone?: string | null;
    contactPreferredContactMethod?: string | null;
    contactAuthorityLevel?: string | null;
    taxRegistrationDetails?: Record<string, unknown>;
    billingStreet?: string | null;
    billingCity?: string | null;
    billingState?: string | null;
    billingZip?: string | null;
    billingCountry?: string | null;
  }, logger: OnboardingFileLogger | null = null): Promise<Record<string, unknown>> {
    const { type, companyName, subdomain, adminEmail, adminName, firstName, lastName, termsAccepted, kindeUserId, kindeOrgId, selectedPlan, gstin, hasGstin, companySize, businessType, primaryUseCase, country, timezone, currency, taxRegistered, vatGstRegistered, billingEmail, contactJobTitle, preferredContactMethod, mailingAddressSameAsRegistered, mailingStreet, mailingCity, mailingState, mailingZip, mailingCountry, billingCountry, supportEmail, contactSalutation, contactMiddleName, contactDepartment, contactDirectPhone, contactMobilePhone, contactPreferredContactMethod, contactAuthorityLevel, taxRegistrationDetails } = params;
    Logger.log('info', 'general', 'createDatabaseRecords', 'Creating database records for tenant', { companyName });

    const currentTime = new Date();

    // Use system connection for critical operations (RLS bypassed)
    const result = await systemDbConnection.transaction(async (tx) => {
      // 1. Create tenant
       const [tenant] = await tx
         .insert(tenants)
         .values({
           tenantId: uuidv4(),
           companyName,
           subdomain,
           kindeOrgId,
           adminEmail,
           legalCompanyName: companyName,
           gstin: hasGstin && gstin ? gstin.toUpperCase() : null,
           industry: businessType || null,
           organizationSize: companySize || null,
           defaultTimeZone: timezone || 'Asia/Kolkata',
           defaultCurrency: currency || 'INR',
           phone: contactDirectPhone || contactMobilePhone || null,
           onboardingCompleted: false,
           onboardedAt: currentTime,
           onboardingStartedAt: currentTime,
           firstLoginAt: currentTime,
           taxRegistered: taxRegistered || false,
           vatGstRegistered: vatGstRegistered || false,
           billingEmail: billingEmail || null,
           contactJobTitle: contactJobTitle || null,
           preferredContactMethod: preferredContactMethod || null,
           mailingAddressSameAsRegistered: mailingAddressSameAsRegistered !== undefined ? mailingAddressSameAsRegistered : true,
           mailingStreet: mailingStreet || null,
           mailingCity: mailingCity || null,
           mailingState: mailingState || null,
           mailingZip: mailingZip || null,
           mailingCountry: mailingCountry || null,
           billingStreet: null,
           billingCity: null,
           billingState: null,
           billingZip: null,
           billingCountry: billingCountry || country || null,
           supportEmail: supportEmail || null,
           contactSalutation: contactSalutation || null,
           contactMiddleName: contactMiddleName || null,
           contactDepartment: contactDepartment || null,
           contactDirectPhone: contactDirectPhone || null,
           contactMobilePhone: contactMobilePhone || null,
           contactAuthorityLevel: contactAuthorityLevel || null,
           taxRegistrationDetails: taxRegistrationDetails || {},
           settings: {}
         })
        .returning({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          subdomain: tenants.subdomain,
          kindeOrgId: tenants.kindeOrgId,
          adminEmail: tenants.adminEmail,
          onboardingCompleted: tenants.onboardingCompleted,
          onboardedAt: tenants.onboardedAt,
        });

      // Set tenant context for RLS within transaction
      await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenant.tenantId}, false)`);

      // 2. Create parent organization (root entity)
      const organizationEntityId = uuidv4();
      const [organization] = await tx
        .insert(entities)
        .values({
          entityId: organizationEntityId,
          tenantId: tenant.tenantId,
          parentEntityId: null,
          entityLevel: 1,
          hierarchyPath: organizationEntityId.toString(),
          fullHierarchyPath: companyName,
          entityName: companyName,
          description: `Root organization created during ${type} onboarding`,
          entityType: 'organization',
          isActive: true,
          contactEmail: adminEmail,
          createdBy: null,
          updatedBy: null
        })
        .returning({
          organizationId: entities.entityId,
          organizationName: entities.entityName,
        });

      // Verify root entity was created correctly
      if (!organization || !organization.organizationId) {
        throw new Error('Failed to create root organization entity');
      }

      Logger.log('info', 'general', 'createDatabaseRecords', 'Root organization entity created', { organizationId: organization.organizationId });

      // 3. Create admin user
      // Prepare form data for storage in user preferences
      const formData: Record<string, unknown> = {};

      // Store form data for any onboarding type that provides it
      if (companySize) formData.companySize = companySize;
      if (businessType) formData.businessType = businessType;
      if (hasGstin !== undefined) formData.hasGstin = hasGstin;
      if (gstin) formData.gstin = gstin;
      if (country) formData.country = country;
      if (timezone) formData.timezone = timezone;
      if (currency) formData.currency = currency;
      if (firstName) formData.firstName = firstName;
      if (lastName) formData.lastName = lastName;
      if (termsAccepted !== undefined) formData.termsAccepted = termsAccepted;

      // New contact fields
      if (contactSalutation) formData.contactSalutation = contactSalutation;
      if (contactMiddleName) formData.contactMiddleName = contactMiddleName;
      if (contactDepartment) formData.contactDepartment = contactDepartment;
      if (contactDirectPhone) formData.contactDirectPhone = contactDirectPhone;
      if (contactMobilePhone) formData.contactMobilePhone = contactMobilePhone;
      if (contactPreferredContactMethod) formData.contactPreferredContactMethod = contactPreferredContactMethod;
      if (contactAuthorityLevel) formData.contactAuthorityLevel = contactAuthorityLevel;

      const [adminUser] = await tx
        .insert(tenantUsers)
        .values({
          tenantId: tenant.tenantId,
          kindeUserId,
          email: adminEmail,
          firstName: firstName ?? null,
          lastName: lastName ?? null,
          phone: contactMobilePhone ?? contactDirectPhone ?? null,
          isActive: true,
          isVerified: true,
          isTenantAdmin: true,
          onboardingCompleted: true,
          preferences: Object.keys(formData).length > 0 ? {
            onboarding: {
              formData,
              completedAt: currentTime.toISOString(),
              onboardingType: type
            }
          } : undefined
        })
        .returning();

      // Update organization with correct user reference
      await tx
        .update(entities)
        .set({
          createdBy: adminUser.userId,
          updatedBy: adminUser.userId
        })
        .where(eq(entities.entityId, organization.organizationId));

      // 4. Create Super Admin role
      // FIXED: Import from permission-matrix.js instead of utils folder
      const { createSuperAdminRoleConfig } = await import('../../../data/permission-matrix.js');
      const roleConfig = createSuperAdminRoleConfig(selectedPlan, tenant.tenantId, adminUser.userId) as Record<string, unknown>;

      // IMPORTANT: organizationId must reference tenants.tenant_id (not entities.entity_id)
      roleConfig.organizationId = tenant.tenantId;

      const [adminRole] = await tx
        .insert(customRoles)
        .values(roleConfig as any)
        .returning();

      // 5. Assign admin role to admin user
      // IMPORTANT: userRoleAssignments.organizationId also references tenants.tenant_id (not entities.entity_id)
      const [roleAssignment] = await tx
        .insert(userRoleAssignments)
        .values({
          userId: adminUser.userId,
          roleId: adminRole.roleId,
          assignedBy: adminUser.userId,
          organizationId: tenant.tenantId // Must reference tenants.tenant_id per schema constraint
        })
        .returning();

      // 6. Create organization membership for admin user (CRITICAL FIX)
      const { organizationMemberships } = await import('../../../db/schema/organizations/organization_memberships.js');
      const [orgMembership] = await tx
        .insert(organizationMemberships)
        .values({
          userId: adminUser.userId,
          tenantId: tenant.tenantId,
          entityId: organization.organizationId, // Reference to entities table
          entityType: 'organization',
          roleId: adminRole.roleId,
          membershipType: 'direct',
          membershipStatus: 'active',
          accessLevel: 'admin',
          isPrimary: true, // This is the primary organization
          canAccessSubEntities: true,
          createdBy: adminUser.userId,
          joinedAt: currentTime,
          createdAt: currentTime,
          updatedAt: currentTime
        })
        .returning();

      // 7. Update tenantUsers with primary organization reference
      await tx
        .update(tenantUsers)
        .set({
          primaryOrganizationId: organization.organizationId
        })
        .where(eq(tenantUsers.userId, adminUser.userId));

      Logger.log('info', 'general', 'createDatabaseRecords', 'Organization membership created for admin user', { membershipId: orgMembership.membershipId });

      // 8. Assign admin as responsible person for the organization
      const { responsiblePersons } = await import('../../../db/schema/organizations/responsible_persons.js');
      const [responsiblePerson] = await tx
        .insert(responsiblePersons)
        .values({
          tenantId: tenant.tenantId,
          entityType: 'organization',
          entityId: organization.organizationId,
          userId: adminUser.userId,
          responsibilityLevel: 'primary',
          scope: {
            creditManagement: true,
            userManagement: true,
            auditAccess: true,
            configurationManagement: true,
            reportingAccess: true
          },
          autoPermissions: {
            canApproveTransfers: true,
            canPurchaseCredits: true,
            canManageUsers: true,
            canViewAllAuditLogs: true,
            canConfigureEntity: true,
            canGenerateReports: true
          },
          assignedBy: adminUser.userId,
          assignedAt: currentTime,
          assignmentReason: 'Initial assignment during onboarding - admin user is responsible for primary organization',
          isActive: true,
          isConfirmed: true,
          confirmedAt: currentTime,
          isTemporary: false,
          canDelegate: true
        })
        .returning();

      // 9. Update organization entity with responsible person reference
      await tx
        .update(entities)
        .set({
          responsiblePersonId: adminUser.userId
        })
        .where(eq(entities.entityId, organization.organizationId));

      Logger.log('info', 'general', 'createDatabaseRecords', 'Admin assigned as responsible person for organization', { assignmentId: responsiblePerson.assignmentId });

      return {
        tenant,
        organization,
        adminUser,
        adminRole,
        roleAssignment,
        orgMembership,
        responsiblePerson
      };
    });

    Logger.log('info', 'general', 'createDatabaseRecords', 'Database records created successfully');
    return result;
  }

  /**
   * 📝 **CREATE TRIAL SUBSCRIPTION**
   * Create subscription record for the tenant
   */
  static async createTrialSubscription(params: { tenantId: string; selectedPlan: string; maxUsers?: number; maxProjects?: number; planName?: string; planPrice?: number }): Promise<Record<string, unknown>> {
    const { tenantId, selectedPlan, planPrice } = params;
    Logger.log('info', 'general', 'createTrialSubscription', 'Creating trial subscription for tenant', { tenantId });

    const trialDurationMs = process.env.NODE_ENV === 'production' ? 14 * 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
    const trialStartDate = new Date();
    const trialEndDate = new Date(Date.now() + trialDurationMs);

    const { getPlan } = await import('../../../data/plans.js');
    const planDef = getPlan(selectedPlan);
    const annualUsd = planDef?.yearlyPrice ?? planPrice ?? 0;

    const subscriptionData = {
      subscriptionId: uuidv4(),
      tenantId,
      plan: selectedPlan,
      status: 'trialing',
      yearlyPrice: String(annualUsd),
      billingCycle: selectedPlan === 'free' ? 'monthly' : 'yearly',
      isTrialUser: true,
      trialStartedAt: trialStartDate,
      trialEndsAt: trialEndDate,
      currentPeriodStart: trialStartDate,
      currentPeriodEnd: trialEndDate,
    };

    const [subscription] = await systemDbConnection
      .insert(subscriptions)
      .values(subscriptionData)
      .returning();

    Logger.log('info', 'general', 'createTrialSubscription', 'Trial subscription created', { subscriptionId: subscription.subscriptionId });
    return { subscription };
  }

  /**
   * 💰 **ALLOCATE TRIAL CREDITS**
   * Allocate initial credits to the tenant
   */
  static async allocateTrialCredits(params: { tenantId: string; organizationId: string; creditAmount?: number; selectedPlan?: string }): Promise<{ amount: number; creditType: string; planId: string; creditId?: unknown }> {
    const { tenantId, organizationId, selectedPlan = 'free' } = params;
    Logger.log('info', 'general', 'allocateTrialCredits', 'Allocating initial free credits', { tenantId, selectedPlan });

    try {
      // Get plan-based credit amount instead of using parameter
      const { PermissionMatrixUtils } = await import('../../../data/permission-matrix.js');
      const planCredits = PermissionMatrixUtils.getPlanCredits(selectedPlan);
      // Free plan gets 1000 credits as per requirements
      const actualCreditAmount = selectedPlan === 'free' ? 1000 : (planCredits.free || 1000);

      Logger.log('info', 'general', 'allocateTrialCredits', 'Plan credit allocation', { selectedPlan, actualCreditAmount });

      // Use CreditService to add credits directly to the organization entity
      const creditResult = await CreditService.addCreditsToEntity({
        tenantId,
        entityType: 'organization',
        entityId: organizationId,
        creditAmount: actualCreditAmount,
        source: 'onboarding',
        sourceId: uuidv4(),
        description: `${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} plan initial free credits`,
        initiatedBy: 'system'
      });

      Logger.log('info', 'general', 'allocateTrialCredits', 'Initial free credits allocated', { actualCreditAmount });
      return {
        amount: actualCreditAmount,
        creditType: 'free',
        planId: selectedPlan,
        creditId: (creditResult as unknown as Record<string, unknown>)?.creditId
      };
    } catch (err: unknown) {
      const creditError = err as Error;
      Logger.log('error', 'general', 'allocateTrialCredits', 'Credit allocation failed', { error: creditError.message });
      // Credit allocation is now required for onboarding to succeed
      throw new Error(`Credit allocation failed: ${creditError.message}`);
    }
  }

  /**
   * 🌐 **CONFIGURE SUBDOMAIN SYSTEM**
   * Configure subdomain with system connection (bypasses RLS)
   */
  static async configureSubdomainSystem(subdomainData: Record<string, unknown>, logger: OnboardingFileLogger | null = null): Promise<Record<string, unknown>> {
    if (logger) (logger as any).info('api', 'Configuring subdomain system', {
      subdomain: subdomainData.subdomain,
      tenantId: subdomainData.tenantId
    });

    // Get system database connection
    const { systemDbConnection: sysDb } = await import('../../../db/index.js');

    // Update tenant with subdomain information
    const { tenants: tenantsTable } = await import('../../../db/schema/index.js');

    const [updatedTenant] = await sysDb
      .update(tenantsTable)
      .set({
        subdomain: subdomainData.subdomain as string,
        customDomain: (subdomainData.customDomain as string) ?? undefined,
        updatedAt: new Date()
      })
      .where(eq(tenantsTable.tenantId, subdomainData.tenantId as string))
      .returning();

    Logger.log('info', 'general', 'configureSubdomainSystem', 'Subdomain configuration completed', { subdomain: updatedTenant?.subdomain });
    return (updatedTenant ?? {}) as unknown as Record<string, unknown>;
  }
}

export default OnboardingDbService;
