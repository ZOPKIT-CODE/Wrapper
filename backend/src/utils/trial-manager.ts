import { db, sql } from '../db/index.js';
import { subscriptions } from '../db/schema/billing/subscriptions.js';
import { tenants } from '../db/schema/core/tenants.js';
import { eq, and, lt, gt, or, isNull } from 'drizzle-orm';
import { EmailService } from '../utils/email.js';
import Logger from './logger.js';
import cron from 'node-cron';

// Schema may have been migrated; trial columns asserted for type compatibility where used

interface TrialSubscriptionRow {
  subscriptionId: string;
  tenantId: string;
  plan: string;
  status: string;
  trialEnd?: Date | null;
  currentPeriodEnd?: Date | null;
  companyName?: string | null;
  adminEmail?: string | null;
}

class TrialManager {
  isRunning: boolean;
  cronJobs: { destroy: () => void }[];
  lastHealthCheck: Date | null;
  errorCount: number;
  maxErrors: number;
  emailService: EmailService;

  constructor() {
    this.isRunning = false;
    this.cronJobs = [];
    this.lastHealthCheck = null;
    this.errorCount = 0;
    this.maxErrors = 5;
    this.emailService = new EmailService();
  }

  // Start the trial management system with better error handling
  startTrialMonitoring() {
    if (this.isRunning) {
      console.log('⚠️ Trial monitoring is already running');
      return;
    }

    console.log('🚀 Starting comprehensive trial monitoring system...');
    
    try {
      // Check for expired trials every minute (immediate detection)
      const expiryJob = cron.schedule('* * * * *', async () => {
        try {
          await this.checkExpiredTrials();
          this.errorCount = 0; // Reset error count on success
        } catch (err: unknown) {
          this.errorCount++;
          console.error(`❌ Trial expiry check failed (${this.errorCount}/${this.maxErrors}):`, err);
          
          if (this.errorCount >= this.maxErrors) {
            console.error('🚨 Too many consecutive errors, stopping trial monitoring');
            this.stopTrialMonitoring();
          }
        }
      });
      
      // Send trial reminders twice daily (9 AM and 6 PM)
      const reminderJob = cron.schedule('0 9,18 * * *', async () => {
        try {
          await this.sendTrialReminders();
        } catch (error) {
          console.error('❌ Trial reminder job failed:', error);
        }
      });

      // Plan validity check (for paid plans that expire) - every hour
      const planValidityJob = cron.schedule('0 * * * *', async () => {
        try {
          await this.checkPlanValidity();
        } catch (error) {
          console.error('❌ Plan validity check failed:', error);
        }
      });

      // Health check job - every 5 minutes
      const healthCheckJob = cron.schedule('*/5 * * * *', async () => {
        this.lastHealthCheck = new Date();
        console.log(`💓 Trial monitoring health check: ${this.lastHealthCheck.toISOString()}`);
      });

      this.cronJobs = [expiryJob, reminderJob, planValidityJob, healthCheckJob];
      this.isRunning = true;
      this.lastHealthCheck = new Date();
      console.log('✅ Trial monitoring system started with comprehensive checks');
      
      // Run initial check immediately
      setTimeout(() => {
        this.checkExpiredTrials().catch(error => {
          console.error('❌ Initial trial check failed:', error);
        });
      }, 1000);
      
    } catch (error) {
      console.error('❌ Failed to start trial monitoring system:', error);
      this.stopTrialMonitoring();
    }
  }

  // Stop all monitoring
  stopTrialMonitoring() {
    try {
      this.cronJobs.forEach((job: { destroy: () => void }) => {
        try {
          job.destroy();
        } catch (error) {
          console.error('⚠️ Error stopping cron job:', error);
        }
      });
      this.cronJobs = [];
      this.isRunning = false;
      console.log('🛑 Trial monitoring system stopped');
    } catch (error) {
      console.error('❌ Error stopping trial monitoring:', error);
    }
  }

  // Get monitoring system status
  getMonitoringStatus() {
    return {
      isRunning: this.isRunning,
      lastHealthCheck: this.lastHealthCheck,
      errorCount: this.errorCount,
      activeJobs: this.cronJobs.length,
      uptime: this.lastHealthCheck ? Date.now() - this.lastHealthCheck.getTime() : null
    };
  }

  // Main expiry check - runs every minute for immediate detection
  async checkExpiredTrials() {
    const startTime = Date.now();
    const requestId = Logger.generateRequestId('trial-expiry-check');
    
    try {
      console.log('\n⏰ ================ TRIAL EXPIRY CHECK STARTED ================');
      console.log(`📋 Request ID: ${requestId}`);
      console.log(`⏰ Timestamp: ${Logger.getTimestamp()}`);
      
      // Find ALL subscriptions that should be expired but aren't marked as such
      // NOTE: The DB has no `trial_end` column — `currentPeriodEnd` IS the trial end date.
      // subsSchema.trialEnd was a phantom reference that resolved to undefined at runtime,
      // crashing Drizzle's orderSelectedFields. Use currentPeriodEnd everywhere.
      const potentiallyExpired = (await db
        .select({
          subscriptionId: subscriptions.subscriptionId,
          tenantId: subscriptions.tenantId,
          plan: subscriptions.plan,
          status: subscriptions.status,
          trialEnd: subscriptions.currentPeriodEnd,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          companyName: tenants.companyName,
          adminEmail: tenants.adminEmail,
        })
        .from(subscriptions)
        .leftJoin(tenants, eq(subscriptions.tenantId, tenants.tenantId))
        .where(
          and(
            or(
              // Trial subscriptions where period has ended
              and(
                or(
                  eq(subscriptions.status, 'trialing'),
                  eq(subscriptions.plan, 'trial')
                ),
                lt(subscriptions.currentPeriodEnd, new Date())
              ),
              // Non-Stripe-managed paid subscriptions with expired periods
              and(
                eq(subscriptions.status, 'active'),
                lt(subscriptions.currentPeriodEnd, new Date()),
                isNull(subscriptions.stripeSubscriptionId)
              )
            ),
            // Not already marked as expired
            or(
              eq(subscriptions.status, 'trialing'),
              eq(subscriptions.status, 'active')
            )
          )
        )) as TrialSubscriptionRow[];

      console.log(`🔍 [${requestId}] Found ${potentiallyExpired.length} potentially expired subscriptions`);
      
      if (potentiallyExpired.length === 0) {
        console.log(`✅ [${requestId}] No expired trials/subscriptions found`);
        console.log('⏰ ================ TRIAL EXPIRY CHECK ENDED ================\n');
        return;
      }

      let processedCount = 0;
      for (const subscription of potentiallyExpired) {
        const isTrialExpired = subscription.plan === 'trial' || subscription.status === 'trialing';
        
        if (isTrialExpired) {
          console.log(`🚨 [${requestId}] Processing expired TRIAL: ${subscription.tenantId}`);
          await this.handleExpiredTrial(subscription, requestId);
        } else {
          console.log(`🚨 [${requestId}] Processing expired PAID PLAN: ${subscription.tenantId}`);
          await this.handleExpiredPaidPlan(subscription, requestId);
        }
        processedCount++;
      }

      console.log(`🎉 [${requestId}] Processed ${processedCount} expired subscriptions`);
      console.log(`⏱️ [${requestId}] Total time: ${Logger.getDuration(startTime)}`);
      console.log('⏰ ================ TRIAL EXPIRY CHECK ENDED ================\n');

    } catch (error) {
      console.error(`❌ [${requestId}] Error in trial expiry check:`, error);
    }
  }

  // Handle expired trial - immediate action
  async handleExpiredTrial(trial: TrialSubscriptionRow, parentRequestId: string | null = null): Promise<void> {
    const startTime = Date.now();
    const requestId = parentRequestId || Logger.generateRequestId('trial-expire');
    
    try {
      console.log(`\n🔄 [${requestId}] ========== PROCESSING EXPIRED TRIAL ==========`);
      console.log(`🏢 [${requestId}] Tenant: ${trial.tenantId}`);
      console.log(`🏷️ [${requestId}] Company: ${trial.companyName}`);
      console.log(`📧 [${requestId}] Admin Email: ${trial.adminEmail}`);
      console.log(`📦 [${requestId}] Plan: ${trial.plan}`);
      console.log(`📅 [${requestId}] Trial End Date: ${trial.trialEnd}`);
      console.log(`⏰ [${requestId}] Current Time: ${new Date()}`);

      // Step 1: Immediately update subscription status
      console.log(`📝 [${requestId}] Step 1: Updating subscription status to expired...`);
      await db
        .update(subscriptions)
        .set({
          status: 'suspended',
          suspendedAt: new Date(),
          suspendedReason: 'Trial expired - upgrade required',
          updatedAt: new Date()
        })
        .where(eq(subscriptions.subscriptionId, trial.subscriptionId));

      console.log(`✅ [${requestId}] Subscription status updated to 'suspended'`);

      // Step 2: Create trial expiry event record (NOT in payments table)
      console.log(`📝 [${requestId}] Step 2: Recording trial expiry event...`);
      await this.recordTrialEvent(trial.tenantId, trial.subscriptionId, 'trial_expired', {
        expiredAt: new Date(),
        originalTrialEnd: trial.trialEnd,
        planType: trial.plan,
        companyName: trial.companyName,
        adminEmail: trial.adminEmail
      });

      // Step 3: Apply immediate access restrictions
      console.log(`📝 [${requestId}] Step 3: Applying access restrictions...`);
      await this.applyTrialRestrictions(trial.tenantId);

      // Step 3.5: Deduct remaining trial credits
      console.log(`📝 [${requestId}] Step 3.5: Deducting remaining trial credits...`);
      try {
        const { db: dbConn } = await import('../db/index.js');
        const { credits: creditsTable, creditTransactions } = await import('../db/schema/index.js');
        const { eq: eqFn } = await import('drizzle-orm');
        const { randomUUID } = await import('crypto');

        const tenantCredits = await dbConn
          .select()
          .from(creditsTable)
          .where(eqFn(creditsTable.tenantId, trial.tenantId));

        for (const creditRecord of tenantCredits) {
          const currentBalance = parseFloat(String(creditRecord.availableCredits ?? 0));
          if (currentBalance <= 0) continue;

          await dbConn
            .update(creditsTable)
            .set({ availableCredits: '0', lastUpdatedAt: new Date() })
            .where(eqFn(creditsTable.creditId, creditRecord.creditId));

          if (creditRecord.entityId != null) {
            await dbConn
              .insert(creditTransactions)
              .values({
                transactionId: randomUUID(),
                tenantId: trial.tenantId,
                entityId: creditRecord.entityId,
                transactionType: 'expiry',
                amount: (-currentBalance).toString(),
                previousBalance: currentBalance.toString(),
                newBalance: '0',
                operationCode: `trial_expiry:${trial.subscriptionId}`,
                createdAt: new Date()
              });
          }
        }

        console.log(`✅ [${requestId}] Trial credits deducted for tenant ${trial.tenantId}`);
      } catch (creditErr) {
        // Non-fatal: log but don't abort the trial expiry flow
        console.error(`⚠️ [${requestId}] Failed to deduct trial credits (non-fatal):`, creditErr);
      }

      // Step 4: Send immediate email notification
      console.log(`📝 [${requestId}] Step 4: Sending immediate email notification...`);
      const emailResult = await this.emailService.sendTrialExpiredNotification({
        email: trial.adminEmail ?? '',
        companyName: trial.companyName ?? '',
        planName: trial.plan,
        subscriptionId: trial.subscriptionId
      });

      if (emailResult && emailResult.success) {
        console.log(`✅ [${requestId}] Email sent successfully to: ${trial.adminEmail}`);
        await this.recordTrialEvent(trial.tenantId, trial.subscriptionId, 'email_sent', {
          emailType: 'trial_expired',
          recipientEmail: trial.adminEmail,
          sentAt: new Date()
        });
      } else {
        console.error(`❌ [${requestId}] Failed to send email to: ${trial.adminEmail}`);
        await this.recordTrialEvent(trial.tenantId, trial.subscriptionId, 'email_failed', {
          emailType: 'trial_expired',
          recipientEmail: trial.adminEmail,
          error: emailResult?.error || 'Unknown error',
          attemptedAt: new Date()
        });
      }

      console.log(`🎉 [${requestId}] Trial expiry processing completed!`);
      console.log(`⏱️ [${requestId}] Processing time: ${Logger.getDuration(startTime)}`);
      console.log(`🔄 [${requestId}] ========== EXPIRED TRIAL PROCESSED ==========\n`);

    } catch (err: unknown) {
      const error = err as Error;
      console.error(`❌ [${requestId}] Error handling expired trial:`, error);
      await this.recordTrialEvent(trial.tenantId, trial.subscriptionId ?? null, 'expiry_processing_failed', {
        error: error.message,
        stack: error.stack,
        attemptedAt: new Date()
      });
    }
  }

  // Handle expired paid plan - different from trial expiry
  async handleExpiredPaidPlan(subscription: TrialSubscriptionRow, parentRequestId: string | null = null): Promise<void> {
    const requestId = parentRequestId || Logger.generateRequestId('paid-plan-expire');
    
    try {
      console.log(`\n🔄 [${requestId}] ========== PROCESSING EXPIRED PAID PLAN ==========`);
      console.log(`🏢 [${requestId}] Tenant: ${subscription.tenantId}`);
      console.log(`📦 [${requestId}] Plan: ${subscription.plan}`);
      console.log(`📅 [${requestId}] Period End: ${subscription.currentPeriodEnd}`);

      // Update subscription to past_due
      await db
        .update(subscriptions)
        .set({
          status: 'past_due',
          updatedAt: new Date()
        })
        .where(eq(subscriptions.subscriptionId, subscription.subscriptionId));

      // Record the event
      await this.recordTrialEvent(subscription.tenantId, subscription.subscriptionId, 'paid_plan_expired', {
        expiredAt: new Date(),
        originalPeriodEnd: subscription.currentPeriodEnd,
        planType: subscription.plan
      });

      // Send plan expiry email
      await EmailService.sendPlanExpiredNotification({
        email: subscription.adminEmail ?? '',
        companyName: subscription.companyName ?? '',
        planName: subscription.plan,
        subscriptionId: subscription.subscriptionId
      });

      console.log(`🎉 [${requestId}] Paid plan expiry processing completed!`);

    } catch (error) {
      console.error(`❌ [${requestId}] Error handling expired paid plan:`, error);
    }
  }

  // Apply comprehensive trial restrictions
  async applyTrialRestrictions(tenantId: string): Promise<void> {
    try {
      console.log(`🔒 Applying trial restrictions for tenant: ${tenantId}`);
      
      // Record restriction event
      await this.recordTrialEvent(tenantId, null, 'restrictions_applied', {
        appliedAt: new Date(),
        restrictionTypes: [
          'dashboard_access',
          'user_management', 
          'analytics',
          'data_export',
          'api_access',
          'premium_features'
        ]
      });

      console.log(`✅ Trial restrictions applied for tenant: ${tenantId}`);
    } catch (error) {
      console.error(`❌ Error applying trial restrictions:`, error);
    }
  }

  // Check plan validity (for when professional plans expire and user wants starter)
  async checkPlanValidity() {
    try {
      console.log('🔍 Checking plan validity for all subscriptions...');
      
      // Find active paid plans that have expired
      const expiredPaidPlans = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, 'active'),
            lt(subscriptions.currentPeriodEnd, new Date()),
            or(
              eq(subscriptions.plan, 'professional'),
              eq(subscriptions.plan, 'starter'),
              eq(subscriptions.plan, 'enterprise')
            )
          )
        );

      for (const plan of expiredPaidPlans) {
        console.log(`⚠️ Plan validity expired for tenant: ${plan.tenantId}, plan: ${plan.plan}`);
        await this.handleExpiredPaidPlan(plan);
      }

    } catch (error) {
      console.error('❌ Error checking plan validity:', error);
    }
  }

  // Send trial reminders
  async sendTrialReminders() {
    const requestId = Logger.generateRequestId('trial-reminders');
    
    try {
      console.log('\n📧 ================ TRIAL REMINDERS STARTED ================');
      
      // Find trials expiring in next 3 days, 1 day, and 1 hour
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      
      const upcomingExpirations = (await db
        .select({
          subscriptionId: subscriptions.subscriptionId,
          tenantId: subscriptions.tenantId,
          plan: subscriptions.plan,
          trialEnd: subscriptions.currentPeriodEnd,
          companyName: tenants.companyName,
          adminEmail: tenants.adminEmail,
        })
        .from(subscriptions)
        .leftJoin(tenants, eq(subscriptions.tenantId, tenants.tenantId))
        .where(
          and(
            or(
              eq(subscriptions.status, 'trialing'),
              eq(subscriptions.plan, 'trial')
            ),
            lt(subscriptions.currentPeriodEnd, threeDaysFromNow),
            gt(subscriptions.currentPeriodEnd, new Date())
          )
        )) as TrialSubscriptionRow[];

      console.log(`🔍 [${requestId}] Found ${upcomingExpirations.length} trials expiring within 3 days`);

      for (const trial of upcomingExpirations) {
        const trialEnd = trial.trialEnd != null ? trial.trialEnd : null;
        if (trialEnd == null) continue;
        const timeUntilExpiry = new Date(trialEnd).getTime() - new Date().getTime();

        let reminderType = '';
        if (timeUntilExpiry <= 60 * 60 * 1000) { // 1 hour
          reminderType = 'urgent_1hour';
        } else if (timeUntilExpiry <= 24 * 60 * 60 * 1000) { // 1 day
          reminderType = 'warning_1day';
        } else if (timeUntilExpiry <= 3 * 24 * 60 * 60 * 1000) { // 3 days
          reminderType = 'notice_3days';
        }

        if (reminderType) {
          await this.sendReminderEmail(trial, reminderType, requestId);
        }
      }

      console.log(`🎉 [${requestId}] Trial reminders completed!`);
      console.log('📧 ================ TRIAL REMINDERS ENDED ================\n');

    } catch (error) {
      console.error('❌ Error sending trial reminders:', error);
    }
  }

  // Send individual reminder email
  async sendReminderEmail(trial: TrialSubscriptionRow, reminderType: string, parentRequestId: string | null = null): Promise<void> {
    const requestId = parentRequestId || Logger.generateRequestId('reminder-email');
    
    try {
      console.log(`📧 [${requestId}] Sending ${reminderType} reminder to: ${trial.adminEmail}`);

      let emailResult;
      const trialEnd = trial.trialEnd ?? new Date();
      const timeUntilExpiry = new Date(trialEnd).getTime() - new Date().getTime();
      const hoursRemaining = Math.ceil(timeUntilExpiry / (1000 * 60 * 60));

      switch (reminderType) {
        case 'urgent_1hour':
          emailResult = await EmailService.sendUrgentTrialReminder({
            tenantId: trial.tenantId,
            hoursRemaining,
            trialEnd: trialEnd,
            currentPlan: trial.plan
          });
          break;
        case 'warning_1day':
        case 'notice_3days':
          emailResult = await this.emailService.sendTrialReminderNotification({
            email: trial.adminEmail ?? '',
            companyName: trial.companyName ?? '',
            planName: trial.plan,
            expirationDate: trialEnd,
            subscriptionId: trial.subscriptionId
          });
          break;
      }

      if (emailResult && emailResult.success) {
        console.log(`✅ [${requestId}] Reminder email sent successfully`);
        await this.recordTrialEvent(trial.tenantId, trial.subscriptionId, 'reminder_sent', {
          reminderType,
          emailSent: true,
          recipientEmail: trial.adminEmail,
          hoursRemaining,
          sentAt: new Date()
        });
      } else {
        console.error(`❌ [${requestId}] Failed to send reminder email`);
        await this.recordTrialEvent(trial.tenantId, trial.subscriptionId, 'reminder_failed', {
          reminderType,
          emailSent: false,
          recipientEmail: trial.adminEmail,
          error: emailResult?.error || 'Unknown error',
          attemptedAt: new Date()
        });
      }

    } catch (error) {
      console.error(`❌ [${requestId}] Error sending reminder email:`, error);
    }
  }

  // Record trial events (separate from payments)
  async recordTrialEvent(tenantId: string, subscriptionId: string | null, eventType: string, eventData: Record<string, unknown> = {}): Promise<void> {
    try {
      // Use the trial_events table if it exists, otherwise store in a simple log
      await sql`
        INSERT INTO trial_events (tenant_id, subscription_id, event_type, event_data, created_at)
        VALUES (${tenantId}, ${subscriptionId}, ${eventType}, ${JSON.stringify(eventData)}, NOW())
        ON CONFLICT DO NOTHING;
      `;
      
      console.log(`📝 Recorded trial event: ${eventType} for tenant: ${tenantId}`);
    } catch {
      // If trial_events table doesn't exist, just log it
      console.log(`📝 Trial event (${eventType}):`, { tenantId, subscriptionId, eventData });
    }
  }

  // Quick check for middleware - comprehensive
  async isTrialExpired(tenantId: string): Promise<{ expired: boolean; reason: string; trialEnd?: Date | null; plan?: string; currentPeriodEnd?: Date | null; error?: string }> {
    try {
      const now = new Date();
      type SubRow = { status: string; trialEnd?: Date | null; currentPeriodEnd?: Date | null; plan: string; stripeSubscriptionId: string | null; hasEverUpgraded: boolean | null; trialToggledOff?: boolean };
      const [subscription] = (await db
        .select({
          status: subscriptions.status,
          trialEnd: subscriptions.currentPeriodEnd,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          plan: subscriptions.plan,
          stripeSubscriptionId: subscriptions.stripeSubscriptionId,
          hasEverUpgraded: subscriptions.hasEverUpgraded,
        })
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .orderBy(subscriptions.createdAt)
        .limit(1)) as SubRow[];

      if (!subscription) {
        return { expired: false, reason: 'no_subscription' };
      }

      // Check if user has ever upgraded (never show trial restrictions again)
      if (subscription.hasEverUpgraded) {
        return {
          expired: false,
          reason: 'user_has_upgraded_before',
          trialEnd: subscription.trialEnd ?? undefined,
          plan: subscription.plan
        };
      }

      // If it's an active paid plan with valid period, no trial restrictions
      const isPaidPlan = subscription.plan && 
                        subscription.plan !== 'trial' && 
                        subscription.plan !== 'free';

      if (isPaidPlan && subscription.status === 'active' && subscription.stripeSubscriptionId) {
        const periodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
        
        if (!periodEnd || periodEnd > now) {
          return {
            expired: false,
            reason: 'paid_plan_active_and_valid',
            trialEnd: subscription.trialEnd ?? undefined,
            plan: subscription.plan,
            currentPeriodEnd: subscription.currentPeriodEnd ?? undefined
          };
        }
      }

      // Check for past_due or suspended status (definitely expired)
      if (subscription.status === 'past_due' || subscription.status === 'suspended') {
        return {
          expired: true,
          reason: subscription.status === 'suspended' ? 'status_suspended' : 'status_past_due',
          trialEnd: subscription.trialEnd ?? undefined,
          plan: subscription.plan
        };
      }

      // Check trial end date
      const trialEndDate = subscription.trialEnd ? new Date(subscription.trialEnd) : null;

      if (trialEndDate && trialEndDate < now) {
        return {
          expired: true,
          reason: 'trial_end_passed',
          trialEnd: subscription.trialEnd ?? undefined,
          plan: subscription.plan
        };
      }

      // Check paid plan period end
      if (isPaidPlan && subscription.currentPeriodEnd) {
        const periodEnd = new Date(subscription.currentPeriodEnd);
        if (periodEnd < now) {
          return {
            expired: true,
            reason: 'paid_plan_period_expired',
            trialEnd: subscription.trialEnd ?? undefined,
            currentPeriodEnd: subscription.currentPeriodEnd ?? undefined,
            plan: subscription.plan
          };
        }
      }

      return {
        expired: false,
        reason: 'active',
        trialEnd: subscription.trialEnd ?? undefined,
        plan: subscription.plan
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error checking trial expiry:', error);
      return { expired: false, reason: 'check_failed', error: error.message };
    }
  }

  // Check if user has active paid subscription
  async hasActivePaidSubscription(tenantId: string): Promise<boolean> {
    try {
      const [subscription] = await db
        .select({
          status: subscriptions.status,
          plan: subscriptions.plan,
          stripeSubscriptionId: subscriptions.stripeSubscriptionId,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          hasEverUpgraded: subscriptions.hasEverUpgraded,
        })
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .orderBy(subscriptions.createdAt)
        .limit(1);

      if (!subscription) return false;

      // If user has ever upgraded, don't show trial restrictions
      if (subscription.hasEverUpgraded) return true;

      // Check for active paid subscription
      const isPaidPlan = subscription.plan && 
                        subscription.plan !== 'trial' && 
                        subscription.plan !== 'free';

      if (isPaidPlan && 
          subscription.status === 'active' && 
          subscription.stripeSubscriptionId) {
        
        // Check if subscription period is still valid
        if (subscription.currentPeriodEnd) {
          const periodEnd = new Date(subscription.currentPeriodEnd as Date | string);
          const now = new Date();
          return periodEnd > now;
        }
        
        return true; // Active paid subscription without period check
      }

      return false;
    } catch (error) {
      console.error('❌ Error checking paid subscription:', error);
      return false;
    }
  }

  // Manually expire a trial for testing
  async manuallyExpireTrial(tenantId: string): Promise<void> {
    try {
      console.log(`🔧 Manually expiring trial for tenant: ${tenantId}`);
      
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .limit(1);

      if (!subscription) {
        throw new Error('No subscription found for tenant');
      }

      // Update trial end to now (schema may have trial_end column)
      await db
        .update(subscriptions)
        .set({ trialEnd: new Date(), updatedAt: new Date() } as Record<string, unknown>)
        .where(eq(subscriptions.subscriptionId, subscription.subscriptionId));

      console.log(`✅ Trial manually expired for tenant: ${tenantId}`);
      
      // Trigger immediate expiration check
      await this.checkExpiredTrials();

    } catch (err: unknown) {
      console.error(`❌ Error manually expiring trial for tenant ${tenantId}:`, err);
      throw err;
    }
  }

  // Remove trial restrictions when user upgrades
  async removeTrialRestrictions(tenantId: string): Promise<void> {
    try {
      console.log(`🔓 Removing trial restrictions for tenant: ${tenantId}`);
      
      // Mark trial as toggled off to permanently disable restrictions (schema may have trial_toggled_off column)
      await db
        .update(subscriptions)
        .set({ trialToggledOff: true, hasEverUpgraded: true, updatedAt: new Date() } as Record<string, unknown>)
        .where(eq(subscriptions.tenantId, tenantId));

      await this.recordTrialEvent(tenantId, null, 'restrictions_removed', {
        removedAt: new Date(),
        reason: 'user_upgraded'
      });

      console.log(`✅ Trial restrictions permanently removed for tenant: ${tenantId}`);
    } catch (error) {
      console.error(`❌ Error removing trial restrictions:`, error);
    }
  }
}

const trialManager = new TrialManager();
export default trialManager;