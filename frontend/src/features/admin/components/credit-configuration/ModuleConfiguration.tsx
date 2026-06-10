import React from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronDown, ChevronRight, Grid3X3, Settings } from 'lucide-react'
import {
  ApplicationModule,
  CostChanges,
  OperationCost,
  TenantApplication,
} from './types'

interface TenantOperationConfig {
  operationCode: string
  creditCost?: number
  unit?: string
}

interface TenantConfigurations {
  configurations: {
    operations: TenantOperationConfig[]
  }
}

interface ModuleConfigurationProps {
  app: {
    appId: string
    appCode: string
    appName: string
    modules?: ApplicationModule[]
  }
  globalOperationCosts: OperationCost[]
  mode: 'global' | 'tenant'
  selectedTenant?: {
    tenantId: string
    companyName: string
    applications: TenantApplication[]
  } | null
  tenantConfigurations?: TenantConfigurations | null
  selectedModules: Set<string>
  selectedOperations: Record<string, Set<string>>
  expandedModules: Set<string>
  expandedOperations: Set<string>
  costChanges: CostChanges
  onToggleModule: (moduleCode: string) => void
  onToggleOperation: (moduleCode: string, operationCode: string) => void
  onModuleCostChange: (moduleCode: string, cost: number) => void
  onOperationCostChange: (
    moduleCode: string,
    operationCode: string,
    cost: number
  ) => void
  onToggleModuleExpansion: (moduleKey: string) => void
  onToggleOperationExpansion: (operationKey: string) => void
}

export const ModuleConfiguration: React.FC<ModuleConfigurationProps> = ({
  app,
  globalOperationCosts,
  mode,
  selectedTenant,
  tenantConfigurations,
  selectedModules,
  selectedOperations,
  expandedModules,
  expandedOperations,
  costChanges,
  onToggleModule,
  onToggleOperation,
  onModuleCostChange,
  onOperationCostChange,
  onToggleModuleExpansion,
  onToggleOperationExpansion,
}) => {
  const modulesToShow = app.modules || []

  // Filter modules for tenant mode
  const filteredModules =
    mode === 'tenant' && selectedTenant
      ? modulesToShow.filter((module) => {
          const tenantApp = selectedTenant.applications?.find(
            (ta) => ta.appCode === app.appCode
          )
          return (
            tenantApp?.isEnabled &&
            (!tenantApp.enabledModules ||
              tenantApp.enabledModules.includes(module.moduleCode))
          )
        })
      : modulesToShow

  if (filteredModules.length === 0) {
    return (
      <div className="text-muted-foreground col-span-2 py-8 text-center">
        <Grid3X3 className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p className="mb-2 font-medium">
          {mode === 'tenant'
            ? 'No modules enabled for this tenant'
            : 'No modules available for this application'}
        </p>
        {mode === 'tenant' && (
          <p className="text-xs text-blue-600">
            Enable modules for this tenant in the application assignment
            settings.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {filteredModules.map((module) => {
        const isModuleSelected = selectedModules.has(module.moduleCode)
        const isModuleExpanded = expandedModules.has(
          `${app.appCode}.${module.moduleCode}`
        )
        const selectedOperationsForModule =
          selectedOperations[`${app.appCode}.${module.moduleCode}`] || new Set()

        return (
          <Card
            key={module.moduleId}
            className={`rounded-lg border transition-all duration-200 ${
              isModuleSelected
                ? 'border-blue-300 bg-blue-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <CardContent className="p-4">
              {/* Module Header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isModuleSelected}
                    onCheckedChange={() => onToggleModule(module.moduleCode)}
                    className={
                      isModuleSelected ? 'border-blue-500 bg-blue-500' : ''
                    }
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-blue-600" />
                      <h6 className="font-medium text-[#1B2E5A]">
                        {module.moduleName}
                      </h6>
                      <Badge variant="outline" className="text-xs">
                        {module.permissions?.length || 0} permissions
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-600">
                      {module.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isModuleSelected && (
                    <div className="text-right">
                      <div className="text-sm font-bold text-blue-600">
                        {selectedOperationsForModule.size}/
                        {module.permissions?.length || 0}
                      </div>
                      <div className="text-xs text-blue-600">
                        permissions selected
                      </div>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onToggleModuleExpansion(
                        `${app.appCode}.${module.moduleCode}`
                      )
                    }
                    className="p-1"
                  >
                    {isModuleExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Module Cost Configuration */}
              {isModuleSelected && (
                <div className="mb-3 rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Module Cost:</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={
                        costChanges[app.appCode]?.moduleCosts?.[
                          module.moduleCode
                        ]?.toString() || ''
                      }
                      className={`h-7 w-20 text-xs ${
                        costChanges[app.appCode]?.moduleCosts?.[
                          module.moduleCode
                        ] !== undefined
                          ? 'border-blue-500 bg-blue-50'
                          : ''
                      }`}
                      onChange={(e) => {
                        const newCost = parseFloat(e.target.value) || 0
                        onModuleCostChange(module.moduleCode, newCost)
                      }}
                    />
                    <span className="text-muted-foreground text-sm">
                      credits
                    </span>
                    {mode === 'tenant' &&
                      !costChanges[app.appCode]?.moduleCosts?.[
                        module.moduleCode
                      ] && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 border-orange-300 px-2 text-xs text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                          onClick={() => {
                            // Pre-fill with a default module cost
                            onModuleCostChange(module.moduleCode, 1.0)
                          }}
                        >
                          Create Override
                        </Button>
                      )}
                  </div>
                  {mode === 'tenant' &&
                    !costChanges[app.appCode]?.moduleCosts?.[
                      module.moduleCode
                    ] && (
                      <div className="text-muted-foreground mt-2 text-xs">
                        Using global module configuration • Click "Create
                        Override" to set tenant-specific cost
                      </div>
                    )}
                </div>
              )}

              {/* Operations */}
              {isModuleExpanded &&
                isModuleSelected &&
                module.permissions &&
                module.permissions.length > 0 && (
                  <div className="space-y-2">
                    <div className="mb-2 flex items-center gap-2">
                      <h6 className="text-sm font-medium text-gray-700">
                        Permissions as Operations:
                      </h6>
                      {mode === 'tenant' && selectedTenant && (
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                          Filtered for {selectedTenant.companyName}
                        </span>
                      )}
                    </div>
                    {(() => {
                      // Filter permissions based on tenant access
                      let permissionsToShow = module.permissions

                      if (mode === 'tenant' && selectedTenant) {
                        const tenantApp = selectedTenant.applications?.find(
                          (ta) => ta.appCode === app.appCode
                        )

                        if (tenantApp) {
                          // First, check if tenant has custom permissions defined in the assignment
                          if (
                            tenantApp.customPermissions &&
                            typeof tenantApp.customPermissions === 'object'
                          ) {
                            // Check if there are custom permissions for this specific module
                            if (
                              tenantApp.customPermissions[module.moduleCode]
                            ) {
                              const customModulePermissions =
                                tenantApp.customPermissions[module.moduleCode]

                              // Filter module permissions to only show custom ones
                              permissionsToShow = module.permissions.filter(
                                (permission) =>
                                  customModulePermissions.includes(
                                    permission.code
                                  )
                              )
                            } else {
                              // No custom permissions for this module, fall back to default behavior
                              permissionsToShow = module.permissions
                            }
                          } else {
                            // Check if tenant configurations are loaded (existing logic)
                            if (!tenantConfigurations) {
                              permissionsToShow = module.permissions // Show all permissions while loading
                            } else {
                              // Check if there are any tenant-specific operation costs configured
                              const tenantOperationsForModule =
                                tenantConfigurations?.configurations?.operations?.filter(
                                  (op: TenantOperationConfig) =>
                                    op.operationCode.startsWith(
                                      `${app.appCode}.${module.moduleCode}.`
                                    )
                                ) || []

                              if (tenantOperationsForModule.length > 0) {
                                // Tenant has specific operation configurations, filter permissions accordingly
                                const configuredPermissionCodes =
                                  tenantOperationsForModule.map(
                                    (op: TenantOperationConfig) =>
                                      op.operationCode.split('.').pop()
                                  )

                                permissionsToShow = module.permissions.filter(
                                  (permission) =>
                                    configuredPermissionCodes.includes(
                                      permission.code
                                    )
                                )
                              } else {
                                // No tenant-specific configurations found, show all permissions for enabled modules
                                permissionsToShow = module.permissions
                              }
                            }
                          }
                        } else {
                          // If no tenant app found, show no permissions
                          permissionsToShow = []
                        }
                      }

                      return permissionsToShow.map((permission) => {
                        const operationCode = permission.code
                        const fullOperationCode = `${app.appCode}.${module.moduleCode}.${operationCode}`
                        const isOperationSelected =
                          selectedOperationsForModule.has(operationCode)
                        const isOperationExpanded = expandedOperations.has(
                          `${app.appCode}.${module.moduleCode}.${operationCode}`
                        )

                        // Check if credit cost is configured for this operation
                        const configuredCost = globalOperationCosts?.find(
                          (op) => op.operationCode === fullOperationCode
                        )

                        return (
                          <div
                            key={operationCode}
                            className={`rounded-lg border p-3 transition-all ${
                              isOperationSelected
                                ? 'border-green-300 bg-green-50'
                                : 'border-gray-200 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={isOperationSelected}
                                  onCheckedChange={() =>
                                    onToggleOperation(
                                      module.moduleCode,
                                      operationCode
                                    )
                                  }
                                  className={
                                    isOperationSelected
                                      ? 'border-green-500 bg-green-500'
                                      : ''
                                  }
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 text-sm font-medium">
                                    {permission.name}
                                    <Badge
                                      variant="outline"
                                      className="border-purple-300 text-xs text-purple-600"
                                    >
                                      Permission
                                    </Badge>
                                  </div>
                                  <p className="text-muted-foreground text-xs">
                                    {fullOperationCode}
                                  </p>

                                  {/* Cost Display */}
                                  <div className="mt-1 flex items-center gap-2">
                                    {mode === 'tenant' && selectedTenant ? (
                                      <>
                                        {/* Check for tenant-specific override */}
                                        {(() => {
                                          const tenantOverride =
                                            tenantConfigurations?.configurations.operations.find(
                                              (
                                                tenantOp: TenantOperationConfig
                                              ) =>
                                                tenantOp.operationCode ===
                                                fullOperationCode
                                            )

                                          const pendingChange =
                                            costChanges[app.appCode]
                                              ?.operationCosts?.[
                                              fullOperationCode
                                            ]

                                          if (tenantOverride || pendingChange) {
                                            const tenantCost =
                                              pendingChange ||
                                              tenantOverride?.creditCost
                                            const tenantUnit =
                                              tenantOverride?.unit ||
                                              configuredCost?.unit ||
                                              'operation'

                                            return (
                                              <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                  <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                                    🏢 Tenant: {tenantCost}{' '}
                                                    credits/{tenantUnit}
                                                  </span>
                                                  <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">
                                                    🌍 Global:{' '}
                                                    {configuredCost?.creditCost ||
                                                      'Not configured'}{' '}
                                                    credits/
                                                    {configuredCost?.unit ||
                                                      'unit'}
                                                  </span>
                                                </div>
                                                <div className="text-xs font-medium text-green-600">
                                                  {pendingChange
                                                    ? 'Pending change - will override tenant cost'
                                                    : 'Using tenant-specific cost'}
                                                </div>
                                              </div>
                                            )
                                          } else if (configuredCost) {
                                            return (
                                              <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                  <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">
                                                    🌍 Global:{' '}
                                                    {configuredCost.creditCost}{' '}
                                                    credits/
                                                    {configuredCost.unit}
                                                  </span>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-5 border-orange-300 px-2 text-xs text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                                                    onClick={() => {
                                                      onOperationCostChange(
                                                        module.moduleCode,
                                                        operationCode,
                                                        configuredCost.creditCost
                                                      )
                                                    }}
                                                  >
                                                    Create Override
                                                  </Button>
                                                </div>
                                                <div className="text-muted-foreground text-xs">
                                                  Using global configuration •
                                                  Click "Create Override" to set
                                                  tenant-specific cost
                                                </div>
                                              </div>
                                            )
                                          } else {
                                            return (
                                              <div className="space-y-1">
                                                <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">
                                                  ⚠️ Credit costs not configured
                                                  yet
                                                </span>
                                              </div>
                                            )
                                          }
                                        })()}
                                      </>
                                    ) : configuredCost ? (
                                      <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">
                                        Global: {configuredCost.creditCost}{' '}
                                        credits/{configuredCost.unit}
                                      </span>
                                    ) : (
                                      <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">
                                        ⚠️ Credit costs not configured yet
                                      </span>
                                    )}
                                    {isOperationSelected && (
                                      <div className="flex items-center gap-2">
                                        <Input
                                          type="number"
                                          value={
                                            costChanges[
                                              app.appCode
                                            ]?.operationCosts?.[
                                              fullOperationCode
                                            ]?.toString() ||
                                            configuredCost?.creditCost?.toString() ||
                                            ''
                                          }
                                          placeholder="0"
                                          className={`h-6 w-16 text-xs ${
                                            costChanges[app.appCode]
                                              ?.operationCosts?.[
                                              fullOperationCode
                                            ] !== undefined
                                              ? 'border-orange-500 bg-orange-50'
                                              : ''
                                          }`}
                                          onChange={(e) => {
                                            const newCost =
                                              parseFloat(e.target.value) || 0
                                            onOperationCostChange(
                                              module.moduleCode,
                                              operationCode,
                                              newCost
                                            )
                                          }}
                                        />
                                        <span className="text-muted-foreground text-xs">
                                          credits/
                                          {configuredCost?.unit || 'operation'}
                                          {mode === 'tenant' &&
                                            selectedTenant && (
                                              <span className="ml-1 text-orange-600">
                                                (Override)
                                              </span>
                                            )}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  onToggleOperationExpansion(
                                    `${app.appCode}.${module.moduleCode}.${operationCode}`
                                  )
                                }
                                className="p-1"
                              >
                                {isOperationExpanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                              </Button>
                            </div>

                            {/* Operation Details */}
                            {isOperationExpanded && isOperationSelected && (
                              <div className="mt-3 ml-6 space-y-2">
                                <div className="text-xs font-medium text-gray-700">
                                  Permission Details:
                                </div>
                                <div className="rounded-lg bg-gray-50 p-3">
                                  <div className="grid grid-cols-1 gap-2 text-xs">
                                    <div>
                                      <span className="font-medium">
                                        Permission Code:
                                      </span>
                                      <code className="ml-1 rounded bg-blue-100 px-1 text-blue-900">
                                        {permission.code}
                                      </code>
                                    </div>
                                    <div>
                                      <span className="font-medium">
                                        Description:
                                      </span>{' '}
                                      {permission.description}
                                    </div>
                                    <div>
                                      <span className="font-medium">
                                        Operation Code:
                                      </span>
                                      <code className="ml-1 rounded bg-green-100 px-1 text-green-900">
                                        {fullOperationCode}
                                      </code>
                                    </div>
                                  </div>
                                  <div className="mt-2 border-t pt-2">
                                    <div className="text-muted-foreground mb-2 text-xs">
                                      💡{' '}
                                      <strong>Permission as Operation:</strong>{' '}
                                      This permission doubles as a billable
                                      operation
                                    </div>
                                    <div className="rounded border-l-4 border-blue-300 bg-blue-50 p-2">
                                      <div className="text-xs">
                                        <span className="font-medium text-blue-800">
                                          Billing Context:
                                        </span>
                                        <span className="ml-1 text-blue-700">
                                          Each use of this permission will
                                          consume the configured credit cost
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}

              {/* Show message when no permissions are available for tenant */}
              {isModuleExpanded &&
                isModuleSelected &&
                mode === 'tenant' &&
                selectedTenant &&
                module.permissions &&
                module.permissions.length > 0 &&
                (() => {
                  const tenantApp = selectedTenant.applications?.find(
                    (ta) => ta.appCode === app.appCode
                  )
                  const tenantOperationsForModule =
                    tenantConfigurations?.configurations?.operations?.filter(
                      (op: TenantOperationConfig) =>
                        op.operationCode.startsWith(
                          `${app.appCode}.${module.moduleCode}.`
                        )
                    ) || []

                  // Only show message if tenant has the app but no permissions are being shown
                  if (tenantApp && tenantOperationsForModule.length === 0) {
                    return (
                      <div className="text-muted-foreground py-4 text-center">
                        <p className="text-xs">
                          No tenant-specific permissions configured for this
                          module.
                        </p>
                        <p className="mt-1 text-xs">
                          The tenant has access to this module but no specific
                          permission restrictions are set.
                        </p>
                        <p className="mt-1 text-xs text-blue-600">
                          All permissions for this module are available to the
                          tenant.
                        </p>
                      </div>
                    )
                  } else if (!tenantApp) {
                    return (
                      <div className="text-muted-foreground py-4 text-center">
                        <p className="text-xs">
                          No permissions available for this tenant in this
                          module.
                        </p>
                        <p className="mt-1 text-xs">
                          The tenant does not have access to this application.
                        </p>
                      </div>
                    )
                  }
                  return null
                })()}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
