import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Edit,
  Trash2,
  MapPin,
  ChevronRight,
  ChevronDown,
  ArrowRightLeft
} from 'lucide-react';
import { Organization, Location } from '@/types/organization';

interface TreeNodeProps {
  org: Organization | Location;
  level?: number;
  isAdmin: boolean;
  selectedItems: string[];
  onSelect: (checked: boolean, entityId: string) => void;
  onAddSubOrganization: (org: Organization) => void;
  onAddLocation: (org: Organization) => void;
  onEditOrganization: (org: Organization) => void;
  onDeleteOrganization: (entityId: string, entityName: string) => void;
  onTransferCredits: (org: Organization) => void;
}

export function TreeNode({
  org,
  level = 0,
  isAdmin,
  selectedItems,
  onSelect,
  onAddSubOrganization,
  onAddLocation,
  onEditOrganization,
  onDeleteOrganization,
  onTransferCredits
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(level < 2);
  const orgChildren = (org as Organization).children;
  const hasChildren = orgChildren && Array.isArray(orgChildren) && orgChildren.length > 0;
  const canTransfer = hasChildren;
  const isLocation = (org as any).entityType === 'location';
  const isSelected = selectedItems.includes((org as any).entityId);
  const isRootOrg = !isLocation && !(org as any).parentEntityId && !(org as any).parentOrganizationId;

  // Safety check for required properties
  if (!org || !(org as any).entityId || !(org as any).entityName) {
    console.warn('TreeNode received invalid organization data:', org);
    return null;
  }

  const handleSelect = (checked: boolean) => {
    onSelect(checked, (org as any).entityId);
  };

  const getNodeStyles = () => {
    const baseStyles = "flex items-center border rounded-lg mb-2 cursor-pointer transition-colors";

    // Tree view styling only
    const levelStyles = level === 0 && !isLocation ? 'bg-blue-50 border-blue-200' : '';
    const locationStyles = isLocation ? 'bg-gradient-to-r from-green-50 to-blue-50 border-green-200' : 'bg-white border-gray-200';
    const selectionStyles = isSelected ? 'ring-2 ring-blue-400 bg-blue-50' : '';

    return `${baseStyles} p-3 hover:bg-gray-50 ${levelStyles} ${locationStyles} ${selectionStyles}`;
  };

  return (
    <div className="select-none">
      <div
        className={getNodeStyles()}
        style={{ marginLeft: `${level * 20}px` }}
        onClick={undefined}
      >
        {/* Selection Checkbox */}
        <div className="w-6 flex items-center justify-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => handleSelect(e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>

        {/* Expand/Collapse Icon */}
        <div className="w-6 flex items-center justify-center">
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="w-4 h-4 flex items-center justify-center hover:bg-gray-200 rounded"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          ) : (
            <div className="w-4 h-4" />
          )}
        </div>

        {/* Entity Icon */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold mr-3 ${
          isLocation
            ? 'bg-gradient-to-r from-green-500 to-blue-500'
            : 'bg-gradient-to-r from-blue-500 to-purple-600'
        }`}>
          {isLocation ? '📍' : ((org as any).entityName?.charAt(0)?.toUpperCase() || '?')}
        </div>

        {/* Organization Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-[#1B2E5A] truncate">{(org as any).entityName || 'Unknown'}</span>
            <Badge variant={(org as any).isActive !== false ? "default" : "secondary"} className="text-xs">
              {(org as any).entityType || 'unknown'}
            </Badge>
            <Badge variant={(org as any).isActive !== false ? "default" : "destructive"} className="text-xs">
              {(org as any).isActive !== false ? 'Active' : 'Inactive'}
            </Badge>
            {canTransfer && (
              <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                💰 Can Transfer
              </Badge>
            )}
          </div>
          <div className="text-sm text-gray-600 truncate">
            Level {(org as any).entityLevel || 1} • {(org as any).hierarchyPath || (org as any).entityId}
          </div>
          {(org as Organization).description && (
            <div className="text-xs text-gray-500 truncate mt-1">{(org as Organization).description}</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-4">
          {!isLocation && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSubOrganization(org as Organization);
                }}
                title="Add sub-organization"
              >
                <Plus className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddLocation(org as Organization);
                }}
                title="Add location"
              >
                <MapPin className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onTransferCredits(org as Organization);
                }}
                title={canTransfer ? "Transfer credits to child entities" : "No child entities available for transfer"}
                disabled={!canTransfer}
                className={canTransfer ? "" : "opacity-50 cursor-not-allowed"}
              >
                <ArrowRightLeft className={`w-4 h-4 ${canTransfer ? "" : "text-gray-400"}`} />
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (isLocation) {
                // Handle location edit
              } else {
                onEditOrganization(org as Organization);
              }
            }}
            title={isLocation ? "Edit location" : "Edit organization"}
          >
            <Edit className="w-4 h-4" />
          </Button>

          {isAdmin && !isLocation && !isRootOrg && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteOrganization((org as any).entityId, (org as any).entityName);
              }}
              title="Delete organization"
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="ml-4">
          {orgChildren?.map((child: any) => {
            if (!child || !(child as any).entityId) {
              console.warn('Invalid child in hierarchy:', child);
              return null;
            }
            return (
              <TreeNode
                key={(child as any).entityId}
                org={child}
                level={level + 1}
                isAdmin={isAdmin}
                selectedItems={selectedItems}
                onSelect={onSelect}
                onAddSubOrganization={onAddSubOrganization}
                onAddLocation={onAddLocation}
                onEditOrganization={onEditOrganization}
                onDeleteOrganization={onDeleteOrganization}
                onTransferCredits={onTransferCredits}
              />
            );
          }).filter(Boolean)}
        </div>
      )}
    </div>
  );
}
