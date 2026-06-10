import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
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
  Loader2,
  Search,
  Users,
  Building2,
  CreditCard,
  Eye,
  Power,
  PowerOff,
  Download,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import axios from 'axios'
import { api } from '@/lib/api'
import { runMutationWithFeedback } from '@/lib/mutation-feedback'

interface Tenant {
  tenantId: string
  companyName: string
  subdomain: string
  adminEmail: string
  isActive: boolean
  isVerified: boolean
  trialEndsAt: string | null
  createdAt: string
  userCount: number
  entityCount: number
  totalCredits: number
  reservedCredits: number
  lastActivity: string | null
}

export const TenantManagement: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [mutatingTenantId, setMutatingTenantId] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchTenants = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const response = await api.get('/admin/tenants/comprehensive', {
        params: {
          search: searchTerm,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          page: pagination.page,
          limit: pagination.limit,
        },
        signal,
      })

      if (response.data.success) {
        setTenants(response.data.data.tenants)
        setPagination(response.data.data.pagination)
      }
    } catch (error) {
      // Ignore aborted requests (user typed again before previous completed)
      const name = error instanceof Error ? error.name : undefined
      const code = axios.isAxiosError(error) ? error.code : undefined
      if (name === 'AbortError' || code === 'ERR_CANCELED') return
      console.error('Failed to fetch tenants:', error)
      toast.error('Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)

    // Debounce search input; fire immediately for filter/page changes
    const delay = searchTerm ? 300 : 0
    searchDebounceRef.current = setTimeout(() => {
      fetchTenants(controller.signal)
    }, delay)

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
      controller.abort()
    }
  }, [searchTerm, statusFilter, pagination.page]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewDetails = async (tenant: Tenant) => {
    try {
      // Fetch tenant details, entity hierarchy, and recent credit activity in parallel
      const [detailsResponse] = await Promise.all([
        api.get(`/admin/tenants/${tenant.tenantId}/details`),
        api.get(`/admin/entities/hierarchy/${tenant.tenantId}`),
        api.get('/admin/credits/transactions', {
          params: {
            tenantId: tenant.tenantId,
            limit: 10,
          },
        }),
      ])

      if (detailsResponse.data.success) {
        // Navigate to tenant details page
        navigate({ to: `/company-admin/tenants/${tenant.tenantId}` })
      }
    } catch (error) {
      console.error('Failed to fetch tenant details:', error)
      toast.error('Failed to load tenant details')
    }
  }

  const handleToggleStatus = async (tenant: Tenant) => {
    if (mutatingTenantId === tenant.tenantId) return
    setMutatingTenantId(tenant.tenantId)
    try {
      const response = await runMutationWithFeedback({
        scope: 'admin-tenant-status',
        idParts: [
          tenant.tenantId,
          !tenant.isActive ? 'activate' : 'deactivate',
        ],
        loadingMessage: `${!tenant.isActive ? 'Activating' : 'Deactivating'} tenant...`,
        successMessage: `Tenant ${!tenant.isActive ? 'activated' : 'deactivated'} successfully`,
        errorMessage: 'Failed to update tenant status',
        execute: (idempotencyKey) =>
          api.patch(
            `/admin/tenants/${tenant.tenantId}/status`,
            {
              isActive: !tenant.isActive,
              reason: 'Admin action',
            },
            {
              headers: {
                'X-Idempotency-Key': idempotencyKey,
              },
            }
          ),
      })

      if (response.data.success) {
        queryClient.invalidateQueries({ queryKey: ['tenant'] })
        fetchTenants()
      }
    } catch (error) {
      console.error('Failed to toggle tenant status:', error)
    } finally {
      setMutatingTenantId(null)
    }
  }

  const handleDebugCredits = async (tenantId: string) => {
    try {
      const response = await api.get(`/admin/tenants/${tenantId}/credit-debug`)
      if (response.data.success) {
        toast.success('Credit debug information logged to console')
      }
    } catch (error) {
      console.error('Failed to debug credits:', error)
      toast.error('Failed to debug credits')
    }
  }

  const handleCleanOrphanedCredits = async (tenantId: string) => {
    if (
      !confirm(
        'This will permanently delete orphaned credit records. Are you sure?'
      )
    ) {
      return
    }

    if (mutatingTenantId === tenantId) return
    setMutatingTenantId(tenantId)
    try {
      const response = await runMutationWithFeedback({
        scope: 'admin-clean-orphaned-credits',
        idParts: [tenantId],
        loadingMessage: 'Cleaning orphaned credits...',
        successMessage: null,
        errorMessage: 'Failed to clean orphaned credits',
        execute: (idempotencyKey) =>
          api.post(
            `/admin/tenants/${tenantId}/clean-orphaned-credits`,
            {},
            {
              headers: {
                'X-Idempotency-Key': idempotencyKey,
              },
            }
          ),
      })
      if (response.data.success) {
        toast.success(response.data.message)
        queryClient.invalidateQueries({ queryKey: ['tenant'] })
        queryClient.invalidateQueries({ queryKey: ['creditStatus'] })
        fetchTenants()
      }
    } catch (error) {
      console.error('Failed to clean orphaned credits:', error)
    } finally {
      setMutatingTenantId(null)
    }
  }

  const handleExportTenant = async (tenant: Tenant) => {
    try {
      const response = await api.get(
        `/admin/tenants/${tenant.tenantId}/export`,
        {
          responseType: 'blob',
        }
      )

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `tenant-${tenant.tenantId}-export.json`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success('Tenant data exported successfully')
    } catch (error) {
      console.error('Failed to export tenant:', error)
      toast.error('Failed to export tenant data')
    }
  }

  const getStatusBadge = (tenant: Tenant) => {
    if (!tenant.isActive) {
      return <Badge variant="secondary">Inactive</Badge>
    }

    if (tenant.trialEndsAt && new Date(tenant.trialEndsAt) > new Date()) {
      return <Badge variant="outline">Trial</Badge>
    }

    if (tenant.trialEndsAt && new Date(tenant.trialEndsAt) < new Date()) {
      return <Badge variant="default">Paid</Badge>
    }

    return <Badge variant="default">Active</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-0 bg-gradient-to-br from-[#11254d] via-[#1B2E5A] to-[#0f1f40] text-white shadow-xl">
        <CardHeader>
          <CardTitle>Tenant Management</CardTitle>
          <CardDescription className="text-blue-100/80">
            Manage all tenants and their configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-blue-200/70" />
                <Input
                  placeholder="Search tenants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-white/20 bg-white/10 pl-10 text-white placeholder:text-blue-100/60"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 border-white/20 bg-white/10 text-white">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{pagination.total}</div>
              <div className="text-sm text-blue-100/80">Total Tenants</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {tenants.filter((t) => t.isActive).length}
              </div>
              <div className="text-sm text-blue-100/80">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {
                  tenants.filter(
                    (t) => t.trialEndsAt && new Date(t.trialEndsAt) > new Date()
                  ).length
                }
              </div>
              <div className="text-sm text-blue-100/80">On Trial</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {tenants
                  .reduce((sum, t) => {
                    const credits =
                      typeof t.totalCredits === 'number'
                        ? t.totalCredits
                        : parseFloat(t.totalCredits || 0)
                    return sum + credits
                  }, 0)
                  .toFixed(2)}
              </div>
              <div className="text-sm text-blue-100/80">Total Credits</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tenants Table */}
      <Card className="border-[#1B2E5A]/20 shadow-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading tenants...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Subdomain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Entities</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.tenantId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{tenant.companyName}</div>
                        <div className="text-muted-foreground text-sm">
                          {tenant.adminEmail}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{tenant.subdomain}</TableCell>
                    <TableCell>{getStatusBadge(tenant)}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Users className="text-muted-foreground mr-1 h-4 w-4" />
                        {tenant.userCount}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Building2 className="text-muted-foreground mr-1 h-4 w-4" />
                        {tenant.entityCount}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <CreditCard className="text-muted-foreground mr-1 h-4 w-4" />
                        <span
                          className={
                            (Number(tenant.totalCredits) || 0) < 100
                              ? 'text-red-600'
                              : ''
                          }
                        >
                          {(Number(tenant.totalCredits) || 0).toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(tenant)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(tenant)}
                          disabled={mutatingTenantId === tenant.tenantId}
                        >
                          {mutatingTenantId === tenant.tenantId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : tenant.isActive ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportTenant(tenant)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDebugCredits(tenant.tenantId)}
                          title="Debug Credit Discrepancies"
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleCleanOrphanedCredits(tenant.tenantId)
                          }
                          disabled={mutatingTenantId === tenant.tenantId}
                          title="Clean Orphaned Credits"
                        >
                          {mutatingTenantId === tenant.tenantId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
    </div>
  )
}
