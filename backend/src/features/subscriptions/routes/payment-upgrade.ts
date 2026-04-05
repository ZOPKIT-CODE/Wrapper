/**
 * Payment Upgrade Routes - Handle plan upgrades and additional setup
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken } from '../../../middleware/auth/auth.js';
import { db } from '../../../db/index.js';
import { tenants, subscriptions, entities } from '../../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { OnboardingTrackingService } from '../../../features/onboarding/index.js';

type UserCtx = { tenantId?: string; userId?: string; internalUserId?: string };
type ReqWithCtx = FastifyRequest & { userContext?: UserCtx };

// ---------------------------------------------------------------------------
// Shared profile completion helper
//
// Builds and applies the tenant profile update from body fields.
// Uses a sparse update — only fields explicitly provided are written.
// Returns whether a profile update actually occurred.
// ---------------------------------------------------------------------------
async function applyProfileCompletion(
  tenantId: string,
  body: Record<string, unknown>,
  userContext: UserCtx | undefined,
  request: FastifyRequest
): Promise<{ profileCompleted: boolean; organizationUpdated: boolean }> {
  const {
    gstin, legalCompanyName, industry, companyType, ownership,
    annualRevenue, numberOfEmployees, tickerSymbol, website, description, foundedDate,
    billingStreet, billingCity, billingState, billingZip, billingCountry,
    shippingStreet, shippingCity, shippingState, shippingZip, shippingCountry,
    phone, fax,
    defaultLanguage, defaultLocale, defaultCurrency,
    multiCurrencyEnabled, advancedCurrencyManagement, defaultTimeZone, firstDayOfWeek,
    creditPackage, credits
  } = body;

  const [tenant] = await db.select().from(tenants).where(eq(tenants.tenantId, tenantId)).limit(1);
  if (!tenant) throw Object.assign(new Error('Tenant not found'), { statusCode: 404 });

  let profileCompleted = false;

  if (!tenant.onboardingCompleted) {
    const update: Record<string, unknown> = {};

    if (gstin) update.gstin = gstin;
    if (legalCompanyName || tenant.companyName) update.legalCompanyName = legalCompanyName || tenant.companyName;
    if (industry || tenant.industry) update.industry = industry || tenant.industry;
    if (companyType) update.companyType = companyType;
    if (ownership) update.ownership = ownership;
    if (annualRevenue) update.annualRevenue = parseFloat(String(annualRevenue));
    if (numberOfEmployees) update.numberOfEmployees = parseInt(String(numberOfEmployees), 10);
    if (tickerSymbol) update.tickerSymbol = tickerSymbol;
    if (website) update.website = website;
    if (description) update.companyDescription = description;
    if (foundedDate) update.foundedDate = new Date(foundedDate as string | number | Date);
    if (billingStreet) update.billingStreet = billingStreet;
    if (billingCity) update.billingCity = billingCity;
    if (billingState) update.billingState = billingState;
    if (billingZip) update.billingZip = billingZip;
    if (billingCountry) update.billingCountry = billingCountry;
    if (shippingStreet) update.shippingStreet = shippingStreet;
    if (shippingCity) update.shippingCity = shippingCity;
    if (shippingState) update.shippingState = shippingState;
    if (shippingZip) update.shippingZip = shippingZip;
    if (shippingCountry) update.shippingCountry = shippingCountry;
    if (phone) update.phone = phone;
    if (fax) update.fax = fax;

    update.defaultLanguage = defaultLanguage || 'en';
    update.defaultLocale = defaultLocale || 'en-IN';
    update.defaultCurrency = defaultCurrency || 'INR';
    update.multiCurrencyEnabled = multiCurrencyEnabled || false;
    update.advancedCurrencyManagement = advancedCurrencyManagement || false;
    update.defaultTimeZone = defaultTimeZone || 'Asia/Kolkata';
    update.firstDayOfWeek = firstDayOfWeek || 1;
    update.onboardingCompleted = true;
    update.onboardingCompleted = true;
    update.onboardedAt = new Date();

    if (Object.keys(update).length > 0) {
      await (db.update(tenants) as any).set(update).where(eq(tenants.tenantId, tenantId));
      profileCompleted = true;

      try {
        await OnboardingTrackingService.trackOnboardingPhase(tenantId, 'profile', 'completed', {
          userId: userContext?.userId ?? undefined,
          sessionId: (request.headers as Record<string, string>)['x-session-id'] ?? undefined,
          ipAddress: (request as any).ip,
          userAgent: (request.headers as Record<string, string>)['user-agent'],
          eventData: {
            creditPackage, credits,
            fieldsCompleted: Object.keys(update).length,
            hasBillingInfo: !!(billingStreet && billingCity),
            hasCompanyInfo: !!(legalCompanyName && industry),
            hasLocalization: !!(defaultLanguage && defaultCurrency),
            metadata: { source: 'complete_profile', version: '1.0' },
            completionRate: 100, stepNumber: 3, totalSteps: 3
          }
        });
      } catch (trackingErr: unknown) {
        request.log.warn({ err: trackingErr }, 'Profile onboarding tracking failed (non-fatal)');
      }
    }
  } else {
    // Profile already complete — only backfill GSTIN if missing
    if (gstin && !tenant.gstin) {
      await db.update(tenants).set({ gstin: gstin as string }).where(eq(tenants.tenantId, tenantId));
    }
  }

  // Touch the root organization entity's updatedAt
  let organizationUpdated = false;
  try {
    const result = await db
      .update(entities)
      .set({ updatedBy: userContext?.userId ?? '', updatedAt: new Date() })
      .where(and(
        eq(entities.tenantId, tenantId),
        eq(entities.entityType, 'organization')
      ))
      .returning();
    organizationUpdated = result.length > 0;
  } catch (orgErr: unknown) {
    request.log.warn({ err: orgErr }, 'Organization metadata update failed (non-fatal)');
  }

  return { profileCompleted, organizationUpdated };
}

export default async function paymentUpgradeRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {

  // Check if profile is already completed
  fastify.get('/profile-status', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = String((request as ReqWithCtx).userContext?.tenantId ?? '');

      const [tenant] = await db.select().from(tenants).where(eq(tenants.tenantId, tenantId)).limit(1);
      if (!tenant) {
        return reply.code(404).send({ success: false, message: 'Tenant not found' });
      }

      const hasRequiredFields = !!(
        tenant.gstin &&
        tenant.legalCompanyName &&
        tenant.industry &&
        tenant.billingStreet &&
        tenant.billingCity &&
        tenant.billingCountry
      );

      const profileCompleted = !!tenant.onboardingCompleted;

      return {
        success: true,
        profileCompleted,
        onboardingCompleted: tenant.onboardingCompleted || false,
        gstin: tenant.gstin,
        hasRequiredFields
      };
    } catch (err: unknown) {
      request.log.error({ err }, 'Profile status check failed');
      return reply.code(500).send({ success: false, message: 'Failed to check profile status' });
    }
  });

  // Complete comprehensive profile data (separate from payment)
  fastify.post('/complete-profile', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userContext = (request as ReqWithCtx).userContext;
    const tenantId = String(userContext?.tenantId ?? '');
    const body = request.body as Record<string, unknown>;

    try {
      const { profileCompleted, organizationUpdated } = await applyProfileCompletion(
        tenantId, body, userContext, request
      );

      return {
        success: true,
        message: profileCompleted
          ? 'Profile completed successfully. Ready for payment.'
          : 'Profile was already completed.',
        profileCompleted,
        readyForPayment: true,
        organizationUpdated
      };
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      request.log.error({ err }, 'Profile completion failed');
      return reply.code(error.statusCode ?? 500).send({
        success: false,
        message: error.message || 'Failed to complete profile'
      });
    }
  });

  // Purchase additional credits with optional profile completion
  fastify.post('/purchase-credits', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userContext = (request as ReqWithCtx).userContext;
    const tenantId = String(userContext?.tenantId ?? '');
    const body = request.body as Record<string, unknown>;

    try {
      const { creditPackage, credits } = body as Record<string, unknown>;

      const { profileCompleted, organizationUpdated } = await applyProfileCompletion(
        tenantId, body, userContext, request
      );

      const subscriptionId = uuidv4();

      type CreditPkg = 'basic' | 'standard' | 'premium' | 'enterprise';
      const pkg = (creditPackage as CreditPkg) ?? 'basic';
      const creditsNum = Number(credits) || 0;

      const creditPackageLimits: Record<CreditPkg, { tools: string[]; users: number; roles: number; projects: number }> = {
        basic:      { tools: ['crm'],                                      users: Math.min(Math.floor(creditsNum / 50), 25),  roles: Math.min(Math.floor(creditsNum / 100), 10), projects: Math.min(Math.floor(creditsNum / 20), 100)  },
        standard:   { tools: ['crm', 'hr'],                                users: Math.min(Math.floor(creditsNum / 40), 50),  roles: Math.min(Math.floor(creditsNum / 80),  15), projects: Math.min(Math.floor(creditsNum / 15), 200)  },
        premium:    { tools: ['crm', 'hr', 'affiliate'],                   users: Math.min(Math.floor(creditsNum / 30), 100), roles: Math.min(Math.floor(creditsNum / 60),  20), projects: Math.min(Math.floor(creditsNum / 10), 500)  },
        enterprise: { tools: ['crm', 'hr', 'affiliate', 'accounting', 'inventory'], users: Math.min(Math.floor(creditsNum / 20), 500), roles: Math.min(Math.floor(creditsNum / 40), 50), projects: Math.min(Math.floor(creditsNum / 5), 1000) }
      };

      const planConfig = creditPackageLimits[pkg];
      const creditPrices: Record<CreditPkg, number> = {
        basic:      creditsNum * 0.10,
        standard:   creditsNum * 0.15,
        premium:    creditsNum * 0.20,
        enterprise: creditsNum * 0.25
      };

      const [newSubscription] = await db
        .insert(subscriptions)
        .values({
          subscriptionId,
          tenantId,
          plan: 'credit-based',
          status: 'active',
          monthlyPrice: creditPrices[pkg].toString(),
          yearlyPrice: (creditPrices[pkg] * 12).toString(),
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          addOns: [{ type: 'credits', package: pkg, amount: creditsNum, price: creditPrices[pkg] }],
          upgradedFromTrial: true,
          upgradeDate: new Date()
        } as any)
        .returning();

      // Track upgrade completion
      try {
        await OnboardingTrackingService.trackOnboardingPhase(tenantId, 'upgrade', 'completed', {
          userId: userContext?.userId ?? undefined,
          sessionId: (request.headers as Record<string, string>)['x-session-id'] ?? undefined,
          ipAddress: (request as any).ip,
          userAgent: (request.headers as Record<string, string>)['user-agent'],
          eventData: {
            creditPackage: pkg, credits: creditsNum, subscriptionId,
            organizationUpdated, profileCompleted, teamEmailsCount: 0,
            planLimits: planConfig,
            metadata: { source: 'payment_upgrade', version: '1.0' },
            completionRate: 100, stepNumber: 1, totalSteps: 1
          }
        });
      } catch (trackingErr: unknown) {
        request.log.warn({ err: trackingErr }, 'Upgrade onboarding tracking failed (non-fatal)');
      }

      // Log activity
      try {
        const ActivityLogger = (await import('../../../services/activityLogger.js')).default;
        await ActivityLogger.logActivity(
          (userContext?.internalUserId ?? userContext?.userId ?? '') as string,
          tenantId,
          null,
          'payment.upgrade_success',
          { creditPackage: pkg, credits: creditsNum, subscriptionId, price: creditPrices[pkg], profileCompleted, organizationUpdated, planLimits: planConfig },
          ActivityLogger.createRequestContext(request as any)
        );
      } catch (logErr: unknown) {
        request.log.warn({ err: logErr }, 'Failed to log payment upgrade activity (non-fatal)');
      }

      return {
        success: true,
        message: `Successfully purchased ${creditsNum} credits (${pkg} package)${profileCompleted ? ' with profile completion' : ''}`,
        subscription: {
          subscriptionId,
          plan: 'credit-based',
          creditPackage: pkg,
          credits: creditsNum,
          status: 'active',
          tools: planConfig.tools,
          limits: planConfig
        },
        organizationUpdated,
        profileCompleted
      };
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      request.log.error({ err }, 'Payment upgrade failed');

      // Log failure activity
      try {
        const ActivityLogger = (await import('../../../services/activityLogger.js')).default;
        await ActivityLogger.logActivity(
          (userContext?.internalUserId ?? userContext?.userId ?? '') as string,
          tenantId,
          null,
          'payment.upgrade_failed',
          {
            error: error.message,
            creditPackage: body?.creditPackage,
            credits: body?.credits,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          },
          ActivityLogger.createRequestContext(request as any)
        );
      } catch (logErr: unknown) {
        request.log.warn({ err: logErr }, 'Failed to log payment upgrade failure (non-fatal)');
      }

      return reply.code(error.statusCode ?? 500).send({
        success: false,
        message: error.message || 'Failed to process payment upgrade'
      });
    }
  });

  // Get upgrade options for current tenant
  fastify.get('/upgrade-options', {
    preHandler: [authenticateToken]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = String((request as ReqWithCtx).userContext?.tenantId ?? '');

      const [currentSubscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .limit(1);

      const [organization] = await db
        .select({ organizationId: entities.entityId, organizationName: entities.entityName })
        .from(entities)
        .where(and(
          eq(entities.tenantId, tenantId),
          eq(entities.entityType, 'organization')
        ))
        .limit(1);

      const [tenantRow] = await db
        .select({ gstin: tenants.gstin })
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      // Build upgrade options from canonical plan definitions
      const { SubscriptionService } = await import('../services/subscription-service.js');
      const availablePlans = await SubscriptionService.getAvailablePlans();
      const currentPlan = currentSubscription?.plan || 'trial';

      const availableUpgrades = availablePlans.map((plan: any) => ({
        plan: plan.id,
        name: plan.name ?? plan.id,
        yearlyPrice: plan.yearlyPrice,
        yearlyPriceInr: plan.yearlyPriceInr,
        billingCycle: 'yearly' as const,
        features: plan.features ?? [],
        recommended: (
          (currentPlan === 'trial' && plan.id === 'starter') ||
          (currentPlan === 'starter' && plan.id === 'professional') ||
          (currentPlan === 'professional' && plan.id === 'enterprise')
        )
      }));

      return {
        success: true,
        currentPlan,
        availableUpgrades,
        organizationSetup: {
          hasGSTIN: !!tenantRow?.gstin,
          organizationName: organization?.organizationName || 'Not set'
        }
      };
    } catch (err: unknown) {
      request.log.error({ err }, 'Failed to get upgrade options');
      return reply.code(500).send({ success: false, message: 'Failed to get upgrade options' });
    }
  });
}
