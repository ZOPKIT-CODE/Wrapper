import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PearlButton } from '@/components/ui/pearl-button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Application } from '@/hooks/useDashboardData'
import { Network, MapPin, Plus, AlertTriangle, Search, RefreshCw, TreePine, List } from 'lucide-react'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'
import { TreeNode } from './OrganizationTreeNode'
import { OrganizationEditDialog } from './OrganizationEditDialog'
import type { EditForm } from './OrganizationEditDialog'
import { OrganizationCreateDialog } from './OrganizationCreateDialog'
import type { CreateForm } from './OrganizationCreateDialog'
import { CreditTransferSheet, AllocateCreditSheet, HierarchyChartModal } from './OrganizationCreditSheets'
import type { CreditTransferForm, AllocationForm } from './OrganizationCreditSheets'

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

interface Entity {
  entityId: string
  entityName: string
  entityType: string
  availableCredits?: number
  [key: string]: any
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
  address?: any
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
  setSelectedEntity: (e: Entity | null) => void
  // Forms
  createForm: CreateForm
  setCreateForm: (f: CreateForm) => void
  createFormStep: number
  setCreateFormStep: (s: number | ((p: number) => number)) => void
  editForm: EditForm
  setEditForm: (f: EditForm) => void
  creditTransferForm: CreditTransferForm
  setCreditTransferForm: (f: CreditTransferForm | ((prev: CreditTransferForm) => CreditTransferForm)) => void
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
  updateOrganization: (org: Organization, form: EditForm, onSuccess: () => void) => void
  createEntity: (form: CreateForm, step: number, setStep: (s: number) => void, parentOrg: Organization | null, onSuccess: () => void) => void
  handleCreateNext: (step: number, setStep: (s: number | ((p: number) => number)) => void, form: CreateForm) => void
  handleTransferCredits: (org: Organization, form: CreditTransferForm, onSuccess: () => void) => void
  handleAllocateCredits: (entity: Entity, form: AllocationForm, onSuccess: () => void) => void
  setEditingEntity: (e: any) => void
  setShowEditResponsiblePerson: (v: boolean) => void
  findOrganizationById: (id: string, orgs: Organization[]) => Organization | null
  tenantId: string
}

export function OrganizationTreeView({
  hierarchy, processedHierarchy, parentOrg, locations, unassignedLocations, loading,
  effectiveApplications, managerUserList, getResponsiblePersonName,
  searchTerm, setSearchTerm, filterType, setFilterType, selectedItems,
  showCreateSub, setShowCreateSub, showEdit, setShowEdit,
  showCreditTransfer, setShowCreditTransfer, showAllocationDialog, setShowAllocationDialog, showHierarchyChart,
  selectedOrg, setSelectedOrg, selectedEntity, setSelectedEntity,
  createForm, setCreateForm, createFormStep, setCreateFormStep,
  editForm, setEditForm, creditTransferForm, setCreditTransferForm, allocationForm, setAllocationForm,
  isAdmin, isDeleting, isCreatingEntity, isUpdating, isTransferringCredits, allocating,
  loadData, openHierarchyMap, closeHierarchyMap,
  deleteOrganization, updateOrganization, createEntity, handleCreateNext,
  handleTransferCredits, handleAllocateCredits,
  setEditingEntity, setShowEditResponsiblePerson, findOrganizationById, tenantId,
}: OrganizationTreeViewProps) {
  const navigate = useNavigate()

  const EMPTY_TRANSFER_FORM: CreditTransferForm = {
    sourceEntityType: 'organization', sourceEntityId: '', destinationEntityType: 'organization',
    destinationEntityId: '', amount: '', transferType: 'direct', isTemporary: false, recallDeadline: '', description: '',
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center dark:bg-slate-900 dark:border-slate-800 p-4 rounded-xl shadow-sm" style={{ backgroundColor: 'var(--zk-paper)', border: '1px solid var(--zk-line)' }}>
        <div className="flex items-center gap-3 w-full xl:w-auto">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--zk-navy) 10%, transparent)', color: 'var(--zk-navy)' }}>
            <Network className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg" style={{ fontFamily: 'var(--zk-display)', fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--zk-ink)' }}>Hierarchy</h2>
            <div className="flex gap-2" style={{ fontFamily: 'var(--zk-mono)', fontSize: 11, color: 'var(--zk-muted-2)' }}>
              <span>{hierarchy?.totalOrganizations || 0} Organizations</span>
              <span>•</span>
              <span>{locations.length} Locations</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search entities..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
          </div>
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="h-9 w-[130px] bg-slate-50 dark:bg-slate-800"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="h-9">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <PearlButton variant="secondary" size="sm" className="h-9" onClick={openHierarchyMap}>
              <List className="w-3.5 h-3.5 mr-2" />Visual Map
            </PearlButton>
          </div>
        </div>
      </div>

      {/* Tree + Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          {!parentOrg && !loading && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>No root organization found. Please contact an admin to initialize the tenant.</AlertDescription>
            </Alert>
          )}
          {loading && !hierarchy ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <ZopkitRoundLoader size="xl" className="mb-4" /><p>Loading structure...</p>
            </div>
          ) : processedHierarchy.length > 0 ? (
            <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-2">
              {processedHierarchy.map((org, index) => (
                <div key={org.entityId} className={index > 0 ? 'mt-2' : ''}>
                  <TreeNode
                    org={org} level={0} isAdmin={isAdmin} isDeleting={isDeleting}
                    selectedItems={selectedItems} getResponsiblePersonName={getResponsiblePersonName}
                    onEdit={(o) => { setSelectedOrg(o); setEditForm({ name: o.entityName, description: o.description || '', isActive: o.isActive !== false }); setShowEdit(true) }}
                    onAssignManager={(entity) => { setEditingEntity(entity); setShowEditResponsiblePerson(true) }}
                    onAllocateCredits={(entity) => { setSelectedEntity(entity); setAllocationForm({ targetApplication: '', creditAmount: 0, allocationPurpose: '', autoReplenish: false }); setShowAllocationDialog(true) }}
                    onTransferCredits={(o) => { setSelectedOrg(o); setShowCreditTransfer(true) }}
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
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <TreePine className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 style={{ fontFamily: 'var(--zk-display)', fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--zk-ink)' }}>No results found</h3>
              <p className="text-sm mt-1" style={{ fontFamily: 'var(--zk-font)', color: 'var(--zk-muted)' }}>Try adjusting your filters or search terms.</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {parentOrg && (
            <Card className="dark:border-blue-900/20 shadow-sm" style={{ borderColor: 'var(--zk-line)', backgroundColor: 'var(--zk-paper)' }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base" style={{ fontFamily: 'var(--zk-display)', fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--zk-ink)' }}>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full justify-start" style={{ backgroundColor: 'var(--zk-navy)' } as React.CSSProperties} onClick={() => navigate({ to: '/dashboard/organization/create', search: { parentId: parentOrg.entityId, parentName: parentOrg.entityName, entityType: 'organization' as any } })}>
                  <Plus className="w-4 h-4 mr-2" /> Add Sub Organization
                </Button>
                <Button className="w-full justify-start" style={{ backgroundColor: 'var(--zk-navy)' } as React.CSSProperties} onClick={() => navigate({ to: '/dashboard/organization/create', search: { parentId: parentOrg.entityId, parentName: parentOrg.entityName, entityType: 'location' as any } })}>
                  <MapPin className="w-4 h-4 mr-2" /> Add Location
                </Button>
              </CardContent>
            </Card>
          )}
          {unassignedLocations.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />Unassigned Locations ({unassignedLocations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                  {unassignedLocations.map((loc) => (
                    <div key={loc.entityId} className="flex items-start gap-3 p-2 bg-white dark:bg-slate-900 rounded border border-amber-100 dark:border-amber-900/50">
                      <div className="w-8 h-8 rounded bg-amber-100 dark:bg-amber-900 text-amber-600 flex items-center justify-center shrink-0 text-xs font-bold">LOC</div>
                      <div className="min-w-0">
                        <div className="font-medium text-xs truncate">{loc.entityName}</div>
                        <div className="text-[10px] text-slate-500 truncate">{(loc as any).address?.city || 'No City'}</div>
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
        open={showEdit} onOpenChange={setShowEdit}
        editForm={editForm} setEditForm={setEditForm}
        onSave={() => selectedOrg && updateOrganization(selectedOrg, editForm, () => setShowEdit(false))}
        isUpdating={isUpdating}
      />

      <OrganizationCreateDialog
        open={showCreateSub} onOpenChange={setShowCreateSub}
        createForm={createForm} setCreateForm={setCreateForm}
        createFormStep={createFormStep} setCreateFormStep={setCreateFormStep}
        managerUserList={managerUserList} selectedOrg={selectedOrg}
        isCreatingEntity={isCreatingEntity}
        onCreateNext={() => handleCreateNext(createFormStep, setCreateFormStep, createForm)}
        onCreateEntity={() => createEntity(createForm, createFormStep, setCreateFormStep as (s: number) => void, selectedOrg, () => setShowCreateSub(false))}
      />

      <CreditTransferSheet
        open={showCreditTransfer} onOpenChange={setShowCreditTransfer}
        selectedOrg={selectedOrg} locations={locations}
        creditTransferForm={creditTransferForm} setCreditTransferForm={setCreditTransferForm}
        onTransfer={() => selectedOrg && handleTransferCredits(selectedOrg, creditTransferForm, () => {
          setShowCreditTransfer(false)
          setCreditTransferForm(EMPTY_TRANSFER_FORM)
        })}
        isTransferringCredits={isTransferringCredits}
      />

      <AllocateCreditSheet
        open={showAllocationDialog} onOpenChange={setShowAllocationDialog}
        selectedEntity={selectedEntity} effectiveApplications={effectiveApplications}
        allocationForm={allocationForm} setAllocationForm={setAllocationForm}
        onAllocate={() => selectedEntity && handleAllocateCredits(selectedEntity, allocationForm, () => setShowAllocationDialog(false))}
        allocating={allocating}
      />

      <HierarchyChartModal
        show={showHierarchyChart} onClose={closeHierarchyMap}
        hierarchy={hierarchy} processedHierarchy={processedHierarchy}
        loading={loading} isAdmin={isAdmin} tenantId={tenantId}
        parentOrgName={parentOrg?.entityName || 'Organization'} onLoadData={loadData}
        onNodeClick={(nodeId) => { const org = findOrganizationById(nodeId, processedHierarchy); if (org) setSelectedOrg(org) }}
        onEditOrganization={(orgId) => { const org = findOrganizationById(orgId, processedHierarchy); if (org) { setSelectedOrg(org); setEditForm({ name: org.entityName, description: org.description || '', isActive: org.isActive !== false }); setShowEdit(true) } }}
        onDeleteOrganization={(orgId) => { const org = findOrganizationById(orgId, processedHierarchy); if (org) deleteOrganization(org.entityId, org.entityName) }}
        onAddSubOrganization={(parentId) => { const org = findOrganizationById(parentId, processedHierarchy); if (org) navigate({ to: '/dashboard/organization/create', search: { parentId: org.entityId, parentName: org.entityName, entityType: 'organization' as any } }) }}
        onAddLocation={(parentId) => { const org = findOrganizationById(parentId, processedHierarchy); if (org) navigate({ to: '/dashboard/organization/create', search: { parentId: org.entityId, parentName: org.entityName, entityType: 'location' as any } }) }}
        onTransferCredits={(orgId) => {
          const org = findOrganizationById(orgId, processedHierarchy)
          if (org) { setSelectedOrg(org); setCreditTransferForm((prev) => ({ ...prev, sourceEntityId: org.entityId, sourceEntityType: 'organization', destinationEntityId: '', amount: '', description: '' })); setShowCreditTransfer(true) }
        }}
      />
    </div>
  )
}
