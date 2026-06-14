import axios, { AxiosError, AxiosHeaders } from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { config } from '@/lib/config'
import {
  markSessionRecoveryReason,
  rememberPostLoginRedirect,
} from '@/lib/auth/session-recovery'

// ─── Toast deduplication helpers ─────────────────────────────────────────────
// Prevent flooding the user with repeated toasts for the same root cause.

let _sessionExpiredLock = false

/** Show a "session expired" toast once per expiry event. */
function notifySessionExpired() {
  // On public pages a 401 is expected — don't show a toast there.
  const publicPaths = [
    '/',
    '/login',
    '/auth/callback',
    '/pricing',
    '/products',
    '/industries',
    '/blog',
  ]
  const isPublic = publicPaths.some(
    (p) =>
      window.location.pathname === p ||
      window.location.pathname.startsWith(p + '/')
  )
  if (isPublic || _sessionExpiredLock) return
  _sessionExpiredLock = true
  setTimeout(() => {
    _sessionExpiredLock = false
  }, 30_000)

  markSessionRecoveryReason('session_expired')
  // Remember where they were so the auth callback returns them here after sign-in
  // (e.g. /company-admin), instead of stranding them on a "Failed to load" page or
  // dumping them on the default dashboard.
  rememberPostLoginRedirect(window.location.pathname + window.location.search)
  toast.error('Your session has expired. Redirecting to sign in…', {
    id: 'session-expired',
    duration: 4000,
    position: 'top-center',
  })
  // Send them to /login so they can re-authenticate rather than sitting on a
  // broken protected page. Short delay lets the toast render first.
  setTimeout(() => {
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
  }, 600)
}

let _networkErrorLock = false

/** Show a "server unavailable" or "offline" toast once per outage window. */
function notifyNetworkError() {
  if (_networkErrorLock) return
  _networkErrorLock = true
  setTimeout(() => {
    _networkErrorLock = false
  }, 15_000)

  const message = !navigator.onLine
    ? "You're offline. Please check your internet connection."
    : 'Server is temporarily unavailable. Please try again in a moment.'
  toast.error(message, {
    id: 'network-error',
    duration: 6000,
    position: 'top-center',
  })
}

let _forbiddenLock = false

/** Show an "access denied" toast once per window. */
function notifyForbidden() {
  if (_forbiddenLock) return
  _forbiddenLock = true
  setTimeout(() => {
    _forbiddenLock = false
  }, 10_000)

  toast.error("You don't have permission to perform this action.", {
    id: 'forbidden',
    duration: 5000,
    position: 'top-center',
  })
}

const API_BASE_URL = config.API_URL
const REQUEST_TIMEOUT_MS = 20_000
const SLOW_REQUEST_THRESHOLD_MS = 10_000 // only flag as slow after 10s
const MIN_SLOW_REQUESTS_TO_SHOW_BANNER = 2 // need 2+ concurrent slow reqs
const MAX_SAFE_RETRIES = 2
const BASE_RETRY_DELAY_MS = 500

export const NETWORK_QUALITY_EVENT = 'api-network-quality'
export const BACKEND_STATUS_EVENT = 'api-backend-status'

const activeSlowRequests = new Set<string>()
let backendDown = false

const emitBackendStatus = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(BACKEND_STATUS_EVENT, {
      detail: {
        isBackendDown: backendDown,
        apiBaseUrl: API_BASE_URL,
      },
    })
  )
}

const markBackendDown = () => {
  if (backendDown) return
  backendDown = true
  emitBackendStatus()
}

const markBackendUp = () => {
  if (!backendDown) return
  backendDown = false
  emitBackendStatus()
}

const emitNetworkQuality = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(NETWORK_QUALITY_EVENT, {
      detail: {
        slowRequestCount: activeSlowRequests.size,
        showBanner: activeSlowRequests.size >= MIN_SLOW_REQUESTS_TO_SHOW_BANNER,
      },
    })
  )
}

const markSlowRequestStarted = (requestKey: string) => {
  if (activeSlowRequests.has(requestKey)) return
  activeSlowRequests.add(requestKey)
  emitNetworkQuality()
}

const markSlowRequestEnded = (requestKey?: string) => {
  if (!requestKey) return
  if (!activeSlowRequests.has(requestKey)) return
  activeSlowRequests.delete(requestKey)
  emitNetworkQuality()
}

/** Per-request bookkeeping we stash on the axios config to track slow requests / retries. */
interface RequestMetadata {
  requestStartedAt?: number
  requestKey?: string
  slowNetworkTriggered?: boolean
  slowNetworkTimer?: number
  skipSlowNetworkDetection?: boolean
}

/** Axios request config augmented with our tracking metadata and retry bookkeeping. */
type TrackedRequestConfig = InternalAxiosRequestConfig & {
  metadata?: RequestMetadata
  __retryCount?: number
  _refreshRetried?: boolean
}

/** Shape of the trial/subscription-expired payload the backend encodes inside a 200 response. */
interface SubscriptionExpiredPayload {
  subscriptionExpired?: boolean
  code?: string
  isTrialExpired?: boolean
  isSubscriptionExpired?: boolean
  message?: string
  immediate?: boolean
  data?: {
    trialEnd?: string
    currentPeriodEnd?: string
    expiredDate?: string
    expiredDuration?: string
    plan?: string
  }
}

const getRequestKey = (
  requestConfig: Partial<TrackedRequestConfig> | undefined
): string => {
  const method = (requestConfig?.method || 'GET').toUpperCase()
  const base = requestConfig?.baseURL || API_BASE_URL || ''
  const url = requestConfig?.url || ''
  return `${method} ${base}${url}`
}

let idpTokenGetter: (() => Promise<string | null>) | null = null

export const setIdpTokenGetter = (getter: () => Promise<string | null>) => {
  idpTokenGetter = getter
}

// ─── 5-minute token cache (merged from apiOptimized.ts) ──────────────────────
let cachedToken: string | null = null
let tokenCacheTime: number = 0
const TOKEN_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Single-flight silent refresh: shared across concurrent 401s so a lapsed
// session triggers exactly one POST /auth/refresh, then the original requests
// are replayed against the freshly-issued idp_token cookie.
let refreshPromise: Promise<unknown> | null = null

const isValidJWT = (token: string): boolean => {
  if (!token || typeof token !== 'string') return false
  if (token.length < 20) return false

  const parts = token.split('.')
  if (parts.length !== 3) return false

  try {
    const header = JSON.parse(
      atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'))
    )
    return header && typeof header === 'object' && header.alg
  } catch (e) {
    return false
  }
}

/** Returns true if the JWT is expired or expires within the next 30 seconds. */
const isTokenExpired = (token: string): boolean => {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    )
    const exp = payload?.exp as number | undefined
    if (!exp) return false
    return exp - 30 < Date.now() / 1000
  } catch {
    return true
  }
}

/**
 * Get authentication token from the IdP.
 * Tokens are never read from localStorage/sessionStorage/cookies by JS — cookies
 * are httpOnly and sent automatically via withCredentials. The Bearer header is set
 * from the IdP's in-memory token for cases where cookie flow doesn't apply.
 *
 * Includes a 5-minute short-lived cache to avoid repeated async calls on rapid
 * sequential requests (merged from apiOptimized.ts).
 */
export const getIdpToken = async (): Promise<string | null> => {
  const now = Date.now()
  if (cachedToken && now - tokenCacheTime < TOKEN_CACHE_DURATION) {
    return cachedToken
  }

  if (idpTokenGetter) {
    try {
      const token = await idpTokenGetter()
      if (token && isValidJWT(token) && !isTokenExpired(token)) {
        cachedToken = token
        tokenCacheTime = now
        return token
      }
      if (token && isTokenExpired(token)) {
        logger.debug(
          '🔑 getIdpToken: Token is expired, skipping to avoid 401 spam'
        )
      }
    } catch (error) {
      logger.debug('IdP getToken() failed:', error)
    }
  }

  cachedToken = null
  tokenCacheTime = 0
  return null
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  async (config) => {
    const requestConfig = config as TrackedRequestConfig
    const metadata: RequestMetadata = requestConfig.metadata || {}
    requestConfig.metadata = metadata
    metadata.requestStartedAt = Date.now()
    const requestKey = getRequestKey(requestConfig)
    metadata.requestKey = requestKey
    metadata.slowNetworkTriggered = false

    if (typeof window !== 'undefined' && !metadata.skipSlowNetworkDetection) {
      metadata.slowNetworkTimer = window.setTimeout(() => {
        metadata.slowNetworkTriggered = true
        markSlowRequestStarted(requestKey)
      }, SLOW_REQUEST_THRESHOLD_MS)
    }

    const authToken = await getIdpToken()

    if (authToken) {
      if (!config.headers) config.headers = new AxiosHeaders()
      config.headers['Authorization'] = `Bearer ${authToken}`
    } else {
      if (
        config.headers?.Authorization === 'Bearer' ||
        config.headers?.Authorization === ''
      ) {
        delete config.headers.Authorization
      }
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

const cleanupRequestTracking = (requestConfig?: TrackedRequestConfig) => {
  if (!requestConfig?.metadata) return
  const timerId = requestConfig.metadata.slowNetworkTimer
  if (timerId && typeof window !== 'undefined') {
    window.clearTimeout(timerId)
  }
  if (requestConfig.metadata.slowNetworkTriggered) {
    markSlowRequestEnded(requestConfig.metadata.requestKey)
  }
}

const getRetryDelay = (retryAttempt: number): number => {
  const exponentialDelay = BASE_RETRY_DELAY_MS * 2 ** (retryAttempt - 1)
  const jitter = Math.floor(Math.random() * 250)
  return exponentialDelay + jitter
}

const isSafeMethod = (method?: string): boolean => {
  const normalized = (method || '').toUpperCase()
  return (
    normalized === 'GET' || normalized === 'HEAD' || normalized === 'OPTIONS'
  )
}

const isCanceledRequest = (error: AxiosError): boolean => {
  return error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError'
}

const shouldRetryRequest = (error: AxiosError): boolean => {
  const requestConfig = error.config as TrackedRequestConfig | undefined
  if (!requestConfig) return false
  if (isCanceledRequest(error)) return false
  if (!isSafeMethod(requestConfig.method)) return false

  const retryCount = requestConfig.__retryCount || 0
  if (retryCount >= MAX_SAFE_RETRIES) return false

  if (!error.response) return true

  const status = error.response.status
  return status === 408 || status === 429 || status >= 500
}

let _networkTimeoutLock = false
function notifyNetworkTimeout() {
  if (_networkTimeoutLock) return
  _networkTimeoutLock = true
  setTimeout(() => {
    _networkTimeoutLock = false
  }, 15_000)

  toast.error('Request timed out on a slow connection. Please try again.', {
    id: 'network-timeout',
    duration: 6000,
    position: 'top-center',
  })
}

let _backendDownLock = false
function notifyBackendDown() {
  if (_backendDownLock) return
  _backendDownLock = true
  setTimeout(() => {
    _backendDownLock = false
  }, 20_000)

  toast.error('Backend is temporarily unavailable. It will be up soon.', {
    id: 'backend-down',
    duration: 7000,
    position: 'top-center',
  })
}

const retryRequestIfEligible = async (error: AxiosError) => {
  if (!shouldRetryRequest(error)) return null

  const requestConfig = error.config as TrackedRequestConfig | undefined
  if (!requestConfig) return null
  requestConfig.__retryCount = (requestConfig.__retryCount || 0) + 1
  const retryDelay = getRetryDelay(requestConfig.__retryCount)

  logger.debug('🔄 Retrying safe request after transient failure', {
    retryCount: requestConfig.__retryCount,
    url: requestConfig.url,
    method: requestConfig.method,
    retryDelay,
    status: error.response?.status ?? 'NO_RESPONSE',
  })

  await new Promise((resolve) => setTimeout(resolve, retryDelay))
  return api.request(requestConfig)
}

export const createCancelableRequest = () => {
  const controller = new AbortController()
  return {
    signal: controller.signal,
    cancel: () => controller.abort('Request cancelled by user'),
  }
}

api.interceptors.response.use(
  (response) => {
    cleanupRequestTracking(response.config as TrackedRequestConfig)
    markBackendUp()
    return response
  },
  async (error: AxiosError) => {
    const requestConfig = error.config as TrackedRequestConfig | undefined
    cleanupRequestTracking(requestConfig)

    const retriedResponse = await retryRequestIfEligible(error)
    if (retriedResponse) return retriedResponse

    // Timeout after configured request window
    if (
      error.code === 'ECONNABORTED' ||
      String(error.message || '')
        .toLowerCase()
        .includes('timeout')
    ) {
      logger.error('🚨 Request timeout:', {
        url: requestConfig?.url,
        method: requestConfig?.method,
      })
      notifyNetworkTimeout()
      return Promise.reject(error)
    }

    // ── No response at all: network down or backend unreachable ─────────────
    if (!error.response) {
      // Ignore cancelled requests (e.g. component unmounted)
      if (isCanceledRequest(error)) {
        return Promise.reject(error)
      }
      logger.error('🚨 Network error (no response):', error.message)
      markBackendDown()
      notifyBackendDown()
      notifyNetworkError()
      return Promise.reject(error)
    }

    markBackendUp()

    const status = error.response.status

    if (status !== 401) {
      logger.error('🚨 API Error:', {
        status,
        url: error.config?.url,
        method: error.config?.method,
        data: error.response?.data,
      })
    }

    // ── 401 Unauthorized — one-shot silent refresh, then replay ────────────
    if (status === 401) {
      cachedToken = null
      tokenCacheTime = 0

      const original = requestConfig as
        | (typeof requestConfig & { _refreshRetried?: boolean })
        | undefined
      const url: string = original?.url || ''
      const isRefreshCall = url.includes('/auth/refresh')

      if (original && !original._refreshRetried && !isRefreshCall) {
        original._refreshRetried = true
        try {
          logger.debug('401 — attempting silent token refresh')
          // Exchange the httpOnly idp_refresh_token cookie for a fresh idp_token.
          // Deduped so concurrent 401s trigger only one refresh round-trip.
          refreshPromise =
            refreshPromise ??
            api.post('/auth/refresh', {}).finally(() => {
              refreshPromise = null
            })
          await refreshPromise
          // Backend has set a new httpOnly idp_token cookie; replay the original request.
          return api(original)
        } catch {
          notifySessionExpired()
          return Promise.reject(error)
        }
      }

      if (!isRefreshCall) notifySessionExpired()
    }

    // ── 403 Forbidden — platform/role permission denied ────────────────────
    if (status === 403) {
      notifyForbidden()
    }

    // ── Trial / subscription expired (encoded as 200) ──────────────────────
    if (
      status === 200 &&
      (error.response?.data as SubscriptionExpiredPayload | undefined)
        ?.subscriptionExpired
    ) {
      const responseData = error.response.data as SubscriptionExpiredPayload

      if (
        responseData?.code === 'TRIAL_EXPIRED' ||
        responseData?.code === 'SUBSCRIPTION_EXPIRED'
      ) {
        logger.debug(
          '🚫 Trial/Subscription expired response intercepted:',
          responseData
        )

        const expiredData = {
          expired: true,
          expiredAt: new Date().toISOString(),
          isTrialExpired: responseData.isTrialExpired,
          isSubscriptionExpired: responseData.isSubscriptionExpired,
          trialEnd: responseData.data?.trialEnd,
          currentPeriodEnd: responseData.data?.currentPeriodEnd,
          expiredDate: responseData.data?.expiredDate,
          expiredDuration: responseData.data?.expiredDuration,
          plan: responseData.data?.plan,
          message: responseData.message,
          immediate: responseData.immediate,
          code: responseData.code,
        }

        localStorage.setItem('trialExpired', JSON.stringify(expiredData))

        const lastEmitted = localStorage.getItem('trialExpiredEventEmitted')
        const now = Date.now()

        if (!lastEmitted || now - parseInt(lastEmitted) > 5000) {
          localStorage.setItem('trialExpiredEventEmitted', now.toString())
          window.dispatchEvent(
            new CustomEvent('apiTrialExpired', { detail: responseData })
          )
          window.dispatchEvent(
            new CustomEvent('trialExpired', { detail: expiredData })
          )
        }

        return Promise.reject(error)
      }
    }

    // ── 5xx Server errors ──────────────────────────────────────────────────
    if (status >= 500) {
      logger.error('🚨 Server error intercepted:', status)
      const trialExpired = localStorage.getItem('trialExpired')
      if (!trialExpired) {
        notifyNetworkError()
      }
    }

    return Promise.reject(error)
  }
)

export default api

// ─── Backward-compat aliases (merged from apiOptimized.ts) ───────────────────

/** Alias for the main `api` axios instance — keeps callers that imported from apiOptimized working. */
export const apiOptimized = api

/** Onboarding API helpers (previously exported from apiOptimized.ts). */
export const onboardingAPIOptimized = {
  checkSubdomain: (subdomain: string) =>
    api.get(`/onboarding/check-subdomain?subdomain=${subdomain}`),

  checkStatus: () => api.get('/onboarding/status'),

  markUserAsOnboarded: (tenantId: string) =>
    api.post('/onboarding/mark-onboarded', { tenantId }),

  getUserOrganization: () => api.get('/onboarding/user-organization'),

  getDataByEmail: (email: string, idpSub?: string) =>
    api.post('/onboarding/get-data', { email, idpSub }),

  markComplete: (organizationId: string) =>
    api.post('/onboarding/mark-complete', { organizationId }),

  updateStep: (
    step: string,
    data?: unknown,
    email?: string,
    formData?: unknown,
    idpSub?: string
  ) =>
    api.post('/onboarding/update-step', {
      step,
      data,
      email,
      formData,
      idpSub,
    }),

  reset: (targetUserId?: string) =>
    api.post('/onboarding/reset', targetUserId ? { targetUserId } : {}),

  verifyPAN: (pan: string, name?: string) =>
    api.post('/onboarding/verify-pan', { pan, name }),

  verifyGSTIN: (gstin: string, businessName?: string) =>
    api.post('/onboarding/verify-gstin', { gstin, businessName }),
}
