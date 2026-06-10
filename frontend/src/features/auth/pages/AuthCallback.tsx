import { useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth/cognito-auth'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'
import { useNavigate } from '@tanstack/react-router'
import {
  clearStaleAuthStorage,
  isInvalidGrantError,
  markSessionRecoveryReason,
  consumePostLoginRedirect,
} from '@/lib/auth/session-recovery'

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
        const errorMessage =
          (error as { message?: string }).message ||
          (error as any)?.error_description ||
          ''
        const errorCode = (error as any)?.error || ''

        const isInvalidGrant = isInvalidGrantError(error)

        const isServerError =
          errorMessage.includes('server_error') ||
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
            navigate({
              to: '/login',
              search: { error: 'Session expired. Please sign in again.' },
              replace: true,
            })
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

        const pendingInvitationToken = sessionStorage.getItem(
          'pendingInvitationToken'
        )
        if (pendingInvitationToken) {
          hasNavigatedRef.current = true
          navigate({
            to: `/invite/accept?token=${pendingInvitationToken}`,
            replace: true,
          })
          return
        }

        // If the user was bounced here by a session expiry on a protected page
        // (e.g. /company-admin), return them exactly there instead of the default
        // dashboard. consumePostLoginRedirect validates it's a safe internal path.
        const returnTo = consumePostLoginRedirect()
        if (returnTo) {
          hasNavigatedRef.current = true
          navigate({ to: returnTo, replace: true })
          return
        }

        hasNavigatedRef.current = true
        if (onboardingParam === 'complete') {
          navigate({
            to: '/dashboard/applications',
            search: { onboarding: 'complete' },
            replace: true,
          })
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
    const errorMessage =
      (error as { message?: string }).message ||
      (error as any)?.error_description ||
      ''
    const errorCode = (error as any)?.error || ''

    const isInvalidGrant = isInvalidGrantError(error)

    const isServerError =
      errorMessage.includes('server_error') ||
      errorCode === 'server_error' ||
      (error as any)?.status_code === 500

    if (isServerError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-orange-50">
          <div className="max-w-md px-4 text-center">
            <div className="mb-4 text-6xl text-orange-600">⚠️</div>
            <h2 className="mb-2 text-xl font-semibold text-orange-900">
              Server Error
            </h2>
            <p className="mb-4 text-orange-700">
              The authentication server encountered an error. This is usually
              temporary.
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
                className="mr-2 rounded bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate({ to: '/login', replace: true })}
                className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
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
        <div className="flex min-h-screen items-center justify-center bg-yellow-50">
          <div className="max-w-md px-4 text-center">
            <div className="mb-4 text-6xl text-yellow-600">⚠️</div>
            <h2 className="mb-2 text-xl font-semibold text-yellow-900">
              Authentication Issue
            </h2>
            <p className="mb-4 text-yellow-700">
              There was an issue with token exchange. This can happen if:
            </p>
            <ul className="mb-4 space-y-2 text-left text-yellow-700">
              <li>• The authorization code was already used</li>
              <li>• The refresh token is expired or malformed</li>
              <li>• There's a redirect URI mismatch</li>
            </ul>
            <p className="mb-4 text-sm text-yellow-600">
              Please try logging in again.
            </p>
            <button
              onClick={() => {
                clearStaleAuthStorage()
                markSessionRecoveryReason('invalid_grant')
                navigate({
                  to: '/login',
                  search: { error: 'Session expired. Please sign in again.' },
                  replace: true,
                })
              }}
              className="rounded bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-red-50">
        <div className="text-center">
          <div className="mb-4 text-6xl text-red-600">⚠️</div>
          <h2 className="mb-2 text-xl font-semibold text-red-900">
            Authentication Error
          </h2>
          <p className="mb-4 text-red-700">
            {(error as { message?: string }).message ||
              'An error occurred during authentication'}
          </p>
          <button
            onClick={() => navigate({ to: '/login', replace: true })}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <ZopkitRoundLoader size="xl" className="mx-auto mb-4" />
        <h2 className="mb-2 text-xl font-semibold text-[#1B2E5A]">
          Completing authentication...
        </h2>
        <p className="text-gray-600">Please wait while we log you in.</p>
      </div>
    </div>
  )
}
