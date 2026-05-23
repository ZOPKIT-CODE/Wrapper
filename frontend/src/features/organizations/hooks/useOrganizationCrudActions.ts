import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CreateForm } from '../components/OrganizationCreateDialog'

interface Organization {
  entityId: string
  entityName: string
  entityType: string
  parentEntityId?: string
  entityLevel?: number
  isActive?: boolean
  description?: string
}

interface Entity {
  entityId: string
  entityName: string
  entityType: string
  availableCredits?: number
}

interface CreditTransferForm {
  destinationEntityType: string
  destinationEntityId: string
  amount: string
  description: string
  [key: string]: any
}

interface AllocationForm {
  targetApplication: string
  creditAmount: number
  allocationPurpose: string
  autoReplenish: boolean
}

interface EditForm {
  name: string
  description: string
  isActive: boolean
}

function createIdempotencyKey(scope: string, entityId?: string): string {
  return `${scope}:${entityId ?? 'na'}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
}

export function useOrganizationCrudActions(
  tenantId: string,
  makeRequest: (endpoint: string, options?: RequestInit) => Promise<any>,
  processedHierarchy: Organization[],
  loadData: () => Promise<void>
) {
  const queryClient = useQueryClient()

  const [isCreatingEntity, setIsCreatingEntity] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isTransferringCredits, setIsTransferringCredits] = useState(false)
  const [allocating, setAllocating] = useState(false)

  const invalidateEntityQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['entities', 'hierarchy', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['entities', 'available'] })
    queryClient.invalidateQueries({ queryKey: ['entities', tenantId] })
  }

  const validateCreateStep = (step: number, createForm: CreateForm): string | null => {
    if (step === 0) {
      if (!createForm.name.trim() || createForm.name.trim().length < 2) return 'Name must be at least 2 characters'
      if (!createForm.legalName.trim()) return 'Legal name is required'
    }
    if (step === 1) {
      if (!createForm.country) return 'Country is required'
      if (!createForm.currency) return 'Currency is required'
    }
    return null
  }

  const handleCreateNext = (createFormStep: number, setCreateFormStep: (s: number | ((p: number) => number)) => void, createForm: CreateForm) => {
    const err = validateCreateStep(createFormStep, createForm)
    if (err) { toast.error(err); return }
    setCreateFormStep((s) => Math.min(s + 1, 3))
  }

  const createEntity = async (
    createForm: CreateForm,
    createFormStep: number,
    setCreateFormStep: (s: number) => void,
    selectedOrg: Organization | null,
    onSuccess: () => void
  ) => {
    if (isCreatingEntity) return
    for (let step = 0; step < 4; step += 1) {
      const err = validateCreateStep(step, createForm)
      if (err) { setCreateFormStep(step); toast.error(err); return }
    }
    const loadingToastId = toast.loading(`Creating ${createForm.entityType}...`)
    const idempotencyKey = createIdempotencyKey(`create-${createForm.entityType}`, selectedOrg?.entityId)
    setIsCreatingEntity(true)
    try {
      const payload: any = {
        entityName: createForm.name.trim(), entityType: createForm.entityType, subType: createForm.subType,
        parentEntityId: selectedOrg?.entityId ?? null, parentTenantId: tenantId || '',
        responsiblePersonId: createForm.responsiblePersonId === 'none' ? null : createForm.responsiblePersonId || null,
        description: createForm.description || undefined, entityCode: createForm.code.trim() || undefined,
        status: createForm.status, legalName: createForm.legalName.trim(), country: createForm.country,
        currency: createForm.currency, fiscalYearEnd: createForm.fiscalYearEnd,
        taxId: createForm.taxId || undefined, registrationNumber: createForm.registrationNumber || undefined,
        email: createForm.email || undefined, phone: createForm.phone || undefined,
        website: createForm.website || undefined, notes: createForm.notes || undefined,
      }
      const response = await makeRequest('/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Application': 'crm', 'X-Idempotency-Key': idempotencyKey },
        body: JSON.stringify(payload),
      })
      if (response.success) {
        toast.success(`${createForm.entityType} created`)
        invalidateEntityQueries()
        await loadData()
        onSuccess()
      } else {
        toast.error(response?.message || `Failed to create ${createForm.entityType}`)
      }
    } catch (error: any) {
      toast.error(error?.message || `Failed to create ${createForm.entityType}`)
    } finally {
      toast.dismiss(loadingToastId)
      setIsCreatingEntity(false)
    }
  }

  const updateOrganization = async (selectedOrg: Organization, editForm: EditForm, onSuccess: () => void) => {
    if (isUpdating) return
    const loadingToastId = toast.loading('Updating organization...')
    const idempotencyKey = createIdempotencyKey('update-organization', selectedOrg.entityId)
    setIsUpdating(true)
    try {
      const response = await makeRequest(`/entities/${selectedOrg.entityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Application': 'crm', 'X-Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ ...editForm, entityName: editForm.name, parentTenantId: tenantId || '' }),
      })
      if (response.success) {
        toast.success('Updated successfully')
        invalidateEntityQueries()
        await loadData()
        onSuccess()
      } else {
        toast.error(response?.message || 'Failed to update organization')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update organization')
    } finally {
      toast.dismiss(loadingToastId)
      setIsUpdating(false)
    }
  }

  const deleteOrganization = async (orgId: string, orgName?: string) => {
    if (isDeleting) return
    const org = processedHierarchy.find((o) => o.entityId === orgId)
    if (org && (org.parentEntityId == null || org.parentEntityId === '')) {
      toast.error('Cannot delete the primary organization created during onboarding.')
      return
    }
    const orgToDelete = orgName || org?.entityName || 'this organization'
    if (!confirm(`Are you sure you want to delete "${orgToDelete}"? This action cannot be undone.`)) return
    const loadingToastId = toast.loading(`Deleting "${orgToDelete}"...`)
    const idempotencyKey = createIdempotencyKey('delete-organization', orgId)
    setIsDeleting(true)
    try {
      const response = await makeRequest(`/entities/${orgId}`, {
        method: 'DELETE',
        headers: { 'X-Application': 'crm', 'X-Idempotency-Key': idempotencyKey },
      })
      if (response.success) {
        toast.success('Deleted')
        invalidateEntityQueries()
        await loadData()
      } else {
        toast.error(response?.message || 'Failed to delete organization')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete organization')
    } finally {
      toast.dismiss(loadingToastId)
      setIsDeleting(false)
    }
  }

  const handleAllocateCredits = async (selectedEntity: Entity, allocationForm: AllocationForm, onSuccess: () => void) => {
    if (allocating) return
    if (!allocationForm.creditAmount) { toast.error('Fill required fields'); return }
    if (allocationForm.creditAmount > Number(selectedEntity.availableCredits || 0)) { toast.error('Insufficient credits'); return }
    const idempotencyKey = `org-alloc:${selectedEntity.entityId}:${allocationForm.targetApplication}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
    const loadingToastId = toast.loading('Allocating credits...')
    setAllocating(true)
    try {
      const response = await makeRequest('/credits/allocate/application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Application': 'crm', 'X-Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ sourceEntityId: selectedEntity.entityId, targetApplication: allocationForm.targetApplication, creditAmount: allocationForm.creditAmount, allocationPurpose: allocationForm.allocationPurpose, autoReplenish: allocationForm.autoReplenish }),
      })
      if (response.success) {
        toast.success('Credits allocated')
        queryClient.invalidateQueries({ queryKey: ['credit'] })
        queryClient.invalidateQueries({ queryKey: ['creditStatus'] })
        queryClient.invalidateQueries({ queryKey: ['entityScope'] })
        queryClient.invalidateQueries({ queryKey: ['entities', 'hierarchy', tenantId] })
        queryClient.invalidateQueries({ queryKey: ['entities', tenantId] })
        await loadData()
        onSuccess()
      } else {
        toast.error(response?.message || 'Credit allocation failed')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to allocate credits')
    } finally {
      toast.dismiss(loadingToastId)
      setAllocating(false)
    }
  }

  const handleTransferCredits = async (selectedOrg: Organization, creditTransferForm: CreditTransferForm, onSuccess: () => void) => {
    if (isTransferringCredits) return
    const invalidDestination = !creditTransferForm.destinationEntityId
      || creditTransferForm.destinationEntityId === 'no-orgs'
      || creditTransferForm.destinationEntityId === 'no-locations'
    if (invalidDestination || !creditTransferForm.amount) {
      toast.error('Please select destination and amount')
      return
    }
    const creditAmount = parseFloat(creditTransferForm.amount)
    if (!Number.isFinite(creditAmount) || creditAmount <= 0) { toast.error('Please enter a valid credit amount'); return }
    const loadingToastId = toast.loading('Transferring credits...')
    const idempotencyKey = createIdempotencyKey('transfer-credits', selectedOrg.entityId)
    setIsTransferringCredits(true)
    try {
      const response = await makeRequest('/credits/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Application': 'crm', 'X-Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          fromEntityId: selectedOrg.entityId,
          toEntityType: creditTransferForm.destinationEntityType,
          toEntityId: creditTransferForm.destinationEntityId,
          creditAmount,
          reason: creditTransferForm.description || `Transfer from ${selectedOrg.entityName}`,
        }),
      })
      if (response.success) {
        toast.success(`Successfully transferred ${creditAmount} credits`)
        queryClient.invalidateQueries({ queryKey: ['credit'] })
        queryClient.invalidateQueries({ queryKey: ['creditStatus'] })
        queryClient.invalidateQueries({ queryKey: ['entityScope'] })
        queryClient.invalidateQueries({ queryKey: ['entities', 'hierarchy', tenantId] })
        queryClient.invalidateQueries({ queryKey: ['entities', tenantId] })
        await loadData()
        onSuccess()
      } else {
        toast.error(response?.message || 'Credit transfer failed')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to transfer credits')
    } finally {
      toast.dismiss(loadingToastId)
      setIsTransferringCredits(false)
    }
  }

  return {
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
    validateCreateStep,
  }
}
