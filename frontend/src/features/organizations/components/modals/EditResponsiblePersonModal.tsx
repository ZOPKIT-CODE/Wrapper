import { useState, useEffect, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { UserCog, Mail, Clock, Building2, User } from 'lucide-react'
import { toast } from 'sonner'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'
import { cn } from '@/lib/utils'

type EmployeeLike = {
  userId?: string
  id?: string
  name?: string
  email?: string
  firstName?: string
  lastName?: string
  status?: string
  isActive?: boolean
  isTenantAdmin?: boolean
  isVerified?: boolean
  onboardingCompleted?: boolean
  lastActiveAt?: string | null
  createdAt?: string | null
  department?: string | null
  title?: string | null
}

function fullName(u: EmployeeLike): string {
  const parts = [u.firstName?.trim(), u.lastName?.trim()].filter(Boolean)
  if (parts.length > 0) return parts.join(' ')
  if (u.name?.trim()) return u.name.trim()
  return u.email ?? ''
}

function initials(u: EmployeeLike): string {
  const f = u.firstName?.trim()
  const l = u.lastName?.trim()
  if (f && l) return `${f[0] ?? ''}${l[0] ?? ''}`.toUpperCase()
  if (f) return f.slice(0, 2).toUpperCase()
  if (l) return l.slice(0, 2).toUpperCase()
  const n = fullName(u)
  if (n && n !== u.email) {
    const p = n.trim().split(/\s+/)
    return (
      p
        .slice(0, 2)
        .map((x) => x[0]?.toUpperCase() ?? '')
        .join('') || '?'
    )
  }
  return u.email ? u.email[0].toUpperCase() : '?'
}

function relativeActive(dateStr?: string | null): string {
  if (!dateStr) return 'Never'
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return '—'
  }
}

interface EditResponsiblePersonModalProps {
  isOpen: boolean
  onClose: () => void
  entity: any
  employees: EmployeeLike[]
  onSuccess: () => Promise<void>
  makeRequest: (url: string, options?: any) => Promise<any>
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 text-sm sm:grid-cols-[8.5rem_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-foreground min-w-0 font-medium">{children}</div>
    </div>
  )
}

export function EditResponsiblePersonModal({
  isOpen,
  onClose,
  entity,
  employees,
  onSuccess,
  makeRequest,
}: EditResponsiblePersonModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('none')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [assigneeFromApi, setAssigneeFromApi] = useState<EmployeeLike | null>(
    null
  )

  const entityId = entity?.entityId ?? entity?.id
  const entityLabel = entity?.entityName ?? entity?.name ?? 'this entity'

  const availablePeople = useMemo(() => {
    const list = (employees || []).filter((u) => {
      const id = u.userId ?? u.id
      if (!id) return false
      if (typeof u.isActive === 'boolean') return u.isActive
      const st = (u.status || 'active').toLowerCase()
      return st === 'active' || st === 'invited'
    })
    const seen = new Set<string>()
    return list
      .filter((u) => {
        const id = u.userId ?? (u.id as string)
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
      .sort((a, b) =>
        fullName(a).toLowerCase().localeCompare(fullName(b).toLowerCase())
      )
  }, [employees])

  const peopleForSelect = useMemo(() => {
    const byId = new Map<string, EmployeeLike>()
    for (const u of availablePeople) {
      const id = String(u.userId ?? u.id)
      byId.set(id, u)
    }
    if (assigneeFromApi?.userId && !byId.has(String(assigneeFromApi.userId))) {
      byId.set(String(assigneeFromApi.userId), assigneeFromApi)
    }
    return Array.from(byId.values()).sort((a, b) =>
      fullName(a).toLowerCase().localeCompare(fullName(b).toLowerCase())
    )
  }, [availablePeople, assigneeFromApi])

  const selectedPerson: EmployeeLike | null = useMemo(() => {
    if (!selectedUserId || selectedUserId === 'none') return null
    return (
      peopleForSelect.find(
        (u) => String(u.userId ?? u.id) === selectedUserId
      ) ?? null
    )
  }, [selectedUserId, peopleForSelect])

  useEffect(() => {
    if (!isOpen || !entityId) return

    let cancelled = false
    setLoadingDetail(true)
    ;(async () => {
      try {
        const res = await makeRequest(
          `/admin/entities/${entityId}/responsible-person`,
          { method: 'GET' }
        )
        if (cancelled) return
        const payload = res?.data !== undefined ? res.data : res
        const user =
          payload && typeof payload === 'object' && 'userId' in payload
            ? (payload as { userId: string; name?: string; email?: string })
            : null
        if (user?.userId) {
          const uid = String(user.userId)
          setSelectedUserId(uid)
          const inEmployees = (employees || []).some(
            (e) => String(e.userId ?? e.id) === uid
          )
          if (!inEmployees) {
            setAssigneeFromApi({
              userId: uid,
              name: user.name,
              email: user.email,
              status: 'active',
            })
          } else {
            setAssigneeFromApi(null)
          }
        } else {
          const fallback = entity?.responsiblePersonId
          if (fallback) {
            const fid = String(fallback)
            setSelectedUserId(fid)
            const inList = (employees || []).some(
              (e) => String(e.userId ?? e.id) === fid
            )
            setAssigneeFromApi(
              inList
                ? null
                : { userId: fid, name: 'Team member', email: undefined }
            )
          } else {
            setSelectedUserId('none')
            setAssigneeFromApi(null)
          }
        }
      } catch {
        if (!cancelled) {
          const fallback = entity?.responsiblePersonId
          if (fallback) {
            const fid = String(fallback)
            setSelectedUserId(fid)
            const inList = (employees || []).some(
              (e) => String(e.userId ?? e.id) === fid
            )
            setAssigneeFromApi(
              inList
                ? null
                : { userId: fid, name: 'Team member', email: undefined }
            )
          } else {
            setSelectedUserId('none')
            setAssigneeFromApi(null)
          }
        }
      } finally {
        if (!cancelled) setLoadingDetail(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, entityId, entity?.responsiblePersonId, makeRequest, employees])

  const handleSave = async () => {
    if (!entityId) return
    setSaving(true)
    try {
      await makeRequest(`/admin/entities/${entityId}/responsible-person`, {
        method: 'PATCH',
        body: JSON.stringify({
          userId: selectedUserId === 'none' ? 'none' : selectedUserId,
        }),
      })
      toast.success('Manager updated')
      await onSuccess()
      onClose()
    } catch {
      toast.error('Failed to assign manager')
    } finally {
      setSaving(false)
    }
  }

  const isActiveMember = selectedPerson?.isActive !== false

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        side="right"
        className="flex h-full min-h-0 w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg [&>button]:text-white [&>button]:hover:bg-white/15"
      >
        <SheetHeader className="bg-primary shrink-0 space-y-2 border-b border-white/10 px-6 pt-8 pb-5 text-white">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <UserCog className="h-5 w-5 shrink-0" aria-hidden />
            Assign Manager
          </SheetTitle>
          <SheetDescription className="text-sm text-white/85">
            Choose someone from your organization for{' '}
            <strong className="text-white">{entityLabel}</strong>. Pick a name
            below—details match what you see in User management.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {loadingDetail ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <ZopkitRoundLoader size="sm" />
              Loading current assignment…
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label
                  htmlFor="assign-manager-user"
                  className="text-[13px] font-medium"
                >
                  Manager
                </Label>
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                >
                  <SelectTrigger
                    id="assign-manager-user"
                    className="focus:border-primary focus:ring-ring focus:ring-2"
                  >
                    <SelectValue placeholder="Select a person" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (unassigned)</SelectItem>
                    {peopleForSelect.map((u) => {
                      const id = String(u.userId ?? u.id)
                      return (
                        <SelectItem key={id} value={id}>
                          {fullName(u) || u.email || id}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {availablePeople.length === 0 && !assigneeFromApi && (
                  <p className="text-sm text-amber-700">
                    No active users found. Invite team members under Users
                    first, then assign a manager here.
                  </p>
                )}
              </div>

              {selectedPerson && selectedUserId !== 'none' && (
                <div
                  className={cn(
                    'rounded-lg border border-slate-200 bg-slate-50 p-4'
                  )}
                >
                  <p className="text-primary mb-3 text-sm font-medium">
                    Member details
                  </p>
                  <div className="border-primary/10 flex gap-3 border-b pb-4">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                        {initials(selectedPerson)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-primary truncate text-base font-semibold">
                        {fullName(selectedPerson) ||
                          selectedPerson.email ||
                          '—'}
                      </p>
                      {selectedPerson.email ? (
                        <p className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                          <Mail className="h-3 w-3 shrink-0" />
                          {selectedPerson.email}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <DetailRow label="First name">
                      {selectedPerson.firstName?.trim() || '—'}
                    </DetailRow>
                    <DetailRow label="Last name">
                      {selectedPerson.lastName?.trim() || '—'}
                    </DetailRow>
                    <DetailRow label="Access">
                      {selectedPerson.isTenantAdmin ? (
                        <Badge
                          variant="outline"
                          className="text-primary border-slate-200 bg-slate-100 text-[11px] font-medium"
                        >
                          Tenant admin
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          Standard member
                        </span>
                      )}
                    </DetailRow>
                    <DetailRow label="Status">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[11px] font-medium',
                          isActiveMember
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-slate-100 text-slate-700'
                        )}
                      >
                        {isActiveMember ? 'Active' : 'Inactive'}
                      </Badge>
                    </DetailRow>
                    {selectedPerson.department != null &&
                    selectedPerson.department !== '' ? (
                      <DetailRow label="Department">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                          {selectedPerson.department}
                        </span>
                      </DetailRow>
                    ) : (
                      <DetailRow label="Department">—</DetailRow>
                    )}
                    {selectedPerson.title != null &&
                    selectedPerson.title !== '' ? (
                      <DetailRow label="Title">
                        <span className="flex items-center gap-1.5">
                          <User className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                          {selectedPerson.title}
                        </span>
                      </DetailRow>
                    ) : null}
                    <DetailRow label="Last active">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        {relativeActive(selectedPerson.lastActiveAt)}
                        {selectedPerson.lastActiveAt ? (
                          <span className="text-muted-foreground/80 text-xs">
                            (
                            {new Date(
                              selectedPerson.lastActiveAt
                            ).toLocaleString()}
                            )
                          </span>
                        ) : null}
                      </span>
                    </DetailRow>
                    {selectedPerson.isVerified !== undefined ? (
                      <DetailRow label="Verified">
                        {selectedPerson.isVerified ? (
                          <Badge variant="outline" className="text-[11px]">
                            Yes
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </DetailRow>
                    ) : null}
                    {selectedPerson.createdAt ? (
                      <DetailRow label="Joined">
                        {new Date(selectedPerson.createdAt).toLocaleDateString(
                          undefined,
                          {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          }
                        )}
                      </DetailRow>
                    ) : null}
                    {selectedPerson.onboardingCompleted !== undefined ? (
                      <DetailRow label="Onboarding">
                        {selectedPerson.onboardingCompleted ? (
                          <span className="text-emerald-700">Completed</span>
                        ) : (
                          <span className="text-muted-foreground">
                            Incomplete
                          </span>
                        )}
                      </DetailRow>
                    ) : null}
                  </div>
                </div>
              )}

              {selectedUserId === 'none' && !loadingDetail && (
                <p className="text-muted-foreground text-sm">
                  Select a team member to see their profile details here. Use
                  the Users page to invite or manage members.
                </p>
              )}
            </>
          )}
        </div>

        <SheetFooter className="border-primary/10 bg-muted mt-0 shrink-0 flex-row justify-end gap-2 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving || loadingDetail}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || loadingDetail}
            className="bg-primary text-primary-foreground hover:bg-primary-hover"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
