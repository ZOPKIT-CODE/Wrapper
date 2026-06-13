import React, { useState, useEffect, useCallback } from 'react'
import { logger } from '@/lib/logger'
import { useQueryClient } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Loader2,
  Search,
  Building2,
  MapPin,
  Users,
  CreditCard,
  Eye,
  Power,
  PowerOff,
  TreePine,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Checkbox } from '@/components/ui/checkbox'

interface Entity {
  entityId: string
  tenantId: string
  entityType: string
  entityName: string
  entityCode: string
  parentEntityId: string | null
  entityLevel: number
  isActive: boolean
  createdAt: string
  companyName: string
  availableCredits: number
  reservedCredits: number
  responsiblePerson: string | null
}

interface EntityDetails {
  entity: Entity & {
    description?: string
    timezone?: string
    currency?: string
  }
  tenant: {
    tenantId: string
    companyName: string
    subdomain: string
  }
  credit: {
    availableCredits: number
    reservedCredits: number
  }
  responsiblePerson: {
    userId: string
    name: string
    email: string
  } | null
  hierarchy: Array<{
    entityId: string
    entityName: string
    entityType: string
  }>
  children: Array<{
    entityId: string
    entityType: string
    entityName: string
    isActive: boolean
    availableCredits: number
  }>
  stats: {
    transactionCount: number
    childEntityCount: number
    recentUsage: number
  }
}

interface ApplicationAllocation {
  allocationId: string
  tenantId: string
  sourceEntityId: string
  targetApplication: string
  allocatedCredits: number
  usedCredits: number
  availableCredits: number
  allocationType: string
  allocationPurpose?: string
  allocatedAt: string
  expiresAt?: string
  autoReplenish: boolean
}

interface EntityApplicationAllocations {
  entity: {
    entityId: string
    entityName: string
    entityType: string
    tenantId: string
  }
  allocations: ApplicationAllocation[]
  summary: {
    totalAllocations: number
    totalAllocatedCredits: number
    totalUsedCredits: number
    totalAvailableCredits: number
    allocationsByApplication: Array<{
      application: string
      allocationCount: number
      totalAllocated: number
      totalUsed: number
      totalAvailable: number
    }>
  }
}

export const EntityManagement: React.FC = () => {
  const queryClient = useQueryClient()

  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all')
  const [selectedEntity, setSelectedEntity] = useState<EntityDetails | null>(
    null
  )
  const [entityAllocations, setEntityAllocations] =
    useState<EntityApplicationAllocations | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showAllocationDialog, setShowAllocationDialog] = useState(false)
  const [showBulkAllocation, setShowBulkAllocation] = useState(false)
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(
    new Set()
  )
  const [bulkAllocationAmount, setBulkAllocationAmount] = useState('')
  const [bulkAllocating, setBulkAllocating] = useState(false)
  const [allocationForm, setAllocationForm] = useState({
    targetApplication: '',
    creditAmount: 0,
    allocationPurpose: '',
    autoReplenish: false,
  })
  const [allocating, setAllocating] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  const fetchEntities = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/entities/all', {
        params: {
          search: searchTerm,
          entityType: entityTypeFilter !== 'all' ? entityTypeFilter : undefined,
          page: pagination.page,
          limit: pagination.limit,
        },
      })

      if (response.data.success) {
        setEntities(response.data.data.entities)
        setPagination(response.data.data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch entities:', error)
      toast.error('Failed to load entities')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, entityTypeFilter, pagination.page, pagination.limit])

  useEffect(() => {
    fetchEntities()
  }, [fetchEntities])

  const handleViewDetails = async (entity: Entity) => {
    try {
      // Fetch entity details
      const detailsResponse = await api.get(
        `/admin/entities/${entity.entityId}/details`
      )
      if (detailsResponse.data.success) {
        setSelectedEntity(detailsResponse.data.data)
      }

      // Fetch application allocations for this entity
      try {
        const allocationsResponse = await api.get(
          `/admin/credits/entity/${entity.entityId}/application-allocations`
        )
        if (allocationsResponse.data.success) {
          setEntityAllocations(allocationsResponse.data.data)
        }
      } catch (allocationsError) {
        logger.warn(
          'Failed to fetch entity application allocations:',
          allocationsError
        )
        setEntityAllocations(null)
      }

      setShowDetails(true)
    } catch (error) {
      console.error('Failed to fetch entity details:', error)
      toast.error('Failed to load entity details')
    }
  }

  const handleAllocateCredits = async () => {
    if (
      !selectedEntity ||
      !allocationForm.targetApplication ||
      !allocationForm.creditAmount
    ) {
      toast.error('Please fill in all required fields')
      return
    }

    // Check if entity has enough credits
    const entityCredits = parseFloat(
      String(selectedEntity.credit.availableCredits || 0)
    )
    if (allocationForm.creditAmount > entityCredits) {
      toast.error(
        `Entity only has ${entityCredits.toFixed(2)} credits available`
      )
      return
    }

    setAllocating(true)
    try {
      const response = await api.post('/credits/allocate/application', {
        sourceEntityId: selectedEntity.entity.entityId,
        targetApplication: allocationForm.targetApplication,
        creditAmount: allocationForm.creditAmount,
        allocationPurpose: allocationForm.allocationPurpose,
        autoReplenish: allocationForm.autoReplenish,
      })

      if (response.data.success) {
        toast.success(
          `Successfully allocated ${allocationForm.creditAmount} credits to ${allocationForm.targetApplication}`
        )

        // Invalidate credit queries to update the UI immediately
        try {
          queryClient.invalidateQueries({ queryKey: ['credit'] })
          queryClient.invalidateQueries({
            queryKey: ['creditStatus'],
            exact: false,
          })
          queryClient.invalidateQueries({ queryKey: ['admin', 'entities'] })
        } catch (invalidateError) {
          logger.warn('Failed to invalidate queries:', invalidateError)
          // Don't show error to user as this is not critical
        }

        // Reset form
        setAllocationForm({
          targetApplication: '',
          creditAmount: 0,
          allocationPurpose: '',
          autoReplenish: false,
        })
        setShowAllocationDialog(false)

        // Refresh data
        await handleViewDetails(selectedEntity.entity)
      }
    } catch (error: unknown) {
      console.error('Failed to allocate credits:', error)
      const err = error as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message || 'Failed to allocate credits')
    } finally {
      setAllocating(false)
    }
  }

  const handleToggleStatus = async (entity: Entity) => {
    try {
      const response = await api.patch(
        `/admin/entities/${entity.entityId}/status`,
        {
          isActive: !entity.isActive,
          reason: 'Admin action',
        }
      )

      if (response.data.success) {
        toast.success(
          `Entity ${!entity.isActive ? 'activated' : 'deactivated'} successfully`
        )
        queryClient.invalidateQueries({ queryKey: ['entityScope'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'entities'] })
        fetchEntities()
      }
    } catch (error) {
      console.error('Failed to toggle entity status:', error)
      toast.error('Failed to update entity status')
    }
  }

  const handleEntitySelection = (entityId: string, checked: boolean) => {
    const newSelected = new Set(selectedEntities)
    if (checked) {
      newSelected.add(entityId)
    } else {
      newSelected.delete(entityId)
    }
    setSelectedEntities(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEntities(new Set(entities.map((e) => e.entityId)))
    } else {
      setSelectedEntities(new Set())
    }
  }

  const handleBulkAllocation = async () => {
    const amount = parseFloat(bulkAllocationAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (selectedEntities.size === 0) {
      toast.error('Please select at least one entity')
      return
    }

    setBulkAllocating(true)
    try {
      const allocations = Array.from(selectedEntities).map((entityId) => ({
        entityId,
        amount: amount.toString(),
        operationCode: 'admin.bulk_allocation',
      }))

      const response = await api.post('/admin/credits/bulk-allocate', {
        allocations,
        reason: 'Bulk credit allocation from admin panel',
      })

      if (response.data.success) {
        toast.success(
          `Allocated ${amount} credits to ${selectedEntities.size} entities successfully`
        )
        setShowBulkAllocation(false)
        setSelectedEntities(new Set())
        setBulkAllocationAmount('')
        queryClient.invalidateQueries({ queryKey: ['credit'] })
        queryClient.invalidateQueries({ queryKey: ['creditStatus'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'entities'] })
        queryClient.invalidateQueries({ queryKey: ['entityScope'] })
        fetchEntities()
      }
    } catch (error) {
      console.error('Bulk allocation failed:', error)
      toast.error('Failed to allocate credits')
    } finally {
      setBulkAllocating(false)
    }
  }

  const getEntityTypeIcon = (entityType: string) => {
    switch (entityType) {
      case 'organization':
        return <Building2 className="h-4 w-4" />
      case 'location':
        return <MapPin className="h-4 w-4" />
      case 'department':
        return <Users className="h-4 w-4" />
      case 'team':
        return <Users className="h-4 w-4" />
      default:
        return <Building2 className="h-4 w-4" />
    }
  }

  const getEntityTypeBadge = (entityType: string) => {
    const variants = {
      organization: 'default',
      location: 'secondary',
      department: 'outline',
      team: 'outline',
    } as const

    return (
      <Badge
        variant={variants[entityType as keyof typeof variants] || 'default'}
      >
        {entityType}
      </Badge>
    )
  }

  const buildHierarchyPath = (hierarchy: EntityDetails['hierarchy']) => {
    return hierarchy.map((item, index) => (
      <span key={item.entityId}>
        {index > 0 && ' > '}
        <span className="font-medium">{item.entityName}</span>
        <Badge variant="outline" className="ml-1 text-xs">
          {item.entityType}
        </Badge>
      </span>
    ))
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Entity Management</CardTitle>
          <CardDescription>
            Manage all organizations, locations, departments, and teams
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                <Input
                  placeholder="Search entities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={entityTypeFilter}
              onValueChange={setEntityTypeFilter}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="organization">Organizations</SelectItem>
                <SelectItem value="location">Locations</SelectItem>
                <SelectItem value="department">Departments</SelectItem>
                <SelectItem value="team">Teams</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{pagination.total}</div>
              <div className="text-muted-foreground text-sm">
                Total Entities
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {entities.filter((e) => e.entityType === 'organization').length}
              </div>
              <div className="text-muted-foreground text-sm">Organizations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {entities.filter((e) => e.entityType === 'location').length}
              </div>
              <div className="text-muted-foreground text-sm">Locations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {entities.filter((e) => e.isActive).length}
              </div>
              <div className="text-muted-foreground text-sm">Active</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entities Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading entities...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        selectedEntities.size === entities.length &&
                        entities.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entities.map((entity) => (
                  <TableRow key={entity.entityId}>
                    <TableCell>
                      <Checkbox
                        checked={selectedEntities.has(entity.entityId)}
                        onCheckedChange={(checked) =>
                          handleEntitySelection(
                            entity.entityId,
                            checked as boolean
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getEntityTypeIcon(entity.entityType)}
                        <div>
                          <div className="font-medium">{entity.entityName}</div>
                          <div className="text-muted-foreground text-sm">
                            {entity.entityCode}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getEntityTypeBadge(entity.entityType)}
                    </TableCell>
                    <TableCell>{entity.companyName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TreePine className="text-muted-foreground h-4 w-4" />
                        {entity.entityLevel}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <CreditCard className="text-muted-foreground mr-1 h-4 w-4" />
                        <span
                          className={
                            (parseFloat(String(entity.availableCredits || 0)) ||
                              0) < 100
                              ? 'text-red-600'
                              : ''
                          }
                        >
                          {(
                            parseFloat(String(entity.availableCredits || 0)) ||
                            0
                          ).toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={entity.isActive ? 'default' : 'secondary'}
                      >
                        {entity.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(entity.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(entity)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(entity)}
                        >
                          {entity.isActive ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Bulk Actions */}
          {selectedEntities.size > 0 && (
            <div className="bg-muted/50 flex items-center justify-between border-t px-6 py-4">
              <div className="text-sm">
                {selectedEntities.size} entity(ies) selected
              </div>
              <div className="flex gap-2">
                <Dialog
                  open={showBulkAllocation}
                  onOpenChange={setShowBulkAllocation}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Bulk Allocate Credits
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Bulk Credit Allocation</DialogTitle>
                      <DialogDescription>
                        Allocate credits to {selectedEntities.size} selected
                        entities
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">
                          Credit Amount
                        </label>
                        <Input
                          type="number"
                          placeholder="Enter amount"
                          value={bulkAllocationAmount}
                          onChange={(e) =>
                            setBulkAllocationAmount(e.target.value)
                          }
                          className="mt-1"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowBulkAllocation(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleBulkAllocation}
                          disabled={
                            bulkAllocating ||
                            !bulkAllocationAmount ||
                            bulkAllocationAmount === '0'
                          }
                        >
                          {bulkAllocating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Allocating...
                            </>
                          ) : (
                            <>
                              <Plus className="mr-2 h-4 w-4" />
                              Allocate Credits
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-6 py-4">
              <div className="text-muted-foreground text-sm">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
                of {pagination.total} results
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entity Details Dialog */}
      <Dialog
        open={showDetails}
        onOpenChange={(open) => {
          setShowDetails(open)
          if (!open) {
            setEntityAllocations(null) // Clear allocations when dialog closes
          }
        }}
      >
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEntity?.entity.entityName} Details
            </DialogTitle>
            <DialogDescription>
              Comprehensive information about this entity
            </DialogDescription>
          </DialogHeader>

          {selectedEntity && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Name:</span>
                      <span>{selectedEntity.entity?.entityName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Code:</span>
                      <span>{selectedEntity.entity?.entityCode || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Type:</span>
                      {selectedEntity.entity ? (
                        getEntityTypeBadge(selectedEntity.entity.entityType)
                      ) : (
                        <Badge variant="secondary">Unknown</Badge>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Level:</span>
                      <span>{selectedEntity.entity?.entityLevel || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Company:</span>
                      <span>{selectedEntity.tenant?.companyName || 'N/A'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Credit Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Available:</span>
                      <span className="font-bold">
                        {(
                          parseFloat(
                            String(selectedEntity.credit.availableCredits || 0)
                          ) || 0
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Reserved:</span>
                      <span>
                        {(
                          parseFloat(
                            String(selectedEntity.credit.reservedCredits || 0)
                          ) || 0
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Status:</span>
                      <Badge
                        variant={
                          selectedEntity.entity.isActive
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {selectedEntity.entity.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Hierarchy Path */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Hierarchy Path</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    {buildHierarchyPath(selectedEntity.hierarchy)}
                  </div>
                </CardContent>
              </Card>

              {/* Child Entities */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Child Entities ({selectedEntity.children?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedEntity.children ||
                  selectedEntity.children.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No child entities
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedEntity.children.map((child) => (
                        <div
                          key={child.entityId}
                          className="flex items-center justify-between border-b py-2 last:border-b-0"
                        >
                          <div className="flex items-center gap-2">
                            {getEntityTypeIcon(child.entityType)}
                            <div>
                              <div className="font-medium">
                                {child.entityName}
                              </div>
                              <div className="text-muted-foreground text-sm">
                                {child.entityType} •{' '}
                                {(
                                  parseFloat(
                                    String(child.availableCredits || 0)
                                  ) || 0
                                ).toFixed(2)}{' '}
                                credits
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant={child.isActive ? 'default' : 'secondary'}
                          >
                            {child.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Application Credit Allocations */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        Application Credit Allocations
                      </CardTitle>
                      <CardDescription>
                        Credits allocated to applications by this entity
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => setShowAllocationDialog(true)}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Allocate Credits
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {entityAllocations ? (
                    <>
                      {/* Summary */}
                      {(entityAllocations.summary?.totalAllocations ?? 0) >
                        0 && (
                        <div className="mb-6 grid gap-4 md:grid-cols-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {entityAllocations.summary?.totalAllocations ?? 0}
                            </div>
                            <div className="text-sm text-gray-600">
                              Active Allocations
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">
                              {(
                                entityAllocations.summary
                                  ?.totalAllocatedCredits || 0
                              ).toFixed(2)}
                            </div>
                            <div className="text-sm text-gray-600">
                              Total Allocated
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">
                              {(
                                entityAllocations.summary?.totalUsedCredits || 0
                              ).toFixed(2)}
                            </div>
                            <div className="text-sm text-gray-600">
                              Total Used
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {(
                                entityAllocations.summary
                                  ?.totalAvailableCredits || 0
                              ).toFixed(2)}
                            </div>
                            <div className="text-sm text-gray-600">
                              Available
                            </div>
                          </div>
                        </div>
                      )}

                      {/* By Application */}
                      {(entityAllocations.summary?.allocationsByApplication
                        ?.length ?? 0) > 0 ? (
                        <div>
                          <h4 className="mb-3 font-medium">By Application</h4>
                          <div className="grid gap-3">
                            {(
                              entityAllocations.summary
                                ?.allocationsByApplication ?? []
                            ).map((app) => (
                              <div
                                key={app.application}
                                className="flex items-center justify-between rounded-lg border p-3"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                                  <div>
                                    <div className="font-medium capitalize">
                                      {app.application}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      {app.allocationCount} allocation
                                      {app.allocationCount !== 1 ? 's' : ''}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium">
                                    <span className="text-green-600">
                                      {(app.totalAvailable || 0).toFixed(2)}
                                    </span>
                                    <span className="text-gray-400"> / </span>
                                    <span className="text-purple-600">
                                      {(app.totalAllocated || 0).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {(app.totalUsed || 0).toFixed(2)} used
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 text-center">
                          <div className="text-muted-foreground text-sm">
                            No application credit allocations found for this
                            entity
                          </div>
                        </div>
                      )}

                      {/* Detailed Allocations */}
                      {(entityAllocations.allocations?.length ?? 0) > 0 && (
                        <div className="mt-6">
                          <h4 className="mb-3 font-medium">
                            Detailed Allocations
                          </h4>
                          <div className="space-y-2">
                            {(entityAllocations.allocations ?? []).map(
                              (allocation) => (
                                <div
                                  key={allocation.allocationId}
                                  className="flex items-center justify-between border-b py-2 last:border-b-0"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                    <div>
                                      <div className="font-medium capitalize">
                                        {allocation.targetApplication}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        {allocation.allocationPurpose ||
                                          'No purpose specified'}{' '}
                                        •
                                        {new Date(
                                          allocation.allocatedAt
                                        ).toLocaleDateString()}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium">
                                      <span className="text-green-600">
                                        {(
                                          allocation.availableCredits || 0
                                        ).toFixed(2)}
                                      </span>
                                      <span className="text-gray-400"> / </span>
                                      <span className="text-purple-600">
                                        {(
                                          allocation.allocatedCredits || 0
                                        ).toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      {(allocation.usedCredits || 0).toFixed(2)}{' '}
                                      used
                                    </div>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-8 text-center">
                      <div className="text-muted-foreground text-sm">
                        Loading application allocations...
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {selectedEntity.stats?.transactionCount || 0}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        Transactions
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {selectedEntity.stats?.childEntityCount || 0}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        Child Entities
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {(
                          parseFloat(
                            String(selectedEntity.stats?.recentUsage || 0)
                          ) || 0
                        ).toFixed(2)}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        Recent Usage
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Allocation Dialog */}
      <Dialog
        open={showAllocationDialog}
        onOpenChange={setShowAllocationDialog}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Allocate Credits to Application</DialogTitle>
            <DialogDescription>
              Allocate credits from{' '}
              <strong>{selectedEntity?.entity.entityName}</strong> to an
              application
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Available Credits Info */}
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="text-sm text-blue-800">
                <strong>Available Credits:</strong>{' '}
                {(
                  parseFloat(
                    String(selectedEntity?.credit.availableCredits || 0)
                  ) || 0
                ).toFixed(2)}
              </div>
            </div>

            {/* Application Selection */}
            <div>
              <label className="text-sm font-medium">Target Application</label>
              <Select
                value={allocationForm.targetApplication}
                onValueChange={(value) =>
                  setAllocationForm({
                    ...allocationForm,
                    targetApplication: value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select application" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crm">
                    CRM - Customer Relationship Management
                  </SelectItem>
                  <SelectItem value="hr">HR - Human Resources</SelectItem>
                  <SelectItem value="affiliate">
                    Affiliate - Affiliate Management
                  </SelectItem>
                  <SelectItem value="system">
                    System - System Administration
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Credit Amount */}
            <div>
              <label className="text-sm font-medium">Credit Amount</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={allocationForm.creditAmount}
                onChange={(e) =>
                  setAllocationForm({
                    ...allocationForm,
                    creditAmount: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="Enter credit amount"
              />
            </div>

            {/* Allocation Purpose */}
            <div>
              <label className="text-sm font-medium">Purpose (Optional)</label>
              <Input
                value={allocationForm.allocationPurpose}
                onChange={(e) =>
                  setAllocationForm({
                    ...allocationForm,
                    allocationPurpose: e.target.value,
                  })
                }
                placeholder="e.g., Monthly quota, Project allocation"
              />
            </div>

            {/* Auto Replenish */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoReplenish"
                checked={allocationForm.autoReplenish}
                onChange={(e) =>
                  setAllocationForm({
                    ...allocationForm,
                    autoReplenish: e.target.checked,
                  })
                }
                className="rounded"
              />
              <label htmlFor="autoReplenish" className="text-sm">
                Auto-replenish when credits are low
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowAllocationDialog(false)}
              disabled={allocating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAllocateCredits}
              disabled={
                allocating ||
                !allocationForm.targetApplication ||
                !allocationForm.creditAmount
              }
            >
              {allocating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Allocating...
                </>
              ) : (
                'Allocate Credits'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
