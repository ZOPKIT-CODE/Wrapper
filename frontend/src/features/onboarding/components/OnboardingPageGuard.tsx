import React from 'react'
import { Navigate } from '@tanstack/react-router'
import { useKindeAuth } from '@kinde-oss/kinde-auth-react'
import { useAuthStatus, useOnboardingStatus } from '@/hooks/useSharedQueries'
import AnimatedLoader from '@/components/common/feedback/AnimatedLoader'

interface OnboardingPageGuardProps {
  children: React.ReactNode
}

export const OnboardingPageGuard = ({ children }: OnboardingPageGuardProps) => {
  const { isAuthenticated, isLoading: kindeLoading } = useKindeAuth()
  const { data: authData, isLoading: authLoading } = useAuthStatus()
  const { data: onboardingResponse, isLoading: onboardingLoading } = useOnboardingStatus()

  const onboardingData = onboardingResponse?.data
  const backendAuthStatus = authData?.authStatus

  // Show loading while checking authentication and onboarding status
  if (kindeLoading || (isAuthenticated && (authLoading || onboardingLoading))) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <AnimatedLoader size="lg" className="mb-6" />
          <p className="text-gray-600 dark:text-gray-300 text-lg font-medium">Checking onboarding status...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, redirect to landing
  if (!isAuthenticated && !kindeLoading) {
    return <Navigate to="/landing" replace />
  }

  // Check if onboarding is completed
  let isOnboarded = false

  if (onboardingData) {
    // Use the direct API response format from the user's example
    isOnboarded = onboardingData.isOnboarded === true ||
                  onboardingData.onboardingStep === 'completed' ||
                  !onboardingData.needsOnboarding
  }

  if (backendAuthStatus) {
    // Fallback to auth status if onboarding data isn't available
    isOnboarded = backendAuthStatus.onboardingCompleted === true ||
                  backendAuthStatus.userType === 'INVITED_USER' ||
                  backendAuthStatus.isInvitedUser === true
  }

  // If onboarding is completed, redirect to dashboard
  if (isOnboarded) {
    return <Navigate to="/dashboard/applications" replace />
  }

  // If onboarding is not completed, allow access to onboarding page
  return <>{children}</>
}
