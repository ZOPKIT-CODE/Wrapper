import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { Button } from '@/components/ui'
import { toast } from 'sonner'
import {
  operationCostAPI,
  creditConfigurationAPI,
  applicationAssignmentAPI,
} from '@/lib/api'

// Import our extracted components
import {
  WarningModal,
  ComparisonModal,
  TenantList,
  ConfigurationSummary,
  BulkUpdateDialog,
  TemplateDialog,
  CreditConfigurationBuilder,
  Application,
  OperationCost,
  Tenant,
  CostChanges,
  CostTemplate,
  ChangeImpact,
  Permission,
} from './components'

// Shape of the tenant configuration payload returned by the API and consumed
// by CreditConfigurationBuilder. Kept structurally compatible with that
// component's local TenantConfigurations interface.
interface TenantConfigurations {
  configurations: {
    operations: Array<{ operationCode: string; [key: string]: unknown }>
    modules: Array<{ moduleCode: string; [key: string]: unknown }>
  }
  [key: string]: unknown
}

// Raw (pre-normalization) shapes as delivered by the applications API.
interface RawApplicationModule {
  moduleId: string
  moduleCode: string
  moduleName: string
  description?: string
  isCore?: boolean
  permissions?: Permission[]
}

interface RawApplication {
  appId: string
  appCode: string
  appName: string
  description?: string
  icon?: string
  baseUrl?: string
  isCore?: boolean
  sortOrder?: number
  modules?: RawApplicationModule[]
}

// Main component - significantly simplified
const CreditOperationCostManager: React.FC = () => {
  // Core state
  const [operationCosts, setOperationCosts] = useState<OperationCost[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [templates] = useState<CostTemplate[]>([])

  // UI state
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [tenantConfigurations, setTenantConfigurations] =
    useState<TenantConfigurations | null>(null)
  const [activeTab, setActiveTab] = useState('global')
  const [searchTerm, setSearchTerm] = useState('')
  const [costChanges, setCostChanges] = useState<CostChanges>({})

  // Dialog states
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [showComparisonModal, setShowComparisonModal] = useState(false)
  const [showBulkUpdateDialog, setShowBulkUpdateDialog] = useState(false)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [, setShowCreateDialog] = useState(false)

  // Modal data
  const [changeImpact, setChangeImpact] = useState<ChangeImpact | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<CostTemplate | null>(
    null
  )

  // Loading states
  const [, setLoadingOperations] = useState(false)
  const [loadingTenants, setLoadingTenants] = useState(false)
  const [, setLoadingTenantConfigs] = useState(false)
  const [, setLoadingApplications] = useState(false)

  // Data loading functions
  const loadOperationCosts = useCallback(async () => {
    setLoadingOperations(true)
    try {
      // Use the new separated global API instead of deprecated mixed endpoint
      const response = await operationCostAPI.getGlobalOperationCosts({
        includeUsage: true,
      })
      setOperationCosts(response.data?.data?.operations || [])
    } catch (error) {
      console.error('Error loading global operation costs:', error)
      toast.error('Failed to load global operation costs')
    } finally {
      setLoadingOperations(false)
    }
  }, [])

  const loadTenants = useCallback(async () => {
    setLoadingTenants(true)
    try {
      const response = await applicationAssignmentAPI.getTenants()
      setTenants(response.data.data.tenants || [])
    } catch (error) {
      console.error('Error loading tenants:', error)
      toast.error('Failed to load tenants')
    } finally {
      setLoadingTenants(false)
    }
  }, [])

  const loadApplications = useCallback(async () => {
    setLoadingApplications(true)
    try {
      const response = await applicationAssignmentAPI.getApplications({
        includeModules: true,
      })
      const apps: RawApplication[] = response.data.data.applications || []
      const transformedApps = apps.map((app: RawApplication) => ({
        appId: app.appId,
        appCode: app.appCode,
        appName: app.appName,
        description: app.description || '',
        icon: app.icon || '📱',
        baseUrl: app.baseUrl || '',
        isCore: app.isCore || false,
        sortOrder: app.sortOrder || 0,
        modules: (app.modules || []).map((module: RawApplicationModule) => ({
          moduleId: module.moduleId,
          moduleCode: module.moduleCode,
          moduleName: module.moduleName,
          description: module.description || '',
          isCore: module.isCore || false,
          permissions: module.permissions || [],
        })),
      }))
      setApplications(transformedApps)
    } catch (error) {
      console.error('Error loading applications:', error)
      toast.error('Failed to load applications')
    } finally {
      setLoadingApplications(false)
    }
  }, [])

  const loadTenantConfigurations = useCallback(async (tenantId: string) => {
    setLoadingTenantConfigs(true)
    try {
      const response =
        await creditConfigurationAPI.getTenantConfigurations(tenantId)
      setTenantConfigurations(response.data)
    } catch (error) {
      console.error('❌ Error loading tenant configurations:', error)
      toast.error('Failed to load tenant configurations')
    } finally {
      setLoadingTenantConfigs(false)
    }
  }, [])

  // Event handlers
  const handleTenantSelect = useCallback(
    async (tenant: Tenant) => {
      setSelectedTenant(tenant)

      if (tenant) {
        try {
          await loadTenantConfigurations(tenant.tenantId)
        } catch (error) {
          console.error(
            `❌ Failed to load tenant configurations for ${tenant.companyName}:`,
            error
          )
          toast.error(`Failed to load configurations for ${tenant.companyName}`)
        }
      } else {
        setTenantConfigurations(null)
      }
    },
    [loadTenantConfigurations]
  )

  const handleCostChange = useCallback(
    (
      appCode: string,
      _moduleCode: string,
      operationCode: string,
      cost: number
    ) => {
      setCostChanges((prev) => ({
        ...prev,
        [appCode]: {
          ...prev[appCode],
          operationCosts: {
            ...prev[appCode]?.operationCosts,
            [operationCode]: cost,
          },
        },
      }))
    },
    []
  )

  const handleAppCostChange = useCallback((appCode: string, cost: number) => {
    setCostChanges((prev) => ({
      ...prev,
      [appCode]: {
        ...prev[appCode],
        appCost: cost,
      },
    }))
  }, [])

  const handleModuleCostChange = useCallback(
    (appCode: string, moduleCode: string, cost: number) => {
      setCostChanges((prev) => ({
        ...prev,
        [appCode]: {
          ...prev[appCode],
          moduleCosts: {
            ...prev[appCode]?.moduleCosts,
            [moduleCode]: cost,
          },
        },
      }))
    },
    []
  )

  const handlePreview = useCallback(() => {
    setShowComparisonModal(true)
  }, [])

  const handleSave = useCallback(() => {
    if (Object.keys(costChanges).length > 0) {
      const affectedOperations = Object.values(costChanges).reduce(
        (total, appChanges) => {
          let count = 0
          if (appChanges.operationCosts)
            count += Object.keys(appChanges.operationCosts).length
          if (appChanges.moduleCosts)
            count += Object.keys(appChanges.moduleCosts).length
          if (appChanges.appCost !== undefined) count += 1
          return total + count
        },
        0
      )

      setChangeImpact({
        affectedOperations,
        affectedTenants: activeTab === 'global' ? tenants.length : 1,
        estimatedImpact:
          activeTab === 'global'
            ? `Global changes will affect all ${tenants.length} tenants and ${affectedOperations} operation costs`
            : `Tenant-specific changes will affect ${affectedOperations} operation costs for ${selectedTenant?.companyName || 'this tenant'}`,
      })
      setShowWarningModal(true)
    }
  }, [costChanges, activeTab, tenants, selectedTenant])

  const handleConfirmChanges = useCallback(async () => {
    if (!changeImpact) return

    try {
      const savePromises = []

      for (const [appCode, appChanges] of Object.entries(costChanges)) {
        if (appChanges.operationCosts) {
          for (const [operationCode, cost] of Object.entries(
            appChanges.operationCosts
          )) {
            if (activeTab === 'global') {
              savePromises.push(
                operationCostAPI
                  .createOperationCost({
                    operationCode,
                    operationName: operationCode.split('.').pop() || '',
                    creditCost: cost,
                    unit: 'operation',
                    unitMultiplier: 1,
                    category: 'Default',
                    isActive: true,
                    priority: 100,
                  })
                  .then((result) => {
                    return result
                  })
                  .catch((error) => {
                    console.error(
                      `❌ Failed to create global operation: ${operationCode}`,
                      error
                    )
                    throw error
                  })
              )
            } else if (selectedTenant) {
              savePromises.push(
                creditConfigurationAPI
                  .updateTenantOperationConfig(
                    selectedTenant.tenantId,
                    operationCode,
                    {
                      creditCost: cost,
                      unit: 'operation',
                      unitMultiplier: 1,
                      scope: 'tenant',
                      isActive: true,
                    }
                  )
                  .then((result) => {
                    return result
                  })
                  .catch((error) => {
                    console.error(
                      `❌ Failed to update tenant operation: ${operationCode}`,
                      error
                    )
                    throw error
                  })
              )
            }
          }
        }

        // Handle module costs - create operation costs for all operations in the module
        if (appChanges.moduleCosts) {
          for (const [moduleCode, cost] of Object.entries(
            appChanges.moduleCosts
          )) {
            // Find the module in the applications data to get its permissions
            const app = applications.find((a) => a.appCode === appCode)
            const module = app?.modules?.find(
              (m) => m.moduleCode === moduleCode
            )

            if (module?.permissions && module.permissions.length > 0) {
              // Create operation cost for each permission in the module
              for (const permission of module.permissions) {
                const operationCode = `${appCode}.${moduleCode}.${permission.code}`
                const operationName = permission.name

                if (activeTab === 'global') {
                  savePromises.push(
                    operationCostAPI
                      .createOperationCost({
                        operationCode,
                        operationName,
                        creditCost: cost, // Use the module cost for all operations in this module
                        unit: 'operation',
                        unitMultiplier: 1,
                        category: appCode.toUpperCase(),
                        isActive: true,
                        priority: 100,
                      })
                      .then((result) => {
                        return result
                      })
                      .catch((error) => {
                        console.error(
                          `❌ Failed to create module operation cost: ${operationCode}`,
                          error
                        )
                        throw error
                      })
                  )
                } else if (selectedTenant) {
                  savePromises.push(
                    creditConfigurationAPI
                      .updateTenantOperationConfig(
                        selectedTenant.tenantId,
                        operationCode,
                        {
                          creditCost: cost,
                          unit: 'operation',
                          unitMultiplier: 1,
                          scope: 'tenant',
                          isActive: true,
                        }
                      )
                      .then((result) => {
                        return result
                      })
                      .catch((error) => {
                        console.error(
                          `❌ Failed to update tenant module operation cost: ${operationCode}`,
                          error
                        )
                        throw error
                      })
                  )
                }
              }
            }
          }
        }

        // Handle app costs - create operation costs for all operations in all modules of the app
        if (appChanges.appCost !== undefined) {
          // Find the application in the applications data to get its modules
          const app = applications.find((a) => a.appCode === appCode)

          if (app?.modules && app.modules.length > 0) {
            // Loop through each module in the application
            for (const module of app.modules) {
              if (module.permissions && module.permissions.length > 0) {
                // Create operation cost for each permission in each module
                for (const permission of module.permissions) {
                  const operationCode = `${appCode}.${module.moduleCode}.${permission.code}`
                  const operationName = permission.name

                  if (activeTab === 'global') {
                    savePromises.push(
                      operationCostAPI
                        .createOperationCost({
                          operationCode,
                          operationName,
                          creditCost: appChanges.appCost, // Use the app cost for all operations in this app
                          unit: 'operation',
                          unitMultiplier: 1,
                          category: appCode.toUpperCase(),
                          isActive: true,
                          priority: 100,
                        })
                        .then((result) => {
                          return result
                        })
                        .catch((error) => {
                          console.error(
                            `❌ Failed to create app operation cost: ${operationCode}`,
                            error
                          )
                          throw error
                        })
                    )
                  } else if (selectedTenant) {
                    savePromises.push(
                      creditConfigurationAPI
                        .updateTenantOperationConfig(
                          selectedTenant.tenantId,
                          operationCode,
                          {
                            creditCost: appChanges.appCost,
                            unit: 'operation',
                            unitMultiplier: 1,
                            scope: 'tenant',
                            isActive: true,
                          }
                        )
                        .then((result) => {
                          return result
                        })
                        .catch((error) => {
                          console.error(
                            `❌ Failed to update tenant app operation cost: ${operationCode}`,
                            error
                          )
                          throw error
                        })
                    )
                  }
                }
              }
            }
          }
        }
      }

      await Promise.all(savePromises)

      toast.success(`Configuration changes applied successfully!`)
      setShowWarningModal(false)
      setChangeImpact(null)
      setCostChanges({})

      // Reload data
      if (activeTab === 'global') {
        loadOperationCosts()
      } else if (selectedTenant) {
        loadTenantConfigurations(selectedTenant.tenantId)
      }
    } catch (error) {
      const axiosError = axios.isAxiosError(error) ? error : null
      const message = error instanceof Error ? error.message : undefined
      console.error('💥 Error saving changes:', error)
      console.error('💥 Error details:', axiosError?.response?.data || message)

      // More specific error messages
      let errorMessage = 'Failed to save changes'
      if (axiosError?.response?.status === 401) {
        errorMessage = 'Authentication required. Please log in again.'
      } else if (axiosError?.response?.status === 403) {
        errorMessage =
          'Permission denied. You may not have the required permissions.'
      } else if (axiosError?.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.'
      } else if (message) {
        errorMessage = `Failed to save changes: ${message}`
      }

      toast.error(errorMessage)
      setShowWarningModal(false)
    }
  }, [
    changeImpact,
    costChanges,
    activeTab,
    selectedTenant,
    loadOperationCosts,
    loadTenantConfigurations,
    applications,
  ])

  // Test API function for debugging
  const testAPI = useCallback(async () => {
    try {
      // Find the first application with modules and permissions to test with
      const testApp = applications.find(
        (app) =>
          app.modules &&
          app.modules.length > 0 &&
          app.modules[0].permissions &&
          app.modules[0].permissions.length > 0
      )

      if (!testApp) {
        toast.error('No test data available')
        return
      }

      const testModule = testApp.modules?.[0]
      const testPermission = testModule?.permissions?.[0]
      if (!testModule || !testPermission) {
        toast.error('No test data available')
        return
      }
      const testOperationCode = `${testApp.appCode}.${testModule.moduleCode}.${testPermission.code}`

      // Test global operation creation
      await operationCostAPI.createOperationCost({
        operationCode: testOperationCode,
        operationName: testPermission.name,
        creditCost: 2,
        unit: 'operation',
        unitMultiplier: 1,
        category: testApp.appCode.toUpperCase(),
        isActive: true,
        priority: 100,
      })

      // Test tenant operation update (if tenant selected)
      if (selectedTenant) {
        await creditConfigurationAPI.updateTenantOperationConfig(
          selectedTenant.tenantId,
          testOperationCode,
          {
            creditCost: 3,
            unit: 'operation',
            unitMultiplier: 1,
            scope: 'tenant',
            isActive: true,
          }
        )
      }

      toast.success('API tests completed successfully!')
    } catch (error) {
      const axiosError = axios.isAxiosError(error) ? error : null
      const message = error instanceof Error ? error.message : String(error)
      console.error('❌ API test failed:', error)
      console.error('❌ Error details:', {
        message,
        status: axiosError?.response?.status,
        statusText: axiosError?.response?.statusText,
        data: axiosError?.response?.data,
        url: axiosError?.config?.url,
        method: axiosError?.config?.method,
      })
      toast.error(`API test failed: ${message}`)
    }
  }, [selectedTenant, applications])

  // Initialize data
  useEffect(() => {
    loadOperationCosts()
    loadTenants()
    loadApplications()
  }, [loadOperationCosts, loadTenants, loadApplications])

  return (
    <div className="container mx-auto space-y-6 p-6">
      <ConfigurationSummary
        totalOperations={operationCosts.length}
        activeTenants={tenants.filter((t) => t.isActive).length}
        totalApplications={applications.length}
        onCreateOperation={() => setShowCreateDialog(true)}
        onOpenTemplates={() => setShowTemplateDialog(true)}
        mode={activeTab as 'global' | 'tenant'}
        selectedTenant={selectedTenant}
      />

      {/* Debug Test Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={testAPI} className="text-xs">
          🧪 Test API Calls
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="global">Global Configurations</TabsTrigger>
          <TabsTrigger value="tenants">Tenant Configurations</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="space-y-6">
          <CreditConfigurationBuilder
            applications={applications}
            globalOperationCosts={operationCosts}
            mode="global"
            selectedTenant={null}
            tenantConfigurations={null}
            costChanges={costChanges}
            onCostChange={handleCostChange}
            onAppCostChange={handleAppCostChange}
            onModuleCostChange={handleModuleCostChange}
            onPreview={handlePreview}
            onSave={handleSave}
          />
        </TabsContent>

        <TabsContent value="tenants" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            <TenantList
              tenants={tenants}
              selectedTenant={selectedTenant}
              onTenantSelect={handleTenantSelect}
              loading={loadingTenants}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />

            <div className="lg:col-span-3">
              {selectedTenant && (
                <CreditConfigurationBuilder
                  applications={applications}
                  globalOperationCosts={operationCosts}
                  mode="tenant"
                  selectedTenant={selectedTenant}
                  tenantConfigurations={tenantConfigurations}
                  costChanges={costChanges}
                  onCostChange={handleCostChange}
                  onAppCostChange={handleAppCostChange}
                  onModuleCostChange={handleModuleCostChange}
                  onPreview={handlePreview}
                  onSave={handleSave}
                />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              Analytics view coming soon...
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
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
        applications={applications}
        globalOperationCosts={operationCosts}
        mode={activeTab as 'global' | 'tenant'}
        tenantCount={tenants.length}
      />

      <BulkUpdateDialog
        isOpen={showBulkUpdateDialog}
        onClose={() => setShowBulkUpdateDialog(false)}
        onConfirm={() => {
          setShowBulkUpdateDialog(false)
          toast.info('Bulk update feature coming soon!')
        }}
        tenantName={selectedTenant?.companyName}
      />

      <TemplateDialog
        isOpen={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        onSelectTemplate={(template) => {
          setSelectedTemplate(template)
          setShowTemplateDialog(false)
          toast.success(`Template "${template.templateName}" selected`)
        }}
        templates={templates}
        selectedTemplate={selectedTemplate}
        onSelectedTemplateChange={setSelectedTemplate}
        tenantName={selectedTenant?.companyName}
      />
    </div>
  )
}

export default CreditOperationCostManager
