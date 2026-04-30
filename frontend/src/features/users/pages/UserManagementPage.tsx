import { useState, useMemo, useCallback, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
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

import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  MoreVertical,
  Search,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  XCircle,
  Copy,
  Clock,
  CheckCircle,
  UserX,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Building2,
  ExternalLink,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types for API responses — flexible to handle both old & new formats
// ---------------------------------------------------------------------------

interface UserRecord {
  userId: string
  name?: string
  firstName?: string
  lastName?: string
  email: string
  avatar?: string | null
  isActive?: boolean
  isTenantAdmin?: boolean
  department?: string
  title?: string
  phone?: string
  lastActiveAt?: string | null
  lastLoginAt?: string | null
  createdAt?: string
  // New service format: nested role object
  role?: { roleId: string; roleName: string; color?: string } | null
  // Old/flat format
  roleName?: string
  roleId?: string
  roleColor?: string
}

interface InvitationRecord {
  invitationId: string
  email: string
  roleName?: string
  roleColor?: string
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  invitedBy?: string
  inviterName?: string
  inviterEmail?: string
  expiresAt?: string
  createdAt?: string
  invitationLink?: string
  invitationScope?: string
}

interface RoleRecord {
  roleId: string
  roleName: string
  isSystemRole?: boolean
  description?: string
  color?: string
}

interface RoleAssignment {
  assignmentId?: string
  id?: string
  roleId: string
  roleName: string
  organizationId?: string | null
  organizationName?: string | null
  scope?: string
  isTemporary?: boolean
  expiresAt?: string
}

/** User detail payload from GET /users/:id (includes memberships) */
interface UserDetailRecord extends UserRecord {
  memberships?: Array<{
    membershipId: string
    entityId: string
    entityName?: string
    entityType?: string
    membershipStatus?: string
    accessLevel?: string
    /** When true, this membership cannot be removed via user management */
    isPrimary?: boolean
  }>
}

interface FlatEntity {
  entityId: string
  entityName: string
  entityType: string
  entityLevel: number
}

/** Nested entity tree from org hierarchy API (used for hierarchical selects) */
interface HierarchyEntity {
  entityId: string
  entityName: string
  entityType: string
  entityLevel: number
  children?: HierarchyEntity[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
  }
  return email ? email[0].toUpperCase() : '?'
}

function displayName(user: UserRecord): string {
  const parts = [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean)
  if (parts.length > 0) return parts.join(' ')
  if (user.name?.trim()) return user.name.trim()
  return user.email
}

function getUserInitials(user: UserRecord): string {
  const f = user.firstName?.trim()
  const l = user.lastName?.trim()
  if (f && l) return `${f[0] ?? ''}${l[0] ?? ''}`.toUpperCase()
  if (f) return f.slice(0, 2).toUpperCase()
  if (l) return l.slice(0, 2).toUpperCase()
  return getInitials(displayName(user), user.email)
}

function getUserRole(user: UserRecord): { name: string; color?: string } | null {
  if (user.role?.roleName) return { name: user.role.roleName, color: user.role.color }
  if (user.roleName) return { name: user.roleName, color: user.roleColor }
  return null
}

function relativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'Never'
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return 'Unknown'
  }
}

/** Safely extract an array of items from various API response shapes */
function extractItems<T>(raw: unknown): T[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as T[]
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.items)) return obj.items as T[]
    if (Array.isArray(obj.data)) return obj.data as T[]
  }
  return []
}

function extractPagination(raw: unknown, fallbackTotal: number) {
  if (!raw || Array.isArray(raw)) return { page: 1, totalPages: 1, total: fallbackTotal }
  const obj = raw as Record<string, unknown>
  return {
    page: Number(obj.page ?? 1),
    totalPages: Number(obj.totalPages ?? 1),
    total: Number(obj.total ?? fallbackTotal),
  }
}

function extractStats(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  return {
    total: Number(s.total ?? s.totalMembers ?? 0),
    active: Number(s.active ?? s.activeMembers ?? 0),
    invited: Number(s.invited ?? s.pendingInvitations ?? 0),
    inactive: Number(s.inactive ?? s.inactiveMembers ?? 0),
  }
}

/** Flatten nested entity hierarchy into a flat list for dropdowns (depth-first) */
function flattenHierarchy(entities: FlatEntity[] | null): FlatEntity[] {
  if (!entities) return []
  const result: FlatEntity[] = []
  function walk(items: FlatEntity[]) {
    for (const e of items) {
      result.push(e)
      if ((e as any).children?.length) walk((e as any).children)
    }
  }
  walk(entities)
  return result
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  organization: 'Org',
  location: 'Location',
  department: 'Dept',
  team: 'Team',
}

type MembershipRow = NonNullable<UserDetailRecord['memberships']>[number]

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
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                style={{ marginLeft: `${depth * 14}px` }}
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium" style={{ color: 'var(--zk-ink)' }}>
                    {m.entityName ?? node.entityName}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {[m.entityType, m.accessLevel && m.accessLevel !== 'standard' ? m.accessLevel : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                {onRequestRemoveMembership ? (
                  m.isPrimary ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex shrink-0 cursor-not-allowed rounded-md p-1.5 text-muted-foreground opacity-50">
                          <Trash2 className="h-4 w-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left">Primary organization cannot be removed here</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                          disabled={removeMembershipPending && removingMembershipId === m.membershipId}
                          onClick={() => onRequestRemoveMembership(m)}
                          aria-label={`Remove ${m.entityName ?? 'organization'}`}
                        >
                          {removeMembershipPending && removingMembershipId === m.membershipId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">Remove from this organization</TooltipContent>
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
    [memberships, treeEntityIds],
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
          <p className="text-[12px] font-medium text-muted-foreground">Other</p>
          <ul className="space-y-2">
            {orphanMemberships.map((m) => (
              <li
                key={m.membershipId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium" style={{ color: 'var(--zk-ink)' }}>
                    {m.entityName ?? 'Organization'}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {[m.entityType, m.accessLevel && m.accessLevel !== 'standard' ? m.accessLevel : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                {onRequestRemoveMembership ? (
                  m.isPrimary ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex shrink-0 cursor-not-allowed rounded-md p-1.5 text-muted-foreground opacity-50">
                          <Trash2 className="h-4 w-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left">Primary organization cannot be removed here</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                          disabled={removeMembershipPending && removingMembershipId === m.membershipId}
                          onClick={() => onRequestRemoveMembership(m)}
                          aria-label={`Remove ${m.entityName ?? 'organization'}`}
                        >
                          {removeMembershipPending && removingMembershipId === m.membershipId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">Remove from this organization</TooltipContent>
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
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400',
    inactive: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400',
    pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400',
    expired: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400',
    cancelled: 'border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500',
    accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400',
  }
  return (
    <Badge
      variant="outline"
      className={cn('capitalize font-medium text-[11px]', styles[status] ?? styles.inactive)}
      style={{ fontFamily: 'var(--zk-font)' }}
    >
      {status}
    </Badge>
  )
}

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

function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ borderRadius: 12, border: '1px solid var(--zk-line)', overflow: 'hidden' }}>
      <Table>
        <TableHeader>
          <TableRow style={{ background: 'var(--zk-bg-2)' }}>
            {Array.from({ length: cols }).map((_, i) => (
              <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, r) => (
            <TableRow key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <TableCell key={c}><Skeleton className="h-4 w-full" /></TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'var(--zk-bg-2)', border: '1px solid var(--zk-line)' }}
      >
        <Icon className="h-8 w-8" style={{ color: 'var(--zk-navy)' }} />
      </div>
      <h3 className="text-lg font-semibold" style={{ color: 'var(--zk-ink)', fontFamily: 'var(--zk-display)' }}>{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm" style={{ color: 'var(--zk-muted)' }}>{description}</p>
    </div>
  )
}

function PaginationControls({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  onPageChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between pt-2">
      <p style={{ fontSize: 12, fontFamily: 'var(--zk-mono)', color: 'var(--zk-muted)' }}>
        Page <span style={{ fontWeight: 600 }}>{page}</span> of{' '}
        <span style={{ fontWeight: 600 }}>{totalPages}</span>
        {' '}({total} total)
      </p>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

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

  // Invite form — "none" sentinel means no selection (empty string is invalid for Select)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState('none')
  /** Multiple orgs/locations; single role applies to all selected */
  const [inviteEntityIds, setInviteEntityIds] = useState<string[]>([])
  const [inviteMessage, setInviteMessage] = useState('')

  // Role assignment form
  const [assignRoleId, setAssignRoleId] = useState('')
  const [assignIsTemporary, setAssignIsTemporary] = useState(false)
  const [assignExpiresAt, setAssignExpiresAt] = useState('')
  const [detailPhoneDraft, setDetailPhoneDraft] = useState('')
  const [detailFirstNameDraft, setDetailFirstNameDraft] = useState('')
  const [detailLastNameDraft, setDetailLastNameDraft] = useState('')

  // ---- Org hierarchy — 'current' lets the backend derive tenantId from JWT ----
  const { hierarchy: orgHierarchy } = useOrganizationHierarchy('current')
  const flatEntities = useMemo(() => flattenHierarchy(orgHierarchy as unknown as FlatEntity[]), [orgHierarchy])
  const hierarchyTree = useMemo(() => (orgHierarchy as HierarchyEntity[] | null) ?? [], [orgHierarchy])
  const inviteEntityIdSet = useMemo(() => new Set(inviteEntityIds), [inviteEntityIds])

  // ---- Query params ---------------------------------------------------------
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

  // ---- Data hooks -----------------------------------------------------------
  const { data: usersRaw, isLoading: usersLoading, error: usersError } = useUsers(userParams)
  const { data: statsRaw } = useUserStats()
  const { data: invitationsRaw, isLoading: invitationsLoading } = useInvitations(invParams)
  const { data: availableRoles } = useAvailableRoles()
  const { data: userDetail } = useUserDetail(selectedUserId)
  const { data: userRolesRaw } = useUserRoles(selectedUserId ?? roleSheetUserId)

  // ---- Normalize data (handles both old flat format & new paginated format) --
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
        {/* ---- Header ---- */}
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

        {/* ---- Stats cards ---- */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total Members" value={stats?.total} icon={Users} />
          <StatCard label="Active" value={stats?.active} icon={CheckCircle} />
          <StatCard label="Pending Invitations" value={stats?.invited} icon={Mail} />
          <StatCard label="Inactive" value={stats?.inactive} icon={UserX} />
        </div>

        {/* ---- Tabs ---- */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={DASHBOARD_TABS_LIST_CLASS}>
            <TabsTrigger value="members" className="gap-1.5 data-[state=active]:shadow-sm" style={{ fontFamily: 'var(--zk-font)', fontSize: 13 }}>
              <Users className="h-4 w-4" /> Members
            </TabsTrigger>
            <TabsTrigger value="invitations" className="gap-1.5 data-[state=active]:shadow-sm" style={{ fontFamily: 'var(--zk-font)', fontSize: 13 }}>
              <Mail className="h-4 w-4" /> Invitations
            </TabsTrigger>
          </TabsList>

          {/* ======== MEMBERS TAB ======== */}
          <TabsContent value="members" className="mt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  className="pl-9 rounded-lg"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
                <SelectTrigger className="w-full sm:w-[160px] rounded-lg">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {usersLoading ? (
              <TableSkeleton rows={5} cols={8} />
            ) : usersError ? (
              <EmptyState icon={UserX} title="Failed to load members" description="Something went wrong. Please try refreshing the page." />
            ) : users.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No members found"
                description={searchQuery || statusFilter !== 'all' ? 'Try adjusting your search or filter criteria.' : 'Invite your first team member to get started.'}
              />
            ) : (
              <>
                <div style={{ borderRadius: 12, border: '1px solid var(--zk-line)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(15,32,80,0.05)' }}>
                  <Table>
                    <TableHeader>
                      <TableRow style={{ background: 'var(--zk-bg-2)' }}>
                        <TableHead className="w-[240px] min-w-[180px]" style={{ fontSize: 11, fontFamily: 'var(--zk-mono)', fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--zk-muted-2)' }}>User</TableHead>
                        <TableHead className="hidden md:table-cell" style={{ fontSize: 11, fontFamily: 'var(--zk-mono)', fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--zk-muted-2)' }}>First name</TableHead>
                        <TableHead className="hidden md:table-cell" style={{ fontSize: 11, fontFamily: 'var(--zk-mono)', fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--zk-muted-2)' }}>Last name</TableHead>
                        <TableHead style={{ fontSize: 11, fontFamily: 'var(--zk-mono)', fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--zk-muted-2)' }}>Role</TableHead>
                        <TableHead style={{ fontSize: 11, fontFamily: 'var(--zk-mono)', fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--zk-muted-2)' }}>Status</TableHead>
                        <TableHead className="hidden md:table-cell" style={{ fontSize: 11, fontFamily: 'var(--zk-mono)', fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--zk-muted-2)' }}>Department</TableHead>
                        <TableHead className="hidden lg:table-cell" style={{ fontSize: 11, fontFamily: 'var(--zk-mono)', fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--zk-muted-2)' }}>Last Active</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => {
                        const role = getUserRole(user)
                        return (
                          <TableRow key={user.userId} className="group">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 shrink-0">
                                  <AvatarFallback
                                    className="text-xs font-semibold text-white"
                                    style={{ background: 'var(--zk-navy)' }}
                                  >
                                    {getUserInitials(user)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="truncate" style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--zk-font)', color: 'var(--zk-ink)' }}>
                                    {displayName(user)}
                                  </p>
                                  <p className="truncate" style={{ fontSize: 12, color: 'var(--zk-muted-2)', fontFamily: 'var(--zk-font)' }}>{user.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell" style={{ fontSize: 13, color: 'var(--zk-muted)', fontFamily: 'var(--zk-font)' }}>
                              {user.firstName?.trim() || '—'}
                            </TableCell>
                            <TableCell className="hidden md:table-cell" style={{ fontSize: 13, color: 'var(--zk-muted)', fontFamily: 'var(--zk-font)' }}>
                              {user.lastName?.trim() || '—'}
                            </TableCell>
                            <TableCell>
                              {user.isTenantAdmin ? (
                                <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 font-medium text-[11px]">Admin</Badge>
                              ) : role ? (
                                <Badge variant="outline" className="font-medium text-[11px]" style={role.color ? { borderColor: role.color + '40', backgroundColor: role.color + '10', color: role.color } : undefined}>
                                  {role.name}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">No role</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={user.isActive !== false ? 'active' : 'inactive'} />
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span style={{ fontSize: 13, color: 'var(--zk-muted)', fontFamily: 'var(--zk-font)' }}>{user.department || '-'}</span>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center gap-1" style={{ fontSize: 11, fontFamily: 'var(--zk-mono)', color: 'var(--zk-muted-2)' }}>
                                    <Clock className="h-3 w-3" />
                                    {relativeTime(user.lastActiveAt)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : 'Never active'}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100">
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">Actions</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="z-50">
                                  <DropdownMenuItem onClick={() => setSelectedUserId(user.userId)}>
                                    <Eye className="mr-2 h-4 w-4" /> View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setRoleSheetUserId(user.userId)}>
                                    <Edit className="mr-2 h-4 w-4" /> Assign Role
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => updateStatus.mutate({ userId: user.userId, isActive: user.isActive === false })}
                                  >
                                    {user.isActive !== false ? (
                                      <><UserX className="mr-2 h-4 w-4" /> Deactivate</>
                                    ) : (
                                      <><CheckCircle className="mr-2 h-4 w-4" /> Activate</>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setRemoveDialogUserId(user.userId)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls page={usersPagination.page} totalPages={usersPagination.totalPages} total={usersPagination.total} onPageChange={setPage} />
              </>
            )}
          </TabsContent>

          {/* ======== INVITATIONS TAB ======== */}
          <TabsContent value="invitations" className="mt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search by email..." className="pl-9 rounded-lg" value={invSearchQuery} onChange={(e) => { setInvSearchQuery(e.target.value); setInvPage(1) }} />
              </div>
              <Select value={invStatusFilter} onValueChange={(v) => { setInvStatusFilter(v); setInvPage(1) }}>
                <SelectTrigger className="w-full sm:w-[160px] rounded-lg"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {invitationsLoading ? (
              <TableSkeleton rows={4} cols={7} />
            ) : invitations.length === 0 ? (
              <EmptyState
                icon={Mail}
                title="No invitations found"
                description={invSearchQuery || invStatusFilter !== 'all' ? 'Try adjusting your search or filter criteria.' : 'Invite team members to see their invitations here.'}
              />
            ) : (
              <>
                <div style={{ borderRadius: 12, border: '1px solid var(--zk-line)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(15,32,80,0.05)' }}>
                  <Table>
                    <TableHeader>
                      <TableRow style={{ background: 'var(--zk-bg-2)' }}>
                        <TableHead className="w-[260px]" style={{ fontSize: 11, fontFamily: 'var(--zk-mono)', fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--zk-muted-2)' }}>Email</TableHead>
                        <TableHead style={{ fontSize: 11, fontFamily: 'var(--zk-mono)', fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--zk-muted-2)' }}>Role</TableHead>
                        <TableHead style={{ fontSize: 11, fontFamily: 'var(--zk-mono)', fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--zk-muted-2)' }}>Status</TableHead>
                        <TableHead className="min-w-[180px] max-w-[min(100%,22rem)] xl:min-w-[220px]" style={{ fontSize: 11, fontFamily: 'var(--zk-mono)', fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--zk-muted-2)' }}>Invitation URL</TableHead>
                        <TableHead className="hidden md:table-cell" style={{ fontSize: 11, fontFamily: 'var(--zk-mono)', fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--zk-muted-2)' }}>Invited By</TableHead>
                        <TableHead className="hidden lg:table-cell" style={{ fontSize: 11, fontFamily: 'var(--zk-mono)', fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--zk-muted-2)' }}>Expires</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((inv) => {
                        const isExpired = inv.status === 'expired' || (inv.expiresAt && new Date(inv.expiresAt) < new Date())
                        const isPending = inv.status === 'pending' && !isExpired
                        return (
                          <TableRow key={inv.invitationId} className="group">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--zk-bg-2)' }}>
                                  <Mail className="h-4 w-4" style={{ color: 'var(--zk-navy)' }} />
                                </div>
                                <span className="truncate" style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--zk-font)', color: 'var(--zk-ink)' }}>{inv.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {inv.roleName ? (
                                <Badge variant="outline" className="font-medium text-[11px]">{inv.roleName}</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Default</span>
                              )}
                            </TableCell>
                            <TableCell><StatusBadge status={isExpired ? 'expired' : inv.status} /></TableCell>
                            <TableCell className="max-w-[min(100vw-8rem,22rem)] py-3">
                              {inv.invitationLink ? (
                                <div className="flex min-w-0 items-center gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] leading-snug text-muted-foreground">
                                        {inv.invitationLink}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-sm break-all text-xs">
                                      {inv.invitationLink}
                                    </TooltipContent>
                                  </Tooltip>
                                  <div className="flex shrink-0 items-center gap-0.5">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleCopyLink(inv.invitationLink)}
                                      aria-label="Copy invitation URL"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      asChild
                                    >
                                      <a href={inv.invitationLink} target="_blank" rel="noopener noreferrer" aria-label="Open invitation URL">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span style={{ fontSize: 13, color: 'var(--zk-muted)', fontFamily: 'var(--zk-font)' }}>{inv.inviterName || inv.inviterEmail || inv.invitedBy || '-'}</span>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {inv.expiresAt ? (
                                <span style={{ fontSize: 11, fontFamily: 'var(--zk-mono)', fontWeight: isExpired ? 600 : 400, color: isExpired ? 'rgb(220 38 38)' : 'var(--zk-muted-2)' }}>
                                  {isExpired ? 'Expired' : relativeTime(inv.expiresAt)}
                                </span>
                              ) : <span style={{ fontSize: 11, fontFamily: 'var(--zk-mono)', color: 'var(--zk-muted-2)' }}>-</span>}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100">
                                    <MoreVertical className="h-4 w-4" /><span className="sr-only">Actions</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="z-50">
                                  {(isPending || isExpired) && (
                                    <DropdownMenuItem disabled={resendInvitation.isPending} onClick={() => resendInvitation.mutate(inv.invitationId)}>
                                      <RefreshCw className="mr-2 h-4 w-4" /> Resend
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleCopyLink(inv.invitationLink)}>
                                    <Copy className="mr-2 h-4 w-4" /> Copy Link
                                  </DropdownMenuItem>
                                  {isPending && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive focus:text-destructive" disabled={cancelInvitation.isPending} onClick={() => cancelInvitation.mutate(inv.invitationId)}>
                                        <XCircle className="mr-2 h-4 w-4" /> Cancel
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls page={invPagination.page} totalPages={invPagination.totalPages} total={invPagination.total} onPageChange={setInvPage} />
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* ================================================================== */}
        {/* INVITE MEMBER SHEET                                                */}
        {/* ================================================================== */}
        <Sheet open={inviteSheetOpen} onOpenChange={handleCloseInviteSheet}>
          <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto px-6 pb-10 pt-5 sm:max-w-xl sm:px-8">
            <SheetHeader className="space-y-2 p-0 pb-5 pr-12 text-left sm:pr-14">
              <SheetTitle style={{ fontFamily: 'var(--zk-display)', letterSpacing: '-0.025em', color: 'var(--zk-ink)', fontSize: 18 }}>Invite Team Member</SheetTitle>
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
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              {/* Organizations — hierarchical multi-select */}
              <div className="space-y-2">
                <Label style={{ fontSize: 12, fontWeight: 500, color: 'var(--zk-muted)', fontFamily: 'var(--zk-font)' }}>
                  Organizations <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--zk-muted-2)' }}>(optional, multi-select)</span>
                </Label>
                <p className="text-[12px] text-muted-foreground">
                  Check all orgs/locations this invite applies to. Child items are indented under their parent.
                </p>
                {flatEntities.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">No organizations found in hierarchy.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-lg border bg-muted/20 px-2 py-2">
                    <EntityHierarchyOrgCheckboxes
                      nodes={hierarchyTree}
                      depth={0}
                      selectedIds={inviteEntityIdSet}
                      onToggle={toggleInviteEntity}
                    />
                  </div>
                )}
                {inviteEntityIds.length > 0 ? (
                  <p className="text-[12px] text-muted-foreground">
                    {inviteEntityIds.length} organization{inviteEntityIds.length === 1 ? '' : 's'} selected
                  </p>
                ) : null}
              </div>

              {/* Role — single */}
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
                <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
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
                  onChange={(e) => setInviteMessage(e.target.value)}
                />
              </div>

              <Separator />

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-lg"
                  onClick={() => handleCloseInviteSheet(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-lg"
                  style={{ background: 'var(--zk-navy)' }}
                  onClick={handleInviteSubmit}
                  disabled={inviteUser.isPending || !inviteEmail.trim()}
                >
                  {inviteUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Invitation
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* ================================================================== */}
        {/* USER DETAIL SHEET                                                  */}
        {/* ================================================================== */}
        <Sheet open={!!selectedUserId} onOpenChange={(open) => !open && setSelectedUserId(null)}>
          <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto px-6 pb-10 pt-5 sm:max-w-2xl sm:px-8 lg:max-w-3xl">
            <SheetHeader className="space-y-2 p-0 pb-5 pr-12 text-left sm:pr-14">
              <SheetTitle style={{ fontFamily: 'var(--zk-display)', letterSpacing: '-0.025em', color: 'var(--zk-ink)', fontSize: 18 }}>User Details</SheetTitle>
              <SheetDescription style={{ fontFamily: 'var(--zk-font)', color: 'var(--zk-muted)', fontSize: 13 }}>View and manage this team member.</SheetDescription>
            </SheetHeader>

            {selectedUserId && userDetail ? (() => {
              const ud = userDetail as UserDetailRecord
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14">
                      <AvatarFallback className="text-lg font-semibold text-white" style={{ background: 'var(--zk-navy)' }}>
                        {getUserInitials(ud)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: 'var(--zk-ink)' }}>{displayName(ud)}</h3>
                      <p className="text-sm text-muted-foreground">{ud.email}</p>
                      <div className="mt-1.5 flex gap-2">
                        <StatusBadge status={ud.isActive !== false ? 'active' : 'inactive'} />
                        {ud.isTenantAdmin && <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 font-medium text-[11px]">Admin</Badge>}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="detail-first-name" style={{ fontSize: 12, fontWeight: 500, color: 'var(--zk-muted)', fontFamily: 'var(--zk-font)' }}>
                          First name
                        </Label>
                        <Input
                          id="detail-first-name"
                          autoComplete="given-name"
                          placeholder="First name"
                          className="rounded-lg"
                          value={detailFirstNameDraft}
                          onChange={(e) => setDetailFirstNameDraft(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="detail-last-name" style={{ fontSize: 12, fontWeight: 500, color: 'var(--zk-muted)', fontFamily: 'var(--zk-font)' }}>
                          Last name
                        </Label>
                        <Input
                          id="detail-last-name"
                          autoComplete="family-name"
                          placeholder="Last name"
                          className="rounded-lg"
                          value={detailLastNameDraft}
                          onChange={(e) => setDetailLastNameDraft(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full shrink-0 rounded-lg sm:w-auto"
                        disabled={
                          updateProfile.isPending
                          || (
                            detailFirstNameDraft.trim() === (ud.firstName ?? '').trim()
                            && detailLastNameDraft.trim() === (ud.lastName ?? '').trim()
                          )
                        }
                        onClick={() => {
                          if (!selectedUserId) return
                          const fn = detailFirstNameDraft.trim()
                          const ln = detailLastNameDraft.trim()
                          const data: { firstName?: string; lastName?: string } = {}
                          if (fn) data.firstName = fn
                          if (ln) data.lastName = ln
                          if (Object.keys(data).length === 0) {
                            toast.error('Enter a first name or last name to save')
                            return
                          }
                          updateProfile.mutate({ userId: selectedUserId, data })
                        }}
                      >
                        {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save name
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="detail-phone" style={{ fontSize: 12, fontWeight: 500, color: 'var(--zk-muted)', fontFamily: 'var(--zk-font)' }}>
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
                            updateProfile.isPending
                            || detailPhoneDraft.trim() === (ud.phone ?? '').trim()
                          }
                          onClick={() => {
                            if (!selectedUserId) return
                            updateProfile.mutate({
                              userId: selectedUserId,
                              data: { phone: detailPhoneDraft.trim() },
                            })
                          }}
                        >
                          {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Save phone
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-muted-foreground text-[13px]">Last Active</p>
                        <p className="font-medium" style={{ color: 'var(--zk-ink)' }}>{relativeTime(ud.lastActiveAt)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[13px]">Member Since</p>
                        <p className="font-medium" style={{ color: 'var(--zk-ink)' }}>
                          {ud.createdAt ? new Date(ud.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {ud.memberships && ud.memberships.length > 0 && (
                    <>
                      <div>
                        <h4 className="mb-3 flex items-center gap-2" style={{ fontSize: 16, fontFamily: 'var(--zk-display)', fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--zk-ink)' }}>
                          <Building2 className="h-4 w-4" /> Assigned organizations
                        </h4>
                        <p className="mb-2 text-[12px] text-muted-foreground">
                          Shown in hierarchy order; memberships match entities in your org tree.
                        </p>
                        <AssignedOrganizationsBlock
                          memberships={ud.memberships}
                          hierarchyTree={hierarchyTree}
                          onRequestRemoveMembership={(row) => setMembershipRemoveTarget(row)}
                          removeMembershipPending={removeOrganizationMembership.isPending}
                          removingMembershipId={removeOrganizationMembership.variables?.membershipId ?? null}
                        />
                      </div>
                      <Separator />
                    </>
                  )}

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="flex items-center gap-2" style={{ fontSize: 16, fontFamily: 'var(--zk-display)', fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--zk-ink)' }}>
                        <Shield className="h-4 w-4" /> Role Assignments
                      </h4>
                      <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setRoleSheetUserId(selectedUserId)}>
                        <UserPlus className="mr-1 h-3 w-3" /> Add Role
                      </Button>
                    </div>

                    {currentUserRoles.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No roles assigned.</p>
                    ) : (
                      <div className="space-y-2">
                        {currentUserRoles.map((ra) => (
                          <div key={ra.assignmentId ?? ra.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium" style={{ color: 'var(--zk-ink)' }}>{ra.roleName}</p>
                              {ra.isTemporary && ra.expiresAt && (
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-600">
                                  <Clock className="h-3 w-3" /> Expires {relativeTime(ra.expiresAt)}
                                </p>
                              )}
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  disabled={removeRoleAssignment.isPending}
                                  onClick={() => removeRoleAssignment.mutate({ userId: selectedUserId!, assignmentId: (ra.assignmentId ?? ra.id)! })}
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
                      className="w-full rounded-lg justify-start gap-2"
                      onClick={() => updateStatus.mutate({ userId: selectedUserId!, isActive: ud.isActive === false })}
                      disabled={updateStatus.isPending}
                    >
                      {ud.isActive !== false ? <><UserX className="h-4 w-4" /> Deactivate User</> : <><CheckCircle className="h-4 w-4" /> Activate User</>}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full rounded-lg justify-start gap-2 border-destructive/30 text-destructive hover:bg-destructive/5"
                      onClick={() => setRemoveDialogUserId(selectedUserId!)}
                    >
                      <Trash2 className="h-4 w-4" /> Remove from Team
                    </Button>
                  </div>
                </div>
              )
            })() : selectedUserId ? (
              <div className="space-y-4">
                <Skeleton className="h-14 w-14 rounded-full" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-60" />
              </div>
            ) : null}
          </SheetContent>
        </Sheet>

        {/* ================================================================== */}
        {/* ASSIGN ROLE SHEET                                                  */}
        {/* ================================================================== */}
        <Sheet
          open={!!roleSheetUserId}
          onOpenChange={(open) => { if (!open) resetAssignForm() }}
        >
          <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto px-6 pb-10 pt-5 sm:max-w-2xl sm:px-8 lg:max-w-3xl">
            <SheetHeader className="space-y-2 p-0 pb-5 pr-12 text-left sm:pr-14">
              <SheetTitle style={{ fontFamily: 'var(--zk-display)', letterSpacing: '-0.025em', color: 'var(--zk-ink)', fontSize: 18 }}>Assign Role</SheetTitle>
              <SheetDescription style={{ fontFamily: 'var(--zk-font)', color: 'var(--zk-muted)', fontSize: 13 }}>
                Roles apply across the whole tenant. Organization access is managed separately via memberships and invitations.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5">
              {/* Role selector */}
              <div className="space-y-2">
                <Label style={{ fontSize: 12, fontWeight: 500, color: 'var(--zk-muted)', fontFamily: 'var(--zk-font)' }}>Role <span className="text-destructive">*</span></Label>
                <Select value={assignRoleId} onValueChange={setAssignRoleId}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.roleId} value={role.roleId}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{role.roleName}</span>
                          {role.isSystemRole && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">System</Badge>
                          )}
                          {role.description && (
                            <span className="text-xs text-muted-foreground truncate max-w-[140px]">— {role.description}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Temporary toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">Temporary assignment</p>
                  <p className="text-xs text-muted-foreground">Role expires after a set date</p>
                </div>
                <Switch checked={assignIsTemporary} onCheckedChange={setAssignIsTemporary} />
              </div>

              {assignIsTemporary && (
                <div className="space-y-2">
                  <Label style={{ fontSize: 12, fontWeight: 500, color: 'var(--zk-muted)', fontFamily: 'var(--zk-font)' }}>Expiry date</Label>
                  <Input
                    type="date"
                    className="rounded-lg"
                    value={assignExpiresAt}
                    onChange={(e) => setAssignExpiresAt(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}

              <Separator />

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-lg" onClick={resetAssignForm}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-lg"
                  style={{ background: 'var(--zk-navy)' }}
                  onClick={handleRoleAssign}
                  disabled={assignRole.isPending || !assignRoleId}
                >
                  {assignRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Assign Role
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* ================================================================== */}
        {/* CONFIRM REMOVE DIALOG                                              */}
        {/* ================================================================== */}
        <AlertDialog open={!!removeDialogUserId} onOpenChange={(open) => !open && setRemoveDialogUserId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle style={{ fontFamily: 'var(--zk-display)', letterSpacing: '-0.025em', color: 'var(--zk-ink)', fontSize: 18 }}>Remove team member?</AlertDialogTitle>
              <AlertDialogDescription>
                This will deactivate the user and remove all their role assignments and memberships. This action cannot be easily undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleConfirmRemove}
                disabled={removeUser.isPending}
              >
                {removeUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!membershipRemoveTarget} onOpenChange={(open) => !open && setMembershipRemoveTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle style={{ fontFamily: 'var(--zk-display)', letterSpacing: '-0.025em', color: 'var(--zk-ink)', fontSize: 18 }}>Remove organization assignment?</AlertDialogTitle>
              <AlertDialogDescription>
                {membershipRemoveTarget ? (
                  <>
                    Remove <span className="font-medium text-foreground">{membershipRemoveTarget.entityName ?? 'this organization'}</span> from this user&apos;s access.
                    They will no longer be a member of that organization unless re-invited or reassigned.
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
                disabled={removeOrganizationMembership.isPending}
                onClick={() => {
                  if (!selectedUserId || !membershipRemoveTarget) return
                  removeOrganizationMembership.mutate(
                    { userId: selectedUserId, membershipId: membershipRemoveTarget.membershipId },
                    { onSuccess: () => setMembershipRemoveTarget(null) },
                  )
                }}
              >
                {removeOrganizationMembership.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Remove assignment
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Container>
    </TooltipProvider>
  )
}
