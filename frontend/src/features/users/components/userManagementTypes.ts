import { formatDistanceToNow } from 'date-fns'

// ---------------------------------------------------------------------------
// Types for API responses
// ---------------------------------------------------------------------------

export interface UserRecord {
  userId?: string
  invitationId?: string
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
  role?: { roleId: string; roleName: string; color?: string } | null
  roleName?: string
  roleId?: string
  roleColor?: string
}

export interface InvitationRecord {
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

export interface RoleRecord {
  roleId: string
  roleName: string
  isSystemRole?: boolean
  description?: string
  color?: string
}

export interface RoleAssignment {
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

export interface UserDetailRecord extends UserRecord {
  memberships?: Array<{
    membershipId: string
    entityId: string
    entityName?: string
    entityType?: string
    membershipStatus?: string
    accessLevel?: string
    isPrimary?: boolean
  }>
}

export interface FlatEntity {
  entityId: string
  entityName: string
  entityType: string
  entityLevel: number
}

export interface HierarchyEntity {
  entityId: string
  entityName: string
  entityType: string
  entityLevel: number
  children?: HierarchyEntity[]
}

export type MembershipRow = NonNullable<UserDetailRecord['memberships']>[number]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('')
  }
  return email ? email[0].toUpperCase() : '?'
}

export function displayName(user: UserRecord): string {
  const parts = [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean)
  if (parts.length > 0) return parts.join(' ')
  if (user.name?.trim()) return user.name.trim()
  return user.email
}

export function getUserInitials(user: UserRecord): string {
  const f = user.firstName?.trim()
  const l = user.lastName?.trim()
  if (f && l) return `${f[0] ?? ''}${l[0] ?? ''}`.toUpperCase()
  if (f) return f.slice(0, 2).toUpperCase()
  if (l) return l.slice(0, 2).toUpperCase()
  return getInitials(displayName(user), user.email)
}

export function getUserRole(
  user: UserRecord
): { name: string; color?: string } | null {
  if (user.role?.roleName)
    return { name: user.role.roleName, color: user.role.color }
  if (user.roleName) return { name: user.roleName, color: user.roleColor }
  return null
}

export function relativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'Never'
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return 'Unknown'
  }
}

export function extractItems<T>(raw: unknown): T[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as T[]
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.items)) return obj.items as T[]
    if (Array.isArray(obj.data)) return obj.data as T[]
  }
  return []
}

export function extractPagination(raw: unknown, fallbackTotal: number) {
  if (!raw || Array.isArray(raw))
    return { page: 1, totalPages: 1, total: fallbackTotal }
  const obj = raw as Record<string, unknown>
  return {
    page: Number(obj.page ?? 1),
    totalPages: Number(obj.totalPages ?? 1),
    total: Number(obj.total ?? fallbackTotal),
  }
}

export function extractStats(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  return {
    total: Number(s.total ?? s.totalMembers ?? 0),
    active: Number(s.active ?? s.activeMembers ?? 0),
    invited: Number(s.invited ?? s.pendingInvitations ?? 0),
    inactive: Number(s.inactive ?? s.inactiveMembers ?? 0),
  }
}

export function flattenHierarchy(entities: FlatEntity[] | null): FlatEntity[] {
  if (!entities) return []
  const result: FlatEntity[] = []
  type NestedEntity = FlatEntity & { children?: FlatEntity[] }
  function walk(items: FlatEntity[]) {
    for (const e of items) {
      result.push(e)
      const children = (e as NestedEntity).children
      if (children?.length) walk(children)
    }
  }
  walk(entities)
  return result
}

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  organization: 'Org',
  location: 'Location',
  department: 'Dept',
  team: 'Team',
}
