import React, { useState, useEffect, useMemo } from 'react';
import { Building2, Plus, Trash2, RefreshCw, AlertCircle, Building, ChevronRight, ChevronDown, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganizationHierarchy } from '@/hooks/useOrganizationHierarchy';
import { useOrganizationAuth } from '@/hooks/useOrganizationAuth';

interface User {
  userId: string;
  email: string;
  name: string;
}

interface Entity {
  entityId: string;
  entityName: string;
  entityType: 'organization' | 'location' | 'department' | 'team';
  hierarchyPath?: string;
  fullHierarchyPath?: string;
  parentEntityId?: string | null;
  children?: Entity[];
}

interface UserOrganizationManagerProps {
  userId: string;
  user: User | null;
  onChange?: () => void;
}

// Tree Node Component for displaying hierarchy
const EntityTreeNode: React.FC<{
  entity: Entity;
  level: number;
  assignedIds: Set<string>;
  onAssign: (entityId: string) => void;
  onRemove: (assignmentId: string, entityName: string) => void;
  assignments: any[];
  assigning: boolean;
}> = ({ entity, level, assignedIds, onAssign, onRemove, assignments, assigning }) => {
  const [expanded, setExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const isAssigned = assignedIds.has(entity.entityId);
  const isLocation = entity.entityType === 'location';
  const assignment = assignments.find(a => (a.organizationId || a.entityId) === entity.entityId);
  const hasChildren = entity.children && entity.children.length > 0;

  const indent = level * 20;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
          isAssigned
            ? 'bg-[#1B2E5A]/5 border-[#1B2E5A]/20'
            : 'bg-white border-gray-200 hover:bg-gray-50'
        }`}
        style={{ marginLeft: `${indent}px` }}
      >
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            )}
          </button>
        ) : (
          <div className="w-6" /> // Spacer for alignment
        )}

        {/* Entity Icon */}
        <div className={`p-1.5 rounded ${
          isLocation
            ? 'bg-green-100 text-green-600'
            : 'bg-[#1B2E5A]/10 text-[#1B2E5A]'
        }`}>
          {isLocation ? (
            <MapPin className="w-4 h-4" />
          ) : (
            <Building className="w-4 h-4" />
          )}
        </div>

        {/* Entity Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium text-sm truncate ${
              isAssigned ? 'text-blue-900' : 'text-[#1B2E5A]'
            }`} title={entity.entityName}>
              {entity.entityName}
            </span>
            {isLocation && (
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded">
                Location
              </span>
            )}
            {assignment?.isPrimary && (
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold uppercase rounded">
                Primary
              </span>
            )}
          </div>
          {entity.hierarchyPath && (
            <span className="text-xs text-gray-500 truncate block" title={entity.hierarchyPath}>
              {entity.hierarchyPath}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {isAssigned ? (
            <button
              onClick={() => {
                if (assignment && !assignment.isPrimary) {
                  onRemove(assignment.assignmentId || assignment.membershipId, entity.entityName);
                }
              }}
              disabled={assigning || assignment?.isPrimary}
              className={`p-1.5 rounded transition-colors ${
                assignment?.isPrimary
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-red-600 hover:bg-red-50'
              }`}
              title={assignment?.isPrimary ? 'Cannot remove primary organization' : 'Remove access'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => onAssign(entity.entityId)}
              disabled={assigning}
              className="p-1.5 bg-[#1B2E5A]/5 text-[#1B2E5A] hover:bg-[#1B2E5A]/10 rounded transition-colors disabled:opacity-50"
              title="Assign organization"
            >
              {assigning ? (
                <div className="animate-spin w-3 h-3 border-2 border-[#1B2E5A] border-t-transparent rounded-full"></div>
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="mt-1">
          {entity.children!.map((child) => (
            <EntityTreeNode
              key={child.entityId}
              entity={child}
              level={level + 1}
              assignedIds={assignedIds}
              onAssign={onAssign}
              onRemove={onRemove}
              assignments={assignments}
              assigning={assigning}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const UserOrganizationManager: React.FC<UserOrganizationManagerProps> = ({ 
  userId, 
  onChange 
}) => {
  const queryClient = useQueryClient();
  const { tenantId } = useOrganizationAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  
  // Use shared hook for organization hierarchy
  const { hierarchy, loading: loadingHierarchy } = useOrganizationHierarchy(tenantId);

  useEffect(() => {
    if (userId) {
      loadAssignments();
    }
  }, [userId]);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/users/${userId}/organizations`);
      if (response.data.success) {
        setAssignments(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load organization assignments:', error);
      toast.error('Failed to load organization assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (entityId: string) => {
    try {
      setAssigning(true);
      const response = await api.post('/admin/users/assign-organization', {
        userId,
        organizationId: entityId,
        assignmentType: 'secondary'
      });

      if (response.data.success) {
        toast.success('Organization assigned successfully');
        await loadAssignments();
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['organization-assignments'] });
        onChange?.();
      } else {
        toast.error(response.data.message || 'Failed to assign organization');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to assign organization');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async (assignmentId: string, entityName: string) => {
    if (!confirm(`Remove access to ${entityName}?`)) return;

    try {
      setAssigning(true);
      const response = await api.delete(`/admin/users/${userId}/organizations/${assignmentId}`);

      if (response.data.success) {
        toast.success('Organization access removed');
        await loadAssignments();
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['organization-assignments'] });
        onChange?.();
      } else {
        toast.error(response.data.message || 'Failed to remove organization');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove organization');
    } finally {
      setAssigning(false);
    }
  };

  // Create a set of assigned entity IDs for quick lookup
  const assignedIds = useMemo(() => {
    return new Set(assignments.map(a => a.organizationId || a.entityId));
  }, [assignments]);

  // Flatten hierarchy to show all entities (organizations and locations)
  const renderHierarchy = () => {
    if (!hierarchy || hierarchy.length === 0) {
      return (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
          <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No organizations or locations found</p>
        </div>
      );
    }

    return (
      <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2">
        {hierarchy.map((entity) => (
          <EntityTreeNode
            key={entity.entityId}
            entity={entity as Entity}
            level={0}
            assignedIds={assignedIds}
            onAssign={handleAssign}
            onRemove={handleRemove}
            assignments={assignments}
            assigning={assigning}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#1B2E5A]" />
          <h3 className="font-semibold text-[#1B2E5A] dark:text-white">Organization & Location Access</h3>
        </div>
        <button
          onClick={loadAssignments}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary */}
      <div className="bg-[#1B2E5A]/5 dark:bg-[#1B2E5A]/10 border border-[#1B2E5A]/20 dark:border-[#1B2E5A]/20 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm">
          <Building2 className="w-4 h-4 text-[#1B2E5A]" />
          <span className="text-gray-700 dark:text-gray-300">
            <strong>{assignments.length}</strong> organization{assignments.length !== 1 ? 's' : ''} assigned
          </span>
        </div>
      </div>

      {/* Hierarchy Tree */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Organization & Location Hierarchy
        </h4>
        {loadingHierarchy ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#1B2E5A] border-t-transparent mx-auto"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading hierarchy...</p>
          </div>
        ) : (
          renderHierarchy()
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1">
          <Building className="w-3 h-3 text-[#1B2E5A]" />
          <span>Organization</span>
        </div>
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3 text-green-600" />
          <span>Location</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-purple-100 border border-purple-300"></div>
          <span>Primary</span>
        </div>
      </div>
    </div>
  );
};

