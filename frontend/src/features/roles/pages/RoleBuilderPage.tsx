import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Container } from '@/components/common/Page'
import { Button } from '@/components/ui/button'
import { ApplicationModuleRoleBuilder } from '@/features/roles/ApplicationModuleRoleBuilder'
import { useRoles, useInvalidateQueries } from '@/hooks/useSharedQueries'
import AnimatedLoader from '@/components/common/feedback/AnimatedLoader'
import { DASHBOARD_PAGE_TITLE_CLASS } from '@/components/dashboard/DashboardPageHeader'
import { AlertCircle } from 'lucide-react'
import { useRoleIdParam } from '@/hooks/useRoleRouteParams'
import { getCrmRoleTemplate } from '@/data/crm-role-templates'

export function RoleBuilderPage() {
  const roleId = useRoleIdParam()
  const navigate = useNavigate()
  const isEditMode = !!roleId

  // Read ?template= from URL (e.g. /dashboard/roles/new?template=crm_sales_rep)
  const templateKey =
    new URLSearchParams(window.location.search).get('template') ?? undefined
  const templateRole = templateKey ? getCrmRoleTemplate(templateKey) : undefined

  // Fetch role if editing
  const { data: rolesData = [], isLoading } = useRoles({})
  const initialRole = React.useMemo(() => {
    if (!isEditMode || !roleId) return null
    return (
      rolesData.find(
        (r: Record<string, unknown>) => r.roleId === roleId || r.id === roleId
      ) || null
    )
  }, [rolesData, roleId, isEditMode])

  // Template pre-fill: convert template to the shape ApplicationModuleRoleBuilder expects
  const templateInitialRole = React.useMemo(() => {
    if (!templateRole) return undefined
    return {
      roleName: '',
      description: templateRole.description,
      permissions: templateRole.permissions,
    }
  }, [templateRole])

  const { invalidateRoles } = useInvalidateQueries()

  const handleSave = async (_role?: unknown) => {
    invalidateRoles()
    navigate({ to: '/dashboard/roles' })
  }

  const handleCancel = () => {
    navigate({ to: '/dashboard/roles' })
  }

  if (isEditMode && isLoading) {
    return (
      <Container>
        <div className="flex min-h-[400px] items-center justify-center">
          <AnimatedLoader size="md" />
        </div>
      </Container>
    )
  }

  if (isEditMode && !initialRole) {
    return (
      <Container>
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
          <AlertCircle className="h-12 w-12 text-gray-400" />
          <h2 className="text-xl font-semibold">Role Not Found</h2>
          <p className="text-gray-600">
            The role you're trying to edit doesn't exist.
          </p>
          <Button
            onClick={() => navigate({ to: '/dashboard/roles' })}
            variant="outline"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Roles
          </Button>
        </div>
      </Container>
    )
  }

  const pageTitle = isEditMode
    ? 'Edit Role'
    : templateRole
      ? `New Role — ${templateRole.roleName} Template`
      : 'Create New Role'

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[500px] w-full flex-col">
      {/* Header with Back Button */}
      <div className="flex flex-none items-center gap-4 px-4 pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Roles
        </Button>
        <div className="flex-1">
          <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>{pageTitle}</h1>
        </div>
      </div>

      {/* Role Builder - fills remaining space */}
      <div className="min-h-0 flex-1">
        <ApplicationModuleRoleBuilder
          onSave={handleSave}
          onCancel={handleCancel}
          initialRole={initialRole ?? templateInitialRole ?? undefined}
        />
      </div>
    </div>
  )
}
