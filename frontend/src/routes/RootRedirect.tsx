import { useEffect, useState, lazy, Suspense } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useKindeAuth } from '@/lib/auth/cognito-auth'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'

const Landing = lazy(() => import('@/features/landing/pages/Landing'))

/**
 * Root route ("/") — renders the Landing page directly.
 *
 * Before showing the landing page it checks for a pending invitation token
 * and redirects to /invite/accept if one is found.
 *
 * In all other cases the Landing page is rendered in-place (no redirect),
 * and its own CTA buttons handle navigation to Dashboard / Onboarding / Sign In.
 */
export function RootRedirect() {
  const { isLoading } = useKindeAuth()
  const [isChecking, setIsChecking] = useState(true)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) return

    const pendingToken =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('pendingInvitationToken')
        : null

    if (pendingToken) {
      setRedirectTo(`/invite/accept?token=${pendingToken}`)
    }

    setIsChecking(false)
  }, [isLoading])

  if (isLoading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <ZopkitRoundLoader size="lg" className="mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (redirectTo) {
    return <Navigate to={redirectTo as any} replace />
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <ZopkitRoundLoader size="lg" />
        </div>
      }
    >
      <Landing />
    </Suspense>
  )
}
