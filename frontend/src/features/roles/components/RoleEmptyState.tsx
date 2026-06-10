import { Shield, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RoleEmptyStateProps {
  hasFilters: boolean
  onCreateRole: () => void
}

export function RoleEmptyState({
  hasFilters,
  onCreateRole,
}: RoleEmptyStateProps) {
  return (
    <div className="p-12 text-center">
      <Shield className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-4 text-lg font-semibold text-[#1B2E5A]">
        No roles found
      </h3>
      <p className="mt-2 text-gray-600">
        {hasFilters
          ? 'Try adjusting your search filters or create a new role.'
          : 'Get started by creating your first role.'}
      </p>
      <Button onClick={onCreateRole} className="mt-4">
        <Plus className="mr-2 h-4 w-4" />
        Create Role
      </Button>
    </div>
  )
}
