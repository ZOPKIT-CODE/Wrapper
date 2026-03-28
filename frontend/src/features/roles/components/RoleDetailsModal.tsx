import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DashboardRole } from '@/types/role-management';
import { getPermissionSummary, formatRoleDate } from '../utils/permissionUtils';
import { EnhancedPermissionSummary } from './EnhancedPermissionSummary';

interface RoleDetailsModalProps {
  role: DashboardRole | null;
  isOpen: boolean;
  onClose: () => void;
}

// Normalize permissions - convert JSON strings to objects
const normalizePermissions = (permissions: any): Record<string, any> | string[] => {
  if (typeof permissions === 'string') {
    try {
      return JSON.parse(permissions);
    } catch (error) {
      console.error('Failed to parse permissions JSON string:', error);
      return {};
    }
  }
  return permissions;
};

export function RoleDetailsModal({ role, isOpen, onClose }: RoleDetailsModalProps) {
  if (!role) return null;

  // Normalize permissions before calculating summary
  const normalizedPermissions = normalizePermissions(role.permissions);
  const permissionSummary = getPermissionSummary(normalizedPermissions);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold"
              style={{ backgroundColor: `${role.color}20`, color: role.color }}
            >
              {role.metadata?.icon || '👤'}
            </div>
            {role.roleName}
          </DialogTitle>
          <DialogDescription>
            View detailed information about this role and its permissions
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-[#1B2E5A] mb-2">Basic Information</h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Name:</span> {role.roleName}</div>
                <div><span className="font-medium">Type:</span> {role.isSystemRole ? 'System' : 'Custom'}</div>
                <div><span className="font-medium">Created:</span> {formatRoleDate(role.createdAt)}</div>
                <div><span className="font-medium">Updated:</span> {formatRoleDate(role.updatedAt)}</div>
              </div>
              
              {role.description && (
                <div className="mt-4">
                  <h4 className="font-semibold text-[#1B2E5A] mb-2">Description</h4>
                  <p className="text-sm text-gray-600">{role.description}</p>
                </div>
              )}
            </div>
            
            <div>
              <h4 className="font-semibold text-[#1B2E5A] mb-2">Permission Summary</h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Total Permissions:</span> {permissionSummary.total}</div>
                <div><span className="font-medium">Applications:</span> {permissionSummary.applicationCount}</div>
                <div><span className="font-medium">Modules:</span> {permissionSummary.moduleCount}</div>
                <div><span className="font-medium">Users:</span> {role.userCount || 0}</div>
              </div>
            </div>
          </div>

          {/* Enhanced Permission Details */}
          <EnhancedPermissionSummary 
            permissions={normalizedPermissions}
            roleName={role.roleName}
            restrictions={role.restrictions}
            isSystemRole={role.isSystemRole}
            userCount={role.userCount || 0}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
