import { Shield, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardEmpty } from '@/components/common/feedback/LoadingStates'

interface RoleEmptyStateProps {
  hasFilters: boolean
  onCreateRole: () => void
}

export function RoleEmptyState({
  hasFilters,
  onCreateRole,
}: RoleEmptyStateProps) {
  return (
    <CardEmpty
      showHeader={false}
      icon={Shield}
      title="No roles found"
      description={
        hasFilters
          ? 'Try adjusting your search filters or create a new role.'
          : 'Get started by creating your first role.'
      }
      action={
        <Button onClick={onCreateRole}>
          <Plus className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      }
    />
  )
}
