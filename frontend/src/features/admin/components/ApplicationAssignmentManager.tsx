import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Lock,
  Edit,
  Eye,
  Users,
  Package,
  Shield,
  Coins,
  Activity,
  Grid,
  LayoutGrid,
  Search,
  Plus,
  ArrowRight,
  RefreshCw,
  Zap,
  Building2,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/theme/ThemeProvider'
import { toast } from 'sonner'
import { applicationAssignmentAPI } from '@/lib/api'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { runMutationWithFeedback } from '@/lib/mutation-feedback'

interface Application {
  appId: string
  appCode: string
  appName: string
  description?: string
  icon?: string
  baseUrl?: string
  isCore?: boolean
  sortOrder?: number
  subscriptionTier?: string
  modules?: ApplicationModule[]
}

interface Permission {
  code: string
  name: string
  description: string
}

interface ApplicationModule {
  moduleId: string
  moduleCode: string
  moduleName: string
  description?: string
  isCore: boolean
  permissions?: Permission[]
}

interface Tenant {
  tenantId: string
  companyName: string
  subdomain: string
  isActive: boolean
  createdAt: string
  assignmentCount: number
  enabledCount: number
  applications: TenantApplication[]
}

interface TenantApplication {
  id: string
  appId: string
  appCode: string
  appName: string
  isEnabled: boolean
  subscriptionTier: string
  enabledModules: string[]
  maxUsers?: number
  createdAt: string
  permissions?: string[]
  customPermissions?: Record<string, string[]>
}

interface AssignmentOverview {
  totalApplications: number
  totalAssignments: number
  tenantStats: {
    withApps: number
    withoutApps: number
  }
  applicationStats: Array<{
    appId: string
    appCode: string
    appName: string
    assignmentCount: number
    enabledCount: number
  }>
}

const ApplicationAssignmentManager: React.FC = () => {
  const queryClient = useQueryClient()
  // Main state
  const [overview, setOverview] = useState<AssignmentOverview | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantApplications, setTenantApplications] = useState<Application[]>(
    []
  )
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('tenants')
  const [matrixSearchQuery, setMatrixSearchQuery] = useState('')

  // Matrix/Assignment Config State
  const [assignmentConfig, setAssignmentConfig] = useState({
    isEnabled: true,
    subscriptionTier: 'basic',
    enabledModules: [] as string[],
    selectedPermissions: {} as Record<string, string[]>,
  })

  // Track original state for visual diff and "Commit" logic
  const [originalPermissions, setOriginalPermissions] = useState<
    Record<string, string[]>
  >({})
  const [originalModules, setOriginalModules] = useState<string[]>([])

  const { actualTheme } = useTheme()
  const isDark = actualTheme === 'dark'

  const analyzePermissionType = (permCode: string) => {
    const code = permCode.toLowerCase()
    if (
      code.includes('admin') ||
      code.includes('manage') ||
      code.includes('delete')
    ) {
      return {
        risk: 'high',
        color:
          'border-rose-100 bg-white hover:bg-rose-50/50 hover:border-rose-200 text-rose-700/70 dark:bg-slate-900 dark:border-rose-900/30 dark:text-rose-400/70',
        selectedColor:
          'bg-rose-100 border-rose-400 text-rose-900 shadow-sm ring-1 ring-rose-300 dark:bg-rose-900/60 dark:border-rose-500 dark:text-rose-100 dark:ring-rose-700',
        icon: <Lock className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />,
      }
    }
    if (
      code.includes('write') ||
      code.includes('edit') ||
      code.includes('create') ||
      code.includes('update')
    ) {
      return {
        risk: 'medium',
        color:
          'border-amber-100 bg-white hover:bg-amber-50/50 hover:border-amber-200 text-amber-700/70 dark:bg-slate-900 dark:border-amber-900/30 dark:text-amber-400/70',
        selectedColor:
          'bg-amber-100 border-amber-400 text-amber-900 shadow-sm ring-1 ring-amber-300 dark:bg-amber-900/60 dark:border-amber-500 dark:text-amber-100 dark:ring-amber-700',
        icon: (
          <Edit className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        ),
      }
    }
    return {
      risk: 'low',
      color:
        'border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400',
      selectedColor:
        'bg-emerald-100 border-emerald-400 text-emerald-900 shadow-sm ring-1 ring-emerald-300 dark:bg-emerald-900/60 dark:border-emerald-500 dark:text-emerald-100 dark:ring-emerald-700',
      icon: (
        <Eye className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      ),
    }
  }

  const getAppIcon = (appKey: string) => {
    const key = appKey.toLowerCase()
    const props = { className: 'w-5 h-5' }
    if (key.includes('crm') || key.includes('sales'))
      return <Users {...props} className="text-blue-500" />
    if (key.includes('inventory') || key.includes('product'))
      return <Package {...props} className="text-indigo-500" />
    if (key.includes('admin') || key.includes('auth'))
      return <Shield {...props} className="text-rose-500" />
    if (key.includes('hr') || key.includes('people'))
      return <Building2 {...props} className="text-emerald-500" />
    if (key.includes('billing') || key.includes('finance'))
      return <Coins {...props} className="text-amber-500" />
    if (key.includes('analytics') || key.includes('reporting'))
      return <Activity {...props} className="text-violet-500" />
    return <Grid {...props} className="text-slate-400" />
  }

  const filteredMatrixApps = useMemo(() => {
    if (!matrixSearchQuery.trim()) return tenantApplications
    const query = matrixSearchQuery.toLowerCase()
    return tenantApplications
      .map((app: Application) => {
        const appMatches =
          app.appName.toLowerCase().includes(query) ||
          app.appCode.toLowerCase().includes(query)
        const filteredModules = app.modules
          ?.map((module: ApplicationModule) => {
            const moduleMatches =
              module.moduleName.toLowerCase().includes(query) ||
              module.moduleCode.toLowerCase().includes(query)
            const filteredPermissions = module.permissions?.filter(
              (perm: Permission) =>
                perm.name.toLowerCase().includes(query) ||
                perm.code.toLowerCase().includes(query)
            )
            if (
              moduleMatches ||
              (filteredPermissions && filteredPermissions.length > 0)
            )
              return module
            return null
          })
          .filter(Boolean) as ApplicationModule[]
        if (appMatches || (filteredModules && filteredModules.length > 0))
          return app
        return null
      })
      .filter(Boolean) as Application[]
  }, [tenantApplications, matrixSearchQuery])

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true)
      const response = await applicationAssignmentAPI.getOverview()
      setOverview(response.data.data)
    } catch (error) {
      console.error('Error loading overview:', error)
      toast.error('Failed to load overview data')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTenants = useCallback(async () => {
    try {
      setLoading(true)
      const response = await applicationAssignmentAPI.getTenants({
        search: searchTerm,
        limit: 100,
      })
      setTenants(response.data.data.tenants || [])
    } catch (error) {
      console.error('Error loading tenants:', error)
      toast.error('Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }, [searchTerm])

  const loadAllAvailableApplications = useCallback(async () => {
    try {
      await applicationAssignmentAPI.getApplications({ includeModules: true })
      // Removed unused state update if allAvailableApplications is not used anymore
    } catch (error) {
      console.error('Error loading available applications:', error)
    }
  }, [])

  // Tracking ref to prevent infinite loops during tenant synchronization
  const lastLoadedTenantId = React.useRef<string | null>(null)

  const loadTenantApplications = useCallback(async (tenant: Tenant) => {
    // Only reload if it's a different tenant — tracked via ref to avoid stale closure issues
    if (lastLoadedTenantId.current === tenant.tenantId) return

    try {
      setLoading(true)
      // Fetch all master applications
      const appsResponse = await applicationAssignmentAPI.getApplications({
        includeModules: true,
      })
      const allApps = appsResponse.data.data?.applications || []
      setTenantApplications(allApps)

      // Fetch detailed assignments for this specific tenant
      const tenantAppsResponse =
        await applicationAssignmentAPI.getTenantApplications(tenant.tenantId)
      const assignedApps = tenantAppsResponse.data.data?.applications || []

      // Sync the selected tenant's applications list with the detailed data
      setSelectedTenant((prev) =>
        prev && prev.tenantId === tenant.tenantId
          ? { ...prev, applications: assignedApps }
          : prev
      )

      const perms: Record<string, string[]> = {}
      const modules: string[] = []

      assignedApps.forEach((ta: TenantApplication) => {
        const enabledModulesArray = Array.isArray(ta.enabledModules)
          ? ta.enabledModules
          : []
        enabledModulesArray.forEach((m: string) =>
          modules.push(`${ta.appId}::${m}`)
        )

        allApps.forEach((app: Application) => {
          if (app.appId === ta.appId) {
            app.modules?.forEach((mod: ApplicationModule) => {
              if (enabledModulesArray.includes(mod.moduleCode)) {
                const compositeKey = `${ta.appId}::${mod.moduleCode}`
                const moduleCustomPerms = ta.customPermissions?.[mod.moduleCode]
                if (Array.isArray(moduleCustomPerms)) {
                  perms[compositeKey] =
                    mod.permissions
                      ?.map((p: Permission) => p.code)
                      .filter((code: string) =>
                        moduleCustomPerms.includes(code)
                      ) || []
                } else {
                  perms[compositeKey] =
                    mod.permissions?.map((p: Permission) => p.code) || []
                }
              }
            })
          }
        })
      })

      setAssignmentConfig((prev) => ({
        ...prev,
        enabledModules: modules,
        selectedPermissions: perms,
      }))
      setOriginalPermissions(perms)
      setOriginalModules(modules)

      lastLoadedTenantId.current = tenant.tenantId
    } catch (error) {
      console.error('Error loading tenant applications:', error)
      toast.error('Failed to synchronize entity entitlements')
    } finally {
      setLoading(false)
    }
    // guard uses ref, no stale closure risk
  }, [])

  // Run once on mount — these callbacks have empty deps so their references never change
  useEffect(() => {
    loadOverview()
    loadAllAvailableApplications()
  }, [loadOverview, loadAllAvailableApplications])
  // Re-run only when searchTerm changes (loadTenants dep tracks it)
  useEffect(() => {
    loadTenants()
  }, [loadTenants])

  useEffect(() => {
    if (selectedTenant && activeTab === 'manage') {
      loadTenantApplications(selectedTenant)
    }
  }, [selectedTenant, activeTab, loadTenantApplications])

  const handleRemoveAssignment = async (
    assignmentId: string,
    tenantName: string,
    appName: string
  ) => {
    if (!window.confirm(`Decommission ${appName} from ${tenantName}?`)) return
    try {
      setLoading(true)
      await runMutationWithFeedback({
        scope: 'decommission-application-assignment',
        idParts: [assignmentId],
        loadingMessage: `Decommissioning ${appName}...`,
        successMessage: `${appName} decommissioned successfully`,
        errorMessage: 'Decommissioning failed',
        execute: (idempotencyKey) =>
          api.delete(`/admin/application-assignments/${assignmentId}`, {
            headers: {
              'X-Idempotency-Key': idempotencyKey,
            },
          }),
      })
      queryClient.invalidateQueries({ queryKey: ['tenantApps'] })
      queryClient.invalidateQueries({ queryKey: ['applicationAllocations'] })
      lastLoadedTenantId.current = null
      loadTenants()
      if (selectedTenant) loadTenantApplications(selectedTenant)
    } catch (error) {
      console.error('Removal error:', error)
      toast.error('Decommissioning failed')
    } finally {
      setLoading(false)
    }
  }

  const handleCommitChanges = async () => {
    if (!selectedTenant) return
    try {
      setLoading(true)

      // Identify which applications have changes in their modules or permissions
      // Uses composite keys (appId::moduleCode) to avoid cross-app contamination
      const appsWithChanges = tenantApplications.filter((app) => {
        const appModuleKeys =
          app.modules?.map((m) => `${app.appId}::${m.moduleCode}`) || []

        const hasModuleChanges = appModuleKeys.some(
          (mk) =>
            assignmentConfig.enabledModules.includes(mk) !==
            originalModules.includes(mk)
        )

        const hasPermissionChanges = appModuleKeys.some((mk) => {
          const current = assignmentConfig.selectedPermissions[mk] || []
          const original = originalPermissions[mk] || []
          return (
            current.length !== original.length ||
            current.some((p) => !original.includes(p)) ||
            original.some((p) => !current.includes(p))
          )
        })

        return hasModuleChanges || hasPermissionChanges
      })

      if (appsWithChanges.length === 0) {
        toast.info('No modifications detected in staging area')
        return
      }

      await runMutationWithFeedback({
        scope: 'commit-security-matrix',
        idParts: [selectedTenant.tenantId, appsWithChanges.length],
        loadingMessage: 'Committing security matrix...',
        successMessage: 'Security matrix serialized successfully',
        errorMessage: 'Commit protocol failed',
        execute: async (idempotencyKey) => {
          // Execute sequential commitments to ensure database integrity
          for (const app of appsWithChanges) {
            const appModuleKeys =
              app.modules?.map((m) => `${app.appId}::${m.moduleCode}`) || []
            const appEnabledModules = appModuleKeys
              .filter((mk) => assignmentConfig.enabledModules.includes(mk))
              .map((mk) => mk.split('::')[1])
            const appCustomPermissions: Record<string, string[]> = {}

            appModuleKeys.forEach((mk) => {
              if (assignmentConfig.enabledModules.includes(mk)) {
                const moduleCode = mk.split('::')[1]
                appCustomPermissions[moduleCode] =
                  assignmentConfig.selectedPermissions[mk] || []
              }
            })

            await api.post(
              '/admin/application-assignments/assign',
              {
                tenantId: selectedTenant.tenantId,
                appId: app.appId,
                enabledModules: appEnabledModules,
                customPermissions: appCustomPermissions,
                isEnabled: true,
              },
              {
                headers: {
                  'X-Idempotency-Key': `${idempotencyKey}:${app.appId}`,
                },
              }
            )
          }
          return { committed: appsWithChanges.length }
        },
      })

      setOriginalPermissions({ ...assignmentConfig.selectedPermissions })
      setOriginalModules([...assignmentConfig.enabledModules])

      queryClient.invalidateQueries({ queryKey: ['tenantApps'] })
      queryClient.invalidateQueries({ queryKey: ['applicationAllocations'] })
      lastLoadedTenantId.current = null
      await loadTenants()
      const freshTenant = tenants.find(
        (t) => t.tenantId === selectedTenant.tenantId
      )
      if (freshTenant) await loadTenantApplications(freshTenant)
    } catch (error) {
      console.error('Serialization Error:', error)
      toast.error('Commit protocol failed')
    } finally {
      setLoading(false)
    }
  }

  const handleAssignApplicationDirectly = async (app: Application) => {
    if (!selectedTenant) return
    try {
      setLoading(true)
      const defaultModules = app.modules?.map((m) => m.moduleCode) || []
      await runMutationWithFeedback({
        scope: 'assign-application-directly',
        idParts: [selectedTenant.tenantId, app.appId],
        loadingMessage: `Deploying ${app.appName}...`,
        successMessage: `Domain ${app.appName} deployed to ${selectedTenant.companyName}`,
        errorMessage: 'Deployment failed',
        execute: (idempotencyKey) =>
          api.post(
            '/admin/application-assignments/assign',
            {
              tenantId: selectedTenant.tenantId,
              appId: app.appId,
              enabledModules: defaultModules,
            },
            {
              headers: {
                'X-Idempotency-Key': idempotencyKey,
              },
            }
          ),
      })
      queryClient.invalidateQueries({ queryKey: ['tenantApps'] })
      queryClient.invalidateQueries({ queryKey: ['applicationAllocations'] })
      lastLoadedTenantId.current = null
      loadTenants()
      if (selectedTenant) loadTenantApplications(selectedTenant)
    } catch (error) {
      console.error('Deployment failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const pendingChangesCount = useMemo(() => {
    let count = 0
    Object.keys(assignmentConfig.selectedPermissions).forEach(
      (moduleCode: string) => {
        const current = assignmentConfig.selectedPermissions[moduleCode] || []
        const original = originalPermissions[moduleCode] || []
        count += current.filter((p: string) => !original.includes(p)).length
        count += original.filter((p: string) => !current.includes(p)).length
      }
    )
    const moduleDiff =
      assignmentConfig.enabledModules.filter(
        (m: string) => !originalModules.includes(m)
      ).length +
      originalModules.filter(
        (m: string) => !assignmentConfig.enabledModules.includes(m)
      ).length
    return count + moduleDiff
  }, [
    assignmentConfig.selectedPermissions,
    assignmentConfig.enabledModules,
    originalPermissions,
    originalModules,
  ])

  const hasChanges = pendingChangesCount > 0

  return (
    <div
      className={cn(
        'relative flex h-screen flex-col overflow-hidden',
        isDark ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-900'
      )}
    >
      {/* Unified Executive Header - Ultra Slim & Integrated */}
      <header
        className={cn(
          'z-50 flex h-14 flex-none items-center justify-between border-b px-6 transition-all',
          isDark
            ? 'border-slate-800 bg-slate-900/80'
            : 'border-slate-200 bg-white/90'
        )}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1B2E5A] shadow-lg shadow-blue-500/20">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-sm leading-none font-black tracking-tight text-transparent uppercase dark:from-white dark:to-slate-400">
              Security Matrix
            </h1>
          </div>

          {selectedTenant && (
            <div className="ml-4 flex items-center gap-3 border-l border-slate-200 pl-4 dark:border-slate-800">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-[10px] font-black text-blue-600 dark:bg-slate-800">
                {selectedTenant.companyName.charAt(0)}
              </div>
              <span className="max-w-[150px] truncate text-[11px] font-black tracking-widest text-slate-900 uppercase dark:text-white">
                {selectedTenant.companyName}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          <TabsList className="h-9 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
            <TabsTrigger
              onClick={() => setActiveTab('tenants')}
              value="tenants"
              className="h-7 rounded-md px-4 text-[10px] font-black tracking-widest uppercase transition-all"
            >
              <Users className="mr-2 h-3.5 w-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger
              onClick={() => setActiveTab('manage')}
              value="manage"
              disabled={!selectedTenant}
              className="h-7 rounded-md px-4 text-[10px] font-black tracking-widest uppercase transition-all"
            >
              <Shield className="mr-2 h-3.5 w-3.5" /> Matrix
            </TabsTrigger>
          </TabsList>

          <div className="h-6 w-px bg-slate-200" />

          {hasChanges ? (
            <div className="animate-in fade-in slide-in-from-right-4 flex items-center gap-3 duration-500">
              <div className="text-right">
                <div className="mb-0.5 text-[8px] leading-none font-black tracking-widest text-orange-500 uppercase">
                  Staged Changes
                </div>
                <div className="text-[10px] leading-none font-black text-slate-400 tabular-nums">
                  {pendingChangesCount} MODS
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAssignmentConfig((prev) => ({
                    ...prev,
                    selectedPermissions: { ...originalPermissions },
                    enabledModules: [...originalModules],
                  }))
                }}
                className="h-8 rounded-lg px-3 text-[9px] font-black tracking-widest text-slate-500 uppercase hover:text-rose-500"
              >
                Abort
              </Button>
              <Button
                size="sm"
                disabled={loading}
                onClick={handleCommitChanges}
                className="group/btn flex h-8 items-center gap-2 rounded-lg bg-[#1B2E5A] px-4 text-[9px] font-black tracking-widest text-white uppercase shadow-lg shadow-blue-500/20 hover:bg-[#152449]"
              >
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 group-hover/btn:animate-spin" />
                )}
                Commit Protocol
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-end">
                <span className="mb-1 text-[7px] leading-none font-black tracking-widest text-slate-400 uppercase">
                  Status
                </span>
                <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-500 uppercase">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />{' '}
                  Synchronized
                </span>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="animate-in fade-in absolute inset-x-0 top-14 bottom-0 z-[100] flex items-center justify-center bg-white/10 backdrop-blur-[2px] duration-300 dark:bg-slate-950/20">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute h-12 w-12 animate-ping rounded-full border-2 border-blue-500/20" />
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-t-blue-600" />
              </div>
              <span className="animate-pulse text-[10px] font-black tracking-[0.2em] text-blue-600 uppercase">
                Processing Protocol
              </span>
            </div>
          </div>
        )}
      </header>

      <Tabs value={activeTab} className="flex min-h-0 flex-1 flex-col">
        <TabsContent
          value="tenants"
          className="no-scrollbar m-0 flex-1 overflow-y-auto p-8 outline-none"
        >
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
            {overview && (
              <>
                <Card className="overflow-hidden rounded-[32px] border-none bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-500/20">
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-md">
                        <Users className="h-6 w-6" />
                      </div>
                      <Badge className="border-white/30 bg-white/20 font-black text-white">
                        ENTITIES
                      </Badge>
                    </div>
                    <div className="mb-1 text-4xl font-black tabular-nums">
                      {overview.totalAssignments}
                    </div>
                    <p className="text-[10px] font-bold tracking-widest text-blue-100 uppercase">
                      Active Deployments
                    </p>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden rounded-[32px] border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
                        <Building2 className="h-6 w-6 text-emerald-500" />
                      </div>
                      <Badge
                        variant="outline"
                        className="border-emerald-100 font-black text-emerald-500 uppercase"
                      >
                        CLIENTS
                      </Badge>
                    </div>
                    <div className="mb-1 text-4xl font-black tabular-nums">
                      {overview.tenantStats.withApps}
                    </div>
                    <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                      Onboarded Tenants
                    </p>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden rounded-[32px] border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="rounded-2xl bg-indigo-50 p-3 dark:bg-indigo-950/30">
                        <LayoutGrid className="h-6 w-6 text-indigo-500" />
                      </div>
                      <Badge
                        variant="outline"
                        className="border-indigo-100 font-black text-indigo-500 uppercase"
                      >
                        SOLUTIONS
                      </Badge>
                    </div>
                    <div className="mb-1 text-4xl font-black tabular-nums">
                      {overview.totalApplications}
                    </div>
                    <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                      Available Domains
                    </p>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden rounded-[32px] border-none bg-slate-900 text-white shadow-xl dark:bg-slate-800">
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="rounded-2xl bg-white/10 p-3">
                        <Zap className="h-6 w-6 text-amber-400" />
                      </div>
                    </div>
                    <div className="mb-1 flex items-center gap-2">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                      <span className="text-xs font-black tracking-widest uppercase">
                        System Operational
                      </span>
                    </div>
                    <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                      Security Subsystem Active
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <div className="mb-8 flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-tight uppercase">
                Tenant Directory
              </h2>
              <p className="mt-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Select a primary entity to manage security entitlements
              </p>
            </div>
            <div className="relative w-96">
              <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Lookup Tenant ID or Name..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearchTerm(e.target.value)
                }
                className="h-12 rounded-2xl border-slate-200 bg-white pl-12 text-sm font-bold shadow-sm placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tenants.map((tenant: Tenant) => (
              <Card
                key={tenant.tenantId}
                onClick={() => {
                  setSelectedTenant(tenant)
                  setActiveTab('manage')
                }}
                className={cn(
                  'group cursor-pointer overflow-hidden rounded-[32px] border-slate-100 bg-white transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/10 dark:border-slate-800 dark:bg-slate-900',
                  selectedTenant?.tenantId === tenant.tenantId &&
                    'border-transparent shadow-2xl ring-2 shadow-blue-500/10 ring-blue-600'
                )}
              >
                <CardContent className="p-0">
                  <div className="flex h-24 items-center justify-between bg-gradient-to-br from-slate-50 to-slate-100 p-6 dark:from-slate-800/50 dark:to-slate-900">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-white font-black text-blue-600 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                        {tenant.companyName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="mb-1 leading-none font-black tracking-tight text-[#1B2E5A] uppercase dark:text-white">
                          {tenant.companyName}
                        </h3>
                        <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                          {tenant.subdomain}.network
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        'rounded-lg font-black tracking-widest uppercase',
                        tenant.isActive
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
                          : 'border-slate-500/20 bg-slate-500/10 text-slate-600'
                      )}
                    >
                      {tenant.isActive ? 'Active' : 'Offline'}
                    </Badge>
                  </div>
                  <div className="space-y-4 p-6">
                    <div className="flex items-center justify-between text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                      <span>Security Deployments</span>
                      <span className="text-slate-900 dark:text-white">
                        {tenant.assignmentCount} Domains
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-[#1B2E5A] transition-all duration-1000"
                        style={{
                          width: `${(tenant.enabledCount / (tenant.assignmentCount || 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex -space-x-2">
                        {tenant.applications
                          ?.slice(0, 4)
                          .map((app: TenantApplication) => (
                            <div
                              key={app.id}
                              title={app.appName}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-slate-50 bg-white dark:border-slate-900 dark:bg-slate-800"
                            >
                              {getAppIcon(app.appCode)}
                            </div>
                          ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg text-xs font-black tracking-widest uppercase transition-all group-hover:bg-[#1B2E5A] group-hover:text-white"
                      >
                        Configure <ArrowRight className="ml-2 h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent
          value="manage"
          className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden outline-none data-[state=active]:flex"
        >
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-slate-950">
            {selectedTenant && (
              <div className="flex min-h-0 flex-1 flex-col">
                {/* Executive KPI Bar */}
                <div
                  className={cn(
                    'flex flex-none items-center justify-between border-b px-8 py-2 transition-all',
                    isDark
                      ? 'border-slate-800 bg-slate-900/40'
                      : 'border-slate-100 bg-slate-50/30'
                  )}
                >
                  <div className="flex items-center gap-8">
                    <div className="flex flex-col">
                      <span className="mb-1 text-[7px] leading-none font-black tracking-widest text-slate-400 uppercase">
                        Active Domains
                      </span>
                      <div className="flex items-center gap-2">
                        <Grid className="h-3 w-3 text-slate-400" />
                        <span className="text-[10px] font-black text-slate-900 tabular-nums dark:text-white">
                          {selectedTenant.assignmentCount || 0}
                        </span>
                      </div>
                    </div>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
                    <div className="flex flex-col">
                      <span className="mb-1 text-[7px] leading-none font-black tracking-widest text-slate-400 uppercase">
                        Claims Serialized
                      </span>
                      <div className="flex items-center gap-2">
                        <Shield className="h-3 w-3 text-blue-500" />
                        <span className="text-[10px] font-black text-blue-600 tabular-nums dark:text-blue-400">
                          {
                            Object.values(
                              assignmentConfig.selectedPermissions
                            ).flat().length
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="relative w-64">
                    <Search className="absolute top-1/2 left-3 h-3 w-3 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search matrix capabilities..."
                      value={matrixSearchQuery}
                      onChange={(e) => setMatrixSearchQuery(e.target.value)}
                      className="h-8 rounded-lg border-slate-200 bg-white pl-8 text-[9px] font-bold placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="custom-scrollbar relative flex-1 overflow-y-auto bg-slate-50/20 p-6 md:p-10 dark:bg-slate-950/40">
                  {filteredMatrixApps.length > 0 ? (
                    <Accordion
                      type="single"
                      collapsible
                      className="space-y-6 pb-40"
                    >
                      {filteredMatrixApps.map((app: Application) => {
                        const tenantApp = selectedTenant.applications?.find(
                          (ta: TenantApplication) => ta.appId === app.appId
                        )
                        const isAppAssigned = !!tenantApp
                        const totalAppPerms =
                          app.modules?.reduce(
                            (sum: number, m: ApplicationModule) =>
                              sum + (m.permissions?.length || 0),
                            0
                          ) || 0
                        const selectedAppPerms =
                          app.modules?.reduce(
                            (sum: number, m: ApplicationModule) =>
                              sum +
                              (assignmentConfig.selectedPermissions[
                                `${app.appId}::${m.moduleCode}`
                              ]?.length || 0),
                            0
                          ) || 0

                        return (
                          <AccordionItem
                            key={app.appCode}
                            value={app.appCode}
                            className={cn(
                              'overflow-hidden rounded-[32px] border shadow-sm transition-all',
                              isAppAssigned
                                ? 'border-blue-200/50 bg-blue-50/5 dark:border-blue-900/20 dark:bg-blue-900/5'
                                : 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900/30'
                            )}
                          >
                            <div className="flex items-center">
                              <AccordionTrigger className="group/trigger flex-1 px-8 py-6 text-left transition-all hover:bg-slate-50 hover:no-underline dark:hover:bg-slate-800/50 [&[data-state=open]]:bg-[#1B2E5A]/5">
                                <div className="flex items-center gap-6">
                                  <div
                                    className={cn(
                                      'relative flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm transition-all',
                                      isAppAssigned
                                        ? 'border-blue-500 bg-white text-white shadow-blue-500/10 dark:bg-slate-800'
                                        : 'border-slate-200 bg-white text-slate-300 dark:border-slate-700 dark:bg-slate-800'
                                    )}
                                  >
                                    {getAppIcon(app.appCode)}
                                    {isAppAssigned && (
                                      <div className="absolute -top-1 -right-1 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-blue-500 dark:border-slate-900" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-3 text-[14px] leading-none font-black tracking-tight text-[#1B2E5A] uppercase dark:text-white">
                                      {app.appName}
                                      {isAppAssigned && (
                                        <Badge className="border-blue-500/20 bg-blue-500/10 text-[8px] font-black tracking-widest text-blue-600 uppercase">
                                          Deployed
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-3 opacity-60">
                                      <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
                                        {app.modules?.length || 0} Modules
                                      </span>
                                      <div className="h-1 w-1 rounded-full bg-slate-300" />
                                      <span className="text-[10px] font-black tracking-widest text-blue-600 uppercase dark:text-blue-400">
                                        {selectedAppPerms}/{totalAppPerms}{' '}
                                        Capabilities
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <div className="flex items-center gap-4 pr-6">
                                {!isAppAssigned ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={loading}
                                    onClick={() =>
                                      handleAssignApplicationDirectly(app)
                                    }
                                    className="h-9 rounded-xl border-blue-200 px-4 text-[9px] font-black tracking-widest text-blue-600 uppercase transition-all hover:bg-[#1B2E5A] hover:text-white"
                                  >
                                    <Plus className="mr-2 h-3.5 w-3.5" /> Deploy
                                    Domain
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={loading}
                                    onClick={() =>
                                      handleRemoveAssignment(
                                        tenantApp.id,
                                        selectedTenant.companyName,
                                        app.appName
                                      )
                                    }
                                    className="h-9 rounded-xl border border-transparent px-4 text-[9px] font-black tracking-widest text-rose-500 uppercase hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
                                  >
                                    Decommission
                                  </Button>
                                )}
                              </div>
                            </div>
                            <AccordionContent className="border-t border-slate-100 bg-white p-0 dark:border-slate-800 dark:bg-slate-950/20">
                              <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {app.modules?.map(
                                  (module: ApplicationModule) => {
                                    const mk = `${app.appId}::${module.moduleCode}`
                                    const isModuleEnabled =
                                      assignmentConfig.enabledModules.includes(
                                        mk
                                      )
                                    const currentPerms =
                                      assignmentConfig.selectedPermissions[
                                        mk
                                      ] || []
                                    const originalPerms =
                                      originalPermissions[mk] || []
                                    const isAllModuleSelected =
                                      currentPerms.length ===
                                        (module.permissions?.length || 0) &&
                                      (module.permissions?.length || 0) > 0

                                    return (
                                      <div
                                        key={module.moduleCode}
                                        className={cn(
                                          'grid grid-cols-12 items-start gap-10 p-8 transition-all',
                                          isModuleEnabled
                                            ? 'bg-blue-50/[0.03] dark:bg-blue-900/[0.02]'
                                            : 'opacity-60 grayscale-[0.5] hover:bg-slate-50/50'
                                        )}
                                      >
                                        {/* Module Identity Column */}
                                        <div className="col-span-2 space-y-4 border-r border-slate-100 pt-1 pr-8 dark:border-slate-800">
                                          <div>
                                            <h4
                                              className={cn(
                                                'mb-1 text-[13px] leading-tight font-black tracking-tight uppercase',
                                                isModuleEnabled
                                                  ? 'text-[#1B2E5A] dark:text-white'
                                                  : 'text-slate-400'
                                              )}
                                            >
                                              {module.moduleName}
                                            </h4>
                                            <div className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">
                                              {module.moduleCode}
                                            </div>
                                          </div>

                                          <div className="space-y-3 pt-2">
                                            <button
                                              disabled={!isAppAssigned}
                                              onClick={() => {
                                                const allCodes =
                                                  module.permissions?.map(
                                                    (p: Permission) => p.code
                                                  ) || []
                                                setAssignmentConfig((prev) => {
                                                  const isCurrentlyEnabled =
                                                    prev.enabledModules.includes(
                                                      mk
                                                    )
                                                  let updatedModules = [
                                                    ...prev.enabledModules,
                                                  ]
                                                  const updatedPermissions = {
                                                    ...prev.selectedPermissions,
                                                  }

                                                  if (isAllModuleSelected) {
                                                    updatedModules =
                                                      updatedModules.filter(
                                                        (m: string) => m !== mk
                                                      )
                                                    updatedPermissions[mk] = []
                                                  } else {
                                                    if (!isCurrentlyEnabled) {
                                                      updatedModules.push(mk)
                                                    }
                                                    updatedPermissions[mk] =
                                                      allCodes
                                                  }

                                                  return {
                                                    ...prev,
                                                    enabledModules:
                                                      updatedModules,
                                                    selectedPermissions:
                                                      updatedPermissions,
                                                  }
                                                })
                                              }}
                                              className={cn(
                                                'w-full rounded-xl border px-3 py-2 text-center text-[8px] font-black tracking-widest uppercase shadow-sm transition-all active:scale-95 disabled:opacity-50',
                                                isAllModuleSelected
                                                  ? 'border-blue-500 bg-[#1B2E5A] text-white'
                                                  : isModuleEnabled
                                                    ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
                                                    : 'border-slate-200 bg-slate-50 text-slate-400'
                                              )}
                                            >
                                              {isAllModuleSelected
                                                ? 'FULL ACCESS'
                                                : isModuleEnabled
                                                  ? 'PARTIAL'
                                                  : 'INACTIVE'}
                                            </button>

                                            <div className="flex items-center justify-between px-1 opacity-60">
                                              <span className="text-[8px] font-black text-slate-400 uppercase">
                                                Claims
                                              </span>
                                              <span className="text-[9px] font-black text-slate-700 dark:text-slate-300">
                                                {(module.permissions?.length ||
                                                  0) * 2}{' '}
                                                Units/T
                                              </span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Capability Matrix Column - Fixed Grid Alignment */}
                                        <div className="col-span-10">
                                          <div className="grid grid-cols-6 gap-3">
                                            {module.permissions?.map(
                                              (perm: Permission) => {
                                                const isSelected =
                                                  currentPerms.includes(
                                                    perm.code
                                                  )
                                                const isOriginal =
                                                  originalPerms.includes(
                                                    perm.code
                                                  )
                                                const isDraft =
                                                  isSelected !== isOriginal
                                                const permUI =
                                                  analyzePermissionType(
                                                    perm.code
                                                  )

                                                return (
                                                  <button
                                                    key={perm.code}
                                                    disabled={!isAppAssigned}
                                                    onClick={() => {
                                                      setAssignmentConfig(
                                                        (prev) => {
                                                          const current =
                                                            prev
                                                              .selectedPermissions[
                                                              mk
                                                            ] || []
                                                          const isNowSelected =
                                                            !current.includes(
                                                              perm.code
                                                            )
                                                          const updated =
                                                            isNowSelected
                                                              ? [
                                                                  ...current,
                                                                  perm.code,
                                                                ]
                                                              : current.filter(
                                                                  (c: string) =>
                                                                    c !==
                                                                    perm.code
                                                                )

                                                          let updatedModules = [
                                                            ...prev.enabledModules,
                                                          ]

                                                          if (
                                                            isNowSelected &&
                                                            !updatedModules.includes(
                                                              mk
                                                            )
                                                          ) {
                                                            updatedModules.push(
                                                              mk
                                                            )
                                                          } else if (
                                                            !isNowSelected &&
                                                            updated.length === 0
                                                          ) {
                                                            updatedModules =
                                                              updatedModules.filter(
                                                                (m: string) =>
                                                                  m !== mk
                                                              )
                                                          }

                                                          return {
                                                            ...prev,
                                                            enabledModules:
                                                              updatedModules,
                                                            selectedPermissions:
                                                              {
                                                                ...prev.selectedPermissions,
                                                                [mk]: updated,
                                                              },
                                                          }
                                                        }
                                                      )
                                                    }}
                                                    className={cn(
                                                      'group/chip relative flex h-full flex-col gap-3 rounded-2xl border p-4 text-left transition-all select-none active:scale-95 disabled:cursor-not-allowed',
                                                      isSelected
                                                        ? permUI.risk === 'high'
                                                          ? 'border-rose-200 bg-rose-50 shadow-inner ring-1 ring-rose-200/50 dark:border-rose-900/40 dark:bg-rose-900/20'
                                                          : permUI.risk ===
                                                              'medium'
                                                            ? 'border-amber-200 bg-amber-50 shadow-inner ring-1 ring-amber-200/50 dark:border-amber-900/40 dark:bg-amber-900/20'
                                                            : 'border-blue-200 bg-blue-50 shadow-inner ring-1 ring-blue-200/50 dark:border-blue-900/40 dark:bg-blue-900/20'
                                                        : 'border-slate-100 bg-white hover:border-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800/50',
                                                      isDraft &&
                                                        'shadow-lg ring-2 shadow-orange-500/10 ring-orange-400 dark:ring-orange-500'
                                                    )}
                                                  >
                                                    <div className="flex items-start justify-between">
                                                      <div
                                                        className={cn(
                                                          'rounded-lg p-1.5 transition-colors',
                                                          isSelected
                                                            ? 'bg-white shadow-sm dark:bg-slate-950'
                                                            : 'opacity-30 group-hover/chip:opacity-60'
                                                        )}
                                                      >
                                                        {permUI.icon}
                                                      </div>
                                                      <Badge
                                                        variant="outline"
                                                        className={cn(
                                                          'h-4 border-none px-1.5 text-[7px] leading-none font-black uppercase transition-all',
                                                          isSelected
                                                            ? 'text-blue-600 dark:text-blue-400'
                                                            : 'text-slate-300'
                                                        )}
                                                      >
                                                        {isSelected
                                                          ? 'ACTIVE'
                                                          : 'READY'}
                                                      </Badge>
                                                    </div>

                                                    <div className="flex-1">
                                                      <div
                                                        className={cn(
                                                          'mb-0.5 text-[10px] leading-tight font-black tracking-tight uppercase',
                                                          isSelected
                                                            ? 'text-slate-900 dark:text-white'
                                                            : 'text-slate-400'
                                                        )}
                                                      >
                                                        {perm.name}
                                                      </div>
                                                      <div className="line-clamp-2 text-[8px] font-bold tracking-tighter text-slate-400 uppercase opacity-60">
                                                        {perm.code}
                                                      </div>
                                                    </div>

                                                    {isDraft && (
                                                      <div className="absolute top-2 right-2 h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
                                                    )}
                                                  </button>
                                                )
                                              }
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  }
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )
                      })}
                    </Accordion>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-[48px] border-2 border-dashed border-slate-200 bg-slate-50/50 py-32 dark:border-slate-800 dark:bg-slate-900/10">
                      <Search className="mb-6 h-16 w-16 text-slate-300" />
                      <h3 className="text-xl font-black tracking-tight text-[#1B2E5A] uppercase dark:text-white">
                        Deployment Not Found
                      </h3>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); }
      `,
        }}
      />
    </div>
  )
}

export default ApplicationAssignmentManager
