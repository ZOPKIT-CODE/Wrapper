/**
 * Enhanced Logger with Elasticsearch Integration
 *
 * Wraps the base Logger and additionally ships structured logs to Elasticsearch.
 * Migrated from winston/winston-elasticsearch to pino + pino-elasticsearch
 * (fleet-standard logger — matches CRM/FA).
 *
 * ⚠️ ES shipping is UNVERIFIED in this change (no Elasticsearch available to test
 * against). Two behavioural notes vs the old winston-elasticsearch setup:
 *   1. pino-elasticsearch does NOT create the rich `app-logs-*` index template +
 *      mappings that winston-elasticsearch did — ensure that template exists in
 *      ES (or rely on dynamic mapping). Verify shipping at runtime before relying on it.
 *   2. Records are flat pino JSON ({ service, env, trace_id, ...meta, msg }) rather
 *      than the winston transformer's shape; downstream queries/dashboards may need updating.
 */

import pino from 'pino';
import * as Sentry from '@sentry/node';
import BaseLogger from './logger.js';
import { getTraceFields } from './trace-context.js';

const SERVICE_NAME = process.env.SERVICE_NAME || 'wrapper-backend';
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const NODE_ENV = process.env.NODE_ENV || 'local';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
// Ship to ES only when an ES URL is configured and not explicitly disabled.
const ES_ENABLED = !!process.env.ELASTICSEARCH_URL && process.env.DISABLE_ES_LOGS !== 'true';

// Console target: pretty in dev, raw JSON to stdout (fd 1) in prod. Plus
// Elasticsearch (pino-elasticsearch) when enabled.
const targets: pino.TransportTargetOptions[] = [
  process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', level: LOG_LEVEL, options: { colorize: true, ignore: 'pid,hostname', translateTime: 'SYS:standard' } }
    : { target: 'pino/file', level: LOG_LEVEL, options: { destination: 1 } },
];
if (ES_ENABLED) {
  targets.push({
    target: 'pino-elasticsearch',
    level: LOG_LEVEL,
    options: {
      node: ELASTICSEARCH_URL,
      index: 'app-logs',
      esVersion: 8,
      flushBytes: 1000,
      rejectUnauthorized: false,
    },
  });
}

let baseEsLogger: pino.Logger;
try {
  baseEsLogger = pino(
    {
      level: LOG_LEVEL,
      base: { service: SERVICE_NAME, env: NODE_ENV },
      // trace_id/span_id for log↔trace correlation.
      mixin: () => getTraceFields(),
    },
    pino.transport({ targets }),
  );
} catch (err: unknown) {
  // If the transport (e.g. pino-elasticsearch worker) fails to start, fall back
  // to plain stdout pino so logging never takes the app down.
  // eslint-disable-next-line no-console
  console.warn('Failed to initialize pino transport; falling back to stdout:', (err as Error).message);
  baseEsLogger = pino({ level: LOG_LEVEL, base: { service: SERVICE_NAME, env: NODE_ENV }, mixin: () => getTraceFields() });
}

// winston-signature shim: winston is logger.<level>(message, meta); pino is
// logger.<level>(mergeObj, message). The shim flips the args so every call site
// below keeps the winston (message, meta) order — no per-call changes.
const esLog = {
  info: (message: string, meta: Record<string, unknown> = {}) => baseEsLogger.info(meta, message),
  warn: (message: string, meta: Record<string, unknown> = {}) => baseEsLogger.warn(meta, message),
  error: (message: string, meta: Record<string, unknown> = {}) => baseEsLogger.error(meta, message),
  debug: (message: string, meta: Record<string, unknown> = {}) => baseEsLogger.debug(meta, message),
};

/**
 * Enhanced Logger
 * Wraps the existing Logger singleton and adds Elasticsearch logging
 */
const enhancedLogger = {
  // Copy all methods from BaseLogger
  ...BaseLogger,

  // Backing logger reference (kept as `winstonLogger` for backward compat with
  // any external reference; now a pino-backed, winston-signature shim).
  winstonLogger: esLog,
  serviceName: SERVICE_NAME,

  /**
   * Log to both console (via BaseLogger) and Elasticsearch (via pino)
   */
  logToElasticsearch(level: string, category: string, requestId: string, message: string, data: Record<string, unknown> = {}) {
    // Call base logger's console logging
    BaseLogger.log(level, category, requestId, message, data);

    // Also log to Elasticsearch via pino
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
        esLog.info(logData.message, logData);
        break;
      case 'warning':
        esLog.warn(logData.message, logData);
        break;
      case 'error':
        esLog.error(logData.message, logData);
        break;
      case 'debug':
        esLog.debug(logData.message, logData);
        break;
      default:
        esLog.info(logData.message, logData);
    }
  },

  // Wrap onboarding methods to also log to Elasticsearch
  onboarding: {
    start: (requestId: string, data: Record<string, unknown>) => {
      BaseLogger.onboarding.start(requestId, data);
      esLog.info('Onboarding started', { requestId, category: 'onboarding', ...data });
      Sentry.logger.info('Onboarding started', { requestId, category: 'onboarding', ...data });
    },

    step: (requestId: string, stepNumber: number, description: string, data: Record<string, unknown> = {}) => {
      BaseLogger.onboarding.step(requestId, stepNumber, description, data);
      esLog.info('Onboarding step', { requestId, stepNumber, description, category: 'onboarding', ...data });
      Sentry.logger.info(`Onboarding step ${stepNumber}: ${description}`, { requestId, stepNumber, description, category: 'onboarding', ...data });
    },

    success: (requestId: string, message: string, data: Record<string, unknown> = {}) => {
      BaseLogger.onboarding.success(requestId, message, data);
      esLog.info('Onboarding success', { requestId, message, category: 'onboarding', ...data });
      Sentry.logger.info(`Onboarding success: ${message}`, { requestId, category: 'onboarding', ...data });
    },

    error: (requestId: string, message: string, error: Error & { code?: string }, startTime: number) => {
      BaseLogger.onboarding.error(requestId, message, error, startTime);
      const duration = BaseLogger.getDuration(startTime);
      esLog.error('Onboarding error', {
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
      esLog.info('Onboarding completed', {
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
        esLog.info('User invitation started', { requestId, category: 'user', ...data });
      },

      step: (requestId: string, step: string, description: string, data: Record<string, unknown> = {}) => {
        BaseLogger.user.invitation.step(requestId, step, description, data);
        esLog.info('User invitation step', { requestId, step, description, category: 'user', ...data });
      },

      success: (requestId: string, startTime: number, data: Record<string, unknown> = {}) => {
        BaseLogger.user.invitation.success(requestId, startTime, data);
        esLog.info('User invitation success', {
          requestId,
          category: 'user',
          duration: BaseLogger.getDuration(startTime),
          ...data
        });
      },

      error: (requestId: string, error: Error, startTime: number) => {
        BaseLogger.user.invitation.error(requestId, error, startTime);
        esLog.error('User invitation error', {
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
      esLog.info('Billing operation started', { requestId, operation, category: 'billing', ...data });
    },

    stripe: {
      request: (requestId: string, method: string, endpoint: string, data: Record<string, unknown> = {}) => {
        BaseLogger.billing.stripe.request(requestId, method, endpoint, data);
        esLog.info('Stripe API request', { requestId, method, endpoint, category: 'stripe', ...data });
      },

      response: (requestId: string, status: number, data: Record<string, unknown> = {}) => {
        BaseLogger.billing.stripe.response(requestId, status, data);
        esLog.info('Stripe API response', { requestId, status, category: 'stripe', ...data });
      },

      error: (requestId: string, error: Error & { code?: string; statusCode?: number }) => {
        BaseLogger.billing.stripe.error(requestId, error);
        esLog.error('Stripe API error', {
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
      esLog.info('Billing operation success', {
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
        esLog.info('Database transaction started', { requestId, description, category: 'database' });
      },

      step: (requestId: string, operation: string, table: string, data: Record<string, unknown> = {}) => {
        BaseLogger.database.transaction.step(requestId, operation, table, data);
        esLog.info('Database transaction step', { requestId, operation, table, category: 'database', ...data });
      },

      success: (requestId: string, description: string, duration: number, data: Record<string, unknown> = {}) => {
        BaseLogger.database.transaction.success(requestId, description, `${duration}ms`, data);
        esLog.info('Database transaction success', {
          requestId,
          description,
          duration,
          category: 'database',
          ...data
        });
      },

      error: (requestId: string, error: Error & { code?: string }, duration: number) => {
        BaseLogger.database.transaction.error(requestId, error, `${duration}ms`);
        esLog.error('Database transaction error', {
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
      esLog.info('Activity logged', {
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
      esLog.info('Email send', { requestId, type, recipient, category: 'email', ...data });
    },

    success: (requestId: string, type: string, recipient: string) => {
      BaseLogger.email.success(requestId, type, recipient);
      esLog.info('Email success', { requestId, type, recipient, category: 'email' });
    },

    error: (requestId: string, type: string, recipient: string, error: Error) => {
      BaseLogger.email.error(requestId, type, recipient, error);
      esLog.error('Email error', {
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
