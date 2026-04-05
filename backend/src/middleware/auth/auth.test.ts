import { beforeEach, describe, expect, it, vi } from 'vitest';

// We must mock DB/Kinde modules because `src/db/index.js` has top-level initialization.
const {
  analyzeRequestMock,
  getSystemConnectionMock,
  getAppConnectionMock,
  validateTokenMock,
  refreshTokenMock,
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
  const validateTokenMock: any = vi.fn(async () => null);
  const refreshTokenMock = vi.fn(async () => ({
    access_token: 'new-access',
    refresh_token: 'new-refresh',
    expires_in: 3600,
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
    validateTokenMock,
    refreshTokenMock,
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

vi.mock('../../features/auth/index.js', () => ({
  kindeService: {
    validateToken: validateTokenMock,
    refreshToken: refreshTokenMock,
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: jwtVerifyMock,
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
    validateTokenMock.mockImplementationOnce(
      async () =>
        await new Promise((_resolve) => {
          // never resolves
        })
    );

    const req = makeRequest({
      url: '/api/notifications',
      cookies: { kinde_token: 't' },
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

  it('attempts refresh when access token is invalid but refresh cookie exists', async () => {
    const { authMiddleware } = await loadAuthModule();
    validateTokenMock.mockRejectedValueOnce(new Error('invalid token'));
    validateTokenMock.mockResolvedValueOnce({
      userId: 'kinde-u1',
      email: 'u@example.com',
      name: 'User',
      organization: { id: 'org-1' },
    });

    // Make processAuthenticatedUser fast: avoid tenant lookup by returning null user in DB,
    // and bypass RLS setup.
    analyzeRequestMock.mockReturnValue({ requiresBypass: true });

    const req = makeRequest({
      url: '/api/notifications',
      cookies: { kinde_token: 'bad', kinde_refresh_token: 'refresh' },
    });
    const reply = makeReply();

    await authMiddleware(req, reply);

    expect(refreshTokenMock).toHaveBeenCalledWith('refresh');
    expect(reply.setCookie).toHaveBeenCalledWith(
      'kinde_token',
      'new-access',
      expect.objectContaining({ httpOnly: true, path: '/' })
    );
    expect(req.userContext?.isAuthenticated).toBe(true);
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

