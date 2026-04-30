import React from 'react';
import { 
  Users, 
  MoreVertical, 
  Edit, 
  Copy, 
  Trash2, 
  Eye, 
  Package 
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DashboardRole, RoleRowActions } from '@/types/role-management';
import { getPermissionSummary, getPermissionTypeColor, getPermissionTypeTextColor, formatRoleDate, canEditRole, canDeleteRole } from '../utils/permissionUtils';

interface RoleRowProps {
  role: DashboardRole;
  isSelected: boolean;
  onToggleSelect: () => void;
  actions: RoleRowActions;
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

export function RoleRow({ 
  role, 
  isSelected, 
  onToggleSelect, 
  actions 
}: RoleRowProps) {
  // Normalize permissions before calculating summary
  const normalizedPermissions = normalizePermissions(role.permissions);
  const permissionSummary = getPermissionSummary(normalizedPermissions);

  // Use computed fields from API if available, otherwise fall back to calculation
  const displayCount = (role as any).permissionCount || permissionSummary.total;
  const displayModules = (role as any).moduleCount || permissionSummary.modules;
  const displayApps = (role as any).applicationCount || permissionSummary.mainModules;

  const canEdit = canEditRole(role);
  const canDelete = canDeleteRole(role);

  return (
    <div className="grid grid-cols-12 gap-4 p-6 transition-colors" style={{ '--tw-bg-opacity': '1' } as React.CSSProperties} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--zk-bg-2)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}>
      <div className="flex items-center">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
        />
      </div>
      
      <div className="col-span-5 flex items-center gap-4">
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-semibold"
          style={{ backgroundColor: `${role.color}20`, color: role.color }}
        >
          {role.metadata?.icon || '👤'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate" style={{ fontFamily: 'var(--zk-display)', fontWeight: 600, fontSize: 14, letterSpacing: '-0.025em', color: 'var(--zk-ink)' }}>{role.roleName}</div>
          <div className="text-sm truncate" style={{ fontFamily: 'var(--zk-font)', fontSize: 13, color: 'var(--zk-muted)' }}>
            {role.description}
          </div>
        </div>
      </div>
      
      <div className="col-span-4 space-y-2">
        <div className="space-y-2">
          {/* Users and Modules Summary */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{role.userCount || 0}</span>
              <span className="text-gray-500">users</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-500" />
              <span style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--zk-ink)' }}>{displayModules}</span>
              <span style={{ color: 'var(--zk-muted)', fontSize: 13 }}>modules</span>
              <span style={{ fontFamily: 'var(--zk-mono)', fontSize: 11, color: 'var(--zk-muted-2)' }}>({displayApps} apps)</span>
            </div>
          </div>
          
          {/* Enhanced Permission Breakdown */}
          <div className="flex items-center gap-3">
            {permissionSummary.admin > 0 && (
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${getPermissionTypeColor('admin')}`}></div>
                <span className={`text-xs font-medium ${getPermissionTypeTextColor('admin')}`}>
                  {permissionSummary.admin}
                </span>
                <span className="text-xs text-gray-500">admin</span>
              </div>
            )}
            {permissionSummary.write > 0 && (
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${getPermissionTypeColor('write')}`}></div>
                <span className={`text-xs font-medium ${getPermissionTypeTextColor('write')}`}>
                  {permissionSummary.write}
                </span>
                <span className="text-xs text-gray-500">write</span>
              </div>
            )}
            {permissionSummary.read > 0 && (
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${getPermissionTypeColor('read')}`}></div>
                <span className={`text-xs font-medium ${getPermissionTypeTextColor('read')}`}>
                  {permissionSummary.read}
                </span>
                <span className="text-xs text-gray-500">read</span>
              </div>
            )}
          </div>
          
          {/* Total Operations */}
          <div style={{ fontFamily: 'var(--zk-mono)', fontSize: 11, color: 'var(--zk-muted-2)' }}>
            {displayCount} total permissions
          </div>
          
          {/* Module Names Preview */}
          {permissionSummary.moduleNames.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {permissionSummary.moduleNames.slice(0, 3).map((module, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {module.split('.')[0]}
                </Badge>
              ))}
              {permissionSummary.moduleNames.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{permissionSummary.moduleNames.length - 3} more
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="col-span-2 flex items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={role.isSystemRole ? "default" : "secondary"}>
              {role.isSystemRole ? 'System' : 'Custom'}
            </Badge>
            {role.isDefault && (
              <Badge variant="outline">Default</Badge>
            )}
          </div>
          <div style={{ fontFamily: 'var(--zk-mono)', fontSize: 11, color: 'var(--zk-muted-2)' }}>
            Created: {formatRoleDate(role.createdAt)}
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => actions.onView(role)}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            {canEdit && (
              <DropdownMenuItem onClick={() => actions.onEdit(role)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Role
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => actions.onClone(role)}>
              <Copy className="h-4 w-4 mr-2" />
              Clone Role
            </DropdownMenuItem>
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => actions.onDelete(role)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Role
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
