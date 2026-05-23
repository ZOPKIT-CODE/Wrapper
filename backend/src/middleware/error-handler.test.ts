/**
 * Unit tests for errorHandler middleware.
 *
 * The handler is a pure function of (error, request, reply).
 * We supply lightweight mock objects and never touch the DB.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock Sentry to avoid @opentelemetry ESM resolution issues in Vitest ────
vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
  withScope: vi.fn((cb: (scope: { setTag: unknown; setContext: unknown }) => void) =>
    cb({ setTag: vi.fn(), setContext: vi.fn() })
  ),
}));

import { errorHandler } from './error-handler.js';

// ── Mock ActivityLogger so fire-and-forget doesn't blow up ─────────────────
vi.mock('../services/activityLogger.js', () => ({
  default: {
    logError: vi.fn().mockResolvedValue({ success: false }),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    log: { error: vi.fn() },
    url: '/api/test',
    method: 'POST',
    ip: '127.0.0.1',
    headers: { 'user-agent': 'vitest/1.0' },
    user: null,
    userContext: null,
    ...overrides,
  } as unknown as import('fastify').FastifyRequest;
}

function makeReply() {
  const reply = {
    code: vi.fn(),
    send: vi.fn(),
  };
  // Enable chaining: reply.code(n).send(body)
  reply.code.mockReturnValue(reply);
  return reply as unknown as import('fastify').FastifyReply;
}

function makeError(overrides: Record<string, unknown> = {}): Error & Record<string, unknown> {
  const err = new Error('test error') as Error & Record<string, unknown>;
  Object.assign(err, overrides);
  return err;
}

// ── Validation errors (status 400) ───────────────────────────────────────────

describe('errorHandler – validation errors', () => {
  let originalEnv: NodeJS.ProcessEnv['NODE_ENV'];
  beforeEach(() => { originalEnv = process.env.NODE_ENV; });
  afterEach(() => { process.env.NODE_ENV = originalEnv; });

  it('returns 400 for errors with a validation array', async () => {
    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({
      validation: [{ instancePath: '/email', message: 'must be a string', keyword: 'type', params: { type: 'string' } }],
    });

    await errorHandler(err, req, reply);

    expect(reply.code).toHaveBeenCalledWith(400);
    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.statusCode).toBe(400);
    // Legacy shape: `error` is a human-readable string (kept for CRM/FA compat).
    expect(body.success).toBe(false);
    expect(body.error).toBe('Validation Error');
    // New canonical structured shape lives under `apiError`:
    expect(body.apiError.code).toBe('INVALID_INPUT');
    expect(body.apiError.message).toBe('Validation Error');
  });

  it('maps "required" keyword to a human-readable message', async () => {
    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({
      validation: [{ instancePath: '', params: { missingProperty: 'email' }, keyword: 'required' }],
    });

    await errorHandler(err, req, reply);

    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.details[0].message).toBe('email is required');
  });

  it('maps "minLength" keyword with limit', async () => {
    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({
      validation: [{ instancePath: '/password', keyword: 'minLength', params: { limit: 8 } }],
    });

    await errorHandler(err, req, reply);

    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.details[0].message).toBe('password must be at least 8 characters');
  });

  it('maps "maxLength" keyword with limit', async () => {
    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({
      validation: [{ instancePath: '/name', keyword: 'maxLength', params: { limit: 50 } }],
    });

    await errorHandler(err, req, reply);

    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.details[0].message).toBe('name must not exceed 50 characters');
  });

  it('maps "format: email" keyword to an email message', async () => {
    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({
      validation: [{ instancePath: '/email', keyword: 'format', params: { format: 'email' } }],
    });

    await errorHandler(err, req, reply);

    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.details[0].message).toBe('email must be a valid email address');
  });

  it('maps "enum" keyword with allowed values list', async () => {
    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({
      validation: [{ instancePath: '/status', keyword: 'enum', params: { allowedValues: ['active', 'inactive'] } }],
    });

    await errorHandler(err, req, reply);

    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.details[0].message).toBe('status must be one of: active, inactive');
  });

  it('maps "type" keyword', async () => {
    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({
      validation: [{ instancePath: '/age', keyword: 'type', params: { type: 'integer' } }],
    });

    await errorHandler(err, req, reply);

    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.details[0].message).toBe('age must be of type integer');
  });

  it('sets response.message from a single validation error', async () => {
    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({
      validation: [{ instancePath: '/name', keyword: 'minLength', params: { limit: 3 } }],
    });

    await errorHandler(err, req, reply);

    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.message).toContain('name must be at least 3 characters');
  });

  it('sets response.message from multiple validation errors', async () => {
    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({
      validation: [
        { instancePath: '/email', keyword: 'format', params: { format: 'email' } },
        { instancePath: '/name', keyword: 'minLength', params: { limit: 3 } },
      ],
    });

    await errorHandler(err, req, reply);

    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.message).toMatch(/Please fix the following errors:/);
  });
});

// ── HTTP status-code errors ───────────────────────────────────────────────────

describe('errorHandler – statusCode errors', () => {
  it('uses the error.statusCode and message directly', async () => {
    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({ statusCode: 404, message: 'Resource not found' });

    await errorHandler(err, req, reply);

    expect(reply.code).toHaveBeenCalledWith(404);
    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.error).toBe('Resource not found');
    expect(body.apiError.code).toBe('NOT_FOUND');
    expect(body.apiError.message).toBe('Resource not found');
    expect(body.statusCode).toBe(404);
  });

  it('returns 409 for conflict errors', async () => {
    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({ statusCode: 409, message: 'Conflict' });

    await errorHandler(err, req, reply);

    expect(reply.code).toHaveBeenCalledWith(409);
  });
});

// ── JWT / Auth errors ─────────────────────────────────────────────────────────

describe('errorHandler – auth errors', () => {
  it('returns 401 for FST_JWT_NO_AUTHORIZATION_IN_HEADER', async () => {
    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({ code: 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' });

    await errorHandler(err, req, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.error).toBe('No authorization header');
    expect(body.apiError.code).toBe('UNAUTHORIZED');
    expect(body.apiError.message).toBe('No authorization header');
  });

  it('returns 401 for FST_JWT_AUTHORIZATION_TOKEN_INVALID', async () => {
    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({ code: 'FST_JWT_AUTHORIZATION_TOKEN_INVALID' });

    await errorHandler(err, req, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.error).toBe('Invalid authorization token');
    expect(body.apiError.code).toBe('UNAUTHORIZED');
    expect(body.apiError.message).toBe('Invalid authorization token');
  });

  it('returns 429 for FST_RATE_LIMIT_REACHED', async () => {
    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({ code: 'FST_RATE_LIMIT_REACHED' });

    await errorHandler(err, req, reply);

    expect(reply.code).toHaveBeenCalledWith(429);
    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.error).toBe('Rate limit exceeded');
    expect(body.apiError.code).toBe('RATE_LIMITED');
    expect(body.apiError.message).toBe('Rate limit exceeded');
  });
});

// ── Infrastructure errors ────────────────────────────────────────────────────

describe('errorHandler – infrastructure errors', () => {
  it('returns 503 for ECONNREFUSED', async () => {
    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({ code: 'ECONNREFUSED' });

    await errorHandler(err, req, reply);

    expect(reply.code).toHaveBeenCalledWith(503);
    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.error).toBe('Service unavailable');
    expect(body.apiError.code).toBe('SERVICE_UNAVAILABLE');
    expect(body.apiError.message).toBe('Service unavailable');
  });

  it('returns 500 for DrizzleError without exposing internals in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({ name: 'DrizzleError', message: 'db internal error' });

    await errorHandler(err, req, reply);

    expect(reply.code).toHaveBeenCalledWith(500);
    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.error).toBe('Database error');
    expect(body.apiError.code).toBe('INTERNAL');
    expect(body.apiError.message).toBe('Database error');
    expect(body.details).toBeNull();

    process.env.NODE_ENV = originalEnv;
  });

  it('exposes DrizzleError message in development', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({ name: 'DrizzleError', message: 'some db detail' });

    await errorHandler(err, req, reply);

    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.details).toBeTruthy();
    expect(body.details[0].message).toBe('some db detail');

    process.env.NODE_ENV = originalEnv;
  });
});

// ── Generic / unknown errors ──────────────────────────────────────────────────

describe('errorHandler – generic errors', () => {
  it('defaults to 500 Internal Server Error for unknown errors', async () => {
    const req = makeRequest();
    const reply = makeReply();
    const err = makeError(); // no statusCode, no code, no validation

    await errorHandler(err, req, reply);

    expect(reply.code).toHaveBeenCalledWith(500);
    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.error).toBe('Internal Server Error');
    expect(body.apiError.code).toBe('INTERNAL');
    expect(body.apiError.message).toBe('Internal Server Error');
    expect(body.statusCode).toBe(500);
  });

  it('includes timestamp and path in all responses', async () => {
    const req = makeRequest({ url: '/api/notifications' });
    const reply = makeReply();
    const err = makeError({ statusCode: 403 });

    await errorHandler(err, req, reply);

    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.path).toBe('/api/notifications');
    expect(typeof body.timestamp).toBe('string');
    // timestamp must be ISO 8601
    expect(() => new Date(body.timestamp)).not.toThrow();
  });
});

// ── Stack trace in development ────────────────────────────────────────────────

describe('errorHandler – development stack trace', () => {
  it('includes stack in development mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({ statusCode: 500 });
    err.stack = 'Error: test\n    at file.ts:10:5';

    await errorHandler(err, req, reply);

    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.stack).toBeTruthy();

    process.env.NODE_ENV = originalEnv;
  });

  it('omits stack in production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const req = makeRequest();
    const reply = makeReply();
    const err = makeError({ statusCode: 500 });
    err.stack = 'Error: test\n    at file.ts:10:5';

    await errorHandler(err, req, reply);

    const body = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.stack).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });
});
