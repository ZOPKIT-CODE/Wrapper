import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PearlButton } from '@/components/ui/pearl-button'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'

export interface EditForm {
  name: string
  description: string
  isActive: boolean
}

export interface OrganizationEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editForm: EditForm
  setEditForm: (form: EditForm) => void
  onSave: () => void
  isUpdating: boolean
}

export function OrganizationEditDialog({
  open,
  onOpenChange,
  editForm,
  setEditForm,
  onSave,
  isUpdating,
}: OrganizationEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
              className="transition-colors focus:border-[#1B2E5A] focus:ring-2 focus:ring-[#1B2E5A]"
            />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea
              value={editForm.description}
              onChange={(e) =>
                setEditForm({ ...editForm, description: e.target.value })
              }
              className="transition-colors focus:border-[#1B2E5A] focus:ring-2 focus:ring-[#1B2E5A]"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={editForm.isActive}
              onChange={(e) =>
                setEditForm({ ...editForm, isActive: e.target.checked })
              }
              className="rounded border-gray-300 focus:ring-2 focus:ring-[#1B2E5A] focus:ring-offset-0"
            />
            <Label>Active</Label>
          </div>
        </div>
        <DialogFooter>
          <PearlButton
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </PearlButton>
          <PearlButton
            onClick={onSave}
            disabled={!editForm.name.trim() || isUpdating}
          >
            {isUpdating ? (
              <>
                <ZopkitRoundLoader size="xs" className="mr-2" />
                Updating...
              </>
            ) : (
              'Save Changes'
            )}
          </PearlButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
