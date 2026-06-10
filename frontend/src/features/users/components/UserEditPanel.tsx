import { useMemo, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  Shield,
  UserPlus,
  Trash2,
  Clock,
  CheckCircle,
  UserX,
  Loader2,
  Building2,
} from 'lucide-react'
import {
  UserDetailRecord,
  RoleRecord,
  RoleAssignment,
  MembershipRow,
  HierarchyEntity,
  ENTITY_TYPE_LABELS,
  getUserInitials,
  displayName,
  relativeTime,
} from './userManagementTypes'

// ---------------------------------------------------------------------------
// MembershipHierarchyList (internal)
// ---------------------------------------------------------------------------

function MembershipHierarchyList({
  nodes,
  membershipByEntityId,
  depth = 0,
  onRequestRemoveMembership,
  removeMembershipPending,
  removingMembershipId,
}: {
  nodes: HierarchyEntity[]
  membershipByEntityId: Map<string, MembershipRow>
  depth?: number
  onRequestRemoveMembership?: (row: MembershipRow) => void
  removeMembershipPending?: boolean
  removingMembershipId?: string | null
}) {
  if (!nodes.length) return null
  return (
    <ul className="list-none space-y-1">
      {nodes.map((node) => {
        const m = membershipByEntityId.get(node.entityId)
        return (
          <li key={node.entityId} className="space-y-1">
            {m ? (
              <div
                className="bg-muted/30 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                style={{ marginLeft: `${depth * 14}px` }}
              >
                <div className="min-w-0 flex-1">
                  <span
                    className="font-medium"
                    style={{ color: 'var(--zk-ink)' }}
                  >
                    {m.entityName ?? node.entityName}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    {[
                      m.entityType,
                      m.accessLevel && m.accessLevel !== 'standard'
                        ? m.accessLevel
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                {onRequestRemoveMembership ? (
                  m.isPrimary ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground inline-flex shrink-0 cursor-not-allowed rounded-md p-1.5 opacity-50">
                          <Trash2 className="h-4 w-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        Primary organization cannot be removed here
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0 p-0"
                          disabled={
                            removeMembershipPending &&
                            removingMembershipId === m.membershipId
                          }
                          onClick={() => onRequestRemoveMembership(m)}
                          aria-label={`Remove ${m.entityName ?? 'organization'}`}
                        >
                          {removeMembershipPending &&
                          removingMembershipId === m.membershipId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        Remove from this organization
                      </TooltipContent>
                    </Tooltip>
                  )
                ) : null}
              </div>
            ) : null}
            {node.children && node.children.length > 0 ? (
              <MembershipHierarchyList
                nodes={node.children}
                membershipByEntityId={membershipByEntityId}
                depth={depth + 1}
                onRequestRemoveMembership={onRequestRemoveMembership}
                removeMembershipPending={removeMembershipPending}
                removingMembershipId={removingMembershipId}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// AssignedOrganizationsBlock (internal)
// ---------------------------------------------------------------------------

function AssignedOrganizationsBlock({
  memberships,
  hierarchyTree,
  onRequestRemoveMembership,
  removeMembershipPending,
  removingMembershipId,
}: {
  memberships: MembershipRow[]
  hierarchyTree: HierarchyEntity[]
  onRequestRemoveMembership?: (row: MembershipRow) => void
  removeMembershipPending?: boolean
  removingMembershipId?: string | null
}) {
  const membershipByEntityId = useMemo(() => {
    const m = new Map<string, MembershipRow>()
    for (const row of memberships) m.set(row.entityId, row)
    return m
  }, [memberships])

  const treeEntityIds = useMemo(() => {
    const ids = new Set<string>()
    function walk(nodes: HierarchyEntity[]) {
      for (const n of nodes) {
        ids.add(n.entityId)
        if (n.children?.length) walk(n.children)
      }
    }
    walk(hierarchyTree)
    return ids
  }, [hierarchyTree])

  const orphanMemberships = useMemo(
    () => memberships.filter((m) => !treeEntityIds.has(m.entityId)),
    [memberships, treeEntityIds]
  )

  return (
    <>
      <MembershipHierarchyList
        nodes={hierarchyTree}
        membershipByEntityId={membershipByEntityId}
        onRequestRemoveMembership={onRequestRemoveMembership}
        removeMembershipPending={removeMembershipPending}
        removingMembershipId={removingMembershipId}
      />
      {orphanMemberships.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-muted-foreground text-[12px] font-medium">Other</p>
          <ul className="space-y-2">
            {orphanMemberships.map((m) => (
              <li
                key={m.membershipId}
                className="bg-muted/20 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <span
                    className="font-medium"
                    style={{ color: 'var(--zk-ink)' }}
                  >
                    {m.entityName ?? 'Organization'}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    {[
                      m.entityType,
                      m.accessLevel && m.accessLevel !== 'standard'
                        ? m.accessLevel
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                {onRequestRemoveMembership ? (
                  m.isPrimary ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground inline-flex shrink-0 cursor-not-allowed rounded-md p-1.5 opacity-50">
                          <Trash2 className="h-4 w-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        Primary organization cannot be removed here
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0 p-0"
                          disabled={
                            removeMembershipPending &&
                            removingMembershipId === m.membershipId
                          }
                          onClick={() => onRequestRemoveMembership(m)}
                          aria-label={`Remove ${m.entityName ?? 'organization'}`}
                        >
                          {removeMembershipPending &&
                          removingMembershipId === m.membershipId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        Remove from this organization
                      </TooltipContent>
                    </Tooltip>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  )
}

// ---------------------------------------------------------------------------
// StatusBadge (internal)
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400',
    inactive:
      'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400',
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[11px] font-medium capitalize',
        styles[status] ?? styles.inactive
      )}
      style={{ fontFamily: 'var(--zk-font)' }}
    >
      {status}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// UserDetailSheet Props & Component
// ---------------------------------------------------------------------------

export interface UserDetailSheetProps {
  selectedUserId: string | null
  userDetail: unknown
  currentUserRoles: RoleAssignment[]
  hierarchyTree: HierarchyEntity[]
  membershipRemoveTarget: MembershipRow | null
  onSetMembershipRemoveTarget: (row: MembershipRow | null) => void
  onCloseDetail: () => void
  onOpenRoleSheet: (userId: string) => void
  onRequestRemoveUser: (userId: string) => void
  onUpdateStatus: (userId: string, isActive: boolean) => void
  onUpdateProfile: (
    userId: string,
    data: { firstName?: string; lastName?: string; phone?: string }
  ) => void
  onRemoveRoleAssignment: (userId: string, assignmentId: string) => void
  onRemoveOrganizationMembership: (userId: string, membershipId: string) => void
  onAddOrganizationMembership: (
    userId: string,
    data: {
      entityId: string
      accessLevel?: 'admin' | 'manager' | 'standard' | 'limited'
    }
  ) => void
  updateProfileIsPending: boolean
  updateStatusIsPending: boolean
  removeRoleAssignmentIsPending: boolean
  removeMembershipIsPending: boolean
  addMembershipIsPending: boolean
  removingMembershipId: string | null
  detailPhoneDraft: string
  setDetailPhoneDraft: (v: string) => void
  detailFirstNameDraft: string
  setDetailFirstNameDraft: (v: string) => void
  detailLastNameDraft: string
  setDetailLastNameDraft: (v: string) => void
}

export function UserDetailSheet({
  selectedUserId,
  userDetail,
  currentUserRoles,
  hierarchyTree,
  membershipRemoveTarget,
  onSetMembershipRemoveTarget,
  onCloseDetail,
  onOpenRoleSheet,
  onRequestRemoveUser,
  onUpdateStatus,
  onUpdateProfile,
  onRemoveRoleAssignment,
  onRemoveOrganizationMembership,
  onAddOrganizationMembership,
  updateProfileIsPending,
  updateStatusIsPending,
  removeRoleAssignmentIsPending,
  removeMembershipIsPending,
  addMembershipIsPending,
  removingMembershipId,
  detailPhoneDraft,
  setDetailPhoneDraft,
  detailFirstNameDraft,
  setDetailFirstNameDraft,
  detailLastNameDraft,
  setDetailLastNameDraft,
}: UserDetailSheetProps) {
  const [addOrgEntityId, setAddOrgEntityId] = useState('')
  const [addOrgAccessLevel, setAddOrgAccessLevel] = useState<
    'admin' | 'manager' | 'standard' | 'limited'
  >('standard')

  // Reset the add-organization form whenever a different user is opened
  useEffect(() => {
    setAddOrgEntityId('')
    setAddOrgAccessLevel('standard')
  }, [selectedUserId])

  // Organizations from the hierarchy the user is NOT already an active member of
  const memberEntityIds = useMemo(() => {
    const ud = userDetail as UserDetailRecord | null
    return new Set((ud?.memberships ?? []).map((m) => m.entityId))
  }, [userDetail])

  const availableOrgs = useMemo(() => {
    const flat: {
      entityId: string
      entityName: string
      entityType: string
      depth: number
    }[] = []
    const walk = (nodes: HierarchyEntity[], depth: number) => {
      for (const n of nodes) {
        if (!memberEntityIds.has(n.entityId)) {
          flat.push({
            entityId: n.entityId,
            entityName: n.entityName,
            entityType: n.entityType,
            depth,
          })
        }
        if (n.children?.length) walk(n.children, depth + 1)
      }
    }
    walk(hierarchyTree, 0)
    return flat
  }, [hierarchyTree, memberEntityIds])

  return (
    <>
      <Sheet
        open={!!selectedUserId}
        onOpenChange={(open) => !open && onCloseDetail()}
      >
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto px-6 pt-5 pb-10 sm:max-w-2xl sm:px-8 lg:max-w-3xl">
          <SheetHeader className="space-y-2 p-0 pr-12 pb-5 text-left sm:pr-14">
            <SheetTitle
              style={{
                fontFamily: 'var(--zk-display)',
                letterSpacing: '-0.025em',
                color: 'var(--zk-ink)',
                fontSize: 18,
              }}
            >
              User Details
            </SheetTitle>
            <SheetDescription
              style={{
                fontFamily: 'var(--zk-font)',
                color: 'var(--zk-muted)',
                fontSize: 13,
              }}
            >
              View and manage this team member.
            </SheetDescription>
          </SheetHeader>

          {selectedUserId && userDetail ? (
            (() => {
              const ud = userDetail as UserDetailRecord
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14">
                      <AvatarFallback
                        className="text-lg font-semibold text-white"
                        style={{ background: 'var(--zk-navy)' }}
                      >
                        {getUserInitials(ud)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3
                        className="text-lg font-bold"
                        style={{ color: 'var(--zk-ink)' }}
                      >
                        {displayName(ud)}
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {ud.email}
                      </p>
                      <div className="mt-1.5 flex gap-2">
                        <StatusBadge
                          status={ud.isActive !== false ? 'active' : 'inactive'}
                        />
                        {ud.isTenantAdmin && (
                          <Badge
                            variant="outline"
                            className="border-purple-200 bg-purple-50 text-[11px] font-medium text-purple-700"
                          >
                            Admin
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label
                          htmlFor="detail-first-name"
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: 'var(--zk-muted)',
                            fontFamily: 'var(--zk-font)',
                          }}
                        >
                          First name
                        </Label>
                        <Input
                          id="detail-first-name"
                          autoComplete="given-name"
                          placeholder="First name"
                          className="rounded-lg"
                          value={detailFirstNameDraft}
                          onChange={(e) =>
                            setDetailFirstNameDraft(e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="detail-last-name"
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: 'var(--zk-muted)',
                            fontFamily: 'var(--zk-font)',
                          }}
                        >
                          Last name
                        </Label>
                        <Input
                          id="detail-last-name"
                          autoComplete="family-name"
                          placeholder="Last name"
                          className="rounded-lg"
                          value={detailLastNameDraft}
                          onChange={(e) =>
                            setDetailLastNameDraft(e.target.value)
                          }
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full shrink-0 rounded-lg sm:w-auto"
                        disabled={
                          updateProfileIsPending ||
                          (detailFirstNameDraft.trim() ===
                            (ud.firstName ?? '').trim() &&
                            detailLastNameDraft.trim() ===
                              (ud.lastName ?? '').trim())
                        }
                        onClick={() => {
                          const fn = detailFirstNameDraft.trim()
                          const ln = detailLastNameDraft.trim()
                          const data: {
                            firstName?: string
                            lastName?: string
                          } = {}
                          if (fn) data.firstName = fn
                          if (ln) data.lastName = ln
                          if (Object.keys(data).length === 0) {
                            toast.error(
                              'Enter a first name or last name to save'
                            )
                            return
                          }
                          onUpdateProfile(selectedUserId, data)
                        }}
                      >
                        {updateProfileIsPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Save name
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="detail-phone"
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: 'var(--zk-muted)',
                          fontFamily: 'var(--zk-font)',
                        }}
                      >
                        Phone number
                      </Label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                          id="detail-phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="e.g. +1 555 123 4567"
                          className="rounded-lg sm:flex-1"
                          value={detailPhoneDraft}
                          onChange={(e) => setDetailPhoneDraft(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full shrink-0 rounded-lg sm:w-auto"
                          disabled={
                            updateProfileIsPending ||
                            detailPhoneDraft.trim() === (ud.phone ?? '').trim()
                          }
                          onClick={() =>
                            onUpdateProfile(selectedUserId, {
                              phone: detailPhoneDraft.trim(),
                            })
                          }
                        >
                          {updateProfileIsPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Save phone
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-muted-foreground text-[13px]">
                          Last Active
                        </p>
                        <p
                          className="font-medium"
                          style={{ color: 'var(--zk-ink)' }}
                        >
                          {relativeTime(ud.lastActiveAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[13px]">
                          Member Since
                        </p>
                        <p
                          className="font-medium"
                          style={{ color: 'var(--zk-ink)' }}
                        >
                          {ud.createdAt
                            ? new Date(ud.createdAt).toLocaleDateString(
                                undefined,
                                {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                }
                              )
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4
                      className="mb-3 flex items-center gap-2"
                      style={{
                        fontSize: 16,
                        fontFamily: 'var(--zk-display)',
                        fontWeight: 600,
                        letterSpacing: '-0.025em',
                        color: 'var(--zk-ink)',
                      }}
                    >
                      <Building2 className="h-4 w-4" /> Assigned organizations
                    </h4>
                    <p className="text-muted-foreground mb-2 text-[12px]">
                      Shown in hierarchy order; memberships match entities in
                      your org tree.
                    </p>

                    {/* Add organization */}
                    {availableOrgs.length > 0 ? (
                      <div className="bg-muted/20 mb-3 flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-end">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <Label
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: 'var(--zk-muted)',
                              fontFamily: 'var(--zk-font)',
                            }}
                          >
                            Organization
                          </Label>
                          <Select
                            value={addOrgEntityId}
                            onValueChange={setAddOrgEntityId}
                          >
                            <SelectTrigger className="rounded-lg">
                              <SelectValue placeholder="Select an organization" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableOrgs.map((o) => (
                                <SelectItem key={o.entityId} value={o.entityId}>
                                  <span className="flex items-center gap-2">
                                    <span
                                      className="font-medium"
                                      style={{
                                        paddingLeft: `${o.depth * 12}px`,
                                      }}
                                    >
                                      {o.entityName}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="px-1.5 py-0 text-[10px]"
                                    >
                                      {ENTITY_TYPE_LABELS[o.entityType] ??
                                        o.entityType}
                                    </Badge>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5 sm:w-36">
                          <Label
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: 'var(--zk-muted)',
                              fontFamily: 'var(--zk-font)',
                            }}
                          >
                            Access
                          </Label>
                          <Select
                            value={addOrgAccessLevel}
                            onValueChange={(v) =>
                              setAddOrgAccessLevel(
                                v as
                                  | 'admin'
                                  | 'manager'
                                  | 'standard'
                                  | 'limited'
                              )
                            }
                          >
                            <SelectTrigger className="rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">Standard</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="limited">Limited</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          className="shrink-0 rounded-lg"
                          style={{ background: 'var(--zk-navy)' }}
                          disabled={addMembershipIsPending || !addOrgEntityId}
                          onClick={() => {
                            if (!selectedUserId || !addOrgEntityId) return
                            onAddOrganizationMembership(selectedUserId, {
                              entityId: addOrgEntityId,
                              accessLevel: addOrgAccessLevel,
                            })
                            setAddOrgEntityId('')
                            setAddOrgAccessLevel('standard')
                          }}
                        >
                          {addMembershipIsPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <UserPlus className="mr-1 h-3 w-3" />
                          )}
                          Add
                        </Button>
                      </div>
                    ) : (
                      <p className="text-muted-foreground mb-3 rounded-lg border border-dashed px-3 py-2 text-[12px]">
                        No more organizations available to assign.
                      </p>
                    )}

                    {ud.memberships && ud.memberships.length > 0 ? (
                      <AssignedOrganizationsBlock
                        memberships={ud.memberships}
                        hierarchyTree={hierarchyTree}
                        onRequestRemoveMembership={(row) =>
                          onSetMembershipRemoveTarget(row)
                        }
                        removeMembershipPending={removeMembershipIsPending}
                        removingMembershipId={removingMembershipId}
                      />
                    ) : (
                      <p className="text-muted-foreground text-sm italic">
                        No organizations assigned yet.
                      </p>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h4
                        className="flex items-center gap-2"
                        style={{
                          fontSize: 16,
                          fontFamily: 'var(--zk-display)',
                          fontWeight: 600,
                          letterSpacing: '-0.025em',
                          color: 'var(--zk-ink)',
                        }}
                      >
                        <Shield className="h-4 w-4" /> Role Assignments
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={() => onOpenRoleSheet(selectedUserId)}
                      >
                        <UserPlus className="mr-1 h-3 w-3" /> Add Role
                      </Button>
                    </div>

                    {currentUserRoles.length === 0 ? (
                      <p className="text-muted-foreground text-sm italic">
                        No roles assigned.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {currentUserRoles.map((ra) => (
                          <div
                            key={ra.assignmentId ?? ra.id}
                            className="flex items-center justify-between rounded-lg border p-3"
                          >
                            <div className="min-w-0">
                              <p
                                className="truncate text-sm font-medium"
                                style={{ color: 'var(--zk-ink)' }}
                              >
                                {ra.roleName}
                              </p>
                              {ra.isTemporary && ra.expiresAt && (
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-600">
                                  <Clock className="h-3 w-3" /> Expires{' '}
                                  {relativeTime(ra.expiresAt)}
                                </p>
                              )}
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                                  disabled={removeRoleAssignmentIsPending}
                                  onClick={() =>
                                    onRemoveRoleAssignment(
                                      selectedUserId,
                                      (ra.assignmentId ?? ra.id)!
                                    )
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove role</TooltipContent>
                            </Tooltip>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2 rounded-lg"
                      onClick={() =>
                        onUpdateStatus(selectedUserId, ud.isActive === false)
                      }
                      disabled={updateStatusIsPending}
                    >
                      {ud.isActive !== false ? (
                        <>
                          <UserX className="h-4 w-4" /> Deactivate User
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" /> Activate User
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive/5 w-full justify-start gap-2 rounded-lg"
                      onClick={() => onRequestRemoveUser(selectedUserId)}
                    >
                      <Trash2 className="h-4 w-4" /> Remove from Team
                    </Button>
                  </div>
                </div>
              )
            })()
          ) : selectedUserId ? (
            <div className="space-y-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-60" />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Membership remove confirm dialog */}
      <AlertDialog
        open={!!membershipRemoveTarget}
        onOpenChange={(open) => !open && onSetMembershipRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle
              style={{
                fontFamily: 'var(--zk-display)',
                letterSpacing: '-0.025em',
                color: 'var(--zk-ink)',
                fontSize: 18,
              }}
            >
              Remove organization assignment?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {membershipRemoveTarget ? (
                <>
                  Remove{' '}
                  <span className="text-foreground font-medium">
                    {membershipRemoveTarget.entityName ?? 'this organization'}
                  </span>{' '}
                  from this user&apos;s access. They will no longer be a member
                  of that organization unless re-invited or reassigned.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="rounded-lg"
              disabled={removeMembershipIsPending}
              onClick={() => {
                if (!selectedUserId || !membershipRemoveTarget) return
                onRemoveOrganizationMembership(
                  selectedUserId,
                  membershipRemoveTarget.membershipId
                )
              }}
            >
              {removeMembershipIsPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Remove assignment
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// AssignRoleSheet Props & Component
// ---------------------------------------------------------------------------

export interface AssignRoleSheetProps {
  roleSheetUserId: string | null
  roles: RoleRecord[]
  assignRoleId: string
  onAssignRoleIdChange: (v: string) => void
  assignIsTemporary: boolean
  onAssignIsTemporaryChange: (v: boolean) => void
  assignExpiresAt: string
  onAssignExpiresAtChange: (v: string) => void
  onAssign: () => void
  onCancel: () => void
  isPending: boolean
}

export function AssignRoleSheet({
  roleSheetUserId,
  roles,
  assignRoleId,
  onAssignRoleIdChange,
  assignIsTemporary,
  onAssignIsTemporaryChange,
  assignExpiresAt,
  onAssignExpiresAtChange,
  onAssign,
  onCancel,
  isPending,
}: AssignRoleSheetProps) {
  return (
    <Sheet
      open={!!roleSheetUserId}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto px-6 pt-5 pb-10 sm:max-w-2xl sm:px-8 lg:max-w-3xl">
        <SheetHeader className="space-y-2 p-0 pr-12 pb-5 text-left sm:pr-14">
          <SheetTitle
            style={{
              fontFamily: 'var(--zk-display)',
              letterSpacing: '-0.025em',
              color: 'var(--zk-ink)',
              fontSize: 18,
            }}
          >
            Assign Role
          </SheetTitle>
          <SheetDescription
            style={{
              fontFamily: 'var(--zk-font)',
              color: 'var(--zk-muted)',
              fontSize: 13,
            }}
          >
            Roles apply across the whole tenant. Organization access is managed
            separately via memberships and invitations.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--zk-muted)',
                fontFamily: 'var(--zk-font)',
              }}
            >
              Role <span className="text-destructive">*</span>
            </Label>
            <Select value={assignRoleId} onValueChange={onAssignRoleIdChange}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.roleId} value={role.roleId}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{role.roleName}</span>
                      {role.isSystemRole && (
                        <Badge
                          variant="outline"
                          className="px-1.5 py-0 text-[10px]"
                        >
                          System
                        </Badge>
                      )}
                      {role.description && (
                        <span className="text-muted-foreground max-w-[140px] truncate text-xs">
                          — {role.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Temporary assignment</p>
              <p className="text-muted-foreground text-xs">
                Role expires after a set date
              </p>
            </div>
            <Switch
              checked={assignIsTemporary}
              onCheckedChange={onAssignIsTemporaryChange}
            />
          </div>

          {assignIsTemporary && (
            <div className="space-y-2">
              <Label
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--zk-muted)',
                  fontFamily: 'var(--zk-font)',
                }}
              >
                Expiry date
              </Label>
              <Input
                type="date"
                className="rounded-lg"
                value={assignExpiresAt}
                onChange={(e) => onAssignExpiresAtChange(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}

          <Separator />

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-lg"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-lg"
              style={{ background: 'var(--zk-navy)' }}
              onClick={onAssign}
              disabled={isPending || !assignRoleId}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Role
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// RemoveUserDialog Props & Component
// ---------------------------------------------------------------------------

export interface RemoveUserDialogProps {
  removeDialogUserId: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isPending: boolean
}

export function RemoveUserDialog({
  removeDialogUserId,
  onOpenChange,
  onConfirm,
  isPending,
}: RemoveUserDialogProps) {
  return (
    <AlertDialog
      open={!!removeDialogUserId}
      onOpenChange={(open) => !open && onOpenChange(false)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle
            style={{
              fontFamily: 'var(--zk-display)',
              letterSpacing: '-0.025em',
              color: 'var(--zk-ink)',
              fontSize: 18,
            }}
          >
            Remove team member?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {removeDialogUserId?.startsWith('inv_')
              ? 'This will cancel the invitation. The recipient will no longer be able to join using that invite link.'
              : 'This will permanently remove the user and all their role assignments and memberships. This action cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
