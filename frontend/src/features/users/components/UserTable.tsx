import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
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
  MoreVertical,
  Search,
  Eye,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  UserX,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  UserRecord,
  getUserInitials,
  displayName,
  getUserRole,
  relativeTime,
} from './userManagementTypes'

// ---------------------------------------------------------------------------
// Local sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    inactive: 'border-gray-200 bg-gray-50 text-gray-600',
    pending: 'border-amber-200 bg-amber-50 text-amber-700',
    expired: 'border-red-200 bg-red-50 text-red-700',
    cancelled: 'border-gray-200 bg-gray-50 text-gray-500',
    accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
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

function TableSkeleton({
  rows = 5,
  cols = 6,
}: {
  rows?: number
  cols?: number
}) {
  return (
    <div
      style={{
        borderRadius: 8,
        border: '1px solid var(--zk-line)',
        overflow: 'hidden',
      }}
    >
      <Table>
        <TableHeader>
          <TableRow style={{ background: 'var(--zk-bg-2)' }}>
            {Array.from({ length: cols }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, r) => (
            <TableRow key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <TableCell key={c}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
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
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg"
        style={{
          background: 'var(--zk-bg-2)',
          border: '1px solid var(--zk-line)',
        }}
      >
        <Icon className="h-8 w-8" style={{ color: 'var(--zk-navy)' }} />
      </div>
      <h3
        className="text-lg font-semibold"
        style={{ color: 'var(--zk-ink)', fontFamily: 'var(--zk-display)' }}
      >
        {title}
      </h3>
      <p
        className="mt-1.5 max-w-sm text-sm"
        style={{ color: 'var(--zk-muted)' }}
      >
        {description}
      </p>
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
      <p
        style={{
          fontSize: 12,
          fontFamily: 'var(--zk-mono)',
          color: 'var(--zk-muted)',
        }}
      >
        Page <span style={{ fontWeight: 600 }}>{page}</span> of{' '}
        <span style={{ fontWeight: 600 }}>{totalPages}</span> ({total} total)
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// UserTable Props
// ---------------------------------------------------------------------------

export interface UserTableProps {
  users: UserRecord[]
  usersLoading: boolean
  usersError: unknown
  searchQuery: string
  onSearchChange: (q: string) => void
  statusFilter: string
  onStatusFilterChange: (v: string) => void
  page: number
  totalPages: number
  total: number
  onPageChange: (p: number) => void
  onViewUser: (userId: string) => void
  onAssignRole: (userId: string) => void
  onToggleStatus: (userId: string, currentIsActive: boolean | undefined) => void
  onRemoveUser: (id: string) => void
}

// ---------------------------------------------------------------------------
// UserTable
// ---------------------------------------------------------------------------

export function UserTable({
  users,
  usersLoading,
  usersError,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  page,
  totalPages,
  total,
  onPageChange,
  onViewUser,
  onAssignRole,
  onToggleStatus,
  onRemoveUser,
}: UserTableProps) {
  const TH_STYLE = {
    fontSize: 11,
    fontFamily: 'var(--zk-mono)',
    fontWeight: 500,
    letterSpacing: '0.02em',
    color: 'var(--zk-muted-2)',
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name or email..."
            className="rounded-lg pl-9"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value)
              onPageChange(1)
            }}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            onStatusFilterChange(v)
            onPageChange(1)
          }}
        >
          <SelectTrigger className="w-full rounded-lg sm:w-[160px]">
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
        <EmptyState
          icon={UserX}
          title="Failed to load members"
          description="Something went wrong. Please try refreshing the page."
        />
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members found"
          description={
            searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Invite your first team member to get started.'
          }
        />
      ) : (
        <>
          <div
            style={{
              borderRadius: 8,
              border: '1px solid var(--zk-line)',
              overflow: 'hidden',
            }}
          >
            <Table>
              <TableHeader>
                <TableRow style={{ background: 'var(--zk-bg-2)' }}>
                  <TableHead
                    className="w-[240px] min-w-[180px]"
                    style={TH_STYLE}
                  >
                    User
                  </TableHead>
                  <TableHead className="hidden md:table-cell" style={TH_STYLE}>
                    First name
                  </TableHead>
                  <TableHead className="hidden md:table-cell" style={TH_STYLE}>
                    Last name
                  </TableHead>
                  <TableHead style={TH_STYLE}>Role</TableHead>
                  <TableHead style={TH_STYLE}>Status</TableHead>
                  <TableHead className="hidden md:table-cell" style={TH_STYLE}>
                    Department
                  </TableHead>
                  <TableHead className="hidden lg:table-cell" style={TH_STYLE}>
                    Last Active
                  </TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const role = getUserRole(user)
                  const removeId =
                    user.userId ??
                    (user.invitationId ? `inv_${user.invitationId}` : null)
                  return (
                    <TableRow
                      key={user.userId ?? user.invitationId}
                      className="group"
                    >
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
                            <p
                              className="truncate"
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                fontFamily: 'var(--zk-font)',
                                color: 'var(--zk-ink)',
                              }}
                            >
                              {displayName(user)}
                            </p>
                            <p
                              className="truncate"
                              style={{
                                fontSize: 12,
                                color: 'var(--zk-muted-2)',
                                fontFamily: 'var(--zk-font)',
                              }}
                            >
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell
                        className="hidden md:table-cell"
                        style={{
                          fontSize: 13,
                          color: 'var(--zk-muted)',
                          fontFamily: 'var(--zk-font)',
                        }}
                      >
                        {user.firstName?.trim() || '—'}
                      </TableCell>
                      <TableCell
                        className="hidden md:table-cell"
                        style={{
                          fontSize: 13,
                          color: 'var(--zk-muted)',
                          fontFamily: 'var(--zk-font)',
                        }}
                      >
                        {user.lastName?.trim() || '—'}
                      </TableCell>
                      <TableCell>
                        {user.isTenantAdmin ? (
                          <Badge
                            variant="outline"
                            className="border-border bg-muted text-primary text-[11px] font-medium"
                          >
                            Admin
                          </Badge>
                        ) : role ? (
                          <Badge
                            variant="outline"
                            className="text-[11px] font-medium"
                            style={
                              role.color
                                ? {
                                    borderColor: role.color + '40',
                                    backgroundColor: role.color + '10',
                                    color: role.color,
                                  }
                                : undefined
                            }
                          >
                            {role.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">
                            No role
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={
                            user.isActive !== false ? 'active' : 'inactive'
                          }
                        />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span
                          style={{
                            fontSize: 13,
                            color: 'var(--zk-muted)',
                            fontFamily: 'var(--zk-font)',
                          }}
                        >
                          {user.department || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="flex items-center gap-1"
                              style={{
                                fontSize: 11,
                                fontFamily: 'var(--zk-mono)',
                                color: 'var(--zk-muted-2)',
                              }}
                            >
                              <Clock className="h-3 w-3" />
                              {relativeTime(user.lastActiveAt)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {user.lastActiveAt
                              ? new Date(user.lastActiveAt).toLocaleString()
                              : 'Never active'}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                            >
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-50">
                            <DropdownMenuItem
                              onClick={() =>
                                user.userId && onViewUser(user.userId)
                              }
                            >
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                user.userId && onAssignRole(user.userId)
                              }
                            >
                              <Edit className="mr-2 h-4 w-4" /> Assign Role
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={!user.userId}
                              onClick={() =>
                                user.userId &&
                                onToggleStatus(user.userId, user.isActive)
                              }
                            >
                              {user.isActive !== false ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" /> Deactivate
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="mr-2 h-4 w-4" />{' '}
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => removeId && onRemoveUser(removeId)}
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
          <PaginationControls
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  )
}
