import { Download, Archive, Trash2, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BulkAction } from '@/types/role-management'

interface BulkActionsProps {
  selectedCount: number
  totalCount: number
  onBulkAction: (action: BulkAction, selectedIds: string[]) => void
  onClearSelection: () => void
  selectedRoleIds: string[]
  isLoading?: boolean
}

export function BulkActions({
  selectedCount,
  totalCount,
  onBulkAction,
  onClearSelection,
  selectedRoleIds,
  isLoading = false,
}: BulkActionsProps) {
  if (selectedCount === 0) {
    return null
  }

  const handleAction = (action: BulkAction) => {
    onBulkAction(action, selectedRoleIds)
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-6">
            <span className="text-sm font-medium text-primary">
              {selectedCount} role{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <span className="text-sm text-primary/70">
              from {totalCount} total roles
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('export')}
              disabled={isLoading}
              className="border-primary/30 text-primary hover:bg-primary/10"
            >
              <Download className="mr-2 h-4 w-4" />
              Export Selected
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('deactivate')}
              disabled={isLoading}
            >
              <Archive className="mr-2 h-4 w-4" />
              Deactivate
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleAction('delete')}
              disabled={isLoading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              disabled={isLoading}
            >
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
