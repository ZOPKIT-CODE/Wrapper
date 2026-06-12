import React, { useEffect } from 'react'
import { useAuth } from '@/lib/auth/cognito-auth'
import { useTheme } from '@/components/theme/ThemeProvider'
import {
  AuthFlowLayout,
  AuthFlowLoading,
} from '@/components/layout/AuthFlowLayout'
import { OnboardingForm } from '../components/OnboardingForm'
import { onboardingLogger } from '../utils/onboardingLogger'

/**
 * Main Onboarding Page
 */
const OnboardingPage: React.FC = () => {
  const { isLoading: isAuthLoading } = useAuth()
  const { theme, setTheme } = useTheme()

  const originalThemeRef = React.useRef<typeof theme | null>(null)

  useEffect(() => {
    if (originalThemeRef.current === null) {
      originalThemeRef.current = theme
    }

    if (theme !== 'light') {
      onboardingLogger.info('Forcing light theme for onboarding page', {
        previousTheme: theme,
      })
      setTheme('light')
    }

    return () => {
      const originalTheme = originalThemeRef.current
      if (originalTheme && originalTheme !== 'light') {
        onboardingLogger.info('Restoring original theme on unmount', {
          originalTheme,
        })
        setTheme(originalTheme)
      }
    }
  }, [])

  if (isAuthLoading) {
    onboardingLogger.debug('Onboarding page: auth loading')
    return <AuthFlowLoading message="Loading your information..." />
  }

  return (
    <AuthFlowLayout hideHeader className="h-screen w-full overflow-hidden">
      <OnboardingForm />
    </AuthFlowLayout>
  )
}

export default OnboardingPage
