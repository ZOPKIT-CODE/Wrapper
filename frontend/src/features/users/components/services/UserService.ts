import api from '@/lib/api';
import { filterValidRoleIds } from '@/lib/utils';
import { User, Role, UserOrganization } from '@/types/user-management';

/**
 * User Service Layer
 * 
 * This service handles all user-related API operations with proper error handling,
 * data transformation, and type safety.
 */
export class UserService {
  /**
   * Fetch organizations for a specific user
   */
  static async fetchUserOrganizations(userId: string): Promise<UserOrganization[]> {
    try {
      const response = await api.get(`/admin/users/${userId}/organizations`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return [];
    } catch (error) {
      console.error(`Error fetching organizations for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Fetch all users for the current tenant
   */
  static async fetchUsers(): Promise<User[]> {
    try {
      const response = await api.get('/tenants/current/users');
      
      if (!response.data.success) {
        throw new Error('Failed to fetch users');
      }

      const userData = response.data.data || [];
      
      // Transform the data structure to include invitation information
      const transformedUsers = await Promise.all(userData.map(async (item: any) => {
        const user = item.user || item;
        const roleString = item.role;
        const roleIdFromApi = item.roleId ?? item.originalData?.role?.roleId;
        
        // Determine invitation status and type based on actual user state
        let invitationStatus = 'active';
        let userType = 'active_user';
        
        if (user.isActive && user.onboardingCompleted) {
          invitationStatus = 'active';
          userType = 'active_user';
        } else if (!user.isActive && !user.onboardingCompleted) {
          invitationStatus = 'pending';
          userType = 'invited';
        } else if (!user.onboardingCompleted) {
          invitationStatus = 'setup_required';
          userType = 'setup_required';
        }
        
        const userId = user.id || user.userId;
        
        // Fetch organizations for this user
        const organizations = await this.fetchUserOrganizations(userId);
        
        return {
          userId,
          email: user.email,
          name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}`.trim() : user.firstName || user.lastName || 'Unnamed User',
          isActive: user.isActive !== false,
          isTenantAdmin: roleString === 'Super Administrator' || user.isTenantAdmin || false,
          onboardingCompleted: user.onboardingCompleted !== false,
          department: user.department,
          title: user.title,
          invitedBy: user.invitedBy,
          invitedAt: user.invitedAt,
          invitationAcceptedAt: user.invitationAcceptedAt,
          lastLoginAt: user.lastActiveAt || user.lastLoginAt,
          avatar: user.avatar,
          roles: roleString ? [{ 
            roleId: roleIdFromApi || roleString,
            roleName: roleString,
            description: 'Role details not available',
            color: '#6b7280',
            icon: '👤',
            permissions: {}
          }] : [],
          organizations,
          invitationStatus,
          userType,
          originalData: item,
          invitationId: item.invitationToken || item.invitationId || null
        };
      }));
      
      // Validate transformed user data
      const validUsers = transformedUsers.filter((user: any) => 
        user && 
        typeof user === 'object' && 
        user.userId && 
        typeof user.email === 'string'
      );
      
      return validUsers;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new Error('Failed to load users');
    }
  }

  /**
   * Fetch all roles
   */
  static async fetchRoles(): Promise<Role[]> {
    try {
      const response = await api.get('/permissions/roles');
      
      if (!response.data.success) {
        throw new Error('Failed to fetch roles');
      }

      const rolesData = response.data.data?.data || [];
      return rolesData;
    } catch (error) {
      console.error('Error fetching roles:', error);
      throw new Error('Failed to load roles');
    }
  }

  /**
   * Invite a new user
   */
  static async inviteUser(userData: {
    email: string;
    name: string;
    roleIds?: string[];
    message?: string;
    entities?: Array<{
      entityId: string;
      roleId: string;
      entityType: string;
      membershipType: string;
    }>;
    primaryEntityId?: string;
  }): Promise<any> {
    try {
      const response = await api.post('/admin/organizations/current/invite-user', userData);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to invite user');
      }
      return response.data;
    } catch (error) {
      console.error('Error inviting user:', error);
      throw error;
    }
  }

  /**
   * Update user information
   */
  static async updateUser(userId: string, userData: any): Promise<any> {
    try {
      const response = await api.put(`/tenants/current/users/${userId}`, userData);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to update user');
      }
      return response.data;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete a user
   */
  static async deleteUser(userId: string): Promise<any> {
    try {
      const response = await api.delete(`/tenants/current/users/${userId}`);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to delete user');
      }
      return response.data;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Promote user to admin
   */
  static async promoteUser(userId: string): Promise<any> {
    try {
      const response = await api.post(`/tenants/current/users/${userId}/promote`);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to promote user');
      }
      return response.data;
    } catch (error) {
      console.error('Error promoting user:', error);
      throw error;
    }
  }

  /**
   * Deactivate a user
   */
  static async deactivateUser(userId: string): Promise<any> {
    try {
      const response = await api.post(`/tenants/current/users/${userId}/deactivate`);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to deactivate user');
      }
      return response.data;
    } catch (error) {
      console.error('Error deactivating user:', error);
      throw error;
    }
  }

  /**
   * Reactivate a user
   */
  static async reactivateUser(userId: string): Promise<any> {
    try {
      const response = await api.post(`/tenants/current/users/${userId}/reactivate`);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to reactivate user');
      }
      return response.data;
    } catch (error) {
      console.error('Error reactivating user:', error);
      throw error;
    }
  }

  /**
   * Resend invitation to a user
   */
  static async resendInvite(userId: string): Promise<any> {
    try {
      const response = await api.post(`/tenants/current/users/${userId}/resend-invite`);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to resend invitation');
      }
      return response.data;
    } catch (error) {
      console.error('Error resending invite:', error);
      throw error;
    }
  }

  /**
   * Assign roles to a user
   */
  static async assignRoles(userId: string, roleIds: string[]): Promise<any> {
    try {
      const validRoleIds = filterValidRoleIds(roleIds);
      const response = await api.post(`/tenants/current/users/${userId}/assign-roles`, {
        roleIds: validRoleIds
      });
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to assign roles');
      }
      return response.data;
    } catch (error) {
      console.error('Error assigning roles:', error);
      throw error;
    }
  }

  /**
   * Deassign a role from a user
   */
  static async deassignRole(userId: string, roleId: string): Promise<any> {
    try {
      const response = await api.delete(`/admin/users/${userId}/roles/${roleId}`);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to deassign role');
      }
      return response.data;
    } catch (error) {
      console.error('Error deassigning role:', error);
      throw error;
    }
  }
}
