import React, { useEffect } from 'react'
import { useAuth } from '@/lib/auth/cognito-auth'
import { useTheme } from '@/components/theme/ThemeProvider'
import { OnboardingForm } from '../components/OnboardingForm'
import { onboardingLogger } from '../utils/onboardingLogger'

/**
 * Main Onboarding Page
 */
const OnboardingPage: React.FC = () => {
  const { isLoading: isAuthLoading } = useAuth()
  const { theme, setTheme } = useTheme()

  // Force light theme for onboarding page - use ref to prevent infinite loops
  const originalThemeRef = React.useRef<typeof theme | null>(null)

  useEffect(() => {
    // Store original theme only once
    if (originalThemeRef.current === null) {
      originalThemeRef.current = theme
    }

    // Only set theme if it's not already light
    if (theme !== 'light') {
      onboardingLogger.info('Forcing light theme for onboarding page', {
        previousTheme: theme,
      })
      setTheme('light')
    }

    // Restore original theme when component unmounts
    return () => {
      const originalTheme = originalThemeRef.current
      if (originalTheme && originalTheme !== 'light') {
        onboardingLogger.info('Restoring original theme on unmount', {
          originalTheme,
        })
        setTheme(originalTheme)
      }
    }
  }, []) // Only run on mount/unmount - remove theme dependency to prevent loops

  if (isAuthLoading) {
    onboardingLogger.debug('Onboarding page: auth loading')
  }

  // Show loading while determining authentication status
  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading your information...</p>
        </div>
      </div>
    )
  }

  // OnboardingForm handles flow selection internally with optimized performance
  return (
    <div className="h-screen w-full overflow-hidden">
      <OnboardingForm />
    </div>
  )
}

export default OnboardingPage
