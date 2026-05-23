/**
 * Standardized Error Response Utility
 *
 * Provides consistent error response formatting across all routes.
 *
 * ── Dual-shape contract (backward compatible) ─────────────────────────────
 *
 * The global error handler (`middleware/error-handler.ts`) emits BOTH shapes
 * on every error response so existing clients keep working while new clients
 * can opt in to the structured form:
 *
 *   {
 *     success: false,
 *     error: 'human-readable message',          // LEGACY (string) — primary
 *     apiError: {                                // NEW canonical (opt-in)
 *       code: 'INVALID_INPUT',
 *       message: 'human-readable message',
 *       details?: unknown                        // e.g. zod issues
 *     },
 *     message: '...',                            // legacy duplicate
 *     statusCode: 400,                           // legacy
 *     timestamp: '...', path: '...',             // legacy
 *   }
 *
 * IMPORTANT: `body.error` is a STRING — do not change it to an object. CRM and
 * FA clients call `body.error.toLowerCase()` and `body.error.includes(...)`
 * directly. New clients should read `body.apiError` instead.
 *
 * ── Helpers ───────────────────────────────────────────────────────────────
 *
 *   type ApiSuccess<T> = { success: true;  data: T }
 *   type ApiError     = { success: false; error: { code: string; message: string; details?: unknown } }
 *
 * `apiError(code, message, details?)` and `apiSuccess(data)` return the
 * canonical structured payload. When used as an HTTP response body for a
 * client that consumes the dual-shape contract above, place the returned
 * object under the `apiError:` key (NOT at the top level), e.g.:
 *
 *   reply.code(404).send({
 *     success: false,
 *     error: 'User not found',                   // legacy string
 *     apiError: apiError(ErrorCodes.NOT_FOUND, 'User not found').error,
 *     statusCode: 404,
 *   });
 *
 * For routes that just throw, the global error handler handles all of this
 * automatically — preferred path.
 *
 * ── ErrorCodes ────────────────────────────────────────────────────────────
 *   INVALID_INPUT         400 — request body / params failed validation
 *   UNAUTHORIZED          401 — missing / invalid credentials
 *   FORBIDDEN             403 — authenticated but not permitted
 *   NOT_FOUND             404 — resource does not exist
 *   CONFLICT              409 — request conflicts with current state
 *   RATE_LIMITED          429 — too many requests
 *   INTERNAL              500 — unhandled server error
 *   SERVICE_UNAVAILABLE   503 — dependency offline / circuit open
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import Logger from './logger.js';

// ── Canonical shape ─────────────────────────────────────────────────────────

export const ErrorCodes = {
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
}

/**
 * Build a canonical structured error body `{ success: false, error: { code, message, details? } }`.
 *
 * NOTE: Per the dual-shape contract (see top-of-file docs), the global error
 * handler exposes the structured form under `body.apiError`, with `body.error`
 * remaining a human-readable STRING for legacy compatibility. When you need
 * to send a manually-constructed error response, prefer placing the returned
 * `error` object under an `apiError:` key alongside a legacy `error:` string,
 * e.g.:
 *
 *   const { error: structured } = apiError(ErrorCodes.NOT_FOUND, 'User not found');
 *   reply.code(404).send({
 *     success: false,
 *     error: 'User not found',     // legacy string for CRM/FA
 *     apiError: structured,        // new canonical opt-in
 *     statusCode: 404,
 *   });
 *
 * Even simpler: just `throw` and let the global error handler do this for you.
 */
export function apiError(code: string, message: string, details?: unknown): ApiErrorBody {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}

/**
 * Build a canonical success response body.
 *
 * Example:
 *   reply.code(200).send(apiSuccess({ user }));
 */
export function apiSuccess<T>(data: T): ApiSuccessBody<T> {
  return { success: true, data };
}

/**
 * Convenience map from HTTP status code → canonical ErrorCode. Used by the
 * global error handler when no explicit code is present on the thrown error.
 */
export function httpStatusToErrorCode(status: number): ErrorCode {
  if (status === 400) return ErrorCodes.INVALID_INPUT;
  if (status === 401) return ErrorCodes.UNAUTHORIZED;
  if (status === 403) return ErrorCodes.FORBIDDEN;
  if (status === 404) return ErrorCodes.NOT_FOUND;
  if (status === 409) return ErrorCodes.CONFLICT;
  if (status === 429) return ErrorCodes.RATE_LIMITED;
  if (status === 503) return ErrorCodes.SERVICE_UNAVAILABLE;
  return ErrorCodes.INTERNAL;
}

class ErrorResponses {
  /**
   * Send a standardized 404 Not Found response
   * @param {Object} reply - Fastify reply object
   * @param {string} resource - The resource that was not found
   * @param {string} message - Custom error message (optional)
   * @param {Object} context - Additional context for logging (optional)
   * @returns {Object} Standardized error response
   */
  static notFound(reply: FastifyReply, resource: string, message: string | null = null, context: Record<string, unknown> = {}): FastifyReply {
    const requestId = Logger.generateRequestId('error');
    const errorMessage = message || `${resource} not found`;

    // Log the error for debugging
    Logger.log('info', 'utils', 'error-response-404', `[${requestId}] 404 Error: ${errorMessage}`, {
      requestId,
      resource,
      context,
      url: reply.request?.url,
      method: reply.request?.method,
      userContext: reply.request?.userContext ? {
        userId: reply.request.userContext.userId,
        tenantId: reply.request.userContext.tenantId,
        email: reply.request.userContext.email
      } : null
    });

    return reply.code(404).send({
      success: false,
      error: 'Not Found',
      message: errorMessage,
      resource,
      statusCode: 404,
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send a standardized 401 Unauthorized response
   * @param {Object} reply - Fastify reply object
   * @param {string} message - Custom error message (optional)
   * @param {Object} context - Additional context for logging (optional)
   * @returns {Object} Standardized error response
   */
  static unauthorized(reply: FastifyReply, message = 'Unauthorized access', context: Record<string, unknown> = {}): FastifyReply {
    const requestId = Logger.generateRequestId('error');

    Logger.log('info', 'utils', 'error-response-401', `[${requestId}] 401 Error: ${message}`, {
      requestId,
      context,
      url: reply.request?.url,
      method: reply.request?.method
    });

    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      message,
      statusCode: 401,
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send a standardized 403 Forbidden response
   * @param {Object} reply - Fastify reply object
   * @param {string} message - Custom error message (optional)
   * @param {Object} context - Additional context for logging (optional)
   * @returns {Object} Standardized error response
   */
  static forbidden(reply: FastifyReply, message = 'Access forbidden', context: Record<string, unknown> = {}): FastifyReply {
    const requestId = Logger.generateRequestId('error');

    Logger.log('info', 'utils', 'error-response-403', `[${requestId}] 403 Error: ${message}`, {
      requestId,
      context,
      url: reply.request?.url,
      method: reply.request?.method,
      userContext: reply.request?.userContext ? {
        userId: reply.request.userContext.userId,
        tenantId: reply.request.userContext.tenantId,
        email: reply.request.userContext.email
      } : null
    });

    return reply.code(403).send({
      success: false,
      error: 'Forbidden',
      message,
      statusCode: 403,
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send a standardized 400 Bad Request response
   * @param {Object} reply - Fastify reply object
   * @param {string} message - Error message
   * @param {Object} details - Validation details (optional)
   * @param {Object} context - Additional context for logging (optional)
   * @returns {Object} Standardized error response
   */
  static badRequest(reply: FastifyReply, message: string, details: unknown = null, context: Record<string, unknown> = {}): FastifyReply {
    const requestId = Logger.generateRequestId('error');

    Logger.log('info', 'utils', 'error-response-400', `[${requestId}] 400 Error: ${message}`, {
      requestId,
      details,
      context,
      url: reply.request?.url,
      method: reply.request?.method,
      body: reply.request?.body
    });

    return reply.code(400).send({
      success: false,
      error: 'Bad Request',
      message,
      details,
      statusCode: 400,
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send a standardized 409 Conflict response
   * @param {Object} reply - Fastify reply object
   * @param {string} message - Error message
   * @param {Object} context - Additional context for logging (optional)
   * @returns {Object} Standardized error response
   */
  static conflict(reply: FastifyReply, message: string, context: Record<string, unknown> = {}): FastifyReply {
    const requestId = Logger.generateRequestId('error');

    Logger.log('info', 'utils', 'error-response-409', `[${requestId}] 409 Error: ${message}`, {
      requestId,
      context,
      url: reply.request?.url,
      method: reply.request?.method,
      body: reply.request?.body
    });

    return reply.code(409).send({
      success: false,
      error: 'Conflict',
      message,
      statusCode: 409,
      requestId,
      timestamp: new Date().toISOString(),
      ...context
    });
  }

  /**
   * Send a standardized 500 Internal Server Error response
   * @param {Object} reply - Fastify reply object
   * @param {string} message - Error message
   * @param {Error} error - The actual error object (optional)
   * @param {Object} context - Additional context for logging (optional)
   * @returns {Object} Standardized error response
   */
  static internalError(reply: FastifyReply, message = 'Internal server error', error: Error | null = null, context: Record<string, unknown> = {}): FastifyReply {
    const requestId = Logger.generateRequestId('error');

    Logger.log('error', 'utils', 'error-response-500', `[${requestId}] 500 Error: ${message}`, {
      requestId,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: (error as Error & { code?: string }).code
      } : null,
      context,
      url: reply.request?.url,
      method: reply.request?.method,
      userContext: reply.request?.userContext ? {
        userId: reply.request.userContext.userId,
        tenantId: reply.request.userContext.tenantId,
        email: reply.request.userContext.email
      } : null
    });

    return reply.code(500).send({
      success: false,
      error: 'Internal Server Error',
      message,
      statusCode: 500,
      requestId,
      timestamp: new Date().toISOString(),
      // Only include error details in development
      ...(process.env.NODE_ENV === 'development' && error ? {
        details: {
          message: error.message,
          stack: error.stack
        }
      } : {})
    });
  }

  /**
   * Send a standardized 503 Service Unavailable response
   * @param {Object} reply - Fastify reply object
   * @param {string} message - Error message
   * @param {Object} context - Additional context for logging (optional)
   * @returns {Object} Standardized error response
   */
  static serviceUnavailable(reply: FastifyReply, message = 'Service temporarily unavailable', context: Record<string, unknown> = {}): FastifyReply {
    const requestId = Logger.generateRequestId('error');

    Logger.log('error', 'utils', 'error-response-503', `[${requestId}] 503 Error: ${message}`, {
      requestId,
      context,
      url: reply.request?.url,
      method: reply.request?.method
    });

    return reply.code(503).send({
      success: false,
      error: 'Service Unavailable',
      message,
      statusCode: 503,
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send a standardized success response
   * @param {Object} reply - Fastify reply object
   * @param {Object} data - Response data
   * @param {string} message - Success message (optional)
   * @param {number} statusCode - HTTP status code (default: 200)
   * @returns {Object} Standardized success response
   */
  static success(reply: FastifyReply, data: unknown = null, message = 'Success', statusCode = 200): FastifyReply {
    const response: { success: boolean; message: string; timestamp: string; data?: unknown } = {
      success: true,
      message,
      timestamp: new Date().toISOString()
    };

    if (data !== null) {
      response.data = data;
    }

    return reply.code(statusCode).send(response);
  }

  /**
   * Check if user has required tenantId and return standardized error if not
   * @param {Object} request - Fastify request object
   * @param {Object} reply - Fastify reply object
   * @returns {boolean} True if tenantId exists, false if error was sent
   */
  static requireTenantId(request: FastifyRequest, reply: FastifyReply): boolean {
    if (!request.userContext?.tenantId) {
      this.unauthorized(reply, 'User is not associated with any organization', {
        missingField: 'tenantId',
        userContext: request.userContext
      });
      return false;
    }
    return true;
  }

  /**
   * Check if user is authenticated and return standardized error if not
   * @param {Object} request - Fastify request object
   * @param {Object} reply - Fastify reply object
   * @returns {boolean} True if authenticated, false if error was sent
   */
  static requireAuth(request: FastifyRequest, reply: FastifyReply): boolean {
    if (!request.userContext?.isAuthenticated) {
      this.unauthorized(reply, 'Authentication required', {
        isAuthenticated: request.userContext?.isAuthenticated || false
      });
      return false;
    }
    return true;
  }
}

export default ErrorResponses;
