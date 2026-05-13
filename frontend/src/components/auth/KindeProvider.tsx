import React, { useEffect, useState, useRef } from 'react';
import { KindeProvider as OriginalKindeProvider, useKindeAuth } from '@kinde-oss/kinde-auth-react';
import toast from 'react-hot-toast';
import useSilentAuth from '@/hooks/useSilentAuth';
import { setKindeTokenGetter } from '@/lib/api';
import { config } from '@/lib/config';
import { logger } from '@/lib/logger';
import { clearStaleAuthStorage, isInvalidGrantError, markSessionRecoveryReason } from '@/lib/auth/session-recovery';

interface KindeProviderProps {
  children: React.ReactNode;
}

// Component to set up the token getter and silent auth after Kinde is initialized
// Token promise cache: collapses concurrent getToken() calls into a single
// Kinde SDK round-trip. Cleared after TOKEN_CACHE_TTL_MS so a refresh token
// swap is picked up on the next burst, not stuck on the old value.
const TOKEN_CACHE_TTL_MS = 45_000; // 45 s — well inside a typical JWT lifetime
let _tokenPromise: Promise<string | null> | null = null;
let _tokenExpiresAt = 0;

function getCachedToken(getTokenFn: () => Promise<string | null>): Promise<string | null> {
  const now = Date.now();
  if (_tokenPromise && now < _tokenExpiresAt) return _tokenPromise;
  _tokenExpiresAt = now + TOKEN_CACHE_TTL_MS;
  _tokenPromise = getTokenFn().catch((err) => {
    // Evict on error so the next caller retries rather than getting the same rejection.
    _tokenPromise = null;
    _tokenExpiresAt = 0;
    throw err;
  });
  return _tokenPromise;
}

function TokenSetupComponent() {
  const { getToken, isAuthenticated, error, isLoading } = useKindeAuth();
  const lastNoTokenLogAtRef = useRef(0);
  const invalidGrantHandledRef = useRef(false);

  // Always point at the latest getToken from Kinde. A one-time setKindeTokenGetter
  // closure must not capture an early getToken from before auth finished loading —
  // that caused API calls (e.g. admin dashboard) to omit the Bearer header (dev: Vite
  // proxies /api to the backend on :3000; the SPA still needs a valid Bearer for auth).
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    setKindeTokenGetter(async () => {
      try {
        logger.debug('🔑 TokenGetter: Called');

        const token = await getCachedToken(() => getTokenRef.current());

        if (token) {
          logger.debug('✅ TokenGetter: Successfully retrieved token from Kinde');
          return token;
        } else {
          // Avoid log spam in dev mode when many unauthenticated requests run.
          const now = Date.now();
          if (now - lastNoTokenLogAtRef.current > 10_000) {
            logger.debug('❌ TokenGetter: No token from Kinde');
            lastNoTokenLogAtRef.current = now;
          }
          return null;
        }
      } catch (error: any) {
        // Handle invalid_grant errors gracefully
        const isInvalidGrant = isInvalidGrantError(error);

        if (isInvalidGrant) {
          logger.warn('⚠️ TokenGetter: invalid_grant detected. Clearing stale auth storage.');
          clearStaleAuthStorage();
          markSessionRecoveryReason('invalid_grant');
        } else {
          logger.error('❌ TokenGetter: Error getting token', error);
        }
        return null;
      }
    });
  }, []);

  useEffect(() => {
    if (isLoading || isAuthenticated || !error) return;

    const errorPayload = error as any;
    logger.error('❌ Kinde auth error details:', {
      error: errorPayload?.error || errorPayload?.response?.data?.error || null,
      error_description:
        errorPayload?.error_description ||
        errorPayload?.response?.data?.error_description ||
        errorPayload?.message ||
        null,
      status: errorPayload?.status_code || errorPayload?.response?.status || null,
      pathname: window.location.pathname,
    });

    if (!isInvalidGrantError(error)) return;
    if (invalidGrantHandledRef.current) return;

    invalidGrantHandledRef.current = true;
    clearStaleAuthStorage();
    markSessionRecoveryReason('invalid_grant');

    toast.error('Session expired. Please sign in again.', {
      id: 'session-expired-recovery',
      duration: 6000,
      position: 'top-center',
    });

    const currentPath = window.location.pathname;
    const loginPath = '/login?error=Session%20expired.%20Please%20sign%20in%20again.';
    if (!currentPath.startsWith('/login')) {
      window.location.replace(loginPath);
    }
  }, [error, isAuthenticated, isLoading]);

  return null; // This component doesn't render anything
}

// Component that detects stale Kinde sessions (oauth2/token 400 swallowed by SDK)
// Kinde returns null from getToken() without throwing, so we detect via cookie heuristic
function SessionExpiryDetector() {
  const { isLoading, isAuthenticated } = useKindeAuth();
  const shownRef = useRef(false);

  useEffect(() => {
    // Reset flag when user successfully authenticates
    if (isAuthenticated) {
      shownRef.current = false;
      localStorage.removeItem('session_expiry_toast_shown');
      return;
    }

    // Skip while Kinde is still loading
    if (isLoading) return;

    // Skip on login/callback pages — 401 is expected there
    const skipPaths = ['/login', '/auth/callback'];
    if (skipPaths.some(p => window.location.pathname === p || window.location.pathname.startsWith(p + '/'))) return;

    // Only show once per expiry event
    if (shownRef.current) return;
    const alreadyShown = localStorage.getItem('session_expiry_toast_shown');
    if (alreadyShown && (Date.now() - parseInt(alreadyShown)) < 30_000) return;

    // Heuristic: check for Kinde session cookies or localStorage artifacts
    const hasKindeSession = (
      document.cookie.split(';').some(c => {
        const name = c.trim().split('=')[0].toLowerCase();
        return name.includes('kinde') || name.includes('kbte') || name.includes('enduser');
      }) ||
      Object.keys(localStorage).some(k => k.toLowerCase().includes('kinde'))
    );

    if (!hasKindeSession) return;

    // Session was present but Kinde failed to refresh — stale session
    shownRef.current = true;
    localStorage.setItem('session_expiry_toast_shown', Date.now().toString());
    clearStaleAuthStorage();
    markSessionRecoveryReason('session_expired');

    toast.error('Your session has expired. Please sign in again.', {
      id: 'session-expired',
      duration: 8000,
      position: 'top-center',
    });
  }, [isLoading, isAuthenticated]);

  return null;
}

// Component that monitors online/offline status and shows toasts
function OnlineStatusMonitor() {
  useEffect(() => {
    const handleOffline = () => {
      toast.error("You're offline. Please check your internet connection.", {
        id: 'offline-status',
        duration: Infinity, // Stay until dismissed or back online
        position: 'top-center',
      })
    }

    const handleOnline = () => {
      toast.dismiss('offline-status')
      toast.success("You're back online.", {
        id: 'back-online',
        duration: 3000,
        position: 'top-center',
      })
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    // Show immediately if already offline on mount
    if (!navigator.onLine) handleOffline()

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  return null
}

// Dev-only network debug for Kinde token exchange failures that may not surface via SDK error state.
function DevKindeTokenNetworkDebugger() {
  useEffect(() => {
    if (!(import.meta.env.DEV || import.meta.env.MODE === 'development')) return;

    const globalKey = '__kindeFetchDebugPatched__';
    const win = window as any;
    if (win[globalKey]) return;
    win[globalKey] = true;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);

      try {
        const requestUrl = String(args[0]);
        if (requestUrl.includes('/oauth2/token') && requestUrl.includes('auth.zopkit.com') && !response.ok) {
          let responseBody: string | null = null;
          try {
            responseBody = await response.clone().text();
          } catch {
            responseBody = null;
          }

          logger.error('❌ Kinde /oauth2/token failed:', {
            status: response.status,
            statusText: response.statusText,
            url: requestUrl,
            body: responseBody,
          });
        }
      } catch {
        // Avoid affecting auth flow on debug parsing issues.
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
      win[globalKey] = false;
    };
  }, []);

  return null;
}

// Component to handle silent authentication initialization
function SilentAuthInitializer() {
  const { isLoading } = useKindeAuth();
  const { checkSilentAuth, isChecking, hasChecked } = useSilentAuth();
  const [initStarted, setInitStarted] = useState(false);

  useEffect(() => {
    // Only start silent auth check once Kinde is loaded and we haven't started yet
    if (!isLoading && !initStarted && !hasChecked && !isChecking) {
      logger.debug('🔄 SilentAuth: Initializing silent authentication...');
      setInitStarted(true);

      // Add a small delay to ensure everything is properly initialized
      const timer = setTimeout(() => {
        checkSilentAuth().then((result) => {
          logger.debug('✅ SilentAuth: Initial silent auth check completed:', result);
        }).catch((error) => {
          logger.debug('ℹ️ SilentAuth: Initial silent auth check failed (expected):', error);
        });
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [isLoading, checkSilentAuth, initStarted, hasChecked, isChecking]);

  return null; // This component doesn't render anything
}

export const KindeProvider: React.FC<KindeProviderProps> = ({
  children
}) => {
  // Keep the auth subdomain - Kinde handles domain-wide cookies automatically
  const domain = config.KINDE_DOMAIN;
  const clientId = import.meta.env.VITE_KINDE_CLIENT_ID;
  const isDevelopmentEnv =
    import.meta.env.MODE === 'development' ||
    import.meta.env.DEV ||
    import.meta.env.VITE_ENV === 'development';

  // CRITICAL: Set a consistent redirect URI to prevent OAuth 400 errors
  // The redirect URI must match between authorization and token requests
  // Default to the standard callback path if not explicitly configured
  // Normalize the redirect URI (remove trailing slashes, ensure exact match)
  const baseRedirectUri = isDevelopmentEnv
    ? `${window.location.origin}/auth/callback`
    : (import.meta.env.VITE_KINDE_REDIRECT_URI || `${window.location.origin}/auth/callback`);
  const redirectUri = baseRedirectUri.replace(/\/$/, ''); // Remove trailing slash
  const logoutUri = (
    isDevelopmentEnv
      ? window.location.origin
      : (import.meta.env.VITE_KINDE_LOGOUT_URI || window.location.origin)
  ).replace(/\/$/, '');

  if (!domain || !clientId) {
    logger.error('Kinde configuration missing. Please check environment variables.');
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center p-8 max-w-md">
          <div className="mb-4">
            <div className="w-12 h-12 bg-gray-300 rounded mx-auto mb-4 flex items-center justify-center">
              <span className="text-gray-600 font-bold">🔧</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h2>
          <p className="text-red-700 mb-4">
            Authentication is not properly configured.
            Please check your environment variables.
          </p>
          <div className="text-sm text-red-600">
            <p>Required environment variables:</p>
            <ul className="list-disc list-inside mt-2">
              <li>VITE_KINDE_DOMAIN</li>
              <li>VITE_KINDE_CLIENT_ID</li>
              <li>VITE_KINDE_GOOGLE_CONNECTION_ID (for custom auth)</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Let Kinde handle organization management automatically
  logger.debug('🔄 KindeProvider: Using Kinde built-in organization handling');

  // Validate configuration to prevent OAuth 400 errors
  useEffect(() => {
    const validateConfig = () => {
      logger.debug('🔍 KindeProvider: Validating OAuth configuration...');

      // Check domain format
      if (!domain.startsWith('https://')) {
        logger.error('❌ VITE_KINDE_DOMAIN must start with https://');
      }

      // Check client ID format
      if (!clientId || clientId.trim() === '') {
        logger.error('❌ VITE_KINDE_CLIENT_ID is empty or missing');
      }

      // Check redirect URI format
      if (!redirectUri || !redirectUri.startsWith('http')) {
        logger.error('❌ Redirect URI is invalid:', redirectUri);
      }

      // Log configuration (without sensitive data)
      logger.debug('✅ OAuth Configuration:', {
        domain,
        clientIdLength: clientId?.length,
        redirectUri, // Log full redirect URI for debugging
        logoutUri,
        environment: import.meta.env.MODE
      });
    };

    validateConfig();
  }, [domain, clientId, redirectUri, logoutUri]);


  return (
    <OriginalKindeProvider
      clientId={clientId}
      domain={domain}
      redirectUri={redirectUri}
      logoutUri={logoutUri}
      scope="openid profile email offline"
      useInsecureForRefreshToken={import.meta.env.DEV || import.meta.env.MODE === 'development'}
    >
      <TokenSetupComponent />
      <DevKindeTokenNetworkDebugger />
      <SessionExpiryDetector />
      <SilentAuthInitializer />
      <OnlineStatusMonitor />
      {children}
    </OriginalKindeProvider>
  );
};

export default KindeProvider; 