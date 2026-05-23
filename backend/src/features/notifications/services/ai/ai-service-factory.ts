import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import Logger from '../../../../utils/logger.js';

type ProviderName = 'openai' | 'anthropic';
interface CostEntry { requests: number; tokens: number; cost: number; }
interface GenOptions { model?: string | null; temperature?: number; maxTokens?: number; systemPrompt?: string | null; }
interface GenResult { text: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number }; model: string; }

/**
 * AI Service Factory
 * Provides abstraction layer for multiple AI providers with fallback support
 */
class AIServiceFactory {
  private providers: Record<string, OpenAI | Anthropic> = {};
  private primaryProvider: string = process.env.AI_PROVIDER || 'openai';
  private fallbackEnabled: boolean = process.env.AI_FALLBACK_ENABLED === 'true';
  private costTracking: Record<string, CostEntry> = {
    openai: { requests: 0, tokens: 0, cost: 0 },
    anthropic: { requests: 0, tokens: 0, cost: 0 }
  };

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize AI providers
   */
  initializeProviders() {
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        this.providers.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        Logger.log('info', 'ai', 'initialize-providers', '✅ OpenAI provider initialized');
      } catch (error) {
        Logger.log('error', 'ai', 'initialize-providers', '❌ Failed to initialize OpenAI', { error });
      }
    }

    // Initialize Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        this.providers.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        });
        Logger.log('info', 'ai', 'initialize-providers', '✅ Anthropic provider initialized');
      } catch (error) {
        Logger.log('error', 'ai', 'initialize-providers', '❌ Failed to initialize Anthropic', { error });
      }
    }
  }

  /**
   * Get provider instance
   */
  getProvider(name: string | null = null): OpenAI | Anthropic {
    const providerName = name || this.primaryProvider;
    
    if (!this.providers[providerName]) {
      if (this.fallbackEnabled) {
        // Try fallback provider
        const fallbackName = providerName === 'openai' ? 'anthropic' : 'openai';
        if (this.providers[fallbackName]) {
          Logger.log('warning', 'ai', 'get-provider', `⚠️ Provider ${providerName} not available, using fallback: ${fallbackName}`, { providerName, fallbackName });
          return this.providers[fallbackName];
        }
      }
      throw new Error(`AI provider ${providerName} not available`);
    }

    return this.providers[providerName];
  }

  /**
   * Generate completion with automatic fallback
   */
  async generateCompletion(prompt: string, options: GenOptions & { provider?: string | null } = {}): Promise<GenResult & { provider: string }> {
    const {
      provider = null,
      model = null,
      temperature = 0.7,
      maxTokens = 1000,
      systemPrompt = null
    } = options;

    const providersToTry = provider 
      ? [provider, ...(this.fallbackEnabled ? [provider === 'openai' ? 'anthropic' : 'openai'] : [])]
      : [this.primaryProvider, ...(this.fallbackEnabled ? [this.primaryProvider === 'openai' ? 'anthropic' : 'openai'] : [])];

    let lastError = null;

    for (const providerName of providersToTry) {
      try {
        const result = await this._generateWithProvider(
          providerName,
          prompt,
          { model, temperature, maxTokens, systemPrompt }
        );

        // Track costs
        this._trackCost(providerName, result);

        return {
          ...result,
          provider: providerName
        };
      } catch (err: unknown) {
        const error = err as Error;
        Logger.log('error', 'ai', 'generate-completion', `❌ Error with provider ${providerName}: ${error.message}`, { providerName, stack: error.stack });
        lastError = error;
        continue;
      }
    }

    throw new Error(`All AI providers failed. Last error: ${(lastError as Error)?.message}`);
  }

  /**
   * Generate with specific provider
   */
  async _generateWithProvider(providerName: string, prompt: string, options: GenOptions): Promise<GenResult> {
    const { model, temperature, maxTokens, systemPrompt } = options;

    if (providerName === 'openai') {
      const provider = this.getProvider(providerName) as OpenAI;
      const openaiModel = model || 'gpt-3.5-turbo';
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: prompt });
      const response = await provider.chat.completions.create({
        model: openaiModel,
        messages,
        temperature,
        max_tokens: maxTokens
      });

      return {
        text: response.choices[0]?.message?.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: (response.usage?.total_tokens ?? (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0))
        },
        model: openaiModel
      };
    } else if (providerName === 'anthropic') {
      const provider = this.getProvider(providerName) as Anthropic;
      const anthropicModel = model || 'claude-3-haiku-20240307';
      const messages = [{ role: 'user' as const, content: prompt }];
      const system = systemPrompt || undefined;
      const response = await provider.messages.create({
        model: anthropicModel,
        max_tokens: maxTokens ?? 1000,
        temperature: temperature ?? 0.7,
        system,
        messages
      }) as { content: Array<{ text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
      const firstBlock = response.content?.[0];
      const text = firstBlock && 'text' in firstBlock ? firstBlock.text ?? '' : '';

      return {
        text: text || '',
        usage: {
          promptTokens: response.usage?.input_tokens ?? 0,
          completionTokens: response.usage?.output_tokens ?? 0,
          totalTokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)
        },
        model: anthropicModel
      };
    }

    throw new Error(`Unsupported provider: ${providerName}`);
  }

  /**
   * Track costs per provider
   */
  _trackCost(providerName: string, result: GenResult): void {
    if (!this.costTracking[providerName]) {
      this.costTracking[providerName] = { requests: 0, tokens: 0, cost: 0 };
    }

    const tracking = this.costTracking[providerName];
    tracking.requests++;
    const totalTokens = result.usage.totalTokens ?? (result.usage.promptTokens + result.usage.completionTokens);
    tracking.tokens += totalTokens;

    // Estimate cost (rough estimates, adjust based on actual pricing)
    if (providerName === 'openai') {
      tracking.cost += totalTokens * 0.000002;
    } else if (providerName === 'anthropic') {
      tracking.cost += totalTokens * 0.00000025;
    }
  }

  /**
   * Get cost statistics
   */
  getCostStats(): Record<string, CostEntry | { total: CostEntry }> {
    return {
      ...this.costTracking,
      total: {
        requests: Object.values(this.costTracking).reduce((sum, p: CostEntry) => sum + p.requests, 0),
        tokens: Object.values(this.costTracking).reduce((sum, p: CostEntry) => sum + p.tokens, 0),
        cost: Object.values(this.costTracking).reduce((sum, p: CostEntry) => sum + p.cost, 0)
      }
    };
  }

  /**
   * Check provider availability
   */
  isProviderAvailable(providerName: string): boolean {
    return !!this.providers[providerName];
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    return Object.keys(this.providers);
  }
}

export const aiServiceFactory = new AIServiceFactory();
export default aiServiceFactory;











