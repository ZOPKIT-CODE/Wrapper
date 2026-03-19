import React, { useState, useMemo } from 'react';
import { X, Building, Check, Search, Shield, User, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PearlButton } from '@/components/ui/pearl-button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useRoles } from '@/hooks/useSharedQueries';
import { useOrganizationHierarchy } from '@/hooks/useOrganizationHierarchy';
import { filterValidRoleIds } from '@/lib/utils';
import { useOrganizationAuth } from '@/hooks/useOrganizationAuth';
import { User as UserType } from '@/types/user-management';
import api, { invitationAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { OrganizationAssignmentConfirmationModal, RoleAssignmentConfirmationModal } from '@/components/common/ConfirmationModal';

export interface UserAccessContentProps {
  user: UserType | null;
  onDone?: () => void;
}

interface UserAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
}

export const UserAccessContent: React.FC<UserAccessContentProps> = ({ user }) => {
  const { tenantId } = useOrganizationAuth();
  const { hierarchy, loading: hierarchyLoading } = useOrganizationHierarchy(tenantId);
  const { data: rolesData = [], isLoading: rolesLoading } = useRoles();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [localUser, setLocalUser] = useState(user);
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    type: 'organization' | 'role';
    action: 'assign' | 'deassign';
    entityName?: string;
    roleName?: string;
    callback: () => void;
  } | null>(null);

  React.useEffect(() => {
    setLocalUser(user);
  }, [user]);

  const hierarchyEntities = useMemo(() => {
    if (!hierarchy || hierarchy.length === 0) return [];

    const flatten = (entities: any[], level = 0): any[] => {
      let result: any[] = [];
      const seenIds = new Set<string>();

      entities.forEach(entity => {
        if (!entity || !entity.entityId || seenIds.has(entity.entityId)) return;

        seenIds.add(entity.entityId);
        result.push({
          ...entity,
          displayLevel: level,
          hierarchyPath: entity.hierarchyPath || entity.fullHierarchyPath || entity.entityName,
          entityType: entity.entityType || 'organization'
        });

        if (entity.children && Array.isArray(entity.children) && entity.children.length > 0) {
          result = result.concat(flatten(entity.children, level + 1));
        }
      });
      return result;
    };

    return flatten(hierarchy);
  }, [hierarchy]);

  const filteredEntities = useMemo(() => {
    if (!searchTerm) return hierarchyEntities;

    return hierarchyEntities.filter(e => {
      if (!e || !e.entityName) return false;
      const nameMatch = e.entityName.toLowerCase().includes(searchTerm.toLowerCase());
      const typeMatch = e.entityType?.toLowerCase().includes(searchTerm.toLowerCase());
      const pathMatch = (e.hierarchyPath || e.fullHierarchyPath || '').toLowerCase().includes(searchTerm.toLowerCase());
      return nameMatch || typeMatch || pathMatch;
    });
  }, [hierarchyEntities, searchTerm]);

  const userOrganizations = useMemo(() => localUser?.organizations || [], [localUser]);
  const assignedEntityIds = useMemo(() => new Set(userOrganizations.map(org => org.entityId || org.organizationId)), [userOrganizations]);

  const performAssignOrganization = async (entityId: string, entityType: string, roleId?: string) => {
    if (!localUser) return;
    setAssigning(true);
    try {
      const response = await invitationAPI.assignOrganizationToUser(localUser.userId, {
        entityId,
        roleId: roleId || undefined,
        membershipType: 'direct',
        isPrimary: false
      });

      if (response.data.success) {
        const entity = hierarchyEntities.find(e => e.entityId === entityId);
        const entityName = entity?.entityName || response.data.data?.organizationName || 'Unknown';

        const newOrganization = {
          membershipId: response.data.data.membershipId,
          assignmentId: response.data.data.membershipId,
          organizationId: entityId,
          entityId: entityId,
          organizationName: entityName,
          entityName: entityName,
          entityType: entityType,
          membershipType: response.data.data.membershipType || 'direct',
          membershipStatus: 'active',
          accessLevel: 'member',
          roleId: roleId || null,
          isPrimary: response.data.data.isPrimary || false
        };

        setLocalUser(prev => prev ? { ...prev, organizations: [...(prev.organizations || []), newOrganization] } : prev);
        toast.success('Organization assigned successfully');
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['organization-assignments'] });
        setConfirmationModal(null);
      } else {
        throw new Error(response.data.message || 'Failed to assign organization');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to assign organization');
    } finally {
      setAssigning(false);
    }
  };

  const handleDeassignOrganization = (membershipId: string, orgName: string) => {
    if (!localUser) return;
    setConfirmationModal({
      isOpen: true,
      type: 'organization',
      action: 'deassign',
      entityName: orgName,
      callback: () => performDeassignOrganization(membershipId)
    });
  };

  const performDeassignOrganization = async (membershipId: string) => {
    if (!localUser) return;
    setAssigning(true);
    try {
      const response = await invitationAPI.removeOrganizationFromUser(localUser.userId, membershipId);
      if (response.data.success) {
        setLocalUser(prev => prev ? {
          ...prev,
          organizations: (prev.organizations || []).filter(org => org.membershipId !== membershipId && org.assignmentId !== membershipId)
        } : prev);
        toast.success('Organization removed successfully');
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['organization-assignments'] });
        setConfirmationModal(null);
      } else {
        throw new Error(response.data.message || 'Failed to remove organization');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to remove organization');
    } finally {
      setAssigning(false);
    }
  };

  const handleAssignRole = (roleId: string, roleName: string) => {
    if (!localUser) return;
    setConfirmationModal({
      isOpen: true,
      type: 'role',
      action: 'assign',
      roleName,
      callback: () => performAssignRole(roleId)
    });
  };

  const performAssignRole = async (roleId: string) => {
    if (!localUser) return;
    setAssigning(true);
    try {
      const currentRoleIds = filterValidRoleIds(localUser.roles?.map(r => r.roleId) || []);
      if (currentRoleIds.includes(roleId)) {
        toast.error('User already has this role');
        setConfirmationModal(null);
        return;
      }
      const response = await api.post(`/tenants/current/users/${localUser.userId}/assign-roles`, { roleIds: [...currentRoleIds, roleId] });
      if (response.data.success) {
        const newRole = rolesData.find((r: any) => r.roleId === roleId);
        if (newRole) {
          setLocalUser(prev => prev ? { ...prev, roles: [...(prev.roles || []), { roleId: newRole.roleId, roleName: newRole.roleName }] } : prev);
        }
        toast.success('Role assigned successfully');
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['organization-assignments'] });
        setConfirmationModal(null);
      } else {
        throw new Error(response.data.message || 'Failed to assign role');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to assign role');
    } finally {
      setAssigning(false);
    }
  };

  const handleDeassignRole = (roleId: string, roleName: string) => {
    if (!localUser) return;
    setConfirmationModal({
      isOpen: true,
      type: 'role',
      action: 'deassign',
      roleName,
      callback: () => performDeassignRole(roleId)
    });
  };

  const performDeassignRole = async (roleId: string) => {
    if (!localUser) return;
    setAssigning(true);
    try {
      const response = await api.delete(`/admin/users/${localUser.userId}/roles/${roleId}`);
      if (response.data.success) {
        setLocalUser(prev => prev ? { ...prev, roles: (prev.roles || []).filter(r => r.roleId !== roleId) } : prev);
        toast.success('Role removed successfully');
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['organization-assignments'] });
        setConfirmationModal(null);
      } else {
        throw new Error(response.data.message || 'Failed to remove role');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to remove role');
    } finally {
      setAssigning(false);
    }
  };

  const isEntitySelected = (entityId: string) => assignedEntityIds.has(entityId);

  const getSelectedEntityRole = (entityId: string) => {
    const org = userOrganizations.find(o => (o.entityId || o.organizationId) === entityId);
    return org?.roleId || 'none';
  };

  const handleEntityRoleChange = (entityId: string, roleId: string) => {
    if (!localUser) return;
    const org = userOrganizations.find(o => (o.entityId || o.organizationId) === entityId);
    if (!org) return;
    const roleName = roleId === 'none' ? 'No Role' : rolesData.find(r => r.roleId === roleId)?.roleName || 'Unknown Role';
    setConfirmationModal({
      isOpen: true,
      type: 'role',
      action: roleId === 'none' && org.roleId ? 'deassign' : 'assign',
      roleName,
      callback: () => performEntityRoleChange(org.membershipId, roleId)
    });
  };

  const performEntityRoleChange = async (membershipId: string, roleId: string) => {
    if (!localUser) return;
    const finalRoleId = roleId === 'none' ? null : roleId;
    setAssigning(true);
    try {
      const response = await invitationAPI.updateUserOrganizationRole(localUser.userId, membershipId, { roleId: finalRoleId });
      if (response.data.success) {
        setLocalUser(prev => prev ? {
          ...prev,
          organizations: (prev.organizations || []).map(org => org.membershipId === membershipId || org.assignmentId === membershipId ? { ...org, roleId: finalRoleId } : org)
        } : prev);
        toast.success('Role updated successfully');
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['organization-assignments'] });
        setConfirmationModal(null);
      } else {
        throw new Error(response.data.message || 'Failed to update role');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Failed to update role');
    } finally {
      setAssigning(false);
    }
  };

  // Assigned roles: only consider valid UUIDs (exclude display strings like "No role assigned")
  const userRoleIds = useMemo(
    () => new Set(filterValidRoleIds(localUser?.roles?.map(r => r.roleId || (r as any).id) || [])),
    [localUser]
  );
  const displayRoles = useMemo(
    () => (localUser?.roles || []).filter(r => filterValidRoleIds([r.roleId]).length > 0),
    [localUser]
  );
  const userAssignedRoleNames = useMemo(
    () => new Set(localUser?.roles?.map(r => r.roleName).filter(Boolean) || []),
    [localUser]
  );
  const availableRoles = rolesData.filter(
    role => !userRoleIds.has(role.roleId) && !userAssignedRoleNames.has(role.roleName)
  );

  if (!localUser) return null;

  return (
    <div className="flex flex-col h-full bg-background rounded-b-xl overflow-hidden">
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row h-[600px]">
        {/* Left Panel: Organizations */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 border-r border-border/40">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                <Building className="w-4 h-4 text-muted-foreground" /> Organizations & Locations
              </h3>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 bg-muted/30 border-transparent focus:bg-background focus:border-input transition-all"
              />
            </div>

            {hierarchyLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-3"></div>
                <p className="text-xs">Loading structure...</p>
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground/60 border-2 border-dashed border-border/40 rounded-xl bg-muted/5">
                <Building className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No organizations found.</p>
              </div>
            ) : (
              <ScrollArea className="h-[420px] pr-2">
                <div className="space-y-1">
                  {filteredEntities.map((entity) => {
                    const selected = isEntitySelected(entity.entityId);
                    const isLocation = entity.entityType === 'location';
                    const assignment = userOrganizations.find(o => (o.entityId || o.organizationId) === entity.entityId);

                    return (
                      <div
                        key={entity.entityId}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('[role="combobox"]') ||
                            (e.target as HTMLElement).closest('[data-radix-popper-content-wrapper]') ||
                            (e.target as HTMLElement).tagName === 'BUTTON' ||
                            (e.target as HTMLElement).closest('button')) {
                            return;
                          }
                          if (assigning) return;

                          if (selected && assignment) {
                            handleDeassignOrganization(assignment.membershipId, entity.entityName);
                          } else {
                            setConfirmationModal({
                              isOpen: true,
                              type: 'organization',
                              action: 'assign',
                              entityName: entity.entityName,
                              callback: () => performAssignOrganization(entity.entityId, entity.entityType, undefined)
                            });
                          }
                        }}
                        className={`
                          group p-3 flex items-center gap-3 transition-all cursor-pointer rounded-lg border border-transparent
                          ${selected
                            ? 'bg-primary/5 border-primary/10'
                            : 'hover:bg-muted/50 hover:border-border/30'
                          }
                          ${assigning ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                      >
                        <div
                          className="flex-shrink-0 flex items-center gap-2"
                          style={{ marginLeft: `${entity.displayLevel * 16}px` }}
                        >
                          {entity.displayLevel > 0 && (
                            <div className="w-4 flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
                            </div>
                          )}
                          <div
                            className={`
                              w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200
                              ${selected
                                ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                                : 'border-muted-foreground/30 bg-background group-hover:border-primary/50'
                              }
                            `}
                          >
                            <Check className={`w-3.5 h-3.5 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium truncate ${selected ? 'text-primary' : 'text-foreground/90'}`}>
                              {entity.entityName}
                            </span>
                            {isLocation && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1 rounded-sm font-normal bg-muted">
                                Location
                              </Badge>
                            )}
                            {assignment?.isPrimary && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1 rounded-sm bg-purple-50 text-purple-700 border-purple-200">
                                Primary
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground/70 truncate mt-0.5 font-normal">
                            {/* Only show hierarchy path if simpler view needed, else simplified */}
                            {entity.entityType.charAt(0).toUpperCase() + entity.entityType.slice(1)}
                          </div>
                        </div>

                        {selected && (
                          <div
                            className="flex-shrink-0 w-36 animate-in fade-in duration-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Select
                              value={getSelectedEntityRole(entity.entityId)}
                              onValueChange={(value) => handleEntityRoleChange(entity.entityId, value)}
                              disabled={rolesLoading || rolesData.length === 0 || assigning}
                            >
                              <SelectTrigger className="h-8 text-xs bg-background/50 border-input/50 focus:ring-1 focus:ring-primary/20">
                                <SelectValue placeholder="Role" />
                              </SelectTrigger>
                              <SelectContent>
                                {rolesData.length === 0 ? (
                                  <SelectItem value="no-roles" disabled>No roles</SelectItem>
                                ) : (
                                  <>
                                    <SelectItem value="none">No role</SelectItem>
                                    {rolesData.map((role: any) => (
                                      <SelectItem key={role.roleId} value={role.roleId}>
                                        {role.roleName}
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {!selected && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="w-4 h-4 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        {/* Right Panel: Global Roles */}
        <div className="w-full md:w-[340px] bg-muted/5 border-l border-border/40 p-6 flex flex-col overflow-y-auto">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                <Shield className="w-4 h-4 text-muted-foreground" /> Global Roles
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5">
                Apply tenant-wide. Per-organization roles are set in the left panel (e.g. “ops mgmt” on zopkit).
              </p>
            </div>

            {/* Summary */}
            <div className="px-3 py-2 rounded-lg bg-muted/50 border border-border/40">
              <p className="text-xs font-medium text-foreground/80">
                <span className="text-emerald-600 dark:text-emerald-400">{displayRoles.length} assigned</span>
                <span className="text-muted-foreground mx-1.5">·</span>
                <span className="text-muted-foreground">{availableRoles.length} not assigned</span>
              </p>
            </div>

            {/* Assigned to this user - only show roles with valid UUIDs */}
            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                Assigned to this user ({displayRoles.length})
              </Label>
              {displayRoles.length > 0 ? (
                <div className="space-y-2">
                  {displayRoles.map(role => (
                    <div
                      key={role.roleId}
                      className="group flex items-center justify-between p-3 bg-background rounded-xl border-2 border-emerald-200/60 dark:border-emerald-800/40 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <Shield className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{role.roleName}</span>
                      </div>
                      <PearlButton
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 flex items-center justify-center rounded-full"
                        onClick={() => handleDeassignRole(role.roleId, role.roleName)}
                        disabled={assigning}
                        title="Remove this role"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </PearlButton>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic px-4 py-6 text-center border-2 border-dashed border-amber-300/50 dark:border-amber-600/30 rounded-xl bg-amber-50/30 dark:bg-amber-900/10">
                  No global roles assigned. Add one from “Not assigned” below.
                </div>
              )}
            </div>

            {/* Not assigned — click to add */}
            <div className="space-y-3 pt-2">
              <Label className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                Not assigned — click to add ({availableRoles.length})
              </Label>
              {availableRoles.length > 0 ? (
                <div className="space-y-2">
                  {availableRoles.map(role => (
                    <button
                      key={role.roleId}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg border border-dashed border-border/50 hover:bg-background hover:shadow-sm hover:border-primary/30 transition-all group text-left"
                      onClick={() => handleAssignRole(role.roleId, role.roleName)}
                      disabled={assigning}
                      title={`Assign ${role.roleName}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 group-hover:bg-primary transition-colors" />
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                          {role.roleName}
                        </span>
                      </div>
                      <Plus className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-2">All roles are already assigned to this user.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {confirmationModal && confirmationModal.type === 'organization' && (
        <OrganizationAssignmentConfirmationModal
          isOpen={confirmationModal.isOpen}
          onClose={() => {
            if (!assigning) setConfirmationModal(null);
          }}
          onConfirm={async () => {
            try {
              await confirmationModal.callback();
            } catch (error) {
              console.error('Error in confirmation callback:', error);
            }
          }}
          organizationName={confirmationModal.entityName || ''}
          userName={localUser.name || localUser.email}
          action={confirmationModal.action}
          loading={assigning}
        />
      )}

      {confirmationModal && confirmationModal.type === 'role' && (
        <RoleAssignmentConfirmationModal
          isOpen={confirmationModal.isOpen}
          onClose={() => {
            if (!assigning) setConfirmationModal(null);
          }}
          onConfirm={async () => {
            try {
              await confirmationModal.callback();
            } catch (error) {
              console.error('Error in confirmation callback:', error);
            }
          }}
          roleName={confirmationModal.roleName || ''}
          userName={localUser.name || localUser.email}
          action={confirmationModal.action}
          loading={assigning}
        />
      )}
    </div>
  );
};

export const UserAccessModal: React.FC<UserAccessModalProps> = ({
  isOpen,
  onClose,
  user
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                <User className="w-5 h-5" />
                Manage Access: {user?.name || user?.email}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Assign roles and organizations to this user
              </DialogDescription>
            </div>
            <PearlButton variant="outline" size="sm" className="h-9 w-9 p-0 flex items-center justify-center" onClick={onClose}>
              <X className="w-5 h-5" />
            </PearlButton>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <UserAccessContent user={user} onDone={onClose} />
        </div>
        <div className="px-6 py-4 border-t flex justify-end">
          <PearlButton onClick={onClose}>Done</PearlButton>
        </div>
      </DialogContent>
    </Dialog>
  );
};

