import React, { useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth/cognito-auth'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useAuthStatus, useOnboardingStatus } from '@/hooks/useSharedQueries'
import AnimatedLoader from '@/components/common/feedback/AnimatedLoader'
import { logger } from '@/lib/logger'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredOrganization?: string
  requiredPermissions?: string[]
  fallbackComponent?: React.ComponentType
  redirectTo?: string
  skipOnboardingCheck?: boolean
}

const LoadingSpinner: React.FC = () => {
  return (
    <div className="bg-background text-foreground flex min-h-screen items-center justify-center">
      <div className="text-center">
        <AnimatedLoader size="lg" className="mb-6" />
        <p className="text-muted-foreground text-lg font-medium">
          Checking authentication...
        </p>
      </div>
    </div>
  )
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = React.memo(
  ({
    children,
    fallbackComponent: FallbackComponent,
    redirectTo,
    skipOnboardingCheck = false,
  }) => {
    const { isAuthenticated, isLoading, user } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()
    const { data: authData, isLoading: authStatusLoading } = useAuthStatus()
    const { data: onboardingResponse, isLoading: onboardingStatusLoading } =
      useOnboardingStatus()
    const redirectingRef = useRef(false)

    const backendAuthStatus = authData?.authStatus || null
    const onboardingData = onboardingResponse?.data

    // Treat as completed if onboarding/status says so (source of truth for completed flow)
    const completedByOnboardingApi =
      onboardingData?.isOnboarded === true ||
      onboardingData?.needsOnboarding === false ||
      onboardingData?.onboardingStep === 'completed'

    const isReady = !isLoading && !authStatusLoading && !onboardingStatusLoading
    const needsIdpLogin = isReady && (!isAuthenticated || !user)
    const needsBackendLogin =
      isReady && !needsIdpLogin && !backendAuthStatus?.isAuthenticated

    const isInvitedOrOnboarded =
      backendAuthStatus?.onboardingCompleted === true ||
      backendAuthStatus?.userType === 'INVITED_USER' ||
      backendAuthStatus?.isInvitedUser === true ||
      completedByOnboardingApi

    const needsOnboarding =
      isReady &&
      !needsIdpLogin &&
      !needsBackendLogin &&
      !skipOnboardingCheck &&
      location.pathname !== '/onboarding' &&
      backendAuthStatus?.needsOnboarding &&
      !isInvitedOrOnboarded

    const shouldRedirect = needsIdpLogin || needsBackendLogin || needsOnboarding

    // Perform all redirects via useEffect to avoid synchronous router state
    // updates during render, which cause "Maximum update depth exceeded" loops.
    useEffect(() => {
      if (!shouldRedirect || redirectingRef.current) return
      redirectingRef.current = true

      if (needsIdpLogin || needsBackendLogin) {
        logger.debug(
          '🚫 ProtectedRoute: Not authenticated, redirecting to login',
          {
            idpAuth: !needsIdpLogin,
            backendAuth: !needsBackendLogin,
            pathname: location.pathname,
          }
        )
        navigate({ to: redirectTo || '/login', replace: true })
        return
      }

      if (needsOnboarding) {
        logger.debug(
          '🔄 ProtectedRoute: User needs onboarding, redirecting...',
          {
            needsOnboarding: backendAuthStatus?.needsOnboarding,
            onboardingCompleted: backendAuthStatus?.onboardingCompleted,
            pathname: location.pathname,
          }
        )
        navigate({ to: '/onboarding', replace: true })
      }
    }, [
      shouldRedirect,
      needsIdpLogin,
      needsBackendLogin,
      needsOnboarding,
      redirectTo,
      navigate,
      location.pathname,
      backendAuthStatus,
      user?.email,
    ])

    // Reset the redirect guard when auth state changes (e.g. user logs back in)
    useEffect(() => {
      if (!shouldRedirect) {
        redirectingRef.current = false
      }
    }, [shouldRedirect])

    if (!isReady || shouldRedirect) {
      logger.debug(
        '🔄 ProtectedRoute: Loading/redirecting for:',
        location.pathname
      )
      if (FallbackComponent) return <FallbackComponent />
      return <LoadingSpinner />
    }

    logger.debug('✅ ProtectedRoute: Access granted for:', location.pathname)
    return <>{children}</>
  }
)

ProtectedRoute.displayName = 'ProtectedRoute'

export default ProtectedRoute
