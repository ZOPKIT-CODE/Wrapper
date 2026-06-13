'use client'

import type { NodeProps } from 'reactflow'
import { Handle, Position } from 'reactflow'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Building,
  MapPin,
  Edit,
  Trash2,
  Plus,
  MoreVertical,
  CreditCard,
  ArrowRightLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface OrganizationNodeData {
  id: string
  name: string
  entityType: 'organization' | 'location' | 'department' | 'team'
  organizationType?: string
  locationType?: string
  isActive: boolean
  description?: string
  availableCredits?: number
  reservedCredits?: number
  entityLevel: number
  isPrimaryOrganization?: boolean
  onNodeClick?: (nodeId: string) => void
  onEditOrganization?: (orgId: string) => void
  onDeleteOrganization?: (orgId: string) => void
  onAddSubOrganization?: (parentId: string) => void
  onAddLocation?: (parentId: string) => void
  onAllocateCredits?: (entityId: string) => void
  onTransferCredits?: (orgId: string) => void
}

export function OrganizationNode({
  id,
  data,
  selected,
}: NodeProps<OrganizationNodeData>) {
  const {
    name,
    entityType,
    organizationType,
    locationType,
    isActive,
    description,
    availableCredits,
    reservedCredits,
    entityLevel,
    isPrimaryOrganization,
    onNodeClick,
    onEditOrganization,
    onDeleteOrganization,
    onAddSubOrganization,
    onAddLocation,
    onAllocateCredits,
    onTransferCredits,
  } = data

  const isLocation = entityType === 'location'
  const Icon = isLocation ? MapPin : Building

  const handleNodeClick = () => {
    if (onNodeClick) {
      onNodeClick(id)
    }
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onEditOrganization) {
      onEditOrganization(id)
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDeleteOrganization) {
      onDeleteOrganization(id)
    }
  }

  const handleAddSubOrg = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onAddSubOrganization) {
      onAddSubOrganization(id)
    }
  }

  const handleAddLoc = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onAddLocation) {
      onAddLocation(id)
    }
  }

  const handleAllocateCredits = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onAllocateCredits) {
      onAllocateCredits(id)
    }
  }

  const handleTransferCredits = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onTransferCredits) {
      onTransferCredits(id)
    }
  }

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary !h-3 !w-3"
      />

      <Card
        className={cn(
          'w-64 cursor-grab p-4 shadow-lg transition-all duration-200 hover:shadow-xl active:cursor-grabbing',
          selected ? 'ring-primary ring-2 ring-offset-2' : '',
          !isActive && 'opacity-60'
        )}
        onClick={handleNodeClick}
        onMouseDown={(e) => {
          // Allow dragging by clicking anywhere on the card except buttons
          if ((e.target as HTMLElement).closest('button')) {
            e.stopPropagation()
          }
        }}
      >
        <div className="mb-2 flex items-start justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className={cn(
                'shrink-0 rounded-lg p-2',
                isLocation ? 'bg-amber-100' : 'bg-primary/10'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5',
                  isLocation ? 'text-amber-600' : 'text-primary'
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold">{name}</h3>
              <p className="text-xs text-gray-500 capitalize">
                {isLocation
                  ? locationType || 'location'
                  : organizationType || 'organization'}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isLocation && onAddSubOrganization && (
                <DropdownMenuItem onClick={handleAddSubOrg}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Sub-Organization
                </DropdownMenuItem>
              )}
              {onAddLocation && (
                <DropdownMenuItem onClick={handleAddLoc}>
                  <MapPin className="mr-2 h-4 w-4" />
                  Add Location
                </DropdownMenuItem>
              )}
              {/* Credit Allocation - only for organizations and locations */}
              {(entityType === 'organization' || entityType === 'location') &&
                onAllocateCredits && (
                  <DropdownMenuItem onClick={handleAllocateCredits}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Allocate Credits
                  </DropdownMenuItem>
                )}
              {!isLocation && onTransferCredits && (
                <DropdownMenuItem onClick={handleTransferCredits}>
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Transfer Credits
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {onEditOrganization && (
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDeleteOrganization && !isPrimaryOrganization && (
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {description && (
          <p className="mb-2 line-clamp-2 text-xs text-gray-600">
            {description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={isActive ? 'default' : 'secondary'}
            className="text-xs"
          >
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
          {entityLevel > 0 && (
            <Badge variant="outline" className="text-xs">
              Level {entityLevel}
            </Badge>
          )}
        </div>

        {availableCredits !== undefined && availableCredits !== null && (
          <div className="mt-2 border-t border-gray-200 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Credits:</span>
              <div className="flex gap-2">
                <span className="font-medium text-green-600">
                  {typeof availableCredits === 'number'
                    ? availableCredits.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })
                    : parseFloat(String(availableCredits || 0)).toLocaleString(
                        undefined,
                        { maximumFractionDigits: 2 }
                      )}{' '}
                  available
                </span>
                {reservedCredits !== undefined &&
                  reservedCredits !== null &&
                  reservedCredits > 0 && (
                    <span className="font-medium text-orange-600">
                      {typeof reservedCredits === 'number'
                        ? reservedCredits.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                        : parseFloat(
                            String(reservedCredits || 0)
                          ).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}{' '}
                      reserved
                    </span>
                  )}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary !h-3 !w-3"
      />
    </>
  )
}
