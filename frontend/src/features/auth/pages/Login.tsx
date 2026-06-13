import React, { useEffect, useState } from 'react'
import { useAuth, type AuthUser } from '@/lib/auth/cognito-auth'
import { useSilentSsoOnFocus } from '@/lib/auth/silent-sso'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import type { MotionProps } from 'framer-motion'
import { toast } from 'sonner'
import api, { createCancelableRequest } from '@/lib/api'
import { jwtService } from '@/services/jwtService'
import { config, CRM_DOMAIN, CRM_CALLBACK_PATH } from '@/lib/config'
import {
  consumeSessionRecoveryReason,
  consumePostLoginRedirect,
} from '@/lib/auth/session-recovery'
import {
  AuthFlowLayout,
  AuthFlowLoading,
} from '@/components/layout/AuthFlowLayout'

const crmCallbackPath = CRM_CALLBACK_PATH || '/callback'

type CrmUser = {
  id: string
  email?: string
  name?: string
  givenName?: string
  organization?: { code?: string }
  tenantId?: string
  permissions?: string[]
  [key: string]: unknown
}

function extractCrmIntendedPath(returnTo: string): string {
  try {
    const returnUrl = new URL(returnTo)
    let intendedPath = returnUrl.pathname
    if (!intendedPath || intendedPath === '/') intendedPath = '/'
    if (intendedPath.includes('/callback')) {
      console.warn('⚠️ Blocked redirect to callback, using fallback')
      intendedPath = '/'
    }
    if (intendedPath.includes('/login')) {
      console.warn('⚠️ Blocked redirect to login, using fallback')
      intendedPath = '/'
    }
    if (returnUrl.hostname.includes('wrapper.zopkit.com')) {
      console.warn('⚠️ Blocked wrapper domain, using fallback')
      intendedPath = '/'
    }
    return intendedPath
  } catch (error) {
    console.error('❌ Error extracting intended path:', error)
    return '/'
  }
}

function validateCrmReturnToUrl(returnTo: string): boolean {
  try {
    const returnUrl = new URL(returnTo)
    const isDevelopment =
      import.meta.env.MODE === 'development' ||
      import.meta.env.DEV === true ||
      window.location.hostname === 'localhost'
    if (isDevelopment && returnUrl.hostname === 'localhost') return true
    const crmHostname = new URL(CRM_DOMAIN).hostname
    if (!returnUrl.hostname.includes(crmHostname)) {
      console.warn('⚠️ Invalid CRM domain:', returnUrl.hostname)
      return false
    }
    const wrapperHostname = new URL(config.WRAPPER_DOMAIN).hostname
    if (
      returnUrl.pathname.includes('/callback') ||
      returnUrl.pathname.includes('/login') ||
      returnUrl.hostname.includes(wrapperHostname)
    ) {
      console.warn('⚠️ Dangerous returnTo URL blocked:', returnUrl.pathname)
      return false
    }
    return true
  } catch (error) {
    console.error('❌ Invalid returnTo URL format:', error)
    return false
  }
}

function generateCrmCallbackUrl(authUser: AuthUser, returnTo: string): string {
  try {
    const user: CrmUser = {
      ...authUser,
      id: authUser.id ?? '',
      organization: authUser.organization as { code?: string } | undefined,
    }
    const token = jwtService.generateCRMToken(user)
    const callbackUrl = new URL(`${CRM_DOMAIN}${crmCallbackPath}`)
    callbackUrl.searchParams.set('code', token)
    callbackUrl.searchParams.set('state', 'authenticated')
    callbackUrl.searchParams.set('user_id', user.id)
    callbackUrl.searchParams.set('timestamp', Date.now().toString())
    callbackUrl.searchParams.set('returnTo', extractCrmIntendedPath(returnTo))
    callbackUrl.searchParams.set('source', 'wrapper')
    callbackUrl.searchParams.set('app', 'crm')
    return callbackUrl.toString()
  } catch (error) {
    console.error('❌ Error generating CRM callback URL:', error)
    return `${CRM_DOMAIN}/`
  }
}

function generateCrmFallbackUrl(): string {
  return `${CRM_DOMAIN}/?error=auth_failed&source=wrapper`
}

// ---------------------------------------------------------------------------
// Design tokens — exact values from Login.html
// ---------------------------------------------------------------------------

const C = {
  bg: '#fafaf7',
  ink: '#0a1733',
  muted: '#7a8099',
  line: 'rgba(10,23,51,0.10)',
  error: '#b4341c',
} as const

const FONT_SANS = "'Inter', 'Inter Tight', system-ui, -apple-system, sans-serif"
const FONT_MONO =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
// ---------------------------------------------------------------------------
// Rise animation helper — typed so it spreads cleanly onto motion.* elements
// ---------------------------------------------------------------------------

function rise(delay = 0): MotionProps {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, ease: [0.2, 0.7, 0.2, 1], delay },
  }
}

// ---------------------------------------------------------------------------
// Micro-components
// ---------------------------------------------------------------------------

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
    />
  </svg>
)

const Arrow = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
)

const Spinner = () => (
  <motion.div
    animate={{ rotate: 360 }}
    transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
    style={{
      width: 14,
      height: 14,
      borderRadius: '50%',
      flexShrink: 0,
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff',
    }}
  />
)

// Extremely subtle dual-tint ambient — purple top-right, teal bottom-left
const Ambient = () => (
  <div
    aria-hidden
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: -1,
      pointerEvents: 'none',
      background: [
        'radial-gradient(1200px 700px at 100% 0%, rgba(91,61,245,0.05), transparent 55%)',
        'radial-gradient(900px 600px at 0% 100%, rgba(43,182,163,0.04), transparent 55%)',
      ].join(', '),
    }}
  />
)

// Four hairline corner marks
const cornerStyles: React.CSSProperties[] = [
  { top: 24, left: 24, borderRight: 'none', borderBottom: 'none' },
  { top: 24, right: 24, borderLeft: 'none', borderBottom: 'none' },
  { bottom: 24, left: 24, borderRight: 'none', borderTop: 'none' },
  { bottom: 24, right: 24, borderLeft: 'none', borderTop: 'none' },
]
const Corners = () => (
  <>
    {cornerStyles.map((s, i) => (
      <span
        key={i}
        aria-hidden
        style={{
          position: 'fixed',
          width: 14,
          height: 14,
          border: `1px solid ${C.line}`,
          ...s,
        }}
      />
    ))}
  </>
)

function LoadingView({ message }: { message: string }) {
  return <AuthFlowLoading message={message} />
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export function Login() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Record<string, string>
  const { isAuthenticated, user, isLoading, getToken, login } = useAuth()
  // Cross-app silent SSO: if you signed into crm/fa in another tab, picking up this
  // tab silently logs you in (prompt=none) — no password. No-op if no shared session.
  useSilentSsoOnFocus()

  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const returnTo = search['returnTo']
  const source = search['source']
  const error = search['error']
  const crmRedirect = search['crmRedirect']
  const isCrmRequest = source === 'crm' || crmRedirect === 'true'

  useEffect(() => {
    const recoveryReason = consumeSessionRecoveryReason()
    if (recoveryReason === 'invalid_grant') {
      toast.error('Session expired. Please sign in again.')
    }
  }, [])

  useEffect(() => {
    if (isCrmRequest && returnTo) {
      try {
        const returnUrl = new URL(returnTo)
        const intendedPath =
          returnUrl.pathname === '/' ? '/' : returnUrl.pathname
        sessionStorage.setItem('crm_intended_path', intendedPath)
      } catch (err) {
        console.error('❌ Error storing intended path:', err)
      }
    }
  }, [isCrmRequest, returnTo])

  useEffect(() => {
    const handleCrmRedirect = async () => {
      if (
        !isAuthenticated ||
        !user ||
        !returnTo ||
        !isCrmRequest ||
        isLoading ||
        isRedirecting
      )
        return

      const crmRedirectCount = parseInt(
        sessionStorage.getItem('crm_redirect_count') || '0'
      )
      if (crmRedirectCount > 3) {
        console.error('🚨 CRM INFINITE LOOP DETECTED - Too many redirects')
        sessionStorage.removeItem('crm_redirect_count')
        window.location.href = config.CRM_DOMAIN + '/'
        return
      }
      sessionStorage.setItem(
        'crm_redirect_count',
        (crmRedirectCount + 1).toString()
      )

      setIsRedirecting(true)
      try {
        if (!validateCrmReturnToUrl(returnTo)) {
          console.error('❌ Invalid CRM return URL:', returnTo)
          toast.error('Invalid return URL. Please contact support.')
          setIsRedirecting(false)
          return
        }
        try {
          await getToken()
        } catch (tokenError) {
          console.warn('⚠️ Could not get token via getToken():', tokenError)
        }
        const currentUrl = new URL(window.location.href)
        currentUrl.searchParams.delete('returnTo')
        currentUrl.searchParams.delete('source')
        currentUrl.searchParams.delete('crmRedirect')
        currentUrl.searchParams.delete('error')
        window.history.replaceState({}, '', currentUrl.toString())
        const crmUser: CrmUser = {
          ...user,
          id: user.id ?? user.email ?? '',
          organization: user.organization as CrmUser['organization'],
        }
        const callbackUrl = generateCrmCallbackUrl(crmUser, returnTo)
        sessionStorage.removeItem('crm_intended_path')
        sessionStorage.removeItem('crm_redirect_count')
        window.location.href = callbackUrl
      } catch (err) {
        console.error('❌ Failed to generate CRM authentication:', err)
        window.location.href = generateCrmFallbackUrl()
      }
    }
    const timer = setTimeout(handleCrmRedirect, 500)
    return () => clearTimeout(timer)
  }, [
    isAuthenticated,
    user,
    returnTo,
    isCrmRequest,
    isLoading,
    isRedirecting,
    getToken,
  ])

  useEffect(() => {
    const { signal, cancel } = createCancelableRequest()
    const handlePostLoginRedirect = async () => {
      if (!isAuthenticated || !user || isLoading || returnTo || isRedirecting)
        return
      setIsRedirecting(true)
      try {
        const response = await api.get('/onboarding/status', { signal })
        const status = response.data
        // If a session expiry parked a return path (e.g. /company-admin), honor it
        // for an onboarded user instead of the default dashboard.
        const parkedReturn = consumePostLoginRedirect()
        // Platform admins have no tenant plane — send them to the admin dashboard.
        if (
          status.authStatus?.isPlatformAdmin ||
          status.authStatus?.userType === 'PLATFORM_ADMIN'
        ) {
          navigate({ to: parkedReturn || '/company-admin', replace: true })
        } else if (
          parkedReturn &&
          status.user &&
          status.isOnboarded &&
          !status.needsOnboarding
        ) {
          navigate({ to: parkedReturn, replace: true })
        } else if (
          status.user &&
          status.isOnboarded &&
          !status.needsOnboarding
        ) {
          navigate({ to: '/dashboard/applications', replace: true })
        } else if (
          status.authStatus?.onboardingCompleted === true ||
          status.authStatus?.userType === 'INVITED_USER' ||
          status.authStatus?.isInvitedUser === true
        ) {
          navigate({ to: '/dashboard/applications', replace: true })
        } else {
          navigate({ to: '/onboarding', replace: true })
        }
      } catch (err) {
        // A canceled request (effect re-run / unmount) is NOT a real failure —
        // don't fall through to the onboarding redirect on it, or an already
        // onboarded user gets wrongly bounced to /onboarding.
        const e = err as { code?: string; name?: string }
        if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError') return
        console.error('❌ Error checking onboarding status:', err)
        navigate({ to: '/onboarding', replace: true })
      }
    }
    handlePostLoginRedirect()
    return () => cancel()
    // NOTE: isRedirecting is intentionally NOT a dependency — it is set inside
    // this effect, and including it caused the effect to tear down mid-request
    // and cancel the status check.
  }, [isAuthenticated, user, isLoading, returnTo, navigate])

  const handleBackToCRM = () => {
    if (returnTo && validateCrmReturnToUrl(returnTo)) {
      window.location.href = returnTo
    } else {
      toast.error('Invalid return URL')
    }
  }

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true)
      // Cognito: route straight to Google federation (skips the hosted-UI selector).
      await login({ provider: 'google' })
    } catch (err) {
      console.error('❌ Login error:', err)
      toast.error('Failed to start login process. Please try again.')
      setIsLoggingIn(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Loading / redirect states
  // ---------------------------------------------------------------------------

  if (isLoading) return <LoadingView message="Verifying credentials…" />

  if (!isLoading && isAuthenticated && user && !returnTo && !isRedirecting)
    return <LoadingView message="Setting up your workspace…" />

  if (
    !isLoading &&
    isAuthenticated &&
    user &&
    returnTo &&
    isCrmRequest &&
    isRedirecting
  )
    return <LoadingView message="Establishing secure connection…" />

  if (isRedirecting && !returnTo && !isCrmRequest)
    return <LoadingView message="Redirecting to dashboard…" />

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <AuthFlowLayout
      hideHeader
      className="relative overflow-x-hidden"
      style={{
        fontFamily: FONT_SANS,
        color: C.ink,
        textRendering: 'optimizeLegibility',
      }}
    >
      <Ambient />
      <Corners />

      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 32,
          position: 'relative',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 360,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Logo mark */}
          <motion.img
            {...rise(0)}
            src={config.LOGO_URL}
            alt="Zopkit"
            style={{
              width: 48,
              height: 48,
              display: 'block',
              marginBottom: 36,
              filter: 'drop-shadow(0 8px 24px rgba(91,61,245,0.18))',
              borderRadius: 10,
              objectFit: 'contain',
            }}
          />

          {/* Headline */}
          <motion.h1
            {...rise(0.06)}
            style={{
              fontSize: 28,
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
              margin: '0 0 6px',
              color: C.ink,
              fontWeight: 500,
              fontFamily: FONT_SANS,
            }}
          >
            {isCrmRequest ? (
              'CRM Access'
            ) : (
              <>
                Welcome{' '}
                <span
                  style={{
                    fontStyle: 'italic',
                    fontSize: '1.05em',
                    letterSpacing: '-0.02em',
                  }}
                >
                  back
                </span>
              </>
            )}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            {...rise(0.14)}
            style={{
              color: C.muted,
              fontSize: 14,
              lineHeight: 1.5,
              margin: '0 0 40px',
            }}
          >
            {isCrmRequest
              ? 'Authenticate securely to access your workspace.'
              : 'Sign in to your workspace.'}
          </motion.p>

          {/* Primary CTA — "Continue with Google" as the main pill button */}
          <motion.div {...rise(0.22)}>
            <PrimaryButton onClick={handleLogin} disabled={isLoggingIn}>
              {isLoggingIn ? (
                <>
                  <Spinner /> Signing in
                </>
              ) : (
                <>
                  <GoogleIcon /> Continue with Google <Arrow />
                </>
              )}
            </PrimaryButton>
          </motion.div>

          {/* Error */}
          {error && (
            <motion.p
              {...rise(0.3)}
              style={{
                color: C.error,
                fontSize: 11.5,
                marginTop: 14,
                fontFamily: FONT_MONO,
                letterSpacing: '0.02em',
              }}
            >
              {decodeURIComponent(error)}
            </motion.p>
          )}

          {/* CRM — ghost "Return to CRM" button */}
          {isCrmRequest && (
            <motion.div {...rise(0.38)} style={{ marginTop: 12 }}>
              <GhostButton onClick={handleBackToCRM}>
                ← Return to CRM
              </GhostButton>
            </motion.div>
          )}

          {/* Footer */}
          <motion.p
            {...rise(isCrmRequest ? 0.46 : 0.38)}
            style={{
              marginTop: 36,
              fontSize: 13,
              color: C.muted,
              textAlign: 'center',
            }}
          >
            New to Zopkit? <FootLink href="/landing">Request access</FootLink>
          </motion.p>
        </div>
      </div>
    </AuthFlowLayout>
  )
}

// ---------------------------------------------------------------------------
// Button primitives — mirror the design's .btn-primary / .btn-ghost
// ---------------------------------------------------------------------------

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        appearance: 'none',
        border: 0,
        borderRadius: 999,
        padding: '13px 20px',
        fontFamily: FONT_SANS,
        fontSize: 14,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        width: '100%',
        height: 50,
        background: hovered && !disabled ? '#000' : C.ink,
        color: '#fff',
        letterSpacing: '-0.005em',
        opacity: disabled ? 0.55 : 1,
        transition:
          'background 0.2s ease, opacity 0.2s ease, transform 0.08s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {children}
    </button>
  )
}

function GhostButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        appearance: 'none',
        background: 'transparent',
        color: C.ink,
        border: `1px solid ${hovered ? C.ink : C.line}`,
        borderRadius: 999,
        width: '100%',
        height: 50,
        fontFamily: FONT_SANS,
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        letterSpacing: '-0.005em',
        transition: 'border-color 0.2s ease',
      }}
    >
      {children}
    </button>
  )
}

function FootLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        color: C.ink,
        textDecoration: 'none',
        borderBottom: `1px solid ${hovered ? C.ink : C.line}`,
        paddingBottom: 1,
        transition: 'border-color 0.15s ease',
      }}
    >
      {children}
    </a>
  )
}
