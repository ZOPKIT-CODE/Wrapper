import { Checkbox } from '@/components/ui/checkbox'

interface RoleTableHeaderProps {
  totalRoles: number
  selectedCount: number
  onSelectAll: () => void
  onClearSelection: () => void
}

export function RoleTableHeader({
  totalRoles,
  selectedCount,
  onSelectAll,
  onClearSelection,
}: RoleTableHeaderProps) {
  const isAllSelected = selectedCount === totalRoles && totalRoles > 0
  const isIndeterminate = selectedCount > 0 && selectedCount < totalRoles

  return (
    <div className="bg-muted/50 border-b p-6">
      <div className="text-foreground grid grid-cols-12 gap-4 text-sm font-semibold">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={isAllSelected}
            ref={(el) => {
              if (el instanceof HTMLInputElement)
                el.indeterminate = isIndeterminate
            }}
            onCheckedChange={isAllSelected ? onClearSelection : onSelectAll}
          />
        </div>
        <div className="col-span-5">Role & Description</div>
        <div className="col-span-4">Permissions & Modules</div>
        <div className="col-span-2">Type & Status</div>
        <div className="text-right">Actions</div>
      </div>
    </div>
  )
}
