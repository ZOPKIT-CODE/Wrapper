/**
 * Onboarding Logger - Persists logs to localStorage so you can debug issues.
 * Logs are saved under key ONBOARDING_LOGS and can be viewed/copied after a session.
 *
 * How to view logs:
 * 1. In browser console: JSON.parse(localStorage.getItem('ONBOARDING_LOGS') || '[]')
 * 2. Or copy as text: copy(JSON.parse(localStorage.getItem('ONBOARDING_LOGS')||'[]').map(e=>e.ts+' ['+e.level+'] '+e.message+(e.data?' '+JSON.stringify(e.data):'')).join('\n'))
 * 3. From code: import { onboardingLogger } from '...'; onboardingLogger.getLogsAsString()
 */

const STORAGE_KEY = 'ONBOARDING_LOGS';
const MAX_ENTRIES = 500;
const MAX_SIZE_BYTES = 100 * 1024; // 100KB

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

const IS_DEV = import.meta.env.DEV;

function getEntries(): LogEntry[] {
  if (!IS_DEV) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setEntries(entries: LogEntry[]): void {
  if (!IS_DEV) return;
  try {
    let json = JSON.stringify(entries);
    while (json.length > MAX_SIZE_BYTES && entries.length > 1) {
      entries = entries.slice(-Math.floor(entries.length / 2));
      json = JSON.stringify(entries);
    }
    localStorage.setItem(STORAGE_KEY, json);
  } catch (e) {
    console.warn('[OnboardingLogger] Failed to persist logs:', e);
  }
}

function append(level: LogLevel, message: string, data?: unknown): void {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(data !== undefined && { data }),
  };
  const entries = getEntries();
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  setEntries(entries);

  const prefix = `[Onboarding ${level.toUpperCase()}]`;
  if (level === 'error') {
    console.error(prefix, message, data ?? '');
  } else if (level === 'warn') {
    console.warn(prefix, message, data ?? '');
  }
}

export const onboardingLogger = {
  info(message: string, data?: unknown): void {
    append('info', message, data);
  },
  warn(message: string, data?: unknown): void {
    append('warn', message, data);
  },
  error(message: string, data?: unknown): void {
    append('error', message, data);
  },
  debug(message: string, data?: unknown): void {
    append('debug', message, data);
  },
  /** Get all persisted logs (for copying/debugging). */
  getLogs(): LogEntry[] {
    return getEntries();
  },
  /** Get logs as a single string (e.g. for pasting into a ticket). */
  getLogsAsString(): string {
    return getEntries()
      .map((e) => `${e.ts} [${e.level}] ${e.message}${e.data != null ? ' ' + JSON.stringify(e.data) : ''}`)
      .join('\n');
  },
  /** Clear persisted logs. */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};

// Remove any logs left from a previous dev session when running in production.
if (!IS_DEV) {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
