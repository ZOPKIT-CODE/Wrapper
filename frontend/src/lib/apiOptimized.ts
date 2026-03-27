// OPTIMIZED API - Performance improvements for onboarding lag issues

import axios, { AxiosError } from 'axios'
import toast from 'react-hot-toast'
import { logger } from '@/lib/logger'
import { config } from '@/lib/config'
import { setKindeTokenGetter as _setKindeTokenGetter, getKindeToken as sharedGetKindeToken } from './api'

const API_BASE_URL = config.API_URL

/**
 * Re-export for backward compatibility. Callers that import from apiOptimized
 * will set the getter on the canonical api.ts module.
 */
export const setKindeTokenGetter = _setKindeTokenGetter;

let cachedToken: string | null = null;
let tokenCacheTime: number = 0;
const TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const isValidJWT = (token: string): boolean => {
  if (!token || typeof token !== 'string' || token.length < 20) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    return header && typeof header === 'object' && header.alg;
  } catch (e) {
    return false;
  }
};

/**
 * Wraps the shared getKindeToken from api.ts with a short-lived cache to
 * avoid repeated async calls on rapid sequential requests.
 */
const getKindeToken = async (): Promise<string | null> => {
  const now = Date.now();
  if (cachedToken && (now - tokenCacheTime) < TOKEN_CACHE_DURATION) {
    return cachedToken;
  }

  try {
    const token = await sharedGetKindeToken();
    if (token && isValidJWT(token)) {
      cachedToken = token;
      tokenCacheTime = now;
      return token;
    }
  } catch (_) {
    // shared getter unavailable — fall through
  }

  cachedToken = null;
  tokenCacheTime = 0;
  return null;
};

// Create axios instance
export const apiOptimized = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// OPTIMIZED: Request interceptor - simplified logging
apiOptimized.interceptors.request.use(async (config) => {
  const authToken = await getKindeToken();

  if (authToken && authToken.trim() !== '' && authToken.length > 10) {
    if (!config.headers) {
      config.headers = {} as any;
    }
    config.headers['Authorization'] = `Bearer ${authToken}`;
  } else {
    if (config.headers?.Authorization === 'Bearer' || config.headers?.Authorization === '') {
      delete config.headers.Authorization;
    }
  }

  return config
}, (error) => {
  logger.error('API Request Error:', error);
  return Promise.reject(error);
})

// Response interceptor
apiOptimized.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // ── No response: network failure or backend down ──────────────────────
    if (!error.response) {
      if ((error as any).code !== 'ERR_CANCELED' && (error as any).name !== 'CanceledError') {
        const msg = !navigator.onLine
          ? "You're offline. Please check your internet connection."
          : 'Server is temporarily unavailable. Please try again in a moment.'
        toast.error(msg, { id: 'network-error', duration: 6000, position: 'top-center' })
      }
      return Promise.reject(error)
    }

    const status = error.response.status

    // ── 401: clear cached token + notify (deduped by toast id) ───────────
    if (status === 401) {
      logger.debug('Authentication required — session may have expired')
      cachedToken = null
      tokenCacheTime = 0
      const publicPaths = ['/', '/login', '/auth/callback', '/pricing']
      const isPublic = publicPaths.some(p =>
        window.location.pathname === p || window.location.pathname.startsWith(p + '/')
      )
      if (!isPublic) {
        toast.error('Your session has expired. Please sign in again.', {
          id: 'session-expired',
          duration: 8000,
          position: 'top-center',
        })
      }
    }

    // ── 403: permission denied ────────────────────────────────────────────
    if (status === 403) {
      toast.error("You don't have permission to perform this action.", {
        id: 'forbidden',
        duration: 5000,
        position: 'top-center',
      })
    }

    // ── 5xx: server error ─────────────────────────────────────────────────
    if (status >= 500) {
      const trialExpired = localStorage.getItem('trialExpired')
      if (!trialExpired) {
        toast.error('Server temporarily unavailable. Please try again in a moment.', {
          id: 'network-error',
          duration: 6000,
          position: 'top-center',
        })
      }
    }

    return Promise.reject(error)
  }
)

// Onboarding API - optimized for performance
export const onboardingAPIOptimized = {
  checkSubdomain: async (subdomain: string) => {
    return await apiOptimized.get(`/onboarding/check-subdomain?subdomain=${subdomain}`)
  },

  checkStatus: async () => {
    return await apiOptimized.get('/onboarding/status')
  },

  markUserAsOnboarded: async (tenantId: string) => {
    return await apiOptimized.post('/onboarding/mark-onboarded', { tenantId })
  },

  getUserOrganization: () => apiOptimized.get('/onboarding/user-organization'),

  getDataByEmail: (email: string, kindeUserId?: string) =>
    apiOptimized.post('/onboarding/get-data', { email, kindeUserId }),

  markComplete: (organizationId: string) =>
    apiOptimized.post('/onboarding/completions', { organizationId }),

  updateStep: (step: string, data?: any, email?: string, formData?: any, kindeUserId?: string) =>
    apiOptimized.post('/onboarding/update-step', { step, data, email, formData, kindeUserId }),

  reset: (targetUserId?: string) =>
    apiOptimized.post('/onboarding/reset', targetUserId ? { targetUserId } : {}),

  verifyPAN: async (pan: string, name?: string) => {
    return await apiOptimized.post('/onboarding/verify-pan', { pan, name })
  },

  verifyGSTIN: async (gstin: string, businessName?: string) => {
    return await apiOptimized.post('/onboarding/verify-gstin', { gstin, businessName })
  },
}

export default apiOptimized