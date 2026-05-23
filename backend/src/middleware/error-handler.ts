import * as Sentry from '@sentry/node';
import ActivityLogger from '../services/activityLogger.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ErrorCodes, httpStatusToErrorCode, type ErrorCode } from '../utils/error-responses.js';
import Logger from '../utils/logger.js';

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

interface LegacyDetail {
  field: string | undefined;
  message: string;
  value: unknown;
}

/**
 * Response shape emitted by the global error handler.
 *
 * Dual-shape for backward compatibility:
 *
 * - `body.error` is a human-readable STRING (legacy primary, kept indefinitely
 *   so existing CRM/FA clients that call `body.error.toLowerCase()` or
 *   `body.error.includes(...)` keep working).
 * - `body.apiError` is the new canonical structured object
 *   `{ code, message, details? }`. New clients should opt in to this shape
 *   when they're ready to migrate.
 *
 * The remaining top-level fields (`statusCode`, `timestamp`, `path`, `details`,
 * `message`, `stack`, `correlationId`, `logId`) are kept for backward compat.
 */
interface ErrorResponse {
  success: false;
  // Legacy primary: human-readable string. DO NOT change to an object — CRM/FA
  // clients call `.toLowerCase()` / `.includes()` on this directly.
  error: string;
  // New canonical structured shape (opt-in for new clients).
  apiError: ApiErrorObject;
  // Legacy fields (kept) ----------------------------------------------------
  statusCode: number;
  timestamp: string;
  path: string;
  details?: LegacyDetail[] | null;
  message?: string;
  stack?: string;
  correlationId?: string;
  logId?: string;
}

interface ApiErrorObject {
  code: string;
  message: string;
  details?: unknown;
}

export async function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply): Promise<void> {
  request.log.error(error);

  let statusCode = 500;
  let legacyErrorLabel = 'Internal Server Error'; // legacy `error` string at top level
  let canonicalCode: ErrorCode | string = ErrorCodes.INTERNAL;
  let canonicalMessage: string = legacyErrorLabel;
  let details: LegacyDetail[] | null = null;
  let canonicalDetails: unknown | undefined;

  if (error.validation) {
    statusCode = 400;
    legacyErrorLabel = 'Validation Error';
    canonicalCode = ErrorCodes.INVALID_INPUT;

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

    // For the canonical body, expose the structured validation issues directly.
    canonicalDetails = details;
    canonicalMessage = legacyErrorLabel;
  } else if (error.statusCode) {
    statusCode = error.statusCode;
    legacyErrorLabel = error.message;
    canonicalMessage = error.message;
    // Honor an explicit error.code if it already looks like one of our ErrorCodes;
    // otherwise derive from status. (Fastify framework codes like FST_* are caught below.)
    const errCode = (error as FastifyError & { code?: string }).code;
    if (errCode && Object.values(ErrorCodes).includes(errCode as ErrorCode)) {
      canonicalCode = errCode;
    } else {
      canonicalCode = httpStatusToErrorCode(statusCode);
    }
  } else if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
    statusCode = 401;
    legacyErrorLabel = 'No authorization header';
    canonicalCode = ErrorCodes.UNAUTHORIZED;
    canonicalMessage = legacyErrorLabel;
  } else if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
    statusCode = 401;
    legacyErrorLabel = 'Invalid authorization token';
    canonicalCode = ErrorCodes.UNAUTHORIZED;
    canonicalMessage = legacyErrorLabel;
  } else if (error.code === 'FST_RATE_LIMIT_REACHED') {
    statusCode = 429;
    legacyErrorLabel = 'Rate limit exceeded';
    canonicalCode = ErrorCodes.RATE_LIMITED;
    canonicalMessage = legacyErrorLabel;
  } else if (error.code === 'ECONNREFUSED') {
    statusCode = 503;
    legacyErrorLabel = 'Service unavailable';
    canonicalCode = ErrorCodes.SERVICE_UNAVAILABLE;
    canonicalMessage = legacyErrorLabel;
  } else if (error.name === 'DrizzleError') {
    statusCode = 500;
    legacyErrorLabel = 'Database error';
    canonicalCode = ErrorCodes.INTERNAL;
    canonicalMessage = legacyErrorLabel;
    details = process.env.NODE_ENV === 'development'
      ? [{ field: undefined, message: error.message, value: undefined }]
      : null;
    if (process.env.NODE_ENV === 'development') {
      canonicalDetails = { dbError: error.message };
    }
  }

  // Build the structured canonical object (exposed under `apiError`).
  const canonicalError: ApiErrorObject = {
    code: canonicalCode,
    message: canonicalMessage,
    ...(canonicalDetails !== undefined ? { details: canonicalDetails } : {}),
  };

  const response: ErrorResponse = {
    success: false,
    // Legacy primary: human-readable string (CRM/FA clients call .toLowerCase()
    // and .includes() on this — must remain a string).
    error: legacyErrorLabel,
    // New canonical structured shape (opt-in for new clients).
    apiError: canonicalError,
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

  // ── Dual-shape contract (backward compatible) ──────────────────────────
  // `response.error`    is the legacy human-readable STRING (already set above).
  // `response.apiError` is the new canonical structured shape (also set above):
  //
  //   LEGACY:  body.error              // 'No authorization header'   (string)
  //   NEW:     body.apiError.code      // 'UNAUTHORIZED'
  //   NEW:     body.apiError.message   // 'No authorization header'
  //   NEW:     body.apiError.details   // optional, e.g. zod issues
  //
  // Existing CRM/FA callers continue to read `body.error` as a string. New
  // clients should opt in to `body.apiError` when they migrate.

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
        Logger.log('error', 'middleware', 'error-handler', '❌ Failed to log error to activity logs', { error: logError });
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
