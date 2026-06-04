/* eslint-disable no-console */
/**
 * Enhanced Logging Utility
 * Provides structured logging for debugging onboarding, user management, roles, billing, and Stripe operations
 */

import pino from 'pino';
import { getTraceFields } from './trace-context.js';

// pino replaces winston (fleet-standard logger — matches CRM/FA). The `mixin`
// injects the active OTel span's trace_id/span_id into every record for log↔trace
// correlation. JSON to stdout in prod; pretty-printed in dev. The public Logger
// API below is unchanged, so its 150+ call sites are untouched.
const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  mixin: () => getTraceFields(),
  ...(process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname', translateTime: 'SYS:standard' } } }
    : {}),
});

class Logger {
  colors: Record<string, string> = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
  };

  constructor() {}

  // Generate unique request ID
  generateRequestId(prefix = 'req'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Format timestamp
  getTimestamp(): string {
    return new Date().toISOString();
  }

  // Get formatted duration
  getDuration(startTime: number): string {
    return `${Date.now() - startTime}ms`;
  }

  // Base logging method with context
  log(level: string, category: string, requestId: string, message: string, data: Record<string, unknown> = {}): void {
    const timestamp = this.getTimestamp();
    const emoji = this.getEmoji(level, category);
    
    baseLogger.info(`\n${emoji} [${requestId}] ${category}: ${message}`);
    baseLogger.info(`⏰ Timestamp: ${timestamp}`);

    if (Object.keys(data).length > 0) {
      baseLogger.info(`📊 Data: ${JSON.stringify(data, null, 2)}`);
    }
  }

  // Get emoji based on level and category
  getEmoji(level: string, category: string): string {
    const emojiMap: Record<string, string> = {
      // Levels
      'info': '📋',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌',
      'debug': '🔍',
      
      // Categories
      'onboarding': '🚀',
      'user': '👤',
      'role': '🔐',
      'billing': '💳',
      'stripe': '🟢',
      'database': '💾',
      'kinde': '🔑',
      'email': '📧',
      'validation': '✅',
      'transaction': '🔄'
    };
    
    return (emojiMap[category] ?? emojiMap[level]) ?? '📋';
  }

  // Onboarding specific logs
  onboarding = {
    start: (requestId: string, data: Record<string, unknown>) => {
      baseLogger.info('\n🚀 =================== ONBOARDING STARTED ===================');
      baseLogger.info(`📋 Request ID: ${requestId}`);
      baseLogger.info(`⏰ Timestamp: ${this.getTimestamp()}`);
      baseLogger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
      baseLogger.info(`📦 Request Data: ${JSON.stringify(data, null, 2)}`);
    },

    step: (requestId: string, stepNumber: number, description: string, data: Record<string, unknown> = {}) => {
      baseLogger.info(`\n🔄 [${requestId}] Step ${stepNumber}: ${description}`);
      if (Object.keys(data).length > 0) {
        baseLogger.info(`📊 [${requestId}] Data: ${JSON.stringify(data, null, 2)}`);
      }
    },

    success: (requestId: string, message: string, data: Record<string, unknown> = {}) => {
      baseLogger.info(`✅ [${requestId}] ${message}`);
      if (Object.keys(data).length > 0) {
        baseLogger.info(`📊 [${requestId}] Result: ${JSON.stringify(data, null, 2)}`);
      }
    },

    error: (requestId: string, message: string, error: Error & { code?: string; statusCode?: number }, startTime: number) => {
      baseLogger.error(`❌ [${requestId}] ${message}`);
      baseLogger.error(`📋 [${requestId}] Error: ${error.message}`);
      if (error.code) baseLogger.error(`🔢 [${requestId}] Error Code: ${error.code}`);
      if (error.statusCode) baseLogger.error(`🌐 [${requestId}] Status Code: ${error.statusCode}`);
      if (error.stack) baseLogger.error(`📋 [${requestId}] Stack: ${error.stack}`);
      baseLogger.info(`⏱️ [${requestId}] Failed after ${this.getDuration(startTime)}`);
    },

    complete: (requestId: string, startTime: number, data: Record<string, unknown> = {}) => {
      baseLogger.info(`\n🎉 [${requestId}] ONBOARDING COMPLETED SUCCESSFULLY!`);
      baseLogger.info(`⏱️ [${requestId}] Total Duration: ${this.getDuration(startTime)}`);
      if (Object.keys(data).length > 0) {
        baseLogger.info(`📊 [${requestId}] Final Result: ${JSON.stringify(data, null, 2)}`);
      }
      baseLogger.info('🚀 =================== ONBOARDING ENDED ===================\n');
    }
  };

  // User management logs
  user = {
    invitation: {
      start: (requestId: string, data: Record<string, unknown>) => {
        baseLogger.info('\n👤 ================ USER INVITATION STARTED ================');
        baseLogger.info(`📋 Request ID: ${requestId}`);
        baseLogger.info(`⏰ Timestamp: ${this.getTimestamp()}`);
        baseLogger.info(`📧 Invitation Data: ${JSON.stringify(data, null, 2)}`);
      },

      step: (requestId: string, step: string, description: string, data: Record<string, unknown> = {}) => {
        baseLogger.info(`\n📧 [${requestId}] ${step}: ${description}`);
        if (Object.keys(data).length > 0) {
          baseLogger.info(`📊 [${requestId}] Data: ${JSON.stringify(data, null, 2)}`);
        }
      },

      success: (requestId: string, startTime: number, data: Record<string, unknown> = {}) => {
        baseLogger.info(`\n✅ [${requestId}] USER INVITATION COMPLETED!`);
        baseLogger.info(`⏱️ [${requestId}] Duration: ${this.getDuration(startTime)}`);
        baseLogger.info(`📊 [${requestId}] Result: ${JSON.stringify(data, null, 2)}`);
        baseLogger.info('👤 ================ USER INVITATION ENDED ================\n');
      },

      error: (requestId: string, error: Error, startTime: number) => {
        baseLogger.error(`\n❌ [${requestId}] USER INVITATION FAILED!`);
        baseLogger.error(`📋 [${requestId}] Error: ${error.message}`);
        baseLogger.info(`⏱️ [${requestId}] Failed after ${this.getDuration(startTime)}`);
        baseLogger.info('👤 ================ USER INVITATION ENDED ================\n');
      }
    }
  };

  // Role management logs
  role = {
    create: {
      start: (requestId: string, data: Record<string, unknown>) => {
        baseLogger.info('\n🔐 ================ ROLE CREATION STARTED ================');
        baseLogger.info(`📋 Request ID: ${requestId}`);
        baseLogger.info(`⏰ Timestamp: ${this.getTimestamp()}`);
        baseLogger.info(`🔐 Role Data: ${JSON.stringify(data, null, 2)}`);
      },

      step: (requestId: string, step: string, description: string, data: Record<string, unknown> = {}) => {
        baseLogger.info(`\n🔐 [${requestId}] ${step}: ${description}`);
        if (Object.keys(data).length > 0) {
          baseLogger.info(`📊 [${requestId}] Data: ${JSON.stringify(data, null, 2)}`);
        }
      },

      success: (requestId: string, startTime: number, data: Record<string, unknown> = {}) => {
        baseLogger.info(`\n✅ [${requestId}] ROLE CREATED SUCCESSFULLY!`);
        baseLogger.info(`⏱️ [${requestId}] Duration: ${this.getDuration(startTime)}`);
        baseLogger.info(`📊 [${requestId}] Role: ${JSON.stringify(data, null, 2)}`);
        baseLogger.info('🔐 ================ ROLE CREATION ENDED ================\n');
      }
    },

    assign: {
      start: (requestId: string, data: Record<string, unknown>) => {
        baseLogger.info('\n👥 ================ ROLE ASSIGNMENT STARTED ================');
        baseLogger.info(`📋 Request ID: ${requestId}`);
        baseLogger.info(`⏰ Timestamp: ${this.getTimestamp()}`);
        baseLogger.info(`👥 Assignment Data: ${JSON.stringify(data, null, 2)}`);
      },

      success: (requestId: string, startTime: number, data: Record<string, unknown> = {}) => {
        baseLogger.info(`\n✅ [${requestId}] ROLE ASSIGNED SUCCESSFULLY!`);
        baseLogger.info(`⏱️ [${requestId}] Duration: ${this.getDuration(startTime)}`);
        baseLogger.info(`📊 [${requestId}] Assignment: ${JSON.stringify(data, null, 2)}`);
        baseLogger.info('👥 ================ ROLE ASSIGNMENT ENDED ================\n');
      }
    }
  };

  // Billing and Stripe logs
  billing = {
    start: (requestId: string, operation: string, data: Record<string, unknown>) => {
      baseLogger.info(`\n💳 ================ ${operation.toUpperCase()} STARTED ================`);
      baseLogger.info(`📋 Request ID: ${requestId}`);
      baseLogger.info(`⏰ Timestamp: ${this.getTimestamp()}`);
      baseLogger.info(`💳 Billing Data: ${JSON.stringify(data, null, 2)}`);
    },

    stripe: {
      request: (requestId: string, method: string, endpoint: string, data: Record<string, unknown> = {}) => {
        baseLogger.info(`\n🟢 [${requestId}] Stripe API Request:`);
        baseLogger.info(`🌐 [${requestId}] Method: ${method}`);
        baseLogger.info(`🔗 [${requestId}] Endpoint: ${endpoint}`);
        if (Object.keys(data).length > 0) {
          baseLogger.info(`📊 [${requestId}] Payload: ${JSON.stringify(data, null, 2)}`);
        }
      },

      response: (requestId: string, status: number | string, data: Record<string, unknown> = {}) => {
        baseLogger.info(`🟢 [${requestId}] Stripe API Response:`);
        baseLogger.info(`📊 [${requestId}] Status: ${status}`);
        baseLogger.info(`📄 [${requestId}] Data: ${JSON.stringify(data, null, 2)}`);
      },

      error: (requestId: string, error: Error & { code?: string; statusCode?: number; decline_code?: string }) => {
        baseLogger.error(`❌ [${requestId}] Stripe API Error:`);
        baseLogger.error(`📋 [${requestId}] Message: ${error.message}`);
        baseLogger.error(`🔢 [${requestId}] Code: ${error.code}`);
        baseLogger.error(`🌐 [${requestId}] Status: ${error.statusCode}`);
        if (error.decline_code) {
          baseLogger.error(`💳 [${requestId}] Decline Code: ${error.decline_code}`);
        }
      }
    },

    success: (requestId: string, operation: string, startTime: number, data: Record<string, unknown> = {}) => {
      baseLogger.info(`\n✅ [${requestId}] ${operation.toUpperCase()} COMPLETED!`);
      baseLogger.info(`⏱️ [${requestId}] Duration: ${this.getDuration(startTime)}`);
      baseLogger.info(`📊 [${requestId}] Result: ${JSON.stringify(data, null, 2)}`);
      baseLogger.info(`💳 ================ ${operation.toUpperCase()} ENDED ================\n`);
    }
  };

  // Database operation logs
  database = {
    transaction: {
      start: (requestId: string, description: string) => {
        baseLogger.info(`\n💾 [${requestId}] Database Transaction Started: ${description}`);
        baseLogger.info(`⏰ [${requestId}] Timestamp: ${this.getTimestamp()}`);
      },

      step: (requestId: string, operation: string, table: string, data: Record<string, unknown> = {}) => {
        baseLogger.info(`📝 [${requestId}] ${operation} → ${table}`);
        if (Object.keys(data).length > 0) {
          baseLogger.info(`📊 [${requestId}] Data: ${JSON.stringify(data, null, 2)}`);
        }
      },

      success: (requestId: string, description: string, duration: string, data: Record<string, unknown> = {}) => {
        baseLogger.info(`✅ [${requestId}] Transaction Completed: ${description}`);
        baseLogger.info(`⏱️ [${requestId}] Duration: ${duration}`);
        if (Object.keys(data).length > 0) {
          baseLogger.info(`📊 [${requestId}] Result: ${JSON.stringify(data, null, 2)}`);
        }
      },

      error: (requestId: string, error: Error & { code?: string }, duration: string) => {
        baseLogger.error(`❌ [${requestId}] Transaction Failed after ${duration}`);
        baseLogger.error(`📋 [${requestId}] Error: ${error.message}`);
        if (error.code) baseLogger.error(`🔢 [${requestId}] Error Code: ${error.code}`);
      }
    }
  };

  // Activity logs
  activity = {
    log: (requestId: string, action: string, resourceType: string, resourceId: string, data: Record<string, unknown> = {}) => {
      baseLogger.info(`📋 [${requestId}] Activity Logged:`);
      baseLogger.info(`🎯 [${requestId}] Action: ${action}`);
      baseLogger.info(`📦 [${requestId}] Resource: ${resourceType} (${resourceId})`);
      if (Object.keys(data).length > 0) {
        baseLogger.info(`📊 [${requestId}] Details: ${JSON.stringify(data, null, 2)}`);
      }
    }
  };

  // Email logs
  email = {
    send: (requestId: string, type: string, recipient: string, data: Record<string, unknown> = {}) => {
      baseLogger.info(`📧 [${requestId}] Sending Email:`);
      baseLogger.info(`📮 [${requestId}] Type: ${type}`);
      baseLogger.info(`👤 [${requestId}] To: ${recipient}`);
      if (Object.keys(data).length > 0) {
        baseLogger.info(`📊 [${requestId}] Data: ${JSON.stringify(data, null, 2)}`);
      }
    },

    success: (requestId: string, type: string, recipient: string) => {
      baseLogger.info(`✅ [${requestId}] Email sent successfully: ${type} to ${recipient}`);
    },

    error: (requestId: string, type: string, recipient: string, error: Error) => {
      baseLogger.error(`❌ [${requestId}] Email failed: ${type} to ${recipient}`);
      baseLogger.error(`📋 [${requestId}] Error: ${error.message}`);
    }
  };

  // Trial and subscription logs
  trial = {
    start: (requestId: string, tenantId: string, duration: string) => {
      baseLogger.info(`⏰ [${requestId}] Trial Started:`);
      baseLogger.info(`🏢 [${requestId}] Tenant: ${tenantId}`);
      baseLogger.info(`⏱️ [${requestId}] Duration: ${duration}`);
    },

    expiry: (requestId: string, tenantId: string, expiredAt: string) => {
      baseLogger.info(`⏰ [${requestId}] Trial Expired:`);
      baseLogger.info(`🏢 [${requestId}] Tenant: ${tenantId}`);
      baseLogger.info(`📅 [${requestId}] Expired at: ${expiredAt}`);
    },

    reminder: (requestId: string, tenantId: string, timeLeft: string) => {
      baseLogger.info(`⏰ [${requestId}] Trial Reminder:`);
      baseLogger.info(`🏢 [${requestId}] Tenant: ${tenantId}`);
      baseLogger.info(`⏱️ [${requestId}] Time left: ${timeLeft}`);
    }
  };
}

// Export singleton instance
export default new Logger(); 