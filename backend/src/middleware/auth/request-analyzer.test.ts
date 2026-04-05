/**
 * RequestAnalyzer — unit tests
 *
 * Pure class: no DB, no HTTP server needed.
 * Covers the auth-bypass / public-endpoint logic that guards every request.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// shouldLogVerbose is only used in development console output — stub it out
vi.mock('../../utils/verbose-log.js', () => ({
  shouldLogVerbose: vi.fn(() => false),
}));

import { RequestAnalyzer } from './request-analyzer.js';

const req = (url: string, method = 'GET', host = 'app.example.com') => ({
  url,
  method,
  headers: { host },
});

// ---------------------------------------------------------------------------
describe('RequestAnalyzer.isPublicEndpoint', () => {
  it.each([
    '/health',
    '/api/health',
    '/api/auth/login',
    '/api/auth/callback',
    '/api/invitations/accept',
    '/api/locations',
    '/api/credits/packages',
    '/api/credits/test-route',
    '/docs',
    '/api/metrics/prometheus',
    '/test-auth',
    '/auth',
    '/logout',
  ])('returns true for public path: %s', (url) => {
    expect(RequestAnalyzer.isPublicEndpoint(req(url))).toBe(true);
  });

  it.each([
    '/api/payments/history',
    '/api/subscriptions',
    '/api/credits/deduct',
    '/api/notifications',
    '/api/admin/tenants',
    '/api/roles',
  ])('returns false for protected path: %s', (url) => {
    expect(RequestAnalyzer.isPublicEndpoint(req(url))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('RequestAnalyzer.isSystemOperation', () => {
  it.each([
    '/api/admin/tenants',
    '/api/admin/users',
    '/api/system/sync',
    '/api/internal/sync',
    '/api/webhooks/stripe',
    '/api/webhooks/razorpay',
    '/health',
    '/api/health',
    '/api/auth/logout',
    '/api/internal/health',
    '/api/permission-sync/run',
    '/api/permissions/sync',
  ])('returns true for system path: %s', (url) => {
    expect(RequestAnalyzer.isSystemOperation(req(url))).toBe(true);
  });

  it.each([
    '/api/payments/history',
    '/api/subscriptions',
    '/api/credits',
    '/api/notifications',
  ])('returns false for non-system path: %s', (url) => {
    expect(RequestAnalyzer.isSystemOperation(req(url))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('RequestAnalyzer.isOnboardingRequest', () => {
  it('matches /api/onboarding/ prefix', () => {
    expect(RequestAnalyzer.isOnboardingRequest(req('/api/onboarding/step1'))).toBe(true);
  });

  it('matches /api/signup/ prefix', () => {
    expect(RequestAnalyzer.isOnboardingRequest(req('/api/signup/start'))).toBe(true);
  });

  it('matches /api/create-tenant exactly', () => {
    expect(RequestAnalyzer.isOnboardingRequest(req('/api/create-tenant'))).toBe(true);
  });

  it('matches POST /api/tenants', () => {
    expect(RequestAnalyzer.isOnboardingRequest(req('/api/tenants', 'POST'))).toBe(true);
  });

  it('does NOT match GET /api/tenants (read-only is not onboarding)', () => {
    expect(RequestAnalyzer.isOnboardingRequest(req('/api/tenants', 'GET'))).toBe(false);
  });

  // NOTE: The implementation uses .startsWith('/api/tenants') so /api/tenants-extra
  // with POST DOES match — this is intentional (any POST to a tenants prefix).
  it('matches POST /api/tenants-extra (startsWith match)', () => {
    expect(RequestAnalyzer.isOnboardingRequest(req('/api/tenants-extra', 'POST'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('RequestAnalyzer.analyzeRequest — connection type & security level', () => {
  it('admin route → connectionType=system, securityLevel=system, requiresBypass=true', () => {
    // /api/admin/ is in systemPaths, so isSystemOperation=true → securityLevel='system'
    const analysis = RequestAnalyzer.analyzeRequest(req('/api/admin/users'));
    expect(analysis.connectionType).toBe('system');
    expect(analysis.securityLevel).toBe('system');
    expect(analysis.requiresBypass).toBe(true);
  });

  it('webhook route → connectionType=system, securityLevel=system, requiresBypass=true', () => {
    const analysis = RequestAnalyzer.analyzeRequest(req('/api/webhooks/stripe'));
    expect(analysis.connectionType).toBe('system');
    expect(analysis.securityLevel).toBe('system');  // isSystemOperation
    expect(analysis.requiresBypass).toBe(true);
  });

  it('health check → connectionType=system, requiresBypass=true', () => {
    const analysis = RequestAnalyzer.analyzeRequest(req('/health'));
    expect(analysis.requiresBypass).toBe(true);
  });

  it('regular API route → connectionType=app, securityLevel=standard, requiresBypass=false', () => {
    const analysis = RequestAnalyzer.analyzeRequest(req('/api/payments/history'));
    expect(analysis.connectionType).toBe('app');
    expect(analysis.securityLevel).toBe('standard');
    expect(analysis.requiresBypass).toBe(false);
  });

  it('sets tenantId=null (extracted from JWT, not from URL)', () => {
    const analysis = RequestAnalyzer.analyzeRequest(req('/api/notifications'));
    expect(analysis.tenantId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('RequestAnalyzer.shouldBypassRLS', () => {
  it('returns true for admin routes (bypass RLS)', () => {
    expect(RequestAnalyzer.shouldBypassRLS(req('/api/admin/tenants'))).toBe(true);
  });

  it('returns true for webhook routes', () => {
    expect(RequestAnalyzer.shouldBypassRLS(req('/api/webhooks/razorpay'))).toBe(true);
  });

  it('returns false for regular user routes (enforce RLS)', () => {
    expect(RequestAnalyzer.shouldBypassRLS(req('/api/notifications'))).toBe(false);
  });

  it('returns false for credit routes', () => {
    expect(RequestAnalyzer.shouldBypassRLS(req('/api/credits/history'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('RequestAnalyzer.extractSubdomain', () => {
  it('extracts subdomain from 3-part host', () => {
    expect(RequestAnalyzer.extractSubdomain(req('/', 'GET', 'acme.example.com'))).toBe('acme');
  });

  it('returns null for 2-part host (no subdomain)', () => {
    expect(RequestAnalyzer.extractSubdomain(req('/', 'GET', 'example.com'))).toBeNull();
  });

  it('returns null for www prefix', () => {
    expect(RequestAnalyzer.extractSubdomain(req('/', 'GET', 'www.example.com'))).toBeNull();
  });

  it('returns null for supabase domain (excluded)', () => {
    expect(RequestAnalyzer.extractSubdomain(req('/', 'GET', 'abc.supabase.co'))).toBeNull();
  });

  it('handles array host header gracefully', () => {
    const r = { url: '/', method: 'GET', headers: { host: ['acme.example.com', 'backup.example.com'] } };
    // Should not throw — first entry is used
    expect(() => RequestAnalyzer.extractSubdomain(r)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
describe('RequestAnalyzer.requiresElevatedAccess', () => {
  it('returns true for admin routes', () => {
    expect(RequestAnalyzer.requiresElevatedAccess(req('/api/admin/users'))).toBe(true);
  });

  it('returns true for system routes', () => {
    expect(RequestAnalyzer.requiresElevatedAccess(req('/api/webhooks/stripe'))).toBe(true);
  });

  it('returns false for regular routes', () => {
    expect(RequestAnalyzer.requiresElevatedAccess(req('/api/payments/history'))).toBe(false);
  });
});
