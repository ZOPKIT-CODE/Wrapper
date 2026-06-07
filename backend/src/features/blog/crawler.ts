/**
 * User-Agent detection for search/social/AI crawlers that don't run JavaScript,
 * so they get the server-rendered HTML instead of the empty SPA shell.
 * Covers Google/Bing, social unfurlers (Facebook/Twitter/Slack/Discord/LinkedIn/
 * WhatsApp/Telegram), and AI bots (GPTBot/ClaudeBot/PerplexityBot/etc.).
 */
const CRAWLER_RE = new RegExp(
  [
    // search engines
    'googlebot', 'google-inspectiontool', 'google-extended', 'bingbot', 'slurp',
    'duckduckbot', 'baiduspider', 'yandex', 'sogou', 'exabot', 'applebot',
    // social / link unfurlers
    'facebookexternalhit', 'facebot', 'twitterbot', 'slackbot', 'slack-imgproxy',
    'discordbot', 'linkedinbot', 'whatsapp', 'telegrambot', 'pinterest',
    'redditbot', 'embedly', 'quora link preview', 'skypeuripreview', 'vkshare',
    'bitlybot', 'nuzzel', 'flipboard',
    // AI crawlers
    'gptbot', 'chatgpt-user', 'oai-searchbot', 'claudebot', 'claude-web',
    'anthropic-ai', 'perplexitybot', 'amazonbot', 'bytespider', 'ccbot', 'cohere-ai',
  ].join('|'),
  'i',
);

export function isCrawler(userAgent: string | undefined | null): boolean {
  return !!userAgent && CRAWLER_RE.test(userAgent);
}
