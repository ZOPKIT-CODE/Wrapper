import React, { useState, useMemo, useEffect } from 'react';
import { X, Building, Check, Search, Shield, User, ChevronRight, MapPin, Loader2 } from 'lucide-react';
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
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useRoles } from '@/hooks/useSharedQueries';
import { useOrganizationHierarchy } from '@/hooks/useOrganizationHierarchy';
import { useOrganizationAuth } from '@/hooks/useOrganizationAuth';

interface Role {
  roleId: string;
  roleName: string;
  description: string;
  color: string;
  icon: string;
  permissions: Record<string, any>;
}

interface Entity {
  entityId: string;
  entityName: string;
  entityType: string;
  hierarchyPath?: string;
  fullHierarchyPath?: string;
  parentEntityId?: string | null;
  displayName?: string;
  hierarchyLevel?: number;
  children?: Entity[];
}

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles?: Role[]; // Optional - will use hook if not provided
  inviteForm: {
    email: string;
    name: string;
    entities: Array<{
      entityId: string;
      roleId: string;
      entityType: string;
      membershipType: string;
    }>;
    primaryEntityId: string;
    message: string;
    invitationType?: 'single-entity' | 'multi-entity';
  };
  setInviteForm: (form: any) => void;
  onInvite: () => void;
  availableEntities?: Entity[]; // Optional - will use hook if not provided
  entitiesLoading?: boolean; // Optional
  isLoading?: boolean;
}

export const InviteUserModal: React.FC<InviteUserModalProps> = ({
  isOpen,
  onClose,
  roles: rolesProp,
  inviteForm,
  setInviteForm,
  onInvite,
  availableEntities: availableEntitiesProp,
  entitiesLoading: entitiesLoadingProp,
  isLoading = false
}) => {
  const { tenantId } = useOrganizationAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch roles using hook if not provided
  const { data: rolesData = [], isLoading: rolesLoading } = useRoles();
  const effectiveRoles = rolesProp && rolesProp.length > 0 ? rolesProp : rolesData;

  // Fetch hierarchy using hook if not provided
  const { hierarchy, loading: hierarchyLoading } = useOrganizationHierarchy(tenantId);
  
  // Debug: Track inviteForm changes
  useEffect(() => {
  }, [inviteForm]);
  
  // Convert hierarchy to flat list if needed - includes all entity types (organizations, locations, etc.)
  const hierarchyEntities = useMemo(() => {
    if (!hierarchy || hierarchy.length === 0) {
      return [];
    }

    const flatten = (entities: any[], level = 0, seenIds = new Set<string>()): any[] => {
      let result: any[] = [];

      entities.forEach(entity => {
        // Include all entity types: organization, location, department, team, etc.
        if (!entity || !entity.entityId) {
          console.warn('⚠️ InviteUserModal: Skipping invalid entity:', entity);
          return;
        }

        // Skip if we've already seen this entityId (across entire tree)
        if (seenIds.has(entity.entityId)) {
          console.warn('⚠️ InviteUserModal: Skipping duplicate entity:', entity.entityId, entity.entityName);
          return;
        }

        seenIds.add(entity.entityId);
        result.push({
          ...entity,
          displayLevel: level,
          hierarchyPath: entity.hierarchyPath || entity.fullHierarchyPath || entity.entityName,
          entityType: entity.entityType || 'organization' // Default to organization if missing
        });

        // Recursively process children (which can be organizations, locations, etc.)
        // Pass the same seenIds Set to track duplicates across entire tree
        if (entity.children && Array.isArray(entity.children) && entity.children.length > 0) {
          const childResults = flatten(entity.children, level + 1, seenIds);
          result = result.concat(childResults);
        }
      });
      return result;
    };

    const flattened = flatten(hierarchy);

    // Final deduplication pass to ensure no duplicates (safety check)
    const finalSeenIds = new Set<string>();
    const deduplicated = flattened.filter(entity => {
      if (!entity || !entity.entityId || finalSeenIds.has(entity.entityId)) {
        if (entity && entity.entityId) {
          console.warn('⚠️ InviteUserModal: Final deduplication in hierarchyEntities - removing duplicate:', entity.entityId, entity.entityName);
        }
        return false;
      }
      finalSeenIds.add(entity.entityId);
      return true;
    });

    // Log entity type breakdown
    const entityTypeCounts = deduplicated.reduce((acc: any, e: any) => {
      const type = e.entityType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return deduplicated;
  }, [hierarchy]);

  // Prioritize hierarchy hook data (includes locations) over provided entities
  // Don't merge - use one source to avoid duplicates
  const effectiveEntities = useMemo(() => {
    // If hierarchy hook data is available, use it (it includes locations)
    if (hierarchyEntities && hierarchyEntities.length > 0) {
      return hierarchyEntities;
    }
    
    // Fallback to provided entities if hierarchy hook not available
    if (availableEntitiesProp && availableEntitiesProp.length > 0) {
      return availableEntitiesProp;
    }
    
    return [];
  }, [hierarchyEntities, availableEntitiesProp]);
  
  const effectiveEntitiesLoading = useMemo(() => {
    // If hierarchy is loading, show loading state
    if (hierarchyLoading) return true;
    // Otherwise use provided loading state
    return entitiesLoadingProp !== undefined ? entitiesLoadingProp : false;
  }, [hierarchyLoading, entitiesLoadingProp]);

  // Flatten entities for easier selection (recursive function)
  // IMPORTANT: All hooks must be called before any early returns
  const flattenedEntities = useMemo(() => {
    if (!effectiveEntities || effectiveEntities.length === 0) {
      return [];
    }

    // If entities already have children structure, flatten recursively
    const flatten = (entities: any[], level = 0, seenIds = new Set<string>()): any[] => {
      let result: any[] = [];

      entities.forEach(entity => {
        if (!entity || !entity.entityId) {
          console.warn('⚠️ InviteUserModal: Skipping invalid entity in flatten:', entity);
          return;
        }

        // Skip if we've already seen this entityId (across entire tree)
        if (seenIds.has(entity.entityId)) {
          console.warn('⚠️ InviteUserModal: Skipping duplicate entity:', entity.entityId, entity.entityName);
          return;
        }

        seenIds.add(entity.entityId);

        // Include all entity types - don't filter
        result.push({
          ...entity,
          displayLevel: level,
          entityType: entity.entityType || 'organization'
        });

        // Recursively process children - pass the same seenIds Set
        if (entity.children && Array.isArray(entity.children) && entity.children.length > 0) {
          result = result.concat(flatten(entity.children, level + 1, seenIds));
        }
      });
      return result;
    };

    // Check if entities have nested children structure
    const hasChildren = effectiveEntities.some(e => e.children && Array.isArray(e.children) && e.children.length > 0);

    if (hasChildren) {
      // Already hierarchical - flatten it with shared seenIds Set
      const flattened = flatten(effectiveEntities);
      
      // Final deduplication pass to ensure no duplicates (safety check)
      const finalSeenIds = new Set<string>();
      const deduplicated = flattened.filter(entity => {
        if (!entity || !entity.entityId || finalSeenIds.has(entity.entityId)) {
          if (entity && entity.entityId) {
            console.warn('⚠️ InviteUserModal: Final deduplication - removing duplicate:', entity.entityId, entity.entityName);
          }
          return false;
        }
        finalSeenIds.add(entity.entityId);
        return true;
      });
      
      return deduplicated;
    }

    // Already flat list - deduplicate and add display level
    const seenIds = new Set<string>();
    const processed = effectiveEntities
      .filter(entity => {
        if (!entity || !entity.entityId || seenIds.has(entity.entityId)) {
          if (entity && entity.entityId) {
            console.warn('⚠️ InviteUserModal: Skipping duplicate entity in flat list:', entity.entityId, entity.entityName);
          }
          return false;
        }
        seenIds.add(entity.entityId);
        return true;
      })
      .map((entity) => ({
        ...entity,
        displayLevel: entity.hierarchyLevel || entity.displayLevel || 0,
        entityType: entity.entityType || 'organization'
      }));

    return processed;
  }, [effectiveEntities]);

  const filteredEntities = useMemo(() => {
    // Safety check: detect any duplicates in flattenedEntities
    const entityIdCounts = new Map<string, number>();
    flattenedEntities.forEach(e => {
      if (e && e.entityId) {
        entityIdCounts.set(e.entityId, (entityIdCounts.get(e.entityId) || 0) + 1);
      }
    });
    
    const duplicates = Array.from(entityIdCounts.entries()).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      console.error('❌ InviteUserModal: Found duplicate entityIds in flattenedEntities:', duplicates);
    }
    
    if (!searchTerm) {
      // No search term - return all entities (organizations, locations, etc.)
      return flattenedEntities;
    }
    
    // Filter by search term - include all entity types
    const filtered = flattenedEntities.filter(e => {
      if (!e || !e.entityName) return false;
      const nameMatch = e.entityName.toLowerCase().includes(searchTerm.toLowerCase());
      const typeMatch = e.entityType?.toLowerCase().includes(searchTerm.toLowerCase());
      const pathMatch = (e.hierarchyPath || e.fullHierarchyPath || '').toLowerCase().includes(searchTerm.toLowerCase());
      return nameMatch || typeMatch || pathMatch;
    });
    
    return filtered;
  }, [flattenedEntities, searchTerm]);

  const handleEntityToggle = (entityId: string, entityType: string) => {
    // Ensure inviteForm and entities exist
    const currentEntities = inviteForm?.entities || [];
    const isSelected = currentEntities.some((e: any) => e && e.entityId === entityId);
    
    if (!setInviteForm || typeof setInviteForm !== 'function') {
      console.error('❌ setInviteForm is not a function!', setInviteForm);
      return;
    }

    // Read current state directly (setInviteForm expects a plain object, not a function)
    const currentForm = inviteForm || {
    email: '',
    name: '',
    entities: [],
    primaryEntityId: '',
      message: '',
      invitationType: 'multi-entity' as const
    };

    if (isSelected) {
      // Remove entity
      const updated = {
        ...currentForm,
        entities: currentEntities.filter((e: any) => e && e.entityId !== entityId),
        primaryEntityId: currentForm.primaryEntityId === entityId ? '' : (currentForm.primaryEntityId || '')
      };
      setInviteForm(updated);
    } else {
      // Add entity with default role if available, otherwise empty string (will show as "No role")
      const defaultRole = effectiveRoles.length > 0 ? effectiveRoles[0].roleId : '';
      const updated = {
        ...currentForm,
        entities: [...currentEntities, {
          entityId,
          roleId: defaultRole,
          entityType,
          membershipType: 'direct'
        }],
        // Set as primary if it's the first one
        primaryEntityId: currentForm.primaryEntityId || entityId
      };
      setInviteForm(updated);
    }
  };

  const handleEntityRoleChange = (entityId: string, roleId: string) => {
    // Handle "none" value to clear the role - use empty string for no role
    const finalRoleId = roleId === 'none' || roleId === '' ? '' : roleId;
    const currentForm = inviteForm || {
      email: '',
      name: '',
      entities: [],
      primaryEntityId: '',
      message: '',
      invitationType: 'multi-entity' as const
    };
    const currentEntities = currentForm.entities || [];
    const updated = {
      ...currentForm,
      entities: currentEntities.map((e: any) =>
        e && e.entityId === entityId ? { ...e, roleId: finalRoleId } : e
      )
    };
    setInviteForm(updated);
  };

  const isEntitySelected = (entityId: string) => {
    const entities = inviteForm?.entities || [];
    return entities.some((e: any) => e && e.entityId === entityId);
  };

  const getSelectedEntityRole = (entityId: string) => {
    const entities = inviteForm?.entities || [];
    const entity = entities.find((e: any) => e && e.entityId === entityId);
    // Return 'none' if no roleId or if roleId is empty string
    if (!entity || !entity.roleId || entity.roleId === '') {
      return 'none';
    }
    return entity.roleId;
  };

  const handlePrimaryEntityChange = (entityId: string) => {
    const currentForm = inviteForm || {
      email: '',
      name: '',
      entities: [],
      primaryEntityId: '',
      message: '',
      invitationType: 'multi-entity' as const
    };
    setInviteForm({ ...currentForm, primaryEntityId: entityId });
  };

  // Early return AFTER all hooks have been called
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => {
        // Close modal when clicking backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Card 
        className="w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl pointer-events-auto bg-white dark:bg-slate-950"
        onClick={(e) => {
          // Prevent clicks inside the card from closing the modal
          e.stopPropagation();
        }}
      >
        <CardHeader className="border-b px-6 py-4 flex-shrink-0 flex flex-row items-center justify-between space-y-0">
              <div>
            <CardTitle className="text-xl">Invite Team Member</CardTitle>
            <CardDescription>Send an invitation to join your organization</CardDescription>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </CardHeader>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row pointer-events-auto">
          {/* Left Panel: User Details & Entity Selection */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 border-r border-slate-200 dark:border-slate-800 pointer-events-auto">
            
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
                    value={inviteForm?.email || ''}
                    onChange={(e) => {
                      const currentForm = inviteForm || {
                        email: '',
                        name: '',
                        entities: [],
                        primaryEntityId: '',
                        message: '',
                        invitationType: 'multi-entity' as const
                      };
                      setInviteForm({ ...currentForm, email: e.target.value });
                    }}
                    onFocus={(e) => {
                      e.stopPropagation();
                    }}
                    placeholder="user@example.com"
                    autoComplete="email"
                    className="pointer-events-auto"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Full Name <span className="text-red-500">*</span></Label>
                  <Input
                    value={inviteForm?.name || ''}
                    onChange={(e) => {
                      const currentForm = inviteForm || {
                        email: '',
                        name: '',
                        entities: [],
                        primaryEntityId: '',
                        message: '',
                        invitationType: 'multi-entity' as const
                      };
                      setInviteForm({ ...currentForm, name: e.target.value });
                    }}
                    onFocus={(e) => {
                      e.stopPropagation();
                    }}
                    placeholder="John Doe"
                    autoComplete="name"
                    className="pointer-events-auto"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Entity Selection Section */}
            <div className="space-y-4 flex-1">
              <div className="flex items-center justify-between">
                 <h3 className="text-sm font-semibold text-[#1B2E5A] dark:text-slate-200 flex items-center gap-2">
                  <Building className="w-4 h-4" /> Assign Access
                </h3>
                <div className="relative w-48 pointer-events-auto">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
                  <Input
                    placeholder="Search entities..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                    }}
                    onFocus={(e) => {
                      e.stopPropagation();
                    }}
                    className="pl-9 h-9 pointer-events-auto"
                  />
                </div>
              </div>
              
              {effectiveEntitiesLoading || rolesLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                  <p className="text-sm">
                    {effectiveEntitiesLoading ? 'Loading organization structure...' : 'Loading roles...'}
                  </p>
                </div>
              ) : flattenedEntities.length === 0 ? (
                <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-xl">
                  <Building className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p>No organizations or locations found.</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px] border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredEntities.map((entity, index) => {
                      const selected = isEntitySelected(entity.entityId);
                      const isLocation = entity.entityType === 'location';
                      // Use entityId as key, but add index as fallback to ensure uniqueness
                      const uniqueKey = `${entity.entityId}-${index}`;
                      return (
                        <div 
                          key={uniqueKey}
                          className={`
                            p-3 flex items-center gap-3 transition-colors
                            ${selected ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'}
                          `}
                        >
                          <div 
                            className="flex-shrink-0 flex items-center gap-1"
                            style={{ marginLeft: `${entity.displayLevel * 20}px` }}
                          >
                             {/* Indentation indicator for hierarchy */}
                             {entity.displayLevel > 0 && (
                               <div className="w-4 flex items-center justify-center">
                                 <ChevronRight className="w-3 h-3 text-slate-400" />
                               </div>
                             )}
                             <div 
                                className={`
                                  w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer pointer-events-auto
                                  ${selected 
                                    ? 'bg-[#1B2E5A] border-blue-600 text-white' 
                                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                                  }
                                `}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleEntityToggle(entity.entityId, entity.entityType);
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                }}
                                role="checkbox"
                                aria-checked={selected}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleEntityToggle(entity.entityId, entity.entityType);
                                  }
                                }}
                             >
                               {selected && <Check className="w-3.5 h-3.5" />}
                             </div>
                            </div>
                            
                          <div 
                            className="flex-1 min-w-0 cursor-pointer pointer-events-auto"
                            onClick={(e) => {
                              // Don't toggle if clicking on the role select area
                              const target = e.target as HTMLElement;
                              if (target.closest('.flex-shrink-0.w-40') || target.closest('[role="combobox"]') || target.closest('[data-radix-popper-content-wrapper]')) {
                                return;
                              }
                              handleEntityToggle(entity.entityId, entity.entityType);
                            }}
                            onMouseDown={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest('.flex-shrink-0.w-40') || target.closest('[role="combobox"]')) {
                                e.stopPropagation();
                              }
                            }}
                          >
                              <div className="flex items-center gap-2">
                              {/* Entity Type Icon */}
                              {isLocation ? (
                                <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                              ) : (
                                <Building className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              )}
                               <span className={`text-sm font-medium truncate ${selected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                 {entity.entityName}
                               </span>
                               <Badge 
                                 variant="outline" 
                                 className={`text-[10px] h-5 px-1.5 uppercase tracking-wider ${
                                   isLocation 
                                     ? 'bg-green-50 text-green-700 border-green-200' 
                                     : 'bg-blue-50 text-blue-700 border-blue-200'
                                 }`}
                               >
                                  {entity.entityType}
                                </Badge>
                              </div>
                            <div className="text-xs text-slate-500 truncate mt-0.5">
                              {entity.fullHierarchyPath || entity.hierarchyPath || entity.entityName}
                            </div>
                          </div>

                          {selected && (
                             <div 
                               className="flex-shrink-0 w-40 pointer-events-auto"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 e.preventDefault();
                               }}
                               onMouseDown={(e) => {
                                 e.stopPropagation();
                               }}
                               onPointerDown={(e) => {
                                 e.stopPropagation();
                               }}
                             >
                               <Select
                                 value={getSelectedEntityRole(entity.entityId) || 'none'}
                                 onValueChange={(value) => {
                                   handleEntityRoleChange(entity.entityId, value);
                                 }}
                                 disabled={rolesLoading || effectiveRoles.length === 0}
                               >
                                 <SelectTrigger 
                                   className="h-8 text-xs"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                   }}
                                   onMouseDown={(e) => {
                                     e.stopPropagation();
                                   }}
                                 >
                                   <SelectValue placeholder={rolesLoading ? "Loading..." : effectiveRoles.length === 0 ? "No roles" : "Select Role"} />
                                 </SelectTrigger>
                                 <SelectContent>
                                   {effectiveRoles.length === 0 ? (
                                     <SelectItem value="no-roles" disabled>No roles available</SelectItem>
                                   ) : (
                                     <>
                                       <SelectItem value="none">No role</SelectItem>
                                       {effectiveRoles.map((role: any) => (
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
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
              <p className="text-xs text-slate-500">
                Check boxes to grant access. Use the dropdown to assign roles for specific entities.
              </p>
            </div>
          </div>

          {/* Right Panel: Summary & Message */}
          <div className="w-full md:w-80 bg-slate-50 dark:bg-slate-900/30 border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col overflow-y-auto pointer-events-auto">
             <div className="space-y-6 flex-1">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-[#1B2E5A] dark:text-slate-200">Access Summary</h3>
                  {(!inviteForm?.entities || inviteForm.entities.length === 0) ? (
                    <div className="text-sm text-slate-500 italic">No organizations selected yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {inviteForm.entities.map((entity: any, index: number) => {
                        const entityData = flattenedEntities.find(e => e.entityId === entity.entityId);
                        const roleData = effectiveRoles.find((r: any) => r.roleId === entity.roleId);
                        const isPrimary = inviteForm.primaryEntityId === entity.entityId;

                        return (
                          <div key={`${entity.entityId}-${index}`} 
                            className={`
                              p-3 rounded-lg border text-sm
                              ${isPrimary 
                                ? 'bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800 shadow-sm' 
                                : 'bg-slate-100 dark:bg-slate-900 border-transparent'
                              }
                            `}
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
                                  className="text-[10px] text-slate-400 hover:text-blue-600 font-medium transition-colors"
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
                    value={inviteForm?.message || ''}
                    onChange={(e) => {
                      const currentForm = inviteForm || {
                        email: '',
                        name: '',
                        entities: [],
                        primaryEntityId: '',
                        message: '',
                        invitationType: 'multi-entity' as const
                      };
                      setInviteForm({ ...currentForm, message: e.target.value });
                    }}
                    onFocus={(e) => {
                      e.stopPropagation();
                    }}
                    rows={4}
                    placeholder="Welcome to our team! We're excited to have you join us."
                    className="bg-white dark:bg-slate-950 resize-none pointer-events-auto"
                  />
                </div>
          </div>

             <div className="pt-6 mt-auto space-y-3">
               <PearlButton
              onClick={onInvite}
                  disabled={!inviteForm?.email || !inviteForm?.name || !inviteForm?.entities || inviteForm.entities.length === 0 || isLoading}
                  className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending Invitation...
                </>
              ) : (
                'Send Invitation'
              )}
                </PearlButton>
                <PearlButton
                  onClick={onClose}
                  variant="secondary"
                  className="w-full"
                >
                  Cancel
                </PearlButton>
             </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
