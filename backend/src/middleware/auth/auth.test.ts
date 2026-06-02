import { beforeEach, describe, expect, it, vi } from 'vitest';

// We must mock DB/Cognito modules because `src/db/index.js` has top-level initialization.
const {
  analyzeRequestMock,
  getSystemConnectionMock,
  getAppConnectionMock,
  verifyCognitoTokenMock,
  isCognitoIssuerMock,
  jwtDecodeMock,
  jwtVerifyMock,
  dbSelectMock,
  dbSelectTenantUserMock,
} = vi.hoisted(() => {
  const analyzeRequestMock = vi.fn(() => ({ requiresBypass: false }));

  const systemSql = vi.fn(async () => []);
  const appSql = vi.fn(async () => []);
  const getSystemConnectionMock = vi.fn(() => systemSql);
  const getAppConnectionMock = vi.fn(() => appSql);

  // Use `any` here to avoid Vitest inferring overly-narrow `null` / `never` types,
  // which then breaks `tsc --noEmit` when we override implementations per-test.
  const verifyCognitoTokenMock: any = vi.fn(async () => null);
  // tokenIsCognito() decodes the token and checks the issuer; default to a Cognito issuer.
  const isCognitoIssuerMock = vi.fn(() => true);
  const jwtDecodeMock = vi.fn(() => ({
    iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TEST',
  }));

  const jwtVerifyMock: any = vi.fn(() => {
    throw new Error('jwt verify not configured in test');
  });

  // Minimal Drizzle-like chain stubs used by the operations-JWT path.
  const dbSelectTenantUserMock: any = vi.fn(async () => []);
  const dbSelectMock: any = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => []),
      })),
    })),
  }));

  return {
    analyzeRequestMock,
    getSystemConnectionMock,
    getAppConnectionMock,
    verifyCognitoTokenMock,
    isCognitoIssuerMock,
    jwtDecodeMock,
    jwtVerifyMock,
    dbSelectMock,
    dbSelectTenantUserMock,
  };
});

vi.mock('../../db/index.js', () => ({
  db: {
    select: dbSelectMock,
  },
  dbManager: {
    getSystemConnection: getSystemConnectionMock,
    getAppConnection: getAppConnectionMock,
  },
}));

vi.mock('../../db/schema/index.js', () => ({
  tenants: { tenantId: 'tenantId', kindeOrgId: 'kindeOrgId' },
  tenantUsers: {
    userId: 'userId',
    tenantId: 'tenantId',
    email: 'email',
    name: 'name',
    onboardingCompleted: 'onboardingCompleted',
    isActive: 'isActive',
    isTenantAdmin: 'isTenantAdmin',
    kindeUserId: 'kindeUserId',
  },
  customRoles: { roleName: 'roleName', isSystemRole: 'isSystemRole', tenantId: 'tenantId' },
  userRoleAssignments: { userId: 'userId', roleId: 'roleId', organizationId: 'organizationId' },
}));

vi.mock('./request-analyzer.js', () => ({
  RequestAnalyzer: {
    analyzeRequest: analyzeRequestMock,
  },
}));

vi.mock('../../utils/verbose-log.js', () => ({
  shouldLogVerbose: vi.fn(() => false),
}));

vi.mock('../../features/auth/services/cognito-service.js', () => ({
  isCognitoIssuer: isCognitoIssuerMock,
  verifyCognitoToken: verifyCognitoTokenMock,
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: jwtVerifyMock,
    decode: jwtDecodeMock,
  },
}));

async function loadAuthModule() {
  // auth.ts reads NODE_ENV at module-load time (isProduction const),
  // so tests must set env BEFORE importing and then import fresh.
  vi.resetModules();
  return await import('./auth.js');
}

function makeReply() {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setCookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  };
  return reply as any;
}

function makeRequest(overrides: Partial<any> = {}) {
  return {
    url: '/api/protected',
    method: 'GET',
    headers: {},
    cookies: {},
    log: {
      error: vi.fn(),
      debug: vi.fn(),
    },
    ...overrides,
  } as any;
}

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPERATIONS_JWT_SECRET;
    delete process.env.SHARED_APP_JWT_SECRET;
    delete process.env.NODE_ENV;
  });

  it('treats configured public routes as unauthenticated and still sets request.db', async () => {
    const { authMiddleware } = await loadAuthModule();
    analyzeRequestMock.mockReturnValueOnce({ requiresBypass: true });
    const req = makeRequest({ url: '/health' });
    const reply = makeReply();

    await authMiddleware(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
    expect(getSystemConnectionMock).toHaveBeenCalledTimes(1);
    expect(req.db).toBeTruthy();
  });

  it('returns 401 when no token is present for protected routes', async () => {
    const { authMiddleware } = await loadAuthModule();
    const req = makeRequest({ url: '/api/notifications' });
    const reply = makeReply();

    await authMiddleware(req, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unauthorized', message: 'Authentication token required' })
    );
  });

  it('returns 408 when token validation times out', async () => {
    vi.useFakeTimers();
    const { authMiddleware } = await loadAuthModule();
    // tokenIsCognito() is true (jwtDecode -> cognito iss, isCognitoIssuer -> true),
    // so the middleware calls verifyCognitoToken — make it hang to trip the timeout.
    verifyCognitoTokenMock.mockImplementationOnce(
      async () =>
        await new Promise(() => {
          // never resolves
        })
    );

    const req = makeRequest({
      url: '/api/notifications',
      cookies: { idp_token: 't' },
    });
    const reply = makeReply();

    const p = authMiddleware(req, reply);
    await vi.advanceTimersByTimeAsync(10_000);
    await p;

    expect(reply.code).toHaveBeenCalledWith(408);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Request Timeout', retryable: true })
    );

    vi.useRealTimers();
  });

  it('clears cookies and requires re-auth when access token is invalid and refresh cookie exists', async () => {
    const { authMiddleware } = await loadAuthModule();
    // Cognito-only: there is no silent in-middleware refresh anymore. When the access
    // token is invalid, the catch path calls handleTokenRefresh, which clears the
    // session cookies and replies 401 with { requiresReauth: true }.
    // tokenIsCognito() is true, so the main verify (verifyCognitoToken) runs and throws.
    verifyCognitoTokenMock.mockRejectedValue(new Error('invalid token'));

    // Make processAuthenticatedUser fast: avoid tenant lookup by returning null user in DB,
    // and bypass RLS setup.
    analyzeRequestMock.mockReturnValue({ requiresBypass: true });

    const req = makeRequest({
      url: '/api/notifications',
      cookies: { idp_token: 'bad', idp_refresh_token: 'refresh' },
    });
    const reply = makeReply();

    await authMiddleware(req, reply);

    expect(reply.clearCookie).toHaveBeenCalledWith('idp_token', expect.objectContaining({ path: '/' }));
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ requiresReauth: true }));
  });

  it('uses operations JWT when configured and tenant+user are found', async () => {
    process.env.OPERATIONS_JWT_SECRET = 'ops-secret';
    const { authMiddleware } = await loadAuthModule();
    jwtVerifyMock.mockReturnValueOnce({ currentTenantId: 'tenant-1', email: 'ops@example.com' });

    // First tenant lookup by tenantId returns a row.
    dbSelectMock.mockImplementationOnce(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ tenantId: 'tenant-1', kindeOrgId: 'org-ops' }]),
        })),
      })),
    }));
    // tenantUsers lookup returns a row.
    dbSelectMock.mockImplementationOnce(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: dbSelectTenantUserMock.mockResolvedValueOnce([
            {
              userId: 'u-internal',
              kindeUserId: 'kinde-u2',
              tenantId: 'tenant-1',
              email: 'ops@example.com',
              name: 'Ops User',
              onboardingCompleted: true,
              isActive: true,
              isTenantAdmin: true,
            },
          ]),
        })),
      })),
    }));

    analyzeRequestMock.mockReturnValue({ requiresBypass: true });

    const req = makeRequest({
      url: '/api/notifications',
      headers: { authorization: 'Bearer ops-token' },
    });
    const reply = makeReply();

    await authMiddleware(req, reply);

    expect(req.userContext?.tenantId).toBe('tenant-1');
    expect(req.userContext?.email).toBe('ops@example.com');
    expect(req.userContext?.isAuthenticated).toBe(true);
  });
});

describe('csrfProtection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NODE_ENV;
    delete process.env.FRONTEND_URL;
  });

  it('does nothing for GET requests', async () => {
    process.env.NODE_ENV = 'production';
    const { csrfProtection } = await loadAuthModule();
    const req = makeRequest({ method: 'GET', url: '/api/notifications' });
    const reply = makeReply();

    await csrfProtection(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
  });

  it('skips CSRF checks for webhook URLs', async () => {
    process.env.NODE_ENV = 'production';
    const { csrfProtection } = await loadAuthModule();
    const req = makeRequest({ method: 'POST', url: '/api/subscriptions/webhook' });
    const reply = makeReply();

    await csrfProtection(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
  });

  it('skips CSRF checks when Authorization Bearer header is present', async () => {
    process.env.NODE_ENV = 'production';
    const { csrfProtection } = await loadAuthModule();
    const req = makeRequest({
      method: 'POST',
      url: '/api/notifications',
      headers: { authorization: 'Bearer abc' },
    });
    const reply = makeReply();

    await csrfProtection(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
  });

  it('blocks cookie-authenticated POST without Origin/Referer in production', async () => {
    process.env.NODE_ENV = 'production';
    const { csrfProtection } = await loadAuthModule();
    const req = makeRequest({ method: 'POST', url: '/api/notifications', headers: {} });
    const reply = makeReply();

    await csrfProtection(req, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Forbidden', message: expect.stringContaining('Origin') })
    );
  });

  it('blocks disallowed origin', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://app.zopkit.com';
    const { csrfProtection } = await loadAuthModule();
    const req = makeRequest({
      method: 'POST',
      url: '/api/notifications',
      headers: { origin: 'https://evil.example.com' },
    });
    const reply = makeReply();

    await csrfProtection(req, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Forbidden', message: 'Cross-origin request blocked' })
    );
  });

  it('allows configured frontend origin', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://app.zopkit.com';
    const { csrfProtection } = await loadAuthModule();
    const req = makeRequest({
      method: 'POST',
      url: '/api/notifications',
      headers: { origin: 'https://app.zopkit.com' },
    });
    const reply = makeReply();

    await csrfProtection(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
  });
});

