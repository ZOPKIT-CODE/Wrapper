/**
 * Enhanced Logger with Elasticsearch Integration
 * 
 * This logger extends the existing logger.js functionality while adding
 * Elasticsearch transport for centralized log management.
 * 
 * It maintains backward compatibility with the existing Logger API while
 * adding structured logging to Elasticsearch.
 */

import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import * as Sentry from '@sentry/node';
import BaseLogger from './logger.js';
import { getTraceFields } from './trace-context.js';

// Inject the active OTel span's trace_id/span_id into every Elasticsearch record
// for log↔trace correlation.
const traceCorrelation = winston.format((info) => Object.assign(info, getTraceFields()));

const SERVICE_NAME = process.env.SERVICE_NAME || 'wrapper-backend';
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const NODE_ENV = process.env.NODE_ENV || 'local';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Create Elasticsearch transport
let esTransport = null;

try {
  esTransport = new ElasticsearchTransport({
    level: LOG_LEVEL,
    clientOpts: {
      node: ELASTICSEARCH_URL,
      ssl: {
        rejectUnauthorized: false
      }
    },
    indexPrefix: 'app-logs',
    indexTemplate: {
      index_patterns: ['app-logs-*'],
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0
      },
      mappings: {
        properties: {
          '@timestamp': { type: 'date' },
          level: { type: 'keyword' },
          message: { type: 'text' },
          service: { type: 'keyword' },
          env: { type: 'keyword' },
          tenantId: { type: 'keyword' },
          userId: { type: 'keyword' },
          requestId: { type: 'keyword' },
          category: { type: 'keyword' },
          error: { type: 'object' }
        }
      }
    },
    transformer: (logData: { timestamp?: string; level?: string; message?: string; meta?: Record<string, unknown> }) => {
      return {
        '@timestamp': (logData as Record<string, unknown>)['@timestamp'] as string || logData.timestamp || new Date().toISOString(),
        level: logData.level,
        message: logData.message,
        service: SERVICE_NAME,
        env: NODE_ENV,
        ...logData.meta
      };
    }
  });

  esTransport.on('error', (err: unknown) => {
    console.error('Elasticsearch transport error:', (err as Error).message);
  });
} catch (err: unknown) {
  console.warn('Failed to initialize Elasticsearch transport:', (err as Error).message);
  console.warn('Logging will continue to console only');
}

// Create Winston logger
const winstonLogger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: {
    service: SERVICE_NAME,
    env: NODE_ENV
  },
  format: winston.format.combine(
    traceCorrelation(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
        })
      )
    }),
    ...(esTransport ? [esTransport] : [])
  ],
  exitOnError: false
});

/**
 * Enhanced Logger
 * Wraps the existing Logger singleton and adds Elasticsearch logging
 */
const enhancedLogger = {
  // Copy all methods from BaseLogger
  ...BaseLogger,
  
  // Add Winston logger reference
  winstonLogger,
  serviceName: SERVICE_NAME,

  /**
   * Log to both console (via BaseLogger) and Elasticsearch (via Winston)
   */
  logToElasticsearch(level: string, category: string, requestId: string, message: string, data: Record<string, unknown> = {}) {
    // Call base logger's console logging
    BaseLogger.log(level, category, requestId, message, data);

    // Also log to Elasticsearch via Winston
    const logData = {
      level: level === 'success' ? 'info' : level,
      message: `${category}: ${message}`,
      requestId,
      category,
      ...data
    };

    switch (level) {
      case 'info':
      case 'success':
        winstonLogger.info(logData.message, logData);
        break;
      case 'warning':
        winstonLogger.warn(logData.message, logData);
        break;
      case 'error':
        winstonLogger.error(logData.message, logData);
        break;
      case 'debug':
        winstonLogger.debug(logData.message, logData);
        break;
      default:
        winstonLogger.info(logData.message, logData);
    }
  },

  // Wrap onboarding methods to also log to Elasticsearch
  onboarding: {
    start: (requestId: string, data: Record<string, unknown>) => {
      BaseLogger.onboarding.start(requestId, data);
      winstonLogger.info('Onboarding started', { requestId, category: 'onboarding', ...data });
      Sentry.logger.info('Onboarding started', { requestId, category: 'onboarding', ...data });
    },

    step: (requestId: string, stepNumber: number, description: string, data: Record<string, unknown> = {}) => {
      BaseLogger.onboarding.step(requestId, stepNumber, description, data);
      winstonLogger.info('Onboarding step', { requestId, stepNumber, description, category: 'onboarding', ...data });
      Sentry.logger.info(`Onboarding step ${stepNumber}: ${description}`, { requestId, stepNumber, description, category: 'onboarding', ...data });
    },

    success: (requestId: string, message: string, data: Record<string, unknown> = {}) => {
      BaseLogger.onboarding.success(requestId, message, data);
      winstonLogger.info('Onboarding success', { requestId, message, category: 'onboarding', ...data });
      Sentry.logger.info(`Onboarding success: ${message}`, { requestId, category: 'onboarding', ...data });
    },

    error: (requestId: string, message: string, error: Error & { code?: string }, startTime: number) => {
      BaseLogger.onboarding.error(requestId, message, error, startTime);
      const duration = BaseLogger.getDuration(startTime);
      winstonLogger.error('Onboarding error', {
        requestId,
        message,
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code
        },
        category: 'onboarding',
        duration
      });
      Sentry.logger.error(`Onboarding error: ${message}`, { requestId, category: 'onboarding', errorMessage: error.message, errorCode: error.code, duration });
    },

    complete: (requestId: string, startTime: number, data: Record<string, unknown> = {}) => {
      BaseLogger.onboarding.complete(requestId, startTime, data);
      const duration = BaseLogger.getDuration(startTime);
      winstonLogger.info('Onboarding completed', {
        requestId,
        category: 'onboarding',
        duration,
        ...data
      });
      Sentry.logger.info('Onboarding completed', { requestId, category: 'onboarding', duration, ...data });
    }
  },

  // Wrap user methods
  user: {
    invitation: {
      start: (requestId: string, data: Record<string, unknown>) => {
        BaseLogger.user.invitation.start(requestId, data);
        winstonLogger.info('User invitation started', { requestId, category: 'user', ...data });
      },

      step: (requestId: string, step: string, description: string, data: Record<string, unknown> = {}) => {
        BaseLogger.user.invitation.step(requestId, step, description, data);
        winstonLogger.info('User invitation step', { requestId, step, description, category: 'user', ...data });
      },

      success: (requestId: string, startTime: number, data: Record<string, unknown> = {}) => {
        BaseLogger.user.invitation.success(requestId, startTime, data);
        winstonLogger.info('User invitation success', {
          requestId,
          category: 'user',
          duration: BaseLogger.getDuration(startTime),
          ...data
        });
      },

      error: (requestId: string, error: Error, startTime: number) => {
        BaseLogger.user.invitation.error(requestId, error, startTime);
        winstonLogger.error('User invitation error', {
          requestId,
          error: {
            message: error.message,
            stack: error.stack
          },
          category: 'user',
          duration: BaseLogger.getDuration(startTime)
        });
      }
    }
  },

  // Wrap billing methods
  billing: {
    start: (requestId: string, operation: string, data: Record<string, unknown>) => {
      BaseLogger.billing.start(requestId, operation, data);
      winstonLogger.info('Billing operation started', { requestId, operation, category: 'billing', ...data });
    },

    stripe: {
      request: (requestId: string, method: string, endpoint: string, data: Record<string, unknown> = {}) => {
        BaseLogger.billing.stripe.request(requestId, method, endpoint, data);
        winstonLogger.info('Stripe API request', { requestId, method, endpoint, category: 'stripe', ...data });
      },

      response: (requestId: string, status: number, data: Record<string, unknown> = {}) => {
        BaseLogger.billing.stripe.response(requestId, status, data);
        winstonLogger.info('Stripe API response', { requestId, status, category: 'stripe', ...data });
      },

      error: (requestId: string, error: Error & { code?: string; statusCode?: number }) => {
        BaseLogger.billing.stripe.error(requestId, error);
        winstonLogger.error('Stripe API error', {
          requestId,
          error: {
            message: error.message,
            code: error.code,
            statusCode: error.statusCode
          },
          category: 'stripe'
        });
      }
    },

    success: (requestId: string, operation: string, startTime: number, data: Record<string, unknown> = {}) => {
      BaseLogger.billing.success(requestId, operation, startTime, data);
      winstonLogger.info('Billing operation success', {
        requestId,
        operation,
        category: 'billing',
        duration: BaseLogger.getDuration(startTime),
        ...data
      });
    }
  },

  // Wrap database methods
  database: {
    transaction: {
      start: (requestId: string, description: string) => {
        BaseLogger.database.transaction.start(requestId, description);
        winstonLogger.info('Database transaction started', { requestId, description, category: 'database' });
      },

      step: (requestId: string, operation: string, table: string, data: Record<string, unknown> = {}) => {
        BaseLogger.database.transaction.step(requestId, operation, table, data);
        winstonLogger.info('Database transaction step', { requestId, operation, table, category: 'database', ...data });
      },

      success: (requestId: string, description: string, duration: number, data: Record<string, unknown> = {}) => {
        BaseLogger.database.transaction.success(requestId, description, `${duration}ms`, data);
        winstonLogger.info('Database transaction success', {
          requestId,
          description,
          duration,
          category: 'database',
          ...data
        });
      },

      error: (requestId: string, error: Error & { code?: string }, duration: number) => {
        BaseLogger.database.transaction.error(requestId, error, `${duration}ms`);
        winstonLogger.error('Database transaction error', {
          requestId,
          error: {
            message: error.message,
            code: error.code
          },
          duration,
          category: 'database'
        });
      }
    }
  },

  // Wrap activity methods
  activity: {
    log: (requestId: string, action: string, resourceType: string, resourceId: string, data: Record<string, unknown> = {}) => {
      BaseLogger.activity.log(requestId, action, resourceType, resourceId, data);
      winstonLogger.info('Activity logged', {
        requestId,
        action,
        resourceType,
        resourceId,
        category: 'activity',
        ...data
      });
    }
  },

  // Wrap email methods
  email: {
    send: (requestId: string, type: string, recipient: string, data: Record<string, unknown> = {}) => {
      BaseLogger.email.send(requestId, type, recipient, data);
      winstonLogger.info('Email send', { requestId, type, recipient, category: 'email', ...data });
    },

    success: (requestId: string, type: string, recipient: string) => {
      BaseLogger.email.success(requestId, type, recipient);
      winstonLogger.info('Email success', { requestId, type, recipient, category: 'email' });
    },

    error: (requestId: string, type: string, recipient: string, error: Error) => {
      BaseLogger.email.error(requestId, type, recipient, error);
      winstonLogger.error('Email error', {
        requestId,
        type,
        recipient,
        error: {
          message: error.message
        },
        category: 'email'
      });
    }
  }
};

// Export enhanced logger instance
export default enhancedLogger;

