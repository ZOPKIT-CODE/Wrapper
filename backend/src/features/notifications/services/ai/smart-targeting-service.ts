import { aiServiceFactory } from './ai-service-factory.js';
import { TenantFilterService } from '../../../../services/tenant-filter-service.js';
import { db } from '../../../../db/index.js';
import { tenants, notifications } from '../../../../db/schema/index.js';
import { sql } from 'drizzle-orm';
import Logger from '../../../../utils/logger.js';

interface NotificationContent { title?: string; message?: string; type?: string; [k: string]: unknown }
interface SuggestOptions { maxSuggestions?: number; includeReasoning?: boolean; useHistoricalData?: boolean }
interface AnalysisRecord { type?: string; industry?: string; companySize?: string; subscriptionTier?: string; [k: string]: unknown }

/**
 * AI Smart Targeting Service
 * Uses AI to suggest optimal tenants for notifications
 */
class SmartTargetingService {
  private filterService: TenantFilterService;

  constructor() {
    this.filterService = new TenantFilterService();
  }

  /**
   * Suggest target tenants based on notification content
   */
  async suggestTargets(notificationContent: NotificationContent, options: SuggestOptions = {}): Promise<Record<string, unknown>> {
    const {
      maxSuggestions = 50,
      includeReasoning = true,
      useHistoricalData = true
    } = options;

    try {
      // Analyze notification content
      const analysis = await this._analyzeContent(notificationContent);

      // Get historical success patterns if enabled
      const historicalPatterns = useHistoricalData 
        ? await this._getHistoricalPatterns(analysis)
        : null;

      // Generate targeting criteria
      const criteria = await this._generateTargetingCriteria(
        notificationContent,
        analysis,
        historicalPatterns
      );

      // Get matching tenants
      const tenantIds = await this.filterService.filterTenants(criteria);

      // Rank tenants by relevance
      const rankedTenants = await this._rankTenants(
        tenantIds.slice(0, maxSuggestions * 2), // Get more for ranking
        notificationContent,
        analysis
      );

      const suggestions = rankedTenants.slice(0, maxSuggestions).map((tenant, index) => ({
        tenantId: tenant.tenantId,
        companyName: tenant.companyName,
        relevanceScore: tenant.score,
        rank: index + 1,
        reasoning: includeReasoning ? tenant.reasoning : undefined
      }));

      return {
        suggestions,
        totalMatches: tenantIds.length,
        criteria,
        analysis
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'ai', 'suggest-targets', 'Error suggesting targets', { message: error.message, stack: error.stack });
      throw new Error(`Smart targeting failed: ${error.message}`);
    }
  }

  /**
   * Recommend optimal send time for a tenant
   */
  async recommendSendTime(tenantId: string, notificationContent: NotificationContent): Promise<Record<string, unknown>> {
    try {
      // Get tenant's historical notification engagement
      const engagementData = await this._getTenantEngagement(tenantId);

      // Analyze best send times
      const prompt = `Based on this tenant's notification engagement data:
${JSON.stringify(engagementData)}

And this notification content:
${JSON.stringify(notificationContent)}

Recommend the optimal send time (day of week and hour) for maximum engagement.
Consider timezone, industry norms, and historical patterns.

Return JSON: { "dayOfWeek": "Monday", "hour": 10, "timezone": "UTC", "reasoning": "..." }`;

      const result = await aiServiceFactory.generateCompletion(prompt, {
        temperature: 0.5,
        maxTokens: 300
      });

      // Parse AI response
      const recommendation = this._parseSendTimeRecommendation(result.text);

      return {
        ...recommendation,
        tenantId
      };
    } catch (err: unknown) {
      Logger.log('error', 'ai', 'recommend-send-time', 'Error recommending send time', { tenantId, error: err });
      return {
        tenantId,
        dayOfWeek: 'Monday',
        hour: 10,
        timezone: 'UTC',
        reasoning: 'Default recommendation'
      };
    }
  }

  /**
   * Analyze notification content for targeting
   */
  async _analyzeContent(content: NotificationContent): Promise<Record<string, unknown>> {
    const prompt = `Analyze this notification content and extract key targeting signals:

Title: ${content.title}
Message: ${content.message}
Type: ${content.type || 'general'}

Extract:
1. Target industry (if mentioned or implied)
2. Target company size
3. Target subscription tier
4. Urgency level
5. Key topics/themes

Return JSON format.`;

    try {
      const result = await aiServiceFactory.generateCompletion(prompt, {
        temperature: 0.3,
        maxTokens: 400
      });

      return this._parseAnalysis(result.text);
    } catch (err: unknown) {
      Logger.log('error', 'ai', 'analyze-content', 'Error analyzing content', { error: err });
      return {};
    }
  }

  /**
   * Get historical success patterns
   */
  async _getHistoricalPatterns(analysis: AnalysisRecord): Promise<Record<string, { total: number; read: number }>> {
    try {
      // Query notifications with similar characteristics
      const similarNotifications = await db
        .select({
          tenantId: notifications.tenantId,
          isRead: notifications.isRead,
          type: notifications.type,
          priority: notifications.priority
        })
        .from(notifications)
        .where(
          sql`${notifications.type} = ${analysis.type || 'system_update'} 
          AND ${notifications.createdAt} > now() - interval '30 days'`
        )
        .limit(1000);

      // Calculate read rates by tenant
      const tenantReadRates: Record<string, { total: number; read: number }> = {};
      similarNotifications.forEach(notif => {
        if (!tenantReadRates[notif.tenantId]) {
          tenantReadRates[notif.tenantId] = { total: 0, read: 0 };
        }
        tenantReadRates[notif.tenantId].total++;
        if (notif.isRead) {
          tenantReadRates[notif.tenantId].read++;
        }
      });

      return tenantReadRates;
    } catch (err: unknown) {
      Logger.log('error', 'ai', 'get-historical-patterns', 'Error getting historical patterns', { error: err });
      return {};
    }
  }

  /**
   * Generate targeting criteria from analysis
   */
  async _generateTargetingCriteria(_content: NotificationContent, analysis: AnalysisRecord, _historicalPatterns: Record<string, { total: number; read: number }> | null): Promise<Record<string, unknown>> {
    const criteria: Record<string, unknown> = {};

    if (analysis.industry) {
      criteria.industry = analysis.industry;
    }

    if (analysis.companySize) {
      criteria.companySize = analysis.companySize;
    }

    // Add other criteria based on analysis
    if (analysis.subscriptionTier) {
      criteria.subscriptionTier = analysis.subscriptionTier;
    }

    return criteria;
  }

  /**
   * Rank tenants by relevance
   */
  async _rankTenants(tenantIds: string[], content: NotificationContent, analysis: AnalysisRecord): Promise<Array<Record<string, unknown> & { tenantId: string; companyName: string | null; score: number; reasoning: string }>> {
    if (tenantIds.length === 0) {
      return [];
    }

    // Get tenant details
    const tenantDetails = await db
      .select({
        tenantId: tenants.tenantId,
        companyName: tenants.companyName,
        industry: tenants.industry,
        organizationSize: tenants.organizationSize,
        isActive: tenants.isActive
      })
      .from(tenants)
      .where(sql`${tenants.tenantId} = ANY(${tenantIds})`);

    // Rank using simple scoring (can be enhanced with AI)
    const ranked = tenantDetails.map(tenant => {
      let score = 0.5; // Base score

      // Industry match
      if (analysis.industry && tenant.industry?.toLowerCase().includes(analysis.industry.toLowerCase())) {
        score += 0.2;
      }

      // Size match
      if (analysis.companySize && tenant.organizationSize === analysis.companySize) {
        score += 0.1;
      }

      // Active status
      if (tenant.isActive) {
        score += 0.1;
      }

      return {
        ...tenant,
        score,
        reasoning: this._generateReasoning(tenant, analysis)
      };
    });

    return ranked.sort((a, b) => b.score - a.score);
  }

  /**
   * Generate reasoning for tenant match
   */
  _generateReasoning(tenant: { industry?: string | null; organizationSize?: string | null; isActive?: boolean | null }, analysis: AnalysisRecord): string {
    const reasons = [];

    if (analysis.industry && tenant.industry?.toLowerCase().includes(analysis.industry.toLowerCase())) {
      reasons.push(`Industry match: ${tenant.industry}`);
    }

    if (analysis.companySize && tenant.organizationSize === analysis.companySize) {
      reasons.push(`Company size match: ${tenant.organizationSize}`);
    }

    if (tenant.isActive) {
      reasons.push('Active tenant');
    }

    return reasons.join(', ') || 'General match';
  }

  /**
   * Get tenant engagement data
   */
  async _getTenantEngagement(tenantId: string): Promise<{ total: number; read: number; avgHoursToRead: number | null }> {
    try {
      const stats = await db
        .select({
          total: sql`count(*)`,
          read: sql`count(case when ${notifications.isRead} = true then 1 end)`,
          avgHoursToRead: sql`avg(extract(epoch from (${notifications.updatedAt} - ${notifications.createdAt}))/3600)`
        })
        .from(notifications)
        .where(
          sql`${notifications.tenantId} = ${tenantId} 
          AND ${notifications.createdAt} > now() - interval '30 days'`
        );

      return (stats[0] as { total: number; read: number; avgHoursToRead: number | null }) || { total: 0, read: 0, avgHoursToRead: null };
    } catch (err: unknown) {
      Logger.log('error', 'ai', 'get-tenant-engagement', 'Error getting tenant engagement', { error: err });
      return { total: 0, read: 0, avgHoursToRead: null };
    }
  }

  /**
   * Parse analysis result
   */
  _parseAnalysis(text: string): Record<string, unknown> {
    try {
      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (err: unknown) {
      Logger.log('error', 'ai', 'parse-analysis', 'Error parsing analysis', { error: err });
      return {};
    }
  }

  /**
   * Parse send time recommendation
   */
  _parseSendTimeRecommendation(text: string): Record<string, unknown> {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {
        dayOfWeek: 'Monday',
        hour: 10,
        timezone: 'UTC',
        reasoning: 'Default recommendation'
      };
    } catch (err: unknown) {
      Logger.log('error', 'ai', 'parse-send-time-recommendation', 'Error parsing send time recommendation', { error: err });
      return {
        dayOfWeek: 'Monday',
        hour: 10,
        timezone: 'UTC',
        reasoning: 'Default recommendation'
      };
    }
  }
}

export const smartTargetingService = new SmartTargetingService();
export default smartTargetingService;











