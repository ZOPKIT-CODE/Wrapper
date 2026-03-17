/**
 * 🚀 **UNIFIED ONBOARDING SERVICE**
 * Single source of truth for all onboarding operations
 * Used by /onboard-frontend endpoint
 */

import { db, systemDbConnection } from '../../../db/index.js';
import { tenants, tenantUsers, customRoles, userRoleAssignments, subscriptions, entities, onboardingEvents, onboardingFormData, credits, creditTransactions } from '../../../db/schema/index.js';
import { eq, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Import existing services

import { kindeService } from '../../../features/auth/index.js';
import { CreditService } from '../../../features/credits/index.js';
import { SubscriptionService } from '../../../features/subscriptions/index.js';
import OnboardingValidationService from './onboarding-validation-service.js';
import { OnboardingFileLogger } from '../../../utils/onboarding-file-logger.js';
import { InterAppEventService } from '../../../features/messaging/index.js';

/** Validation result with optional errors and data */
interface ValidationResult {
  success: boolean;
  errors?: Array<{ message?: string; field?: string }>;
  data?: Record<string, unknown> & { alreadyOnboarded?: boolean; tenantId?: string; redirectTo?: string; generatedSubdomain?: string };
}

/** Extended Error with optional onboarding fields */
interface OnboardingError extends Error {
  errors?: Array<{ type?: string; message?: string; field?: string }>;
  redirectTo?: string;
  tenantId?: string;
}

/** Result of createCompleteOnboardingInTransaction */
interface DbOnboardingResult {
  tenant: { tenantId: string; companyName?: string; subdomain?: string; kindeOrgId?: string; adminEmail?: string; onboardingCompleted?: boolean; onboardedAt?: Date; trialStartedAt?: Date };
  organization: { organizationId: string; organizationName?: string; organizationCode?: string };
  adminUser: { userId: string };
  adminRole?: Record<string, unknown>;
  roleAssignment?: Record<string, unknown>;
  orgMembership?: Record<string, unknown>;
  responsiblePerson?: Record<string, unknown>;
  subscription?: { subscriptionId?: string };
  creditResult: { amount: number };
}

/** Onboarding payload from frontend/enhanced flow */
interface OnboardingPayload {
  type?: string;
  companyName?: string;
  adminEmail?: string;
  subdomain?: string;
  selectedPlan?: string;
  companyType?: string;
  companySize?: string;
  businessType?: string;
  website?: string;
  firstName?: string;
  lastName?: string;
  hasGstin?: boolean;
  gstin?: string;
  panNumber?: string;
  country?: string;
  state?: string;
  timezone?: string;
  currency?: string;
  defaultLanguage?: string;
  defaultLocale?: string;
  termsAccepted?: boolean;
  taxRegistered?: boolean;
  vatGstRegistered?: boolean;
  billingEmail?: string;
  adminMobile?: string;
  supportEmail?: string;
  contactJobTitle?: string;
  preferredContactMethod?: string;
  mailingAddressSameAsRegistered?: boolean;
  mailingStreet?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  mailingCountry?: string;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  billingCountry?: string;
  contactSalutation?: string;
  contactMiddleName?: string;
  contactDepartment?: string;
  contactDirectPhone?: string;
  contactMobilePhone?: string;
  contactPreferredContactMethod?: string;
  contactAuthorityLevel?: string;
  taxRegistrationDetails?: Record<string, unknown>;
  planName?: string;
  planPrice?: number;
  maxUsers?: number;
  maxProjects?: number;
  teamEmails?: string[];
  initialCredits?: number;
}

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

      const validation = await OnboardingValidationService.validateCompleteOnboarding(validationData, type ?? 'frontend') as unknown as ValidationResult;
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

      // 2. GENERATE/CONfirm SUBDOMAIN
      logger.onboarding.step(2, 'SUBDOMAIN_GENERATION', 'Generating/confirming subdomain');
      const finalSubdomain = (validationDataObj?.generatedSubdomain as string) || (subdomain as string) ||
        await OnboardingValidationService.generateUniqueSubdomain(companyName ?? '');
      logger.onboarding.success('Subdomain generated', { subdomain: finalSubdomain });

      // 3. EXTRACT AND VALIDATE AUTHENTICATION (if request provided)
      logger.onboarding.step(3, 'AUTHENTICATION', 'Extracting and validating authentication');
      const authResult = await this.extractAndValidateAuthentication(request, logger as OnboardingFileLogger | null);
      logger.onboarding.success('Authentication validated', { userId: authResult.user?.kindeUserId });

      // 4. SETUP KINDE ORGANIZATION AND USER
      logger.onboarding.step(4, 'KINDE_SETUP', 'Setting up Kinde organization and user');
      const kindeResult = await this.setupKindeIntegration({
        companyName: companyName ?? '',
        adminEmail: adminEmail ?? '',
        firstName,
        lastName,
        subdomain: finalSubdomain,
        existingUser: authResult.user
      }, logger as OnboardingFileLogger | null);

      // 5. CREATE ALL DATABASE RECORDS IN SINGLE TRANSACTION
      // This ensures atomicity - if any step fails, everything rolls back
      logger.onboarding.step(5, 'TRANSACTIONAL_DATABASE_CREATION', 'Creating all database records in single transaction');
      let dbResult: DbOnboardingResult;
      const kindeOrgIdForCleanup: string = String(kindeResult.orgCode ?? ''); // Store for potential cleanup
      
      try {
        dbResult = await this.createCompleteOnboardingInTransaction({
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
          contactPreferredContactMethod: contactPreferredContactMethod ?? null,
          contactAuthorityLevel: contactAuthorityLevel ?? null,
          taxRegistrationDetails: taxRegistrationDetails ?? {},
          panNumber: panNumber ?? null,
          maxUsers,
          maxProjects,
          planName: planName ?? 'Trial Plan',
          planPrice: planPrice ?? 0
        }, logger as OnboardingFileLogger | null) as unknown as DbOnboardingResult;

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
        console.error('❌ Transaction failed, all changes rolled back:', transactionError);
        
        // Store form data for retry
      const authResult = await this.extractAndValidateAuthentication(request, logger as OnboardingFileLogger | null);
      const kindeUserId = authResult.user?.kindeUserId || kindeResult.userId;
      
      if (kindeUserId && adminEmail) {
        await this.storeOnboardingFormDataForRetry({
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

      // 6. VERIFY ONBOARDING COMPLETION (CRITICAL STEP)
      logger.onboarding.step(6, 'VERIFICATION', 'Verifying all onboarding steps completed successfully');
      const { OnboardingVerificationService } = await import('./onboarding-verification-service.js');
      const verificationResult = await OnboardingVerificationService.verifyOnboardingCompletion(
        dbResult.tenant.tenantId,
        logger as any
      );

      const details = verificationResult.details as Record<string, unknown> | undefined;
      if (!verificationResult.verified) {
        const criticalIssues = (verificationResult.criticalIssues || []) as Array<{ step?: string; issue?: string }>;
        const missingItems = (details?.missingItems as string[] | undefined) || [];
        
        logger.onboarding.error('Onboarding verification failed', null, {
          criticalIssues: criticalIssues.map((i: { step?: string; issue?: string }) => `${i.step}: ${i.issue}`),
          missingItems
        });

        // Attempt to fix issues automatically
        const fixResult = await OnboardingVerificationService.autoFixOnboardingIssues(
          dbResult.tenant.tenantId,
          verificationResult,
          logger as any
        );

        if (!fixResult.success) {
          // If auto-fix fails, throw error with details
          const errorMessage = `Onboarding incomplete. Missing: ${missingItems.join(', ')}. Issues: ${criticalIssues.map(i => i.issue).join('; ')}`;
          throw new Error(errorMessage);
        }

        // Re-verify after auto-fix
        const reVerificationResult = await OnboardingVerificationService.verifyOnboardingCompletion(
          dbResult.tenant.tenantId,
          logger as any
        );

        const reDetails = reVerificationResult.details as Record<string, unknown> | undefined;
        if (!reVerificationResult.verified) {
          const reMissingItems = (reDetails?.missingItems as string[] | undefined) || [];
          const reCriticalIssues = (reVerificationResult.criticalIssues || []) as Array<{ step?: string; issue?: string }>;
          const missingItemsStr = reMissingItems.length > 0 
            ? reMissingItems.join(', ') 
            : reCriticalIssues.map((i: { step?: string; issue?: string }) => `${i.step}: ${i.issue}`).join('; ') || 'Unknown verification issues';
          const errorMessage = `Onboarding verification failed after auto-fix. Missing: ${missingItemsStr}`;
          throw new Error(errorMessage);
        }
      }

      const appAssignments = (details?.applicationAssignments as unknown[]) || [];
      logger.onboarding.success('Onboarding verification passed - all components verified', {
        applicationAssignments: appAssignments.length
      });

      // 7. MARK ONBOARDING AS COMPLETE IN DATABASE (only after verification passes)
      logger.onboarding.step(7, 'MARKING_COMPLETE', 'Marking onboarding as complete in database');
      await db
        .update(tenants)
        .set({
          onboardingCompleted: true,
          updatedAt: new Date()
        })
        .where(eq(tenants.tenantId, dbResult.tenant.tenantId));
      
      logger.onboarding.success('Onboarding marked as complete in database');

      // 8. DELETE STORED FORM DATA (if exists) since onboarding succeeded
      try {
        const authResult = await this.extractAndValidateAuthentication(request, logger as OnboardingFileLogger | null);
        const kindeUserId = authResult.user?.kindeUserId || kindeResult.userId;
        if (kindeUserId && adminEmail) {
          await this.deleteStoredOnboardingFormData(kindeUserId as string, adminEmail as string);
        }
      } catch (err: unknown) {
        const deleteError = err as Error;
        console.warn('⚠️ Failed to delete stored form data (non-critical):', deleteError.message);
      }

      // 8. TRACK ONBOARDING COMPLETION
      logger.onboarding.step(8, 'TRACKING', 'Tracking onboarding completion');
      await this.trackOnboardingCompletion({
        tenantId: dbResult.tenant.tenantId,
        type: type ?? 'frontend',
        companyName: companyName ?? '',
        adminEmail: adminEmail ?? '',
        subdomain: finalSubdomain,
        selectedPlan: selectedPlan ?? 'free',
        creditAmount: dbResult.creditResult.amount
      });

      logger.onboarding.success(`Unified ${type} onboarding completed successfully`, {
        tenantId: dbResult.tenant.tenantId,
        organizationId: dbResult.organization.organizationId,
        userId: dbResult.adminUser.userId,
        verified: true
      });

      // ── Publish thin per-app provisioning events (replaces one fat snapshot event) ──
      // One event per enabled app, routed to that app's MQ queue only.
      // Each app receives a lightweight "you now have this tenant" signal.
      // No snapshot data is embedded — apps bootstrap lazily on first user login.
      // This is fire-and-forget: onboarding is already complete by this point.
      void this.publishAppProvisioningEvents(
        dbResult.tenant.tenantId,
        dbResult.adminUser.userId,
        selectedPlan ?? 'free',
      ).catch((err: unknown) => {
        // Non-fatal: if MQ is down, apps will discover the tenant on first login.
        console.warn('⚠️ [Onboarding] Failed to publish app provisioning events (non-fatal):', (err as Error).message);
      });

      // Finalize logger with success
      const logResult = await logger.finalize({
        success: true,
        verified: true,
        tenantId: dbResult.tenant.tenantId,
        organizationId: dbResult.organization.organizationId,
        userId: dbResult.adminUser.userId,
        verificationDetails: {
          applicationAssignments: appAssignments.length
        }
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
        logFile: logResult.logFile, // Include log file path in response
        onboardingType: type,
        creditAllocated: dbResult.creditResult.amount,
        verification: {
          verified: true,
          applicationAssignments: appAssignments.length
        }
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
        const authResult = await this.extractAndValidateAuthentication(request, logger as OnboardingFileLogger | null);
        const kindeUserId = authResult.user?.kindeUserId || null;
        
        if (kindeUserId && adminEmail) {
          await this.storeOnboardingFormDataForRetry({
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
        console.error('⚠️ Failed to store form data for retry:', storeError.message);
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
  }

  /**
   * publishAppProvisioningEvents
   *
   * Publishes ONE thin `tenant.app.provisioned` event per app the tenant has
   * access to, based on organization_applications rows.
   *
   * Why thin events instead of one fat snapshot:
   *  - SRP: each event carries only provisioning metadata, not domain data
   *  - Routing: each event is routed with key `<appCode>.tenant.app.provisioned`
   *    so only the target app's queue receives it
   *  - Loose coupling: apps bootstrap lazily on first login — Wrapper never
   *    needs to know which data each app wants
   *  - Fault isolation: if one app's event fails to publish, others still succeed
   *  - Idempotency: receiving the event twice is safe (DB upsert with NO CONFLICT)
   *
   * Called after onboarding verification passes. Non-fatal if MQ is down.
   */
  private static async publishAppProvisioningEvents(
    tenantId: string,
    publishedBy: string,
    plan: string,
  ): Promise<void> {
    // Fetch which apps this tenant has enabled
    const { organizationApplications, applications } = await import('../../../db/schema/index.js');
    const { eq, and } = await import('drizzle-orm');

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
      console.log(`[Onboarding] No organization_applications rows for tenant ${tenantId} — skipping per-app events`);
      return;
    }

    console.log(`[Onboarding] Publishing ${enabledApps.length} app provisioning events for tenant ${tenantId}`);

    // Publish concurrently — independent events per app
    const results = await Promise.allSettled(
      enabledApps.map(async (app) => {
        await InterAppEventService.publishEvent({
          eventType:         'tenant.app.provisioned',
          sourceApplication: 'wrapper',
          // Route to specific app's queue: e.g. 'accounting.tenant.app.provisioned'
          targetApplication: app.appCode,
          tenantId,
          entityId:          tenantId,
          publishedBy,
          eventData: {
            // Thin payload — NO domain data embedded
            appCode:          app.appCode,
            tenantId,
            plan,
            subscriptionTier: app.subscriptionTier ?? null,
            enabledModules:   Array.isArray(app.enabledModules) ? app.enabledModules : [],
            expiresAt:        app.expiresAt ? new Date(app.expiresAt).toISOString() : null,
            onboardedAt:      new Date().toISOString(),
            // Signal: "pull your data when you're ready, via POST /bootstrap"
            bootstrapHint:    'lazy — call POST /api/sync/tenants/:id/bootstrap on first user login',
          },
        });
        console.log(`  ✅ Published tenant.app.provisioned → ${app.appCode} (tenant: ${tenantId})`);
      })
    );

    // Log any failures without throwing — onboarding already succeeded
    for (const [i, result] of results.entries()) {
      if (result.status === 'rejected') {
        const appCode = enabledApps[i]?.appCode ?? 'unknown';
        console.warn(`  ⚠️ Failed to publish tenant.app.provisioned → ${appCode}:`, (result.reason as Error).message);
      }
    }
  }

  /**
   * 💾 **STORE ONBOARDING FORM DATA FOR RETRY**
   * Stores form data when onboarding fails so user can retry
   */
  static async storeOnboardingFormDataForRetry(params: { kindeUserId: string; email: string; formData: Record<string, unknown>; error: Record<string, unknown> }): Promise<void> {
    const { kindeUserId, email, formData, error } = params;
    try {
      console.log('💾 Storing onboarding form data for retry:', { kindeUserId, email });

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
        console.log('✅ Updated existing onboarding form data for retry');
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
        console.log('✅ Stored onboarding form data for retry');
      }
    } catch (err: unknown) {
      const storeError = err as Error;
      console.error('❌ Failed to store onboarding form data:', storeError);
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
      console.error('❌ Failed to get stored onboarding form data:', error);
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
      console.log('✅ Deleted stored onboarding form data');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to delete stored onboarding form data:', error);
      throw error;
    }
  }

  /**
   * 🔐 **EXTRACT AND VALIDATE AUTHENTICATION**
   * Centralized authentication handling
   */
  static async extractAndValidateAuthentication(request: unknown, logger: OnboardingFileLogger | null = null): Promise<{ authenticated: boolean; user: { kindeUserId: string; email?: string; name?: string } | null }> {
    if (!request) {
      return { authenticated: false, user: null };
    }

    try {
      // Extract token from request headers
      const req = request as { headers?: { authorization?: string } };
      const authHeader = req.headers?.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authenticated: false, user: null };
      }

      const token = authHeader.substring(7);
      if (!token || token.trim() === '' || token.length < 10) {
        return { authenticated: false, user: null };
      }

      // Validate token with Kinde
      const user = await kindeService.validateToken(token);

      const u = user as Record<string, unknown>;
      return {
        authenticated: true,
        user: {
          kindeUserId: (u.kindeUserId || u.userId) as string,
          email: u.email as string | undefined,
          name: (u.name || u.given_name) as string | undefined
        }
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.log('⚠️ Authentication validation failed:', error.message);
      return { authenticated: false, user: null };
    }
  }

  /**
   * 🏢 **SETUP KINDE INTEGRATION**
   * Create organization and user in Kinde
   */
  static async setupKindeIntegration(params: { companyName: string; adminEmail: string; firstName?: string; lastName?: string; subdomain: string; existingUser?: { kindeUserId?: string; name?: string; email?: string } | null }, logger: OnboardingFileLogger | null = null): Promise<Record<string, unknown>> {
    const { companyName, adminEmail, firstName, lastName, subdomain, existingUser } = params;
    if (logger) (logger as any).kinde.start('Setting up Kinde integration', { companyName, adminEmail });

    // Create Kinde organization with fallback
    let kindeOrg: Record<string, unknown>;
    let actualOrgCode: string;
    let orgCreatedWithFallback = false;
    const externalId = `tenant_${uuidv4()}`;

    try {
      if (logger) logger.kinde.start('Creating Kinde organization', { companyName, externalId });
      
      kindeOrg = await kindeService.createOrganization({
        name: companyName,
        external_id: externalId,
        feature_flags: {
          theme: {
            button_text_color: '#ffffff'
          }
        }
      });

      // Store the actual Kinde organization code and external_id
      const kindeOrgObj = kindeOrg as Record<string, unknown> & { organization?: { code?: string; external_id?: string }; code?: string };
      actualOrgCode = (kindeOrgObj?.organization?.code || kindeOrgObj?.code || '') as string;
      const kindeExternalId = (kindeOrgObj?.organization?.external_id || externalId) as string;
      
      if (!actualOrgCode) {
        if (logger) (logger as any).kinde.error('Kinde response missing organization code', null, { kindeOrg });
        throw new Error('Failed to get organization code from Kinde response');
      }

      if (logger) (logger as any).kinde.success('Kinde organization created', { 
        orgCode: actualOrgCode,
        externalId: kindeExternalId 
      });
    } catch (err: unknown) {
      const kindeError = err as Error & { response?: { status?: number; data?: unknown }; code?: string };
      if (logger) (logger as any).kinde.error('Kinde organization creation failed', kindeError, {
        status: kindeError.response?.status,
        data: kindeError.response?.data
      });
      
      // Use fallback organization code
      actualOrgCode = `org_${subdomain}_${Date.now()}`;
      orgCreatedWithFallback = true;
      kindeOrg = {
        organization: { code: actualOrgCode, name: companyName, external_id: externalId as string },
        created_with_fallback: true
      };
      if (logger) (logger as any).kinde.warning('Using fallback organization code', { orgCode: actualOrgCode });
    }

    // Handle user creation/assignment
    let finalKindeUserId;
    let userName;

    if (existingUser) {
      // Use existing authenticated user and add them to the new organization
      finalKindeUserId = existingUser.kindeUserId as string;
      userName = existingUser.name || (existingUser.email && String(existingUser.email).split('@')[0]) || '';
      console.log('✅ Using authenticated user:', finalKindeUserId);

      // Add the existing user to the newly created organization
      try {
        console.log(`🔗 Adding existing user ${finalKindeUserId} to organization ${actualOrgCode}`);
        
        // Only try to add if organization was actually created in Kinde (not fallback)
        if (!orgCreatedWithFallback) {
          const addResult = await kindeService.addUserToOrganization(finalKindeUserId, actualOrgCode, {
            role_code: 'admin', // Give admin role in the organization
            is_admin: true,
            exclusive: true // Remove from other organizations first
          });

          if (addResult?.success) {
            console.log('✅ User successfully added to Kinde organization');
          } else {
            // Non-fatal: the user is already a member of the org via Kinde's
            // createOrganization flow (is_admin:true). The role assignment is
            // supplementary — failure here does NOT block onboarding.
            // FIX: Create a role with key "admin" in your Kinde dashboard
            //      (auth.zopkit.com → Roles) to silence this warning.
            console.warn(
              '⚠️ [Kinde] Role assignment for the new org admin failed (non-fatal). ' +
              'The user is already an org member. ' +
              'To resolve: create a role with key "admin" in your Kinde dashboard → Roles.'
            );
          }
        } else {
          console.log('ℹ️ Skipping Kinde user addition (organization created with fallback)');
        }
      } catch (err: unknown) {
        // Non-fatal: user is already provisioned in Kinde via org creation.
        // Role assignment is best-effort; failure must not abort onboarding.
        const addUserError = err as Error & { response?: { status?: number } };
        console.warn(
          `⚠️ [Kinde] addUserToOrganization threw unexpectedly (non-fatal, onboarding continues): ${addUserError.message}`
        );
      }
    } else {
      // Create new user in Kinde
      try {
        const kindeUser = await kindeService.createUser({
          profile: {
            given_name: firstName || '',
            family_name: lastName || ''
          },
          identities: [{
            type: 'email',
            details: { email: adminEmail }
          }],
          organization_code: actualOrgCode
        });

        finalKindeUserId = kindeUser?.id;
        userName = kindeUser ? `${kindeUser.given_name || ''} ${kindeUser.family_name || ''}`.trim() : adminEmail.split('@')[0];

        console.log('✅ New Kinde user created:', finalKindeUserId);
      } catch (err: unknown) {
        const error = err as Error;
        console.warn('⚠️ Kinde user creation failed, using fallback:', error.message);
        finalKindeUserId = `user_${String(adminEmail).replace('@', '_').replace('.', '_')}_${Date.now()}`;
        userName = firstName && lastName ? `${firstName} ${lastName}` : String(adminEmail).split('@')[0];
        console.log('🔄 Using fallback user ID:', finalKindeUserId);
      }
    }

    const kindeOrgFinal = kindeOrg as { organization?: { external_id?: string } };
    return {
      orgCode: actualOrgCode,
      externalId: (kindeOrgFinal?.organization?.external_id ?? externalId) as string,
      userId: finalKindeUserId as string,
      userName: userName as string,
      kindeOrg,
      kindeUser: existingUser ? null : { id: finalKindeUserId }
    };
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
    console.log('🏗️ Creating complete onboarding in single transaction:', companyName);

    const currentTime = new Date();

    // Wrap ALL database operations in a single transaction
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
          defaultTimeZone: timezone || 'UTC',
          defaultCurrency: currency || 'USD',
          defaultLanguage: defaultLanguage || 'en',
          defaultLocale: defaultLocale || 'en-US',
          phone: contactDirectPhone || contactMobilePhone || adminMobile || null,
          onboardingCompleted: false,
          onboardedAt: currentTime,
          onboardingStartedAt: currentTime,
          trialStartedAt: currentTime,
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
          contactPreferredContactMethod: contactPreferredContactMethod || null,
          contactAuthorityLevel: contactAuthorityLevel || null,
          taxRegistrationDetails: taxRegistrationDetails || (panNumber ? { pan: panNumber, country: country || 'IN' } : {}),
          settings: {
            subscriptionTier: selectedPlan,
            subscriptionStatus: 'trial',
            trialStatus: 'active',
            featuresEnabled: { crm: true, users: true, roles: true, dashboard: true },
            onboardingStep: 'in_progress',
            onboardingProgress: {
              accountSetup: { completed: true, completedAt: currentTime },
              companyInfo: { completed: true, completedAt: currentTime },
              planSelection: { completed: true, completedAt: currentTime },
              teamInvites: { completed: false, completedAt: null }
            },
            selectedPlan,
            planName: selectedPlan === 'trial' ? 'Trial Plan' : (selectedPlan === 'free' ? 'Free Plan' : 'Professional Plan'),
            planPrice: selectedPlan === 'trial' ? 0 : (selectedPlan === 'free' ? 0 : 99),
            maxUsers: selectedPlan === 'trial' ? 2 : (selectedPlan === 'free' ? 5 : 50),
            maxProjects: selectedPlan === 'trial' ? 5 : (selectedPlan === 'free' ? 10 : 100),
            teamInviteCount: 0,
            onboardingCompletedAt: currentTime,
            companyType: companyType || null,
            businessType: businessType || null,
            industry: businessType || null, // Use businessType for backward compatibility
            website: website || null,
            companySize: companySize || null,
            country: country || null,
            state: state || null,
            timezone: timezone || null,
            currency: currency || null,
            defaultLanguage: defaultLanguage || null,
            defaultLocale: defaultLocale || null,
            hasGstin: hasGstin || false,
            gstinProvided: hasGstin && gstin ? true : false,
            taxRegistered: taxRegistered || false,
            vatGstRegistered: vatGstRegistered || false,
            billingEmail: billingEmail || null,
            adminMobile: adminMobile || null,
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
            supportEmail: supportEmail || null
          }
        })
        .returning({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          subdomain: tenants.subdomain,
          kindeOrgId: tenants.kindeOrgId,
          adminEmail: tenants.adminEmail,
          onboardingCompleted: tenants.onboardingCompleted,
          onboardedAt: tenants.onboardedAt,
          trialStartedAt: tenants.trialStartedAt
        });

      // Set tenant context for RLS within transaction
      const { sql } = await import('drizzle-orm');
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
          entityCode: `org_${subdomain}_${Date.now()}`,
          description: `Root organization created during ${type} onboarding`,
          entityType: 'organization',
          organizationType: 'business_unit',
          isActive: true,
          isDefault: true,
          isHeadquarters: true,
          contactEmail: adminEmail,
          createdBy: null,
          updatedBy: null
        })
        .returning({
          organizationId: entities.entityId,
          organizationName: entities.entityName,
          organizationCode: entities.entityCode
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
          userId: uuidv4(),
          tenantId: tenant.tenantId,
          kindeUserId,
          email: adminEmail,
          name: adminName,
          phone: null,
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
          notificationPreferences: {
            creditAlerts: true,
            userActivities: true,
            systemAlerts: true,
            weeklyReports: true,
            monthlyReports: true
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
      if (selectedPlan === 'free') {
        // For free plan, create subscription record
        const trialDurationMs = 3 * 30 * 24 * 60 * 60 * 1000; // 3 months
        const trialStartDate = new Date();
        const trialEndDate = new Date(Date.now() + trialDurationMs);

        const subscriptionData = {
          subscriptionId: uuidv4(),
          tenantId: tenant.tenantId,
          plan: 'free',
          status: 'active',
          subscribedTools: ['crm'],
          usageLimits: {
            apiCalls: 10000,
            storage: 5000000000, // 5GB
            users: 5,
            roles: 2,
            projects: 10
          },
          monthlyPrice: '0.00',
          yearlyPrice: '0.00',
          billingCycle: 'prepaid',
          trialStart: trialStartDate,
          trialEnd: trialEndDate,
          currentPeriodStart: trialStartDate,
          currentPeriodEnd: trialEndDate,
          addOns: []
        };

        [subscription] = await tx
          .insert(subscriptions)
          .values(subscriptionData)
          .returning();
      } else {
        // Create trial or paid subscription
        const trialDurationMs = process.env.NODE_ENV === 'production' ? 14 * 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
        const trialStartDate = new Date();
        const trialEndDate = new Date(Date.now() + trialDurationMs);

        const subscriptionData = {
          subscriptionId: uuidv4(),
          tenantId: tenant.tenantId,
          plan: selectedPlan,
          status: 'trialing',
          subscribedTools: ['crm'],
          usageLimits: {
            apiCalls: 10000,
            storage: 1000000000, // 1GB
            users: maxUsers || 2,
            roles: 2,
            projects: maxProjects || 5
          },
          monthlyPrice: (planPrice || 0).toString(),
          yearlyPrice: '0.00',
          billingCycle: 'monthly',
          trialStart: trialStartDate,
          trialEnd: trialEndDate,
          currentPeriodStart: trialStartDate,
          currentPeriodEnd: trialEndDate,
          addOns: []
        };

        [subscription] = await tx
          .insert(subscriptions)
          .values(subscriptionData)
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
      const planAccess = (PLAN_ACCESS_MATRIX as Record<string, { applications?: string[]; modules?: Record<string, unknown> }>)[selectedPlan];
      
      if (!planAccess) {
        throw new Error(`Plan ${selectedPlan} not found in PLAN_ACCESS_MATRIX`);
      }

      const appCodes = planAccess.applications || [];
      const modulesByApp = planAccess.modules || {};

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

      // Calculate expiry date
      const expiryDate = new Date();
      const expiryMonths = selectedPlan === 'free' ? 12 : (selectedPlan === 'enterprise' ? 24 : 12);
      expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);

      // Insert organization applications with enabled modules
      const applicationsToInsert: Array<Record<string, unknown>> = [];
      for (const appCode of appCodes) {
        const normalizeAppCode = (code: string): string => {
          const codeMap: Record<string, string> = {
            'affiliateconnect': 'affiliateConnect',
            'affiliate': 'affiliateConnect'
          };
          return codeMap[code.toLowerCase()] || code;
        };

        const normalizedCode = normalizeAppCode(appCode as string);
        const appId = appCodeToIdMap[normalizedCode];
        
        if (appId) {
          const enabledModules = modulesByApp[appCode] || [];
          let finalEnabledModules = enabledModules;
          
          if (enabledModules === '*') {
            // Get all modules for this application
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
            subscriptionTier: selectedPlan,
            isEnabled: true,
            enabledModules: finalEnabledModules,
            customPermissions: {},
            expiresAt: expiryDate
          });
        }
      }

      if (applicationsToInsert.length > 0) {
        await tx
          .insert(organizationApplications)
          .values(applicationsToInsert);
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
    });

    console.log('✅ Complete onboarding transaction committed successfully');

    // Publish tenant.onboarded to the outbox (event_tracking table) so Financial-Accounting
    // can bootstrap its local copy of all tenant data without requiring a separate API call.
    // This is non-fatal: if it fails, FA falls back to auth-flow pull-based bootstrap.
    try {
      await InterAppEventService.publishEvent({
        eventType: 'tenant.onboarded',
        sourceApplication: 'wrapper',
        targetApplication: 'accounting',
        tenantId: result.tenant?.tenantId ?? '',
        entityId: result.tenant?.tenantId ?? '',
        publishedBy: result.adminUser?.userId ?? 'system',
        eventData: {
          tenantId: result.tenant?.tenantId ?? '',
          tenantName: result.tenant?.companyName ?? '',
          onboardedAt: new Date().toISOString(),
          adminEmail: result.adminUser?.email ?? null,
          kindeOrgId: result.tenant?.kindeOrgId ?? null,
          subdomain: result.tenant?.subdomain ?? null,
          wrapperTenantId: result.tenant?.tenantId ?? '',
          snapshot: {
            tenant: {
              tenantId: result.tenant?.tenantId ?? '',
              name: result.tenant?.companyName ?? '',
              kindeOrgId: result.tenant?.kindeOrgId ?? null,
              status: 'active',
            },
            // Organizations, users, roles will be fetched by FA via pull-sync if needed.
            // Embedding minimal onboarding org so FA can bootstrap without any API calls.
            organizations: result.organization ? [{
              orgCode: result.organization.organizationCode ?? result.organization.organizationId,
              orgName: result.organization.organizationName ?? '',
              status: 'active',
              isActive: true,
              country: null,
              currency: null,
              hierarchyLevel: 0,
              parentOrgCode: null,
            }] : [],
            users: result.adminUser ? [{
              userId: result.adminUser.userId,
              email: result.adminUser.email,
              firstName: result.adminUser.firstName ?? '',
              lastName: result.adminUser.lastName ?? '',
              status: { isActive: true },
            }] : [],
            roles: result.adminRole ? [{
              roleId: result.adminRole.roleId,
              roleName: result.adminRole.roleName ?? 'admin',
              permissions: Array.isArray(result.adminRole.permissions) ? result.adminRole.permissions : [],
              isActive: true,
              priority: 1,
            }] : [],
            employeeAssignments: result.orgMembership ? [{
              assignmentId: `emp_${result.tenant?.tenantId}_${result.adminUser?.userId}`,
              userId: result.adminUser?.userId,
              entityId: result.organization?.organizationId,
              accessLevel: 'admin',
              isActive: true,
              assignedAt: new Date().toISOString(),
            }] : [],
            roleAssignments: result.roleAssignment ? [{
              assignmentId: `ra_${result.tenant?.tenantId}`,
              userIdString: result.adminUser?.userId,
              roleIdString: result.adminRole?.roleId,
              isActive: true,
              assignedAt: new Date().toISOString(),
            }] : [],
            creditConfigs: [],
            entityCredits: [],
          },
        },
      });
      console.log('✅ tenant.onboarded event written to outbox for Financial-Accounting');
    } catch (outboxErr: any) {
      // Non-fatal: onboarding succeeded; FA will fall back to auth-flow bootstrap on first login.
      console.warn('⚠️ Failed to write tenant.onboarded to outbox (non-fatal):', outboxErr?.message);
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
    const { type, companyName, subdomain, adminEmail, adminName, firstName, lastName, termsAccepted, kindeUserId, kindeOrgId, selectedPlan, gstin, hasGstin, companySize, businessType, country, timezone, currency, taxRegistered, vatGstRegistered, billingEmail, contactJobTitle, preferredContactMethod, mailingAddressSameAsRegistered, mailingStreet, mailingCity, mailingState, mailingZip, mailingCountry, billingCountry, supportEmail, contactSalutation, contactMiddleName, contactDepartment, contactDirectPhone, contactMobilePhone, contactPreferredContactMethod, contactAuthorityLevel, taxRegistrationDetails } = params;
    console.log('🏗️ Creating database records for tenant:', companyName);

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
           defaultTimeZone: timezone || 'UTC',
           defaultCurrency: currency || 'USD',
           phone: contactDirectPhone || contactMobilePhone || null,
           onboardingCompleted: false,
           onboardedAt: currentTime,
           onboardingStartedAt: currentTime,
           trialStartedAt: currentTime,
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
           contactPreferredContactMethod: contactPreferredContactMethod || null,
           contactAuthorityLevel: contactAuthorityLevel || null,
           taxRegistrationDetails: taxRegistrationDetails || {},
           settings: {
             subscriptionTier: selectedPlan,
             subscriptionStatus: 'trial',
             trialStatus: 'active',
             featuresEnabled: { crm: true, users: true, roles: true, dashboard: true },
             onboardingStep: 'in_progress',
             onboardingProgress: {
               accountSetup: { completed: true, completedAt: currentTime },
               companyInfo: { completed: true, completedAt: currentTime },
               planSelection: { completed: true, completedAt: currentTime },
               teamInvites: { completed: false, completedAt: null }
             },
             selectedPlan,
             planName: selectedPlan === 'trial' ? 'Trial Plan' : (selectedPlan === 'free' ? 'Free Plan' : 'Professional Plan'),
             planPrice: selectedPlan === 'trial' ? 0 : (selectedPlan === 'free' ? 0 : 99),
             maxUsers: selectedPlan === 'trial' ? 2 : (selectedPlan === 'free' ? 5 : 50),
             maxProjects: selectedPlan === 'trial' ? 5 : (selectedPlan === 'free' ? 10 : 100),
             teamInviteCount: 0,
             onboardingCompletedAt: currentTime,
             businessType: businessType || null,
             companySize: companySize || null,
             country: country || null,
             timezone: timezone || null,
             currency: currency || null,
             hasGstin: hasGstin || false,
             gstinProvided: hasGstin && gstin ? true : false,
             taxRegistered: taxRegistered || false,
             vatGstRegistered: vatGstRegistered || false,
             billingEmail: billingEmail || null,
             supportEmail: supportEmail || null
           }
         })
        .returning({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          subdomain: tenants.subdomain,
          kindeOrgId: tenants.kindeOrgId,
          adminEmail: tenants.adminEmail,
          onboardingCompleted: tenants.onboardingCompleted,
          onboardedAt: tenants.onboardedAt,
          trialStartedAt: tenants.trialStartedAt
        });

      // Set tenant context for RLS within transaction
      const { sql } = await import('drizzle-orm');
      await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenant.tenantId}, false)`);

      // 2. Create parent organization (root entity)
      const organizationEntityId = uuidv4();
      const [organization] = await tx
        .insert(entities)
        .values({
          entityId: organizationEntityId,
          tenantId: tenant.tenantId,
          parentEntityId: null, // Root entity has no parent - this is critical for hierarchy
          entityLevel: 1, // Root entities start at level 1
          // Note: hierarchyPath and fullHierarchyPath will be set by database triggers
          // For root entities, triggers will set hierarchyPath to the entity ID string
          hierarchyPath: organizationEntityId.toString(), // Set initial value (triggers will validate/update)
          fullHierarchyPath: companyName, // Full path is just the entity name for root
          entityName: companyName,
          entityCode: `org_${subdomain}_${Date.now()}`,
          description: `Root organization created during ${type} onboarding`,
          entityType: 'organization',
          organizationType: 'business_unit', // Parent organization - matches organization service expectations
          isActive: true,
          isDefault: true,
          isHeadquarters: true, // Root organization is the headquarters
          contactEmail: adminEmail,
          createdBy: null, // Will be updated after user creation
          updatedBy: null
        })
        .returning({
          organizationId: entities.entityId,
          organizationName: entities.entityName,
          organizationCode: entities.entityCode
        });
      
      // Verify root entity was created correctly
      if (!organization || !organization.organizationId) {
        throw new Error('Failed to create root organization entity');
      }
      
      console.log(`✅ Root organization entity created: ${organization.organizationId} (parentEntityId: null)`);

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
          userId: uuidv4(),
          tenantId: tenant.tenantId,
          kindeUserId,
          email: adminEmail,
          name: adminName,
          phone: null,
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

      console.log(`✅ Organization membership created for admin user: ${orgMembership.membershipId}`);

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
          notificationPreferences: {
            creditAlerts: true,
            userActivities: true,
            systemAlerts: true,
            weeklyReports: true,
            monthlyReports: true
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

      console.log(`✅ Admin assigned as responsible person for organization: ${responsiblePerson.assignmentId}`);

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

    console.log('✅ Database records created successfully');
    return result;
  }

  /**
   * 📝 **CREATE TRIAL SUBSCRIPTION**
   * Create subscription record for the tenant
   */
  static async createTrialSubscription(params: { tenantId: string; selectedPlan: string; maxUsers?: number; maxProjects?: number; planName?: string; planPrice?: number }): Promise<Record<string, unknown>> {
    const { tenantId, selectedPlan, maxUsers, maxProjects, planName, planPrice } = params;
    console.log('📝 Creating trial subscription for tenant:', tenantId);

    const trialDurationMs = process.env.NODE_ENV === 'production' ? 14 * 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
    const trialStartDate = new Date();
    const trialEndDate = new Date(Date.now() + trialDurationMs);

    const subscriptionData = {
      subscriptionId: uuidv4(),
      tenantId,
      plan: selectedPlan,
      status: 'trialing',
      subscribedTools: ['crm'],
      usageLimits: {
        apiCalls: 10000,
        storage: 1000000000, // 1GB
        users: maxUsers ?? 2,
        roles: 2,
        projects: maxProjects ?? 5
      },
      monthlyPrice: String(planPrice ?? 0),
      yearlyPrice: '0.00',
      billingCycle: 'monthly',
      trialStart: trialStartDate,
      trialEnd: trialEndDate,
      currentPeriodStart: trialStartDate,
      currentPeriodEnd: trialEndDate,
      addOns: []
    };

    const [subscription] = await systemDbConnection
      .insert(subscriptions)
      .values(subscriptionData)
      .returning();

    console.log('✅ Trial subscription created:', subscription.subscriptionId);
    return { subscription };
  }

  /**
   * 💰 **ALLOCATE TRIAL CREDITS**
   * Allocate initial credits to the tenant
   */
  static async allocateTrialCredits(params: { tenantId: string; organizationId: string; creditAmount?: number; selectedPlan?: string }): Promise<{ amount: number; creditType: string; planId: string; creditId?: unknown }> {
    const { tenantId, organizationId, selectedPlan = 'free' } = params;
    console.log('💰 Allocating initial free credits:', { tenantId, selectedPlan });

    try {
      // Get plan-based credit amount instead of using parameter
      const { PermissionMatrixUtils } = await import('../../../data/permission-matrix.js');
      const planCredits = PermissionMatrixUtils.getPlanCredits(selectedPlan);
      // Free plan gets 1000 credits as per requirements
      const actualCreditAmount = selectedPlan === 'free' ? 1000 : (planCredits.free || 1000);

      console.log(`📊 Plan ${selectedPlan} provides ${actualCreditAmount} free credits`);

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

      console.log('✅ Initial free credits allocated:', actualCreditAmount);
      return {
        amount: actualCreditAmount,
        creditType: 'free',
        planId: selectedPlan,
        creditId: (creditResult as unknown as Record<string, unknown>)?.creditId
      };
    } catch (err: unknown) {
      const creditError = err as Error;
      console.error('❌ Credit allocation failed:', creditError.message);
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
    const { systemDbConnection } = await import('../../../db/index.js');
    const systemDb = systemDbConnection;

    // Update tenant with subdomain information
    const { tenants } = await import('../../../db/schema/index.js');
    const { eq } = await import('drizzle-orm');

    const [updatedTenant] = await systemDb
      .update(tenants)
      .set({
        subdomain: subdomainData.subdomain as string,
        customDomain: (subdomainData.customDomain as string) ?? undefined,
        updatedAt: new Date()
      })
      .where(eq(tenants.tenantId, subdomainData.tenantId as string))
      .returning();

    console.log('✅ Subdomain configuration completed:', updatedTenant?.subdomain);
    return (updatedTenant ?? {}) as unknown as Record<string, unknown>; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  /**
   * 📊 **TRACK ONBOARDING COMPLETION**
   * Track the completion of onboarding process
   */
  static async trackOnboardingCompletion(params: { tenantId: string; type: string; companyName: string; adminEmail: string; subdomain: string; selectedPlan: string; creditAmount: number }): Promise<void> {
    const { tenantId, type, companyName, adminEmail, subdomain, selectedPlan, creditAmount } = params;
    console.log('📊 Tracking onboarding completion for tenant:', tenantId);

    try {
      const onboardingTrackingService = (await import('./onboarding-tracking-service.js')).default;
      await onboardingTrackingService.trackOnboardingPhase(
        tenantId,
        'trial',
        'completed',
        {
          sessionId: undefined,
          ipAddress: undefined,
          userAgent: undefined,
          eventData: {
            onboardingType: type,
            companyName,
            adminEmail,
            subdomain,
            selectedPlan,
            creditAmount,
            completedAt: new Date().toISOString(),
            source: `unified_${type}_onboarding`,
            version: '2.0'
          },
          completionRate: 100,
          stepNumber: 4,
          totalSteps: 4
        } as any
      );

      console.log('✅ Onboarding completion tracked');
    } catch (err: unknown) {
      const trackingError = err as Error;
      console.warn('⚠️ Onboarding tracking failed, but onboarding completed:', trackingError.message);
      // Don't fail onboarding for tracking issues
    }
  }
}

export default UnifiedOnboardingService;

