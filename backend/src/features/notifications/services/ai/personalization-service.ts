import { aiServiceFactory } from './ai-service-factory.js';
import { db } from '../../../../db/index.js';
import { tenants } from '../../../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import Logger from '../../../../utils/logger.js';

interface BaseContent { title: string; message: string; [k: string]: unknown }
interface PersonalizeOptions { additionalContext?: Record<string, unknown>; temperature?: number }

/**
 * AI Personalization Service
 * Personalizes notification content based on tenant data
 */
class PersonalizationService {
  /**
   * Personalize notification content for a tenant
   */
  async personalizeContent(tenantId: string, baseContent: BaseContent, options: PersonalizeOptions = {}): Promise<Record<string, unknown>> {
    try {
      // Get tenant data
      const tenantData = await this._getTenantData(tenantId);
      
      if (!tenantData) {
        return baseContent; // Return original if tenant not found
      }

      // Build personalization context
      const context = this._buildContext(tenantData, options);

      // Generate personalized content
      const prompt = this._buildPersonalizationPrompt(baseContent, context);

      const result = await aiServiceFactory.generateCompletion(prompt, {
        systemPrompt: 'You are a notification personalization expert. Adapt notification content to match the tenant\'s context while maintaining the original intent and tone.',
        temperature: 0.6,
        maxTokens: 500
      });

      return {
        title: this._extractTitle(result.text) || baseContent.title,
        message: this._extractMessage(result.text) || baseContent.message,
        personalized: true,
        context: context,
        provider: result.provider
      };
    } catch (err: unknown) {
      Logger.log('error', 'ai', 'personalize-content', 'Error personalizing content', { error: err });
      return baseContent as unknown as Record<string, unknown>;
    }
  }

  /**
   * Personalize for multiple tenants (batch)
   */
  async personalizeBatch(tenantIds: string[], baseContent: BaseContent, options: PersonalizeOptions = {}): Promise<Array<Record<string, unknown>>> {
    const results = [];

    for (const tenantId of tenantIds) {
      try {
        const personalized = await this.personalizeContent(tenantId, baseContent, options);
        results.push({
          tenantId,
          ...personalized
        });
      } catch (err: unknown) {
        const error = err as Error;
        Logger.log('error', 'ai', 'personalize-batch', `Error personalizing for tenant ${tenantId}`, { tenantId, message: error.message, stack: error.stack });
        results.push({
          tenantId,
          ...baseContent,
          personalized: false,
          error: error.message
        } as Record<string, unknown>);
      }
    }

    return results;
  }

  /**
   * Generate A/B test variants with personalization
   */
  async generatePersonalizedVariants(tenantId: string, baseContent: BaseContent, variantCount = 3): Promise<Array<Record<string, unknown>>> {
    const variants = [];

    for (let i = 0; i < variantCount; i++) {
      try {
        const variant = await this.personalizeContent(tenantId, baseContent, {
          temperature: 0.7 + (i * 0.1) // Vary for diversity
        });
        variants.push({
          ...variant,
          variantId: i + 1
        });
      } catch (error) {
        Logger.log('error', 'ai', 'generate-personalized-variants', `Error generating variant ${i + 1}`, { variantIndex: i + 1, error });
      }
    }

    return variants;
  }

  /**
   * Get tenant data for personalization
   */
  async _getTenantData(tenantId: string): Promise<Record<string, unknown> | null> {
    try {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      return tenant as unknown as Record<string, unknown>;
    } catch (err: unknown) {
      Logger.log('error', 'ai', 'get-tenant-data', 'Error fetching tenant data', { error: err });
      return null;
    }
  }

  /**
   * Build personalization context
   */
  _buildContext(tenantData: Record<string, unknown>, options: PersonalizeOptions = {}): Record<string, unknown> {
    const context: Record<string, unknown> = {
      companyName: tenantData.companyName,
      industry: tenantData.industry,
      organizationSize: tenantData.organizationSize,
      isActive: tenantData.isActive,
      isVerified: tenantData.isVerified
    };

    const now = new Date();
    context.timeOfDay = this._getTimeOfDay(now);
    context.dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

    if (options.additionalContext) {
      Object.assign(context, options.additionalContext);
    }

    return context;
  }

  /**
   * Build personalization prompt
   */
  _buildPersonalizationPrompt(baseContent: BaseContent, context: Record<string, unknown>): string {
    return `Personalize this notification content for the following tenant:

Tenant Context:
- Company: ${context.companyName}
- Industry: ${context.industry || 'Not specified'}
- Size: ${context.organizationSize || 'Not specified'}
- Time: ${context.timeOfDay} on ${context.dayOfWeek}

Original Notification:
Title: ${baseContent.title}
Message: ${baseContent.message}

Generate a personalized version that:
1. Maintains the original intent and tone
2. References the company name naturally
3. Adapts to the industry context if relevant
4. Feels tailored to this specific tenant

Return the personalized title and message.`;
  }

  /**
   * Extract title from AI response
   */
  _extractTitle(content: string): string | null {
    const lines = content.split('\n').filter((l: string) => l.trim());
    const titleLine = lines.find((l: string) => /title:?/i.test(l));
    if (titleLine) {
      return titleLine.replace(/title:?\s*/i, '').trim();
    }
    return lines[0]?.trim() || null;
  }

  /**
   * Extract message from AI response
   */
  _extractMessage(content: string): string {
    const lines = content.split('\n').filter((l: string) => l.trim());
    const messageStart = lines.findIndex((l: string) => /message:?/i.test(l));
    if (messageStart >= 0) {
      return lines.slice(messageStart + 1).join('\n').trim();
    }
    // If no message label, assume everything after first line is message
    return lines.slice(1).join('\n').trim() || content.trim();
  }

  /**
   * Get time of day category
   */
  _getTimeOfDay(date: Date): string {
    const hour = date.getHours();
    if (hour < 6) return 'early morning';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    if (hour < 22) return 'evening';
    return 'night';
  }
}

export const personalizationService = new PersonalizationService();
export default personalizationService;











