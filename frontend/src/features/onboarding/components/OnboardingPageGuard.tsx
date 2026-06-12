import React from 'react'
import { Navigate } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth/cognito-auth'
import { useAuthStatus, useOnboardingStatus } from '@/hooks/useSharedQueries'
import { AuthFlowLoading } from '@/components/layout/AuthFlowLayout'

interface OnboardingPageGuardProps {
  children: React.ReactNode
}

export const OnboardingPageGuard = ({ children }: OnboardingPageGuardProps) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { data: authData } = useAuthStatus()
  const { data: onboardingResponse, isLoading: onboardingLoading } =
    useOnboardingStatus()

  const onboardingData = onboardingResponse?.data
  const backendAuthStatus = authData?.authStatus

  // Show loading while checking authentication and onboarding status
  if (authLoading || (isAuthenticated && (authLoading || onboardingLoading))) {
    return <AuthFlowLoading message="Checking onboarding status..." />
  }

  // If not authenticated, redirect to landing
  if (!isAuthenticated && !authLoading) {
    return <Navigate to="/landing" replace />
  }

  // Check if onboarding is completed
  let isOnboarded = false

  if (onboardingData) {
    // Use the direct API response format from the user's example
    isOnboarded =
      onboardingData.isOnboarded === true ||
      onboardingData.onboardingStep === 'completed' ||
      !onboardingData.needsOnboarding
  }

  if (backendAuthStatus) {
    // Fallback to auth status if onboarding data isn't available
    isOnboarded =
      backendAuthStatus.onboardingCompleted === true ||
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
