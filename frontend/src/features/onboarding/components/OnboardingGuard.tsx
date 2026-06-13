import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/auth/cognito-auth'
import { Navigate, useLocation } from '@tanstack/react-router'
import { useAuthStatus, useOnboardingStatus } from '@/hooks/useSharedQueries'
import { AuthFlowLoading } from '@/components/layout/AuthFlowLayout'
import { logger } from '@/lib/logger'

interface OnboardingGuardProps {
  children: React.ReactNode
  redirectTo?: string
}

interface OnboardingStatus {
  needsOnboarding: boolean
  onboardingCompleted: boolean
  hasUser: boolean
  hasTenant: boolean
}

export const OnboardingGuard = React.memo(
  ({ children, redirectTo = '/login' }: OnboardingGuardProps) => {
    const { isAuthenticated, isLoading: authLoading, user } = useAuth()
    const { data: authData, isLoading: authStatusLoading } = useAuthStatus()
    const { data: onboardingResponse, isLoading: onboardingLoading } =
      useOnboardingStatus()

    const [onboardingStatus, setOnboardingStatus] =
      useState<OnboardingStatus | null>(null)
    const location = useLocation()

    const onboardingData = onboardingResponse?.data
    const backendAuthStatus = authData?.authStatus

    // Refs to read latest data in effect without putting objects in deps (prevents infinite re-render loop)
    const authStatusRef = useRef(backendAuthStatus)
    const onboardingDataRef = useRef(onboardingData)
    authStatusRef.current = backendAuthStatus
    onboardingDataRef.current = onboardingData

    // Stable primitives for deps - never use backendAuthStatus/onboardingData (objects) in deps
    const authReady = !authStatusLoading && !!authData
    const onboardingReady = !!onboardingResponse && !!onboardingData
    const pathname = location.pathname
    const search = location.searchStr

    useEffect(() => {
      const backendAuthStatus = authStatusRef.current
      const onboardingData = onboardingDataRef.current

      // Only run onboarding check when auth/onboarding data is ready
      if (!backendAuthStatus && !onboardingData && !authReady) return

      const isDashboardPath =
        pathname.startsWith('/dashboard') || pathname.startsWith('/org/')

      const urlParams = new URLSearchParams(search)
      const justCompletedOnboarding = urlParams.get('onboarding') === 'complete'
      const justAcceptedInvitation = urlParams.get('invited') === 'true'

      // Invited users landing on dashboard after accept: skip onboarding redirect
      if (justAcceptedInvitation && isDashboardPath) {
        setOnboardingStatus({
          needsOnboarding: false,
          onboardingCompleted: true,
          hasUser: !!backendAuthStatus?.userId,
          hasTenant: !!backendAuthStatus?.tenantId,
        })
        return
      }

      if (justCompletedOnboarding) {
        const authStatus = authStatusRef.current
        if (authStatus) {
          // fetchQuery in OnboardingFormOptimized guarantees authStatus is fresh in cache
          // before navigate fires, so we can resolve immediately without any delay.
          const status: OnboardingStatus = {
            needsOnboarding:
              authStatus.needsOnboarding ?? !authStatus.onboardingCompleted,
            onboardingCompleted: authStatus.onboardingCompleted || false,
            hasUser: !!authStatus.userId,
            hasTenant: !!authStatus.tenantId,
          }
          const isInvitedUser =
            authStatus.userType === 'INVITED_USER' ||
            authStatus.isInvitedUser === true ||
            authStatus.onboardingCompleted === true
          if (isInvitedUser) {
            status.needsOnboarding = false
            status.onboardingCompleted = true
          }
          setOnboardingStatus(status)
        }
        // If authStatus isn't in cache yet, the effect re-runs when authReady flips true.
        return
      }

      if (onboardingData && backendAuthStatus && !isDashboardPath) {
        const status: OnboardingStatus = {
          needsOnboarding:
            onboardingData.needsOnboarding ?? !onboardingData.isOnboarded,
          onboardingCompleted: onboardingData.isOnboarded || false,
          hasUser: !!onboardingData.user,
          hasTenant: !!onboardingData.organization,
        }
        const isInvitedUser =
          backendAuthStatus.userType === 'INVITED_USER' ||
          backendAuthStatus.isInvitedUser === true ||
          backendAuthStatus.onboardingCompleted === true ||
          onboardingData.user?.userType === 'INVITED_USER'
        if (isInvitedUser) {
          status.needsOnboarding = false
          status.onboardingCompleted = true
        }
        setOnboardingStatus(status)
      } else if (onboardingData && backendAuthStatus && isDashboardPath) {
        setOnboardingStatus({
          needsOnboarding: false,
          onboardingCompleted: true,
          hasUser: !!backendAuthStatus.userId,
          hasTenant: !!backendAuthStatus.tenantId,
        })
      }
    }, [
      isAuthenticated,
      authLoading,
      user?.email,
      authReady,
      onboardingReady,
      pathname,
      search,
    ])

    // Show loading while checking authentication and onboarding status
    if (
      authLoading ||
      (isAuthenticated && (authLoading || onboardingLoading))
    ) {
      return <AuthFlowLoading message="Checking access..." />
    }

    // If not authenticated AND Kinde is not loading, redirect to login
    // This prevents redirect loops while Kinde is still initializing
    if (!isAuthenticated && !authLoading) {
      logger.debug(
        '🔄 OnboardingGuard - Not authenticated (auth loaded), redirecting to:',
        redirectTo
      )
      return <Navigate to={redirectTo} replace />
    }

    // If we have onboarding status and user needs onboarding, redirect to onboarding
    if (onboardingStatus?.needsOnboarding) {
      logger.debug(
        '🔄 OnboardingGuard - User needs onboarding, redirecting to /onboarding'
      )
      return <Navigate to="/onboarding" replace />
    }

    // If onboarding is completed, allow access to children
    if (onboardingStatus?.onboardingCompleted) {
      logger.debug('✅ OnboardingGuard - Onboarding completed, allowing access')
      return <>{children}</>
    }

    // Fallback: show loading if we don't have clear status yet
    return <AuthFlowLoading message="Loading workspace..." />
  }
)

OnboardingGuard.displayName = 'OnboardingGuard'
