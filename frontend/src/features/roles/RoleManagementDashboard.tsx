import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ShieldPlus, MoreVertical, Eye, Edit, Copy, Trash2, Search, Download, Archive, RefreshCw, Shield, Plus, Crown, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PearlButton } from '@/components/ui/pearl-button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { ApplicationModuleRoleBuilder } from './ApplicationModuleRoleBuilder';
import api, { Role } from '@/lib/api';
import { usePermissionRefreshTrigger } from '@/features/roles/PermissionRefreshNotification';
import { useQueryClient } from '@tanstack/react-query';
import { EnhancedPermissionSummary } from './EnhancedPermissionSummary';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useRoles, useInvalidateQueries } from '@/hooks/useSharedQueries';
import { getPermissionSummary as getPermissionSummaryUtil } from './utils/permissionUtils';
import { cn } from '@/lib/utils';
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

// Use the enhanced Role interface from api.ts - no need for separate DashboardRole
type DashboardRole = Role;

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

// Utility function to handle both permission formats and provide consistent summaries
const getPermissionSummary = (permissions: Record<string, any> | string[]) => {
  // Normalize permissions first
  const normalizedPerms = normalizePermissions(permissions);
  // Use the imported utility function
  return getPermissionSummaryUtil(normalizedPerms);
};

export function RoleManagementDashboard() {
  const { actualTheme } = useTheme();
  const queryClient = useQueryClient();
  const { triggerRefresh } = usePermissionRefreshTrigger();
  const navigate = useNavigate();

  // State management
  const [roles, setRoles] = useState<DashboardRole[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingRole, setDeletingRole] = useState<{ id: string; name: string } | null>(null);
  const [showRoleBuilder, setShowRoleBuilder] = useState(false);
  const [showAppModuleBuilder, setShowAppModuleBuilder] = useState(false);
  const [editingRole, setEditingRole] = useState<DashboardRole | null>(null);

  // Enhanced filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'custom' | 'system'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'users' | 'modified'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Use shared hook with caching instead of direct API calls
  const { data: rolesData = [], isLoading: rolesLoading, isFetching: rolesFetching, refetch: refetchRoles } = useRoles({
    search: searchQuery,
    type: typeFilter !== 'all' ? typeFilter : undefined
  });
  const showRolesLoading = rolesLoading || (rolesFetching && rolesData.length === 0);
  const { invalidateRoles } = useInvalidateQueries();

  // Sync roles data to local state for compatibility with pagination/filtering
  useEffect(() => {
    if (rolesData.length > 0) {
      // Normalize permissions for all roles (convert JSON strings to objects)
      const normalizedRoles = rolesData.map(role => ({
        ...role,
        permissions: normalizePermissions(role.permissions),
        restrictions: typeof role.restrictions === 'string'
          ? (() => {
            try {
              return JSON.parse(role.restrictions);
            } catch {
              return {};
            }
          })()
          : role.restrictions
      }));

      // Apply client-side pagination and sorting for now
      // TODO: Move pagination to server-side for better performance
      let filteredRoles = [...normalizedRoles];

      // Apply sorting
      filteredRoles.sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortBy) {
          case 'name':
            aVal = a.roleName?.toLowerCase() || '';
            bVal = b.roleName?.toLowerCase() || '';
            break;
          case 'created':
            aVal = new Date(a.createdAt || 0).getTime();
            bVal = new Date(b.createdAt || 0).getTime();
            break;
          case 'modified':
            aVal = new Date(a.updatedAt || a.createdAt || 0).getTime();
            bVal = new Date(b.updatedAt || b.createdAt || 0).getTime();
            break;
          default:
            aVal = a.roleName?.toLowerCase() || '';
            bVal = b.roleName?.toLowerCase() || '';
        }

        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
      });

      // Apply pagination
      const startIndex = (currentPage - 1) * pageSize;
      const paginatedRoles = filteredRoles.slice(startIndex, startIndex + pageSize);

      setRoles(paginatedRoles);
      setTotalCount(filteredRoles.length);
      setTotalPages(Math.ceil(filteredRoles.length / pageSize));
    }
  }, [rolesData, currentPage, pageSize, sortBy, sortOrder]);

  // Load roles function - now uses shared hook
  const loadRoles = async () => {
    invalidateRoles();
    await refetchRoles();
  };

  const handleCreateRole = () => {
    navigate({ to: '/dashboard/roles/new' });
  };

  const handleEditRole = useCallback(async (role: DashboardRole) => {
    // Check if it's a system role
    if (role.isSystemRole) {
      if (role.roleName === 'Super Administrator') {
        // toast.error('Super Administrator role cannot be edited. This role has predefined comprehensive permissions.');
        return;
      } else {
        toast.error('System roles cannot be edited. Please create a custom role instead.');
      }
      return;
    }

    navigate({ to: `/dashboard/roles/${role.roleId}/edit` });
  }, []);

  const handleViewRole = useCallback((role: DashboardRole) => {
    navigate({ to: `/dashboard/roles/${role.roleId}` });
  }, [navigate]);

  const handleCloneRole = useCallback(async (role: DashboardRole) => {
    // Navigate to create page with cloned role data in state
    // The RoleBuilderPage will handle loading the role if needed
    navigate({ to: `/dashboard/roles/new?clone=${role.roleId}` });
  }, [navigate]);

  const handleDeleteRole = useCallback((role: DashboardRole) => {
    setDeletingRole({ id: role.roleId, name: role.roleName });
    setShowDeleteModal(true);
  }, []);

  const deleteRole = useCallback(async (roleId: string) => {
    try {
      // Always send force=true to actually delete the role (user already confirmed in modal)
      const response = await api.delete(`/permissions/roles/${roleId}?force=true`);
      if (response.data.success) {
        toast.success('Role deleted successfully');
        invalidateRoles();
        await refetchRoles();
        triggerRefresh();
      } else {
        toast.error(response.data.error || 'Failed to delete role');
      }
    } catch (error: any) {
      console.error('Failed to delete role:', error);
      toast.error(error.response?.data?.message || 'Failed to delete role');
      throw error;
    }
  }, [triggerRefresh, invalidateRoles, refetchRoles, searchQuery, typeFilter]);

  const bulkDeleteRoles = useCallback(async (roleIds: string[]) => {
    try {
      const response = await api.post('/permissions/roles/bulk-delete', { roleIds });
      if (response.data.success) {
        toast.success(`${roleIds.length} role(s) deleted successfully`);
        invalidateRoles();
        await refetchRoles();
        triggerRefresh();
      } else {
        toast.error(response.data.error || 'Failed to delete roles');
      }
    } catch (error: any) {
      console.error('Failed to delete roles:', error);
      toast.error(error.response?.data?.message || 'Failed to delete roles');
      throw error;
    }
  }, [triggerRefresh]);

  const confirmDeleteRole = useCallback(async () => {
    if (!deletingRole) return;

    try {
      await deleteRole(deletingRole.id);
      setSelectedRoles(prev => {
        const newSet = new Set(prev);
        newSet.delete(deletingRole.id);
        return newSet;
      });
    } catch (error) {
      console.error('Failed to delete role:', error);
    } finally {
      setShowDeleteModal(false);
      setDeletingRole(null);
    }
  }, [deletingRole, deleteRole]);

  const handleBulkAction = useCallback(async (action: BulkAction, selectedIds: string[]) => {
    if (selectedIds.length === 0) return;

    try {
      switch (action) {
        case 'delete':
          await bulkDeleteRoles(selectedIds);
          break;
        case 'export':
          // Implementation for export functionality
          toast.info('Export feature coming soon!');
          break;
        case 'deactivate':
          // Implementation for deactivate functionality
          toast.info('Deactivate feature coming soon!');
          break;
        default:
          return;
      }

      setSelectedRoles(new Set());
    } catch (error) {
      console.error(`Failed to ${action} roles:`, error);
    }
  }, [bulkDeleteRoles]);

  const handleRoleSave = useCallback(async (roleData: any) => {
    // Check if this is a success callback from ApplicationModuleRoleBuilder
    const isSuccessCallback = roleData.roleId && (roleData.selectedApps || roleData.roleName);

    if (isSuccessCallback) {
      // The role has already been created/updated, refresh the list and close

      try {
        invalidateRoles();
        await refetchRoles(); // Force immediate refetch
      } catch (error) {
        console.error('⚠️ Failed to refresh roles:', error);
      }

      setShowRoleBuilder(false);
      setShowAppModuleBuilder(false);
      setEditingRole(null);
      return;
    }

    try {
      let response;
      let payload: any;

      // Check if this data is coming from AdvancedRoleBuilder or ApplicationModuleRoleBuilder
      const isAdvancedRoleBuilder = roleData.permissions && typeof roleData.permissions === 'object' &&
        roleData.restrictions && typeof roleData.restrictions === 'object' &&
        !roleData.selectedApps; // AdvancedRoleBuilder doesn't have selectedApps

      const isApplicationModuleBuilder = roleData.selectedApps && roleData.selectedModules && roleData.selectedPermissions;

      if (isAdvancedRoleBuilder) {
        // Data from AdvancedRoleBuilder - transform to proper format for /roles endpoint
        payload = {
          name: roleData.name,
          description: roleData.description,
          color: roleData.color,
          icon: roleData.icon,
          permissions: roleData.permissions,
          restrictions: roleData.restrictions, // Already in correct object format
          inheritance: roleData.inheritance,
          metadata: roleData.metadata
        };

        if (payload.roleId || editingRole?.roleId) {
          const roleId = payload.roleId || editingRole?.roleId;
          delete payload.roleId; // Remove roleId from payload as it's in the URL
          response = await api.put(`/permissions/roles/${roleId}`, payload);
        } else {
          delete payload.roleId;
          response = await api.post('/permissions/roles', payload);
        }

      } else if (isApplicationModuleBuilder) {
        // Data from ApplicationModuleRoleBuilder - use custom role service endpoints
        payload = { ...roleData };

        if (payload.roleId || editingRole?.roleId) {
          const roleId = payload.roleId || editingRole?.roleId;
          delete payload.roleId;
          response = await api.put(`/custom-roles/update-from-builder/${roleId}`, payload);
        } else {
          delete payload.roleId;
          response = await api.post('/custom-roles/create-from-builder', payload);
        }

      } else {
        // Fallback for other sources - use general roles endpoint
        payload = { ...roleData };

        if (payload.roleId || editingRole?.roleId) {
          const roleId = payload.roleId || editingRole?.roleId;
          delete payload.roleId;
          response = await api.put(`/permissions/roles/${roleId}`, payload);
        } else {
          delete payload.roleId;
          response = await api.post('/permissions/roles', payload);
        }
      }

      if (response.data.success) {

        // Invalidate and refetch roles data to show updated list
        try {
          invalidateRoles();
          await refetchRoles(); // Force immediate refetch
        } catch (error) {
          console.error('⚠️ Failed to refresh roles:', error);
          // Fallback: Force page reload if cache invalidation fails
          window.location.reload();
        }

        // Reset state
        setShowRoleBuilder(false);
        setShowAppModuleBuilder(false);
        setEditingRole(null);

        toast.success(editingRole ? 'Role updated successfully!' : 'Role created successfully!');
      } else {
        console.error('❌ Role save failed:', response.data);
        toast.error(response.data.error || 'Failed to save role');
      }
    } catch (error: any) {
      console.error('🚨 Error in handleRoleSave:', error);

      // Check if it's a validation error about restrictions
      if (error.response?.status === 400 && error.response?.data?.message?.includes('restrictions must be object')) {
        toast.error('Invalid role restrictions format. Please check your role configuration.');
      } else {
        toast.error(error.response?.data?.message || error.message || 'Failed to save role');
      }
    }
  }, [editingRole, queryClient, loadRoles]);

  const toggleRoleSelection = useCallback((roleId: string) => {
    setSelectedRoles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roleId)) {
        newSet.delete(roleId);
      } else {
        newSet.add(roleId);
      }
      return newSet;
    });
  }, []);

  const selectAllRoles = useCallback(() => {
    setSelectedRoles(new Set(roles.map(r => r.roleId)));
  }, [roles]);

  const clearSelection = useCallback(() => {
    setSelectedRoles(new Set());
  }, []);

  const filteredRoles = useMemo(() => {

    return (roles || []).filter(role => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = role.roleName.toLowerCase().includes(query);
        const matchesDescription = role.description?.toLowerCase().includes(query);

        if (!matchesName && !matchesDescription) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'system' && !role.isSystemRole) return false;
        if (typeFilter === 'custom' && role.isSystemRole) return false;
      }

      return true;
    });
  }, [roles, searchQuery, typeFilter]);

  // Enhanced Role Row Component with single-line robustness
  const RoleRow = ({
    role,
    isSelected,
    onToggleSelect
  }: {
    role: Role;
    isSelected: boolean;
    onToggleSelect: () => void;
  }) => {
    const { actualTheme } = useTheme();
    const permissionSummary = getPermissionSummary(role.permissions);
    const isReadOnlyRole = role.roleName === 'Organization Admin';

    // Use computed fields from API if available
    const displayCount = (role as any).permissionCount || permissionSummary.total;
    const displayModules = (role as any).moduleCount || permissionSummary.modules;
    const displayApps = (role as any).applicationCount || permissionSummary.mainModules;

    return (
      <tr
        className={cn(
          "group transition-all duration-200 last:border-0",
          actualTheme === 'dark'
            ? "hover:bg-slate-800/60"
            : actualTheme === 'monochrome'
              ? "hover:bg-gray-800/50"
              : "hover:bg-slate-50/80"
        )}
      >
        <td className="px-5 py-4 align-middle">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className={cn(
              actualTheme === 'dark' ? "border-purple-500/30 data-[state=checked]:bg-purple-600" :
                actualTheme === 'monochrome' ? "border-gray-500/30 data-[state=checked]:bg-gray-600" : ""
            )}
          />
        </td>

        <td className="px-5 py-4 align-middle">
          <div className="flex items-center gap-4 min-w-[240px]">
            <div
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm ring-1 ring-black/5",
                !role.color && "bg-[#1B2E5A]/10 text-[#1B2E5A] dark:bg-[#1B2E5A]/20 dark:text-[#4A6FA5]"
              )}
              style={role.color ? { backgroundColor: `${role.color}18`, color: role.color, border: `1px solid ${role.color}25` } : undefined}
            >
              {role.metadata?.icon ? (
                <span className="text-base">{role.metadata.icon}</span>
              ) : (
                <Crown className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn(
                "font-semibold truncate text-sm",
                actualTheme === 'dark' ? "text-white" : actualTheme === 'monochrome' ? "text-gray-100" : "text-[#1B2E5A]"
              )} title={role.roleName}>
                {role.roleName}
              </div>
              <div
                className={cn(
                  "text-xs truncate max-w-[220px]",
                  actualTheme === 'dark' ? "text-slate-400" : actualTheme === 'monochrome' ? "text-gray-400" : "text-slate-500"
                )}
                title={role.description || 'No description provided'}
              >
                {role.description || 'No description provided'}
              </div>
            </div>
          </div>
        </td>

        <td className="px-5 py-4 align-middle text-center">
          <Badge variant="outline" className={cn(
            "font-mono font-medium",
            actualTheme === 'dark' ? "bg-purple-500/10 border-purple-500/30 text-purple-200" :
              actualTheme === 'monochrome' ? "bg-gray-500/10 border-gray-500/30 text-gray-200" :
                "bg-slate-100 border-slate-200 text-slate-700"
          )}>
            {role.userCount || 0}
          </Badge>
        </td>

        <td className="px-5 py-4 align-middle text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-wider opacity-50 font-bold">Apps</span>
              <span className="text-sm font-bold">{displayApps}</span>
            </div>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-wider opacity-50 font-bold">Modules</span>
              <span className="text-sm font-bold">{displayModules}</span>
            </div>
          </div>
        </td>

        <td className="px-5 py-4 align-middle">
          <div className="flex flex-wrap items-center gap-2 justify-center">
            {permissionSummary.admin > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20" title="Admin Permissions">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400">{permissionSummary.admin}</span>
              </div>
            )}
            {permissionSummary.write > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20" title="Write Permissions">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">{permissionSummary.write}</span>
              </div>
            )}
            {permissionSummary.read > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20" title="Read Permissions">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{permissionSummary.read}</span>
              </div>
            )}
            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium ml-1">
              {displayCount} total
            </div>
          </div>
        </td>

        <td className="px-5 py-4 align-middle text-center">
          <div className="flex flex-col items-center gap-1">
            <Badge
              variant={role.isSystemRole ? "default" : "secondary"}
              className={cn(
                "text-[10px] h-5 uppercase tracking-tighter font-medium",
                actualTheme === 'dark'
                  ? role.isSystemRole ? "bg-[#1B2E5A]/30 text-blue-300 border-blue-500/40" : "bg-slate-700 text-slate-300 border-slate-600"
                  : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
              )}
            >
              {role.isSystemRole ? 'System' : 'Custom'}
            </Badge>
            <span className="text-[9px] font-medium opacity-50 whitespace-nowrap">
              {new Date(role.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </td>

        <td className="px-5 py-4 align-middle text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:ring-1 hover:ring-slate-200 dark:hover:ring-slate-600"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={cn(
                "w-48 z-50",
                actualTheme === 'dark' ? "bg-slate-900 border-purple-500/30" :
                  actualTheme === 'monochrome' ? "bg-gray-900 border-gray-500/30" : ""
              )}
            >
              <DropdownMenuItem onClick={() => handleViewRole(role)} className="gap-2">
                <Eye className="h-4 w-4" /> View Details
              </DropdownMenuItem>
              {!isReadOnlyRole && (
                <>
                  <DropdownMenuItem onClick={() => handleEditRole(role)} className="gap-2">
                    <Edit className="h-4 w-4" /> Edit Role
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCloneRole(role)} className="gap-2">
                    <Copy className="h-4 w-4" /> Clone Role
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDeleteRole(role)}
                    className="gap-2 text-rose-500 focus:text-rose-400 focus:bg-rose-500/10"
                  >
                    <Trash2 className="h-4 w-4" /> Delete Role
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-8 text-[#1B2E5A]">
        {/* Header */}
        <DashboardPageHeader
          title="Role Management"
          description="Manage roles, permissions, and access control"
          actions={(
            <PearlButton onClick={handleCreateRole} className="gap-2">
              <ShieldPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Build Role</span>
              <span className="sm:hidden">New Role</span>
            </PearlButton>
          )}
        />

        {/* Enhanced Filters and Search */}
        <Card className="rounded-2xl border border-[#1B2E5A]/10 bg-white shadow-sm">
          <CardContent className="p-6 space-y-6">
            {/* Search Bar */}
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <label className={`text-sm font-medium ${actualTheme === 'dark'
                  ? 'text-white'
                  : actualTheme === 'monochrome'
                    ? 'text-gray-200'
                    : 'text-gray-700'
                  }`}>Search Roles</label>
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${actualTheme === 'dark'
                    ? 'text-white'
                    : actualTheme === 'monochrome'
                      ? 'text-gray-400'
                      : 'text-gray-400'
                    }`} />
                  <Input
                    placeholder="Search by role name, description, or department..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`pl-11 ${actualTheme === 'dark'
                      ? 'bg-slate-800/50 border-purple-500/30 text-white placeholder-purple-300 focus:ring-purple-500'
                      : actualTheme === 'monochrome'
                        ? 'bg-gray-800/50 border-gray-500/30 text-gray-100 placeholder-gray-400 focus:ring-gray-400'
                        : ''
                      }`}
                  />
                </div>
              </div>

              <div className="flex-shrink-0 flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setTypeFilter('all');
                  }}
                >
                  Clear All
                </Button>
              </div>
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className={`text-sm font-medium ${actualTheme === 'dark'
                  ? 'text-white'
                  : actualTheme === 'monochrome'
                    ? 'text-gray-200'
                    : 'text-gray-700'
                  }`}>Role Type</label>
                <Select value={typeFilter} onValueChange={(value: string) => setTypeFilter(value as 'all' | 'custom' | 'system')}>
                  <SelectTrigger className={
                    actualTheme === 'dark'
                      ? 'bg-slate-800/50 border-purple-500/30 text-white'
                      : actualTheme === 'monochrome'
                        ? 'bg-gray-800/50 border-gray-500/30 text-gray-100'
                        : ''
                  }>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="custom">Custom Roles</SelectItem>
                    <SelectItem value="system">System Roles</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className={`text-sm font-medium ${actualTheme === 'dark'
                  ? 'text-white'
                  : actualTheme === 'monochrome'
                    ? 'text-gray-200'
                    : 'text-gray-700'
                  }`}>Sort By</label>
                <Select
                  value={`${sortBy}-${sortOrder}`}
                  onValueChange={(value: string) => {
                    const [field, order] = value.split('-');
                    setSortBy(field as any);
                    setSortOrder(order as any);
                  }}
                >
                  <SelectTrigger className={
                    actualTheme === 'dark'
                      ? 'bg-slate-800/50 border-purple-500/30 text-white'
                      : actualTheme === 'monochrome'
                        ? 'bg-gray-800/50 border-gray-500/30 text-gray-100'
                        : ''
                  }>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Name A-Z</SelectItem>
                    <SelectItem value="name-desc">Name Z-A</SelectItem>
                    <SelectItem value="created-desc">Newest First</SelectItem>
                    <SelectItem value="created-asc">Oldest First</SelectItem>
                    <SelectItem value="users-desc">Most Users</SelectItem>
                    <SelectItem value="users-asc">Least Users</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setTypeFilter('all');
                  }}
                  className="w-full"
                >
                  Reset Filters
                </Button>
              </div>
            </div>

            {/* Active Filters Display */}
            {(searchQuery || typeFilter !== 'all') && (
              <div className={`flex flex-wrap gap-3 pt-4 border-t ${actualTheme === 'dark'
                ? 'border-purple-500/30'
                : actualTheme === 'monochrome'
                  ? 'border-gray-500/30'
                  : 'border-gray-200'
                }`}>
                <span className={`text-sm font-medium ${actualTheme === 'dark'
                  ? 'text-white'
                  : actualTheme === 'monochrome'
                    ? 'text-gray-300'
                    : 'text-gray-600'
                  }`}>Active filters:</span>
                {searchQuery && (
                  <Badge variant="secondary" className={
                    actualTheme === 'dark'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : actualTheme === 'monochrome'
                        ? 'bg-gray-500/20 text-gray-300 border-gray-500/30'
                        : ''
                  }>
                    Search: "{searchQuery}"
                  </Badge>
                )}
                {typeFilter !== 'all' && (
                  <Badge variant="secondary" className={
                    actualTheme === 'dark'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : actualTheme === 'monochrome'
                        ? 'bg-gray-500/20 text-gray-300 border-gray-500/30'
                        : ''
                  }>
                    Type: {typeFilter}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bulk Operations */}
        {selectedRoles.size > 0 && (
          <Card className={
            actualTheme === 'dark'
              ? 'border-purple-500/30 bg-purple-900'
              : actualTheme === 'monochrome'
                ? 'border-gray-500/30 bg-gray-900'
                : 'border-blue-200 bg-blue-50'
          }>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <span className={`text-sm font-medium ${actualTheme === 'dark'
                    ? 'text-white'
                    : actualTheme === 'monochrome'
                      ? 'text-gray-200'
                      : 'text-blue-900'
                    }`}>
                    {selectedRoles.size} role{selectedRoles.size !== 1 ? 's' : ''} selected
                  </span>
                  <span className={`text-sm ${actualTheme === 'dark'
                    ? 'text-white'
                    : actualTheme === 'monochrome'
                      ? 'text-gray-300'
                      : 'text-blue-700'
                    }`}>
                    from {filteredRoles.length} filtered roles
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAction('export', Array.from(selectedRoles))}
                    className={
                      actualTheme === 'dark'
                        ? 'border-purple-500/30 text-purple-300 hover:bg-purple-500/20'
                        : actualTheme === 'monochrome'
                          ? 'border-gray-500/30 text-gray-300 hover:bg-gray-500/20'
                          : 'border-blue-300 text-blue-700 hover:bg-blue-100'
                    }
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Selected
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAction('deactivate', Array.from(selectedRoles))}
                    className={
                      actualTheme === 'dark'
                        ? 'border-purple-500/30 text-purple-300 hover:bg-purple-500/20'
                        : actualTheme === 'monochrome'
                          ? 'border-gray-500/30 text-gray-300 hover:bg-gray-500/20'
                          : ''
                    }
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Deactivate
                  </Button>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleBulkAction('delete', Array.from(selectedRoles))}
                    className={
                      actualTheme === 'dark'
                        ? 'bg-red-600 hover:bg-red-700'
                        : actualTheme === 'monochrome'
                          ? 'bg-red-600 hover:bg-red-700'
                          : ''
                    }
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Roles List */}
        <Card className={cn(
          "overflow-hidden overflow-x-auto rounded-2xl border-0 shadow-lg",
          actualTheme === 'dark'
            ? 'bg-slate-900 border-slate-700'
            : (actualTheme === 'monochrome' ? 'bg-gray-900 border-gray-500/30' : 'bg-white border-slate-200/80 shadow-slate-200/50')
        )}>
          {showRolesLoading ? (
            <CardContent className="p-12 text-center">
              <ZopkitRoundLoader size="xl" className={cn("mx-auto", actualTheme === 'dark' && "text-white")} />
              <p className={cn("mt-3 font-medium text-gray-600", actualTheme === 'dark' ? "text-white" : actualTheme === 'monochrome' ? "text-gray-300" : "")}>Loading roles...</p>
            </CardContent>
          ) : (
            <table className="w-full border-collapse min-w-[1000px]">
              <thead className={cn(
                "sticky top-0 z-20",
                actualTheme === 'dark'
                  ? "bg-slate-800/95 border-b border-slate-700"
                  : actualTheme === 'monochrome'
                    ? "bg-gray-800 border-b border-gray-700"
                    : "bg-gradient-to-r from-slate-50 via-blue-50/30 to-slate-50 border-b border-slate-200"
              )}>
                <tr className={cn(
                  "text-[11px] uppercase tracking-widest font-bold",
                  actualTheme === 'dark' ? "text-slate-300" : actualTheme === 'monochrome' ? "text-gray-300" : "text-slate-600"
                )}>
                  <th className="px-5 py-4 text-left w-12">
                    <Checkbox
                      checked={selectedRoles.size === roles.length && roles.length > 0}
                      onCheckedChange={selectedRoles.size === roles.length ? clearSelection : selectAllRoles}
                      className={cn(
                        actualTheme === 'dark' ? 'border-purple-500/30 data-[state=checked]:bg-purple-600' :
                          actualTheme === 'monochrome' ? 'border-gray-500/30 data-[state=checked]:bg-gray-600' : ''
                      )}
                    />
                  </th>
                  <th className="px-5 py-4 text-left min-w-[220px]">Role & Description</th>
                  <th className="px-5 py-4 text-center w-24">Users</th>
                  <th className="px-5 py-4 text-center w-32">Apps/Modules</th>
                  <th className="px-5 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span>Capability Breakdown</span>
                      <div className="flex items-center gap-3 text-[9px] uppercase tracking-wide font-normal opacity-70">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Admin
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Write
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Read
                        </span>
                      </div>
                    </div>
                  </th>
                  <th className="px-5 py-4 text-center w-32">Type</th>
                  <th className="px-5 py-4 text-right w-16">Actions</th>
                </tr>
              </thead>
              <tbody className={cn(
                "divide-y divide-slate-100 dark:divide-slate-800/80",
                actualTheme === 'dark' && 'divide-slate-700/50',
                actualTheme === 'monochrome' && 'divide-gray-700/50'
              )}>
                {filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <Shield className={cn("w-12 h-12 mx-auto text-gray-400", actualTheme === 'dark' && "text-white")} />
                      <h3 className={cn("text-lg font-semibold mt-4", actualTheme === 'dark' ? "text-white" : actualTheme === 'monochrome' ? "text-gray-100" : "text-[#1B2E5A]")}>No roles found</h3>
                      <p className={cn("mt-2 text-gray-600", actualTheme === 'dark' ? "text-white" : actualTheme === 'monochrome' ? "text-gray-300" : "")}>
                        {searchQuery || typeFilter !== 'all' ? 'Try adjusting your filters.' : 'Get started by creating your first role.'}
                      </p>
                      <Button onClick={handleCreateRole} className="mt-4">
                        <Plus className="w-4 h-4 mr-2" /> Create Role
                      </Button>
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((role) => (
                    <RoleRow
                      key={role.roleId}
                      role={role}
                      isSelected={selectedRoles.has(role.roleId)}
                      onToggleSelect={() => toggleRoleSelection(role.roleId)}
                    />
                  ))
                )}
              </tbody>
            </table>
          )}
        </Card>

        {/* Delete Confirmation Modal */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent className={
            actualTheme === 'dark'
              ? 'bg-slate-900 border-slate-700 text-white'
              : actualTheme === 'monochrome'
                ? 'bg-gray-900 border-gray-500/30 text-gray-100'
                : ''
          }>
            <DialogHeader>
              <DialogTitle className={
                actualTheme === 'dark'
                  ? 'text-white'
                  : actualTheme === 'monochrome'
                    ? 'text-gray-100'
                    : ''
              }>Delete Role</DialogTitle>
              <DialogDescription className={
                actualTheme === 'dark'
                  ? 'text-white'
                  : actualTheme === 'monochrome'
                    ? 'text-gray-300'
                    : ''
              }>
                Are you sure you want to delete the role "{deletingRole?.name}"? This action cannot be undone.
                Users with this role will lose their permissions.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteModal(false)} className={
                actualTheme === 'dark'
                  ? 'border-purple-500/30 text-purple-200 hover:bg-purple-500/10'
                  : actualTheme === 'monochrome'
                    ? 'border-gray-500/30 text-gray-200 hover:bg-gray-500/10'
                    : ''
              }>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDeleteRole} className={
                actualTheme === 'dark'
                  ? 'bg-red-600 hover:bg-red-700'
                  : actualTheme === 'monochrome'
                    ? 'bg-red-600 hover:bg-red-700'
                    : ''
              }>
                Delete Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

    </div>
  );
}