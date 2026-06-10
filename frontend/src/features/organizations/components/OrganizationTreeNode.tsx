import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Users,
  Plus,
  Edit,
  Trash2,
  MapPin,
  ChevronRight,
  ChevronDown,
  ArrowRightLeft,
  CreditCard,
  UserCog,
  Building,
  MoreHorizontal,
} from 'lucide-react'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'
import { useNavigate } from '@tanstack/react-router'
import type { Entity } from '@/features/organizations/types'

// --- Types (inlined to avoid circular deps) ---

interface Organization {
  entityId: string
  entityName: string
  entityType: 'organization' | 'location' | 'department' | 'team'
  entityLevel: number
  hierarchyPath: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  parentEntityId?: string
  responsiblePersonId?: string
  children?: Organization[]
  organizationType?: string
  locationType?: string
  address?: any
  availableCredits?: number
  reservedCredits?: number
  totalCredits?: number
  freeCredits?: number
  paidCredits?: number
}

interface Location {
  entityId: string
  entityName: string
  entityType: 'location'
  entityLevel: number
  hierarchyPath: string
  fullHierarchyPath?: string
  description?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }
  city?: string
  state?: string
  country?: string
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
  parentEntityId?: string
  responsiblePersonId?: string
  locationType?: string
  children?: Location[]
  availableCredits?: number
  freeCredits?: number
}

export interface TreeNodeProps {
  org: Organization | Location
  level?: number
  isAdmin: boolean
  isDeleting: boolean
  selectedItems: string[]
  getResponsiblePersonName: (userId: string) => string
  onEdit: (org: Organization) => void
  onAssignManager: (entity: Entity) => void
  onAllocateCredits: (entity: Entity) => void
  onTransferCredits: (org: Organization) => void
  onDelete: (entityId: string, entityName?: string) => void
  setEditingEntity: (entity: Entity | null) => void
  setShowEditResponsiblePerson: (show: boolean) => void
  setSelectedEntity: (entity: Entity | null) => void
  setAllocationForm: (form: any) => void
  setShowAllocationDialog: (show: boolean) => void
}

export function TreeNode({
  org,
  level = 0,
  isAdmin,
  isDeleting,
  selectedItems,
  getResponsiblePersonName,
  onEdit,
  onAssignManager,
  onAllocateCredits,
  onTransferCredits,
  onDelete,
  setEditingEntity,
  setShowEditResponsiblePerson,
  setSelectedEntity,
  setAllocationForm,
  setShowAllocationDialog,
}: TreeNodeProps) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(level < 2)
  const orgChildren = (org as Organization).children || []
  const hasChildren = orgChildren.length > 0
  const isLocation = org.entityType === 'location'
  const isSelected = selectedItems.includes(org.entityId)
  const canTransferCredits = (o: Organization) =>
    o.children && o.children.length > 0

  return (
    <div className="relative">
      <div
        className={`group relative mb-2 flex items-center rounded-xl border p-3 transition-all duration-200 ${isSelected ? 'border-[#1B2E5A]/40 bg-[#1B2E5A]/5 shadow-md dark:bg-[#1B2E5A]/10' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'} `}
      >
        {/* Controls: Expand/Checkbox */}
        <div className="mr-3 flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center">
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setExpanded(!expanded)
                }}
                className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-4" />
            )}
          </div>
        </div>

        {/* Icon */}
        <div
          className={`border-opacity-10 mr-4 flex h-10 w-10 items-center justify-center rounded-lg border shadow-sm ${
            isLocation
              ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 dark:border-emerald-800 dark:from-emerald-900/30 dark:to-emerald-900/10 dark:text-emerald-400'
              : 'border-[#1B2E5A]/20 bg-[#1B2E5A]/10 text-[#1B2E5A] dark:border-blue-800 dark:from-blue-900/30 dark:to-blue-900/10 dark:text-blue-400'
          } `}
        >
          {isLocation ? (
            <MapPin className="h-5 w-5" />
          ) : (
            <Building className="h-5 w-5" />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {level > 0 && (
              <Badge
                variant="outline"
                className="h-4 border-slate-300 bg-slate-100 px-1.5 py-0 text-[9px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              >
                L{level + 1}
              </Badge>
            )}
            <span
              className="truncate text-sm sm:text-base dark:text-slate-100"
              style={{
                fontFamily: 'var(--zk-display)',
                fontWeight: 600,
                letterSpacing: '-0.025em',
                color: 'var(--zk-ink)',
              }}
            >
              {org.entityName}
            </span>
            <Badge
              variant={org.isActive !== false ? 'outline' : 'destructive'}
              className="h-5 px-1.5 py-0 text-[10px]"
            >
              {org.isActive !== false ? 'Active' : 'Inactive'}
            </Badge>
            {isLocation && (
              <Badge
                variant="secondary"
                className="h-5 border-emerald-200 bg-emerald-100 px-1.5 py-0 text-[10px] text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                {(org as Location).locationType || 'Location'}
              </Badge>
            )}
            {(org as any).entityLevel !== null &&
              (org as any).entityLevel !== undefined && (
                <Badge
                  variant="outline"
                  className="h-4 border-[#1B2E5A]/20 bg-[#1B2E5A]/5 px-1.5 py-0 text-[9px] text-[#1B2E5A] dark:border-blue-800 dark:bg-[#1B2E5A]/10 dark:text-blue-400"
                >
                  Level {(org as any).entityLevel}
                </Badge>
              )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {org.responsiblePersonId
                ? getResponsiblePersonName(org.responsiblePersonId)
                : 'Unassigned'}
            </span>
            <span
              className="flex items-center gap-1"
              title={`Available: ${typeof (org as any).availableCredits === 'string' ? parseFloat((org as any).availableCredits) || 0 : typeof (org as any).availableCredits === 'number' ? (org as any).availableCredits : 0}, Reserved: ${typeof (org as any).reservedCredits === 'string' ? parseFloat((org as any).reservedCredits) || 0 : typeof (org as any).reservedCredits === 'number' ? (org as any).reservedCredits : 0}`}
            >
              <CreditCard className="h-3 w-3" />
              <span
                className="dark:text-slate-300"
                style={{
                  fontFamily: 'var(--zk-mono)',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: 'var(--zk-ink)',
                }}
              >
                {(typeof (org as any).availableCredits === 'string'
                  ? parseFloat((org as any).availableCredits) || 0
                  : typeof (org as any).availableCredits === 'number'
                    ? (org as any).availableCredits
                    : 0
                ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span
                className="dark:text-slate-400"
                style={{
                  fontFamily: 'var(--zk-font)',
                  fontSize: 12,
                  color: 'var(--zk-muted)',
                }}
              >
                Credits
              </span>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          {!isLocation && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-[#1B2E5A]"
                onClick={() =>
                  navigate({
                    to: '/dashboard/organization/create',
                    search: {
                      parentId: (org as Organization).entityId,
                      parentName: (org as Organization).entityName,
                      entityType: 'organization' as any,
                    },
                  })
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-emerald-600"
                onClick={() =>
                  navigate({
                    to: '/dashboard/organization/create',
                    search: {
                      parentId: (org as Organization).entityId,
                      parentName: (org as Organization).entityName,
                      entityType: 'location' as any,
                    },
                  })
                }
              >
                <MapPin className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-amber-600"
                onClick={() => onTransferCredits(org as Organization)}
                disabled={!canTransferCredits(org as Organization)}
              >
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-[#1B2E5A]"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => {
                  if (!isLocation) {
                    onEdit(org as Organization)
                  }
                }}
              >
                <Edit className="mr-2 h-4 w-4" /> Edit Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditingEntity(org as Entity)
                  setShowEditResponsiblePerson(true)
                }}
              >
                <UserCog className="mr-2 h-4 w-4" /> Assign Manager
              </DropdownMenuItem>
              {!isLocation && (
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedEntity(org as Entity)
                    setAllocationForm({
                      targetApplication: '',
                      creditAmount: 0,
                      allocationPurpose: '',
                      autoReplenish: false,
                    })
                    setShowAllocationDialog(true)
                  }}
                >
                  <CreditCard className="mr-2 h-4 w-4" /> Allocate Credits to
                  App
                </DropdownMenuItem>
              )}
              {isAdmin &&
                !isLocation &&
                org.parentEntityId != null &&
                org.parentEntityId !== '' && (
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={() => onDelete(org.entityId, org.entityName)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <ZopkitRoundLoader size="xs" className="mr-2" />{' '}
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Entity
                      </>
                    )}
                  </DropdownMenuItem>
                )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Children (Recursive) */}
      {expanded && hasChildren && (
        <div className="relative mt-1 ml-6 space-y-1 border-l-2 border-slate-200 pb-2 pl-4 dark:border-slate-800">
          {orgChildren.map((child: any) => (
            <TreeNode
              key={child.entityId}
              org={child}
              level={level + 1}
              isAdmin={isAdmin}
              isDeleting={isDeleting}
              selectedItems={selectedItems}
              getResponsiblePersonName={getResponsiblePersonName}
              onEdit={onEdit}
              onAssignManager={onAssignManager}
              onAllocateCredits={onAllocateCredits}
              onTransferCredits={onTransferCredits}
              onDelete={onDelete}
              setEditingEntity={setEditingEntity}
              setShowEditResponsiblePerson={setShowEditResponsiblePerson}
              setSelectedEntity={setSelectedEntity}
              setAllocationForm={setAllocationForm}
              setShowAllocationDialog={setShowAllocationDialog}
            />
          ))}
        </div>
      )}
    </div>
  )
}
