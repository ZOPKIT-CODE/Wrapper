import { useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth/cognito-auth'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'
import { useNavigate } from '@tanstack/react-router'
import { clearStaleAuthStorage, isInvalidGrantError, markSessionRecoveryReason } from '@/lib/auth/session-recovery'

function authErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  if (typeof error === 'object' && error !== null && 'error_description' in error) {
    return String((error as { error_description: unknown }).error_description)
  }
  return ''
}

export function AuthCallback() {
  const { isLoading, isAuthenticated, error, user } = useAuth()
  const navigate = useNavigate()
  const hasProcessedRef = useRef(false)
  const processingRef = useRef(false)
  const hasNavigatedRef = useRef(false)
  const hasRecoveredSessionRef = useRef(false)

  // Timeout fallback — if Kinde never resolves, redirect to login after 15s
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      if (!hasNavigatedRef.current) {
        navigate({ to: '/login', replace: true })
      }
    }, 15000)
    return () => clearTimeout(fallbackTimer)
  }, [navigate])

  useEffect(() => {
    const handleCallback = async () => {
      if (hasProcessedRef.current || processingRef.current) {
        return
      }

      if (isLoading) {
        return
      }

      if (error) {
        const errorMessage = authErrorMessage(error)
        const errorCode = typeof error === 'object' && error !== null && 'error' in error
          ? String((error as { error: unknown }).error)
          : ''

        const isInvalidGrant = isInvalidGrantError(error)

        const isServerError = errorMessage.includes('server_error') ||
                             errorCode === 'server_error' ||
                             (error as any)?.status_code === 500

        if (isAuthenticated && user) {
          // Authentication succeeded despite the error — continue with normal flow
        } else {
          if (isInvalidGrant && !hasRecoveredSessionRef.current) {
            hasRecoveredSessionRef.current = true
            clearStaleAuthStorage()
            markSessionRecoveryReason('invalid_grant')
            hasNavigatedRef.current = true
            window.location.replace('/login?error=Session%20expired.%20Please%20sign%20in%20again.')
            return
          }

          if (isServerError) {
            // Retry after a short delay
            setTimeout(() => {
              if (!isAuthenticated) {
                hasProcessedRef.current = false
                processingRef.current = false
              }
            }, 2000)
            return
          }

          console.error('❌ AuthCallback: auth error:', error)
          hasProcessedRef.current = true
          return
        }
      }

      try {
        const urlParams = new URLSearchParams(window.location.search)
        const codeParam = urlParams.get('code')

        if (!codeParam && !isAuthenticated) {
          hasNavigatedRef.current = true
          navigate({ to: '/login', replace: true })
          return
        }

        hasProcessedRef.current = true
        processingRef.current = true

        if (!isAuthenticated || !user) {
          // Kinde is still processing the token exchange — wait for next re-render
          hasProcessedRef.current = false
          processingRef.current = false
          return
        }

        const onboardingParam = urlParams.get('onboarding')
        const refreshParam = urlParams.get('refresh')

        if (onboardingParam === 'complete' && refreshParam === 'true') {
          hasNavigatedRef.current = true
          setTimeout(() => {
            window.location.href = '/dashboard/applications?onboarding=complete'
          }, 1000)
          return
        }

        const pendingInvitationToken = sessionStorage.getItem('pendingInvitationToken')
        if (pendingInvitationToken) {
          hasNavigatedRef.current = true
          navigate({ to: `/invite/accept?token=${pendingInvitationToken}`, replace: true })
          return
        }

        hasNavigatedRef.current = true
        if (onboardingParam === 'complete') {
          window.location.replace('/dashboard/applications?onboarding=complete')
        } else {
          navigate({ to: '/dashboard/applications', replace: true })
        }

      } catch (err) {
        console.error('❌ AuthCallback error:', err)
        hasNavigatedRef.current = true
        setTimeout(() => {
          navigate({ to: '/login', replace: true })
        }, 2000)
      }
    }

    const timer = setTimeout(handleCallback, 500)
    return () => clearTimeout(timer)
  }, [isLoading, isAuthenticated, error, navigate, user])

  if (error && !isAuthenticated) {
    const errorMessage = authErrorMessage(error)
    const errorCode = typeof error === 'object' && error !== null && 'error' in error
      ? String((error as { error: unknown }).error)
      : ''

    const isInvalidGrant = isInvalidGrantError(error)

    const isServerError = errorMessage.includes('server_error') ||
                         errorCode === 'server_error' ||
                         (error as any)?.status_code === 500

    if (isServerError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-orange-50">
          <div className="text-center max-w-md px-4">
            <div className="text-orange-600 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-orange-900 mb-2">Server Error</h2>
            <p className="text-orange-700 mb-4">
              The authentication server encountered an error. This is usually temporary.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  try {
                    const url = new URL(window.location.href)
                    url.searchParams.delete('code')
                    url.searchParams.delete('state')
                    window.history.replaceState({}, '', url.toString())
                  } catch (e) {
                    // ignore
                  }
                  navigate({ to: '/login', replace: true })
                }}
                className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 mr-2"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate({ to: '/login', replace: true })}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (isInvalidGrant) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-yellow-50">
          <div className="text-center max-w-md px-4">
            <div className="text-yellow-600 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-yellow-900 mb-2">Authentication Issue</h2>
            <p className="text-yellow-700 mb-4">
              There was an issue with token exchange. This can happen if:
            </p>
            <ul className="text-left text-yellow-700 mb-4 space-y-2">
              <li>• The authorization code was already used</li>
              <li>• The refresh token is expired or malformed</li>
              <li>• There's a redirect URI mismatch</li>
            </ul>
            <p className="text-yellow-600 text-sm mb-4">Please try logging in again.</p>
            <button
              onClick={() => {
                clearStaleAuthStorage()
                markSessionRecoveryReason('invalid_grant')
                window.location.replace('/login?error=Session%20expired.%20Please%20sign%20in%20again.')
              }}
              className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-red-900 mb-2">Authentication Error</h2>
          <p className="text-red-700 mb-4">{authErrorMessage(error) || 'An error occurred during authentication'}</p>
          <button
            onClick={() => navigate({ to: '/login', replace: true })}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <ZopkitRoundLoader size="xl" className="mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-primary mb-2">Completing authentication...</h2>
        <p className="text-gray-600">Please wait while we log you in.</p>
      </div>
    </div>
  )
}
