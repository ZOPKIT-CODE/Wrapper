/**
 * Rate Limit Hook
 */

import { useState, useRef } from 'react';

interface UseRateLimitOptions {
  maxAttempts: number;
  windowMs: number;
}

const SESSION_STORAGE_KEY = 'onboarding_rate_limit';

function loadTimestamps(): number[] {
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed as number[];
      }
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

function saveTimestamps(timestamps: number[]): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(timestamps));
  } catch {
    // ignore storage errors
  }
}

export const useRateLimit = (options: UseRateLimitOptions) => {
  const { maxAttempts, windowMs } = options;

  const attemptsRef = useRef<number[]>(loadTimestamps());
  const [, forceUpdate] = useState(0);

  const getWindowAttempts = (): number[] => {
    const now = Date.now();
    return attemptsRef.current.filter((ts) => now - ts < windowMs);
  };

  const isRateLimited = getWindowAttempts().length >= maxAttempts;

  const recordAttempt = (): void => {
    const now = Date.now();
    const windowAttempts = getWindowAttempts();
    windowAttempts.push(now);
    attemptsRef.current = windowAttempts;
    saveTimestamps(windowAttempts);
    forceUpdate((n) => n + 1);
  };

  const getTimeUntilReset = (): number => {
    const windowAttempts = getWindowAttempts();
    if (windowAttempts.length === 0) return 0;
    const oldest = windowAttempts[0];
    return windowMs - (Date.now() - oldest);
  };

  return {
    isRateLimited,
    recordAttempt,
    getTimeUntilReset,
  };
};
