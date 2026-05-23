import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Loader2, Building2 } from 'lucide-react'
import { HierarchyEntity, RoleRecord, ENTITY_TYPE_LABELS } from './userManagementTypes'

// ---------------------------------------------------------------------------
// EntityHierarchyOrgCheckboxes
// ---------------------------------------------------------------------------

function EntityHierarchyOrgCheckboxes({
  nodes,
  depth,
  selectedIds,
  onToggle,
}: {
  nodes: HierarchyEntity[]
  depth: number
  selectedIds: Set<string>
  onToggle: (entityId: string) => void
}) {
  if (!nodes.length) return null
  return (
    <ul className="list-none space-y-1">
      {nodes.map((entity) => (
        <li key={entity.entityId}>
          <label
            className="flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 hover:bg-muted/50"
            style={{ paddingLeft: `${6 + depth * 16}px` }}
          >
            <Checkbox
              checked={selectedIds.has(entity.entityId)}
              onCheckedChange={() => onToggle(entity.entityId)}
            />
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm">{entity.entityName}</span>
            <Badge variant="outline" className="shrink-0 text-[10px] py-0 px-1.5">
              {ENTITY_TYPE_LABELS[entity.entityType] ?? entity.entityType}
            </Badge>
          </label>
          {entity.children && entity.children.length > 0 ? (
            <EntityHierarchyOrgCheckboxes
              nodes={entity.children}
              depth={depth + 1}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          ) : null}
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// InviteUserModal Props & Component
// ---------------------------------------------------------------------------

export interface InviteUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inviteEmail: string
  onInviteEmailChange: (v: string) => void
  inviteRoleId: string
  onInviteRoleIdChange: (v: string) => void
  inviteEntityIds: string[]
  inviteEntityIdSet: Set<string>
  onToggleEntity: (entityId: string) => void
  inviteMessage: string
  onInviteMessageChange: (v: string) => void
  roles: RoleRecord[]
  hierarchyTree: HierarchyEntity[]
  flatEntitiesCount: number
  isPending: boolean
  onSubmit: () => void
}

export function InviteUserModal({
  open,
  onOpenChange,
  inviteEmail,
  onInviteEmailChange,
  inviteRoleId,
  onInviteRoleIdChange,
  inviteEntityIds,
  inviteEntityIdSet,
  onToggleEntity,
  inviteMessage,
  onInviteMessageChange,
  roles,
  hierarchyTree,
  flatEntitiesCount,
  isPending,
  onSubmit,
}: InviteUserModalProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto px-6 pb-10 pt-5 sm:max-w-xl sm:px-8">
        <SheetHeader className="space-y-2 p-0 pb-5 pr-12 text-left sm:pr-14">
          <SheetTitle style={{ fontFamily: 'var(--zk-display)', letterSpacing: '-0.025em', color: 'var(--zk-ink)', fontSize: 18 }}>
            Invite Team Member
          </SheetTitle>
          <SheetDescription style={{ fontFamily: 'var(--zk-font)', color: 'var(--zk-muted)', fontSize: 13 }}>
            Send an invitation email. You can select multiple organizations (one role applies to all selected). Only one Organization Admin is allowed per tenant.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="invite-email" style={{ fontSize: 12, fontWeight: 500, color: 'var(--zk-muted)', fontFamily: 'var(--zk-font)' }}>
              Email address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              className="rounded-lg"
              value={inviteEmail}
              onChange={(e) => onInviteEmailChange(e.target.value)}
            />
          </div>

          {/* Organizations */}
          <div className="space-y-2">
            <Label style={{ fontSize: 12, fontWeight: 500, color: 'var(--zk-muted)', fontFamily: 'var(--zk-font)' }}>
              Organizations <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--zk-muted-2)' }}>(optional, multi-select)</span>
            </Label>
            <p className="text-[12px] text-muted-foreground">
              Check all orgs/locations this invite applies to. Child items are indented under their parent.
            </p>
            {flatEntitiesCount === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">No organizations found in hierarchy.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-lg border bg-muted/20 px-2 py-2">
                <EntityHierarchyOrgCheckboxes
                  nodes={hierarchyTree}
                  depth={0}
                  selectedIds={inviteEntityIdSet}
                  onToggle={onToggleEntity}
                />
              </div>
            )}
            {inviteEntityIds.length > 0 ? (
              <p className="text-[12px] text-muted-foreground">
                {inviteEntityIds.length} organization{inviteEntityIds.length === 1 ? '' : 's'} selected
              </p>
            ) : null}
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label style={{ fontSize: 12, fontWeight: 500, color: 'var(--zk-muted)', fontFamily: 'var(--zk-font)' }}>
              Role <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--zk-muted-2)' }}>(optional)</span>
            </Label>
            {inviteEntityIds.length > 0 ? (
              <p className="text-[12px] text-muted-foreground">
                The same role is applied to every selected organization.
              </p>
            ) : null}
            {inviteRoleId !== 'none' && roles.find((r) => r.roleId === inviteRoleId)?.roleName === 'Organization Admin' ? (
              <p className="text-[12px] text-amber-800 dark:text-amber-200">
                Only one active Organization Admin is allowed per tenant (including pending invitations).
              </p>
            ) : null}
            <Select value={inviteRoleId} onValueChange={onInviteRoleIdChange}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No role</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.roleId} value={role.roleId}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{role.roleName}</span>
                      {role.isSystemRole && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">System</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Personal message */}
          <div className="space-y-2">
            <Label htmlFor="invite-message" style={{ fontSize: 12, fontWeight: 500, color: 'var(--zk-muted)', fontFamily: 'var(--zk-font)' }}>
              Personal message <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--zk-muted-2)' }}>(optional)</span>
            </Label>
            <Textarea
              id="invite-message"
              placeholder="Add a personal note to the invitation..."
              rows={3}
              className="rounded-lg resize-none"
              value={inviteMessage}
              onChange={(e) => onInviteMessageChange(e.target.value)}
            />
          </div>

          <Separator />

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-lg"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-lg"
              style={{ background: 'var(--zk-navy)' }}
              onClick={onSubmit}
              disabled={isPending || !inviteEmail.trim()}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
