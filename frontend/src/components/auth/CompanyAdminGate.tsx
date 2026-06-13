import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { CompanyAdminLayout } from '@/components/layout/CompanyAdminLayout'
import { useAuthStatus } from '@/hooks/useSharedQueries'
import { AuthFlowLoading } from '@/components/layout/AuthFlowLayout'

export function CompanyAdminGate({ children }: { children: React.ReactNode }) {
  const { data: authData, isLoading } = useAuthStatus()
  const backendAuth = authData?.authStatus

  // Platform admins and staff have no Cognito permissions — skip the permission
  // guard entirely. PermissionGuard's fallback is /dashboard/applications which
  // would loop for platform users who have no tenant.
  const isPlatformPlane =
    backendAuth?.isPlatformAdmin || backendAuth?.isPlatformStaff

  return (
    <ProtectedRoute skipOnboardingCheck>
      {isLoading && !backendAuth ? (
        <AuthFlowLoading message="Checking access..." />
      ) : isPlatformPlane ? (
        <CompanyAdminLayout>{children}</CompanyAdminLayout>
      ) : (
        <PermissionGuard
          requiredPermission="company:admin:access"
          fallbackPath="/"
        >
          <CompanyAdminLayout>{children}</CompanyAdminLayout>
        </PermissionGuard>
      )}
    </ProtectedRoute>
  )
}
