/**
 * Payment Upgrade Routes - Handle plan upgrades and additional setup
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken } from '../../../middleware/auth/auth.js';
import { db } from '../../../db/index.js';
import { tenants, tenantUsers, subscriptions, entities } from '../../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import EmailService from '../../../utils/email.js';
import { OnboardingTrackingService } from '../../../features/onboarding/index.js';

type ReqWithUser = FastifyRequest & { userContext?: { tenantId?: string; userId?: string; internalUserId?: string }; body?: Record<string, unknown>; headers?: Record<string, string | string[] | undefined> };

export default async function paymentUpgradeRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {

  // Check if profile is already completed
  fastify.get('/profile-status', {
    preHandler: [authenticateToken],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const body = request.body as Record<string, unknown>;
    try {
      const userContext = (request as ReqWithUser).userContext;
      const tenantId = String(userContext?.tenantId ?? '');

      // Get current tenant
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (!tenant) {
        return reply.code(404).send({
          success: false,
          message: 'Tenant not found'
        });
      }

      const tenantAny = tenant as Record<string, unknown>;
      // Check if profile has all required fields for upgrade
      const hasRequiredFields = !!(
        tenant.gstin &&
        tenant.legalCompanyName &&
        (tenant.industry || tenantAny.businessType) && // Use businessType as fallback
        tenant.billingStreet &&
        tenant.billingCity &&
        tenant.billingCountry
      );

      const setupRate = (tenantAny.setupCompletionRate as number) ?? 0;
      const profileCompleted = !!tenant.onboardingCompleted && setupRate >= 100;

      console.log('📋 Profile status check:', {
        profileCompleted,
        setupCompletionRate: setupRate,
        onboardingCompleted: tenant.onboardingCompleted,
        gstin: tenant.gstin ? 'present' : 'missing',
        hasRequiredFields
      });

      return {
        success: true,
        profileCompleted,
        setupCompletionRate: setupRate || 0,
        onboardingCompleted: tenant.onboardingCompleted || false,
        gstin: tenant.gstin,
        hasRequiredFields
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Profile status check failed:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to check profile status',
        error: error.message
      });
    }
  });

  // Complete comprehensive profile data (separate from payment)
  fastify.post('/complete-profile', {
    preHandler: [authenticateToken],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const userContext = (request as ReqWithUser).userContext;
      const tenantId = String(userContext?.tenantId ?? '');
      const {
        gstin,
        // Company Profile
        legalCompanyName,
        industry,
        companyType,
        ownership,
        annualRevenue,
        numberOfEmployees,
        tickerSymbol,
        website,
        description,
        foundedDate,
        // Contact & Address
        billingStreet,
        billingCity,
        billingState,
        billingZip,
        billingCountry,
        shippingStreet,
        shippingCity,
        shippingState,
        shippingZip,
        shippingCountry,
        phone,
        fax,
        // Localization
        defaultLanguage,
        defaultLocale,
        defaultCurrency,
        multiCurrencyEnabled,
        advancedCurrencyManagement,
        defaultTimeZone,
        firstDayOfWeek,
        // Credit purchase options
        creditPackage,
        credits
      } = body as Record<string, unknown>;

      console.log('📝 Completing comprehensive profile for tenant:', tenantId);

      // Get current tenant
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (!tenant) {
        return reply.code(404).send({
          success: false,
          message: 'Tenant not found'
        });
      }

      const tenantAny = tenant as Record<string, unknown>;
      const setupRate = (tenantAny.setupCompletionRate as number) ?? 0;
      // Check if profile has already been completed during upgrade
      let profileCompleted = false;

      console.log('🔍 Tenant status check:', {
        onboardingCompleted: tenant.onboardingCompleted,
        setupCompletionRate: setupRate,
        condition: !tenant.onboardingCompleted || setupRate < 100
      });

      if (!tenant.onboardingCompleted || setupRate < 100) {
        console.log('📝 Completing comprehensive profile...');

        // Prepare profile update data - only include defined values
        const profileUpdateData: Record<string, unknown> = {};

        // GSTIN is required for upgrade
        if (gstin) profileUpdateData.gstin = gstin;

        // Company Profile
        if (legalCompanyName || tenant.companyName) profileUpdateData.legalCompanyName = legalCompanyName || tenant.companyName;
        if (industry || tenant.industry) profileUpdateData.industry = industry || tenant.industry;
        if (companyType) profileUpdateData.companyType = companyType;
        if (ownership) profileUpdateData.ownership = ownership;
        if (annualRevenue) profileUpdateData.annualRevenue = parseFloat(String(annualRevenue));
        if (numberOfEmployees) profileUpdateData.numberOfEmployees = parseInt(String(numberOfEmployees), 10);
        if (tickerSymbol) profileUpdateData.tickerSymbol = tickerSymbol;
        if (website) profileUpdateData.website = website;
        if (description) profileUpdateData.companyDescription = description;
        if (foundedDate) profileUpdateData.foundedDate = new Date(foundedDate as string | number | Date);

        // Contact & Address
        if (billingStreet) profileUpdateData.billingStreet = billingStreet;
        if (billingCity) profileUpdateData.billingCity = billingCity;
        if (billingState) profileUpdateData.billingState = billingState;
        if (billingZip) profileUpdateData.billingZip = billingZip;
        if (billingCountry) profileUpdateData.billingCountry = billingCountry;
        if (shippingStreet) profileUpdateData.shippingStreet = shippingStreet;
        if (shippingCity) profileUpdateData.shippingCity = shippingCity;
        if (shippingState) profileUpdateData.shippingState = shippingState;
        if (shippingZip) profileUpdateData.shippingZip = shippingZip;
        if (shippingCountry) profileUpdateData.shippingCountry = shippingCountry;
        if (phone) profileUpdateData.phone = phone;
        if (fax) profileUpdateData.fax = fax;

        // Localization
        profileUpdateData.defaultLanguage = defaultLanguage || 'en';
        profileUpdateData.defaultLocale = defaultLocale || 'en-US';
        profileUpdateData.defaultCurrency = defaultCurrency || 'INR';
        profileUpdateData.multiCurrencyEnabled = multiCurrencyEnabled || false;
        profileUpdateData.advancedCurrencyManagement = advancedCurrencyManagement || false;
        profileUpdateData.defaultTimeZone = defaultTimeZone || 'Asia/Kolkata';
        profileUpdateData.firstDayOfWeek = firstDayOfWeek || 1;

        // Mark profile as completed
        profileUpdateData.onboardingCompleted = true;
        profileUpdateData.onboardingStep = 'completed';
        profileUpdateData.setupCompletionRate = 100;
        profileUpdateData.onboardedAt = new Date();

        console.log('🔧 Attempting to update tenant with data:', Object.keys(profileUpdateData));

        // Only update if we have data to update
        if (Object.keys(profileUpdateData).length > 0) {
          // Update tenant with comprehensive profile
          await (db.update(tenants) as any).set(profileUpdateData).where(eq(tenants.tenantId, tenantId));

          profileCompleted = true;
          console.log('✅ Comprehensive profile completed');
        } else {
          console.log('⚠️ No profile data to update');
          profileCompleted = false;
        }

        // Track profile onboarding completion only if profile was actually completed
        if (profileCompleted) {
          try {
            await OnboardingTrackingService.trackOnboardingPhase(
              tenantId,
              'profile',
              'completed',
              {
                userId: userContext?.userId ?? undefined,
                sessionId: (request.headers as Record<string, string>)['x-session-id'] ?? undefined,
                ipAddress: (request as any).ip,
                userAgent: (request.headers as Record<string, string>)['user-agent'],
                eventData: {
                  creditPackage: creditPackage,
                  credits: credits,
                  fieldsCompleted: Object.keys(profileUpdateData).length,
                  hasBillingInfo: !!(billingStreet && billingCity),
                  hasCompanyInfo: !!(legalCompanyName && (industry || tenantAny.businessType)),
                  hasLocalization: !!(defaultLanguage && defaultCurrency),
                  metadata: { source: 'complete_profile', version: '1.0' },
                  completionRate: 100,
                  stepNumber: 3,
                  totalSteps: 3
                }
              }
            );
          } catch (err: unknown) {
            const trackingError = err as Error;
            console.warn('⚠️ Profile onboarding tracking failed, but profile completed:', trackingError.message);
          }
        }
      } else {
        console.log('ℹ️ Profile already completed previously');
        console.log('📋 Current tenant GSTIN:', tenant.gstin);

        // Still update GSTIN if not already set
        if (!tenant.gstin) {
          console.log('🔧 Updating GSTIN for existing profile...');
          await db
            .update(tenants)
            .set({ gstin: gstin as string })
            .where(eq(tenants.tenantId, tenantId));
          console.log('✅ GSTIN updated');
        } else {
          console.log('✅ GSTIN already set, skipping update');
        }
      }

      // Update organization metadata (GSTIN is stored in tenants table, not organizations)
      let organizationUpdateResult: unknown[] = [];
      try {
        organizationUpdateResult = await db
          .update(entities)
          .set({
            updatedBy: userContext?.userId ?? '',
            updatedAt: new Date()
          })
          .where(and(
            eq(entities.tenantId, tenantId),
            eq(entities.organizationType, 'parent'),
            eq(entities.entityType, 'organization')
          ))
          .returning();
        console.log('✅ Organization metadata updated');
      } catch (err: unknown) {
        const orgError = err as Error;
        console.warn('⚠️ Organization update failed (may not exist):', orgError.message);
        // This is not a critical error - organizations table might not have a record for this tenant yet
      }

      console.log('✅ Profile completion successful');

      return {
        success: true,
        message: profileCompleted
          ? 'Profile completed successfully. Ready for payment.'
          : 'Profile was already completed.',
        profileCompleted: profileCompleted,
        readyForPayment: true,
        organizationUpdated: !!organizationUpdateResult.length
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Profile completion failed:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to complete profile',
        error: error.message
      });
    }
  });

  // Purchase additional credits with profile completion
  fastify.post('/purchase-credits', {
    preHandler: [authenticateToken],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const userContext = (request as ReqWithUser).userContext;
      const tenantId = String(userContext?.tenantId ?? '');
      const {
        creditPackage,
        credits,
        gstin,
        maxUsers,
        maxProjects,

        // Company Profile
        legalCompanyName,
        industry,
        companyType,
        ownership,
        annualRevenue,
        numberOfEmployees,
        tickerSymbol,
        website,
        description,
        foundedDate,

        // Contact & Address
        billingStreet,
        billingCity,
        billingState,
        billingZip,
        billingCountry,
        shippingStreet,
        shippingCity,
        shippingState,
        shippingZip,
        shippingCountry,
        phone,
        fax,

        // Localization
        defaultLanguage,
        defaultLocale,
        defaultCurrency,
        multiCurrencyEnabled,
        advancedCurrencyManagement,
        defaultTimeZone,
        firstDayOfWeek
      } = body as Record<string, unknown>;

      console.log('💰 Processing credit purchase:', {
        userId: userContext?.userId,
        creditPackage,
        credits,
        gstin: gstin ? 'provided' : 'not provided'
      });

      // Get current tenant
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (!tenant) {
        return reply.code(404).send({
          success: false,
          message: 'Tenant not found'
        });
      }

      const tenantAny2 = tenant as Record<string, unknown>;
      const setupRate2 = (tenantAny2.setupCompletionRate as number) ?? 0;
      // Check if profile has already been completed during upgrade
      let profileCompleted = false;
      if (!tenant.onboardingCompleted || setupRate2 < 100) {
        console.log('📝 Completing comprehensive profile during upgrade...');

        // Prepare profile update data
        const profileUpdateData = {
          // GSTIN is required for upgrade
          gstin: gstin,

          // Company Profile
          legalCompanyName: legalCompanyName || tenant.companyName,
          industry: industry || tenant.industry,
          companyType: companyType,
          ownership: ownership,
          annualRevenue: annualRevenue ? parseFloat(String(annualRevenue)) : null,
          numberOfEmployees: numberOfEmployees ? parseInt(String(numberOfEmployees), 10) : null,
          tickerSymbol: tickerSymbol,
          website: website,
          companyDescription: description,
          foundedDate: foundedDate ? new Date(foundedDate as string | number | Date) : null,

          // Contact & Address
          billingStreet: billingStreet,
          billingCity: billingCity,
          billingState: billingState,
          billingZip: billingZip,
          billingCountry: billingCountry,
          shippingStreet: shippingStreet,
          shippingCity: shippingCity,
          shippingState: shippingState,
          shippingZip: shippingZip,
          shippingCountry: shippingCountry,
          phone: phone,
          fax: fax,

          // Localization
          defaultLanguage: defaultLanguage || 'en',
          defaultLocale: defaultLocale || 'en-US',
          defaultCurrency: defaultCurrency || 'INR',
          multiCurrencyEnabled: multiCurrencyEnabled || false,
          advancedCurrencyManagement: advancedCurrencyManagement || false,
          defaultTimeZone: defaultTimeZone || 'Asia/Kolkata',
          firstDayOfWeek: firstDayOfWeek || 1,

          // Mark profile as completed
          onboardingCompleted: true,
          onboardingStep: 'completed',
          setupCompletionRate: 100,
          onboardedAt: new Date()
        };

        // Update tenant with comprehensive profile
        await (db.update(tenants) as any).set(profileUpdateData).where(eq(tenants.tenantId, tenantId));

        profileCompleted = true;
        console.log('✅ Comprehensive profile completed during upgrade');

        // Track profile onboarding completion
        try {
          await OnboardingTrackingService.trackOnboardingPhase(
            tenantId,
            'profile',
            'completed',
            {
              userId: userContext?.userId ?? undefined,
              sessionId: (request.headers as Record<string, string>)['x-session-id'] ?? undefined,
              ipAddress: (request as any).ip,
              userAgent: (request.headers as Record<string, string>)['user-agent'],
              eventData: {
                creditPackage,
                credits,
                fieldsCompleted: Object.keys(profileUpdateData).length,
                hasBillingInfo: !!(billingStreet && billingCity),
                hasCompanyInfo: !!(legalCompanyName && industry),
                hasLocalization: !!(defaultLanguage && defaultCurrency),
                metadata: { source: 'payment_upgrade', version: '1.0' },
                completionRate: 100,
                stepNumber: 3,
                totalSteps: 3
              }
            }
          );
        } catch (err: unknown) {
          const trackingError = err as Error;
          console.warn('⚠️ Profile onboarding tracking failed, but upgrade completed:', trackingError.message);
        }
      } else {
        console.log('ℹ️ Profile already completed previously, skipping profile completion');
        // Still update GSTIN if not already set
        if (!tenant.gstin) {
          await db
            .update(tenants)
            .set({ gstin: gstin as string })
            .where(eq(tenants.tenantId, tenantId));
        }
      }

      // Update organization metadata (GSTIN is stored in tenants table, not organizations)
      let organizationUpdateResult: unknown[] = [];
      try {
        organizationUpdateResult = await db
          .update(entities)
          .set({
            updatedBy: userContext?.userId ?? '',
            updatedAt: new Date()
          })
          .where(and(
            eq(entities.tenantId, tenantId),
            eq(entities.organizationType, 'parent'),
            eq(entities.entityType, 'organization')
          ))
          .returning();
        console.log('✅ Organization metadata updated');
      } catch (err: unknown) {
        const orgError = err as Error;
        console.warn('⚠️ Organization update failed (may not exist):', orgError.message);
        // This is not a critical error - organizations table might not have a record for this tenant yet
      }

      // Create new subscription for paid plan
      const subscriptionId = uuidv4();

      type CreditPkg = 'basic' | 'standard' | 'premium' | 'enterprise';
      const pkg = (creditPackage as CreditPkg) ?? 'basic';
      const creditsNum = Number(credits) || 0;
      // Set credit package limits based on credit package
      const creditPackageLimits: Record<CreditPkg, { tools: string[]; users: number; roles: number; projects: number }> = {
        basic: {
          tools: ['crm'],
          users: Math.min(Math.floor(creditsNum / 50), 25),
          roles: Math.min(Math.floor(creditsNum / 100), 10),
          projects: Math.min(Math.floor(creditsNum / 20), 100)
        },
        standard: {
          tools: ['crm', 'hr'],
          users: Math.min(Math.floor(creditsNum / 40), 50),
          roles: Math.min(Math.floor(creditsNum / 80), 15),
          projects: Math.min(Math.floor(creditsNum / 15), 200)
        },
        premium: {
          tools: ['crm', 'hr', 'affiliate'],
          users: Math.min(Math.floor(creditsNum / 30), 100),
          roles: Math.min(Math.floor(creditsNum / 60), 20),
          projects: Math.min(Math.floor(creditsNum / 10), 500)
        },
        enterprise: {
          tools: ['crm', 'hr', 'affiliate', 'accounting', 'inventory'],
          users: Math.min(Math.floor(creditsNum / 20), 500),
          roles: Math.min(Math.floor(creditsNum / 40), 50),
          projects: Math.min(Math.floor(creditsNum / 5), 1000)
        }
      };

      const planConfig = creditPackageLimits[pkg];
      // Calculate price based on credits and package
      const creditPrices: Record<CreditPkg, number> = {
        basic: creditsNum * 0.10, // $0.10 per credit for basic
        standard: creditsNum * 0.15, // $0.15 per credit for standard
        premium: creditsNum * 0.20, // $0.20 per credit for premium
        enterprise: creditsNum * 0.25 // $0.25 per credit for enterprise
      };

      const [newSubscription] = await db
        .insert(subscriptions)
        .values({
          subscriptionId,
          tenantId,
          plan: 'credit-based',
          status: 'active',
          subscribedTools: planConfig.tools,
          usageLimits: planConfig as any,
          monthlyPrice: creditPrices[pkg].toString(),
          yearlyPrice: (creditPrices[pkg] * 12).toString(), // Monthly pricing for annual
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          addOns: [{
            type: 'credits',
            package: pkg,
            amount: creditsNum,
            price: creditPrices[pkg]
          }],
          upgradedFromTrial: true,
          upgradeDate: new Date()
        } as any)
        .returning();

      // Update tenant with upgrade information (subscriptionStatus/planUpgradedAt/upgradedPlan may exist on tenant in some schemas)
      await db
        .update(tenants)
        .set({
          gstin: gstin as string,
          updatedAt: new Date(),
          ...({ subscriptionStatus: 'active', planUpgradedAt: new Date(), upgradedPlan: `credit-${pkg}` } as any)
        } as any)
        .where(eq(tenants.tenantId, tenantId));

      // No team invites to send (removed as requested)

      // Track upgrade onboarding completion
      try {
        await OnboardingTrackingService.trackOnboardingPhase(
          tenantId,
          'upgrade',
          'completed',
          {
            userId: userContext?.userId ?? undefined,
            sessionId: (request.headers as Record<string, string>)['x-session-id'] ?? undefined,
            ipAddress: (request as any).ip,
            userAgent: (request.headers as Record<string, string>)['user-agent'],
            eventData: {
              creditPackage,
              credits,
              subscriptionId,
              gstinUpdated: !!organizationUpdateResult.length,
              profileCompleted,
              teamEmailsCount: 0,
              planLimits: planConfig,
              metadata: { source: 'payment_upgrade', version: '1.0' },
              completionRate: 100,
              stepNumber: 1,
              totalSteps: 1
            }
          }
        );
      } catch (err: unknown) {
        const trackingError = err as Error;
        console.warn('⚠️ Upgrade onboarding tracking failed, but upgrade completed:', trackingError.message);
      }

      console.log('✅ Credit purchase completed:', {
        subscriptionId,
        creditPackage,
        credits,
        gstinUpdated: !!organizationUpdateResult.length
      });

      // Log successful payment upgrade activity
      try {
        const ActivityLogger = (await import('../../../services/activityLogger.js')).default;
        const requestContext = ActivityLogger.createRequestContext(request as any);
        await ActivityLogger.logActivity(
          (userContext?.internalUserId ?? userContext?.userId ?? '') as string,
          (userContext?.tenantId ?? '') as string,
          null,
          'payment.upgrade_success',
          {
            creditPackage,
            credits,
            subscriptionId,
            price: creditPrices[pkg],
            profileCompleted,
            organizationUpdated: !!organizationUpdateResult.length,
            planLimits: planConfig
          },
          requestContext
        );
      } catch (err: unknown) {
        const logError = err as Error;
        console.warn('⚠️ Failed to log payment upgrade activity:', logError.message);
      }

      return {
        success: true,
        message: `Successfully purchased ${credits} credits (${creditPackage} package)${profileCompleted ? ' with profile completion' : ''}`,
        subscription: {
          subscriptionId,
          plan: 'credit-based',
          creditPackage,
          credits,
          status: 'active',
          tools: planConfig.tools,
          limits: planConfig
        },
        organizationUpdated: !!organizationUpdateResult.length,
        profileCompleted: profileCompleted
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Payment upgrade failed:', error);
      const reqBody = (request as FastifyRequest & { body?: Record<string, unknown> }).body;

      // Log failed payment upgrade activity
      try {
        const ActivityLogger = (await import('../../../services/activityLogger.js')).default;
        const requestContext = ActivityLogger.createRequestContext(request as any);
        await ActivityLogger.logActivity(
          ((request as ReqWithUser).userContext?.internalUserId ?? (request as ReqWithUser).userContext?.userId ?? '') as string,
          ((request as ReqWithUser).userContext?.tenantId ?? '') as string,
          null,
          'payment.upgrade_failed',
          {
            error: error.message,
            creditPackage: reqBody?.creditPackage,
            credits: reqBody?.credits,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          },
          requestContext
        );
      } catch (logErr: unknown) {
        const logError = logErr as Error;
        console.warn('⚠️ Failed to log payment upgrade failure activity:', logError.message);
      }

      return reply.code(500).send({
        success: false,
        message: 'Failed to process payment upgrade',
        error: error.message
      });
    }
  });

  // Get upgrade options for current tenant
  fastify.get('/upgrade-options', {
    preHandler: [authenticateToken],
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    try {
      const userContext = (request as ReqWithUser).userContext;
      const tenantId = String(userContext?.tenantId ?? '');

      // Get current subscription
      const [currentSubscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .limit(1);

      // Get organization info
      const [organization] = await db
        .select({
          organizationId: entities.entityId,
          organizationName: entities.entityName
        })
        .from(entities)
        .where(and(
          eq(entities.tenantId, tenantId),
          eq(entities.organizationType, 'parent'),
          eq(entities.entityType, 'organization')
        ))
        .limit(1);

      const [tenantRow] = await db.select({ gstin: tenants.gstin }).from(tenants).where(eq(tenants.tenantId, tenantId)).limit(1);
      const hasGSTIN = !!tenantRow?.gstin;

      const availableUpgrades = [
        {
          plan: 'starter',
          name: 'Starter Plan',
          price: 29,
          features: ['CRM', 'HR Management', 'Up to 10 users', '25 projects'],
          recommended: currentSubscription?.plan === 'trial'
        },
        {
          plan: 'professional',
          name: 'Professional Plan',
          price: 79,
          features: ['Everything in Starter', 'Affiliate Management', 'Up to 25 users', '100 projects'],
          recommended: currentSubscription?.plan === 'starter'
        },
        {
          plan: 'enterprise',
          name: 'Enterprise Plan',
          price: 199,
          features: ['Everything in Professional', 'Accounting', 'Inventory', 'Up to 100 users', '500 projects'],
          recommended: currentSubscription?.plan === 'professional'
        }
      ];

      return {
        success: true,
        data: {
          currentPlan: currentSubscription?.plan || 'trial',
          availableUpgrades,
          organizationSetup: {
            hasGSTIN,
            organizationName: organization?.organizationName || 'Not set'
          }
        }
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Failed to get upgrade options:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to get upgrade options'
      });
    }
  });
}
