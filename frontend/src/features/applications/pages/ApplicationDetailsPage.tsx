import type { JSX } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui'
import { Application, Module, Permission } from '@/types/application'
import { getApplicationIcon } from '@/features/applications/components/applicationUtils'
import { cn } from '@/lib/utils'
import {
  DASHBOARD_PAGE_DESCRIPTION_CLASS,
  DASHBOARD_PAGE_TITLE_CLASS,
} from '@/components/dashboard/DashboardPageHeader'
import {
  Crown,
  CheckCircle,
  XCircle,
  ExternalLink,
  Lock,
  Edit,
  Eye,
  Hash,
  Settings,
  Play,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Container } from '@/components/common/Page'
import { Button } from '@/components/ui/button'
import { useApplications } from '@/hooks/useApplications'
import AnimatedLoader from '@/components/common/feedback/AnimatedLoader'
import { AlertCircle } from 'lucide-react'
import { useBreadcrumbLabel } from '@/contexts/BreadcrumbLabelContext'
import { useEffect } from 'react'
import { config } from '@/lib/config'

export function ApplicationDetailsPage() {
  const { appId } = useParams({ strict: false })
  const navigate = useNavigate()
  const { applications, isLoading } = useApplications()
  const { setLastSegmentLabel } = useBreadcrumbLabel()

  // Find application by appId
  const application =
    applications.find((app: Application) => app.appId === appId) || null

  // Set breadcrumb label when application is loaded, clear on unmount
  useEffect(() => {
    if (application?.appName) {
      setLastSegmentLabel(application.appName)
    } else if (application?.appCode) {
      setLastSegmentLabel(application.appCode)
    }

    return () => {
      setLastSegmentLabel(null)
    }
  }, [application?.appName, application?.appCode, setLastSegmentLabel])

  if (isLoading) {
    return (
      <Container>
        <div className="flex min-h-[400px] items-center justify-center">
          <AnimatedLoader size="md" />
        </div>
      </Container>
    )
  }

  if (!application) {
    return (
      <Container>
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
          <AlertCircle className="h-12 w-12 text-gray-400" />
          <h2 className="text-xl font-semibold">Application Not Found</h2>
          <p className="text-gray-600">
            The application you're looking for doesn't exist or has been
            removed.
          </p>
          <Button
            onClick={() => navigate({ to: '/dashboard/applications' })}
            variant="outline"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Applications
          </Button>
        </div>
      </Container>
    )
  }

  const {
    appName,
    appCode,
    description,
    subscriptionTier,
    isEnabled,
    modules,
    enabledModules,
    enabledModulesPermissions,
    customPermissions,
    baseUrl,
  } = application

  const getApplicationUrl = (): string => {
    if (baseUrl) return baseUrl
    const baseDomain = window.location.origin
    const urlPatterns: Record<string, string> = {
      affiliateConnect: `${baseDomain}/affiliate`,
      crm: config.CRM_DOMAIN,
      hr: `${baseDomain}/hr`,
    }
    return urlPatterns[appCode] || `${baseDomain}/apps/${appCode}`
  }

  const applicationUrl = getApplicationUrl()

  const getMetricCardClasses = () => {
    return 'bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm'
  }

  const getIconContainerClasses = () => {
    return 'p-3 bg-slate-100 dark:bg-slate-700 rounded-lg'
  }

  return (
    <Container>
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/dashboard/applications' })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Applications
          </Button>
        </div>

        {/* Header Section */}
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl',
            'border border-slate-200 bg-slate-50 px-8 py-6 dark:border-slate-700 dark:bg-slate-800'
          )}
        >
          <div className="relative flex items-center gap-4">
            <div className="relative">
              <div
                className={cn(
                  'rounded-xl p-4',
                  'bg-slate-100 dark:bg-slate-700'
                )}
              >
                <div
                  className={cn(
                    'text-2xl',
                    'text-slate-600 dark:text-slate-400'
                  )}
                >
                  {getApplicationIcon(appCode)}
                </div>
              </div>
            </div>

            <div className="flex-1">
              <div className="mb-2 flex items-center gap-3">
                <h1
                  className={cn(DASHBOARD_PAGE_TITLE_CLASS, 'drop-shadow-sm')}
                >
                  {appName || 'Unknown Application'}
                </h1>
                <div
                  className={cn(
                    'relative rounded-full px-3 py-1 text-xs font-semibold',
                    `border ${
                      isEnabled
                        ? 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'border-red-300 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`
                  )}
                >
                  <span className="relative">
                    {isEnabled ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <p
                className={cn(
                  DASHBOARD_PAGE_DESCRIPTION_CLASS,
                  'max-w-2xl text-sm leading-relaxed'
                )}
              >
                {description ||
                  'No description available for this application.'}
              </p>
            </div>
          </div>
        </div>

        {/* Application settings */}
        <div
          className={cn(
            'relative flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between',
            'border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80'
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'rounded-xl p-2.5',
                'bg-slate-200/80 dark:bg-slate-700'
              )}
            >
              <Settings className="h-6 w-6 text-slate-700 dark:text-slate-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#1B2E5A] dark:text-white">
                Application settings
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Launch the app or open in a new tab
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                window.location.href = applicationUrl
              }}
              className="bg-primary hover:bg-primary/90 gap-2"
            >
              <Play className="h-4 w-4" />
              Open application
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                window.open(applicationUrl, '_blank', 'noopener,noreferrer')
              }
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open in new tab
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className={cn('relative space-y-10', 'p-8')}>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Application Code Card */}
            <div className={getMetricCardClasses()}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium tracking-wide text-slate-600 uppercase dark:text-slate-400">
                    Application Code
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[#1B2E5A] dark:text-white">
                    {appCode}
                  </p>
                </div>
                <div className="relative">
                  <div className={getIconContainerClasses()}>
                    <span className="font-mono text-sm text-slate-800 dark:text-slate-200">
                      {appCode.substring(0, 3)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription Plan Card */}
            <div className={getMetricCardClasses()}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium tracking-wide text-slate-600 uppercase dark:text-slate-400">
                    Subscription Plan
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[#1B2E5A] dark:text-white">
                    {typeof subscriptionTier === 'object'
                      ? 'Enterprise'
                      : subscriptionTier || 'Basic'}
                  </p>
                </div>
                <div className="relative">
                  <div className={getIconContainerClasses()}>
                    <Crown className="h-6 w-6 text-purple-700 dark:text-purple-300" />
                  </div>
                </div>
              </div>
            </div>

            {/* Access URL Card */}
            {baseUrl && (
              <div className={getMetricCardClasses()}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium tracking-wide text-slate-600 uppercase dark:text-slate-400">
                      Access URL
                    </p>
                    <a
                      href={baseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block truncate text-lg font-medium text-cyan-600 transition-colors hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
                      title={baseUrl}
                    >
                      {new URL(baseUrl).hostname}
                    </a>
                  </div>
                  <div className="relative ml-4">
                    <div className={getIconContainerClasses()}>
                      <ExternalLink className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Application Modules */}
          {(() => {
            const moduleList = Array.isArray(modules) ? modules : []
            return (
              moduleList.length > 0 && (
                <div className="relative">
                  <div className="pt-8">
                    <div className="mb-8 flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-[#1B2E5A] dark:text-white">
                          Application Modules
                        </h2>
                        <p className="mt-2 text-slate-600 dark:text-slate-400">
                          Feature capabilities and system integrations
                        </p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                          </div>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            Enabled
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <XCircle className="h-5 w-5 text-slate-400" />
                          </div>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            Disabled
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {moduleList.map((module, index) => (
                        <ModuleCard
                          key={`${module.moduleId ?? module.moduleCode}-${index}`}
                          module={module}
                          isEnabled={
                            Array.isArray(enabledModules) &&
                            enabledModules.includes(module.moduleCode)
                          }
                          modulePermissions={
                            enabledModulesPermissions?.[module.moduleCode] || []
                          }
                          customPermissions={
                            customPermissions?.[module.moduleCode] || []
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )
            )
          })()}
        </div>
      </div>
    </Container>
  )
}

// Role-builder style: analyze permission type for icon and risk styling
function analyzePermissionType(permCode: string): {
  risk: 'high' | 'medium' | 'low'
  icon: JSX.Element
} {
  const code = permCode.toLowerCase()
  if (
    code.includes('admin') ||
    code.includes('manage') ||
    code.includes('delete')
  ) {
    return { risk: 'high', icon: <Lock className="h-3.5 w-3.5" /> }
  }
  if (
    code.includes('write') ||
    code.includes('edit') ||
    code.includes('create') ||
    code.includes('update')
  ) {
    return { risk: 'medium', icon: <Edit className="h-3.5 w-3.5" /> }
  }
  return { risk: 'low', icon: <Eye className="h-3.5 w-3.5" /> }
}

// Module Card Component - permissions displayed like Role Builder
interface ModuleCardProps {
  module: Module
  isEnabled: boolean
  modulePermissions: string[]
  customPermissions: string[]
}

function ModuleCard({
  module,
  isEnabled,
  modulePermissions,
  customPermissions,
}: ModuleCardProps) {
  const { moduleName, description, isCore, permissions } = module

  const permissionCodes = Array.isArray(modulePermissions)
    ? modulePermissions
        .map((p: string | Permission) =>
          (typeof p === 'string' ? p : (p?.code ?? p?.name ?? '')).toString()
        )
        .filter(Boolean)
    : []
  const customCodes = Array.isArray(customPermissions) ? customPermissions : []

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-4 flex items-center gap-3">
              <div className="relative">
                <div
                  className={`h-4 w-4 rounded-full shadow-lg ${isEnabled ? 'bg-emerald-400' : 'bg-slate-400'}`}
                />
              </div>
              <h4 className="text-lg font-semibold text-[#1B2E5A] dark:text-white">
                {moduleName || 'Unknown Module'}
              </h4>
            </div>

            <div className="mb-4 flex items-center gap-3">
              <Badge
                variant={isCore ? 'default' : 'outline'}
                className={cn(
                  'text-xs backdrop-blur-sm',
                  isCore
                    ? 'border-slate-400/50 bg-slate-900/20 text-slate-800 dark:bg-slate-700/50 dark:text-slate-300'
                    : 'border-slate-400/50 bg-white/20 text-slate-700 dark:bg-slate-800/20 dark:text-slate-400'
                )}
              >
                {isCore ? 'Core Module' : 'Optional Module'}
              </Badge>
              {isEnabled && (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-600 backdrop-blur-sm dark:text-emerald-400">
                  Active
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {description || 'No description available for this module.'}
        </p>

        {/* Permissions - Role Builder style grid */}
        {permissions && permissions.length > 0 && (
          <div className="relative pt-4">
            <div className="mb-4 flex items-center justify-between">
              <h5 className="text-sm font-medium text-[#1B2E5A] dark:text-white">
                Permissions
              </h5>
              <div className="rounded-full border border-white/40 bg-white/60 px-3 py-1 text-xs text-slate-700 shadow-sm backdrop-blur-md dark:border-white/30 dark:bg-white/20 dark:text-slate-300">
                {permissions.length} total
              </div>
            </div>
            <TooltipProvider delayDuration={300}>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {permissions.map(
                  (permission: string | Permission, index: number) => {
                    const code =
                      typeof permission === 'string'
                        ? permission
                        : (permission.code ?? permission.name ?? 'unknown')
                    const name =
                      typeof permission === 'object' && permission?.name
                        ? permission.name
                        : code
                    const desc =
                      typeof permission === 'object'
                        ? (permission as { description?: string })?.description
                        : undefined
                    const isActive =
                      isEnabled &&
                      (permissionCodes.includes(code) ||
                        customCodes.includes(code))
                    const { icon, risk } = analyzePermissionType(code)
                    const tooltipText =
                      [name, desc].filter(Boolean).join(' — ') || code

                    return (
                      <Tooltip key={`${code}-${index}`}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'relative flex cursor-default flex-col gap-2 rounded-2xl border p-3 text-left transition-all select-none',
                              isActive
                                ? risk === 'high'
                                  ? 'border-rose-200 bg-rose-50 shadow-inner shadow-rose-500/5 dark:border-rose-800 dark:bg-rose-900/20'
                                  : risk === 'medium'
                                    ? 'border-amber-200 bg-amber-50 shadow-inner shadow-amber-500/5 dark:border-amber-800 dark:bg-amber-900/20'
                                    : 'border-blue-200 bg-blue-50 shadow-inner shadow-blue-500/5 dark:border-blue-800 dark:bg-blue-900/20'
                                : 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900/40'
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div
                                className={cn(
                                  'rounded-lg p-1',
                                  isActive
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
                                  isActive
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-slate-300 dark:text-slate-600'
                                )}
                              >
                                {isActive ? 'ACTIVE' : 'READY'}
                              </Badge>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div
                                className={cn(
                                  'mb-0.5 line-clamp-2 text-[10px] leading-tight font-black tracking-tight break-words uppercase',
                                  isActive
                                    ? 'text-slate-900 dark:text-white'
                                    : 'text-slate-500 dark:text-slate-400'
                                )}
                              >
                                {name}
                              </div>
                              <div className="flex items-center gap-1 text-[8px] font-bold tracking-tighter text-slate-400 uppercase">
                                <Hash className="h-2 w-2" /> {code}
                              </div>
                            </div>
                            {isActive && (
                              <div className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-blue-500" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-xs border-slate-700 bg-slate-900 text-xs text-white"
                        >
                          {tooltipText}
                        </TooltipContent>
                      </Tooltip>
                    )
                  }
                )}
              </div>
            </TooltipProvider>
          </div>
        )}
      </div>
    </div>
  )
}
