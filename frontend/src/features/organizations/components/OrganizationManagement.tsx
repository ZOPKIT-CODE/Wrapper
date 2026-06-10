import { useState, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation, useSearch } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EditResponsiblePersonModal } from './modals/EditResponsiblePersonModal'
import { Application } from '@/hooks/useDashboardData'
import { useTenantApplications } from '@/hooks/useSharedQueries'
import { Container } from '@/components/common/Page'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useOrganizationAuth } from '@/hooks/useOrganizationAuth'
import api from '@/lib/api'
import type { AxiosRequestConfig } from 'axios'
import {
  DashboardPageHeader,
  DASHBOARD_TABS_LIST_CLASS,
} from '@/components/dashboard/DashboardPageHeader'
import { RefreshCw } from 'lucide-react'
import { OrganizationTreeView } from './OrganizationTreeView'
import type { EditForm } from './OrganizationEditDialog'
import type { CreateForm } from './OrganizationCreateDialog'
import type {
  CreditTransferForm,
  AllocationForm,
} from './OrganizationCreditSheets'
import { useOrganizationHierarchyData } from '../hooks/useOrganizationHierarchyData'
import { useOrganizationCrudActions } from '../hooks/useOrganizationCrudActions'
import type { Entity } from '../types'

// --- Types ---

interface Organization {
  entityId: string
  entityName: string
  entityType: 'organization' | 'location' | 'department' | 'team'
  entityLevel: number
  hierarchyPath: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  parentEntityId?: string
  responsiblePersonId?: string
  children?: Organization[]
  availableCredits?: number
  reservedCredits?: number
  totalCredits?: number
}

interface Employee {
  userId: string
  email: string
  name: string
  isActive: boolean
  isTenantAdmin: boolean
  onboardingCompleted: boolean
  department?: string
  title?: string
}

// Loosely-shaped person record accepted when building the manager dropdown —
// sources may key the id as either `userId` or `id`.
interface PersonSource {
  userId?: string
  id?: string
  name?: string
  email?: string
}

interface OrganizationManagementProps {
  employees: Employee[]
  applications: Application[]
  isAdmin: boolean
  // Result is forwarded to several consumers with incompatible expected return
  // types (HierarchyApiResponse vs raw axios .data); `any` keeps it assignable to all.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  makeRequest: (endpoint: string, options?: RequestInit) => Promise<any>
  loadDashboardData: () => void
  inviteEmployee: () => void
  tenantId?: string
}

// --- OrganizationPage wrapper ---

export function OrganizationPage({ isAdmin = false }: { isAdmin?: boolean }) {
  const { tenantId } = useOrganizationAuth()
  const {
    users: employees,
    applications,
    refreshDashboard,
  } = useDashboardData()

  const makeRequest = async (endpoint: string, options?: RequestInit) => {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const headers: Record<string, string> = { 'X-Application': 'crm' }
    if (options?.headers) {
      const h: HeadersInit = options.headers
      if (typeof Headers !== 'undefined' && h instanceof Headers) {
        h.forEach((v: string, k: string) => {
          headers[k] = String(v)
        })
      } else if (Array.isArray(h)) {
        h.forEach(([k, v]: [string, string]) => {
          headers[k] = String(v)
        })
      } else {
        Object.assign(headers, h as Record<string, string>)
      }
    }
    const axiosConfig: AxiosRequestConfig = {
      method: options?.method,
      headers,
      withCredentials: true,
    }
    if (options?.body) {
      try {
        axiosConfig.data =
          typeof options.body === 'string'
            ? JSON.parse(options.body)
            : options.body
      } catch {
        axiosConfig.data = options.body
      }
    }
    const response = await api(path, axiosConfig)
    return response.data
  }

  return (
    <Container className="mx-auto max-w-7xl py-6">
      <OrganizationManagement
        employees={employees || []}
        isAdmin={isAdmin || false}
        tenantId={tenantId}
        applications={applications || []}
        makeRequest={makeRequest}
        loadDashboardData={refreshDashboard}
        inviteEmployee={() => {}}
      />
    </Container>
  )
}

// --- Organization Tree Component (logic only) ---

export function OrganizationTreeManagement({
  tenantId,
  isAdmin,
  makeRequest,
  applications,
  employees = [],
  showEditResponsiblePerson: _showEditResponsiblePerson,
  setShowEditResponsiblePerson,
  editingEntity: _editingEntity,
  setEditingEntity,
  getResponsiblePersonName,
  loadResponsiblePersonNames: _loadResponsiblePersonNames,
}: {
  tenantId: string
  isAdmin: boolean
  // Forwarded to multiple consumers with incompatible expected return types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  makeRequest: (endpoint: string, options?: RequestInit) => Promise<any>
  applications: Application[]
  employees?: Employee[]
  showEditResponsiblePerson: boolean
  setShowEditResponsiblePerson: (show: boolean) => void
  editingEntity: Entity | null
  setEditingEntity: (entity: Entity | null) => void
  getResponsiblePersonName: (userId: string) => string
  loadResponsiblePersonNames: (
    entities: (Entity | Organization)[]
  ) => Promise<void>
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const urlSearch = useSearch({ strict: false }) as Record<
    string,
    string | undefined
  >
  const showHierarchyChart = urlSearch.view === 'map'

  const openHierarchyMap = useCallback(() => {
    navigate({
      to: location.pathname,
      search: (prev: Record<string, unknown>) => ({
        ...(prev ?? {}),
        view: 'map',
      }),
      replace: true,
    })
  }, [navigate, location.pathname])

  const closeHierarchyMap = useCallback(() => {
    navigate({
      to: location.pathname,
      search: (prev: Record<string, unknown>) => {
        const p = { ...(prev ?? {}) }
        delete p.view
        return p
      },
      replace: true,
    })
  }, [navigate, location.pathname])

  const { data: cachedApplications = [] } = useTenantApplications(tenantId)
  const effectiveApplications = useMemo(() => {
    const apps = (
      applications?.length ? applications : cachedApplications
    ) as Application[]
    return apps.filter(
      (app, idx, self) =>
        app &&
        app.appCode &&
        idx === self.findIndex((a) => a.appCode === app.appCode)
    )
  }, [applications, cachedApplications])

  const { hierarchy, parentOrg, locations, loading, loadData } =
    useOrganizationHierarchyData(tenantId, makeRequest)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'active' | 'inactive'>(
    'all'
  )
  const [selectedItems] = useState<string[]>([])
  const [showCreateSub, setShowCreateSub] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showCreditTransfer, setShowCreditTransfer] = useState(false)
  const [showAllocationDialog, setShowAllocationDialog] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [createFormStep, setCreateFormStep] = useState(0)
  const [managerUsers] = useState<PersonSource[]>([])
  const [createForm, setCreateForm] = useState<CreateForm>({
    entityType: 'organization',
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
  })
  const [editForm, setEditForm] = useState<EditForm>({
    name: '',
    description: '',
    isActive: true,
  })
  const [creditTransferForm, setCreditTransferForm] =
    useState<CreditTransferForm>({
      sourceEntityType: 'organization',
      sourceEntityId: '',
      destinationEntityType: 'organization',
      destinationEntityId: '',
      amount: '',
      transferType: 'direct',
      isTemporary: false,
      recallDeadline: '',
      description: '',
    })
  const [allocationForm, setAllocationForm] = useState<AllocationForm>({
    targetApplication: '',
    creditAmount: 0,
    allocationPurpose: '',
    autoReplenish: false,
  })

  const managerUserList = useMemo(() => {
    const fromApi = (managerUsers || []).map((u: PersonSource) => ({
      userId: u.userId || u.id || '',
      name: u.name ?? u.email ?? '',
      email: u.email ?? '',
    }))
    if (fromApi.length > 0) return fromApi
    return (employees || []).map((e: PersonSource) => ({
      userId: e.userId || e.id || '',
      name: e.name ?? e.email ?? '',
      email: e.email ?? '',
    }))
  }, [managerUsers, employees])

  const processedHierarchy = useMemo(() => {
    if (!hierarchy?.hierarchy) return []
    const filterRecursive = (
      org: Organization,
      currentLevel: number = 0
    ): Organization | null => {
      if (!org || !org.entityName) return null
      const searchLower = searchTerm.toLowerCase().trim()
      const matchesSearch =
        !searchTerm || org.entityName.toLowerCase().includes(searchLower)
      const isOrgActive = org.isActive !== false
      const matchesFilter =
        filterType === 'all' ||
        (filterType === 'active' && isOrgActive) ||
        (filterType === 'inactive' && !isOrgActive)
      const filteredChildren = (org.children?.length ? org.children : [])
        .map((child) => filterRecursive(child, currentLevel + 1))
        .filter((c): c is Organization => c !== null)
      if ((matchesSearch && matchesFilter) || filteredChildren.length > 0) {
        // Credit fields may arrive as strings from the API despite the typed shape.
        const rawCredits = org as {
          availableCredits?: string | number
          reservedCredits?: string | number
          totalCredits?: string | number
        }
        const av =
          typeof rawCredits.availableCredits === 'number'
            ? rawCredits.availableCredits
            : parseFloat(String(rawCredits.availableCredits)) || 0
        const rv =
          typeof rawCredits.reservedCredits === 'number'
            ? rawCredits.reservedCredits
            : parseFloat(String(rawCredits.reservedCredits)) || 0
        return {
          ...org,
          children: filteredChildren,
          entityLevel: org.entityLevel ?? currentLevel,
          availableCredits: av,
          reservedCredits: rv,
          totalCredits:
            typeof rawCredits.totalCredits === 'number'
              ? rawCredits.totalCredits
              : av + rv,
        }
      }
      return null
    }
    const seenIds = new Set<string>()
    return hierarchy.hierarchy
      .map((org) => filterRecursive(org, 0))
      .filter(Boolean)
      .filter((org) => {
        if (seenIds.has(org!.entityId)) return false
        seenIds.add(org!.entityId)
        return true
      }) as Organization[]
  }, [hierarchy, searchTerm, filterType])

  const unassignedLocations = useMemo(() => {
    const seenIds = new Set<string>()
    return locations.filter((l) => {
      if (!l.parentEntityId && l.entityId && !seenIds.has(l.entityId)) {
        seenIds.add(l.entityId)
        return true
      }
      return false
    })
  }, [locations])

  const findOrganizationById = (
    id: string,
    orgs: Organization[]
  ): Organization | null => {
    for (const org of orgs) {
      if (org.entityId === id) return org
      if (org.children?.length) {
        const found = findOrganizationById(id, org.children)
        if (found) return found
      }
    }
    return null
  }

  const {
    isCreatingEntity,
    isUpdating,
    isDeleting,
    isTransferringCredits,
    allocating,
    handleCreateNext,
    createEntity,
    updateOrganization,
    deleteOrganization,
    handleAllocateCredits,
    handleTransferCredits,
  } = useOrganizationCrudActions(
    tenantId,
    makeRequest,
    processedHierarchy,
    loadData
  )

  return (
    <OrganizationTreeView
      hierarchy={hierarchy}
      processedHierarchy={processedHierarchy}
      parentOrg={parentOrg}
      locations={locations}
      unassignedLocations={unassignedLocations}
      loading={loading}
      effectiveApplications={effectiveApplications}
      managerUserList={managerUserList}
      getResponsiblePersonName={getResponsiblePersonName}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      filterType={filterType}
      setFilterType={setFilterType}
      selectedItems={selectedItems}
      showCreateSub={showCreateSub}
      setShowCreateSub={setShowCreateSub}
      showEdit={showEdit}
      setShowEdit={setShowEdit}
      showCreditTransfer={showCreditTransfer}
      setShowCreditTransfer={setShowCreditTransfer}
      showAllocationDialog={showAllocationDialog}
      setShowAllocationDialog={setShowAllocationDialog}
      showHierarchyChart={showHierarchyChart}
      selectedOrg={selectedOrg}
      setSelectedOrg={setSelectedOrg}
      selectedEntity={selectedEntity}
      setSelectedEntity={setSelectedEntity}
      createForm={createForm}
      setCreateForm={setCreateForm}
      createFormStep={createFormStep}
      setCreateFormStep={setCreateFormStep}
      editForm={editForm}
      setEditForm={setEditForm}
      creditTransferForm={creditTransferForm}
      setCreditTransferForm={setCreditTransferForm}
      allocationForm={allocationForm}
      setAllocationForm={setAllocationForm}
      isAdmin={isAdmin}
      isDeleting={isDeleting}
      isCreatingEntity={isCreatingEntity}
      isUpdating={isUpdating}
      isTransferringCredits={isTransferringCredits}
      allocating={allocating}
      loadData={loadData}
      openHierarchyMap={openHierarchyMap}
      closeHierarchyMap={closeHierarchyMap}
      deleteOrganization={deleteOrganization}
      updateOrganization={updateOrganization}
      createEntity={createEntity}
      handleCreateNext={handleCreateNext}
      handleTransferCredits={handleTransferCredits}
      handleAllocateCredits={handleAllocateCredits}
      setEditingEntity={setEditingEntity}
      setShowEditResponsiblePerson={setShowEditResponsiblePerson}
      findOrganizationById={findOrganizationById}
      tenantId={tenantId}
    />
  )
}

// --- Main Container ---

export function OrganizationManagement({
  employees,
  applications,
  isAdmin,
  makeRequest,
  loadDashboardData,
  inviteEmployee: _inviteEmployee,
  tenantId,
}: OrganizationManagementProps) {
  const queryClient = useQueryClient()
  const [showEditResponsiblePerson, setShowEditResponsiblePerson] =
    useState(false)
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null)
  const [responsiblePersonNames, setResponsiblePersonNames] = useState<
    Map<string, string>
  >(new Map())

  if (!tenantId)
    return (
      <div className="p-8 text-center text-red-500">
        Error: Missing Tenant ID
      </div>
    )

  const getResponsiblePersonName = (userId: string) =>
    responsiblePersonNames.get(userId) || 'Loading...'

  const loadResponsiblePersonNames = async (
    entities: (Entity | Organization)[]
  ) => {
    const userIds = new Set<string>()
    entities.forEach(
      (e) => e.responsiblePersonId && userIds.add(e.responsiblePersonId)
    )
    if (userIds.size === 0) return
    try {
      const results = await Promise.all(
        Array.from(userIds).map(async (uid) => {
          try {
            const res = await makeRequest(`/admin/users/${uid}`)
            return {
              userId: uid,
              name: res.data?.data?.name || res.data?.data?.email || 'Unknown',
            }
          } catch {
            return { userId: uid, name: 'Unknown' }
          }
        })
      )
      const map = new Map(responsiblePersonNames)
      results.forEach((r) => map.set(r.userId, r.name))
      setResponsiblePersonNames(map)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title="Organization"
        description="Manage structure, departments, locations, and resources."
        actions={
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />
      <Tabs defaultValue="hierarchy" className="w-full">
        <TabsList className={DASHBOARD_TABS_LIST_CLASS}>
          <TabsTrigger
            value="hierarchy"
            className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700"
          >
            Hierarchy & Locations
          </TabsTrigger>
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
        employees={employees ?? []}
        onSuccess={async () => {
          queryClient.invalidateQueries({
            queryKey: ['entities', 'hierarchy', tenantId],
          })
          queryClient.invalidateQueries({ queryKey: ['entities', 'available'] })
          queryClient.invalidateQueries({ queryKey: ['entities', tenantId] })
          queryClient.invalidateQueries({ queryKey: ['entityScope'] })
          loadDashboardData()
        }}
        makeRequest={makeRequest}
      />
    </div>
  )
}

export default OrganizationManagement
