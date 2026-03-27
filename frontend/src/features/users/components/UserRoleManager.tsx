import React, { useState, useEffect } from 'react';
import { Users, Plus, X, Save, AlertCircle, UserCheck, Shield, Edit2, Trash2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useUsers, useRoles } from '@/hooks/useSharedQueries';

interface User {
  userId: string;
  email: string;
  name: string;
  isActive: boolean;
  isTenantAdmin: boolean;
  onboardingCompleted: boolean;
  roles?: Role[];
}

interface Role {
  roleId: string;
  roleName: string;
  description: string;
  color: string;
  isSystemRole: boolean;
}

interface RoleAssignment {
  id?: string;
  userId: string;
  roleId: string;
  isActive: boolean;
  assignedAt?: string;
  assignedBy?: string;
  expiresAt?: string;
}

interface UserRoleManagerProps {
  userId?: string;
  onRoleChange?: (userId: string, roles: Role[]) => void;
}

export const UserRoleManager: React.FC<UserRoleManagerProps> = ({ 
  userId, 
  onRoleChange 
}) => {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Use shared hooks for data
  const { data: availableRoles = [], isLoading: loadingRoles } = useRoles();
  const { data: users = [], isLoading: loadingUsers } = useUsers(null);

  // Auto-select user if userId prop is provided
  useEffect(() => {
    if (userId) {
      // Try to find user in users list first
      if (users.length > 0) {
        const user = users.find((u: any) => {
          const uId = u.user?.userId || u.userId || u.user?.id || u.id;
          return uId === userId;
        });
        if (user) {
          // Normalize user object if needed
          const normalizedUser = user.user ? { ...user.user, roles: user.roles } : user;
          setSelectedUser(normalizedUser);
        } else {
          // User not found in list, create a minimal user object
          setSelectedUser({
            userId: userId,
            email: '',
            name: 'Loading...',
            isActive: true,
            isTenantAdmin: false,
            onboardingCompleted: true
          });
        }
      } else {
        // Users list not loaded yet, create a minimal user object
        setSelectedUser({
          userId: userId,
          email: '',
          name: 'Loading...',
          isActive: true,
          isTenantAdmin: false,
          onboardingCompleted: true
        });
      }
      // Always load roles when userId is provided, regardless of users list
      loadUserRoles(userId);
    }
  }, [userId, users]);

  const loadUserRoles = async (selectedUserId: string) => {
    try {
      setRolesLoading(true);
      const response = await api.get(`/admin/users/${selectedUserId}/roles`);
      
      if (response.data.success) {
        const rolesData = response.data.data || response.data.roles || [];
        // Ensure roles have all required fields
        const rolesList = Array.isArray(rolesData) ? rolesData.map((role: any) => ({
          roleId: role.roleId,
          roleName: role.roleName,
          description: role.description || '',
          color: role.color || '#6b7280',
          icon: role.icon || '👤',
          permissions: role.permissions || {},
          isSystemRole: role.isSystemRole || false
        })) : [];
        setUserRoles(rolesList);
      } else {
        console.warn('⚠️ Roles API returned success: false', response.data.message);
        toast.error(response.data.message || 'Failed to load user roles');
        setUserRoles([]);
      }
    } catch (error: any) {
      console.error('❌ Failed to load user roles:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to load user roles');
      setUserRoles([]);
    } finally {
      setRolesLoading(false);
    }
  };

  const handleUserSelect = (user: any) => {
    // Handle both raw user objects and the format from useUsers
    const userObj = user.user || user;
    setSelectedUser(userObj);
    loadUserRoles(userObj.userId || userObj.id);
    setShowRoleModal(true);
  };

  const invalidateQueries = () => {
    // Invalidate multiple related queries
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    queryClient.invalidateQueries({ queryKey: ['user-roles', selectedUser?.userId] });
    
    if (selectedUser) {
       queryClient.invalidateQueries({ queryKey: ['auth-status'] }); // Refresh auth status if it's the current user
    }
  };

  const handleAssignRole = async (roleId: string) => {
    if (!selectedUser) return;

    try {
      setSaving(true);
      
      const requestData = {
        userId: selectedUser.userId,
        roleId: roleId
      };
      
      const response = await api.post('/admin/users/assign-role', requestData);

      if (response.data.success) {
        const assignedRole = availableRoles.find((r: any) => r.roleId === roleId);
        toast.success(`Role "${assignedRole?.roleName || roleId}" assigned successfully`);
        
        await loadUserRoles(selectedUser.userId);
        invalidateQueries();
        onRoleChange?.(selectedUser.userId, userRoles);
      } else {
        toast.error(response.data.message || 'Failed to assign role');
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.error('Role is already assigned to this user');
      } else {
        toast.error(error.response?.data?.message || 'Failed to assign role');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    if (!selectedUser) return;

    try {
      setSaving(true);
      
      const response = await api.delete(`/admin/users/${selectedUser.userId}/roles/${roleId}`);

      if (response.data.success) {
        const removedRole = userRoles.find(r => r.roleId === roleId);
        toast.success(`Role "${removedRole?.roleName || roleId}" removed successfully`);
        
        await loadUserRoles(selectedUser.userId);
        invalidateQueries();
        onRoleChange?.(selectedUser.userId, userRoles);
      } else {
        toast.error(response.data.message || 'Failed to remove role');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove role');
    } finally {
      setSaving(false);
    }
  };

  const getRoleColor = (color: string) => {
    return color || '#6b7280';
  };

  const availableRolesToAssign = availableRoles.filter(
    (role: any) => !userRoles.some(userRole => userRole.roleId === role.roleId)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#1B2E5A]">User Role Management</h2>
            <p className="text-sm text-gray-600">Assign and manage user roles and permissions</p>
          </div>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['roles'] });
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Users List */}
      {!userId && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-md font-medium text-[#1B2E5A]">Select User</h3>
            <p className="text-sm text-gray-600">Choose a user to manage their roles</p>
          </div>
          
          <div className="p-4">
            {loadingUsers ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No users found</p>
              </div>
            ) : (
              <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                {users.map((item: any) => {
                  const user = item.user || item;
                  return (
                    <div
                      key={user.userId || user.id}
                      onClick={() => handleUserSelect(item)}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <Users className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-[#1B2E5A]">{user.firstName} {user.lastName}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.isTenantAdmin && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                            Admin
                          </span>
                        )}
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          user.isActive !== false
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {user.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                        <Edit2 className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Role Management Modal */}
      {(showRoleModal || userId) && selectedUser && (
        <div className={userId ? '' : 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'}>
          <div className={`bg-white rounded-lg ${userId ? 'border border-gray-200' : 'max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-xl'}`}>
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-[#1B2E5A]">
                    Manage Roles: {selectedUser.name || `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.email}
                  </h3>
                  <p className="text-sm text-gray-600">{selectedUser.email}</p>
                </div>
                {!userId && (
                  <button
                    onClick={() => setShowRoleModal(false)}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                )}
              </div>
            </div>

            {/* Role assignment summary */}
            {!rolesLoading && (
              <div className="px-6 py-3 bg-slate-100 border-b border-gray-200 rounded-none">
                <p className="text-sm font-medium text-slate-700">
                  <span className="text-emerald-600 font-semibold">{userRoles.length} assigned</span>
                  <span className="text-slate-400 mx-2">•</span>
                  <span className="text-slate-600">{availableRolesToAssign.length} not assigned</span>
                  <span className="text-slate-400 ml-1 text-xs">(of {availableRoles.length} total roles)</span>
                </p>
              </div>
            )}

            {/* Assigned to this user */}
            <div className="p-6 border-b border-gray-200 bg-emerald-50/30">
              <h4 className="text-sm font-semibold text-[#1B2E5A] uppercase tracking-wider mb-1 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                  {userRoles.length}
                </span>
                Assigned to this user
              </h4>
              <p className="text-xs text-gray-500 mb-4">These roles are currently active. Remove to revoke access.</p>
              {rolesLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : userRoles.length === 0 ? (
                <div className="text-center py-6 bg-white rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50">
                  <Shield className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-amber-800 font-medium">No roles assigned</p>
                  <p className="text-sm text-amber-700">This user has no roles. Assign roles in the section below to grant permissions.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {userRoles.map(role => (
                    <div
                      key={role.roleId}
                      className="flex items-center justify-between p-3 border-2 border-emerald-200 rounded-lg bg-white shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${getRoleColor(role.color)}20` }}
                        >
                          <Shield className="w-5 h-5" style={{ color: getRoleColor(role.color) }} />
                        </div>
                        <div>
                          <p className="font-medium text-[#1B2E5A]">{role.roleName}</p>
                          {role.description && (
                            <p className="text-sm text-gray-600">{role.description}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveRole(role.roleId)}
                        disabled={saving}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Remove role"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Not assigned — click to assign */}
            <div className="p-6">
              <h4 className="text-sm font-semibold text-[#1B2E5A] uppercase tracking-wider mb-1 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                  {availableRolesToAssign.length}
                </span>
                Not assigned
              </h4>
              <p className="text-xs text-gray-500 mb-4">Click “Assign role” to add one of these roles to this user.</p>
              {loadingRoles ? (
                <div className="text-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Loading available roles...</p>
                </div>
              ) : availableRolesToAssign.length === 0 ? (
                <div className="text-center py-6 rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
                  {availableRoles.length === 0 ? 'No roles available in this tenant.' : 'All available roles are already assigned to this user.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableRolesToAssign.map((role: any) => (
                    <div
                      key={role.roleId}
                      className="p-3 border-2 border-dashed border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all bg-white"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                           <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getRoleColor(role.color) }}
                          />
                          <span className="font-medium text-[#1B2E5A] truncate" title={role.roleName}>
                            {role.roleName}
                          </span>
                        </div>
                        {role.isSystemRole && (
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] uppercase font-bold rounded">
                            System
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2 h-8">
                        {role.description || 'No description provided'}
                      </p>
                      <button
                        onClick={() => handleAssignRole(role.roleId)}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                      >
                         {saving ? <div className="animate-spin w-3 h-3 border-b-2 border-blue-700 rounded-full" /> : <Plus className="w-3 h-3" />}
                         Assign role
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserRoleManager; 