import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { CompanyAdminLayout } from '@/components/layout/CompanyAdminLayout'

export function CompanyAdminGate({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute skipOnboardingCheck>
      <PermissionGuard requiredPermission="company:admin:access">
        <CompanyAdminLayout>{children}</CompanyAdminLayout>
      </PermissionGuard>
    </ProtectedRoute>
  )
}
