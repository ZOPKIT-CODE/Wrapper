import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../db/index.js';
import { eventTracking } from '../../../db/schema/index.js';
import { eq, and, gte, lte, like } from 'drizzle-orm';
import Logger from '../../../utils/logger.js';

interface TrackingMetadata {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  eventData?: Record<string, unknown>;
}

class OnboardingTrackingService {
  // Track onboarding phase completion/progress
  async trackOnboardingPhase(tenantId: string, phase: string, status: string, metadata: TrackingMetadata = {}): Promise<Record<string, unknown>> {
    try {
      Logger.log('info', 'general', 'trackOnboardingPhase', 'Tracking onboarding phase', { tenantId, phase, status });

      const {
        userId,
        sessionId,
        ipAddress,
        userAgent,
        eventData = {}
      } = metadata;

      const eventId = uuidv4();

      await db.insert(eventTracking).values({
        eventId,
        eventType: 'onboarding_phase_' + phase,
        tenantId: tenantId as unknown as string, // uuid column, value is already a uuid string
        streamKey: 'onboarding',
        sourceApplication: 'onboarding',
        targetApplication: 'platform',
        status: 'published',
        eventData: {
          phase,
          status,
          userId: userId ?? null,
          sessionId: sessionId ?? null,
          ...eventData
        },
        metadata: {
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null
        },
        publishedBy: userId ?? null
      });

      Logger.log('info', 'general', 'trackOnboardingPhase', 'Onboarding phase tracked', {
        trackingId: eventId,
        tenantId,
        phase,
        status,
        userId,
        sessionId
      });

      return {
        success: true,
        trackingId: eventId,
        tenantId,
        phase,
        status
      };

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'trackOnboardingPhase', 'Error tracking onboarding phase', { error: error.message });
      throw error;
    }
  }

  // Get onboarding progress for a tenant
  async getOnboardingProgress(tenantId: string): Promise<Record<string, unknown>> {
    try {
      Logger.log('info', 'general', 'getOnboardingProgress', 'Getting onboarding progress for tenant', { tenantId });

      const rows = await db.select()
        .from(eventTracking)
        .where(
          and(
            eq(eventTracking.tenantId, tenantId as unknown as string),
            like(eventTracking.eventType, 'onboarding_phase_%'),
            eq(eventTracking.status, 'published')
          )
        );

      // Extract completed phases from eventData
      const completedPhases = new Set<string>();
      for (const row of rows) {
        const data = row.eventData as { phase?: string; status?: string } | null;
        if (data && data.status === 'completed' && data.phase) {
          completedPhases.add(data.phase);
        }
      }

      const totalPhases = ['profile', 'payment', 'upgrade', 'trial'];
      const completedCount = completedPhases.size;
      const progressPercentage = (completedCount / totalPhases.length) * 100;
      const completedPhaseList = Array.from(completedPhases);

      const progress = {
        tenantId,
        totalPhases: totalPhases.length,
        completedPhases: completedCount,
        progressPercentage: Math.round(progressPercentage),
        completedPhaseList,
        remainingPhases: totalPhases.filter(phase => !completedPhases.has(phase)),
        lastUpdated: new Date().toISOString()
      };

      Logger.log('info', 'general', 'getOnboardingProgress', 'Onboarding progress calculated', { progress });
      return progress;

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'getOnboardingProgress', 'Error getting onboarding progress', { error: error.message });
      throw error;
    }
  }

  // Get onboarding analytics
  async getOnboardingAnalytics(tenantId: string, options: { startDate?: string | Date; endDate?: string | Date; phase?: string } = {}): Promise<Record<string, unknown>> {
    try {
      const { startDate, endDate, phase } = options;

      Logger.log('info', 'general', 'getOnboardingAnalytics', 'Getting onboarding analytics', { tenantId, phase, startDate, endDate });

      const conditions = [
        eq(eventTracking.tenantId, tenantId as unknown as string),
        like(eventTracking.eventType, 'onboarding_phase_%')
      ];

      if (startDate) {
        conditions.push(gte(eventTracking.createdAt, new Date(startDate)) as ReturnType<typeof eq>);
      }
      if (endDate) {
        conditions.push(lte(eventTracking.createdAt, new Date(endDate)) as ReturnType<typeof eq>);
      }
      if (phase) {
        conditions.push(eq(eventTracking.eventType, 'onboarding_phase_' + phase));
      }

      const rows = await db.select()
        .from(eventTracking)
        .where(and(...conditions));

      // Group by eventType (phase)
      const phasesCompleted: Record<string, Record<string, number>> = {};
      for (const row of rows) {
        const phaseName = row.eventType.replace('onboarding_phase_', '');
        const data = row.eventData as { status?: string } | null;
        const phaseStatus = data?.status ?? 'unknown';

        if (!phasesCompleted[phaseName]) {
          phasesCompleted[phaseName] = {};
        }
        phasesCompleted[phaseName][phaseStatus] = (phasesCompleted[phaseName][phaseStatus] ?? 0) + 1;
      }

      const analytics: Record<string, unknown> = {
        tenantId,
        totalEvents: rows.length,
        phasesCompleted,
        averageCompletionTime: 0,
        completionRates: {},
        generatedAt: new Date().toISOString()
      };

      Logger.log('info', 'general', 'getOnboardingAnalytics', 'Onboarding analytics generated', { analytics });
      return analytics;

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'getOnboardingAnalytics', 'Error getting onboarding analytics', { error: error.message });
      throw error;
    }
  }
}

export { OnboardingTrackingService };
export default new OnboardingTrackingService();
