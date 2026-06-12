import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PearlButton } from '@/components/ui/pearl-button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Application } from '@/hooks/useDashboardData'
import {
  Network,
  MapPin,
  Plus,
  AlertTriangle,
  Search,
  RefreshCw,
  TreePine,
  List,
} from 'lucide-react'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'
import { TreeNode } from './OrganizationTreeNode'
import { OrganizationEditDialog } from './OrganizationEditDialog'
import type { EditForm } from './OrganizationEditDialog'
import { OrganizationCreateDialog } from './OrganizationCreateDialog'
import type { CreateForm } from './OrganizationCreateDialog'
import {
  CreditTransferSheet,
  AllocateCreditSheet,
  HierarchyChartModal,
} from './OrganizationCreditSheets'
import type {
  CreditTransferForm,
  AllocationForm,
} from './OrganizationCreditSheets'
import type { Entity } from '@/features/organizations/types'

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

interface Location {
  entityId: string
  entityName: string
  entityType: 'location'
  entityLevel: number
  hierarchyPath: string
  parentEntityId?: string
  locationType?: string
  availableCredits?: number
  address?: unknown
}

interface OrganizationHierarchy {
  success: boolean
  hierarchy: Organization[]
  totalOrganizations: number
  message: string
}

export interface OrganizationTreeViewProps {
  // Data
  hierarchy: OrganizationHierarchy | null
  processedHierarchy: Organization[]
  parentOrg: Organization | null
  locations: Location[]
  unassignedLocations: Location[]
  loading: boolean
  effectiveApplications: Application[]
  managerUserList: { userId: string; name: string; email: string }[]
  getResponsiblePersonName: (userId: string) => string
  // Search/filter state
  searchTerm: string
  setSearchTerm: (v: string) => void
  filterType: 'all' | 'active' | 'inactive'
  setFilterType: (v: 'all' | 'active' | 'inactive') => void
  selectedItems: string[]
  // Dialog open state
  showCreateSub: boolean
  setShowCreateSub: (v: boolean) => void
  showEdit: boolean
  setShowEdit: (v: boolean) => void
  showCreditTransfer: boolean
  setShowCreditTransfer: (v: boolean) => void
  showAllocationDialog: boolean
  setShowAllocationDialog: (v: boolean) => void
  showHierarchyChart: boolean
  // Selected entities
  selectedOrg: Organization | null
  setSelectedOrg: (o: Organization | null) => void
  selectedEntity: Entity | null
  setSelectedEntity: React.Dispatch<React.SetStateAction<Entity | null>>
  // Forms
  createForm: CreateForm
  setCreateForm: (f: CreateForm) => void
  createFormStep: number
  setCreateFormStep: (s: number | ((p: number) => number)) => void
  editForm: EditForm
  setEditForm: (f: EditForm) => void
  creditTransferForm: CreditTransferForm
  setCreditTransferForm: (
    f: CreditTransferForm | ((prev: CreditTransferForm) => CreditTransferForm)
  ) => void
  allocationForm: AllocationForm
  setAllocationForm: (f: AllocationForm) => void
  // Actions
  isAdmin: boolean
  isDeleting: boolean
  isCreatingEntity: boolean
  isUpdating: boolean
  isTransferringCredits: boolean
  allocating: boolean
  loadData: () => Promise<void>
  openHierarchyMap: () => void
  closeHierarchyMap: () => void
  deleteOrganization: (id: string, name?: string) => void
  updateOrganization: (
    org: Organization,
    form: EditForm,
    onSuccess: () => void
  ) => void
  createEntity: (
    form: CreateForm,
    step: number,
    setStep: (s: number) => void,
    parentOrg: Organization | null,
    onSuccess: () => void
  ) => void
  handleCreateNext: (
    step: number,
    setStep: (s: number | ((p: number) => number)) => void,
    form: CreateForm
  ) => void
  handleTransferCredits: (
    org: Organization,
    form: CreditTransferForm,
    onSuccess: () => void
  ) => void
  handleAllocateCredits: (
    entity: Entity,
    form: AllocationForm,
    onSuccess: () => void
  ) => void
  setEditingEntity: (e: Entity | null) => void
  setShowEditResponsiblePerson: (v: boolean) => void
  findOrganizationById: (
    id: string,
    orgs: Organization[]
  ) => Organization | null
  tenantId: string
}

export function OrganizationTreeView({
  hierarchy,
  processedHierarchy,
  parentOrg,
  locations,
  unassignedLocations,
  loading,
  effectiveApplications,
  managerUserList,
  getResponsiblePersonName,
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  selectedItems,
  showCreateSub,
  setShowCreateSub,
  showEdit,
  setShowEdit,
  showCreditTransfer,
  setShowCreditTransfer,
  showAllocationDialog,
  setShowAllocationDialog,
  showHierarchyChart,
  selectedOrg,
  setSelectedOrg,
  selectedEntity,
  setSelectedEntity,
  createForm,
  setCreateForm,
  createFormStep,
  setCreateFormStep,
  editForm,
  setEditForm,
  creditTransferForm,
  setCreditTransferForm,
  allocationForm,
  setAllocationForm,
  isAdmin,
  isDeleting,
  isCreatingEntity,
  isUpdating,
  isTransferringCredits,
  allocating,
  loadData,
  openHierarchyMap,
  closeHierarchyMap,
  deleteOrganization,
  updateOrganization,
  createEntity,
  handleCreateNext,
  handleTransferCredits,
  handleAllocateCredits,
  setEditingEntity,
  setShowEditResponsiblePerson,
  findOrganizationById,
  tenantId,
}: OrganizationTreeViewProps) {
  const navigate = useNavigate()

  const EMPTY_TRANSFER_FORM: CreditTransferForm = {
    sourceEntityType: 'organization',
    sourceEntityId: '',
    destinationEntityType: 'organization',
    destinationEntityId: '',
    amount: '',
    transferType: 'direct',
    isTemporary: false,
    recallDeadline: '',
    description: '',
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div
        className="flex flex-col items-start justify-between gap-4 rounded-xl p-4 shadow-sm xl:flex-row xl:items-center dark:border-slate-800 dark:bg-slate-900"
        style={{
          backgroundColor: 'var(--zk-paper)',
          border: '1px solid var(--zk-line)',
        }}
      >
        <div className="flex w-full items-center gap-3 xl:w-auto">
          <div
            className="rounded-lg p-2"
            style={{
              backgroundColor:
                'color-mix(in srgb, var(--zk-navy) 10%, transparent)',
              color: 'var(--zk-navy)',
            }}
          >
            <Network className="h-6 w-6" />
          </div>
          <div>
            <h2
              className="text-lg"
              style={{
                fontFamily: 'var(--zk-display)',
                fontWeight: 600,
                letterSpacing: '-0.025em',
                color: 'var(--zk-ink)',
              }}
            >
              Hierarchy
            </h2>
            <div
              className="flex gap-2"
              style={{
                fontFamily: 'var(--zk-mono)',
                fontSize: 11,
                color: 'var(--zk-muted-2)',
              }}
            >
              <span>{hierarchy?.totalOrganizations || 0} Organizations</span>
              <span>•</span>
              <span>{locations.length} Locations</span>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search entities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 border-slate-200 bg-slate-50 pl-9 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={filterType}
              onValueChange={(v: string) =>
                setFilterType(v as 'all' | 'active' | 'inactive')
              }
            >
              <SelectTrigger className="h-9 w-[130px] bg-slate-50 dark:bg-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="h-9"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
            </Button>
            <PearlButton
              variant="secondary"
              size="sm"
              className="h-9"
              onClick={openHierarchyMap}
            >
              <List className="mr-2 h-3.5 w-3.5" />
              Visual Map
            </PearlButton>
          </div>
        </div>
      </div>

      {/* Tree + Actions Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="space-y-4 lg:col-span-3">
          {!parentOrg && !loading && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No root organization found. Please contact an admin to
                initialize the tenant.
              </AlertDescription>
            </Alert>
          )}
          {loading && !hierarchy ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <ZopkitRoundLoader size="xl" className="mb-4" />
              <p>Loading structure...</p>
            </div>
          ) : processedHierarchy.length > 0 ? (
            <div className="space-y-2 rounded-2xl bg-white/50 p-4 dark:bg-slate-900/50">
              {processedHierarchy.map((org, index) => (
                <div key={org.entityId} className={index > 0 ? 'mt-2' : ''}>
                  <TreeNode
                    org={org}
                    level={0}
                    isAdmin={isAdmin}
                    isDeleting={isDeleting}
                    selectedItems={selectedItems}
                    getResponsiblePersonName={getResponsiblePersonName}
                    onEdit={(o) => {
                      setSelectedOrg(o)
                      setEditForm({
                        name: o.entityName,
                        description: o.description || '',
                        isActive: o.isActive !== false,
                      })
                      setShowEdit(true)
                    }}
                    onAssignManager={(entity) => {
                      setEditingEntity(entity)
                      setShowEditResponsiblePerson(true)
                    }}
                    onAllocateCredits={(entity) => {
                      setSelectedEntity(entity)
                      setAllocationForm({
                        targetApplication: '',
                        creditAmount: 0,
                        allocationPurpose: '',
                        autoReplenish: false,
                      })
                      setShowAllocationDialog(true)
                    }}
                    onTransferCredits={(o) => {
                      setSelectedOrg(o)
                      setShowCreditTransfer(true)
                    }}
                    onDelete={deleteOrganization}
                    setEditingEntity={setEditingEntity}
                    setShowEditResponsiblePerson={setShowEditResponsiblePerson}
                    setSelectedEntity={setSelectedEntity}
                    setAllocationForm={setAllocationForm}
                    setShowAllocationDialog={setShowAllocationDialog}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <TreePine className="mx-auto mb-3 h-12 w-12 text-slate-300" />
              <h3
                style={{
                  fontFamily: 'var(--zk-display)',
                  fontWeight: 600,
                  letterSpacing: '-0.025em',
                  color: 'var(--zk-ink)',
                }}
              >
                No results found
              </h3>
              <p
                className="mt-1 text-sm"
                style={{
                  fontFamily: 'var(--zk-font)',
                  color: 'var(--zk-muted)',
                }}
              >
                Try adjusting your filters or search terms.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {parentOrg && (
            <Card
              className="shadow-sm dark:border-blue-900/20"
              style={{
                borderColor: 'var(--zk-line)',
                backgroundColor: 'var(--zk-paper)',
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle
                  className="text-base"
                  style={{
                    fontFamily: 'var(--zk-display)',
                    fontWeight: 600,
                    letterSpacing: '-0.025em',
                    color: 'var(--zk-ink)',
                  }}
                >
                  Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full justify-start"
                  style={
                    { backgroundColor: 'var(--zk-navy)' } as React.CSSProperties
                  }
                  onClick={() =>
                    navigate({
                      to: '/dashboard/organization/create',
                      search: {
                        parentId: parentOrg.entityId,
                        parentName: parentOrg.entityName,
                        entityType: 'organization',
                      },
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Sub Organization
                </Button>
                <Button
                  className="w-full justify-start"
                  style={
                    { backgroundColor: 'var(--zk-navy)' } as React.CSSProperties
                  }
                  onClick={() =>
                    navigate({
                      to: '/dashboard/organization/create',
                      search: {
                        parentId: parentOrg.entityId,
                        parentName: parentOrg.entityName,
                        entityType: 'location',
                      },
                    })
                  }
                >
                  <MapPin className="mr-2 h-4 w-4" /> Add Location
                </Button>
              </CardContent>
            </Card>
          )}
          {unassignedLocations.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                  Unassigned Locations ({unassignedLocations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="custom-scrollbar max-h-[300px] space-y-2 overflow-y-auto pr-1">
                  {unassignedLocations.map((loc) => (
                    <div
                      key={loc.entityId}
                      className="flex items-start gap-3 rounded border border-amber-100 bg-white p-2 dark:border-amber-900/50 dark:bg-slate-900"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-amber-100 text-xs font-bold text-amber-600 dark:bg-amber-900">
                        LOC
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">
                          {loc.entityName}
                        </div>
                        <div className="truncate text-[10px] text-slate-500">
                          {(loc.address as { city?: string } | undefined)
                            ?.city || 'No City'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogs & Sheets */}
      <OrganizationEditDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        editForm={editForm}
        setEditForm={setEditForm}
        onSave={() =>
          selectedOrg &&
          updateOrganization(selectedOrg, editForm, () => setShowEdit(false))
        }
        isUpdating={isUpdating}
      />

      <OrganizationCreateDialog
        open={showCreateSub}
        onOpenChange={setShowCreateSub}
        createForm={createForm}
        setCreateForm={setCreateForm}
        createFormStep={createFormStep}
        setCreateFormStep={setCreateFormStep}
        managerUserList={managerUserList}
        selectedOrg={selectedOrg}
        isCreatingEntity={isCreatingEntity}
        onCreateNext={() =>
          handleCreateNext(createFormStep, setCreateFormStep, createForm)
        }
        onCreateEntity={() =>
          createEntity(
            createForm,
            createFormStep,
            setCreateFormStep as (s: number) => void,
            selectedOrg,
            () => setShowCreateSub(false)
          )
        }
      />

      <CreditTransferSheet
        open={showCreditTransfer}
        onOpenChange={setShowCreditTransfer}
        selectedOrg={selectedOrg}
        locations={locations}
        creditTransferForm={creditTransferForm}
        setCreditTransferForm={setCreditTransferForm}
        onTransfer={() =>
          selectedOrg &&
          handleTransferCredits(selectedOrg, creditTransferForm, () => {
            setShowCreditTransfer(false)
            setCreditTransferForm(EMPTY_TRANSFER_FORM)
          })
        }
        isTransferringCredits={isTransferringCredits}
      />

      <AllocateCreditSheet
        open={showAllocationDialog}
        onOpenChange={setShowAllocationDialog}
        selectedEntity={selectedEntity}
        effectiveApplications={effectiveApplications}
        allocationForm={allocationForm}
        setAllocationForm={setAllocationForm}
        onAllocate={() =>
          selectedEntity &&
          handleAllocateCredits(selectedEntity, allocationForm, () =>
            setShowAllocationDialog(false)
          )
        }
        allocating={allocating}
      />

      <HierarchyChartModal
        show={showHierarchyChart}
        onClose={closeHierarchyMap}
        hierarchy={hierarchy}
        processedHierarchy={processedHierarchy}
        loading={loading}
        isAdmin={isAdmin}
        tenantId={tenantId}
        parentOrgName={parentOrg?.entityName || 'Organization'}
        onLoadData={loadData}
        onNodeClick={(nodeId) => {
          const org = findOrganizationById(nodeId, processedHierarchy)
          if (org) setSelectedOrg(org)
        }}
        onEditOrganization={(orgId) => {
          const org = findOrganizationById(orgId, processedHierarchy)
          if (org) {
            setSelectedOrg(org)
            setEditForm({
              name: org.entityName,
              description: org.description || '',
              isActive: org.isActive !== false,
            })
            setShowEdit(true)
          }
        }}
        onDeleteOrganization={(orgId) => {
          const org = findOrganizationById(orgId, processedHierarchy)
          if (org) deleteOrganization(org.entityId, org.entityName)
        }}
        onAddSubOrganization={(parentId) => {
          const org = findOrganizationById(parentId, processedHierarchy)
          if (org)
            navigate({
              to: '/dashboard/organization/create',
              search: {
                parentId: org.entityId,
                parentName: org.entityName,
                entityType: 'organization',
              },
            })
        }}
        onAddLocation={(parentId) => {
          const org = findOrganizationById(parentId, processedHierarchy)
          if (org)
            navigate({
              to: '/dashboard/organization/create',
              search: {
                parentId: org.entityId,
                parentName: org.entityName,
                entityType: 'location',
              },
            })
        }}
        onTransferCredits={(orgId) => {
          const org = findOrganizationById(orgId, processedHierarchy)
          if (org) {
            setSelectedOrg(org)
            setCreditTransferForm((prev) => ({
              ...prev,
              sourceEntityId: org.entityId,
              sourceEntityType: 'organization',
              destinationEntityId: '',
              amount: '',
              description: '',
            }))
            setShowCreditTransfer(true)
          }
        }}
      />
    </div>
  )
}
