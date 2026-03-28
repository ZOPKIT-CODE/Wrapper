'use client';

import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building, MapPin, Edit, Trash2, Plus, MoreVertical, CreditCard, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface OrganizationNodeData {
  id: string;
  name: string;
  entityType: 'organization' | 'location' | 'department' | 'team';
  organizationType?: string;
  locationType?: string;
  isActive: boolean;
  description?: string;
  availableCredits?: number;
  reservedCredits?: number;
  entityLevel: number;
  isPrimaryOrganization?: boolean;
  onNodeClick?: (nodeId: string) => void;
  onEditOrganization?: (orgId: string) => void;
  onDeleteOrganization?: (orgId: string) => void;
  onAddSubOrganization?: (parentId: string) => void;
  onAddLocation?: (parentId: string) => void;
  onAllocateCredits?: (entityId: string) => void;
  onTransferCredits?: (orgId: string) => void;
}

export function OrganizationNode({ id, data, selected }: NodeProps<OrganizationNodeData>) {
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
  } = data;

  const isLocation = entityType === 'location';
  const Icon = isLocation ? MapPin : Building;

  const handleNodeClick = () => {
    if (onNodeClick) {
      onNodeClick(id);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEditOrganization) {
      onEditOrganization(id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteOrganization) {
      onDeleteOrganization(id);
    }
  };

  const handleAddSubOrg = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddSubOrganization) {
      onAddSubOrganization(id);
    }
  };

  const handleAddLoc = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddLocation) {
      onAddLocation(id);
    }
  };

  const handleAllocateCredits = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAllocateCredits) {
      onAllocateCredits(id);
    }
  };

  const handleTransferCredits = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTransferCredits) {
      onTransferCredits(id);
    }
  };

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-[#1B2E5A] !w-3 !h-3" />
      
      <Card
        className={cn(
          "p-4 shadow-lg w-64 cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-xl",
          selected ? 'ring-2 ring-[#1B2E5A] ring-offset-2' : '',
          !isActive && 'opacity-60'
        )}
        onClick={handleNodeClick}
        onMouseDown={(e) => {
          // Allow dragging by clicking anywhere on the card except buttons
          if ((e.target as HTMLElement).closest('button')) {
            e.stopPropagation();
          }
        }}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={cn(
              "p-2 rounded-lg shrink-0",
              isLocation ? "bg-amber-100" : "bg-[#1B2E5A]/10"
            )}>
              <Icon className={cn(
                "w-5 h-5",
                isLocation ? "text-amber-600" : "text-[#1B2E5A]"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{name}</h3>
              <p className="text-xs text-gray-500 capitalize">
                {isLocation ? locationType || 'location' : organizationType || 'organization'}
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
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isLocation && onAddSubOrganization && (
                <DropdownMenuItem onClick={handleAddSubOrg}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Sub-Organization
                </DropdownMenuItem>
              )}
              {onAddLocation && (
                <DropdownMenuItem onClick={handleAddLoc}>
                  <MapPin className="w-4 h-4 mr-2" />
                  Add Location
                </DropdownMenuItem>
              )}
              {/* Credit Allocation - only for organizations and locations */}
              {(entityType === 'organization' || entityType === 'location') && onAllocateCredits && (
                <DropdownMenuItem onClick={handleAllocateCredits}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Allocate Credits
                </DropdownMenuItem>
              )}
              {!isLocation && onTransferCredits && (
                <DropdownMenuItem onClick={handleTransferCredits}>
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Transfer Credits
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {onEditOrganization && (
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDeleteOrganization && !isPrimaryOrganization && (
                <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {description && (
          <p className="text-xs text-gray-600 mb-2 line-clamp-2">{description}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
          {entityLevel > 0 && (
            <Badge variant="outline" className="text-xs">
              Level {entityLevel}
            </Badge>
          )}
        </div>

        {(availableCredits !== undefined && availableCredits !== null) && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Credits:</span>
              <div className="flex gap-2">
                  <span className="text-green-600 font-medium">
                  {typeof availableCredits === 'number' 
                    ? availableCredits.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : parseFloat(String(availableCredits || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                  } available
                  </span>
                {reservedCredits !== undefined && reservedCredits !== null && reservedCredits > 0 && (
                  <span className="text-orange-600 font-medium">
                    {typeof reservedCredits === 'number'
                      ? reservedCredits.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : parseFloat(String(reservedCredits || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                    } reserved
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Handle type="source" position={Position.Bottom} className="!bg-[#1B2E5A] !w-3 !h-3" />
    </>
  );
}

