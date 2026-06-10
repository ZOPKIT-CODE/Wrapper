import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth/cognito-auth'
import useSilentAuth from '@/hooks/useSilentAuth'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { logger } from '@/lib/logger'

interface SilentAuthGuardProps {
  children: React.ReactNode
}

/**
 * Component that handles silent authentication on app initialization
 * This checks for domain cookies and attempts silent login before rendering the app
 */
export const SilentAuthGuard: React.FC<SilentAuthGuardProps> = ({
  children,
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isLoading, user } = useAuth()
  const { checkSilentAuth, isChecking, hasChecked, getAuthState } =
    useSilentAuth()

  const [initializationComplete, setInitializationComplete] = useState(false)
  const [authCheckComplete, setAuthCheckComplete] = useState(false)
  // Stable primitive for effect deps - avoid 'user' object to prevent re-render loop
  const userId = user?.id ?? user?.sub ?? null
  const initStartedRef = useRef(false)

  // Paths that don't require authentication
  const publicPaths = [
    '/',
    '/landing',
    '/login',
    '/auth/callback',
    '/onboarding',
    '/organization-setup',
    '/simple-onboarding',
    '/invite/accept',
    '/pricing',
    '/privacy',
    '/terms',
    '/refund-policy',
    '/cookies',
    '/security',
    '/products',
    '/industries',
  ]

  const isPublicPath = publicPaths.some(
    (path) => location.pathname === path || location.pathname.startsWith(path)
  )

  // Reset init guard when user logs out so next login runs again
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      initStartedRef.current = false
    }
  }, [isAuthenticated, isLoading])

  // Initialize silent authentication (run once when deps settle; avoid 'user' object in deps to prevent loop)
  useEffect(() => {
    if (isLoading) return
    if (initStartedRef.current) return

    const initializeSilentAuth = async () => {
      if (authCheckComplete) return
      initStartedRef.current = true

      try {
        // If user is already authenticated, no need for silent auth
        if (isAuthenticated && userId) {
          setAuthCheckComplete(true)
          setInitializationComplete(true)
          return
        }

        // If on a public path and not authenticated, no need for silent auth
        if (isPublicPath && !isAuthenticated) {
          setAuthCheckComplete(true)
          setInitializationComplete(true)
          return
        }

        // Attempt silent authentication
        const silentAuthResult = await checkSilentAuth()

        // Get the final auth state
        const authState = await getAuthState()
        void silentAuthResult // consumed via authState

        setAuthCheckComplete(true)

        // Handle post-authentication routing
        if (authState.isAuthenticated && authState.user) {
          await handleAuthenticatedUser(authState)
        } else {
          await handleUnauthenticatedUser()
        }
      } catch (error) {
        logger.error('❌ SilentAuthGuard: Error during initialization:', error)
        setAuthCheckComplete(true)
        setInitializationComplete(true)
      }
    }

    initializeSilentAuth()
  }, [
    isLoading,
    isAuthenticated,
    userId,
    location.pathname,
    isPublicPath,
    authCheckComplete,
    hasChecked,
    isChecking,
    checkSilentAuth,
    getAuthState,
  ])

  // Handle authenticated user routing
  const handleAuthenticatedUser = async (
    _authState: Awaited<ReturnType<typeof getAuthState>>
  ) => {
    try {
      // Never auto-redirect from public paths — the landing page handles
      // showing the correct CTA (Dashboard / Onboarding / Sign In).
      setInitializationComplete(true)
    } catch (error) {
      logger.error(
        '❌ SilentAuthGuard: Error handling authenticated user:',
        error
      )
      setInitializationComplete(true)
    }
  }

  // Handle unauthenticated user routing
  const handleUnauthenticatedUser = async () => {
    // If on a protected route, redirect to landing
    if (!isPublicPath) {
      navigate({ to: '/landing', replace: true })
    }
    setInitializationComplete(true)
  }

  // Show loading spinner while initializing
  if (
    isLoading ||
    isChecking ||
    !authCheckComplete ||
    !initializationComplete
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">
            {isLoading
              ? 'Initializing authentication...'
              : isChecking
                ? 'Checking for existing session...'
                : 'Loading application...'}
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export default SilentAuthGuard
