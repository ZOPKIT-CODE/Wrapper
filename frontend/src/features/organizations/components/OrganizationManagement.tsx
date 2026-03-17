import React, { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PearlButton } from '@/components/ui/pearl-button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { OrganizationHierarchyFlow } from '@/features/organizations/components/OrganizationHierarchyFlow'
import { EditResponsiblePersonModal } from './modals/EditResponsiblePersonModal'
import { Application } from '@/hooks/useDashboardData'
import { useTenantApplications } from '@/hooks/useSharedQueries'
import { Container } from '@/components/common/Page'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useOrganizationAuth } from '@/hooks/useOrganizationAuth'
import api from '@/lib/api'

import {
  Users,
  Plus,
  Edit,
  Trash2,
  MapPin,
  Network,
  ChevronRight,
  ChevronDown,
  TreePine,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Search,
  RefreshCw,
  ArrowRightLeft,
  CreditCard,
  UserCog,
  Building,
  MoreHorizontal,
  LayoutGrid,
  List
} from 'lucide-react'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'
import toast from 'react-hot-toast'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// --- Types ---

interface Entity {
  entityId: string;
  entityName: string;
  entityType: 'organization' | 'location' | 'department' | 'team';
  organizationType?: string;
  locationType?: string;
  entityLevel: number;
  hierarchyPath: string;
  fullHierarchyPath: string;
  parentEntityId?: string;
  responsiblePersonId?: string;
  isActive: boolean;
  description?: string;
  availableCredits?: number;
  freeCredits?: number;
  paidCredits?: number;
  address?: any;
  children: Entity[];
  createdAt?: string;
  updatedAt?: string;
  applicationAllocations?: Array<{
    application: string;
    allocatedCredits: number;
    usedCredits: number;
    availableCredits: number;
    hasAllocation: boolean;
    autoReplenish: boolean;
  }>;
}

interface Employee {
  userId: string;
  email: string;
  name: string;
  isActive: boolean;
  isTenantAdmin: boolean;
  onboardingCompleted: boolean;
  department?: string;
  title?: string;
}

interface Organization {
  entityId: string;
  entityName: string;
  entityType: 'organization' | 'location' | 'department' | 'team';
  entityLevel: number;
  hierarchyPath: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  parentEntityId?: string;
  responsiblePersonId?: string;
  children?: Organization[];
  organizationType?: string;
  locationType?: string;
  address?: any;
  availableCredits?: number;
  reservedCredits?: number;
  totalCredits?: number;
  freeCredits?: number;
  paidCredits?: number;
}

interface Location {
  entityId: string;
  entityName: string;
  entityType: 'location';
  entityLevel: number;
  hierarchyPath: string;
  fullHierarchyPath?: string;
  description?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  city?: string;
  state?: string;
  country?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  parentEntityId?: string;
  responsiblePersonId?: string;
  locationType?: string;
  capacity?: {
    maxOccupancy?: number;
    currentOccupancy?: number;
    utilizationPercentage?: number;
    resources?: Record<string, any>;
  };
  children?: Location[];
  availableCredits?: number;
  freeCredits?: number;
}

interface OrganizationHierarchy {
  success: boolean;
  hierarchy: Organization[];
  totalOrganizations: number;
  message: string;
}

interface OrganizationManagementProps {
  employees: Employee[];
  applications: Application[];
  isAdmin: boolean;
  makeRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
  loadDashboardData: () => void;
  inviteEmployee: () => void;
  tenantId?: string;
}

// --- Main Page Component ---

export function OrganizationPage({ isAdmin = false }: { isAdmin?: boolean }) {
  const { tenantId } = useOrganizationAuth()
  const { users: employees, applications, refreshDashboard } = useDashboardData();

  return (
    <Container className="py-6 max-w-7xl mx-auto">
      <OrganizationManagement
        employees={employees || []}
        isAdmin={isAdmin || false}
        tenantId={tenantId}
        applications={applications || []}
        makeRequest={async (endpoint: string, options?: RequestInit) => {
          try {
            const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            const apiPath = normalizedEndpoint;
            const headers: Record<string, string> = { 'X-Application': 'crm' };

            if (options?.headers) {
              const h: any = options.headers as any;
              if (typeof Headers !== 'undefined' && h instanceof Headers) {
                h.forEach((value: any, key: string) => { headers[key] = String(value); });
              } else if (Array.isArray(h)) {
                h.forEach(([key, value]: [string, any]) => { headers[key] = String(value); });
              } else {
                Object.assign(headers, h as Record<string, string>);
              }
            }

            const axiosConfig: any = {
              method: options?.method,
              headers,
              withCredentials: true,
            };

            if (options?.body) {
              try {
                axiosConfig.data = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
              } catch {
                axiosConfig.data = options.body;
              }
            }

            const response = await api(apiPath, axiosConfig);
            return response.data;
          } catch (error: any) {
            throw error;
          }
        }}
        loadDashboardData={refreshDashboard}
        inviteEmployee={() => { }}
      />
    </Container>
  )
}

// --- Organization Tree Component ---

export function OrganizationTreeManagement({
  tenantId,
  isAdmin,
  makeRequest,
  applications,
  employees = [],
  showEditResponsiblePerson,
  setShowEditResponsiblePerson,
  editingEntity,
  setEditingEntity,
  getResponsiblePersonName,
  loadResponsiblePersonNames
}: {
  tenantId: string;
  isAdmin: boolean;
  makeRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
  applications: Application[];
  employees?: any[];
  showEditResponsiblePerson: boolean;
  setShowEditResponsiblePerson: (show: boolean) => void;
  editingEntity: Entity | null;
  setEditingEntity: (entity: Entity | null) => void;
  getResponsiblePersonName: (userId: string) => string;
  loadResponsiblePersonNames: (entities: (Entity | Organization)[]) => Promise<void>;
}) {
  const navigate = useNavigate()
  const { data: cachedApplications = [] } = useTenantApplications(tenantId);

  const effectiveApplications = useMemo(() => {
    let apps;
    if (applications && Array.isArray(applications) && applications.length > 0) {
      apps = applications;
    } else {
      apps = cachedApplications;
    }

    // Deduplicate applications by appCode to prevent duplicate keys
    return apps.filter((app: any, index: number, self: any[]) =>
      app && app.appCode && index === self.findIndex(a => a.appCode === app.appCode)
    );
  }, [applications, cachedApplications]);

  const [hierarchy, setHierarchy] = useState<OrganizationHierarchy | null>(null);
  const [parentOrg, setParentOrg] = useState<Organization | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Dialog States
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCreditTransfer, setShowCreditTransfer] = useState(false);
  const [showAllocationDialog, setShowAllocationDialog] = useState(false);
  const [showHierarchyChart, setShowHierarchyChart] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [allocating, setAllocating] = useState(false);
  
  // Loading states for CRUD operations
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTransferringCredits, setIsTransferringCredits] = useState(false);

  // Forms
  const [createFormStep, setCreateFormStep] = useState(0);
  const [managerUsers, setManagerUsers] = useState<any[]>([]);
  const [createForm, setCreateForm] = useState({
    entityType: 'organization' as 'organization' | 'location' | 'department' | 'team',
    subType: 'subsidiary',
    name: '',
    code: '',
    legalName: '',
    description: '',
    status: 'active',
    responsiblePersonId: '',
    country: '',
    currency: 'USD',
    fiscalYearEnd: '12-31',
    taxId: '',
    registrationNumber: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
  });
  const [editForm, setEditForm] = useState({ name: '', description: '', isActive: true });
  const [creditTransferForm, setCreditTransferForm] = useState({
    sourceEntityType: 'organization', sourceEntityId: '', destinationEntityType: 'organization', destinationEntityId: '', amount: '', transferType: 'direct', isTemporary: false, recallDeadline: '', description: ''
  });
  const [allocationForm, setAllocationForm] = useState({
    targetApplication: '', creditAmount: 0, allocationPurpose: '', autoReplenish: false
  });

  const queryClient = useQueryClient();

  const COUNTRY_CURRENCY_MAP: Record<string, string> = {
    US: 'USD', GB: 'GBP', IN: 'INR', CA: 'CAD', AU: 'AUD',
    JP: 'JPY', CN: 'CNY', DE: 'EUR', FR: 'EUR', SG: 'SGD', CH: 'CHF',
  };

  const managerUserList = useMemo(() => {
    const fromApi = (managerUsers || []).map((u: any) => ({
      userId: u.userId || u.id,
      name: u.name ?? u.email ?? '',
      email: u.email ?? ''
    }));
    if (fromApi.length > 0) return fromApi;
    return (employees || []).map((e: any) => ({
      userId: e.userId || e.id,
      name: e.name ?? e.email ?? '',
      email: e.email ?? ''
    }));
  }, [managerUsers, employees]);

  const currentCreateSteps = ['Basic Information', 'Location & Currency', 'Legal & Compliance', 'Contact & Additional'];

  const loadData = async () => {
    try {
      setLoading(true);
      let hierarchyResponse = await makeRequest(`/entities/hierarchy/${tenantId}`, { headers: { 'X-Application': 'crm' } });

      if (!hierarchyResponse || !hierarchyResponse.success) {
        // Fallback
        const fallbackResponse = await makeRequest(`/admin/organizations/all`, { headers: { 'X-Application': 'crm' } });
        if (fallbackResponse && fallbackResponse.success) {
          setHierarchy({
            success: true,
            hierarchy: (fallbackResponse.data?.entities || fallbackResponse.entities || []).map((entity: any) => ({ ...entity, children: [] })),
            totalOrganizations: fallbackResponse.data?.entities?.length || fallbackResponse.entities?.length || 0,
            message: 'Hierarchy loaded via fallback'
          });
          return;
        }
      } else {
        const rawHierarchy = hierarchyResponse.data?.hierarchy || hierarchyResponse.hierarchy || [];

        // Normalize credits on a single entity (for both tree and flat)
        const normalizeCredits = (entity: any): void => {
          if (entity.entityType === 'organization' || entity.entityType === 'location') {
            entity.availableCredits = entity.availableCredits !== undefined && entity.availableCredits !== null
              ? (typeof entity.availableCredits === 'string'
                ? parseFloat(entity.availableCredits) || 0
                : typeof entity.availableCredits === 'number'
                  ? entity.availableCredits
                  : 0)
              : 0;
            entity.reservedCredits = entity.reservedCredits !== undefined && entity.reservedCredits !== null
              ? (typeof entity.reservedCredits === 'string'
                ? parseFloat(entity.reservedCredits) || 0
                : typeof entity.reservedCredits === 'number'
                  ? entity.reservedCredits
                  : 0)
              : 0;
            entity.totalCredits = typeof entity.totalCredits === 'number'
              ? entity.totalCredits
              : (entity.availableCredits + entity.reservedCredits);
          }
          if (entity.children && entity.children.length > 0) {
            entity.children.forEach((child: any) => normalizeCredits(child));
          }
        };

        // Sort children by entityType and name (used for both tree and flat)
        const sortChildren = (entities: any[]): void => {
          entities.forEach(entity => {
            if (entity.children && entity.children.length > 0) {
              entity.children.sort((a: any, b: any) => {
                if (a.entityType !== b.entityType) {
                  if (a.entityType === 'organization') return -1;
                  if (b.entityType === 'organization') return 1;
                }
                return (a.entityName || '').localeCompare(b.entityName || '');
              });
              sortChildren(entity.children);
            }
          });
        };

        // API may return already-nested tree (root nodes with .children). If so, use as-is.
        const isAlreadyTree = rawHierarchy.length > 0 && rawHierarchy.some(
          (e: any) => e.children && Array.isArray(e.children) && e.children.length > 0
        );

        let hierarchyData: any[];

        if (isAlreadyTree) {
          // Use tree as-is; normalize credits and sort
          hierarchyData = rawHierarchy.map((node: any) => ({ ...node, children: node.children || [] }));
          hierarchyData.forEach((node: any) => normalizeCredits(node));
          sortChildren(hierarchyData);
        } else {
          // Build tree from flat array
          const buildTree = (flatArray: any[]): any[] => {
            const entityMap = new Map<string, any>();
            const rootEntities: any[] = [];

            flatArray.forEach((entity: any) => {
              const node = { ...entity, children: [] };
              normalizeCredits(node);
              entityMap.set(entity.entityId, node);
            });

            flatArray.forEach((entity: any) => {
              const node = entityMap.get(entity.entityId);
              if (entity.parentEntityId && entityMap.has(entity.parentEntityId)) {
                entityMap.get(entity.parentEntityId).children.push(node);
              } else {
                rootEntities.push(node);
              }
            });

            sortChildren(rootEntities);
            return rootEntities;
          };
          hierarchyData = buildTree(rawHierarchy);
        }

        // Flatten tree for logging (collect all nodes recursively)
        const flattenForLog = (entities: any[]): any[] => {
          const out: any[] = [];
          entities.forEach((e: any) => {
            out.push(e);
            if (e.children?.length) out.push(...flattenForLog(e.children));
          });
          return out;
        };
        const flatForLog = flattenForLog(hierarchyData);
        const orgsWithCredits = flatForLog
          .filter((e: any) => e.entityType === 'organization')
          .map((e: any) => ({
            name: e.entityName,
            entityId: e.entityId,
            availableCredits: e.availableCredits,
            reservedCredits: e.reservedCredits,
            hasCreditsField: 'availableCredits' in e
          }));

        // Ensure credits are set for all organizations and locations (parse strings to numbers)
        const ensureCredits = (entities: any[]): void => {
          entities.forEach((entity: any) => {
            if (entity.entityType === 'organization' || entity.entityType === 'location') {
              // Always set credits to numbers (default to 0) so they display
              entity.availableCredits = entity.availableCredits !== undefined && entity.availableCredits !== null
                ? (typeof entity.availableCredits === 'string'
                  ? parseFloat(entity.availableCredits) || 0
                  : typeof entity.availableCredits === 'number'
                    ? entity.availableCredits
                    : 0)
                : 0;

              entity.reservedCredits = entity.reservedCredits !== undefined && entity.reservedCredits !== null
                ? (typeof entity.reservedCredits === 'string'
                  ? parseFloat(entity.reservedCredits) || 0
                  : typeof entity.reservedCredits === 'number'
                    ? entity.reservedCredits
                    : 0)
                : 0;

              entity.totalCredits = typeof entity.totalCredits === 'number'
                ? entity.totalCredits
                : (entity.availableCredits + entity.reservedCredits);
            }
            if (entity.children && entity.children.length > 0) {
              ensureCredits(entity.children);
            }
          });
        };

        ensureCredits(hierarchyData);

        // Helper function to count total entities including children
        const countEntities = (entities: any[]): number => {
          let count = entities.length;
          entities.forEach((entity: any) => {
            if (entity.children && Array.isArray(entity.children) && entity.children.length > 0) {
              count += countEntities(entity.children);
            }
          });
          return count;
        };

        const totalCount = countEntities(hierarchyData);

        // Find the root/parent organization - prioritize by entityLevel, then by lack of parentEntityId
        let parent = null;

        // First try to find organizations with entityLevel 1 (tenant org created during onboarding)
        parent = hierarchyData.find((org: any) => org.entityType === 'organization' && org.entityLevel === 1);

        // If not found, try entityLevel 0 or organizations without parentEntityId
        if (!parent) {
          parent = hierarchyData.find((org: any) =>
            org.entityType === 'organization' &&
            (org.entityLevel === 0 || !org.parentEntityId)
          );
        }

        // If still not found, just take the first organization as parent
        if (!parent && hierarchyData.length > 0) {
          parent = hierarchyData.find((org: any) => org.entityType === 'organization') || hierarchyData[0];
          console.warn('⚠️ No clear root organization found, using first organization as parent:', parent);
        }

        setParentOrg(parent || null);

        // Load locations and organizations separately to merge credits (they have actual credit values)
        const [locRes, orgRes] = await Promise.all([
          makeRequest(`/entities/tenant/${tenantId}?entityType=location`),
          makeRequest(`/entities/tenant/${tenantId}?entityType=organization`)
        ]);

        // Merge credits from both locations and organizations
        const mergeCredits = (entities: any[], sourceData: any[], entityType: string): void => {
          entities.forEach((entity: any) => {
            // Find matching entity in source data
            const matchingEntity = sourceData.find((e: any) => e.entityId === entity.entityId);
            if (matchingEntity) {
              // Parse and update credits from source data (they have actual credit values)
              if (matchingEntity.availableCredits !== undefined && matchingEntity.availableCredits !== null) {
                entity.availableCredits = typeof matchingEntity.availableCredits === 'string'
                  ? parseFloat(matchingEntity.availableCredits) || 0
                  : typeof matchingEntity.availableCredits === 'number'
                    ? matchingEntity.availableCredits
                    : entity.availableCredits || 0;
              }

              if (matchingEntity.reservedCredits !== undefined && matchingEntity.reservedCredits !== null) {
                entity.reservedCredits = typeof matchingEntity.reservedCredits === 'string'
                  ? parseFloat(matchingEntity.reservedCredits) || 0
                  : typeof matchingEntity.reservedCredits === 'number'
                    ? matchingEntity.reservedCredits
                    : entity.reservedCredits || 0;
              }

              entity.totalCredits = (entity.availableCredits || 0) + (entity.reservedCredits || 0);

            }

            // Recursively process children
            if (entity.children && entity.children.length > 0) {
              mergeCredits(entity.children, sourceData, entityType);
            }
          });
        };

        if (locRes?.success) {
          const locationsData = locRes.entities || [];
          setLocations(locationsData);
          mergeCredits(hierarchyData, locationsData, 'location');
        }

        if (orgRes?.success) {
          const organizationsData = orgRes.entities || [];
          mergeCredits(hierarchyData, organizationsData, 'organization');
        }

        // Log final credits for debugging
        const finalCredits = hierarchyData.map((org: any) => ({
          entityId: org.entityId,
          entityName: org.entityName,
          entityType: org.entityType,
          availableCredits: org.availableCredits,
          reservedCredits: org.reservedCredits,
          totalCredits: org.totalCredits
        }));

        // Set hierarchy after merging credits
        setHierarchy({
          success: true,
          hierarchy: hierarchyData,
          totalOrganizations: hierarchyResponse.data?.totalEntities || hierarchyResponse.totalEntities || 0,
          message: hierarchyResponse.message || 'Loaded'
        });
      }

    } catch (error: any) {
      toast.error(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [tenantId]);

  // --- Actions ---

  const createIdempotencyKey = (scope: string, entityId?: string): string =>
    `${scope}:${entityId ?? 'na'}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

  const validateCreateStep = (step: number): string | null => {
    if (step === 0) {
      if (!createForm.name.trim() || createForm.name.trim().length < 2) return 'Name must be at least 2 characters';
      if (!createForm.legalName.trim()) return 'Legal name is required';
    }
    if (step === 1) {
      if (!createForm.country) return 'Country is required';
      if (!createForm.currency) return 'Currency is required';
    }
    return null;
  };

  const handleCreateNext = () => {
    const err = validateCreateStep(createFormStep);
    if (err) return toast.error(err);
    setCreateFormStep(s => Math.min(s + 1, currentCreateSteps.length - 1));
  };

  const createEntity = async () => {
    if (isCreatingEntity) return;
    for (let step = 0; step < currentCreateSteps.length; step += 1) {
      const err = validateCreateStep(step);
      if (err) {
        setCreateFormStep(step);
        return toast.error(err);
      }
    }

    const loadingToastId = toast.loading(`Creating ${createForm.entityType}...`);
    const idempotencyKey = createIdempotencyKey(`create-${createForm.entityType}`, selectedOrg?.entityId);
    setIsCreatingEntity(true);
    try {
      const payload: any = {
        entityName: createForm.name.trim(),
        entityType: createForm.entityType,
        subType: createForm.subType,
        parentEntityId: selectedOrg?.entityId ?? null,
        parentTenantId: tenantId || '',
        responsiblePersonId: createForm.responsiblePersonId === 'none' ? null : createForm.responsiblePersonId || null,
        description: createForm.description || undefined,
        entityCode: createForm.code.trim() || undefined,
        status: createForm.status,
      };

      payload.legalName = createForm.legalName.trim();
      payload.country = createForm.country;
      payload.currency = createForm.currency;
      payload.fiscalYearEnd = createForm.fiscalYearEnd;
      payload.taxId = createForm.taxId || undefined;
      payload.registrationNumber = createForm.registrationNumber || undefined;
      payload.email = createForm.email || undefined;
      payload.phone = createForm.phone || undefined;
      payload.website = createForm.website || undefined;
      payload.notes = createForm.notes || undefined;

      const response = await makeRequest('/entities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Application': 'crm',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(payload)
      });

      if (response.success) {
        toast.success(`${createForm.entityType} created`);
        setShowCreateSub(false);
        queryClient.invalidateQueries({ queryKey: ['entities', 'hierarchy', tenantId] });
        queryClient.invalidateQueries({ queryKey: ['entities', 'available'] });
        queryClient.invalidateQueries({ queryKey: ['entities', tenantId] });
        await loadData();
      } else {
        toast.error(response?.message || `Failed to create ${createForm.entityType}`);
      }
    } catch (error: any) {
      toast.error(error?.message || `Failed to create ${createForm.entityType}`);
    } finally {
      toast.dismiss(loadingToastId);
      setIsCreatingEntity(false);
    }
  };

  const updateOrganization = async () => {
    if (isUpdating) return; // Prevent double submission
    if (!selectedOrg) return;

    const loadingToastId = toast.loading('Updating organization...');
    const idempotencyKey = createIdempotencyKey('update-organization', selectedOrg.entityId);
    setIsUpdating(true);
    try {
      const response = await makeRequest(`/entities/${selectedOrg.entityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Application': 'crm',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({ ...editForm, entityName: editForm.name, parentTenantId: tenantId || '' })
      });
      if (response.success) {
        toast.success('Updated successfully');
        setShowEdit(false);
        // Invalidate queries and reload data immediately
        queryClient.invalidateQueries({ queryKey: ['entities', 'hierarchy', tenantId] });
        queryClient.invalidateQueries({ queryKey: ['entities', 'available'] });
        queryClient.invalidateQueries({ queryKey: ['entities', tenantId] });
        await loadData();
      } else {
        toast.error(response?.message || 'Failed to update organization');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update organization');
    } finally {
      toast.dismiss(loadingToastId);
      setIsUpdating(false);
    }
  };

  const deleteOrganization = async (orgId: string, orgName?: string) => {
    if (isDeleting) return; // Prevent double submission

    const org = processedHierarchy.find(o => o.entityId === orgId);
    if (org && (org.parentEntityId == null || org.parentEntityId === '')) {
      toast.error('Cannot delete the primary organization created during onboarding.');
      return;
    }
    
    // Find organization name if not provided
    const orgToDelete = orgName || org?.entityName || processedHierarchy.find(o => o.entityId === orgId)?.entityName || 'this organization';
    if (!confirm(`Are you sure you want to delete "${orgToDelete}"? This action cannot be undone.`)) return;
    
    const loadingToastId = toast.loading(`Deleting "${orgToDelete}"...`);
    const idempotencyKey = createIdempotencyKey('delete-organization', orgId);
    setIsDeleting(true);
    try {
      const response = await makeRequest(`/entities/${orgId}`, {
        method: 'DELETE',
        headers: {
          'X-Application': 'crm',
          'X-Idempotency-Key': idempotencyKey
        }
      });
      if (response.success) {
        toast.success('Deleted');
        // Invalidate queries and reload data immediately
        queryClient.invalidateQueries({ queryKey: ['entities', 'hierarchy', tenantId] });
        queryClient.invalidateQueries({ queryKey: ['entities', 'available'] });
        queryClient.invalidateQueries({ queryKey: ['entities', tenantId] });
        await loadData();
      } else {
        toast.error(response?.message || 'Failed to delete organization');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete organization');
    } finally {
      toast.dismiss(loadingToastId);
      setIsDeleting(false);
    }
  };

  const handleAllocateCredits = async () => {
    if (allocating) return;
    if (!selectedEntity || !allocationForm.creditAmount) return toast.error('Fill required fields');
    if (allocationForm.creditAmount > Number(selectedEntity.availableCredits || 0)) return toast.error('Insufficient credits');

    const idempotencyKey = `org-alloc:${selectedEntity.entityId}:${allocationForm.targetApplication}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    const loadingToastId = toast.loading('Allocating credits...');
    setAllocating(true);
    try {
      const response = await makeRequest('/credits/allocate/application', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Application': 'crm',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({ sourceEntityId: selectedEntity.entityId, targetApplication: allocationForm.targetApplication, creditAmount: allocationForm.creditAmount, allocationPurpose: allocationForm.allocationPurpose, autoReplenish: allocationForm.autoReplenish })
      });
      if (response.success) {
        toast.success('Credits allocated');
        setShowAllocationDialog(false);
        queryClient.invalidateQueries({ queryKey: ['credit'] });
        queryClient.invalidateQueries({ queryKey: ['creditStatus'] });
        queryClient.invalidateQueries({ queryKey: ['entityScope'] });
        queryClient.invalidateQueries({ queryKey: ['entities', 'hierarchy', tenantId] });
        queryClient.invalidateQueries({ queryKey: ['entities', tenantId] });
        await loadData();
      } else {
        toast.error(response?.message || 'Credit allocation failed');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to allocate credits');
    } finally {
      toast.dismiss(loadingToastId);
      setAllocating(false);
    }
  };

  const handleTransferCredits = async () => {
    if (isTransferringCredits) return;
    if (!selectedOrg) return;

    const invalidDestination = !creditTransferForm.destinationEntityId
      || creditTransferForm.destinationEntityId === 'no-orgs'
      || creditTransferForm.destinationEntityId === 'no-locations';
    if (invalidDestination || !creditTransferForm.amount) {
      toast.error('Please select destination and amount');
      return;
    }

    const creditAmount = parseFloat(creditTransferForm.amount);
    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      toast.error('Please enter a valid credit amount');
      return;
    }

    const loadingToastId = toast.loading('Transferring credits...');
    const idempotencyKey = createIdempotencyKey('transfer-credits', selectedOrg.entityId);
    setIsTransferringCredits(true);
    try {
      const transferData = {
        fromEntityId: selectedOrg.entityId,
        toEntityType: creditTransferForm.destinationEntityType,
        toEntityId: creditTransferForm.destinationEntityId,
        creditAmount,
        reason: creditTransferForm.description || `Transfer from ${selectedOrg.entityName}`
      };
      const response = await makeRequest('/credits/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Application': 'crm',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(transferData)
      });
      if (response.success) {
        toast.success(`Successfully transferred ${creditAmount} credits`);
        setShowCreditTransfer(false);
        setCreditTransferForm({ sourceEntityType: 'organization', sourceEntityId: '', destinationEntityType: 'organization', destinationEntityId: '', amount: '', transferType: 'direct', isTemporary: false, recallDeadline: '', description: '' });
        queryClient.invalidateQueries({ queryKey: ['credit'] });
        queryClient.invalidateQueries({ queryKey: ['creditStatus'] });
        queryClient.invalidateQueries({ queryKey: ['entityScope'] });
        queryClient.invalidateQueries({ queryKey: ['entities', 'hierarchy', tenantId] });
        queryClient.invalidateQueries({ queryKey: ['entities', tenantId] });
        await loadData();
      } else {
        toast.error(response?.message || 'Credit transfer failed');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to transfer credits');
    } finally {
      toast.dismiss(loadingToastId);
      setIsTransferringCredits(false);
    }
  };

  // --- Transformation & Filtering ---

  const processedHierarchy = useMemo(() => {
    if (!hierarchy?.hierarchy) return [];

    const filterRecursive = (org: Organization, currentLevel: number = 0): Organization | null => {
      if (!org || !org.entityName) return null;

      const searchLower = searchTerm.toLowerCase().trim();
      const matchesSearch = !searchTerm || org.entityName.toLowerCase().includes(searchLower);
      const isOrgActive = org.isActive !== false;
      const matchesFilter = filterType === 'all' || (filterType === 'active' && isOrgActive) || (filterType === 'inactive' && !isOrgActive);

      let filteredChildren: Organization[] = [];
      if (org.children && Array.isArray(org.children) && org.children.length > 0) {
        filteredChildren = org.children
          .map(child => filterRecursive(child, currentLevel + 1))
          .filter((c): c is Organization => c !== null);
      }

      if ((matchesSearch && matchesFilter) || filteredChildren.length > 0) {
        // Ensure credits are always numbers
        const availableCredits = typeof (org as any).availableCredits === 'number'
          ? (org as any).availableCredits
          : (typeof (org as any).availableCredits === 'string'
            ? parseFloat((org as any).availableCredits) || 0
            : 0);
        const reservedCredits = typeof (org as any).reservedCredits === 'number'
          ? (org as any).reservedCredits
          : (typeof (org as any).reservedCredits === 'string'
            ? parseFloat((org as any).reservedCredits) || 0
            : 0);

        return {
          ...org,
          children: filteredChildren,
          // Ensure entityLevel is set for display
          entityLevel: org.entityLevel ?? currentLevel,
          // Explicitly preserve credits as numbers
          availableCredits,
          reservedCredits,
          totalCredits: typeof (org as any).totalCredits === 'number'
            ? (org as any).totalCredits
            : (availableCredits + reservedCredits)
        };
      }
      return null;
    };

    let result = hierarchy.hierarchy.map(org => filterRecursive(org, 0)).filter(Boolean) as Organization[];

    // Deduplicate by entityId to prevent duplicate keys (only at root level)
    const seenIds = new Set<string>();
    result = result.filter(org => {
      if (seenIds.has(org.entityId)) {
        console.warn('⚠️ OrganizationTreeManagement: Filtering out duplicate root entityId:', org.entityId, org.entityName);
        return false;
      }
      seenIds.add(org.entityId);
      return true;
    });

    // Debug: Log hierarchy structure
    const logHierarchy = (entities: Organization[], level: number = 0) => {
      entities.forEach(entity => {
        const indent = '  '.repeat(level);
        if (entity.children && entity.children.length > 0) {
          logHierarchy(entity.children, level + 1);
        }
      });
    };

    if (result.length > 0) {
      logHierarchy(result);
    }

    return result;
  }, [hierarchy, searchTerm, filterType]);

  const unassignedLocations = useMemo(() => {
    // Deduplicate locations by entityId to prevent duplicate keys
    const seenIds = new Set<string>();
    return locations.filter(l => {
      if (!l.parentEntityId && l.entityId && !seenIds.has(l.entityId)) {
        seenIds.add(l.entityId);
        return true;
      }
      return false;
    });
  }, [locations]);

  const canTransferCredits = (org: Organization) => org.children && org.children.length > 0;

  // Helper function to find organization by ID in hierarchy
  const findOrganizationById = (id: string, orgs: Organization[]): Organization | null => {
    for (const org of orgs) {
      if (org.entityId === id) {
        return org;
      }
      if (org.children && org.children.length > 0) {
        const found = findOrganizationById(id, org.children);
        if (found) return found;
      }
    }
    return null;
  };

  // --- Tree Node Component ---

  const TreeNode = ({ org, level = 0 }: { org: Organization | Location; level?: number }) => {
    const [expanded, setExpanded] = useState(level < 2);
    const orgChildren = (org as Organization).children || [];
    const hasChildren = orgChildren.length > 0;
    const isLocation = org.entityType === 'location';
    const isSelected = selectedItems.includes(org.entityId);

    return (
      <div className="relative">
        <div
          className={`
            group flex items-center p-3 mb-2 rounded-xl border transition-all duration-200 relative
            ${isSelected ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-md' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm'}
          `}
        >
          {/* Controls: Expand/Checkbox */}
          <div className="flex items-center gap-2 mr-3">
            <div className="w-5 h-5 flex items-center justify-center">
              {hasChildren ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors text-slate-500"
                  aria-label={expanded ? 'Collapse' : 'Expand'}
                >
                  {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              ) : (
                <div className="w-4" />
              )}
            </div>
          </div>

          {/* Icon */}
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center mr-4 shadow-sm border border-opacity-10
            ${isLocation
              ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-600 dark:from-emerald-900/30 dark:to-emerald-900/10 dark:border-emerald-800 dark:text-emerald-400'
              : 'bg-gradient-to-br from-indigo-50 to-blue-100 border-blue-200 text-blue-600 dark:from-blue-900/30 dark:to-blue-900/10 dark:border-blue-800 dark:text-blue-400'
            }
          `}>
            {isLocation ? <MapPin className="w-5 h-5" /> : <Building className="w-5 h-5" />}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Level Badge - Show hierarchy level */}
              {level > 0 && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700">
                  L{level + 1}
                </Badge>
              )}
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm sm:text-base">
                {org.entityName}
              </span>
              <Badge variant={org.isActive !== false ? "outline" : "destructive"} className="text-[10px] px-1.5 py-0 h-5">
                {org.isActive !== false ? 'Active' : 'Inactive'}
              </Badge>
              {isLocation && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">
                  {(org as Location).locationType || 'Location'}
                </Badge>
              )}
              {/* Entity Level from DB - Only show if not null */}
              {(org as any).entityLevel !== null && (org as any).entityLevel !== undefined && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                  Level {(org as any).entityLevel}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {org.responsiblePersonId ? getResponsiblePersonName(org.responsiblePersonId) : 'Unassigned'}
              </span>
              {/* Always show credits - they're now always numbers (default to 0) */}
              <span className="flex items-center gap-1" title={`Available: ${typeof (org as any).availableCredits === 'string' ? parseFloat((org as any).availableCredits) || 0 : (typeof (org as any).availableCredits === 'number' ? (org as any).availableCredits : 0)}, Reserved: ${typeof (org as any).reservedCredits === 'string' ? parseFloat((org as any).reservedCredits) || 0 : (typeof (org as any).reservedCredits === 'number' ? (org as any).reservedCredits : 0)}`}>
                <CreditCard className="w-3 h-3" />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {(typeof (org as any).availableCredits === 'string'
                    ? parseFloat((org as any).availableCredits) || 0
                    : (typeof (org as any).availableCredits === 'number' ? (org as any).availableCredits : 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <span className="text-slate-500 dark:text-slate-400">Credits</span>
              </span>
            </div>
          </div>

          {/* Actions - Visible on Hover or Mobile */}
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {!isLocation && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500 hover:text-blue-600"
                  onClick={() =>
                    navigate({
                      to: '/dashboard/organization/create',
                      search: { parentId: (org as Organization).entityId, parentName: (org as Organization).entityName, entityType: 'organization' as any },
                    })
                  }
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500 hover:text-emerald-600"
                  onClick={() =>
                    navigate({
                      to: '/dashboard/organization/create',
                      search: { parentId: (org as Organization).entityId, parentName: (org as Organization).entityName, entityType: 'location' as any },
                    })
                  }
                >
                  <MapPin className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-amber-600" onClick={() => { setSelectedOrg(org as Organization); setShowCreditTransfer(true); }} disabled={!canTransferCredits(org as Organization)}>
                  <ArrowRightLeft className="w-4 h-4" />
                </Button>
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => {
                  if (!isLocation) {
                    setSelectedOrg(org as Organization);
                    setEditForm({ name: org.entityName, description: (org as Organization).description || '', isActive: org.isActive !== false });
                    setShowEdit(true);
                  }
                }}>
                  <Edit className="w-4 h-4 mr-2" /> Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setEditingEntity(org as Entity); setShowEditResponsiblePerson(true); }}>
                  <UserCog className="w-4 h-4 mr-2" /> Assign Manager
                </DropdownMenuItem>
                {!isLocation && (
                  <DropdownMenuItem onClick={() => {
                    setSelectedEntity(org as Entity);
                    setAllocationForm({ targetApplication: '', creditAmount: 0, allocationPurpose: '', autoReplenish: false });
                    setShowAllocationDialog(true);
                  }}>
                    <CreditCard className="w-4 h-4 mr-2" /> Allocate Credits to App
                  </DropdownMenuItem>
                )}
                {isAdmin && !isLocation && (org.parentEntityId != null && org.parentEntityId !== '') && (
                  <DropdownMenuItem 
                    className="text-red-600 focus:text-red-600" 
                    onClick={() => deleteOrganization(org.entityId, org.entityName)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <ZopkitRoundLoader size="xs" className="mr-2" /> Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete Entity
                      </>
                    )}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Children (Recursive) */}
        {expanded && hasChildren && (
          <div className="space-y-1 relative pb-2 mt-1 ml-6 pl-4 border-l-2 border-slate-200 dark:border-slate-800">
            {orgChildren.map((child: any) => (
              <TreeNode key={child.entityId} org={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // --- Render ---

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header Stats & Tools */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">

        <div className="flex items-center gap-3 w-full xl:w-auto">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Hierarchy</h2>
            <div className="text-xs text-slate-500 flex gap-2">
              <span>{hierarchy?.totalOrganizations || 0} Organizations</span>
              <span>•</span>
              <span>{locations.length} Locations</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search entities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="flex gap-2">
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="h-9 w-[130px] bg-slate-50 dark:bg-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="h-9">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>

            <PearlButton
              variant="secondary"
              size="sm"
              className="h-9"
              onClick={() => setShowHierarchyChart(true)}
              data-tour-feature="visual-map"
            >
              <List className="w-3.5 h-3.5 mr-2" />
              Visual Map
            </PearlButton>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left: Tree */}
        <div className="lg:col-span-3 space-y-4">
          {!parentOrg && !loading && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>No root organization found. Please contact an admin to initialize the tenant.</AlertDescription>
            </Alert>
          )}

          {loading && !hierarchy ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <ZopkitRoundLoader size="xl" className="mb-4" />
              <p>Loading structure...</p>
            </div>
          ) : processedHierarchy.length > 0 ? (
            <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-2">
              {processedHierarchy.map((org, index) => (
                <div key={org.entityId} className={index > 0 ? 'mt-2' : ''}>
                  <TreeNode org={org} level={0} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <TreePine className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-slate-900 dark:text-white font-medium">No results found</h3>
              <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or search terms.</p>
            </div>
          )}
        </div>

        {/* Right: Quick Actions / Unassigned */}
        <div className="space-y-6">
          {parentOrg && (
            <Card className="border-blue-100 dark:border-blue-900 bg-gradient-to-br from-white to-blue-50 dark:from-slate-900 dark:to-blue-950/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-blue-900 dark:text-blue-100">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full justify-start bg-blue-600 hover:bg-blue-700"
                  onClick={() =>
                    navigate({
                      to: '/dashboard/organization/create',
                      search: { parentId: parentOrg.entityId, parentName: parentOrg.entityName, entityType: 'organization' as any },
                    })
                  }
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Sub Organization
                </Button>
                <Button
                  className="w-full justify-start bg-blue-600 hover:bg-blue-700"
                  onClick={() =>
                    navigate({
                      to: '/dashboard/organization/create',
                      search: { parentId: parentOrg.entityId, parentName: parentOrg.entityName, entityType: 'location' as any },
                    })
                  }
                >
                  <MapPin className="w-4 h-4 mr-2" /> Add Location
                </Button>
              </CardContent>
            </Card>
          )}

          {unassignedLocations.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Unassigned Locations ({unassignedLocations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                  {unassignedLocations.map(loc => (
                    <div key={loc.entityId} className="flex items-start gap-3 p-2 bg-white dark:bg-slate-900 rounded border border-amber-100 dark:border-amber-900/50">
                      <div className="w-8 h-8 rounded bg-amber-100 dark:bg-amber-900 text-amber-600 flex items-center justify-center shrink-0 text-xs font-bold">
                        LOC
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-xs truncate">{loc.entityName}</div>
                        <div className="text-[10px] text-slate-500 truncate">{loc.address?.city || 'No City'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* --- Dialogs --- */}

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Organization</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })} className="rounded border-gray-300 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0" />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <PearlButton variant="outline" onClick={() => setShowEdit(false)} disabled={isUpdating}>
              Cancel
            </PearlButton>
            <PearlButton onClick={updateOrganization} disabled={!editForm.name.trim() || isUpdating}>
              {isUpdating ? (
                <>
                  <ZopkitRoundLoader size="xs" className="mr-2" />
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </PearlButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Entity Dialog (Unified) */}
      <Dialog open={showCreateSub} onOpenChange={(open) => { setShowCreateSub(open); if (!open) setCreateFormStep(0); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Entity</DialogTitle>
            <DialogDescription>
              {selectedOrg ? <>Adding under: <span className="font-semibold text-blue-600">{selectedOrg.entityName}</span></> : 'Create a top-level entity'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-1 py-2">
            {currentCreateSteps.map((step, i) => (
              <React.Fragment key={step}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${i === createFormStep ? 'bg-blue-600 text-white' : i < createFormStep ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{i < createFormStep ? '✓' : i + 1}</div>
                  <span className={`text-xs hidden sm:block ${i === createFormStep ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>{step}</span>
                </div>
                {i < currentCreateSteps.length - 1 && <div className={`flex-1 h-px ${i < createFormStep ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </React.Fragment>
            ))}
          </div>

          <div className="grid gap-4 py-2 min-h-[240px]">
            {createFormStep === 0 && (
              <>
                <div className="grid gap-2">
                  <Label>Entity Type</Label>
                  <Select
                    value={createForm.entityType}
                    onValueChange={(v: any) => setCreateForm(prev => ({
                      ...prev,
                      entityType: v,
                      subType: v === 'location' ? 'office' : v === 'department' ? 'department' : v === 'team' ? 'team' : 'subsidiary',
                    }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organization">Organization</SelectItem>
                      <SelectItem value="department">Department</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                      <SelectItem value="location">Location</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Name <span className="text-red-500">*</span></Label>
                    <Input value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Entity Code</Label>
                    <Input value={createForm.code} onChange={e => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Legal Name <span className="text-red-500">*</span></Label>
                  <Input value={createForm.legalName} onChange={e => setCreateForm({ ...createForm, legalName: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Subtype</Label>
                    <Select value={createForm.subType} onValueChange={v => setCreateForm({ ...createForm, subType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {createForm.entityType === 'organization' && (
                          <>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="subsidiary">Subsidiary</SelectItem>
                            <SelectItem value="branch">Branch</SelectItem>
                            <SelectItem value="division">Division</SelectItem>
                          </>
                        )}
                        {createForm.entityType === 'location' && (
                          <>
                            <SelectItem value="office">Office</SelectItem>
                            <SelectItem value="warehouse">Warehouse</SelectItem>
                            <SelectItem value="retail">Retail</SelectItem>
                            <SelectItem value="branch">Branch</SelectItem>
                          </>
                        )}
                        {createForm.entityType === 'department' && <SelectItem value="department">Department</SelectItem>}
                        {createForm.entityType === 'team' && <SelectItem value="team">Team</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <Select value={createForm.status} onValueChange={v => setCreateForm({ ...createForm, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Manager (Optional)</Label>
                  <Select value={createForm.responsiblePersonId} onValueChange={v => setCreateForm({ ...createForm, responsiblePersonId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select User" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {managerUserList.map(u => <SelectItem key={u.userId} value={u.userId}>{u.name || u.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {createFormStep === 1 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Country <span className="text-red-500">*</span></Label>
                    <Select value={createForm.country} onValueChange={v => setCreateForm({ ...createForm, country: v, currency: COUNTRY_CURRENCY_MAP[v] || createForm.currency })}>
                      <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                      <SelectContent>
                        {[{ code: 'US', name: 'United States' }, { code: 'GB', name: 'United Kingdom' }, { code: 'IN', name: 'India' }, { code: 'CA', name: 'Canada' }, { code: 'AU', name: 'Australia' }, { code: 'JP', name: 'Japan' }, { code: 'CN', name: 'China' }, { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' }, { code: 'SG', name: 'Singapore' }, { code: 'CH', name: 'Switzerland' }].map(c => (
                          <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Currency <span className="text-red-500">*</span></Label>
                    <Select value={createForm.currency} onValueChange={v => setCreateForm({ ...createForm, currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'SGD'].map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Fiscal Year End</Label>
                  <Select value={createForm.fiscalYearEnd} onValueChange={v => setCreateForm({ ...createForm, fiscalYearEnd: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[{ v: '12-31', l: 'December 31 (12-31)' }, { v: '03-31', l: 'March 31 (03-31)' }, { v: '06-30', l: 'June 30 (06-30)' }, { v: '09-30', l: 'September 30 (09-30)' }].map(o => (
                        <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {createFormStep === 2 && (
              <>
                <div className="grid gap-2">
                  <Label>Tax ID</Label>
                  <Input value={createForm.taxId} onChange={e => setCreateForm({ ...createForm, taxId: e.target.value })} placeholder="Enter tax ID (optional)" />
                </div>
                <div className="grid gap-2">
                  <Label>Registration Number</Label>
                  <Input value={createForm.registrationNumber} onChange={e => setCreateForm({ ...createForm, registrationNumber: e.target.value })} placeholder="Enter registration number (optional)" />
                </div>
              </>
            )}

            {createFormStep === 3 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} placeholder="contact@example.com" type="email" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Phone</Label>
                    <Input value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="+1 555 000 0000" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Website</Label>
                  <Input value={createForm.website} onChange={e => setCreateForm({ ...createForm, website: e.target.value })} placeholder="https://example.com" />
                </div>
                <div className="grid gap-2">
                  <Label>Description / Notes</Label>
                  <Textarea value={createForm.description || createForm.notes} onChange={e => setCreateForm({ ...createForm, description: e.target.value, notes: e.target.value })} rows={3} />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <PearlButton variant="outline" onClick={() => { setShowCreateSub(false); setCreateFormStep(0); }} disabled={isCreatingEntity}>Cancel</PearlButton>
            {createFormStep > 0 && <PearlButton variant="outline" onClick={() => setCreateFormStep(s => s - 1)} disabled={isCreatingEntity}>Back</PearlButton>}
            {createFormStep < currentCreateSteps.length - 1 ? (
              <PearlButton onClick={handleCreateNext}>Next</PearlButton>
            ) : (
              <PearlButton onClick={createEntity} disabled={isCreatingEntity}>
                {isCreatingEntity ? <><ZopkitRoundLoader size="xs" className="mr-2" />Creating...</> : 'Create Entity'}
              </PearlButton>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Transfer Dialog */}
      <Dialog open={showCreditTransfer} onOpenChange={setShowCreditTransfer}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Transfer Credits
            </DialogTitle>
            <DialogDescription>
              Transfer credits from {selectedOrg?.entityName} to its child organizations or locations.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Source display */}
            <div>
              <Label>From (Source)</Label>
              <div className="p-3 border rounded-lg bg-blue-50 border-blue-200 mt-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                    {selectedOrg?.entityName?.charAt(0)?.toUpperCase() || 'O'}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{selectedOrg?.entityName}</div>
                    <div className="text-xs text-gray-500">Organization • Level {selectedOrg?.entityLevel}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Destination type */}
            <div>
              <Label>Transfer To</Label>
              <Select
                value={creditTransferForm.destinationEntityType}
                onValueChange={(value) => setCreditTransferForm({ ...creditTransferForm, destinationEntityType: value, destinationEntityId: '' })}
              >
                <SelectTrigger className="mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                  <SelectValue placeholder="Select destination type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organization">Child Organization</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Destination entity dropdown */}
            <div>
              <Label>Select Destination</Label>
              <Select
                value={creditTransferForm.destinationEntityId}
                onValueChange={(value) => setCreditTransferForm({ ...creditTransferForm, destinationEntityId: value })}
              >
                <SelectTrigger className="mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {creditTransferForm.destinationEntityType === 'organization' ? (
                    (() => {
                      const getChildOrganizations = (org: Organization): Organization[] => {
                        let children: Organization[] = [];
                        if (org.children) {
                          children = [...org.children];
                          org.children.forEach(child => {
                            children = [...children, ...getChildOrganizations(child as Organization)];
                          });
                        }
                        return children;
                      };
                      const childOrgs = selectedOrg ? getChildOrganizations(selectedOrg as Organization) : [];
                      return childOrgs.length > 0 ? childOrgs.map(org => (
                        <SelectItem key={org.entityId} value={org.entityId}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{org.entityName}</span>
                            <span className="text-xs text-gray-500">Level {org.entityLevel}</span>
                          </div>
                        </SelectItem>
                      )) : (
                        <SelectItem value="no-orgs" disabled>
                          No child organizations available
                        </SelectItem>
                      );
                    })()
                  ) : (
                    (() => {
                      const getOrgAndChildIds = (org: Organization): string[] => {
                        let ids = [org.entityId];
                        if (org.children) {
                          org.children.forEach(child => {
                            ids = [...ids, ...getOrgAndChildIds(child as Organization)];
                          });
                        }
                        return ids;
                      };
                      const allowedOrgIds = selectedOrg ? getOrgAndChildIds(selectedOrg as Organization) : [];
                      const allowedLocations = locations.filter(loc => loc.parentEntityId && allowedOrgIds.includes(loc.parentEntityId));
                      return allowedLocations.length > 0 ? allowedLocations.map(loc => (
                        <SelectItem key={loc.entityId} value={loc.entityId}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{loc.entityName}</span>
                            <span className="text-xs text-gray-500">{loc.locationType || 'location'}</span>
                          </div>
                        </SelectItem>
                      )) : (
                        <SelectItem value="no-locations" disabled>
                          No locations available for transfer
                        </SelectItem>
                      );
                    })()
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div>
              <Label>Amount to Transfer</Label>
              <Input
                type="number"
                value={creditTransferForm.amount}
                onChange={e => setCreditTransferForm({ ...creditTransferForm, amount: e.target.value })}
                placeholder="Enter credit amount"
                min="1"
                step="1"
                className="mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <Label>Description (Optional)</Label>
              <Textarea
                value={creditTransferForm.description}
                onChange={e => setCreditTransferForm({ ...creditTransferForm, description: e.target.value })}
                placeholder="Reason for transfer..."
                className="mt-1 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <PearlButton variant="outline" onClick={() => setShowCreditTransfer(false)} disabled={isTransferringCredits}>Cancel</PearlButton>
            <PearlButton
              onClick={handleTransferCredits}
              disabled={isTransferringCredits || !creditTransferForm.destinationEntityId || !creditTransferForm.amount || creditTransferForm.destinationEntityId === 'no-orgs' || creditTransferForm.destinationEntityId === 'no-locations'}
              className="bg-green-600 hover:bg-green-700"
            >
              {isTransferringCredits ? (
                <>
                  <ZopkitRoundLoader size="xs" className="mr-2" />
                  Transferring...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Transfer Credits
                </>
              )}
            </PearlButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAllocationDialog} onOpenChange={setShowAllocationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allocate Credits to Application</DialogTitle>
            <DialogDescription>
              {selectedEntity && (
                <>Allocating from: <strong>{selectedEntity.entityName}</strong> (Available: {(selectedEntity.availableCredits || 0).toLocaleString()} credits)</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Application <span className="text-red-500">*</span></Label>
              <Select
                value={allocationForm.targetApplication}
                onValueChange={v => setAllocationForm({ ...allocationForm, targetApplication: v })}
              >
                <SelectTrigger className="min-w-0 overflow-hidden [&>span]:min-w-0 [&>span]:block [&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"><SelectValue placeholder="Select App" /></SelectTrigger>
                <SelectContent>
                  {effectiveApplications.length === 0 ? (
                    <SelectItem value="no-apps" disabled>No applications available</SelectItem>
                  ) : (
                    effectiveApplications.map((app: Application) => (
                      <SelectItem key={app.appCode} value={app.appCode}>{app.appName}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Credit Amount <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={allocationForm.creditAmount || ''}
                onChange={e => setAllocationForm({ ...allocationForm, creditAmount: parseFloat(e.target.value) || 0 })}
                placeholder="Enter credit amount"
                className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              {selectedEntity && (
                <p className="text-xs text-slate-500">
                  Available: {(selectedEntity.availableCredits || 0).toLocaleString()} credits
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Purpose (Optional)</Label>
              <Textarea
                value={allocationForm.allocationPurpose}
                onChange={e => setAllocationForm({ ...allocationForm, allocationPurpose: e.target.value })}
                placeholder="Describe the purpose of this allocation"
                rows={3}
                className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoReplenish"
                checked={allocationForm.autoReplenish}
                onChange={e => setAllocationForm({ ...allocationForm, autoReplenish: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <Label htmlFor="autoReplenish" className="text-sm font-normal cursor-pointer">
                Auto-replenish when credits run low
              </Label>
            </div>
          </div>
          <DialogFooter>
            <PearlButton variant="outline" onClick={() => setShowAllocationDialog(false)}>Cancel</PearlButton>
            <PearlButton
              onClick={handleAllocateCredits}
              disabled={allocating || !allocationForm.targetApplication || !allocationForm.creditAmount || allocationForm.creditAmount <= 0}
            >
              {allocating ? <><ZopkitRoundLoader size="xs" className="mr-2" /> Allocating...</> : 'Allocate Credits'}
            </PearlButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chart Modal */}
      {showHierarchyChart && (
        <div className="fixed inset-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm flex flex-col">
          <div className="p-4 border-b flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
            <h2 className="text-xl font-bold">Visual Hierarchy</h2>
            <Button variant="ghost" onClick={() => setShowHierarchyChart(false)}>Close</Button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden relative" style={{ minHeight: '400px' }}>
            <div className="absolute inset-0 w-full h-full">
              <OrganizationHierarchyFlow
              hierarchy={hierarchy ? { ...hierarchy, hierarchy: processedHierarchy } : null}
              loading={loading}
              onRefresh={loadData}
              isAdmin={isAdmin}
              tenantId={tenantId}
              tenantName={parentOrg?.entityName || 'Organization'}
              onNodeClick={(nodeId) => {
                const org = findOrganizationById(nodeId, processedHierarchy);
                if (org) {
                  setSelectedOrg(org);
                }
              }}
              onEditOrganization={(orgId) => {
                const org = findOrganizationById(orgId, processedHierarchy);
                if (org) {
                  setSelectedOrg(org);
                  setEditForm({ name: org.entityName, description: org.description || '', isActive: org.isActive !== false });
                  setShowEdit(true);
                }
              }}
              onDeleteOrganization={(orgId) => {
                const org = findOrganizationById(orgId, processedHierarchy);
                if (org) {
                  deleteOrganization(org.entityId, org.entityName);
                }
              }}
              onAddSubOrganization={(parentId) => {
                const org = findOrganizationById(parentId, processedHierarchy);
                if (org) {
                  navigate({
                    to: '/dashboard/organization/create',
                    search: { parentId: org.entityId, parentName: org.entityName, entityType: 'organization' as any },
                  });
                }
              }}
              onAddLocation={(parentId) => {
                const org = findOrganizationById(parentId, processedHierarchy);
                if (org) {
                  navigate({
                    to: '/dashboard/organization/create',
                    search: { parentId: org.entityId, parentName: org.entityName, entityType: 'location' as any },
                  });
                }
              }}
              onTransferCredits={(orgId) => {
                const org = findOrganizationById(orgId, processedHierarchy);
                if (org) {
                  setSelectedOrg(org);
                  setCreditTransferForm(prev => ({ ...prev, sourceEntityId: org.entityId, sourceEntityType: 'organization', destinationEntityId: '', amount: '', description: '' }));
                  setShowCreditTransfer(true);
                }
              }}
            />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// --- Main Container ---

export function OrganizationManagement({
  employees,
  applications,
  isAdmin,
  makeRequest,
  loadDashboardData,
  inviteEmployee,
  tenantId
}: OrganizationManagementProps) {

  const queryClient = useQueryClient();
  const [showEditResponsiblePerson, setShowEditResponsiblePerson] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [responsiblePersonNames, setResponsiblePersonNames] = useState<Map<string, string>>(new Map());

  if (!tenantId) return <div className="p-8 text-center text-red-500">Error: Missing Tenant ID</div>;

  const getResponsiblePersonName = (userId: string) => responsiblePersonNames.get(userId) || 'Loading...';

  const loadResponsiblePersonNames = async (entities: (Entity | Organization)[]) => {
    const userIds = new Set<string>();
    entities.forEach(e => e.responsiblePersonId && userIds.add(e.responsiblePersonId));
    if (userIds.size === 0) return;

    try {
      const promises = Array.from(userIds).map(async (uid) => {
        try {
          const res = await makeRequest(`/admin/users/${uid}`);
          return { userId: uid, name: res.data?.data?.name || res.data?.data?.email || 'Unknown' };
        } catch { return { userId: uid, name: 'Unknown' }; }
      });
      const results = await Promise.all(promises);
      const map = new Map(responsiblePersonNames);
      results.forEach(r => map.set(r.userId, r.name));
      setResponsiblePersonNames(map);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 bg-clip-text text-transparent animate-in fade-in slide-in-from-left-4 duration-700">Organization</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage structure, departments, locations, and resources.</p>
        </div>
        <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <Tabs defaultValue="hierarchy" className="w-full">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1">
          <TabsTrigger value="hierarchy" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">Hierarchy & Locations</TabsTrigger>
          {/* Add more tabs here if needed */}
        </TabsList>
        <TabsContent value="hierarchy" className="mt-6">
          <OrganizationTreeManagement
            tenantId={tenantId}
            isAdmin={isAdmin}
            makeRequest={makeRequest}
            applications={applications}
            employees={employees}
            showEditResponsiblePerson={showEditResponsiblePerson}
            setShowEditResponsiblePerson={setShowEditResponsiblePerson}
            editingEntity={editingEntity}
            setEditingEntity={setEditingEntity}
            getResponsiblePersonName={getResponsiblePersonName}
            loadResponsiblePersonNames={loadResponsiblePersonNames}
          />
        </TabsContent>
      </Tabs>

      <EditResponsiblePersonModal
        isOpen={showEditResponsiblePerson}
        onClose={() => setShowEditResponsiblePerson(false)}
        entity={editingEntity}
        onSuccess={async () => {
          queryClient.invalidateQueries({ queryKey: ['entities', 'hierarchy', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['entities', 'available'] });
          queryClient.invalidateQueries({ queryKey: ['entities', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['entityScope'] });
          loadDashboardData();
        }}
        makeRequest={makeRequest}
      />
    </div>
  );
}

export default OrganizationManagement;
