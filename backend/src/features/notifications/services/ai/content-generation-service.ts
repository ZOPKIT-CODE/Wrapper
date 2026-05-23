import { aiServiceFactory } from './ai-service-factory.js';
import Logger from '../../../../utils/logger.js';

type Tone = 'professional' | 'casual' | 'urgent' | 'friendly';
type Length = 'short' | 'medium' | 'long';
interface GenContentOptions { tone?: Tone; length?: Length; language?: string; variables?: Record<string, string>; template?: Record<string, string> | null }

/**
 * AI Content Generation Service
 * Generates notification content using AI
 */
class ContentGenerationService {
  /**
   * Generate notification content from prompt
   */
  async generateContent(prompt: string, options: GenContentOptions = {}): Promise<Record<string, unknown>> {
    const {
      tone = 'professional',
      length = 'medium',
      language = 'en',
      variables = {},
      template = null
    } = options;

    const systemPrompt = this._buildSystemPrompt(tone, length, language);
    const fullPrompt = template 
      ? this._buildTemplatePrompt(prompt, template, variables)
      : this._buildSimplePrompt(prompt, variables);

    try {
      const result = await aiServiceFactory.generateCompletion(fullPrompt, {
        systemPrompt,
        temperature: 0.7,
        maxTokens: this._getMaxTokens(length)
      });

      return {
        content: result.text,
        title: this._extractTitle(result.text),
        message: this._extractMessage(result.text),
        provider: result.provider,
        usage: result.usage
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'ai', 'generate-content', 'Error generating content', { message: error.message, stack: error.stack });
      throw new Error(`Content generation failed: ${error.message}`);
    }
  }

  /**
   * Generate content based on template structure
   */
  async generateFromTemplate(template: Record<string, string>, variables: Record<string, string> = {}, options: GenContentOptions = {}): Promise<Record<string, unknown>> {
    const prompt = `Generate notification content using this template structure:
Title: ${template.title}
Message: ${template.message}

Variables to use: ${JSON.stringify(variables)}
Generate a new version with the same structure but personalized content.`;

    return await this.generateContent(prompt, {
      ...options,
      template,
      variables
    });
  }

  /**
   * Generate multiple variants for A/B testing
   */
  async generateVariants(prompt: string, count = 3, options: GenContentOptions = {}): Promise<Array<Record<string, unknown>>> {
    const variants = [];

    for (let i = 0; i < count; i++) {
      try {
        const variant = await this.generateContent(prompt, {
          ...options
        });
        variants.push({
          ...variant,
          variantId: i + 1
        });
      } catch (err: unknown) {
        Logger.log('error', 'ai', 'generate-variants', `Error generating variant ${i + 1}`, { variantIndex: i + 1, error: err });
      }
    }

    return variants;
  }

  /**
   * Build system prompt
   */
  _buildSystemPrompt(tone: Tone, length: Length, language: string): string {
    const toneInstructions: Record<string, string> = {
      professional: 'Use a professional, formal tone',
      casual: 'Use a casual, friendly tone',
      urgent: 'Use an urgent, attention-grabbing tone',
      friendly: 'Use a warm, friendly tone'
    };

    const lengthInstructions: Record<string, string> = {
      short: 'Keep it concise (1-2 sentences)',
      medium: 'Use moderate length (2-4 sentences)',
      long: 'Provide detailed information (4+ sentences)'
    };

    return `You are a notification content generator. 
${toneInstructions[tone as string] || toneInstructions.professional}
${lengthInstructions[length as string] || lengthInstructions.medium}
Generate clear, actionable notification content.
Format: Title on first line, Message on following lines.
Language: ${language}`;
  }

  /**
   * Build simple prompt
   */
  _buildSimplePrompt(prompt: string, variables: Record<string, string>): string {
    let fullPrompt = prompt;

    // Inject variables
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      fullPrompt = fullPrompt.replace(regex, String(variables[key]));
    });

    return fullPrompt;
  }

  /**
   * Build template-based prompt
   */
  _buildTemplatePrompt(prompt: string, template: Record<string, string>, variables: Record<string, string>): string {
    return `Based on this notification template:
Title: ${template.title}
Message: ${template.message}

And this context: ${prompt}

Generate new notification content following the template structure.
Use these variables: ${JSON.stringify(variables)}`;
  }

  /**
   * Extract title from generated content
   */
  _extractTitle(content: string): string {
    const lines = content.split('\n').filter((l: string) => l.trim());
    return lines[0]?.replace(/^title:?\s*/i, '').trim() || 'Notification';
  }

  /**
   * Extract message from generated content
   */
  _extractMessage(content: string): string {
    const lines = content.split('\n').filter((l: string) => l.trim());
    if (lines.length > 1) {
      return lines.slice(1).join('\n').trim();
    }
    return content.trim();
  }

  /**
   * Get max tokens based on length
   */
  _getMaxTokens(length: Length): number {
    const limits: Record<string, number> = {
      short: 200,
      medium: 500,
      long: 1000
    };
    return limits[length as string] ?? limits.medium;
  }
}

export const contentGenerationService = new ContentGenerationService();
export default contentGenerationService;











