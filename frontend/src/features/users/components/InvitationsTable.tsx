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
  Mail,
  MoreVertical,
  Search,
  RefreshCw,
  XCircle,
  Copy,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { InvitationRecord, relativeTime } from './userManagementTypes'

// ---------------------------------------------------------------------------
// Local sub-components
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

function TableSkeleton({ rows = 4, cols = 7 }: { rows?: number; cols?: number }) {
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

// ---------------------------------------------------------------------------
// InvitationsTable Props & Component
// ---------------------------------------------------------------------------

export interface InvitationsTableProps {
  invitations: InvitationRecord[]
  invitationsLoading: boolean
  searchQuery: string
  onSearchChange: (q: string) => void
  statusFilter: string
  onStatusFilterChange: (v: string) => void
  page: number
  totalPages: number
  total: number
  onPageChange: (p: number) => void
  onCopyLink: (link?: string) => void
  onResend: (invitationId: string) => void
  onCancel: (invitationId: string) => void
  resendIsPending: boolean
  cancelIsPending: boolean
}

export function InvitationsTable({
  invitations,
  invitationsLoading,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  page,
  totalPages,
  total,
  onPageChange,
  onCopyLink,
  onResend,
  onCancel,
  resendIsPending,
  cancelIsPending,
}: InvitationsTableProps) {
  const TH_STYLE = { fontSize: 11, fontFamily: 'var(--zk-mono)', fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--zk-muted-2)' }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by email..."
            className="pl-9 rounded-lg"
            value={searchQuery}
            onChange={(e) => { onSearchChange(e.target.value); onPageChange(1) }}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { onStatusFilterChange(v); onPageChange(1) }}>
          <SelectTrigger className="w-full sm:w-[160px] rounded-lg">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
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
          description={searchQuery || statusFilter !== 'all' ? 'Try adjusting your search or filter criteria.' : 'Invite team members to see their invitations here.'}
        />
      ) : (
        <>
          <div style={{ borderRadius: 12, border: '1px solid var(--zk-line)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(15,32,80,0.05)' }}>
            <Table>
              <TableHeader>
                <TableRow style={{ background: 'var(--zk-bg-2)' }}>
                  <TableHead className="w-[260px]" style={TH_STYLE}>Email</TableHead>
                  <TableHead style={TH_STYLE}>Role</TableHead>
                  <TableHead style={TH_STYLE}>Status</TableHead>
                  <TableHead className="min-w-[180px] max-w-[min(100%,22rem)] xl:min-w-[220px]" style={TH_STYLE}>Invitation URL</TableHead>
                  <TableHead className="hidden md:table-cell" style={TH_STYLE}>Invited By</TableHead>
                  <TableHead className="hidden lg:table-cell" style={TH_STYLE}>Expires</TableHead>
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
                                onClick={() => onCopyLink(inv.invitationLink)}
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
                              <DropdownMenuItem disabled={resendIsPending} onClick={() => onResend(inv.invitationId)}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Resend
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => onCopyLink(inv.invitationLink)}>
                              <Copy className="mr-2 h-4 w-4" /> Copy Link
                            </DropdownMenuItem>
                            {isPending && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive" disabled={cancelIsPending} onClick={() => onCancel(inv.invitationId)}>
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
          <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={onPageChange} />
        </>
      )}
    </div>
  )
}
