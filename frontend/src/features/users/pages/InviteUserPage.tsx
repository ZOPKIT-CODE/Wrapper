import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Building, Check, Search, Shield, User, ChevronRight, MapPin, X, Loader2 } from 'lucide-react';
import { Container } from '@/components/common/Page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { PearlButton } from '@/components/ui/pearl-button';
import { useRoles, useInvalidateQueries } from '@/hooks/useSharedQueries';
import { useOrganizationHierarchy } from '@/hooks/useOrganizationHierarchy';
import { useOrganizationAuth } from '@/hooks/useOrganizationAuth';
import { useUserManagement } from '@/features/users/components/context/UserManagementContext';
import toast from 'react-hot-toast';

export function InviteUserPage() {
  const navigate = useNavigate();
  const { tenantId } = useOrganizationAuth();
  const { userMutations } = useUserManagement();
  const { invalidateUsers } = useInvalidateQueries();
  const [searchTerm, setSearchTerm] = useState('');
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    entities: [] as Array<{
      entityId: string;
      roleId: string;
      entityType: string;
      membershipType: string;
    }>,
    primaryEntityId: '',
    message: '',
    invitationType: 'multi-entity' as const
  });

  // Fetch roles and hierarchy
  const { data: rolesData = [], isLoading: rolesLoading } = useRoles();
  const { hierarchy, loading: hierarchyLoading } = useOrganizationHierarchy(tenantId);

  // Flatten entities
  const flattenedEntities = useMemo(() => {
    if (!hierarchy || hierarchy.length === 0) return [];
    
    const flatten = (entities: any[], level = 0, seenIds = new Set<string>()): any[] => {
      let result: any[] = [];
      entities.forEach(entity => {
        if (!entity || !entity.entityId || seenIds.has(entity.entityId)) return;
        seenIds.add(entity.entityId);
        result.push({
          ...entity,
          displayLevel: level,
          entityType: entity.entityType || 'organization'
        });
        if (entity.children && Array.isArray(entity.children) && entity.children.length > 0) {
          result = result.concat(flatten(entity.children, level + 1, seenIds));
        }
      });
      return result;
    };
    
    return flatten(hierarchy);
  }, [hierarchy]);

  const filteredEntities = useMemo(() => {
    if (!searchTerm) return flattenedEntities;
    return flattenedEntities.filter(e => {
      if (!e || !e.entityName) return false;
      const nameMatch = e.entityName.toLowerCase().includes(searchTerm.toLowerCase());
      const typeMatch = e.entityType?.toLowerCase().includes(searchTerm.toLowerCase());
      const pathMatch = (e.hierarchyPath || e.fullHierarchyPath || '').toLowerCase().includes(searchTerm.toLowerCase());
      return nameMatch || typeMatch || pathMatch;
    });
  }, [flattenedEntities, searchTerm]);

  const handleEntityToggle = (entityId: string, entityType: string) => {
    const currentEntities = inviteForm?.entities || [];
    const isSelected = currentEntities.some((e: any) => e && e.entityId === entityId);
    
    if (isSelected) {
      const updated = {
        ...inviteForm,
        entities: currentEntities.filter((e: any) => e && e.entityId !== entityId),
        primaryEntityId: inviteForm.primaryEntityId === entityId ? '' : (inviteForm.primaryEntityId || '')
      };
      setInviteForm(updated);
    } else {
      const defaultRole = rolesData.length > 0 ? rolesData[0].roleId : '';
      const updated = {
        ...inviteForm,
        entities: [...currentEntities, {
          entityId,
          roleId: defaultRole,
          entityType,
          membershipType: 'direct'
        }],
        primaryEntityId: inviteForm.primaryEntityId || entityId
      };
      setInviteForm(updated);
    }
  };

  const handleEntityRoleChange = (entityId: string, roleId: string) => {
    const finalRoleId = roleId === 'none' || roleId === '' ? '' : roleId;
    const updated = {
      ...inviteForm,
      entities: inviteForm.entities.map((e: any) =>
        e && e.entityId === entityId ? { ...e, roleId: finalRoleId } : e
      )
    };
    setInviteForm(updated);
  };

  const isEntitySelected = (entityId: string) => {
    return inviteForm.entities.some((e: any) => e && e.entityId === entityId);
  };

  const getSelectedEntityRole = (entityId: string) => {
    const entity = inviteForm.entities.find((e: any) => e && e.entityId === entityId);
    return !entity || !entity.roleId || entity.roleId === '' ? 'none' : entity.roleId;
  };

  const handlePrimaryEntityChange = (entityId: string) => {
    setInviteForm({ ...inviteForm, primaryEntityId: entityId });
  };

  const handleInvite = () => {
    if (!inviteForm.email || !inviteForm.name || inviteForm.entities.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    const roleIds = inviteForm.entities
      .map((e: any) => e.roleId)
      .filter((id: string) => id && id.trim() !== '');

    userMutations.inviteUser.mutate({
      email: inviteForm.email,
      name: inviteForm.name,
      roleIds: roleIds.length > 0 ? roleIds : undefined,
      message: inviteForm.message,
      entities: inviteForm.entities,
      primaryEntityId: inviteForm.primaryEntityId
    }, {
      onSuccess: () => {
        toast.success('User invited successfully');
        invalidateUsers();
        navigate({ to: '/dashboard/users' });
      },
      onError: (error: any) => {
        toast.error(error?.response?.data?.message || 'Failed to invite user');
      }
    });
  };

  return (
    <Container>
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/dashboard/users' })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Users
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">Invite User</h1>
            <p className="text-gray-600">Send an invitation to join your organization</p>
          </div>
        </div>

        {/* Invite Form */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Invite Team Member</CardTitle>
            <CardDescription>Send an invitation to join your organization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6">
              {/* Left Panel: User Details & Entity Selection */}
              <div className="flex-1 space-y-6">
                {/* User Details Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[#1B2E5A] dark:text-slate-200 flex items-center gap-2">
                    <User className="w-4 h-4" /> User Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email Address <span className="text-red-500">*</span></Label>
                      <Input
                        type="email"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                        placeholder="user@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Full Name <span className="text-red-500">*</span></Label>
                      <Input
                        value={inviteForm.name}
                        onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Entity Selection Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#1B2E5A] dark:text-slate-200 flex items-center gap-2">
                      <Building className="w-4 h-4" /> Assign Access
                    </h3>
                    <div className="relative w-48">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                      <Input
                        placeholder="Search entities..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  
                  {hierarchyLoading || rolesLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                      <p className="text-sm">Loading...</p>
                    </div>
                  ) : filteredEntities.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-xl">
                      <Building className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p>No organizations or locations found.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredEntities.map((entity, index) => {
                          const selected = isEntitySelected(entity.entityId);
                          const isLocation = entity.entityType === 'location';
                          return (
                            <div 
                              key={`${entity.entityId}-${index}`}
                              className={`p-3 flex items-center gap-3 transition-colors ${
                                selected ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              <div 
                                className="flex-shrink-0 flex items-center gap-1"
                                style={{ marginLeft: `${entity.displayLevel * 20}px` }}
                              >
                                {entity.displayLevel > 0 && (
                                  <ChevronRight className="w-3 h-3 text-slate-400" />
                                )}
                                <div 
                                  className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer ${
                                    selected 
                                      ? 'bg-[#1B2E5A] border-blue-600 text-white' 
                                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                                  }`}
                                  onClick={() => handleEntityToggle(entity.entityId, entity.entityType)}
                                >
                                  {selected && <Check className="w-3.5 h-3.5" />}
                                </div>
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {isLocation ? (
                                    <MapPin className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <Building className="w-4 h-4 text-blue-600" />
                                  )}
                                  <span className={`text-sm font-medium truncate ${
                                    selected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'
                                  }`}>
                                    {entity.entityName}
                                  </span>
                                  <Badge variant="outline" className="text-[10px]">
                                    {entity.entityType}
                                  </Badge>
                                </div>
                                <div className="text-xs text-slate-500 truncate mt-0.5">
                                  {entity.fullHierarchyPath || entity.hierarchyPath || entity.entityName}
                                </div>
                              </div>

                              {selected && (
                                <div className="flex-shrink-0 w-40">
                                  <Select
                                    value={getSelectedEntityRole(entity.entityId) || 'none'}
                                    onValueChange={(value) => handleEntityRoleChange(entity.entityId, value)}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">No role</SelectItem>
                                      {rolesData.map((role: any) => (
                                        <SelectItem key={role.roleId} value={role.roleId}>
                                          {role.roleName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
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

              {/* Right Panel: Summary & Message */}
              <div className="w-full md:w-80 bg-slate-50 dark:bg-slate-900/30 border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col space-y-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-[#1B2E5A] dark:text-slate-200">Access Summary</h3>
                  {inviteForm.entities.length === 0 ? (
                    <div className="text-sm text-slate-500 italic">No organizations selected yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {inviteForm.entities.map((entity: any, index: number) => {
                        const entityData = flattenedEntities.find(e => e.entityId === entity.entityId);
                        const roleData = rolesData.find((r: any) => r.roleId === entity.roleId);
                        const isPrimary = inviteForm.primaryEntityId === entity.entityId;

                        return (
                          <div 
                            key={`${entity.entityId}-${index}`}
                            className={`p-3 rounded-lg border text-sm ${
                              isPrimary 
                                ? 'bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800 shadow-sm' 
                                : 'bg-slate-100 dark:bg-slate-900 border-transparent'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-1">
                              <div className="font-medium text-[#1B2E5A] dark:text-slate-200">
                                {entityData?.entityName}
                              </div>
                              {isPrimary ? (
                                <Badge className="bg-[#1B2E5A] text-[10px] h-5">Primary</Badge>
                              ) : (
                                <button 
                                  onClick={() => handlePrimaryEntityChange(entity.entityId)}
                                  className="text-[10px] text-slate-400 hover:text-blue-600 font-medium"
                                >
                                  Make Primary
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                              <Shield className="w-3 h-3" />
                              {roleData?.roleName || 'No Role'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Personal Message (Optional)</Label>
                  <Textarea
                    value={inviteForm.message}
                    onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                    rows={4}
                    placeholder="Welcome to our team! We're excited to have you join us."
                  />
                </div>

                <div className="pt-6 mt-auto space-y-3">
                  <PearlButton
                    onClick={handleInvite}
                    disabled={!inviteForm.email || !inviteForm.name || inviteForm.entities.length === 0 || userMutations.inviteUser.isPending}
                    className="w-full"
                  >
                    {userMutations.inviteUser.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending Invitation...
                      </>
                    ) : (
                      'Send Invitation'
                    )}
                  </PearlButton>
                  <Button
                    onClick={() => navigate({ to: '/dashboard/users' })}
                    variant="outline"
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
