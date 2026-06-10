import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Check, X } from 'lucide-react'

export interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'success'
  loading?: boolean
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  loading = false,
}: ConfirmationModalProps) {
  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <X className="h-6 w-6 text-red-500" />
      case 'success':
        return <Check className="h-6 w-6 text-green-500" />
      case 'warning':
      default:
        return <AlertTriangle className="h-6 w-6 text-yellow-500" />
    }
  }

  const getConfirmButtonVariant = () => {
    switch (variant) {
      case 'danger':
        return 'destructive'
      case 'success':
        return 'default'
      case 'warning':
      default:
        return 'default'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {getIcon()}
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          </div>
          <DialogDescription className="mt-2 text-sm text-gray-600">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={getConfirmButtonVariant()}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Specialized confirmation modals for common use cases

export function OrganizationAssignmentConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  organizationName,
  userName,
  action, // 'assign' or 'deassign'
  loading = false,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  organizationName: string
  userName: string
  action: 'assign' | 'deassign'
  loading?: boolean
}) {
  const isAssign = action === 'assign'

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`${isAssign ? 'Assign' : 'Remove'} Organization Access`}
      description={`Are you sure you want to ${isAssign ? 'assign' : 'remove'} ${userName} ${isAssign ? 'to' : 'from'} the "${organizationName}" organization? ${isAssign ? 'They will gain access to organization-specific resources and features.' : 'They will lose access to organization-specific resources and features.'}`}
      confirmText={isAssign ? 'Assign Organization' : 'Remove Organization'}
      cancelText="Cancel"
      variant={isAssign ? 'success' : 'danger'}
      loading={loading}
    />
  )
}

export function RoleAssignmentConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  roleName,
  userName,
  action, // 'assign' or 'deassign'
  loading = false,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  roleName: string
  userName: string
  action: 'assign' | 'deassign'
  loading?: boolean
}) {
  const isAssign = action === 'assign'

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`${isAssign ? 'Assign' : 'Remove'} Role`}
      description={`Are you sure you want to ${isAssign ? 'assign' : 'remove'} the "${roleName}" role ${isAssign ? 'to' : 'from'} ${userName}? ${isAssign ? 'They will gain the permissions associated with this role.' : 'They will lose the permissions associated with this role.'}`}
      confirmText={isAssign ? 'Assign Role' : 'Remove Role'}
      cancelText="Cancel"
      variant={isAssign ? 'success' : 'danger'}
      loading={loading}
    />
  )
}
