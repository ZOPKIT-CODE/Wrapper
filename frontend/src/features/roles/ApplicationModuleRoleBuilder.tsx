import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Building,
  Package,
  Shield,
  Check,
  AlertCircle,
  Users,
  Settings,
  Eye,
  Edit,
  Search,
  Activity,
  Database,
  Grid,
  Lock,
  Coins,
  Filter,
  Info,
  Hash,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import api from '@/lib/api'
import { useTheme } from '@/components/theme/ThemeProvider'
import { PearlButton } from '@/components/ui/pearl-button'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'
import { cn } from '@/lib/utils'

interface Application {
  appId: string
  appCode: string
  appName: string
  description: string
  subscriptionTier: string
  modules: Module[]
}

interface Module {
  moduleId: string
  moduleCode: string
  moduleName: string
  description: string
  isCore: boolean
  permissions: Permission[]
}

interface Permission {
  code: string
  name: string
  description?: string
  fullCode?: string
  creditCost?: {
    cost: number
    unit: string
    isGlobal: boolean
  }
  cost?: number
  unitMultiplier?: number
  unit?: string
}

interface RoleBuilderData {
  roleName: string
  description: string
  selectedApps: string[]
  selectedModules: Record<string, string[]>
  selectedPermissions: Record<string, string[]>
  restrictions: {
    timeRestrictions?: Record<string, unknown>
    ipRestrictions?: Record<string, unknown>
    dataRestrictions?: Record<string, unknown>
    featureRestrictions?: Record<string, unknown>
  }
}

/** Permissions can arrive as flat dotted codes or a nested app→module→codes map. */
type ExistingPermissions = string[] | Record<string, unknown>

/** Shape the builder reads off an existing/template role (all optional). */
interface InitialRole {
  roleId?: string
  roleName?: string
  name?: string
  description?: string
  permissions?: ExistingPermissions
}

interface ApplicationModuleRoleBuilderProps {
  onSave?: (role: unknown) => void
  onCancel?: () => void
  initialRole?: InitialRole
}

export function ApplicationModuleRoleBuilder({
  onSave,
  onCancel,
  initialRole,
}: ApplicationModuleRoleBuilderProps) {
  const { actualTheme } = useTheme()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [builderSearchQuery, setBuilderSearchQuery] = useState('')
  const [currentStep, setCurrentStep] = useState<1 | 2>(() =>
    initialRole?.roleName || initialRole?.name ? 2 : 1
  )

  // Role builder state
  const [roleData, setRoleData] = useState<RoleBuilderData>(() => {
    if (initialRole) {
      return {
        roleName: initialRole.roleName || initialRole.name || '',
        description: initialRole.description || '',
        selectedApps: [],
        selectedModules: {},
        selectedPermissions: {},
        restrictions: {
          timeRestrictions: {},
          ipRestrictions: {},
          dataRestrictions: {},
          featureRestrictions: {},
        },
      }
    }

    return {
      roleName: '',
      description: '',
      selectedApps: [],
      selectedModules: {},
      selectedPermissions: {},
      restrictions: {
        timeRestrictions: {},
        ipRestrictions: {},
        dataRestrictions: {},
        featureRestrictions: {},
      },
    }
  })

  // Load applications and modules from backend
  useEffect(() => {
    const loadRoleBuilderOptions = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await api.get('/custom-roles/builder-options')

        if (response.data.success) {
          const { applications: apps } = response.data.data
          setApplications(apps)

          if (initialRole) {
            const permissions = initialRole.permissions || []
            const parsedSelections = parseExistingPermissions(permissions)
            setRoleData((prev) => ({
              ...prev,
              ...parsedSelections,
            }))
          }
        } else {
          setError('Failed to load applications and modules')
        }
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: {
            data?: { code?: string; error?: string }
            status?: number
          }
          message?: string
        }
        const code = axiosErr?.response?.data?.code
        if (code === 'TENANT_APPS_NOT_PROVISIONED') {
          setError('TENANT_APPS_NOT_PROVISIONED')
        } else if (
          axiosErr?.response?.status != null &&
          axiosErr.response.status >= 500
        ) {
          setError("Couldn't reach the server. Try again.")
        } else {
          setError('Failed to load applications and modules')
        }
      } finally {
        setLoading(false)
      }
    }

    loadRoleBuilderOptions()
  }, [initialRole])

  // Parse existing role permissions into selection format
  const parseExistingPermissions = (permissions: ExistingPermissions) => {
    const selectedApps: string[] = []
    const selectedModules: Record<string, string[]> = {}
    const selectedPermissions: Record<string, string[]> = {}

    if (Array.isArray(permissions)) {
      permissions.forEach((permission) => {
        const parts = permission.split('.')
        if (parts.length >= 3) {
          const [appCode, moduleCode, permCode] = parts
          if (!selectedApps.includes(appCode)) selectedApps.push(appCode)
          if (!selectedModules[appCode]) selectedModules[appCode] = []
          if (!selectedModules[appCode].includes(moduleCode))
            selectedModules[appCode].push(moduleCode)
          const moduleKey = `${appCode}.${moduleCode}`
          if (!selectedPermissions[moduleKey])
            selectedPermissions[moduleKey] = []
          selectedPermissions[moduleKey].push(permCode)
        }
      })
    } else if (typeof permissions === 'object' && permissions !== null) {
      Object.entries(permissions).forEach(([appCode, appPermissions]) => {
        if (typeof appPermissions === 'object' && appPermissions !== null) {
          if (!selectedApps.includes(appCode)) selectedApps.push(appCode)
          Object.entries(appPermissions).forEach(
            ([moduleCode, modulePerms]) => {
              if (Array.isArray(modulePerms)) {
                if (!selectedModules[appCode]) selectedModules[appCode] = []
                if (!selectedModules[appCode].includes(moduleCode))
                  selectedModules[appCode].push(moduleCode)
                const moduleKey = `${appCode}.${moduleCode}`
                if (!selectedPermissions[moduleKey])
                  selectedPermissions[moduleKey] = []
                selectedPermissions[moduleKey] = [...modulePerms]
              }
            }
          )
        }
      })
    }
    return { selectedApps, selectedModules, selectedPermissions }
  }

  // Toggle permission selection
  const togglePermissionSelection = (
    appCode: string,
    moduleCode: string,
    permissionCode: string
  ) => {
    const moduleKey = `${appCode}.${moduleCode}`

    setRoleData((prev) => {
      const modulePermissions = prev.selectedPermissions[moduleKey] || []
      const isSelecting = !modulePermissions.includes(permissionCode)

      const newSelectedApps = [...prev.selectedApps]
      const newSelectedModules = { ...prev.selectedModules }

      if (isSelecting) {
        if (!newSelectedApps.includes(appCode)) newSelectedApps.push(appCode)
        if (!newSelectedModules[appCode]) newSelectedModules[appCode] = []
        if (!newSelectedModules[appCode].includes(moduleCode))
          newSelectedModules[appCode].push(moduleCode)
      }

      const newModulePermissions = isSelecting
        ? [...modulePermissions, permissionCode]
        : modulePermissions.filter((code) => code !== permissionCode)

      return {
        ...prev,
        selectedApps: newSelectedApps,
        selectedModules: newSelectedModules,
        selectedPermissions: {
          ...prev.selectedPermissions,
          [moduleKey]: newModulePermissions,
        },
      }
    })
  }

  // Select all permissions for a module
  const selectAllModulePermissions = (
    appCode: string,
    moduleCode: string,
    shouldSelect: boolean = true
  ) => {
    const app = applications.find((a) => a.appCode === appCode)
    const module = app?.modules.find((m) => m.moduleCode === moduleCode)

    if (module) {
      setRoleData((prev) => {
        const newSelectedPermissions = { ...prev.selectedPermissions }
        const moduleKey = `${appCode}.${moduleCode}`
        const newSelectedApps = [...prev.selectedApps]
        const newSelectedModules = { ...prev.selectedModules }

        if (shouldSelect) {
          newSelectedPermissions[moduleKey] = module.permissions.map(
            (p) => p.code
          )
          if (!newSelectedApps.includes(appCode)) newSelectedApps.push(appCode)
          if (!newSelectedModules[appCode]) newSelectedModules[appCode] = []
          if (!newSelectedModules[appCode].includes(moduleCode))
            newSelectedModules[appCode].push(moduleCode)
        } else {
          delete newSelectedPermissions[moduleKey]
          if (newSelectedModules[appCode]) {
            newSelectedModules[appCode] = newSelectedModules[appCode].filter(
              (m) => m !== moduleCode
            )
          }
        }

        return {
          ...prev,
          selectedApps: newSelectedApps,
          selectedModules: newSelectedModules,
          selectedPermissions: newSelectedPermissions,
        }
      })
    }
  }

  // Select all modules and permissions for an app
  const selectAllAppPermissions = (
    appCode: string,
    shouldSelect: boolean = true
  ) => {
    const app = applications.find((a) => a.appCode === appCode)
    if (!app) return

    setRoleData((prev) => {
      const newSelectedApps = shouldSelect
        ? prev.selectedApps.includes(appCode)
          ? prev.selectedApps
          : [...prev.selectedApps, appCode]
        : prev.selectedApps.filter((code) => code !== appCode)

      const newSelectedModules = { ...prev.selectedModules }
      const newSelectedPermissions = { ...prev.selectedPermissions }

      if (shouldSelect) {
        newSelectedModules[appCode] = app.modules.map((m) => m.moduleCode)
        app.modules.forEach((m) => {
          newSelectedPermissions[`${appCode}.${m.moduleCode}`] =
            m.permissions.map((p) => p.code)
        })
      } else {
        delete newSelectedModules[appCode]
        Object.keys(newSelectedPermissions).forEach((key) => {
          if (key.startsWith(`${appCode}.`)) delete newSelectedPermissions[key]
        })
      }

      return {
        ...prev,
        selectedApps: newSelectedApps,
        selectedModules: newSelectedModules,
        selectedPermissions: newSelectedPermissions,
      }
    })
  }

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalApps = roleData.selectedApps.length
    const totalModules = Object.values(roleData.selectedModules).reduce(
      (sum, modules) => sum + modules.length,
      0
    )
    const totalPermissions = Object.values(roleData.selectedPermissions).reduce(
      (sum, perms) => sum + perms.length,
      0
    )

    let estimatedCredits = 0
    const selectedPermDetails: Array<{
      code: string
      cost: number
      unit: string
      isGlobal: boolean
    }> = []

    roleData.selectedApps.forEach((appCode) => {
      const app = applications.find((a) => a.appCode === appCode)
      if (app) {
        const selectedModules = roleData.selectedModules[appCode] || []
        selectedModules.forEach((moduleCode) => {
          const module = app.modules.find((m) => m.moduleCode === moduleCode)
          if (module) {
            const selectedPerms =
              roleData.selectedPermissions[`${appCode}.${moduleCode}`] || []
            selectedPerms.forEach((permCode) => {
              const permission = module.permissions.find(
                (p) => p.code === permCode
              )
              if (
                typeof permission?.creditCost === 'object' &&
                permission.creditCost !== null &&
                typeof permission.cost === 'number' &&
                typeof permission.unitMultiplier === 'number' &&
                typeof permission.unit === 'string'
              ) {
                const cost = permission.cost * permission.unitMultiplier
                estimatedCredits += cost
                selectedPermDetails.push({
                  code: `${appCode}.${moduleCode}.${permCode}`,
                  cost: permission.creditCost.cost,
                  unit: permission.creditCost.unit,
                  isGlobal: permission.creditCost.isGlobal,
                })
              }
            })
          }
        })
      }
    })

    return {
      totalApps,
      totalModules,
      totalPermissions,
      estimatedCredits,
      selectedPermDetails,
    }
  }, [roleData, applications])

  // Helper function to analyze permission type/risk for styling
  const analyzePermissionType = (permCode: string) => {
    const code = permCode.toLowerCase()

    // High Risk: Admin/Delete/Manage - Soft Red Gradients
    if (
      code.includes('admin') ||
      code.includes('manage') ||
      code.includes('delete')
    ) {
      return {
        risk: 'high',
        // Unselected
        color:
          'border-rose-100 bg-white hover:bg-rose-50/50 hover:border-rose-200 text-rose-700/70 dark:bg-slate-900 dark:border-rose-900/30 dark:text-rose-400/70',
        // Selected - Light Gradient
        selectedColor:
          'bg-gradient-to-br from-rose-50 via-rose-100 to-red-100 border-rose-200 text-rose-900 shadow-sm dark:from-rose-900/40 dark:to-rose-800/20 dark:border-rose-700 dark:text-rose-100',
        icon: <Lock className="h-3.5 w-3.5" />,
      }
    }

    // Medium Risk: Write/Edit/Create - Soft Amber/Orange Gradients
    if (
      code.includes('write') ||
      code.includes('edit') ||
      code.includes('create') ||
      code.includes('update')
    ) {
      return {
        risk: 'medium',
        // Unselected
        color:
          'border-amber-100 bg-white hover:bg-amber-50/50 hover:border-amber-200 text-amber-700/70 dark:bg-slate-900 dark:border-amber-900/30 dark:text-amber-400/70',
        // Selected - Light Gradient
        selectedColor:
          'bg-gradient-to-br from-amber-50 via-orange-100 to-amber-100 border-amber-200 text-amber-900 shadow-sm dark:from-amber-900/40 dark:to-amber-800/20 dark:border-amber-700 dark:text-amber-100',
        icon: <Edit className="h-3.5 w-3.5" />,
      }
    }

    return {
      risk: 'low',
      // Unselected
      color:
        'border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400',
      // Selected - Light Gradient
      selectedColor:
        'bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 border-emerald-200 text-emerald-900 shadow-sm dark:from-emerald-900/40 dark:to-emerald-800/20 dark:border-emerald-700 dark:text-emerald-100',
      icon: <Eye className="h-3.5 w-3.5" />,
    }
  }

  const getAppIcon = (appKey: string) => {
    const key = appKey.toLowerCase()
    const props = { className: 'w-5 h-5' }
    if (key.includes('crm') || key.includes('sales'))
      return <Users {...props} className="h-5 w-5 text-blue-500" />
    if (key.includes('inventory') || key.includes('product'))
      return <Package {...props} className="h-5 w-5 text-[#1B2E5A]" />
    if (key.includes('admin') || key.includes('auth'))
      return <Shield {...props} className="h-5 w-5 text-rose-500" />
    if (key.includes('hr') || key.includes('people'))
      return <Building {...props} className="h-5 w-5 text-emerald-500" />
    if (
      key.includes('billing') ||
      key.includes('finance') ||
      key.includes('payments')
    )
      return <Coins {...props} className="h-5 w-5 text-amber-500" />
    if (key.includes('analytics') || key.includes('reporting'))
      return <Activity {...props} className="h-5 w-5 text-violet-500" />
    if (key.includes('database') || key.includes('storage'))
      return <Database {...props} className="h-5 w-5 text-[#1B2E5A]" />
    if (key.includes('settings') || key.includes('config'))
      return <Settings {...props} className="h-5 w-5 text-slate-500" />
    return <Grid {...props} className="h-5 w-5 text-slate-400" />
  }

  const filteredApps = useMemo(() => {
    if (!builderSearchQuery.trim()) return applications

    const query = builderSearchQuery.toLowerCase()
    return applications
      .map((app) => {
        const appMatches =
          app.appName.toLowerCase().includes(query) ||
          app.appCode.toLowerCase().includes(query) ||
          app.description.toLowerCase().includes(query)

        const filteredModules = app.modules
          .map((module) => {
            const moduleMatches =
              module.moduleName.toLowerCase().includes(query) ||
              module.moduleCode.toLowerCase().includes(query) ||
              module.description.toLowerCase().includes(query)

            const filteredPermissions = module.permissions.filter(
              (perm) =>
                perm.name.toLowerCase().includes(query) ||
                perm.code.toLowerCase().includes(query) ||
                perm.description?.toLowerCase().includes(query)
            )

            if (moduleMatches || filteredPermissions.length > 0) {
              return {
                ...module,
                permissions:
                  filteredPermissions.length > 0
                    ? module.permissions
                    : module.permissions,
              }
            }
            return null
          })
          .filter(Boolean) as Module[]

        if (appMatches || filteredModules.length > 0) {
          return {
            ...app,
            modules: filteredModules.length > 0 ? filteredModules : app.modules,
          }
        }
        return null
      })
      .filter(Boolean) as Application[]
  }, [applications, builderSearchQuery])

  const handleSave = async () => {
    if (!roleData.roleName.trim()) {
      toast.error('Please enter a role name')
      return
    }

    if (summary.totalPermissions === 0) {
      toast.error('Please select at least one permission')
      return
    }

    try {
      setSaving(true)
      const isEditing = initialRole?.roleId

      if (isEditing) {
        const response = await api.put(
          `/custom-roles/update-from-builder/${initialRole.roleId}`,
          {
            roleName: roleData.roleName,
            description: roleData.description,
            selectedApps: roleData.selectedApps,
            selectedModules: roleData.selectedModules,
            selectedPermissions: roleData.selectedPermissions,
            restrictions: roleData.restrictions,
          }
        )

        if (response.data.success) {
          toast.success(`Role "${roleData.roleName}" updated successfully!`)
          onSave?.(response.data.data)
        } else {
          toast.error('Failed to update role: ' + response.data.error)
        }
      } else {
        const response = await api.post('/custom-roles/create-from-builder', {
          roleName: roleData.roleName,
          description: roleData.description,
          selectedApps: roleData.selectedApps,
          selectedModules: roleData.selectedModules,
          selectedPermissions: roleData.selectedPermissions,
          restrictions: roleData.restrictions,
        })

        if (response.data.success) {
          toast.success(`Role "${roleData.roleName}" created successfully!`)
          onSave?.(response.data.data)
        } else {
          toast.error('Failed to create role: ' + response.data.error)
        }
      }
    } catch (error) {
      console.error('❌ Error saving role:', error)
      const isEditing = initialRole?.roleId
      toast.error(isEditing ? 'Failed to update role' : 'Failed to create role')
    } finally {
      setSaving(false)
    }
  }

  const isDark = actualTheme === 'dark'
  const isMono = actualTheme === 'monochrome'

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <ZopkitRoundLoader size="xl" />
          <p className="animate-pulse text-sm font-medium text-slate-500 dark:text-slate-400">
            Initializing Builder...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {error === 'TENANT_APPS_NOT_PROVISIONED' ? (
            <div className="p-8 text-center">
              <h3 className="mb-2 text-lg font-semibold">
                Applications Not Provisioned
              </h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Your workspace is missing application access. Click Sync now to
                fix.
              </p>
              <button
                onClick={async () => {
                  try {
                    await api.post('/api/admin/tenant-applications/reconcile', {
                      tenantId: undefined,
                    })
                    window.location.reload()
                  } catch {
                    /* ignore, user can retry */
                  }
                }}
                className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
              >
                Sync now
              </button>
            </div>
          ) : error?.includes('server') ? (
            <div className="p-8 text-center">
              <h3 className="mb-2 text-lg font-semibold">Connection Error</h3>
              <p className="text-muted-foreground text-sm">
                Couldn&apos;t reach the server. Try again.
              </p>
            </div>
          ) : (
            <>
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-[#1B2E5A] dark:text-white">
                Connection Error
              </h3>
              <p className="mb-6 text-slate-500 dark:text-slate-400">{error}</p>
              <PearlButton onClick={() => window.location.reload()}>
                Retry Connection
              </PearlButton>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden font-sans selection:bg-blue-500/30',
        isDark
          ? 'bg-slate-950 text-white'
          : isMono
            ? 'bg-zinc-950 text-zinc-100'
            : 'bg-slate-50 text-[#1B2E5A]'
      )}
    >
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Header Section - Fixed Height */}
      <div
        className={cn(
          'z-20 flex flex-none items-center justify-between border-b px-6 py-4 transition-all',
          isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'
        )}
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'rounded-xl border p-2.5 shadow-sm',
              isDark
                ? 'border-slate-700 bg-slate-900'
                : 'border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50'
            )}
          >
            <Shield className="h-6 w-6 text-[#1B2E5A] dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {initialRole?.roleId ? 'Edit Custom Role' : 'Role Builder'}
            </h1>
            <p className="hidden text-xs font-medium text-slate-500 sm:block dark:text-slate-400">
              {initialRole?.roleId
                ? 'Modify role permissions'
                : 'Create new role scope'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex gap-4">
            <div className="hidden text-right md:block">
              <span className="block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                Total Apps
              </span>
              <span className="block text-lg leading-none font-bold">
                {applications.length}
              </span>
            </div>
            <div className="hidden h-8 w-px bg-slate-200 md:block dark:bg-slate-800"></div>
            <div className="hidden text-right md:block">
              <span className="block text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                Est. Cost
              </span>
              <span className="block text-lg leading-none font-bold text-[#1B2E5A] dark:text-blue-400">
                {summary.estimatedCredits.toFixed(0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Step 1 only or Step 2 (Matrix) */}
      <div className="flex flex-1 overflow-hidden">
        {currentStep === 1 ? (
          /* Step 1: Role Name & Purpose - Full width centered form */
          <div className="flex flex-1 items-center justify-center overflow-y-auto p-8">
            <div
              className={cn(
                'w-full max-w-lg rounded-2xl border p-8 shadow-sm',
                isDark
                  ? 'border-slate-800 bg-slate-900/50'
                  : 'border-slate-200 bg-white'
              )}
            >
              <div className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-6 text-[#1B2E5A] dark:border-slate-800/50 dark:text-white">
                <Settings className="h-5 w-5 opacity-70" />
                <h3 className="text-xs font-black tracking-widest uppercase">
                  Step 1 — Role Name & Purpose
                </h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold tracking-widest text-slate-500 uppercase dark:text-slate-400">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    value={roleData.roleName}
                    onChange={(e) =>
                      setRoleData((prev) => ({
                        ...prev,
                        roleName: e.target.value,
                      }))
                    }
                    placeholder="e.g. HR_MANAGER, PROJECT_LEAD"
                    className={cn(
                      'w-full rounded-lg border px-4 py-3 text-sm font-medium transition-all outline-none focus:ring-2',
                      isDark
                        ? 'border-slate-800 bg-slate-900 text-white placeholder-slate-600 focus:border-blue-500'
                        : 'border-slate-200 bg-slate-50 text-[#1B2E5A] placeholder-slate-400 focus:border-blue-500 focus:bg-white'
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold tracking-widest text-slate-500 uppercase dark:text-slate-400">
                    Purpose (optional)
                  </label>
                  <textarea
                    rows={4}
                    value={roleData.description}
                    onChange={(e) =>
                      setRoleData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Brief description of this role's purpose and responsibilities..."
                    className={cn(
                      'w-full resize-none rounded-lg border px-4 py-3 text-sm font-medium transition-all outline-none focus:ring-2',
                      isDark
                        ? 'border-slate-800 bg-slate-900 text-white placeholder-slate-600 focus:border-blue-500'
                        : 'border-slate-200 bg-slate-50 text-[#1B2E5A] placeholder-slate-400 focus:border-blue-500 focus:bg-white'
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <PearlButton
                    variant="outline"
                    onClick={onCancel}
                    className="hover:text-primary text-slate-500"
                  >
                    Cancel
                  </PearlButton>
                  <PearlButton
                    variant="primary"
                    onClick={() => {
                      if (
                        !roleData.roleName.trim() ||
                        roleData.roleName.trim().length < 2
                      ) {
                        toast.error(
                          'Please enter a role name (at least 2 characters)'
                        )
                        return
                      }
                      setCurrentStep(2)
                    }}
                    disabled={
                      !roleData.roleName.trim() ||
                      roleData.roleName.trim().length < 2
                    }
                    className="min-w-[180px] gap-2"
                  >
                    Continue to Step 2
                    <ChevronRight className="h-4 w-4" />
                  </PearlButton>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Step 2: Permission Matrix - Full width (name & purpose already filled in Step 1) */
          <div
            className={cn(
              'flex min-w-0 flex-1 flex-col bg-slate-50/50 dark:bg-slate-950',
              ''
            )}
          >
            {/* Matrix Toolbar - Step 2 */}
            <div
              className={cn(
                'z-20 flex flex-none items-center justify-between gap-4 border-b p-4',
                isDark
                  ? 'border-slate-800 bg-slate-950'
                  : 'border-slate-200 bg-white'
              )}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-[#1B2E5A] dark:hover:text-blue-400 dark:hover:text-slate-400"
                  title="Edit role name and purpose"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Edit Step 1</span>
                </button>
                <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
                <div className="rounded-md bg-[#1B2E5A] p-1.5 text-white shadow-sm shadow-blue-500/30">
                  <Grid className="h-4 w-4" />
                </div>
                <span className="text-sm font-semibold text-[#1B2E5A] dark:text-slate-100">
                  Step 2 — Permission Matrix
                </span>
              </div>

              <div className="relative w-full max-w-md">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter permissions..."
                  value={builderSearchQuery}
                  onChange={(e) => setBuilderSearchQuery(e.target.value)}
                  className={cn(
                    'w-full rounded-lg border py-2 pr-4 pl-9 text-sm transition-all outline-none',
                    isDark
                      ? 'border-slate-800 bg-slate-900 text-white placeholder-slate-600 focus:border-blue-500'
                      : 'border-slate-200 bg-slate-50 text-[#1B2E5A] placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100'
                  )}
                />
              </div>
            </div>

            {/* Main Matrix Flow */}
            <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
              {filteredApps.length > 0 ? (
                <Accordion type="single" collapsible className="space-y-4">
                  {filteredApps.map((app) => {
                    const isAppSelected = roleData.selectedApps.includes(
                      app.appCode
                    )
                    const totalAppPerms = app.modules.reduce(
                      (sum, m) => sum + m.permissions.length,
                      0
                    )
                    const selectedAppPerms = app.modules.reduce(
                      (sum, m) =>
                        sum +
                        (roleData.selectedPermissions[
                          `${app.appCode}.${m.moduleCode}`
                        ]?.length || 0),
                      0
                    )
                    const isAllAppSelected =
                      selectedAppPerms === totalAppPerms && totalAppPerms > 0

                    return (
                      <AccordionItem
                        key={app.appCode}
                        value={app.appCode}
                        className={cn(
                          'overflow-hidden rounded-3xl border shadow-sm transition-all',
                          isAppSelected
                            ? 'border-blue-200 bg-blue-50/10 dark:border-blue-900/30 dark:bg-blue-900/5'
                            : 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900/30'
                        )}
                      >
                        <AccordionTrigger className="group/trigger px-6 py-5 transition-all hover:bg-slate-50 hover:no-underline dark:hover:bg-slate-800/50 [&[data-state=open]]:bg-[#1B2E5A]/5">
                          <div className="flex w-full items-center justify-between pr-6 text-left">
                            <div className="flex items-center gap-5">
                              <div
                                className={cn(
                                  'relative flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm transition-all',
                                  isAppSelected
                                    ? 'border-blue-500 bg-[#1B2E5A] text-white shadow-blue-500/20'
                                    : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-800'
                                )}
                              >
                                {getAppIcon(app.appCode)}
                                {isAppSelected && (
                                  <div className="absolute -top-1 -right-1 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-white bg-blue-500 dark:border-slate-800" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-3 text-[14px] leading-none font-black tracking-tight text-[#1B2E5A] uppercase dark:text-white">
                                  {app.appName}
                                  <Badge
                                    variant="outline"
                                    className="h-4.5 border-slate-200 px-2 text-[9px] font-black tracking-widest uppercase dark:border-slate-700"
                                  >
                                    {app.appCode}
                                  </Badge>
                                </div>
                                <div className="mt-1.5 flex items-center gap-3 opacity-60">
                                  <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
                                    {app.modules.length} Modules
                                  </span>
                                  <div className="h-1 w-1 rounded-full bg-slate-300" />
                                  <span className="text-[10px] font-black tracking-widest text-[#1B2E5A] uppercase dark:text-blue-400">
                                    {selectedAppPerms}/{totalAppPerms}{' '}
                                    ACQUISITIONS
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-6">
                              <div className="flex flex-col items-end gap-1.5 pt-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    selectAllAppPermissions(
                                      app.appCode,
                                      !isAllAppSelected
                                    )
                                  }}
                                  className={cn(
                                    'rounded-xl border px-4 py-1.5 text-[9px] font-black tracking-widest uppercase transition-all',
                                    isAllAppSelected
                                      ? 'border-blue-500 bg-[#1B2E5A] text-white shadow-lg shadow-blue-500/10'
                                      : 'border-slate-200 bg-white text-slate-500 hover:border-blue-400 hover:text-[#1B2E5A] dark:border-slate-700 dark:bg-slate-800'
                                  )}
                                >
                                  {isAllAppSelected
                                    ? 'All Domains Active'
                                    : 'Sync Full Domain'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="border-t border-slate-100 bg-white p-0 dark:border-slate-800 dark:bg-slate-950/20">
                          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {app.modules.map((module) => {
                              const moduleKey = `${app.appCode}.${module.moduleCode}`
                              const selectedPerms =
                                roleData.selectedPermissions[moduleKey] || []
                              const isAllModuleSelected =
                                selectedPerms.length ===
                                  module.permissions.length &&
                                module.permissions.length > 0
                              const isModuleActive = selectedPerms.length > 0

                              return (
                                <div
                                  key={module.moduleCode}
                                  className={cn(
                                    'grid grid-cols-12 items-start gap-6 p-6 transition-all',
                                    isModuleActive
                                      ? 'bg-blue-50/20 dark:bg-blue-900/5'
                                      : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                                  )}
                                >
                                  {/* Module Identity Column - narrower to give more width to permissions */}
                                  <div className="col-span-1 min-w-0 space-y-4 border-r border-slate-100 pt-1 pr-4 xl:col-span-2 xl:pr-6 dark:border-slate-800">
                                    <div>
                                      <h4
                                        className={cn(
                                          'mb-1 text-[12px] leading-4 font-black tracking-tight uppercase',
                                          isModuleActive
                                            ? 'text-[#1B2E5A] dark:text-blue-400'
                                            : 'text-[#1B2E5A] dark:text-slate-200'
                                        )}
                                      >
                                        {module.moduleName}
                                      </h4>
                                      <div className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">
                                        {module.moduleCode}
                                      </div>
                                    </div>

                                    <div className="space-y-3 pt-3">
                                      <button
                                        onClick={() =>
                                          selectAllModulePermissions(
                                            app.appCode,
                                            module.moduleCode,
                                            !isAllModuleSelected
                                          )
                                        }
                                        className={cn(
                                          'w-full rounded-lg border px-3 py-1.5 text-center text-[8px] font-black tracking-widest uppercase transition-all',
                                          isAllModuleSelected
                                            ? 'border-blue-500 bg-[#1B2E5A] text-white'
                                            : isModuleActive
                                              ? 'border-blue-200 bg-blue-50 text-[#1B2E5A]'
                                              : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-white'
                                        )}
                                      >
                                        {isAllModuleSelected
                                          ? 'FULL SYNC'
                                          : isModuleActive
                                            ? 'PARTIAL'
                                            : 'NOT ACTIVE'}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Capability Matrix Grid - wider area for permissions */}
                                  <div className="col-span-11 min-w-0 xl:col-span-10">
                                    <TooltipProvider delayDuration={300}>
                                      <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8">
                                        {module.permissions.map((perm) => {
                                          const isPermSelected =
                                            selectedPerms.includes(perm.code)
                                          const { icon, risk } =
                                            analyzePermissionType(perm.code)
                                          const tooltipText =
                                            [perm.name, perm.description]
                                              .filter(Boolean)
                                              .join(' — ') ||
                                            perm.code ||
                                            'Permission'

                                          return (
                                            <Tooltip key={perm.code}>
                                              <TooltipTrigger asChild>
                                                <button
                                                  onClick={() =>
                                                    togglePermissionSelection(
                                                      app.appCode,
                                                      module.moduleCode,
                                                      perm.code
                                                    )
                                                  }
                                                  className={cn(
                                                    'group/chip relative flex h-full flex-col gap-2 rounded-2xl border p-3 text-left transition-all select-none hover:shadow-xl',
                                                    isPermSelected
                                                      ? risk === 'high'
                                                        ? 'border-rose-200 bg-rose-50 shadow-inner shadow-rose-500/5 dark:border-rose-800 dark:bg-rose-900/20'
                                                        : risk === 'medium'
                                                          ? 'border-amber-200 bg-amber-50 shadow-inner shadow-amber-500/5 dark:border-amber-800 dark:bg-amber-900/20'
                                                          : 'border-blue-200 bg-blue-50 shadow-inner shadow-blue-500/5 dark:border-blue-800 dark:bg-blue-900/20'
                                                      : 'border-slate-100 bg-white shadow-sm hover:border-blue-200 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-blue-800/50'
                                                  )}
                                                >
                                                  <div className="flex items-start justify-between">
                                                    <div
                                                      className={cn(
                                                        'rounded-lg p-1',
                                                        isPermSelected
                                                          ? 'bg-white/50 dark:bg-slate-950/50'
                                                          : 'opacity-40'
                                                      )}
                                                    >
                                                      {icon}
                                                    </div>
                                                    <Badge
                                                      variant="outline"
                                                      className={cn(
                                                        'h-3.5 border-none px-1 text-[7px] leading-none font-black uppercase',
                                                        isPermSelected
                                                          ? 'text-[#1B2E5A]'
                                                          : 'text-slate-300'
                                                      )}
                                                    >
                                                      {isPermSelected
                                                        ? 'ACTIVE'
                                                        : 'READY'}
                                                    </Badge>
                                                  </div>

                                                  <div className="min-w-0 flex-1">
                                                    <div
                                                      className={cn(
                                                        'mb-0.5 line-clamp-2 text-[10px] leading-tight font-black tracking-tight break-words uppercase',
                                                        isPermSelected
                                                          ? 'text-[#1B2E5A] dark:text-white'
                                                          : 'text-slate-500'
                                                      )}
                                                    >
                                                      {perm.name}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[8px] font-bold tracking-tighter text-slate-400 uppercase">
                                                      <Hash className="h-2 w-2" />{' '}
                                                      {perm.code}
                                                    </div>
                                                  </div>

                                                  {isPermSelected && (
                                                    <div className="absolute top-2 right-2 h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                                                  )}
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent
                                                side="top"
                                                className="max-w-xs border-blue-500 bg-[#1B2E5A] text-xs text-white"
                                              >
                                                {tooltipText}
                                              </TooltipContent>
                                            </Tooltip>
                                          )
                                        })}
                                      </div>
                                    </TooltipProvider>
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
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-12 text-center opacity-60">
                  <Filter className="mb-6 h-16 w-16 text-slate-200 dark:text-slate-800" />
                  <h4 className="text-xl font-black tracking-widest text-[#1B2E5A] uppercase dark:text-white">
                    No Architecture Detected
                  </h4>
                  <p className="mt-2 text-sm font-bold tracking-widest text-slate-400 uppercase opacity-60">
                    Synchronize search query to re-initialize matrix
                  </p>
                </div>
              )}
            </div>

            {/* Footer Action Bar - Fixed at bottom of matrix */}
            <div
              className={cn(
                'z-20 flex flex-none items-center justify-between gap-4 border-t p-4',
                isDark
                  ? 'border-slate-800 bg-slate-950'
                  : 'border-slate-200 bg-white'
              )}
            >
              <div className="flex items-center gap-4 text-sm">
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors',
                    summary.totalPermissions > 0
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                  )}
                >
                  {summary.totalPermissions > 0 ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Info className="h-3.5 w-3.5" />
                  )}
                  <span className="text-xs font-semibold tracking-wide uppercase">
                    {summary.totalPermissions > 0
                      ? 'Ready to Save'
                      : 'Selection Incomplete'}
                  </span>
                </div>
                {summary.totalPermissions > 0 && (
                  <span className="hidden text-slate-500 sm:inline">
                    <strong className="text-[#1B2E5A] dark:text-white">
                      {summary.totalPermissions}
                    </strong>{' '}
                    permissions selected
                  </span>
                )}
              </div>

              <div className="flex gap-3">
                <PearlButton
                  variant="outline"
                  onClick={onCancel}
                  className="text-slate-500 hover:text-[#1B2E5A] dark:text-slate-400 dark:hover:text-white"
                >
                  Cancel
                </PearlButton>
                <PearlButton
                  variant="primary"
                  onClick={handleSave}
                  disabled={
                    saving ||
                    !roleData.roleName.trim() ||
                    summary.totalPermissions === 0
                  }
                  className="min-w-[140px] shadow-lg shadow-blue-500/20"
                >
                  {saving
                    ? 'Processing...'
                    : initialRole?.roleId
                      ? 'Update Role'
                      : 'Create Role'}
                </PearlButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
