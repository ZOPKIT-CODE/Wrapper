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
import type { OrganizationEntity } from '../types'

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
  onAssignManager: (entity: OrganizationEntity) => void
  onAllocateCredits: (entity: OrganizationEntity) => void
  onTransferCredits: (org: Organization) => void
  onDelete: (entityId: string, entityName?: string) => void
  setEditingEntity: (entity: OrganizationEntity | null) => void
  setShowEditResponsiblePerson: (show: boolean) => void
  setSelectedEntity: (entity: OrganizationEntity | null) => void
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
  const canTransferCredits = (o: Organization) => o.children && o.children.length > 0

  return (
    <div className="relative">
      <div
        className={`
          group flex items-center p-3 mb-2 rounded-xl border transition-all duration-200 relative
          ${isSelected ? 'border-primary/40 bg-primary/5 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}
        `}
      >
        {/* Controls: Expand/Checkbox */}
        <div className="flex items-center gap-2 mr-3">
          <div className="w-5 h-5 flex items-center justify-center">
            {hasChildren ? (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
                className="p-1 hover:bg-slate-100 rounded-md transition-colors text-slate-500"
                aria-label={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-4" />
            )}
          </div>
        </div>

        {/* Icon */}
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center mr-4 shadow-sm border border-opacity-10
          ${isLocation
            ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-600'
            : 'bg-primary/10 border-primary/20 text-primary'
          }
        `}>
          {isLocation ? <MapPin className="w-5 h-5" /> : <Building className="w-5 h-5" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {level > 0 && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-slate-100 text-slate-600 border-slate-300">
                L{level + 1}
              </Badge>
            )}
            <span className="truncate text-sm sm:text-base" style={{ fontFamily: 'var(--zk-display)', fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--zk-ink)' }}>
              {org.entityName}
            </span>
            <Badge variant={org.isActive !== false ? 'outline' : 'destructive'} className="text-[10px] px-1.5 py-0 h-5">
              {org.isActive !== false ? 'Active' : 'Inactive'}
            </Badge>
            {isLocation && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-emerald-100 text-emerald-700 border-emerald-200">
                {(org as Location).locationType || 'Location'}
              </Badge>
            )}
            {(org as any).entityLevel !== null && (org as any).entityLevel !== undefined && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-primary/5 text-primary border-primary/20">
                Level {(org as any).entityLevel}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {org.responsiblePersonId ? getResponsiblePersonName(org.responsiblePersonId) : 'Unassigned'}
            </span>
            <span className="flex items-center gap-1" title={`Available: ${typeof (org as any).availableCredits === 'string' ? parseFloat((org as any).availableCredits) || 0 : (typeof (org as any).availableCredits === 'number' ? (org as any).availableCredits : 0)}, Reserved: ${typeof (org as any).reservedCredits === 'string' ? parseFloat((org as any).reservedCredits) || 0 : (typeof (org as any).reservedCredits === 'number' ? (org as any).reservedCredits : 0)}`}>
              <CreditCard className="w-3 h-3" />
              <span style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--zk-ink)' }}>
                {(typeof (org as any).availableCredits === 'string'
                  ? parseFloat((org as any).availableCredits) || 0
                  : (typeof (org as any).availableCredits === 'number' ? (org as any).availableCredits : 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span style={{ fontFamily: 'var(--zk-font)', fontSize: 12, color: 'var(--zk-muted)' }}>Credits</span>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {!isLocation && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-primary"
                onClick={() =>
                  navigate({
                    to: '/dashboard/organization/create',
                    search: { parentId: (org as Organization).entityId, parentName: (org as Organization).entityName, entityType: 'organization' as any },
                  })
                }
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-emerald-600"
                onClick={() =>
                  navigate({
                    to: '/dashboard/organization/create',
                    search: { parentId: (org as Organization).entityId, parentName: (org as Organization).entityName, entityType: 'location' as any },
                  })
                }
              >
                <MapPin className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-amber-600"
                onClick={() => onTransferCredits(org as Organization)}
                disabled={!canTransferCredits(org as Organization)}
              >
                <ArrowRightLeft className="w-4 h-4" />
              </Button>
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-primary">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => {
                if (!isLocation) {
                  onEdit(org as Organization)
                }
              }}>
                <Edit className="w-4 h-4 mr-2" /> Edit Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setEditingEntity(org as OrganizationEntity)
                setShowEditResponsiblePerson(true)
              }}>
                <UserCog className="w-4 h-4 mr-2" /> Assign Manager
              </DropdownMenuItem>
              {!isLocation && (
                <DropdownMenuItem onClick={() => {
                  setSelectedEntity(org as OrganizationEntity)
                  setAllocationForm({ targetApplication: '', creditAmount: 0, allocationPurpose: '', autoReplenish: false })
                  setShowAllocationDialog(true)
                }}>
                  <CreditCard className="w-4 h-4 mr-2" /> Allocate Credits to App
                </DropdownMenuItem>
              )}
              {isAdmin && !isLocation && (org.parentEntityId != null && org.parentEntityId !== '') && (
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => onDelete(org.entityId, org.entityName)}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <ZopkitRoundLoader size="xs" className="mr-2" /> Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" /> Delete Entity
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
        <div className="space-y-1 relative pb-2 mt-1 ml-6 pl-4 border-l-2 border-slate-200">
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
