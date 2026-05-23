/* eslint-disable no-console */
/**
 * Enhanced Logging Utility
 * Provides structured logging for debugging onboarding, user management, roles, billing, and Stripe operations
 */

import winston from 'winston';

const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? winston.format.json()
        : winston.format.combine(winston.format.colorize(), winston.format.simple())
    })
  ]
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
    
    winstonLogger.info(`\n${emoji} [${requestId}] ${category}: ${message}`);
    winstonLogger.info(`⏰ Timestamp: ${timestamp}`);

    if (Object.keys(data).length > 0) {
      winstonLogger.info(`📊 Data: ${JSON.stringify(data, null, 2)}`);
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
      winstonLogger.info('\n🚀 =================== ONBOARDING STARTED ===================');
      winstonLogger.info(`📋 Request ID: ${requestId}`);
      winstonLogger.info(`⏰ Timestamp: ${this.getTimestamp()}`);
      winstonLogger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
      winstonLogger.info(`📦 Request Data: ${JSON.stringify(data, null, 2)}`);
    },

    step: (requestId: string, stepNumber: number, description: string, data: Record<string, unknown> = {}) => {
      winstonLogger.info(`\n🔄 [${requestId}] Step ${stepNumber}: ${description}`);
      if (Object.keys(data).length > 0) {
        winstonLogger.info(`📊 [${requestId}] Data: ${JSON.stringify(data, null, 2)}`);
      }
    },

    success: (requestId: string, message: string, data: Record<string, unknown> = {}) => {
      winstonLogger.info(`✅ [${requestId}] ${message}`);
      if (Object.keys(data).length > 0) {
        winstonLogger.info(`📊 [${requestId}] Result: ${JSON.stringify(data, null, 2)}`);
      }
    },

    error: (requestId: string, message: string, error: Error & { code?: string; statusCode?: number }, startTime: number) => {
      winstonLogger.error(`❌ [${requestId}] ${message}`);
      winstonLogger.error(`📋 [${requestId}] Error: ${error.message}`);
      if (error.code) winstonLogger.error(`🔢 [${requestId}] Error Code: ${error.code}`);
      if (error.statusCode) winstonLogger.error(`🌐 [${requestId}] Status Code: ${error.statusCode}`);
      if (error.stack) winstonLogger.error(`📋 [${requestId}] Stack: ${error.stack}`);
      winstonLogger.info(`⏱️ [${requestId}] Failed after ${this.getDuration(startTime)}`);
    },

    complete: (requestId: string, startTime: number, data: Record<string, unknown> = {}) => {
      winstonLogger.info(`\n🎉 [${requestId}] ONBOARDING COMPLETED SUCCESSFULLY!`);
      winstonLogger.info(`⏱️ [${requestId}] Total Duration: ${this.getDuration(startTime)}`);
      if (Object.keys(data).length > 0) {
        winstonLogger.info(`📊 [${requestId}] Final Result: ${JSON.stringify(data, null, 2)}`);
      }
      winstonLogger.info('🚀 =================== ONBOARDING ENDED ===================\n');
    }
  };

  // User management logs
  user = {
    invitation: {
      start: (requestId: string, data: Record<string, unknown>) => {
        winstonLogger.info('\n👤 ================ USER INVITATION STARTED ================');
        winstonLogger.info(`📋 Request ID: ${requestId}`);
        winstonLogger.info(`⏰ Timestamp: ${this.getTimestamp()}`);
        winstonLogger.info(`📧 Invitation Data: ${JSON.stringify(data, null, 2)}`);
      },

      step: (requestId: string, step: string, description: string, data: Record<string, unknown> = {}) => {
        winstonLogger.info(`\n📧 [${requestId}] ${step}: ${description}`);
        if (Object.keys(data).length > 0) {
          winstonLogger.info(`📊 [${requestId}] Data: ${JSON.stringify(data, null, 2)}`);
        }
      },

      success: (requestId: string, startTime: number, data: Record<string, unknown> = {}) => {
        winstonLogger.info(`\n✅ [${requestId}] USER INVITATION COMPLETED!`);
        winstonLogger.info(`⏱️ [${requestId}] Duration: ${this.getDuration(startTime)}`);
        winstonLogger.info(`📊 [${requestId}] Result: ${JSON.stringify(data, null, 2)}`);
        winstonLogger.info('👤 ================ USER INVITATION ENDED ================\n');
      },

      error: (requestId: string, error: Error, startTime: number) => {
        winstonLogger.error(`\n❌ [${requestId}] USER INVITATION FAILED!`);
        winstonLogger.error(`📋 [${requestId}] Error: ${error.message}`);
        winstonLogger.info(`⏱️ [${requestId}] Failed after ${this.getDuration(startTime)}`);
        winstonLogger.info('👤 ================ USER INVITATION ENDED ================\n');
      }
    }
  };

  // Role management logs
  role = {
    create: {
      start: (requestId: string, data: Record<string, unknown>) => {
        winstonLogger.info('\n🔐 ================ ROLE CREATION STARTED ================');
        winstonLogger.info(`📋 Request ID: ${requestId}`);
        winstonLogger.info(`⏰ Timestamp: ${this.getTimestamp()}`);
        winstonLogger.info(`🔐 Role Data: ${JSON.stringify(data, null, 2)}`);
      },

      step: (requestId: string, step: string, description: string, data: Record<string, unknown> = {}) => {
        winstonLogger.info(`\n🔐 [${requestId}] ${step}: ${description}`);
        if (Object.keys(data).length > 0) {
          winstonLogger.info(`📊 [${requestId}] Data: ${JSON.stringify(data, null, 2)}`);
        }
      },

      success: (requestId: string, startTime: number, data: Record<string, unknown> = {}) => {
        winstonLogger.info(`\n✅ [${requestId}] ROLE CREATED SUCCESSFULLY!`);
        winstonLogger.info(`⏱️ [${requestId}] Duration: ${this.getDuration(startTime)}`);
        winstonLogger.info(`📊 [${requestId}] Role: ${JSON.stringify(data, null, 2)}`);
        winstonLogger.info('🔐 ================ ROLE CREATION ENDED ================\n');
      }
    },

    assign: {
      start: (requestId: string, data: Record<string, unknown>) => {
        winstonLogger.info('\n👥 ================ ROLE ASSIGNMENT STARTED ================');
        winstonLogger.info(`📋 Request ID: ${requestId}`);
        winstonLogger.info(`⏰ Timestamp: ${this.getTimestamp()}`);
        winstonLogger.info(`👥 Assignment Data: ${JSON.stringify(data, null, 2)}`);
      },

      success: (requestId: string, startTime: number, data: Record<string, unknown> = {}) => {
        winstonLogger.info(`\n✅ [${requestId}] ROLE ASSIGNED SUCCESSFULLY!`);
        winstonLogger.info(`⏱️ [${requestId}] Duration: ${this.getDuration(startTime)}`);
        winstonLogger.info(`📊 [${requestId}] Assignment: ${JSON.stringify(data, null, 2)}`);
        winstonLogger.info('👥 ================ ROLE ASSIGNMENT ENDED ================\n');
      }
    }
  };

  // Billing and Stripe logs
  billing = {
    start: (requestId: string, operation: string, data: Record<string, unknown>) => {
      winstonLogger.info(`\n💳 ================ ${operation.toUpperCase()} STARTED ================`);
      winstonLogger.info(`📋 Request ID: ${requestId}`);
      winstonLogger.info(`⏰ Timestamp: ${this.getTimestamp()}`);
      winstonLogger.info(`💳 Billing Data: ${JSON.stringify(data, null, 2)}`);
    },

    stripe: {
      request: (requestId: string, method: string, endpoint: string, data: Record<string, unknown> = {}) => {
        winstonLogger.info(`\n🟢 [${requestId}] Stripe API Request:`);
        winstonLogger.info(`🌐 [${requestId}] Method: ${method}`);
        winstonLogger.info(`🔗 [${requestId}] Endpoint: ${endpoint}`);
        if (Object.keys(data).length > 0) {
          winstonLogger.info(`📊 [${requestId}] Payload: ${JSON.stringify(data, null, 2)}`);
        }
      },

      response: (requestId: string, status: number | string, data: Record<string, unknown> = {}) => {
        winstonLogger.info(`🟢 [${requestId}] Stripe API Response:`);
        winstonLogger.info(`📊 [${requestId}] Status: ${status}`);
        winstonLogger.info(`📄 [${requestId}] Data: ${JSON.stringify(data, null, 2)}`);
      },

      error: (requestId: string, error: Error & { code?: string; statusCode?: number; decline_code?: string }) => {
        winstonLogger.error(`❌ [${requestId}] Stripe API Error:`);
        winstonLogger.error(`📋 [${requestId}] Message: ${error.message}`);
        winstonLogger.error(`🔢 [${requestId}] Code: ${error.code}`);
        winstonLogger.error(`🌐 [${requestId}] Status: ${error.statusCode}`);
        if (error.decline_code) {
          winstonLogger.error(`💳 [${requestId}] Decline Code: ${error.decline_code}`);
        }
      }
    },

    success: (requestId: string, operation: string, startTime: number, data: Record<string, unknown> = {}) => {
      winstonLogger.info(`\n✅ [${requestId}] ${operation.toUpperCase()} COMPLETED!`);
      winstonLogger.info(`⏱️ [${requestId}] Duration: ${this.getDuration(startTime)}`);
      winstonLogger.info(`📊 [${requestId}] Result: ${JSON.stringify(data, null, 2)}`);
      winstonLogger.info(`💳 ================ ${operation.toUpperCase()} ENDED ================\n`);
    }
  };

  // Database operation logs
  database = {
    transaction: {
      start: (requestId: string, description: string) => {
        winstonLogger.info(`\n💾 [${requestId}] Database Transaction Started: ${description}`);
        winstonLogger.info(`⏰ [${requestId}] Timestamp: ${this.getTimestamp()}`);
      },

      step: (requestId: string, operation: string, table: string, data: Record<string, unknown> = {}) => {
        winstonLogger.info(`📝 [${requestId}] ${operation} → ${table}`);
        if (Object.keys(data).length > 0) {
          winstonLogger.info(`📊 [${requestId}] Data: ${JSON.stringify(data, null, 2)}`);
        }
      },

      success: (requestId: string, description: string, duration: string, data: Record<string, unknown> = {}) => {
        winstonLogger.info(`✅ [${requestId}] Transaction Completed: ${description}`);
        winstonLogger.info(`⏱️ [${requestId}] Duration: ${duration}`);
        if (Object.keys(data).length > 0) {
          winstonLogger.info(`📊 [${requestId}] Result: ${JSON.stringify(data, null, 2)}`);
        }
      },

      error: (requestId: string, error: Error & { code?: string }, duration: string) => {
        winstonLogger.error(`❌ [${requestId}] Transaction Failed after ${duration}`);
        winstonLogger.error(`📋 [${requestId}] Error: ${error.message}`);
        if (error.code) winstonLogger.error(`🔢 [${requestId}] Error Code: ${error.code}`);
      }
    }
  };

  // Activity logs
  activity = {
    log: (requestId: string, action: string, resourceType: string, resourceId: string, data: Record<string, unknown> = {}) => {
      winstonLogger.info(`📋 [${requestId}] Activity Logged:`);
      winstonLogger.info(`🎯 [${requestId}] Action: ${action}`);
      winstonLogger.info(`📦 [${requestId}] Resource: ${resourceType} (${resourceId})`);
      if (Object.keys(data).length > 0) {
        winstonLogger.info(`📊 [${requestId}] Details: ${JSON.stringify(data, null, 2)}`);
      }
    }
  };

  // Email logs
  email = {
    send: (requestId: string, type: string, recipient: string, data: Record<string, unknown> = {}) => {
      winstonLogger.info(`📧 [${requestId}] Sending Email:`);
      winstonLogger.info(`📮 [${requestId}] Type: ${type}`);
      winstonLogger.info(`👤 [${requestId}] To: ${recipient}`);
      if (Object.keys(data).length > 0) {
        winstonLogger.info(`📊 [${requestId}] Data: ${JSON.stringify(data, null, 2)}`);
      }
    },

    success: (requestId: string, type: string, recipient: string) => {
      winstonLogger.info(`✅ [${requestId}] Email sent successfully: ${type} to ${recipient}`);
    },

    error: (requestId: string, type: string, recipient: string, error: Error) => {
      winstonLogger.error(`❌ [${requestId}] Email failed: ${type} to ${recipient}`);
      winstonLogger.error(`📋 [${requestId}] Error: ${error.message}`);
    }
  };

  // Trial and subscription logs
  trial = {
    start: (requestId: string, tenantId: string, duration: string) => {
      winstonLogger.info(`⏰ [${requestId}] Trial Started:`);
      winstonLogger.info(`🏢 [${requestId}] Tenant: ${tenantId}`);
      winstonLogger.info(`⏱️ [${requestId}] Duration: ${duration}`);
    },

    expiry: (requestId: string, tenantId: string, expiredAt: string) => {
      winstonLogger.info(`⏰ [${requestId}] Trial Expired:`);
      winstonLogger.info(`🏢 [${requestId}] Tenant: ${tenantId}`);
      winstonLogger.info(`📅 [${requestId}] Expired at: ${expiredAt}`);
    },

    reminder: (requestId: string, tenantId: string, timeLeft: string) => {
      winstonLogger.info(`⏰ [${requestId}] Trial Reminder:`);
      winstonLogger.info(`🏢 [${requestId}] Tenant: ${tenantId}`);
      winstonLogger.info(`⏱️ [${requestId}] Time left: ${timeLeft}`);
    }
  };
}

// Export singleton instance
export default new Logger(); 