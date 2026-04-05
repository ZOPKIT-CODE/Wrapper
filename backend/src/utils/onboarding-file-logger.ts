/**
 * 📝 **ONBOARDING FILE LOGGER**
 * 
 * Specialized logger for onboarding flow that writes to files
 * for easy debugging and bug tracking.
 * 
 * Features:
 * - Creates separate log file per onboarding session
 * - Structured JSON logs with timestamps
 * - Log levels: INFO, SUCCESS, WARNING, ERROR, DEBUG
 * - Automatic log rotation and cleanup
 * - Easy to parse and review
 * 
 * Usage:
 *   const logger = new OnboardingFileLogger('onboarding-session-id');
 *   logger.info('Step 1: Creating tenant', { tenantId: '...' });
 *   logger.error('Failed to create organization', error);
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logs directory relative to backend root
const LOGS_DIR = path.join(__dirname, '../../logs/onboarding');

// Ensure logs directory exists
async function ensureLogsDirectory(): Promise<void> {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  } catch (error: unknown) {
    console.error('Failed to create logs directory:', (error as Error).message);
  }
}

// Initialize logs directory on module load
ensureLogsDirectory();

interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  sessionId: string;
  message: string;
  source?: string;
  data?: Record<string, unknown>;
  error?: Record<string, unknown>;
}

export class OnboardingFileLogger {
  sessionId: string;
  metadata: Record<string, unknown> & { startTime: string };
  logFile: string | null = null;
  logBuffer: LogEntry[] = [];
  flushInterval: ReturnType<typeof setInterval> | null = null;
  initialized = false;
  consoleIntercepted = false;
  private _consoleIntercepted = false;
  originalConsole: {
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };

  constructor(sessionId: string | null = null, metadata: Record<string, unknown> = {}) {
    this.sessionId = sessionId || this.generateSessionId();
    this.metadata = {
      startTime: new Date().toISOString(),
      ...metadata
    };
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console)
    };
    
    // Initialize log file (async, but we'll intercept console after)
    this.initializeLogFile().then(() => {
      // Intercept console methods to capture ALL logs after initialization
      if (!this.consoleIntercepted) {
        this.interceptConsole();
        this.consoleIntercepted = true;
      }
    });
    
    // Also intercept immediately (will work once initialized)
    this.interceptConsole();
    this.consoleIntercepted = true;
  }

  /**
   * Generate unique session ID
   */
  generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `onboarding_${timestamp}_${random}`;
  }

  /**
   * Initialize log file
   */
  async initializeLogFile(): Promise<void> {
    try {
      await ensureLogsDirectory();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `onboarding_${this.sessionId}_${timestamp}.log`;
      this.logFile = path.join(LOGS_DIR, filename);
      
      // Write initial metadata
      const header = {
        type: 'ONBOARDING_LOG_HEADER',
        sessionId: this.sessionId,
        metadata: this.metadata,
        timestamp: new Date().toISOString()
      };
      
      await fs.appendFile(this.logFile, JSON.stringify(header) + '\n');
      
      // Start periodic flush
      this.flushInterval = setInterval(() => this.flush(), 2000); // Flush every 2 seconds
      
      this.initialized = true;
      this.info('logger', 'Logger initialized', { logFile: this.logFile });
    } catch (error: unknown) {
      console.error('Failed to initialize log file:', error);
      // Fallback to console logging
      this.initialized = false;
    }
  }

  /**
   * Intercept console methods to capture ALL console output
   */
  interceptConsole(): void {
    // Only intercept once per instance
    if (this._consoleIntercepted) {
      return;
    }
    this._consoleIntercepted = true;

    let isCapturing = false; // Prevent infinite loops

    // Intercept console.log
    const originalLog = console.log;
    console.log = (...args) => {
      if (!isCapturing && this.initialized) {
        isCapturing = true;
        this.captureConsoleOutput('info', 'console', args);
        isCapturing = false;
      }
      originalLog(...args);
    };

    // Intercept console.error
    const originalError = console.error;
    console.error = (...args) => {
      if (!isCapturing && this.initialized) {
        isCapturing = true;
        this.captureConsoleOutput('error', 'console', args);
        isCapturing = false;
      }
      originalError(...args);
    };

    // Intercept console.warn
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (!isCapturing && this.initialized) {
        isCapturing = true;
        this.captureConsoleOutput('warning', 'console', args);
        isCapturing = false;
      }
      originalWarn(...args);
    };

    // Intercept console.info
    const originalInfo = console.info;
    console.info = (...args) => {
      if (!isCapturing && this.initialized) {
        isCapturing = true;
        this.captureConsoleOutput('info', 'console', args);
        isCapturing = false;
      }
      originalInfo(...args);
    };

    // Intercept console.debug
    const originalDebug = console.debug;
    console.debug = (...args) => {
      if (!isCapturing && this.initialized) {
        isCapturing = true;
        this.captureConsoleOutput('debug', 'console', args);
        isCapturing = false;
      }
      originalDebug(...args);
    };
  }

  /**
   * Capture console output and convert to log entry
   */
  captureConsoleOutput(level: string, category: string, args: unknown[]): void {
    try {
      // Convert console arguments to string message
      let message = '';
      let data: Record<string, unknown> = {};
      
      args.forEach((arg: unknown, index: number) => {
        if (typeof arg === 'string') {
          message += (message ? ' ' : '') + arg;
        } else if (arg instanceof Error) {
          message += (message ? ' ' : '') + arg.message;
          data.error = {
            message: arg.message,
            stack: arg.stack,
            name: arg.name,
            code: (arg as Error & { code?: string }).code
          };
        } else if (typeof arg === 'object' && arg !== null) {
          // If it's the first object and message is empty, try to extract message
          const obj = arg as Record<string, unknown>;
          if (!message && index === 0 && obj.message) {
            message = String(obj.message);
          }
          // Merge object data
          data = { ...data, ...obj };
        } else {
          message += (message ? ' ' : '') + String(arg);
        }
      });
      
      // If no message extracted, create one from data
      if (!message && Object.keys(data).length > 0) {
        message = JSON.stringify(data);
      } else if (!message) {
        message = args.map((a: unknown) => String(a)).join(' ');
      }
      
      // Determine category from message content
      let detectedCategory = category;
      const messageLower = message.toLowerCase();
      
      if (messageLower.includes('kinde') || messageLower.includes('🔑')) {
        detectedCategory = 'kinde';
      } else if (messageLower.includes('database') || messageLower.includes('db') || messageLower.includes('💾')) {
        detectedCategory = 'database';
      } else if (messageLower.includes('credit') || messageLower.includes('💰')) {
        detectedCategory = 'credit';
      } else if (messageLower.includes('subscription') || messageLower.includes('💳')) {
        detectedCategory = 'subscription';
      } else if (messageLower.includes('role') || messageLower.includes('🔐')) {
        detectedCategory = 'role';
      } else if (messageLower.includes('user') || messageLower.includes('👤')) {
        detectedCategory = 'user';
      } else if (messageLower.includes('onboarding') || messageLower.includes('🚀')) {
        detectedCategory = 'onboarding';
      } else if (messageLower.includes('validation') || messageLower.includes('✅')) {
        detectedCategory = 'validation';
      } else if (messageLower.includes('api') || messageLower.includes('🌐')) {
        detectedCategory = 'api';
      }
      
      // Create log entry
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        category: detectedCategory,
        sessionId: this.sessionId,
        message: message,
        source: 'console',
        ...(Object.keys(data).length > 0 && { data })
      };
      
      // Add to buffer
      this.logBuffer.push(logEntry);
      
      // Flush if buffer is large
      if (this.logBuffer.length >= 10) {
        this.flush();
      }
    } catch (captureError) {
      // Don't break console if capture fails
      this.originalConsole.error('Failed to capture console output:', captureError);
    }
  }

  /**
   * Restore original console methods
   */
  restoreConsole(): void {
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
    console.debug = this.originalConsole.debug;
  }

  /**
   * Write log entry
   */
  async writeLog(level: string, category: string, message: string, data: Record<string, unknown> = {}, error: Error | null = null): Promise<void> {
    const errObj = error as (Error & { response?: { status: number; statusText: string; data: unknown } }) | null;
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      category,
      sessionId: this.sessionId,
      message,
      ...(Object.keys(data).length > 0 && { data }),
      ...(errObj && {
        error: {
          message: errObj.message,
          stack: errObj.stack,
          name: errObj.name,
          code: (errObj as Error & { code?: string }).code,
          ...(errObj.response && {
            response: {
              status: errObj.response.status,
              statusText: errObj.response.statusText,
              data: errObj.response.data
            }
          })
        }
      })
    };

    // Add to buffer
    this.logBuffer.push(logEntry);

    // Also log to console with emoji (use original console to avoid recursion)
    const emoji = this.getEmoji(level, category);
    const consoleMessage = `${emoji} [${this.sessionId}] ${category}: ${message}`;
    
    if (level === 'error') {
      this.originalConsole.error(consoleMessage);
      if (error) {
        this.originalConsole.error('Error details:', error);
      }
    } else if (level === 'warning') {
      this.originalConsole.warn(consoleMessage);
    } else {
      this.originalConsole.log(consoleMessage);
    }

    // If buffer is large, flush immediately
    if (this.logBuffer.length >= 10) {
      await this.flush();
    }
  }

  /**
   * Flush buffer to file
   */
  async flush(): Promise<void> {
    if (!this.initialized || this.logBuffer.length === 0 || !this.logFile) {
      return;
    }

    try {
      const entries = this.logBuffer.map((entry: LogEntry) => JSON.stringify(entry)).join('\n') + '\n';
      await fs.appendFile(this.logFile, entries);
      this.logBuffer = [];
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Get emoji for log level/category
   */
  getEmoji(level: string, category: string): string {
    const emojiMap: Record<string, string> = {
      info: '📋',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      debug: '🔍',
      onboarding: '🚀',
      kinde: '🔑',
      database: '💾',
      credit: '💰',
      subscription: '💳',
      role: '🔐',
      user: '👤',
      validation: '✅',
      api: '🌐'
    };
    
    return (emojiMap[category] ?? emojiMap[level]) || '📋';
  }

  /**
   * Log levels
   */
  info(category: string, message: string, data: Record<string, unknown> = {}): Promise<void> {
    return this.writeLog('info', category, message, data);
  }

  success(category: string, message: string, data: Record<string, unknown> = {}): Promise<void> {
    return this.writeLog('success', category, message, data);
  }

  warning(category: string, message: string, data: Record<string, unknown> = {}): Promise<void> {
    return this.writeLog('warning', category, message, data);
  }

  error(category: string, message: string, error: Error | null = null, data: Record<string, unknown> = {}): Promise<void> {
    return this.writeLog('error', category, message, data, error);
  }

  debug(category: string, message: string, data: Record<string, unknown> = {}): Promise<void> {
    return this.writeLog('debug', category, message, data);
  }

  /**
   * Specialized onboarding methods
   */
  onboarding = {
    start: (data: Record<string, unknown> = {}) => {
      return this.writeLog('info', 'onboarding', '🚀 ONBOARDING STARTED', data);
    },

    step: (stepNumber: number, stepName: string, description: string, data: Record<string, unknown> = {}) => {
      return this.writeLog('info', 'onboarding', `Step ${stepNumber}: ${stepName} - ${description}`, {
        stepNumber,
        stepName,
        ...data
      });
    },

    success: (message: string, data: Record<string, unknown> = {}) => {
      return this.writeLog('success', 'onboarding', message, data);
    },

    error: (message: string, error: Error | null = null, data: Record<string, unknown> = {}) => {
      return this.writeLog('error', 'onboarding', message, data, error);
    },

    warning: (message: string, data: Record<string, unknown> = {}) => {
      return this.writeLog('warning', 'onboarding', message, data);
    }
  };

  /**
   * Kinde operations
   */
  kinde = {
    start: (operation: string, data: Record<string, unknown> = {}) => {
      return this.writeLog('info', 'kinde', `Kinde: ${operation}`, data);
    },

    success: (operation: string, data: Record<string, unknown> = {}) => {
      return this.writeLog('success', 'kinde', `Kinde: ${operation} - Success`, data);
    },

    error: (operation: string, error: Error, data: Record<string, unknown> = {}) => {
      return this.writeLog('error', 'kinde', `Kinde: ${operation} - Failed`, data, error);
    }
  };

  /**
   * Database operations
   */
  database = {
    query: (operation: string, table: string, data: Record<string, unknown> = {}) => {
      return this.writeLog('debug', 'database', `DB Query: ${operation} on ${table}`, data);
    },

    success: (operation: string, table: string, data: Record<string, unknown> = {}) => {
      return this.writeLog('success', 'database', `DB Success: ${operation} on ${table}`, data);
    },

    error: (operation: string, table: string, error: Error, data: Record<string, unknown> = {}) => {
      return this.writeLog('error', 'database', `DB Error: ${operation} on ${table}`, data, error);
    }
  };

  /**
   * Credit operations
   */
  credit = {
    allocation: (message: string, data: Record<string, unknown> = {}) => {
      return this.writeLog('info', 'credit', `Credit Allocation: ${message}`, data);
    },

    success: (message: string, data: Record<string, unknown> = {}) => {
      return this.writeLog('success', 'credit', `Credit Success: ${message}`, data);
    },

    error: (message: string, error: Error, data: Record<string, unknown> = {}) => {
      return this.writeLog('error', 'credit', `Credit Error: ${message}`, data, error);
    }
  };

  /**
   * Finalize logging session
   */
  async finalize(result: Record<string, unknown> = {}): Promise<{ sessionId: string; logFile: string | null }> {
    // Restore original console methods
    this.restoreConsole();
    
    // Flush remaining buffer
    await this.flush();

    // Write footer
    const footer = {
      type: 'ONBOARDING_LOG_FOOTER',
      sessionId: this.sessionId,
      endTime: new Date().toISOString(),
      result,
      duration: this.getDuration() as string
    };

    try {
      if (this.logFile) {
        await fs.appendFile(this.logFile, JSON.stringify(footer) + '\n');
      }
      
      // Clear flush interval
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
      }

      // Use original console for final message
      this.originalConsole.log(`✅ [${this.sessionId}] Logger finalized - Log file: ${this.logFile}`);
      
      return {
        sessionId: this.sessionId,
        logFile: this.logFile
      };
    } catch (error) {
      this.originalConsole.error('Failed to finalize log file:', error);
      return { sessionId: this.sessionId, logFile: null };
    }
  }

  /**
   * Get duration since start
   */
  getDuration(): string {
    const start = new Date(this.metadata.startTime as string);
    const end = new Date();
    return `${(end.getTime() - start.getTime())}ms`;
  }

  /**
   * Get log file path
   */
  getLogFilePath(): string | null {
    return this.logFile;
  }
}

/**
 * Utility function to read and parse log file
 */
export async function parseLogFile(logFilePath: string): Promise<{
  header: unknown;
  logs: unknown[];
  footer: unknown;
  summary: { totalLogs: number; errors: number; warnings: number; successes: number };
}> {
  try {
    const content = await fs.readFile(logFilePath, 'utf-8');
    const lines = content.trim().split('\n');
    
    const logs = [];
    let header = null;
    let footer = null;

    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const entry = JSON.parse(line);
        
        if (entry.type === 'ONBOARDING_LOG_HEADER') {
          header = entry;
        } else if (entry.type === 'ONBOARDING_LOG_FOOTER') {
          footer = entry;
        } else {
          logs.push(entry);
        }
      } catch (_parseError) {
        // Skip invalid JSON lines
        console.warn('Failed to parse log line:', line);
      }
    }

    return {
      header,
      logs,
      footer,
      summary: {
        totalLogs: logs.length,
        errors: logs.filter((l: { level?: string }) => l.level === 'ERROR').length,
        warnings: logs.filter((l: { level?: string }) => l.level === 'WARNING').length,
        successes: logs.filter((l: { level?: string }) => l.level === 'SUCCESS').length
      }
    };
  } catch (error: unknown) {
    throw new Error(`Failed to parse log file: ${(error as Error).message}`);
  }
}

/**
 * Utility function to list all onboarding log files
 */
export async function listLogFiles(limit = 50): Promise<Array<{ filename: string; path: string }>> {
  try {
    await ensureLogsDirectory();
    const files = await fs.readdir(LOGS_DIR);
    
    const logFiles = files
      .filter(file => file.endsWith('.log'))
      .map(file => ({
        filename: file,
        path: path.join(LOGS_DIR, file)
      }))
      .sort((a, b) => b.filename.localeCompare(a.filename)) // Most recent first
      .slice(0, limit);

    return logFiles;
  } catch (error) {
    console.error('Failed to list log files:', error);
    return [];
  }
}

/**
 * Utility function to get latest log file
 */
export async function getLatestLogFile(): Promise<{ filename: string; path: string } | null> {
  const files = await listLogFiles(1);
  return files.length > 0 ? files[0] : null;
}

export default OnboardingFileLogger;

