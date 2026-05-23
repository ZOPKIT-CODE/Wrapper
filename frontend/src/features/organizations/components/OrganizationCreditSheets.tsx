import React, { Suspense } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PearlButton } from '@/components/ui/pearl-button'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'
import { ArrowRightLeft, CreditCard } from 'lucide-react'
import { Application } from '@/hooks/useDashboardData'
const OrganizationHierarchyFlow = React.lazy(() =>
  import('@/features/organizations/components/OrganizationHierarchyFlow').then((m) => ({
    default: m.OrganizationHierarchyFlow,
  }))
)

// --- Shared types ---

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
}

interface Entity {
  entityId: string
  entityName: string
  entityType: 'organization' | 'location' | 'department' | 'team'
  entityLevel: number
  hierarchyPath: string
  fullHierarchyPath: string
  parentEntityId?: string
  isActive: boolean
  children: Entity[]
  availableCredits?: number
}

interface OrganizationHierarchy {
  success: boolean
  hierarchy: Organization[]
  totalOrganizations: number
  message: string
}

export interface CreditTransferForm {
  sourceEntityType: string
  sourceEntityId: string
  destinationEntityType: string
  destinationEntityId: string
  amount: string
  transferType: string
  isTemporary: boolean
  recallDeadline: string
  description: string
}

export interface AllocationForm {
  targetApplication: string
  creditAmount: number
  allocationPurpose: string
  autoReplenish: boolean
}

// --- Credit Transfer Sheet ---

export interface CreditTransferSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedOrg: Organization | null
  locations: Location[]
  creditTransferForm: CreditTransferForm
  setCreditTransferForm: (form: CreditTransferForm) => void
  onTransfer: () => void
  isTransferringCredits: boolean
}

export function CreditTransferSheet({
  open,
  onOpenChange,
  selectedOrg,
  locations,
  creditTransferForm,
  setCreditTransferForm,
  onTransfer,
  isTransferringCredits,
}: CreditTransferSheetProps) {
  const getChildOrganizations = (org: Organization): Organization[] => {
    let children: Organization[] = []
    if (org.children) {
      children = [...org.children]
      org.children.forEach((child) => {
        children = [...children, ...getChildOrganizations(child as Organization)]
      })
    }
    return children
  }

  const getOrgAndChildIds = (org: Organization): string[] => {
    let ids = [org.entityId]
    if (org.children) {
      org.children.forEach((child) => {
        ids = [...ids, ...getOrgAndChildIds(child as Organization)]
      })
    }
    return ids
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full min-h-0 w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg [&>button]:text-white [&>button]:hover:bg-white/15"
      >
        <SheetHeader className="shrink-0 space-y-2 border-b border-white/10 bg-[#1B2E5A] px-6 pb-5 pt-8 text-white">
          <SheetTitle
            className="flex items-center gap-2 text-white"
            style={{ fontFamily: 'var(--zk-display)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.025em' }}
          >
            <CreditCard className="h-5 w-5 shrink-0" aria-hidden />
            Transfer Credits
          </SheetTitle>
          <SheetDescription className="text-sm text-white/85">
            Transfer credits from {selectedOrg?.entityName} to its child organizations or locations.
          </SheetDescription>
        </SheetHeader>

        <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-5">
          {/* Source display */}
          <div>
            <Label>From (Source)</Label>
            <div className="p-3 border rounded-lg bg-[#1B2E5A]/5 border-[#1B2E5A]/20 mt-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#1B2E5A] flex items-center justify-center text-white font-semibold text-sm">
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
              onValueChange={(value) =>
                setCreditTransferForm({ ...creditTransferForm, destinationEntityType: value, destinationEntityId: '' })
              }
            >
              <SelectTrigger className="mt-1 focus:ring-2 focus:ring-[#1B2E5A] focus:border-[#1B2E5A] transition-colors">
                <SelectValue placeholder="Select destination type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="organization">Child Organization</SelectItem>
                <SelectItem value="location">Location</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Destination entity */}
          <div>
            <Label>Select Destination</Label>
            <Select
              value={creditTransferForm.destinationEntityId}
              onValueChange={(value) =>
                setCreditTransferForm({ ...creditTransferForm, destinationEntityId: value })
              }
            >
              <SelectTrigger className="mt-1 focus:ring-2 focus:ring-[#1B2E5A] focus:border-[#1B2E5A] transition-colors">
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                {creditTransferForm.destinationEntityType === 'organization' ? (
                  (() => {
                    const childOrgs = selectedOrg ? getChildOrganizations(selectedOrg as Organization) : []
                    return childOrgs.length > 0 ? (
                      childOrgs.map((org) => (
                        <SelectItem key={org.entityId} value={org.entityId}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{org.entityName}</span>
                            <span className="text-xs text-gray-500">Level {org.entityLevel}</span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-orgs" disabled>No child organizations available</SelectItem>
                    )
                  })()
                ) : (
                  (() => {
                    const allowedOrgIds = selectedOrg ? getOrgAndChildIds(selectedOrg as Organization) : []
                    const allowedLocations = locations.filter(
                      (loc) => loc.parentEntityId && allowedOrgIds.includes(loc.parentEntityId)
                    )
                    return allowedLocations.length > 0 ? (
                      allowedLocations.map((loc) => (
                        <SelectItem key={loc.entityId} value={loc.entityId}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{loc.entityName}</span>
                            <span className="text-xs text-gray-500">{loc.locationType || 'location'}</span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-locations" disabled>No locations available for transfer</SelectItem>
                    )
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
              onChange={(e) => setCreditTransferForm({ ...creditTransferForm, amount: e.target.value })}
              placeholder="Enter credit amount"
              min="1"
              step="1"
              className="mt-1 focus:ring-2 focus:ring-[#1B2E5A] focus:border-[#1B2E5A] transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <Label>Description (Optional)</Label>
            <Textarea
              value={creditTransferForm.description}
              onChange={(e) => setCreditTransferForm({ ...creditTransferForm, description: e.target.value })}
              placeholder="Reason for transfer..."
              className="mt-1 resize-none focus:ring-2 focus:ring-[#1B2E5A] focus:border-[#1B2E5A] transition-colors"
              rows={2}
            />
          </div>
        </div>

        <SheetFooter className="mt-0 shrink-0 flex-row justify-end gap-2 border-t border-[#1B2E5A]/10 bg-[#F0F4FA] px-6 py-4 dark:border-slate-700 dark:bg-slate-900/80">
          <PearlButton variant="outline" onClick={() => onOpenChange(false)} disabled={isTransferringCredits}>
            Cancel
          </PearlButton>
          <PearlButton
            onClick={onTransfer}
            disabled={
              isTransferringCredits ||
              !creditTransferForm.destinationEntityId ||
              !creditTransferForm.amount ||
              creditTransferForm.destinationEntityId === 'no-orgs' ||
              creditTransferForm.destinationEntityId === 'no-locations'
            }
            className="bg-[#1B2E5A] text-white hover:opacity-90"
            style={{ backgroundColor: 'var(--zk-navy)' } as React.CSSProperties}
          >
            {isTransferringCredits ? (
              <>
                <ZopkitRoundLoader size="xs" className="mr-2" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Transfer Credits
              </>
            )}
          </PearlButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// --- Allocate Credits Sheet ---

export interface AllocateCreditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedEntity: Entity | null
  effectiveApplications: Application[]
  allocationForm: AllocationForm
  setAllocationForm: (form: AllocationForm) => void
  onAllocate: () => void
  allocating: boolean
}

export function AllocateCreditSheet({
  open,
  onOpenChange,
  selectedEntity,
  effectiveApplications,
  allocationForm,
  setAllocationForm,
  onAllocate,
  allocating,
}: AllocateCreditSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full min-h-0 w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg [&>button]:text-white [&>button]:hover:bg-white/15"
      >
        <SheetHeader className="shrink-0 space-y-2 border-b border-white/10 bg-[#1B2E5A] px-6 pb-5 pt-8 text-white">
          <SheetTitle
            className="text-white"
            style={{ fontFamily: 'var(--zk-display)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.025em' }}
          >
            Allocate Credits to Application
          </SheetTitle>
          <SheetDescription className="text-sm text-white/85">
            {selectedEntity && (
              <>
                Allocating from: <strong className="text-white">{selectedEntity.entityName}</strong> (Available:{' '}
                {(selectedEntity.availableCredits || 0).toLocaleString()} credits)
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <Label>Application <span className="text-red-500">*</span></Label>
            <Select
              value={allocationForm.targetApplication}
              onValueChange={(v) => setAllocationForm({ ...allocationForm, targetApplication: v })}
            >
              <SelectTrigger className="min-w-0 overflow-hidden [&>span]:min-w-0 [&>span]:block [&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap focus:ring-2 focus:ring-[#1B2E5A] focus:border-[#1B2E5A] transition-colors">
                <SelectValue placeholder="Select App" />
              </SelectTrigger>
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
              onChange={(e) => setAllocationForm({ ...allocationForm, creditAmount: parseFloat(e.target.value) || 0 })}
              placeholder="Enter credit amount"
              className="focus:ring-2 focus:ring-[#1B2E5A] focus:border-[#1B2E5A] transition-colors"
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
              onChange={(e) => setAllocationForm({ ...allocationForm, allocationPurpose: e.target.value })}
              placeholder="Describe the purpose of this allocation"
              rows={3}
              className="focus:ring-2 focus:ring-[#1B2E5A] focus:border-[#1B2E5A] transition-colors"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autoReplenish"
              checked={allocationForm.autoReplenish}
              onChange={(e) => setAllocationForm({ ...allocationForm, autoReplenish: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 focus:ring-2 focus:ring-[#1B2E5A] focus:ring-offset-0"
            />
            <Label htmlFor="autoReplenish" className="text-sm font-normal cursor-pointer">
              Auto-replenish when credits run low
            </Label>
          </div>
        </div>

        <SheetFooter className="mt-0 shrink-0 flex-row justify-end gap-2 border-t border-[#1B2E5A]/10 bg-[#F0F4FA] px-6 py-4 dark:border-slate-700 dark:bg-slate-900/80">
          <PearlButton variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </PearlButton>
          <PearlButton
            onClick={onAllocate}
            disabled={allocating || !allocationForm.targetApplication || !allocationForm.creditAmount || allocationForm.creditAmount <= 0}
            className="bg-[#1B2E5A] text-white hover:opacity-90"
            style={{ backgroundColor: 'var(--zk-navy)' } as React.CSSProperties}
          >
            {allocating ? (
              <>
                <ZopkitRoundLoader size="xs" className="mr-2" /> Allocating...
              </>
            ) : (
              'Allocate Credits'
            )}
          </PearlButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// --- Hierarchy Chart Modal ---

export interface HierarchyChartModalProps {
  show: boolean
  onClose: () => void
  hierarchy: OrganizationHierarchy | null
  processedHierarchy: Organization[]
  loading: boolean
  isAdmin: boolean
  tenantId: string
  parentOrgName: string
  onLoadData: () => void
  onNodeClick: (nodeId: string) => void
  onEditOrganization: (orgId: string) => void
  onDeleteOrganization: (orgId: string) => void
  onAddSubOrganization: (parentId: string) => void
  onAddLocation: (parentId: string) => void
  onTransferCredits: (orgId: string) => void
}

export function HierarchyChartModal({
  show,
  onClose,
  hierarchy,
  processedHierarchy,
  loading,
  isAdmin,
  tenantId,
  parentOrgName,
  onLoadData,
  onNodeClick,
  onEditOrganization,
  onDeleteOrganization,
  onAddSubOrganization,
  onAddLocation,
  onTransferCredits,
}: HierarchyChartModalProps) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm flex flex-col">
      <div className="p-4 border-b flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
        <h2 style={{ fontFamily: 'var(--zk-display)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--zk-ink)' }}>
          Visual Hierarchy
        </h2>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden relative" style={{ minHeight: '400px' }}>
        <div className="absolute inset-0 w-full h-full">
          <Suspense fallback={<div className="flex items-center justify-center p-8"><span>Loading hierarchy...</span></div>}>
            <OrganizationHierarchyFlow
              hierarchy={hierarchy ? { ...hierarchy, hierarchy: processedHierarchy } : null}
              loading={loading}
              onRefresh={onLoadData}
              isAdmin={isAdmin}
              tenantId={tenantId}
              tenantName={parentOrgName}
              onNodeClick={onNodeClick}
              onEditOrganization={onEditOrganization}
              onDeleteOrganization={onDeleteOrganization}
              onAddSubOrganization={onAddSubOrganization}
              onAddLocation={onAddLocation}
              onTransferCredits={onTransferCredits}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
