import * as Sentry from '@sentry/node';
import ActivityLogger from '../services/activityLogger.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

interface ValidationError {
  instancePath?: string;
  params?: { missingProperty?: string; limit?: number; format?: string; allowedValues?: string[]; type?: string };
  message?: string;
  keyword?: string;
  data?: unknown;
}

interface FastifyError extends Error {
  validation?: ValidationError[];
  statusCode?: number;
  code?: string;
}

interface ErrorResponse {
  error: string;
  statusCode: number;
  timestamp: string;
  path: string;
  details?: { field: string | undefined; message: string; value: unknown }[] | null;
  message?: string;
  stack?: string;
  correlationId?: string;
  logId?: string;
}

export async function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply): Promise<void> {
  request.log.error(error);

  let statusCode = 500;
  let message = 'Internal Server Error';
  let details: { field: string | undefined; message: string; value: unknown }[] | null = null;

  if (error.validation) {
    statusCode = 400;
    message = 'Validation Error';
    
    details = error.validation.map(v => {
      const fieldName = v.instancePath?.replace('/', '') || v.params?.missingProperty || 'unknown';
      let userMessage = v.message || 'Invalid value';
      
      if (v.keyword === 'required') {
        userMessage = `${fieldName} is required`;
      } else if (v.keyword === 'minLength') {
        userMessage = `${fieldName} must be at least ${v.params?.limit} characters`;
      } else if (v.keyword === 'maxLength') {
        userMessage = `${fieldName} must not exceed ${v.params?.limit} characters`;
      } else if (v.keyword === 'format') {
        if (v.params?.format === 'email') {
          userMessage = `${fieldName} must be a valid email address`;
        } else {
          userMessage = `${fieldName} format is invalid`;
        }
      } else if (v.keyword === 'enum') {
        userMessage = `${fieldName} must be one of: ${v.params?.allowedValues?.join(', ')}`;
      } else if (v.keyword === 'pattern') {
        userMessage = `${fieldName} format is invalid`;
      } else if (v.keyword === 'type') {
        userMessage = `${fieldName} must be of type ${v.params?.type}`;
      }
      
      return {
        field: v.instancePath,
        message: userMessage,
        value: v.data,
      };
    });
  } else if (error.statusCode) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
    statusCode = 401;
    message = 'No authorization header';
  } else if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
    statusCode = 401;
    message = 'Invalid authorization token';
  } else if (error.code === 'FST_RATE_LIMIT_REACHED') {
    statusCode = 429;
    message = 'Rate limit exceeded';
  } else if (error.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Service unavailable';
  } else if (error.name === 'DrizzleError') {
    statusCode = 500;
    message = 'Database error';
    details = process.env.NODE_ENV === 'development' ? [{ field: undefined, message: error.message, value: undefined }] : null;
  }

  const response: ErrorResponse = {
    error: message,
    statusCode,
    timestamp: new Date().toISOString(),
    path: request.url,
  };

  if (details !== null) {
    response.details = details;
  } else if (error.name === 'DrizzleError' && process.env.NODE_ENV !== 'development') {
    // Keep an explicit null in production DB errors (tests/API rely on this shape).
    response.details = null;
  }

  if (error.validation && Array.isArray(details) && details.length > 0) {
    if (details.length === 1) {
      response.message = details[0].message;
    } else {
      response.message = `Please fix the following errors: ${details.map((d) => d.message).join(', ')}`;
    }
  }

  if (process.env.NODE_ENV === 'development' && error.stack) {
    response.stack = error.stack;
  }

  if (request.user?.tenantId || request.userContext?.tenantId) {
    const tenantId = request.user?.tenantId || request.userContext?.tenantId;
    const userId = request.user?.internalUserId || request.user?.userId || request.userContext?.userId;
    
    setImmediate(async () => {
      try {
        const requestContext = {
          ipAddress: request.ip || request.headers['x-forwarded-for'] as string || '',
          userAgent: request.headers['user-agent'] || '',
          sessionId: request.headers['x-session-id'] as string || request.user?.sessionId || '',
          url: request.url,
          method: request.method
        };

        const additionalContext = {
          responseStatus: statusCode,
          errorPath: request.url,
          errorMethod: request.method,
          hasDetails: !!details,
          validationErrors: error.validation ? error.validation.length : 0
        };

        const result = await ActivityLogger.logError(
          tenantId ?? '',
          userId,
          error,
          requestContext,
          additionalContext
        );

        if (result.success) {
          response.correlationId = result.requestId;
          response.logId = result.logId;
        }
      } catch (logError) {
        console.error('❌ Failed to log error to activity logs:', logError);
      }
    });
  }

  if (statusCode >= 500) {
    Sentry.captureException(error, {
      tags: { path: request.url, method: request.method },
      extra: { statusCode, correlationId: response.correlationId },
    });
  }

  reply.code(statusCode).send(response);
}
