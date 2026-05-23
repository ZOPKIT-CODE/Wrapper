/**
 * 🚀 **UNIFIED ONBOARDING SERVICE**
 * Single source of truth for all onboarding operations
 * Used by /onboard-frontend endpoint
 *
 * Orchestrates:
 *  - OnboardingDbService      — all database operations
 *  - OnboardingExternalService — Kinde + tracking integrations
 */

import * as Sentry from '@sentry/node';
import Logger from '../../../utils/logger.js';
import { db } from '../../../db/index.js';
import { tenants } from '../../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';

import OnboardingValidationService from './onboarding-validation-service.js';
import { OnboardingFileLogger } from '../../../utils/onboarding-file-logger.js';
import { InterAppEventService } from '../../../features/messaging/index.js';
import { BootstrapService } from '../../../features/app-sync/services/bootstrap-service.js';
import { invalidateTenantLookupCache, invalidateUserCache } from '../../../middleware/auth/auth.js';

import { OnboardingDbService } from './onboarding-db-service.js';
import { OnboardingExternalService } from './onboarding-external-service.js';

import type { ValidationResult, OnboardingError, DbOnboardingResult, OnboardingPayload } from './onboarding-types.js';

export class UnifiedOnboardingService {

  /**
   * 🚀 **MAIN ONBOARDING WORKFLOW**
   * Single entry point for both frontend and enhanced onboarding
   */
  static async completeOnboardingWorkflow(onboardingData: Record<string, unknown>, request: unknown = null): Promise<Record<string, unknown>> {
    // Initialize file logger for this onboarding session
    const sessionId = `onboarding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const logger = new OnboardingFileLogger(sessionId, {
      type: onboardingData.type || 'frontend',
      companyName: onboardingData.companyName,
      adminEmail: onboardingData.adminEmail,
      subdomain: onboardingData.subdomain,
      selectedPlan: onboardingData.selectedPlan || 'free'
    });

    const payload = onboardingData as OnboardingPayload;
    const {
      type,
      companyName,
      adminEmail,
      subdomain,
      initialCredits: _initialCredits,
      selectedPlan = 'free',
      companyType,
      companySize,
      businessType,
      primaryUseCase,
      website,
      firstName,
      lastName,
      hasGstin = false,
      gstin,
      panNumber,
      country,
      state,
      timezone,
      currency,
      defaultLanguage,
      defaultLocale,
      termsAccepted,
      taxRegistered = false,
      vatGstRegistered = false,
      billingEmail,
      adminMobile,
      supportEmail,
      contactJobTitle,
      preferredContactMethod,
      mailingAddressSameAsRegistered = true,
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
      taxRegistrationDetails = {},
      planName = 'Trial Plan',
      planPrice = 0,
      maxUsers = 2,
      maxProjects = 5,
      teamEmails: _teamEmails = []
    } = payload;

    logger.onboarding.start({
      type,
      companyName,
      adminEmail,
      subdomain,
      selectedPlan,
      timestamp: new Date().toISOString()
    });

    return await Sentry.startSpan(
      { name: 'onboarding.completeWorkflow', op: 'onboarding', attributes: { type: String(type ?? 'frontend'), plan: String(selectedPlan ?? 'free') } },
      async () => {

    try {
      // 1. VALIDATE INPUT DATA
      const validationData = type === 'frontend' ? {
        legalCompanyName: companyName,
        companySize,
        businessType,
        firstName,
        lastName,
        email: adminEmail,
        hasGstin,
        gstin,
        panNumber: panNumber || taxRegistrationDetails?.pan,
        country,
        state,
        timezone,
        currency,
        defaultLanguage,
        defaultLocale,
        termsAccepted,
        // New validation fields
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
        taxRegistrationDetails
      } : {
        companyName,
        adminEmail,
        subdomain
      };

      const validation = await Sentry.startSpan(
        { name: 'onboarding.step1.validate', op: 'onboarding.validate' },
        () => OnboardingValidationService.validateCompleteOnboarding(validationData, type ?? 'frontend')
      ) as unknown as ValidationResult;
      if (!validation.success) {
        const firstError = validation.errors?.[0];
        // Check if it's a duplicate email error
        if (firstError?.message?.includes('already associated') || firstError?.message?.includes('already registered')) {
          const duplicateError = new Error(firstError.message) as OnboardingError;
          duplicateError.name = 'DuplicateRegistrationError';
          duplicateError.errors = [{
            type: 'duplicate_email',
            message: firstError.message,
            field: 'email'
          }];
          throw duplicateError;
        }
        // Throw validation error with errors array for proper formatting
        const validationError = new Error('Validation failed') as OnboardingError;
        validationError.name = 'ValidationError';
        validationError.errors = validation.errors || [{
          field: 'unknown',
          message: firstError?.message || 'Validation failed'
        }];
        throw validationError;
      }

      const validationDataObj = validation.data as Record<string, unknown> | undefined;
      // Check if user is already onboarded (validation passed but user exists)
      if (validationDataObj?.alreadyOnboarded) {
        logger.onboarding.warning('User is already onboarded, returning redirect response', {
          tenantId: validationDataObj.tenantId,
          redirectTo: validationDataObj.redirectTo
        });
        const alreadyOnboardedError = new Error('You have already completed onboarding. Redirecting to dashboard...') as OnboardingError;
        alreadyOnboardedError.name = 'AlreadyOnboardedError';
        alreadyOnboardedError.redirectTo = (validationDataObj.redirectTo as string) || '/dashboard';
        alreadyOnboardedError.tenantId = validationDataObj.tenantId as string;
        await logger.finalize({ success: false, reason: 'already_onboarded' });
        throw alreadyOnboardedError;
      }

      // 2+3: Run subdomain generation and auth extraction in parallel (independent)
      logger.onboarding.step(2, 'SUBDOMAIN_AND_AUTH', 'Generating subdomain + validating auth in parallel');
      const [finalSubdomain, authResult] = await Promise.all([
        (async () => {
          const sd = (validationDataObj?.generatedSubdomain as string) || (subdomain as string) ||
            await OnboardingValidationService.generateUniqueSubdomain(companyName ?? '');
          logger.onboarding.success('Subdomain generated', { subdomain: sd });
          return sd;
        })(),
        Sentry.startSpan(
          { name: 'onboarding.step3.authenticate', op: 'onboarding.auth' },
          () => OnboardingExternalService.extractAndValidateAuthentication(request, logger as OnboardingFileLogger | null)
        ),
      ]);
      logger.onboarding.success('Authentication validated', { userId: authResult.user?.kindeUserId });

      // 4. SETUP KINDE ORGANIZATION AND USER (needs both subdomain + auth result)
      logger.onboarding.step(4, 'KINDE_SETUP', 'Setting up Kinde organization and user');
      const kindeResult = await Sentry.startSpan(
        { name: 'onboarding.step4.kindeSetup', op: 'onboarding.kinde' },
        () => OnboardingExternalService.setupKindeIntegration({
          companyName: companyName ?? '',
          adminEmail: adminEmail ?? '',
          firstName,
          lastName,
          subdomain: finalSubdomain,
          existingUser: authResult.user
        }, logger as OnboardingFileLogger | null)
      );

      // 5. CREATE ALL DATABASE RECORDS IN SINGLE TRANSACTION
      // This ensures atomicity - if any step fails, everything rolls back
      logger.onboarding.step(5, 'TRANSACTIONAL_DATABASE_CREATION', 'Creating all database records in single transaction');
      let dbResult: DbOnboardingResult;
      const kindeOrgIdForCleanup: string = String(kindeResult.orgCode ?? ''); // Store for potential cleanup

      try {
        dbResult = await Sentry.startSpan(
          { name: 'onboarding.step5.dbTransaction', op: 'db.transaction' },
          () => OnboardingDbService.createCompleteOnboardingInTransaction({
          type: type ?? 'frontend',
          companyName: companyName ?? '',
          subdomain: finalSubdomain,
          adminEmail: adminEmail ?? '',
          adminName: firstName && lastName ? `${firstName} ${lastName}`.trim() :
            (kindeResult.userName as string) || String(adminEmail).split('@')[0],
          firstName,
          lastName,
          termsAccepted,
          kindeUserId: kindeResult.userId as string,
          kindeOrgId: kindeResult.orgCode as string,
          selectedPlan: selectedPlan ?? 'free',
          gstin: hasGstin ? gstin ?? null : null,
          hasGstin,
          companyType: companyType ?? null,
          companySize: companySize ?? null,
          businessType: businessType ?? null,
          primaryUseCase: primaryUseCase ?? null,
          industry: businessType || null,
          website: website ?? null,
          country: country ?? null,
          state: state ?? null,
          timezone: timezone ?? null,
          currency: currency ?? null,
          defaultLanguage: defaultLanguage ?? null,
          defaultLocale: defaultLocale ?? null,
          taxRegistered,
          vatGstRegistered,
          billingEmail: billingEmail ?? null,
          adminMobile: adminMobile ?? null,
          supportEmail: supportEmail ?? null,
          contactJobTitle: contactJobTitle ?? null,
          preferredContactMethod: preferredContactMethod ?? null,
          mailingAddressSameAsRegistered,
          mailingStreet: mailingStreet ?? null,
          mailingCity: mailingCity ?? null,
          mailingState: mailingState ?? null,
          mailingZip: mailingZip ?? null,
          mailingCountry: mailingCountry ?? null,
          billingStreet: billingStreet ?? null,
          billingCity: billingCity ?? null,
          billingState: billingState ?? null,
          billingZip: billingZip ?? null,
          billingCountry: billingCountry ?? null,
          contactSalutation: contactSalutation ?? null,
          contactMiddleName: contactMiddleName ?? null,
          contactDepartment: contactDepartment ?? null,
          contactDirectPhone: contactDirectPhone ?? null,
          contactMobilePhone: contactMobilePhone ?? null,
          contactAuthorityLevel: contactAuthorityLevel ?? null,
          taxRegistrationDetails: taxRegistrationDetails ?? {},
          panNumber: panNumber ?? null,
          maxUsers,
          maxProjects,
          planName: planName ?? 'Trial Plan',
          planPrice: planPrice ?? 0
          }, logger as OnboardingFileLogger | null)
        ) as unknown as DbOnboardingResult;

        logger.onboarding.success('All database records created successfully in transaction', {
          tenantId: dbResult.tenant.tenantId,
          organizationId: dbResult.organization.organizationId,
          userId: dbResult.adminUser.userId,
          subscriptionId: dbResult.subscription?.subscriptionId,
          creditsAllocated: dbResult.creditResult?.amount
        });
      } catch (err: unknown) {
        const transactionError = err as Error;
        // Transaction failed - everything rolled back automatically
        Logger.log('error', 'general', 'completeOnboardingWorkflow', 'Transaction failed, all changes rolled back', { error: transactionError.message });

        // Store form data for retry
        const retryAuthResult = await OnboardingExternalService.extractAndValidateAuthentication(request, logger as OnboardingFileLogger | null);
        const kindeUserId = retryAuthResult.user?.kindeUserId || kindeResult.userId;

        if (kindeUserId && adminEmail) {
          await OnboardingDbService.storeOnboardingFormDataForRetry({
            kindeUserId: kindeUserId as string,
            email: adminEmail,
            formData: onboardingData,
            error: {
              message: transactionError.message,
              name: transactionError.name,
              step: 'database_transaction_failed'
            }
          });
        }

        // Note: Kinde organization was created but DB transaction failed
        // We could optionally clean up Kinde org here, but leaving it for now
        // as it doesn't cause issues and user can retry

        throw transactionError;
      }

      // 6+7. MARK ONBOARDING COMPLETE + DELETE STORED FORM DATA (parallel — independent ops)
      logger.onboarding.step(6, 'MARKING_COMPLETE', 'Marking onboarding as complete + cleaning form data in parallel');
      const kindeUserIdForCleanup = kindeResult.userId as string;
      await Promise.all([
        db
          .update(tenants)
          .set({ onboardingCompleted: true, updatedAt: new Date() })
          .where(eq(tenants.tenantId, dbResult.tenant.tenantId)),
        kindeUserIdForCleanup && adminEmail
          ? OnboardingDbService.deleteStoredOnboardingFormData(kindeUserIdForCleanup, adminEmail as string).catch(
              (err: unknown) => Logger.log('warning', 'general', 'completeOnboardingWorkflow', 'Failed to delete stored form data (non-critical)', { error: (err as Error).message })
            )
          : Promise.resolve(),
      ]);
      logger.onboarding.success('Onboarding marked as complete in database');

      // Bust auth middleware caches AFTER onboardingCompleted is written to DB, so
      // the very next authenticated request re-reads tenant_users and sees
      // onboardingCompleted=true and the correct tenantId — not a stale null entry
      // from pre-onboarding page loads.
      await invalidateTenantLookupCache(kindeResult.orgCode as string);
      await invalidateUserCache(kindeResult.userId as string);
      Logger.log('info', 'general', 'completeOnboardingWorkflow', 'Cache busted after onboarding', { kindeUserId: kindeResult.userId, orgCode: kindeResult.orgCode, tenantId: dbResult.tenant.tenantId });

      // 8. POST-ONBOARDING ASYNC WORK (fire-and-forget — does NOT block the response)
      // All of these are non-critical: failures are logged but never surfaced to the user.
      void Promise.resolve().then(async () => {
        // Track onboarding completion metrics
        await OnboardingExternalService.trackOnboardingCompletion({
          tenantId: dbResult.tenant.tenantId,
          type: type ?? 'frontend',
          companyName: companyName ?? '',
          adminEmail: adminEmail ?? '',
          subdomain: finalSubdomain,
          selectedPlan: selectedPlan ?? 'free',
          creditAmount: dbResult.creditResult.amount
        }).catch((err: unknown) => Logger.log('warning', 'general', 'completeOnboardingWorkflow', 'trackOnboardingCompletion failed (non-fatal)', { error: (err as Error).message }));

        // Welcome notification for the admin user
        const { notifications: notificationsTable } = await import('../../../db/schema/notifications/notifications.js');
        await db.insert(notificationsTable).values({
          tenantId: dbResult.tenant.tenantId,
          targetUserId: dbResult.adminUser.userId,
          type: 'welcome',
          title: 'Welcome to the platform!',
          message: `Your workspace "${companyName ?? 'your organisation'}" is ready. Start by exploring the dashboard.`,
        }).catch((err: unknown) => Logger.log('warning', 'general', 'completeOnboardingWorkflow', 'Welcome notification failed (non-fatal)', { error: (err as Error).message }));
      }).catch((err: unknown) => Logger.log('error', 'general', 'completeOnboardingWorkflow', 'Post-onboarding async block failed', { error: (err as Error).message }));

      logger.onboarding.success(`Unified ${type} onboarding completed successfully`, {
        tenantId: dbResult.tenant.tenantId,
        organizationId: dbResult.organization.organizationId,
        userId: dbResult.adminUser.userId,
        verified: true
      });

      // ── Seed default CRM roles before publishing the bootstrap snapshot ──
      // Roles must exist in customRoles before publishAppProvisioningEvents assembles
      // the bootstrap snapshot — otherwise the CRM receives an empty roles array.
      try {
        const { seedDefaultCrmRoles } = await import('../../roles/services/seed-default-roles.js');
        await seedDefaultCrmRoles(dbResult.tenant.tenantId, dbResult.adminUser.userId);
      } catch (err: unknown) {
        // Non-fatal — tenant still onboards successfully without default roles
        Logger.log('warning', 'general', 'completeOnboardingWorkflow', 'seedDefaultCrmRoles failed (non-fatal)', { error: (err as Error).message });
      }

      // ── Publish thin per-app provisioning events (replaces one fat snapshot event) ──
      // One event per enabled app, routed to that app's MQ queue only.
      // Each app receives a lightweight "you now have this tenant" signal.
      // No snapshot data is embedded — apps bootstrap lazily on first user login.
      // This is fire-and-forget: onboarding is already complete by this point.
      void this.publishAppProvisioningEvents(
        dbResult.tenant.tenantId,
        dbResult.adminUser.userId,
        selectedPlan ?? 'free',
        (primaryUseCase as string | undefined) ?? undefined,
      ).catch((err: unknown) => {
        // Non-fatal: if MQ is down, apps will discover the tenant on first login.
        Logger.log('warning', 'general', 'completeOnboardingWorkflow', 'Failed to publish app provisioning events (non-fatal)', { error: (err as Error).message });
      });

      // Finalize logger with success
      const logResult = await logger.finalize({
        success: true,
        verified: true,
        tenantId: dbResult.tenant.tenantId,
        organizationId: dbResult.organization.organizationId,
        userId: dbResult.adminUser.userId,
      });

      return {
        success: true,
        verified: true,
        tenant: dbResult.tenant,
        adminUser: dbResult.adminUser,
        organization: dbResult.organization,
        adminRole: dbResult.adminRole,
        subscription: dbResult.subscription,
        redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard`,
        logFile: logResult.logFile,
        onboardingType: type,
        creditAllocated: dbResult.creditResult.amount,
      };

    } catch (err: unknown) {
      const error = err as Error;
      logger.onboarding.error(`Unified ${type} onboarding failed`, error, {
        companyName,
        adminEmail,
        type
      });

      // Store form data for retry if we got past validation
      try {
        const authResult = await OnboardingExternalService.extractAndValidateAuthentication(request, logger as OnboardingFileLogger | null);
        const kindeUserId = authResult.user?.kindeUserId || null;

        if (kindeUserId && adminEmail) {
          await OnboardingDbService.storeOnboardingFormDataForRetry({
            kindeUserId,
            email: adminEmail as string,
            formData: onboardingData,
            error: {
              message: error.message,
              name: error.name,
              step: 'onboarding_failed'
            }
          });
        }
      } catch (storeErr: unknown) {
        const storeError = storeErr as Error;
        Logger.log('error', 'general', 'completeOnboardingWorkflow', 'Failed to store form data for retry', { error: storeError.message });
        // Don't fail on storage error
      }

      // Finalize logger with error
      await logger.finalize({
        success: false,
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack
        }
      });

      throw error;
    }

    }); // end Sentry.startSpan
  }

  /**
   * publishAppProvisioningEvents
   *
   * Publishes provisioning events after onboarding completes:
   *
   *  - ALL enabled apps: one `tenant.onboarded` event per app containing the
   *    full bootstrap snapshot (tenant, orgs, users, roles, assignments, credits)
   *    assembled with that app's appCode so role/credit scoping is correct.
   *    No lazy bootstrap pull required on first login for any app.
   *
   * Called after onboarding verification passes. Non-fatal if MQ is down.
   */
  private static async publishAppProvisioningEvents(
    tenantId: string,
    publishedBy: string,
    plan: string,
    primaryUseCase?: string,
  ): Promise<void> {
    // Fetch which apps this tenant has enabled
    const { organizationApplications, applications } = await import('../../../db/schema/index.js');

    const enabledApps = await db
      .select({
        appCode:          applications.appCode,
        subscriptionTier: organizationApplications.subscriptionTier,
        enabledModules:   organizationApplications.enabledModules,
        expiresAt:        organizationApplications.expiresAt,
      })
      .from(organizationApplications)
      .innerJoin(applications, eq(applications.appId, organizationApplications.appId))
      .where(and(
        eq(organizationApplications.tenantId, tenantId),
        eq(organizationApplications.isEnabled, true),
        eq(applications.status, 'active'),
      ));

    if (!enabledApps.length) {
      // Tenant has no app assignments — publish a broadcast so all apps can
      // decide whether to self-register via their own entitlement query.
      Logger.log('info', 'general', 'publishAppProvisioningEvents', 'No organization_applications rows for tenant, skipping per-app events', { tenantId });
      return;
    }

    Logger.log('info', 'general', 'publishAppProvisioningEvents', 'Publishing provisioning events', { appCount: enabledApps.length, tenantId });

    // ── All apps: full tenant.onboarded with per-app bootstrap snapshot ──
    // Each app gets its own snapshot (assembled with its appCode so roles,
    // creditConfigs, and entityCredits are scoped correctly). tenant.app.provisioned
    // is dropped — no app needs a lazy-bootstrap hint when it already has the snapshot.
    const results = await Promise.allSettled(
      enabledApps.map(async (app) => {
        const bootstrapService = new BootstrapService();
        const bootstrapPayload = await bootstrapService.assemble(tenantId, app.appCode);

        await InterAppEventService.publishEvent({
          eventType:         'tenant.onboarded',
          sourceApplication: 'wrapper',
          targetApplication: app.appCode,
          tenantId,
          entityId:          tenantId,
          publishedBy,
          eventData: {
            appCode:          app.appCode,
            tenantId,
            plan,
            applications:     enabledApps.map(a => a.appCode),
            subscriptionTier: app.subscriptionTier ?? null,
            enabledModules:   Array.isArray(app.enabledModules) ? app.enabledModules : [],
            expiresAt:        app.expiresAt ? new Date(app.expiresAt).toISOString() : null,
            tenantName:       bootstrapPayload.tenant?.tenantName ?? '',
            adminEmail:       bootstrapPayload.users?.find((u) => u.isTenantAdmin)?.email ?? null,
            kindeOrgId:       bootstrapPayload.tenant?.kindeOrgId ?? null,
            snapshot: {
              tenant:              bootstrapPayload.tenant,
              organizations:       bootstrapPayload.organizations,
              users:               bootstrapPayload.users,
              roles:               bootstrapPayload.roles,
              employeeAssignments: bootstrapPayload.employeeAssignments,
              roleAssignments:     bootstrapPayload.roleAssignments,
              creditConfigs:       bootstrapPayload.creditConfigs,
              entityCredits:       bootstrapPayload.entityCredits,
              // onboardingProfile carries industry (from tenant record) + user-selected primaryUseCase
              onboardingProfile: primaryUseCase ? { primaryUseCase } : undefined,
            },
          },
        });
        Logger.log('info', 'general', 'publishAppProvisioningEvents', 'Published tenant.onboarded event', { appCode: app.appCode, tenantId });
      })
    );

    for (const [i, result] of results.entries()) {
      if (result.status === 'rejected') {
        const appCode = enabledApps[i]?.appCode ?? 'unknown';
        Logger.log('warning', 'general', 'publishAppProvisioningEvents', 'Failed to publish tenant.onboarded event', { appCode, error: (result.reason as Error).message });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Delegate methods — kept on UnifiedOnboardingService so existing callers
  // (routes, tests) don't break. They simply forward to the focused modules.
  // ─────────────────────────────────────────────────────────────────────────

  static async storeOnboardingFormDataForRetry(params: { kindeUserId: string; email: string; formData: Record<string, unknown>; error: Record<string, unknown> }): Promise<void> {
    return OnboardingDbService.storeOnboardingFormDataForRetry(params);
  }

  static async getStoredOnboardingFormData(kindeUserId: string, email: string): Promise<Record<string, unknown> | null> {
    return OnboardingDbService.getStoredOnboardingFormData(kindeUserId, email);
  }

  static async deleteStoredOnboardingFormData(kindeUserId: string, email: string): Promise<void> {
    return OnboardingDbService.deleteStoredOnboardingFormData(kindeUserId, email);
  }

  static async extractAndValidateAuthentication(request: unknown, logger: OnboardingFileLogger | null = null): Promise<{ authenticated: boolean; user: { kindeUserId: string; email?: string; name?: string } | null }> {
    return OnboardingExternalService.extractAndValidateAuthentication(request, logger);
  }

  static async setupKindeIntegration(params: { companyName: string; adminEmail: string; firstName?: string; lastName?: string; subdomain: string; existingUser?: { kindeUserId?: string; name?: string; email?: string } | null }, logger: OnboardingFileLogger | null = null): Promise<Record<string, unknown>> {
    return OnboardingExternalService.setupKindeIntegration(params, logger);
  }

  static async createCompleteOnboardingInTransaction(params: Parameters<typeof OnboardingDbService.createCompleteOnboardingInTransaction>[0], logger: OnboardingFileLogger | null = null): Promise<Record<string, unknown>> {
    return OnboardingDbService.createCompleteOnboardingInTransaction(params, logger);
  }

  static async createDatabaseRecords(params: Parameters<typeof OnboardingDbService.createDatabaseRecords>[0], logger: OnboardingFileLogger | null = null): Promise<Record<string, unknown>> {
    return OnboardingDbService.createDatabaseRecords(params, logger);
  }

  static async createTrialSubscription(params: { tenantId: string; selectedPlan: string; maxUsers?: number; maxProjects?: number; planName?: string; planPrice?: number }): Promise<Record<string, unknown>> {
    return OnboardingDbService.createTrialSubscription(params);
  }

  static async allocateTrialCredits(params: { tenantId: string; organizationId: string; creditAmount?: number; selectedPlan?: string }): Promise<{ amount: number; creditType: string; planId: string; creditId?: unknown }> {
    return OnboardingDbService.allocateTrialCredits(params);
  }

  static async configureSubdomainSystem(subdomainData: Record<string, unknown>, logger: OnboardingFileLogger | null = null): Promise<Record<string, unknown>> {
    return OnboardingDbService.configureSubdomainSystem(subdomainData, logger);
  }

  static async trackOnboardingCompletion(params: { tenantId: string; type: string; companyName: string; adminEmail: string; subdomain: string; selectedPlan: string; creditAmount: number }): Promise<void> {
    return OnboardingExternalService.trackOnboardingCompletion(params);
  }
}

export default UnifiedOnboardingService;
