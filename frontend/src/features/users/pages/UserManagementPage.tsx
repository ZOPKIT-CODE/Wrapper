import { useState, useMemo, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Container } from '@/components/common/Page'
import {
  DashboardPageHeader,
  DASHBOARD_TABS_LIST_CLASS,
} from '@/components/dashboard/DashboardPageHeader'

import {
  useUsers,
  useUserDetail,
  useUserStats,
  useInvitations,
  useAvailableRoles,
  useUserRoles,
  useInviteUser,
  useUpdateUserStatus,
  useUpdateProfile,
  useRemoveUser,
  useAssignRole,
  useRemoveRoleAssignment,
  useRemoveOrganizationMembership,
  useResendInvitation,
  useCancelInvitation,
} from '../hooks/useUserManagement'

import { useOrganizationHierarchy } from '@/hooks/useOrganizationHierarchy'
import { useDashboardTabParam } from '@/hooks/useDashboardTabParam'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  TooltipProvider,
} from '@/components/ui/tooltip'
import { Users, UserPlus, Mail, Shield, CheckCircle, UserX } from 'lucide-react'

import {
  extractItems,
  extractPagination,
  extractStats,
  flattenHierarchy,
  UserRecord,
  InvitationRecord,
  RoleRecord,
  RoleAssignment,
  UserDetailRecord,
  FlatEntity,
  HierarchyEntity,
  MembershipRow,
} from '../components/userManagementTypes'

import { UserTable } from '../components/UserTable'
import { InvitationsTable } from '../components/InvitationsTable'
import { InviteUserModal } from '../components/InviteUserModal'
import { UserDetailSheet, AssignRoleSheet, RemoveUserDialog } from '../components/UserEditPanel'

// ---------------------------------------------------------------------------
// StatCard (local — only used in this page)
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number | undefined
  icon: React.ElementType
  color?: string
}) {
  return (
    <article
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '18px 20px',
        background: 'var(--zk-paper)',
        border: '1px solid var(--zk-line)',
        borderRadius: 12,
        boxShadow: '0 1px 4px rgba(15,32,80,0.05)',
      }}
    >
      <div style={{
        width: 44, height: 44, flexShrink: 0,
        display: 'grid', placeItems: 'center',
        borderRadius: 11,
        background: 'var(--zk-navy)',
      }}>
        <Icon style={{ width: 20, height: 20, color: '#ffffff' }} />
      </div>
      <div>
        <p style={{ fontSize: 13, color: 'var(--zk-muted)', fontFamily: 'var(--zk-font)', margin: 0 }}>
          {label}
        </p>
        {value !== undefined ? (
          <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--zk-ink)', fontFamily: 'var(--zk-display)', margin: 0 }}>
            {value}
          </p>
        ) : (
          <Skeleton className="mt-1 h-7 w-12" style={{ background: 'var(--zk-line)' }} />
        )}
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USERS_PAGE_TABS = ['members', 'invitations'] as const

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================

export default function UserManagementPage() {
  const [activeTab, setActiveTab] = useDashboardTabParam({
    allowed: USERS_PAGE_TABS,
    defaultTab: 'members',
  })

  // ---- State ----------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [invStatusFilter, setInvStatusFilter] = useState('all')
  const [invSearchQuery, setInvSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [invPage, setInvPage] = useState(1)

  // Sheets
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [roleSheetUserId, setRoleSheetUserId] = useState<string | null>(null)
  const [removeDialogUserId, setRemoveDialogUserId] = useState<string | null>(null)
  const [membershipRemoveTarget, setMembershipRemoveTarget] = useState<MembershipRow | null>(null)

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState('none')
  const [inviteEntityIds, setInviteEntityIds] = useState<string[]>([])
  const [inviteMessage, setInviteMessage] = useState('')

  // Role assignment form
  const [assignRoleId, setAssignRoleId] = useState('')
  const [assignIsTemporary, setAssignIsTemporary] = useState(false)
  const [assignExpiresAt, setAssignExpiresAt] = useState('')
  const [detailPhoneDraft, setDetailPhoneDraft] = useState('')
  const [detailFirstNameDraft, setDetailFirstNameDraft] = useState('')
  const [detailLastNameDraft, setDetailLastNameDraft] = useState('')

  // ---- Org hierarchy ----
  const { hierarchy: orgHierarchy } = useOrganizationHierarchy('current')
  const flatEntities = useMemo(() => flattenHierarchy(orgHierarchy as unknown as FlatEntity[]), [orgHierarchy])
  const hierarchyTree = useMemo(() => (orgHierarchy as HierarchyEntity[] | null) ?? [], [orgHierarchy])
  const inviteEntityIdSet = useMemo(() => new Set(inviteEntityIds), [inviteEntityIds])

  // ---- Query params --------------------------------------------------------
  const userParams = useMemo(
    () => ({
      search: searchQuery || undefined,
      status: statusFilter !== 'all' ? (statusFilter as 'active' | 'invited' | 'inactive') : undefined,
      page,
      limit: 20,
    }),
    [searchQuery, statusFilter, page],
  )

  const invParams = useMemo(
    () => ({
      search: invSearchQuery || undefined,
      status: invStatusFilter !== 'all'
        ? (invStatusFilter as 'pending' | 'accepted' | 'expired' | 'cancelled')
        : undefined,
      page: invPage,
      limit: 20,
    }),
    [invSearchQuery, invStatusFilter, invPage],
  )

  // ---- Data hooks ----------------------------------------------------------
  const { data: usersRaw, isLoading: usersLoading, error: usersError } = useUsers(userParams)
  const { data: statsRaw } = useUserStats()
  const { data: invitationsRaw, isLoading: invitationsLoading } = useInvitations(invParams)
  const { data: availableRoles } = useAvailableRoles()
  const { data: userDetail } = useUserDetail(selectedUserId)
  const { data: userRolesRaw } = useUserRoles(selectedUserId ?? roleSheetUserId)

  // ---- Normalize data -------------------------------------------------------
  const users = useMemo(() => extractItems<UserRecord>(usersRaw), [usersRaw])
  const usersPagination = useMemo(() => extractPagination(usersRaw, users.length), [usersRaw, users.length])
  const invitations = useMemo(() => extractItems<InvitationRecord>(invitationsRaw), [invitationsRaw])
  const invPagination = useMemo(() => extractPagination(invitationsRaw, invitations.length), [invitationsRaw, invitations.length])
  const roles = useMemo<RoleRecord[]>(() => extractItems<RoleRecord>(availableRoles), [availableRoles])
  const currentUserRoles = useMemo<RoleAssignment[]>(() => extractItems<RoleAssignment>(userRolesRaw), [userRolesRaw])
  const stats = useMemo(() => extractStats(statsRaw), [statsRaw])

  useEffect(() => {
    if (!selectedUserId) {
      setDetailPhoneDraft('')
      setDetailFirstNameDraft('')
      setDetailLastNameDraft('')
      setMembershipRemoveTarget(null)
      return
    }
    if (!userDetail) return
    const ud = userDetail as UserDetailRecord
    setDetailPhoneDraft(ud.phone ?? '')
    setDetailFirstNameDraft(ud.firstName ?? '')
    setDetailLastNameDraft(ud.lastName ?? '')
  }, [selectedUserId, userDetail])

  // ---- Mutations ------------------------------------------------------------
  const inviteUser = useInviteUser()
  const updateStatus = useUpdateUserStatus()
  const updateProfile = useUpdateProfile()
  const removeUser = useRemoveUser()
  const assignRole = useAssignRole()
  const removeRoleAssignment = useRemoveRoleAssignment()
  const removeOrganizationMembership = useRemoveOrganizationMembership()
  const resendInvitation = useResendInvitation()
  const cancelInvitation = useCancelInvitation()

  // ---- Handlers -------------------------------------------------------------
  const resetInviteForm = useCallback(() => {
    setInviteEmail('')
    setInviteRoleId('none')
    setInviteEntityIds([])
    setInviteMessage('')
  }, [])

  const toggleInviteEntity = useCallback((entityId: string) => {
    setInviteEntityIds((prev) =>
      prev.includes(entityId) ? prev.filter((id) => id !== entityId) : [...prev, entityId],
    )
  }, [])

  const handleInviteSubmit = useCallback(() => {
    if (!inviteEmail.trim()) { toast.error('Email is required'); return }

    const hasEntities = inviteEntityIds.length > 0
    const hasRole = inviteRoleId !== 'none'
    const targetEntities = hasEntities
      ? inviteEntityIds.map((id) => {
          const e = flatEntities.find((x) => x.entityId === id)
          return {
            entityId: id,
            entityType: e?.entityType ?? 'organization',
            ...(hasRole && inviteRoleId !== 'none' ? { roleId: inviteRoleId } : {}),
          }
        })
      : undefined

    inviteUser.mutate(
      {
        email: inviteEmail.trim(),
        roleId: hasRole && inviteRoleId !== 'none' ? inviteRoleId : undefined,
        targetEntities,
        message: inviteMessage.trim() || undefined,
      },
      {
        onSuccess: () => {
          setInviteSheetOpen(false)
          resetInviteForm()
        },
      },
    )
  }, [inviteEmail, inviteRoleId, inviteEntityIds, inviteMessage, inviteUser, flatEntities, resetInviteForm])

  const handleCloseInviteSheet = useCallback((open: boolean) => {
    if (!open) resetInviteForm()
    setInviteSheetOpen(open)
  }, [resetInviteForm])

  const resetAssignForm = useCallback(() => {
    setRoleSheetUserId(null)
    setAssignRoleId('')
    setAssignIsTemporary(false)
    setAssignExpiresAt('')
  }, [])

  const handleRoleAssign = useCallback(() => {
    if (!roleSheetUserId || !assignRoleId) { toast.error('Please select a role'); return }
    assignRole.mutate(
      {
        userId: roleSheetUserId,
        roleId: assignRoleId,
        isTemporary: assignIsTemporary || undefined,
        expiresAt: assignIsTemporary && assignExpiresAt ? assignExpiresAt : undefined,
      },
      { onSuccess: resetAssignForm },
    )
  }, [roleSheetUserId, assignRoleId, assignIsTemporary, assignExpiresAt, assignRole, resetAssignForm])

  const handleConfirmRemove = useCallback(() => {
    if (!removeDialogUserId) return
    removeUser.mutate(removeDialogUserId, {
      onSuccess: () => {
        setRemoveDialogUserId(null)
        if (selectedUserId === removeDialogUserId) setSelectedUserId(null)
      },
    })
  }, [removeDialogUserId, removeUser, selectedUserId])

  const handleCopyLink = useCallback(async (link?: string) => {
    if (!link) { toast.error('No invitation link available'); return }
    try { await navigator.clipboard.writeText(link); toast.success('Link copied to clipboard') } catch { toast.error('Failed to copy link') }
  }, [])

  // ---- Render ---------------------------------------------------------------
  return (
    <TooltipProvider>
      <Container>
        <DashboardPageHeader
          title="Team Members"
          description="Manage your team members, roles, and invitations."
          actions={(
            <Button
              onClick={() => setInviteSheetOpen(true)}
              className="gap-2 rounded-lg px-5 text-sm font-semibold shadow-sm"
              style={{ background: 'var(--zk-navy)' }}
            >
              <UserPlus className="h-4 w-4" />
              Invite Member
            </Button>
          )}
        />

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total Members" value={stats?.total} icon={Users} />
          <StatCard label="Active" value={stats?.active} icon={CheckCircle} />
          <StatCard label="Pending Invitations" value={stats?.invited} icon={Mail} />
          <StatCard label="Inactive" value={stats?.inactive} icon={UserX} />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={DASHBOARD_TABS_LIST_CLASS}>
            <TabsTrigger value="members" className="gap-1.5 data-[state=active]:shadow-sm" style={{ fontFamily: 'var(--zk-font)', fontSize: 13 }}>
              <Users className="h-4 w-4" /> Members
            </TabsTrigger>
            <TabsTrigger value="invitations" className="gap-1.5 data-[state=active]:shadow-sm" style={{ fontFamily: 'var(--zk-font)', fontSize: 13 }}>
              <Mail className="h-4 w-4" /> Invitations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-6">
            <UserTable
              users={users}
              usersLoading={usersLoading}
              usersError={usersError}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              page={usersPagination.page}
              totalPages={usersPagination.totalPages}
              total={usersPagination.total}
              onPageChange={setPage}
              onViewUser={(userId) => setSelectedUserId(userId)}
              onAssignRole={(userId) => setRoleSheetUserId(userId)}
              onToggleStatus={(userId, currentIsActive) =>
                updateStatus.mutate({ userId, isActive: currentIsActive === false })
              }
              onRemoveUser={(id) => setRemoveDialogUserId(id)}
            />
          </TabsContent>

          <TabsContent value="invitations" className="mt-6">
            <InvitationsTable
              invitations={invitations}
              invitationsLoading={invitationsLoading}
              searchQuery={invSearchQuery}
              onSearchChange={setInvSearchQuery}
              statusFilter={invStatusFilter}
              onStatusFilterChange={setInvStatusFilter}
              page={invPagination.page}
              totalPages={invPagination.totalPages}
              total={invPagination.total}
              onPageChange={setInvPage}
              onCopyLink={handleCopyLink}
              onResend={(id) => resendInvitation.mutate(id)}
              onCancel={(id) => cancelInvitation.mutate(id)}
              resendIsPending={resendInvitation.isPending}
              cancelIsPending={cancelInvitation.isPending}
            />
          </TabsContent>
        </Tabs>

        {/* Invite Sheet */}
        <InviteUserModal
          open={inviteSheetOpen}
          onOpenChange={handleCloseInviteSheet}
          inviteEmail={inviteEmail}
          onInviteEmailChange={setInviteEmail}
          inviteRoleId={inviteRoleId}
          onInviteRoleIdChange={setInviteRoleId}
          inviteEntityIds={inviteEntityIds}
          inviteEntityIdSet={inviteEntityIdSet}
          onToggleEntity={toggleInviteEntity}
          inviteMessage={inviteMessage}
          onInviteMessageChange={setInviteMessage}
          roles={roles}
          hierarchyTree={hierarchyTree}
          flatEntitiesCount={flatEntities.length}
          isPending={inviteUser.isPending}
          onSubmit={handleInviteSubmit}
        />

        {/* User Detail Sheet + Membership Remove Dialog */}
        <UserDetailSheet
          selectedUserId={selectedUserId}
          userDetail={userDetail}
          currentUserRoles={currentUserRoles}
          hierarchyTree={hierarchyTree}
          membershipRemoveTarget={membershipRemoveTarget}
          onSetMembershipRemoveTarget={setMembershipRemoveTarget}
          onCloseDetail={() => setSelectedUserId(null)}
          onOpenRoleSheet={(userId) => setRoleSheetUserId(userId)}
          onRequestRemoveUser={(userId) => setRemoveDialogUserId(userId)}
          onUpdateStatus={(userId, isActive) => updateStatus.mutate({ userId, isActive })}
          onUpdateProfile={(userId, data) => updateProfile.mutate({ userId, data })}
          onRemoveRoleAssignment={(userId, assignmentId) =>
            removeRoleAssignment.mutate({ userId, assignmentId })
          }
          onRemoveOrganizationMembership={(userId, membershipId) =>
            removeOrganizationMembership.mutate(
              { userId, membershipId },
              { onSuccess: () => setMembershipRemoveTarget(null) },
            )
          }
          updateProfileIsPending={updateProfile.isPending}
          updateStatusIsPending={updateStatus.isPending}
          removeRoleAssignmentIsPending={removeRoleAssignment.isPending}
          removeMembershipIsPending={removeOrganizationMembership.isPending}
          removingMembershipId={removeOrganizationMembership.variables?.membershipId ?? null}
          detailPhoneDraft={detailPhoneDraft}
          setDetailPhoneDraft={setDetailPhoneDraft}
          detailFirstNameDraft={detailFirstNameDraft}
          setDetailFirstNameDraft={setDetailFirstNameDraft}
          detailLastNameDraft={detailLastNameDraft}
          setDetailLastNameDraft={setDetailLastNameDraft}
        />

        {/* Assign Role Sheet */}
        <AssignRoleSheet
          roleSheetUserId={roleSheetUserId}
          roles={roles}
          assignRoleId={assignRoleId}
          onAssignRoleIdChange={setAssignRoleId}
          assignIsTemporary={assignIsTemporary}
          onAssignIsTemporaryChange={setAssignIsTemporary}
          assignExpiresAt={assignExpiresAt}
          onAssignExpiresAtChange={setAssignExpiresAt}
          onAssign={handleRoleAssign}
          onCancel={resetAssignForm}
          isPending={assignRole.isPending}
        />

        {/* Remove User Dialog */}
        <RemoveUserDialog
          removeDialogUserId={removeDialogUserId}
          onOpenChange={(open) => !open && setRemoveDialogUserId(null)}
          onConfirm={handleConfirmRemove}
          isPending={removeUser.isPending}
        />
      </Container>
    </TooltipProvider>
  )
}
