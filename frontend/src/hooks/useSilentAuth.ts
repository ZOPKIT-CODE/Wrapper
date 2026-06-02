import { useState, useEffect, useCallback } from 'react';
import { useKindeAuth } from '@/lib/auth/cognito-auth';
import { clearStaleAuthStorage, isInvalidGrantError, markSessionRecoveryReason } from '@/lib/auth/session-recovery';

interface SilentAuthState {
  isChecking: boolean;
  isAuthenticated: boolean;
  hasChecked: boolean;
  error: string | null;
}

interface SilentAuthResult extends SilentAuthState {
  checkSilentAuth: () => Promise<boolean>;
  handleLogin: (options?: { prompt?: string; org_code?: string }) => Promise<void>;
  handleLogout: () => Promise<void>;
  getAuthState: () => Promise<{
    isAuthenticated: boolean;
    user: any;
    accessToken: string | null;
  }>;
}

/**
 * Custom hook for handling Kinde silent authentication with domain cookies
 * This enables seamless authentication across subdomains
 */
export const useSilentAuth = (): SilentAuthResult => {
  const { 
    isAuthenticated: kindeIsAuthenticated, 
    isLoading,
    user, 
    login, 
    logout, 
    getToken
  } = useKindeAuth();

  const [state, setState] = useState<SilentAuthState>({
    isChecking: false,
    isAuthenticated: false,
    hasChecked: false,
    error: null,
  });

  /**
   * Check for existing authentication using domain cookies
   * This will attempt silent authentication if the user has a valid session
   */
  const checkSilentAuth = useCallback(async (): Promise<boolean> => {
    if (state.isChecking || isLoading) {
      return state.isAuthenticated;
    }

    setState(prev => ({ ...prev, isChecking: true, error: null }));

    try {

      // First check if user is already authenticated locally
      if (kindeIsAuthenticated && user) {
        setState(prev => ({ 
          ...prev, 
          isAuthenticated: true, 
          isChecking: false, 
          hasChecked: true 
        }));
        return true;
      }

            // Check for domain cookies that might indicate authentication
      const allCookies = document.cookie.split(';').map(c => c.trim().split('=')[0]);
      const hasKindeCookie = document.cookie
        .split(';')
        .some(cookie => {
          const [name] = cookie.trim().split('=');
          return name && (
            name.includes('kinde') ||
            name.includes('auth') ||
            name === 'session' ||
            name === 'access_token' ||
            name.includes('kbte') ||
            name.includes('enduser_session')
          );
        });

      // Check for .zopkit.com domain cookies specifically
      const hasZopkitDomainCookie = allCookies.some(name => 
        name && (name.includes('kinde') || name.includes('kbte') || name.includes('enduser'))
      );

      // Don't attempt silent auth without cookies - it will cause redirect loops
      if (!hasKindeCookie) {
        setState(prev => ({ 
          ...prev, 
          isAuthenticated: false, 
          isChecking: false, 
          hasChecked: true 
        }));
        return false;
      }

      // Only attempt silent authentication if we have domain cookies
      
      try {
        // Try to get current authentication state first
        const currentToken = await getToken();
        
        if (user && currentToken) {
          setState(prev => ({ 
            ...prev, 
            isAuthenticated: true, 
            isChecking: false, 
            hasChecked: true 
          }));
          return true;
        }
        
        // If no current user/token but we have cookies, try silent login
        await performSilentLogin();
        
        // After silent login, check if we're now authenticated
        const isNowAuthenticated = kindeIsAuthenticated;
        
        setState(prev => ({ 
          ...prev, 
          isAuthenticated: isNowAuthenticated, 
          isChecking: false, 
          hasChecked: true 
        }));
        
        return isNowAuthenticated;
      } catch (silentError) {
        if (isInvalidGrantError(silentError)) {
          clearStaleAuthStorage();
          markSessionRecoveryReason('invalid_grant');
        }

        setState(prev => ({ 
          ...prev, 
          isAuthenticated: false, 
          isChecking: false, 
          hasChecked: true 
        }));
        return false;
      }

    } catch (error) {
      console.error('❌ Silent Auth: Error during silent authentication:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Silent authentication failed',
        isAuthenticated: false,
        isChecking: false,
        hasChecked: true 
      }));
      return false;
    }
  }, [kindeIsAuthenticated, user, isLoading, state.isChecking, state.isAuthenticated]);

  /**
   * Perform silent login using hidden iframe
   */
  const performSilentLogin = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = 'about:blank';
      
      const cleanup = () => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Silent authentication timeout'));
      }, 10000); // 10 second timeout

      iframe.onload = () => {
        clearTimeout(timeout);
        cleanup();
        resolve();
      };

      iframe.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error('Silent authentication failed'));
      };

      try {
        // Attempt silent login with Kinde
        // This will check for domain cookies and authenticate silently
        login({ prompt: 'none' as any }).then(() => {
          clearTimeout(timeout);
          cleanup();
          resolve();
        }).catch((error) => {
          clearTimeout(timeout);
          cleanup();
          reject(error);
        });
      } catch (error) {
        clearTimeout(timeout);
        cleanup();
        reject(error);
      }
    });
  }, [login]);

  /**
   * Enhanced login function with organization support
   */
  const handleLogin = useCallback(async (options: { 
    prompt?: string; 
    org_code?: string;
    connection_id?: string;
  } = {}): Promise<void> => {
    try {
      
      const loginOptions: any = {
        ...options,
      };

      // Add organization code if provided
      if (options.org_code) {
        loginOptions.org_code = options.org_code;
      }

      await login(loginOptions);
    } catch (error) {
      console.error('❌ Silent Auth: Login failed:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Login failed' 
      }));
      throw error;
    }
  }, [login]);

  /**
   * Logout handler that works across all subdomains
   */
  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      
      // Clear local state
      setState({
        isChecking: false,
        isAuthenticated: false,
        hasChecked: true,
        error: null,
      });

      // Perform Kinde logout - this will clear the HttpOnly cookie across all subdomains
      await logout();
      
    } catch (error) {
      console.error('❌ Silent Auth: Logout failed:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Logout failed' 
      }));
      throw error;
    }
  }, [logout]);

  /**
   * Get current authentication state with user and token
   */
  const getAuthState = useCallback(async () => {
    try {
      const isAuth = kindeIsAuthenticated && !!user;
      let accessToken = null;

      if (isAuth) {
        try {
          accessToken = await getToken();
        } catch (tokenError) {
          console.warn('⚠️ Silent Auth: Could not get access token:', tokenError);
        }
      }

      return {
        isAuthenticated: isAuth,
        user: user || null,
        accessToken: accessToken || null,
      };
    } catch (error) {
      console.error('❌ Silent Auth: Error getting auth state:', error);
      return {
        isAuthenticated: false,
        user: null,
        accessToken: null,
      };
    }
  }, [kindeIsAuthenticated, user, getToken]);

  // Auto-check silent authentication on mount
  useEffect(() => {
    if (!state.hasChecked && !isLoading) {
      const timer = setTimeout(() => {
        checkSilentAuth();
      }, 100); // Small delay to ensure Kinde is initialized

      return () => clearTimeout(timer);
    }
  }, [checkSilentAuth, state.hasChecked, isLoading]);

  // Update state when Kinde authentication changes
  useEffect(() => {
    if (!isLoading && state.hasChecked) {
      setState(prev => ({ 
        ...prev, 
        isAuthenticated: kindeIsAuthenticated && !!user 
      }));
    }
  }, [kindeIsAuthenticated, user, isLoading, state.hasChecked]);

  return {
    ...state,
    checkSilentAuth,
    handleLogin,
    handleLogout,
    getAuthState,
  };
};

export default useSilentAuth;
