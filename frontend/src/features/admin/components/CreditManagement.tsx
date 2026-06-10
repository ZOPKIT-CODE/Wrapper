import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
  Building2,
  Search,
  Coins,
  Activity,
  RotateCcw,
  LayoutGrid,
  Eye,
  Lock,
  Edit,
  Package,
  Hash,
  Database,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/theme/ThemeProvider'
import { api } from '@/lib/api'
import {
  operationCostAPI,
  creditConfigurationAPI,
  applicationAssignmentAPI,
} from '@/lib/api'
import { runMutationWithFeedback } from '@/lib/mutation-feedback'
import {
  Application,
  OperationCost,
  Tenant,
  CostChanges,
  ChangeImpact,
} from './credit-configuration/types'
import {
  WarningModal,
  ComparisonModal,
} from './credit-configuration/components'

// Shape of a per-tenant operation cost override returned by getTenantConfigurations.
interface TenantOperationOverride {
  operationCode: string
  creditCost: number
}

interface TenantConfigurations {
  configurations?: {
    operations?: TenantOperationOverride[]
  }
}

const CreditManagement: React.FC = () => {
  // Core State
  const [operationCosts, setOperationCosts] = useState<OperationCost[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [allAvailableApplications, setAllAvailableApplications] = useState<
    Application[]
  >([])
  const [loading, setLoading] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [tenantConfigurations, setTenantConfigurations] =
    useState<TenantConfigurations | null>(null)

  // UI State
  const [searchTerm, setSearchTerm] = useState('')
  const [matrixSearchQuery, setMatrixSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('global')
  const { actualTheme } = useTheme()
  const isDark = actualTheme === 'dark'
  /** Glassmorphism backdrop on the matrix panel (CompactMatrix) */
  const glass = true

  // Changes State
  const [costChanges, setCostChanges] = useState<CostChanges>({})

  // Modals State
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [showComparisonModal, setShowComparisonModal] = useState(false)
  const [changeImpact, setChangeImpact] = useState<ChangeImpact | null>(null)

  // Computed Stats
  const changeCount = useMemo(() => {
    return Object.values(costChanges).reduce((total, appChanges) => {
      let count = 0
      if (appChanges.operationCosts)
        count += Object.keys(appChanges.operationCosts).length
      if (appChanges.moduleCosts)
        count += Object.keys(appChanges.moduleCosts).length
      if (appChanges.appCost !== undefined) count += 1
      return total + count
    }, 0)
  }, [costChanges])

  // Helper: Analyze permission type
  const analyzePermissionType = (permCode: string) => {
    const code = permCode.toLowerCase()
    if (
      code.includes('admin') ||
      code.includes('manage') ||
      code.includes('delete')
    ) {
      return {
        risk: 'high',
        icon: <Lock className="h-3 w-3 text-rose-600 dark:text-rose-400" />,
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
        icon: <Edit className="h-3 w-3 text-amber-600 dark:text-amber-400" />,
      }
    }
    return {
      risk: 'low',
      icon: <Eye className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />,
    }
  }

  const getAppIcon = (appKey: string) => {
    const key = appKey.toLowerCase()
    const props = { className: 'w-4 h-4' }
    if (key.includes('crm'))
      return <Activity {...props} className="text-blue-500" />
    if (key.includes('hr'))
      return <Building2 {...props} className="text-emerald-500" />
    if (key.includes('finance'))
      return <Coins {...props} className="text-amber-500" />
    return <Package {...props} className="text-slate-400" />
  }

  // Data Loading
  const loadInitialData = useCallback(async (manageLoadingState = true) => {
    if (manageLoadingState) setLoading(true)
    try {
      const [opsRes, tenantsRes, appsRes] = await Promise.all([
        operationCostAPI.getGlobalOperationCosts({ includeUsage: true }),
        applicationAssignmentAPI.getTenants(),
        applicationAssignmentAPI.getApplications({ includeModules: true }),
      ])
      setOperationCosts(opsRes.data?.data?.operations || [])
      setTenants(tenantsRes.data.data.tenants || [])
      setAllAvailableApplications(appsRes.data.data.applications || [])
    } catch (error) {
      toast.error('Failed to load initial data')
    } finally {
      if (manageLoadingState) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  const loadTenantConfigurations = useCallback(
    async (tenantId: string, manageLoadingState = true) => {
      try {
        if (manageLoadingState) setLoading(true)
        const response =
          await creditConfigurationAPI.getTenantConfigurations(tenantId)
        setTenantConfigurations(response.data)
      } catch (error) {
        toast.error('Failed to load tenant configurations')
      } finally {
        if (manageLoadingState) setLoading(false)
      }
    },
    []
  )

  // Filter Logic
  const filteredTenants = useMemo(() => {
    return tenants.filter(
      (t) =>
        t.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.subdomain.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [tenants, searchTerm])

  const filteredApps = useMemo(() => {
    const appsSource =
      activeTab === 'tenants' && selectedTenant
        ? allAvailableApplications.filter((app) =>
            selectedTenant.applications?.some((ta) => ta.appId === app.appId)
          )
        : allAvailableApplications
    if (!matrixSearchQuery.trim()) return appsSource
    const query = matrixSearchQuery.toLowerCase()
    return appsSource
      .map((app) => {
        const appMatches =
          app.appName.toLowerCase().includes(query) ||
          app.appCode.toLowerCase().includes(query)
        const filteredModules = app.modules?.filter(
          (m) =>
            m.moduleName.toLowerCase().includes(query) ||
            m.moduleCode.toLowerCase().includes(query) ||
            m.permissions?.some(
              (p) =>
                p.name.toLowerCase().includes(query) ||
                p.code.toLowerCase().includes(query)
            )
        )
        return appMatches || (filteredModules && filteredModules.length > 0)
          ? { ...app, modules: filteredModules }
          : null
      })
      .filter(Boolean) as Application[]
  }, [allAvailableApplications, matrixSearchQuery, activeTab, selectedTenant])

  // Status Helpers
  const getPermissionStatus = (
    appCode: string,
    moduleCode: string,
    permCode: string
  ) => {
    const opCode = `${appCode}.${moduleCode}.${permCode}`
    let existingCost = 0
    let source: 'global' | 'tenant' | 'none' = 'none'
    if (activeTab === 'tenants' && tenantConfigurations) {
      const override = tenantConfigurations.configurations?.operations?.find(
        (op) => op.operationCode === opCode
      )
      if (override) {
        existingCost = override.creditCost
        source = 'tenant'
      } else {
        const globalDefault = operationCosts.find(
          (op) => op.operationCode === opCode
        )
        if (globalDefault) {
          existingCost = globalDefault.creditCost
          source = 'global'
        }
      }
    } else {
      const globalDefault = operationCosts.find(
        (op) => op.operationCode === opCode
      )
      if (globalDefault) {
        existingCost = globalDefault.creditCost
        source = 'global'
      }
    }
    const pendingCost = costChanges[appCode]?.operationCosts?.[opCode]
    const isChanged = pendingCost !== undefined
    return {
      existingCost,
      pendingCost: isChanged ? pendingCost : existingCost,
      isChanged,
      source,
    }
  }

  const getModuleStats = (appCode: string, moduleCode: string) => {
    const prefix = `${appCode}.${moduleCode}.`
    let total = 0,
      count = 0
    if (activeTab === 'tenants' && tenantConfigurations) {
      tenantConfigurations.configurations?.operations?.forEach((op) => {
        if (op.operationCode.startsWith(prefix)) {
          total += op.creditCost
          count++
        }
      })
    }
    operationCosts.forEach((op) => {
      if (op.operationCode.startsWith(prefix)) {
        const hasOverride =
          activeTab === 'tenants' &&
          tenantConfigurations?.configurations?.operations?.some(
            (c) => c.operationCode === op.operationCode
          )
        if (!hasOverride) {
          total += op.creditCost
          count++
        }
      }
    })
    return {
      avg: count > 0 ? (total / count).toFixed(1) : '0',
      total,
      count,
      pending: costChanges[appCode]?.moduleCosts?.[moduleCode],
    }
  }

  const getAppStats = (appCode: string) => {
    const appOps = operationCosts.filter(
      (op) => op.category === appCode.toUpperCase()
    )
    const total = appOps.reduce((sum, op) => sum + op.creditCost, 0)
    return {
      total,
      count: appOps.length,
      pending: costChanges[appCode]?.appCost,
    }
  }

  // Handlers
  const handlePermissionChange = (
    appCode: string,
    opCode: string,
    val: string
  ) => {
    const cost = parseFloat(val) || 0
    setCostChanges((prev) => ({
      ...prev,
      [appCode]: {
        ...prev[appCode],
        operationCosts: { ...prev[appCode]?.operationCosts, [opCode]: cost },
      },
    }))
  }

  const handleModuleChange = (
    appCode: string,
    modCode: string,
    val: string
  ) => {
    const cost = parseFloat(val) || 0
    setCostChanges((prev) => ({
      ...prev,
      [appCode]: {
        ...prev[appCode],
        moduleCosts: { ...prev[appCode]?.moduleCosts, [modCode]: cost },
      },
    }))
  }

  const handleAppChange = (appCode: string, val: string) => {
    const cost = parseFloat(val) || 0
    setCostChanges((prev) => ({
      ...prev,
      [appCode]: { ...prev[appCode], appCost: cost },
    }))
  }

  const handleSave = () => {
    if (Object.keys(costChanges).length === 0) return
    setChangeImpact({
      affectedOperations: changeCount,
      affectedTenants: activeTab === 'global' ? tenants.length : 1,
      estimatedImpact: `Syncing ${changeCount} cost changes.`,
    })
    setShowComparisonModal(true)
  }

  const handleConfirmChanges = async () => {
    // Prevent double-submit if a save is already in progress
    if (loading) return
    try {
      setLoading(true)
      await runMutationWithFeedback({
        scope: 'credit-config-save',
        idParts: [
          activeTab,
          selectedTenant?.tenantId,
          Object.keys(costChanges).length,
        ],
        loadingMessage: 'Saving configuration...',
        successMessage: 'Configuration saved',
        errorMessage: 'Save failed',
        execute: async (idempotencyKey) => {
          const savePromises = []
          const pendingUpdates = new Map<string, number>()

          for (const [appCode, appChanges] of Object.entries(costChanges)) {
            const app = allAvailableApplications.find(
              (a) => a.appCode === appCode
            )
            if (!app) continue
            app.modules?.forEach((mod) => {
              mod.permissions?.forEach((perm) => {
                const opCode = `${appCode}.${mod.moduleCode}.${perm.code}`
                let cost: number | null = null
                if (appChanges.operationCosts?.[opCode] !== undefined)
                  cost = appChanges.operationCosts[opCode]
                else if (appChanges.moduleCosts?.[mod.moduleCode] !== undefined)
                  cost = appChanges.moduleCosts[mod.moduleCode]
                else if (appChanges.appCost !== undefined)
                  cost = appChanges.appCost
                if (cost !== null) pendingUpdates.set(opCode, cost)
              })
            })
          }

          for (const [opCode, cost] of pendingUpdates.entries()) {
            const appCode = opCode.split('.')[0]
            if (activeTab === 'global') {
              savePromises.push(
                api.post(
                  '/admin/operation-costs',
                  {
                    operationCode: opCode,
                    operationName: opCode.split('.').pop() || '',
                    creditCost: cost,
                    unit: 'operation',
                    unitMultiplier: 1,
                    category: appCode.toUpperCase(),
                    isActive: true,
                    priority: 100,
                  },
                  {
                    headers: {
                      'X-Idempotency-Key': `${idempotencyKey}:${opCode}`,
                    },
                  }
                )
              )
            } else if (selectedTenant) {
              savePromises.push(
                api.put(
                  `/admin/credit-configurations/${selectedTenant.tenantId}/operation/${opCode}`,
                  {
                    creditCost: cost,
                    unit: 'operation',
                    unitMultiplier: 1,
                    scope: 'tenant',
                    isActive: true,
                  },
                  {
                    headers: {
                      'X-Idempotency-Key': `${idempotencyKey}:${opCode}`,
                    },
                  }
                )
              )
            }
          }

          await Promise.all(savePromises)
          return { saved: savePromises.length }
        },
      })

      setCostChanges({})
      setShowWarningModal(false)
      // Pass false so the inner functions don't fight over the loading state;
      // the outer finally block owns the single loading=false at the end.
      await loadInitialData(false)
      if (selectedTenant)
        await loadTenantConfigurations(selectedTenant.tenantId, false)
    } catch (error) {
      // Toast is handled by mutation helper.
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative w-full space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 flex items-center justify-center rounded-xl p-2.5 shadow-inner">
          <Coins className="text-primary h-6 w-6" />
        </div>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
            Credit Console{' '}
            <Badge
              variant="outline"
              className="border-primary/20 py-0 text-[9px] font-bold uppercase"
            >
              {activeTab}
            </Badge>
          </h1>
          <p className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase opacity-60">
            High-Density Matrix Management
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid h-10 w-full grid-cols-2 bg-slate-100 p-1 dark:bg-slate-900">
          <TabsTrigger
            value="global"
            className="flex items-center gap-2 text-[11px] font-black uppercase data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800"
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Global Standards
          </TabsTrigger>
          <TabsTrigger
            value="tenants"
            className="flex items-center gap-2 text-[11px] font-black uppercase data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800"
          >
            <Building2 className="h-3.5 w-3.5" /> Tenant Overrides
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="m-0 space-y-4">
          <CompactMatrix
            apps={filteredApps}
            activeTab="global"
            loading={loading}
            isDark={isDark}
            glass={glass}
            matrixSearchQuery={matrixSearchQuery}
            setMatrixSearchQuery={setMatrixSearchQuery}
            getPermissionStatus={getPermissionStatus}
            getModuleStats={getModuleStats}
            getAppStats={getAppStats}
            handlePermissionChange={handlePermissionChange}
            handleModuleChange={handleModuleChange}
            handleAppChange={handleAppChange}
            getAppIcon={getAppIcon}
            analyzePermissionType={analyzePermissionType}
            changeCount={changeCount}
            onSave={handleSave}
            onDiscard={() => setCostChanges({})}
            onPreview={() => setShowComparisonModal(true)}
          />
        </TabsContent>

        <TabsContent value="tenants" className="m-0 pt-2">
          <div className="flex h-[750px] items-start gap-6">
            {/* Sidebar: Ultra-Compact Tenant Selector */}
            <div className="w-[200px] flex-none">
              <Card className="flex h-full flex-col overflow-hidden rounded-3xl border-slate-200 bg-slate-50/50 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                <CardHeader className="border-b bg-white p-3 dark:bg-slate-950">
                  <div className="relative">
                    <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Filter..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-8 border-none bg-slate-50 pl-8 text-[10px] font-black shadow-inner dark:bg-slate-900"
                    />
                  </div>
                </CardHeader>
                <CardContent className="custom-scrollbar flex-1 overflow-y-auto p-2">
                  {filteredTenants.map((t) => (
                    <button
                      key={t.tenantId}
                      onClick={() => {
                        setSelectedTenant(t)
                        loadTenantConfigurations(t.tenantId)
                      }}
                      className={cn(
                        'group relative mb-1 w-full rounded-2xl px-3 py-2.5 text-left transition-all',
                        selectedTenant?.tenantId === t.tenantId
                          ? 'bg-primary shadow-primary/20 scale-[1.02] text-white shadow-lg'
                          : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800'
                      )}
                    >
                      <p className="truncate text-[10px] leading-tight font-black tracking-tight uppercase">
                        {t.companyName}
                      </p>
                      <p
                        className={cn(
                          'mt-0.5 text-[7px] font-black tracking-widest uppercase',
                          selectedTenant?.tenantId === t.tenantId
                            ? 'text-white/60'
                            : 'text-slate-400 opacity-60'
                        )}
                      >
                        {t.subdomain}
                      </p>
                      {selectedTenant?.tenantId === t.tenantId && (
                        <div className="absolute top-1/2 right-3 h-3 w-1 -translate-y-1/2 rounded-full bg-white/40" />
                      )}
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Matrix: High-Expansion Panel */}
            <div className="h-full min-w-0 flex-1">
              {selectedTenant ? (
                <CompactMatrix
                  apps={filteredApps}
                  activeTab="tenants"
                  loading={loading}
                  isDark={isDark}
                  glass={glass}
                  matrixSearchQuery={matrixSearchQuery}
                  setMatrixSearchQuery={setMatrixSearchQuery}
                  getPermissionStatus={getPermissionStatus}
                  getModuleStats={getModuleStats}
                  getAppStats={getAppStats}
                  handlePermissionChange={handlePermissionChange}
                  handleModuleChange={handleModuleChange}
                  handleAppChange={handleAppChange}
                  getAppIcon={getAppIcon}
                  analyzePermissionType={analyzePermissionType}
                  tenantName={selectedTenant.companyName}
                  changeCount={changeCount}
                  onSave={handleSave}
                  onDiscard={() => setCostChanges({})}
                />
              ) : (
                <div className="flex h-full items-center justify-center rounded-[40px] border-2 border-dashed border-slate-200 bg-slate-50/20 dark:border-slate-800 dark:bg-slate-900/20">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-slate-100 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-800">
                      <Building2 className="text-primary/40 h-8 w-8" />
                    </div>
                    <h3 className="text-[12px] font-black tracking-[0.2em] text-slate-800 uppercase dark:text-slate-200">
                      Select Infrastructure
                    </h3>
                    <p className="mt-2 text-[9px] font-bold tracking-widest text-slate-400 uppercase opacity-60">
                      Tenant isolation protocol pending
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <WarningModal
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        onConfirm={handleConfirmChanges}
        changeImpact={changeImpact}
      />
      <ComparisonModal
        isOpen={showComparisonModal}
        onClose={() => setShowComparisonModal(false)}
        onProceed={() => {
          setShowComparisonModal(false)
          setShowWarningModal(true)
        }}
        costChanges={costChanges}
        applications={allAvailableApplications}
        globalOperationCosts={operationCosts}
        mode={activeTab as 'global' | 'tenant'}
        tenantCount={tenants.length}
        tenantName={selectedTenant?.companyName}
      />
    </div>
  )
}

interface PermissionStatus {
  existingCost: number
  pendingCost: number
  isChanged: boolean
  source: 'global' | 'tenant' | 'none'
}

interface ModuleStats {
  avg: string
  total: number
  count: number
  pending?: number
}

interface AppStats {
  total: number
  count: number
  pending?: number
}

interface CompactMatrixProps {
  apps: Application[]
  activeTab: string
  loading: boolean
  isDark: boolean
  glass: boolean
  matrixSearchQuery: string
  setMatrixSearchQuery: (value: string) => void
  getPermissionStatus: (
    appCode: string,
    moduleCode: string,
    permCode: string
  ) => PermissionStatus
  getModuleStats: (appCode: string, moduleCode: string) => ModuleStats
  getAppStats: (appCode: string) => AppStats
  handlePermissionChange: (appCode: string, opCode: string, val: string) => void
  handleModuleChange: (appCode: string, modCode: string, val: string) => void
  handleAppChange: (appCode: string, val: string) => void
  getAppIcon: (appKey: string) => React.ReactNode
  analyzePermissionType: (permCode: string) => {
    risk: string
    icon: React.ReactNode
  }
  tenantName?: string
  changeCount: number
  onSave: () => void
  onDiscard: () => void
  onPreview?: () => void
}

const CompactMatrix = ({
  apps,
  activeTab,
  loading,
  isDark,
  glass,
  matrixSearchQuery,
  setMatrixSearchQuery,
  getPermissionStatus,
  getModuleStats,
  getAppStats,
  handlePermissionChange,
  handleModuleChange,
  handleAppChange,
  getAppIcon,
  analyzePermissionType,
  tenantName,
  changeCount,
  onSave,
  onDiscard,
}: CompactMatrixProps) => {
  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-3xl border bg-white shadow-2xl transition-all dark:bg-slate-950',
        isDark ? 'border-slate-800' : 'border-slate-200',
        glass && 'backdrop-blur-xl'
      )}
    >
      {/* Top Loader */}
      <div
        className={cn(
          'absolute top-0 right-0 left-0 z-50 h-0.5 overflow-hidden transition-opacity',
          loading ? 'opacity-100' : 'opacity-0'
        )}
      >
        <div className="bg-primary/20 h-full w-full">
          <div className="bg-primary animate-progress-indeterminate h-full" />
        </div>
      </div>

      {/* Header Toolbar */}
      <div
        className={cn(
          'flex items-center justify-between gap-4 border-b p-4',
          isDark ? 'bg-slate-950/90' : 'bg-slate-50/90'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg shadow-inner">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-[14px] font-black tracking-tight text-[#1B2E5A] dark:text-slate-100">
              {activeTab === 'global'
                ? 'System Infrastructure'
                : `${tenantName}`}
            </h2>
            <div className="flex items-center gap-2 opacity-60">
              <span className="text-[9px] font-black text-slate-500 uppercase">
                Architecture Matrix
              </span>
              <div className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="text-primary text-[9px] font-black uppercase">
                {apps.length} Apps Active
              </span>
            </div>
          </div>
        </div>

        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search matrix..."
            value={matrixSearchQuery}
            onChange={(e) => setMatrixSearchQuery(e.target.value)}
            className={cn(
              'w-full rounded-xl border py-2 pr-3 pl-9 text-[11px] font-black transition-all outline-none',
              isDark
                ? 'focus:border-primary border-slate-800 bg-slate-900'
                : 'focus:border-primary border-slate-200 bg-white'
            )}
          />
        </div>

        {/* Change Indicator (Integrated) */}
        {changeCount > 0 && (
          <div className="flex items-center gap-2 border-l pl-4">
            <button
              onClick={onSave}
              className="hover:bg-primary/5 group flex items-center gap-2 rounded-xl px-2 py-1 transition-all"
              title="Audit detailed changes"
            >
              <Badge className="bg-primary bg-primary h-6 animate-pulse cursor-pointer border-none px-2 text-[9px] font-black text-white uppercase">
                {changeCount} Modifications
              </Badge>
              <span className="text-primary text-[10px] font-black uppercase opacity-0 transition-opacity group-hover:opacity-100">
                Audit Details
              </span>
            </button>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 rounded-lg p-0 text-rose-500 hover:bg-rose-500/10"
                onClick={onDiscard}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                className="shadow-primary/20 h-7 px-3 text-[9px] font-black uppercase shadow-lg"
                onClick={onSave}
              >
                Commit Changes
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Accordion Flow */}
      <div className="custom-scrollbar max-h-[700px] overflow-y-auto p-3">
        <Accordion type="single" collapsible className="space-y-2">
          {apps.map((app) => {
            const appStats = getAppStats(app.appCode)
            const isAppChanged = appStats.pending !== undefined

            return (
              <AccordionItem
                key={app.appCode}
                value={app.appCode}
                className={cn(
                  'overflow-hidden rounded-2xl border transition-all',
                  isAppChanged
                    ? 'border-orange-200 bg-orange-50/10 dark:border-orange-900/30 dark:bg-orange-900/5'
                    : 'bg-slate-50/30 dark:bg-slate-900/30'
                )}
              >
                <AccordionTrigger className="[&[data-state=open]]:bg-primary/5 active:bg-primary/10 px-5 py-4 transition-all hover:bg-slate-100 hover:no-underline dark:hover:bg-slate-800">
                  <div className="flex w-full items-center justify-between pr-4 text-left">
                    <div className="flex items-center gap-4">
                      <div className="relative rounded-xl border bg-white p-2 shadow-sm dark:bg-slate-800">
                        {getAppIcon(app.appCode)}
                        {isAppChanged && (
                          <div className="absolute -top-1 -right-1 h-2 w-2 animate-pulse rounded-full border-2 border-white bg-orange-500 dark:border-slate-800" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-[13px] leading-none font-black text-[#1B2E5A] uppercase dark:text-white">
                          {app.appName}
                          <Badge
                            variant="outline"
                            className="h-4 border-slate-300 px-1.5 text-[8px] font-bold dark:border-slate-700"
                          >
                            {app.appCode}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                            {app.modules?.length} Systems
                          </span>
                          <div className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="text-primary/60 text-[9px] font-black tracking-wider uppercase">
                            Avg:{' '}
                            {(appStats.total / (appStats.count || 1)).toFixed(
                              1
                            )}{' '}
                            CR
                          </span>
                          {isAppChanged && (
                            <span className="flex animate-pulse items-center gap-1 text-[8px] font-black text-orange-600 uppercase dark:text-orange-400">
                              <AlertCircle className="h-2.5 w-2.5" /> Save to
                              Commit
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-6"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700" />
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-3">
                          <p className="text-right text-[9px] leading-none font-black text-slate-400 uppercase">
                            Batch Domain
                            <br />
                            Override
                          </p>
                          <div className="relative w-24">
                            <Input
                              type="number"
                              step="0.5"
                              className={cn(
                                'focus:ring-primary h-8 bg-white pr-6 pl-2 text-[11px] font-black focus:ring-1 dark:bg-slate-950',
                                isAppChanged
                                  ? 'border-orange-300 dark:border-orange-800'
                                  : 'border-slate-200'
                              )}
                              value={appStats.pending || ''}
                              onChange={(e) =>
                                handleAppChange(app.appCode, e.target.value)
                              }
                              placeholder="0.0"
                            />
                            <Edit className="text-primary absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 opacity-30" />
                          </div>
                          <Badge className="bg-primary/10 text-primary h-5 border-none text-[8px]">
                            APP
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="border-t bg-white p-0 dark:bg-slate-950">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {app.modules?.map((module) => {
                      const stats = getModuleStats(
                        app.appCode,
                        module.moduleCode
                      )
                      const isModuleChanged = stats.pending !== undefined

                      return (
                        <div
                          key={module.moduleCode}
                          className={cn(
                            'grid grid-cols-12 items-start gap-6 p-4 transition-colors',
                            isModuleChanged
                              ? 'bg-orange-50/5 dark:bg-orange-900/5'
                              : 'hover:bg-slate-50/50 dark:hover:bg-slate-900/50'
                          )}
                        >
                          {/* Module Column */}
                          <div className="col-span-2 space-y-4 border-r pr-4">
                            <div>
                              <div className="text-[12px] font-black tracking-tight text-blue-600 uppercase dark:text-blue-400">
                                {module.moduleName}
                              </div>
                              <div className="text-[9px] font-bold text-slate-400 uppercase">
                                {module.moduleCode}
                              </div>
                            </div>
                            <div className="space-y-2 border-t pt-2">
                              <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase">
                                <span>Current Avg</span>
                                <span className="text-slate-900 dark:text-white">
                                  {stats.avg} CR
                                </span>
                              </div>
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="0.5"
                                  className={cn(
                                    'h-7 bg-slate-50/50 pr-7 pl-2 text-[10px] font-black dark:bg-slate-900/50',
                                    isModuleChanged
                                      ? 'border-orange-300 dark:border-orange-800'
                                      : 'border-slate-200'
                                  )}
                                  value={stats.pending || ''}
                                  onChange={(e) =>
                                    handleModuleChange(
                                      app.appCode,
                                      module.moduleCode,
                                      e.target.value
                                    )
                                  }
                                  placeholder="0.0"
                                />
                                <Package className="absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 text-blue-400 opacity-30" />
                              </div>
                              {isModuleChanged && (
                                <div className="flex animate-pulse items-center gap-1 text-[8px] font-black text-orange-600 uppercase dark:text-orange-400">
                                  <AlertCircle className="h-2.5 w-2.5" /> Save
                                  to Commit
                                </div>
                              )}
                              <Badge className="h-4 w-fit border-none bg-blue-50 text-[8px] font-black text-blue-600 uppercase dark:bg-blue-900/30 dark:text-blue-400">
                                Sync Module
                              </Badge>
                            </div>
                          </div>

                          {/* Permissions Chip Grid (Fixed 6-Column Layout) */}
                          <div className="col-span-10">
                            <div className="grid w-full grid-cols-6 gap-2">
                              {module.permissions?.map((p) => {
                                const s = getPermissionStatus(
                                  app.appCode,
                                  module.moduleCode,
                                  p.code
                                )
                                const { icon } = analyzePermissionType(p.code)
                                return (
                                  <div
                                    key={p.code}
                                    className={cn(
                                      'group/chip relative flex h-full flex-col gap-1.5 rounded-xl border p-2 transition-all hover:shadow-lg',
                                      s.isChanged
                                        ? 'border-orange-300 bg-orange-50/50 shadow-orange-500/5 dark:border-orange-800 dark:bg-orange-900/20'
                                        : s.source === 'tenant'
                                          ? 'border-blue-300 bg-blue-50/50 shadow-blue-500/5 dark:border-blue-800 dark:bg-blue-900/20'
                                          : 'border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950'
                                    )}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="opacity-60">{icon}</div>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          'h-3.5 px-1 text-[7px] leading-none font-black',
                                          s.isChanged
                                            ? 'border-orange-200 text-orange-600'
                                            : 'border-slate-200 text-slate-400'
                                        )}
                                      >
                                        {s.isChanged
                                          ? 'PENDING'
                                          : s.source.toUpperCase()}
                                      </Badge>
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div
                                        className="truncate text-[9.5px] leading-tight font-black text-slate-900 uppercase dark:text-slate-100"
                                        title={p.name}
                                      >
                                        {p.name}
                                      </div>
                                      <div className="mt-0.5 flex items-center gap-1 text-[8px] font-bold tracking-tighter text-slate-400 uppercase">
                                        <Hash className="h-2 w-2" /> {p.code}
                                      </div>
                                    </div>

                                    <div className="relative mt-auto border-t border-slate-50 pt-2 dark:border-slate-900">
                                      <input
                                        className={cn(
                                          'h-7 w-full rounded-lg border bg-slate-100/30 px-2 text-right text-[11px] font-black transition-all outline-none dark:bg-slate-900/30',
                                          s.isChanged
                                            ? 'border-orange-200 focus:ring-1 focus:ring-orange-400'
                                            : 'focus:ring-primary border-transparent focus:ring-1'
                                        )}
                                        type="number"
                                        step="0.1"
                                        value={s.pendingCost}
                                        onChange={(e) =>
                                          handlePermissionChange(
                                            app.appCode,
                                            `${app.appCode}.${module.moduleCode}.${p.code}`,
                                            e.target.value
                                          )
                                        }
                                      />
                                      <span className="absolute top-[13px] left-2 text-[8px] font-black text-slate-300">
                                        CR
                                      </span>
                                      {s.isChanged && (
                                        <div className="absolute -top-1 -right-1 h-2 w-2 animate-pulse rounded-full border-2 border-white bg-orange-500 dark:border-slate-900" />
                                      )}
                                    </div>

                                    <div className="mt-1 flex items-center justify-between text-[7.5px] font-bold text-slate-400 uppercase opacity-60">
                                      <span>Current: {s.existingCost}</span>
                                      {s.isChanged && (
                                        <span className="animate-pulse text-orange-500">
                                          Save
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>
    </div>
  )
}

export { CreditManagement }
