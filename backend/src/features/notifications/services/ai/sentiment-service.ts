import { aiServiceFactory } from './ai-service-factory.js';
import Logger from '../../../../utils/logger.js';

interface SentimentContent { title?: string; message?: string; type?: string; priority?: string; [k: string]: unknown }
interface SentimentOptions { includeSuggestions?: boolean; detectUrgency?: boolean; checkTone?: boolean }

/**
 * AI Sentiment Analysis Service
 * Analyzes notification content for sentiment, tone, and potential issues
 */
class SentimentService {
  /**
   * Analyze notification content
   */
  async analyzeSentiment(content: SentimentContent, options: SentimentOptions = {}): Promise<Record<string, unknown>> {
    const {
      includeSuggestions = true,
      detectUrgency = true,
      checkTone = true
    } = options;

    try {
      const prompt = this._buildAnalysisPrompt(content, {
        includeSuggestions,
        detectUrgency,
        checkTone
      });

      const result = await aiServiceFactory.generateCompletion(prompt, {
        systemPrompt: 'You are an expert in communication analysis. Analyze notification content for sentiment, tone, urgency, and potential issues. Provide actionable feedback.',
        temperature: 0.3,
        maxTokens: 500
      });

      const analysis = this._parseAnalysis(result.text);

      return {
        ...analysis,
        provider: result.provider,
        analyzedAt: new Date().toISOString()
      };
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'ai', 'analyze-sentiment', 'Error analyzing sentiment', { message: error.message, stack: error.stack });
      throw new Error(`Sentiment analysis failed: ${error.message}`);
    }
  }

  /**
   * Quick sentiment check (lightweight)
   */
  async quickCheck(content: SentimentContent): Promise<Record<string, unknown>> {
    try {
      const prompt = `Quickly analyze this notification content and return ONLY a JSON object:
{
  "sentimentScore": 0-100,
  "sentiment": "positive|neutral|negative",
  "urgency": "low|medium|high",
  "hasIssues": true|false
}

Content:
Title: ${content.title}
Message: ${content.message}`;

      const result = await aiServiceFactory.generateCompletion(prompt, {
        temperature: 0.2,
        maxTokens: 200
      });

      return this._parseQuickCheck(result.text);
    } catch (err: unknown) {
      Logger.log('error', 'ai', 'quick-check', 'Error in quick sentiment check', { error: err });
      return {
        sentimentScore: 50,
        sentiment: 'neutral',
        urgency: 'medium',
        hasIssues: false
      };
    }
  }

  /**
   * Check for problematic content
   */
  async checkForIssues(content: SentimentContent): Promise<Record<string, unknown>> {
    try {
      const prompt = `Analyze this notification content for potential issues:
- Negative or harsh language
- Unclear messaging
- Missing important information
- Tone problems
- Accessibility issues

Title: ${content.title}
Message: ${content.message}

Return JSON:
{
  "hasIssues": true|false,
  "issues": ["issue1", "issue2"],
  "severity": "low|medium|high",
  "suggestions": ["suggestion1", "suggestion2"]
}`;

      const result = await aiServiceFactory.generateCompletion(prompt, {
        temperature: 0.3,
        maxTokens: 400
      });

      return this._parseIssues(result.text);
    } catch (error) {
      Logger.log('error', 'ai', 'check-for-issues', 'Error checking for issues', { error });
      return {
        hasIssues: false,
        issues: [],
        severity: 'low',
        suggestions: []
      };
    }
  }

  /**
   * Build analysis prompt
   */
  _buildAnalysisPrompt(content: SentimentContent, options: SentimentOptions): string {
    let prompt = `Analyze this notification content comprehensively:

Title: ${content.title}
Message: ${content.message}
${content.type ? `Type: ${content.type}` : ''}
${content.priority ? `Priority: ${content.priority}` : ''}

Analyze:`;

    if (options.checkTone) {
      prompt += '\n- Tone and sentiment (positive/neutral/negative)';
    }

    if (options.detectUrgency) {
      prompt += '\n- Urgency level (low/medium/high)';
    }

    prompt += '\n- Clarity and readability';
    prompt += '\n- Potential issues or concerns';
    prompt += '\n- Overall effectiveness';

    if (options.includeSuggestions) {
      prompt += '\n- Suggestions for improvement';
    }

    prompt += '\n\nReturn JSON format with detailed analysis.';

    return prompt;
  }

  /**
   * Parse full analysis result
   */
  _parseAnalysis(text: string): Record<string, unknown> {
    try {
      // Try to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          sentimentScore: parsed.sentimentScore || 50,
          sentiment: parsed.sentiment || 'neutral',
          urgency: parsed.urgency || 'medium',
          tone: parsed.tone || 'neutral',
          clarity: parsed.clarity || 'medium',
          hasIssues: parsed.hasIssues || false,
          issues: parsed.issues || [],
          suggestions: parsed.suggestions || [],
          effectiveness: parsed.effectiveness || 'medium',
          summary: parsed.summary || ''
        };
      }

      // Fallback: extract key information from text
      return this._extractFromText(text);
    } catch (err: unknown) {
      Logger.log('error', 'ai', 'parse-analysis', 'Error parsing analysis', { error: err });
      return this._defaultAnalysis();
    }
  }

  /**
   * Parse quick check result
   */
  _parseQuickCheck(text: string): Record<string, unknown> {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return this._defaultQuickCheck();
    } catch (err: unknown) {
      Logger.log('error', 'ai', 'parse-quick-check', 'Error parsing quick check', { error: err });
      return this._defaultQuickCheck();
    }
  }

  /**
   * Parse issues check result
   */
  _parseIssues(text: string): Record<string, unknown> {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {
        hasIssues: false,
        issues: [],
        severity: 'low',
        suggestions: []
      };
    } catch (err: unknown) {
      Logger.log('error', 'ai', 'parse-issues', 'Error parsing issues', { error: err });
      return {
        hasIssues: false,
        issues: [],
        severity: 'low',
        suggestions: []
      };
    }
  }

  /**
   * Extract analysis from text (fallback)
   */
  _extractFromText(text: string): Record<string, unknown> {
    const analysis = this._defaultAnalysis();

    // Try to extract sentiment
    if (/positive|good|great|excellent/i.test(text)) {
      analysis.sentiment = 'positive';
      analysis.sentimentScore = 70;
    } else if (/negative|bad|poor|terrible/i.test(text)) {
      analysis.sentiment = 'negative';
      analysis.sentimentScore = 30;
    }

    // Try to extract urgency
    if (/urgent|immediate|asap|critical/i.test(text)) {
      analysis.urgency = 'high';
    } else if (/low|minor|optional/i.test(text)) {
      analysis.urgency = 'low';
    }

    return analysis;
  }

  /**
   * Default analysis
   */
  _defaultAnalysis(): Record<string, unknown> {
    return {
      sentimentScore: 50,
      sentiment: 'neutral',
      urgency: 'medium',
      tone: 'neutral',
      clarity: 'medium',
      hasIssues: false,
      issues: [],
      suggestions: [],
      effectiveness: 'medium',
      summary: ''
    };
  }

  /**
   * Default quick check
   */
  _defaultQuickCheck(): Record<string, unknown> {
    return {
      sentimentScore: 50,
      sentiment: 'neutral',
      urgency: 'medium',
      hasIssues: false
    };
  }
}

export const sentimentService = new SentimentService();
export default sentimentService;











