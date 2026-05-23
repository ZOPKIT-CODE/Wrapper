/**
 * Exponential backoff retry utility for external API calls.
 * Retries on transient errors (network, 429, 503) with jitter.
 */

interface RetryOptions {
  maxAttempts?: number;     // default 3
  baseDelayMs?: number;     // default 500
  maxDelayMs?: number;      // default 10_000
  shouldRetry?: (err: unknown) => boolean;
}

function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as Record<string, unknown>;
  // Network errors
  const code = e['code'] as string | undefined;
  if (code && ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNABORTED', 'EPIPE'].includes(code)) return true;
  // HTTP status errors (axios/fetch style)
  const status = (e['response'] as Record<string, unknown> | undefined)?.['status'] as number | undefined
                 ?? e['status'] as number | undefined
                 ?? e['statusCode'] as number | undefined;
  if (status !== undefined && (status === 429 || status >= 500)) return true;
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 10_000,
    shouldRetry = isTransientError,
  } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      if (attempt === maxAttempts || !shouldRetry(err)) throw err;
      // Exponential backoff with full jitter
      const exp = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const jitter = Math.random() * exp;
      await delay(jitter);
    }
  }
  throw lastError;
}
