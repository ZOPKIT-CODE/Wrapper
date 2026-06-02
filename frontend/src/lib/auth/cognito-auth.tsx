/**
 * Cognito-backed auth shim — the app's auth provider (formerly `@kinde-oss/kinde-auth-react`).
 *
 * Part of the Kinde -> Cognito migration. Consumers import `useKindeAuth()` /
 * `KindeProvider` directly from this module (`@/lib/auth/cognito-auth`); the names are
 * kept so the call sites were unchanged by the cutover. They run against Cognito via the
 * Wrapper's backend-mediated flow:
 *   - login  -> redirect to GET /api/auth/oauth/login (backend builds the Cognito
 *               Hosted-UI + PKCE redirect, sets httpOnly cookies on callback)
 *   - session -> GET /api/auth/me (cookie-authenticated)
 *   - logout -> POST /api/auth/logout (returns the Cognito logout URL)
 *   - getToken() -> null: API auth rides the httpOnly cookie (axios withCredentials),
 *     not a JS-held Bearer, so there is no client-side token to hand back.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface AuthUser {
  id?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  permissions?: string[];
  organization?: unknown;
  [key: string]: unknown;
}

interface KindeAuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
}

const CognitoAuthContext = createContext<KindeAuthContextValue | null>(null);

async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null) as { data?: { user?: AuthUser; organization?: unknown } } | null;
    const user = body?.data?.user ?? null;
    if (user && body?.data?.organization && user.organization === undefined) {
      user.organization = body.data.organization;
    }
    return user;
  } catch {
    return null;
  }
}

/** Provider — fetches the backend session once on mount. Named `KindeProvider` below for the alias. */
export function CognitoAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setUser(await fetchMe());
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<KindeAuthContextValue>(
    () => ({ user, isAuthenticated: !!user, isLoading, error, refresh }),
    [user, isLoading, error, refresh],
  );

  return <CognitoAuthContext.Provider value={value}>{children}</CognitoAuthContext.Provider>;
}

// Kept-name export so existing `import { KindeProvider } from '@/lib/auth/cognito-auth'` call sites work.
export const KindeProvider = CognitoAuthProvider;

interface LoginOptions {
  provider?: string;
  state?: string;
  app_code?: string;
  redirect_url?: string;
  // Kinde-shaped options are accepted but largely ignored; provider/state are honored.
  authUrlParams?: Record<string, string>;
  [key: string]: unknown;
}

function startBackendLogin(opts?: LoginOptions): void {
  const params = new URLSearchParams();
  const provider = opts?.provider || (opts?.authUrlParams?.connection_id ? 'google' : undefined);
  if (provider) params.set('provider', provider);
  if (opts?.app_code && opts?.redirect_url) {
    params.set('state', JSON.stringify({ app_code: opts.app_code, redirect_url: opts.redirect_url }));
  } else if (opts?.state) {
    params.set('state', opts.state);
  }
  const qs = params.toString();
  window.location.href = `/api/auth/oauth/login${qs ? `?${qs}` : ''}`;
}

async function backendLogout(): Promise<void> {
  try {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => null) as { data?: { logoutUrl?: string } } | null;
    const logoutUrl = body?.data?.logoutUrl;
    window.location.href = logoutUrl || '/login';
  } catch {
    window.location.href = '/login';
  }
}

/**
 * Drop-in `useKindeAuth()` — same surface the app already consumes
 * (isAuthenticated, isLoading, user, error, getToken, login, logout, getPermission(s)).
 */
export function useKindeAuth() {
  const ctx = useContext(CognitoAuthContext);
  const user = ctx?.user ?? null;
  const permissions: string[] = Array.isArray(user?.permissions) ? (user!.permissions as string[]) : [];

  return {
    isAuthenticated: ctx?.isAuthenticated ?? false,
    isLoading: ctx?.isLoading ?? false,
    user,
    error: ctx?.error ?? null,
    // Cookie-based auth: there is no JS-held Bearer to return.
    getToken: async (): Promise<string | null> => null,
    login: (opts?: LoginOptions) => startBackendLogin(opts),
    register: (opts?: LoginOptions) => startBackendLogin(opts),
    logout: () => backendLogout(),
    getPermission: (key: string) => ({ isGranted: permissions.includes(key) }),
    getPermissions: () => ({ permissions }),
    getClaim: () => null,
    getOrganization: () => ({ orgCode: (user?.organization as { orgCode?: string } | undefined)?.orgCode }),
    refresh: ctx?.refresh ?? (async () => {}),
  };
}

export default { KindeProvider, CognitoAuthProvider, useKindeAuth };
