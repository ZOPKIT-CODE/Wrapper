import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Settings, Save, RotateCcw, Upload, Download, Search, Users, Building2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import OperationConfigEditor from './OperationConfigEditor';

interface Tenant {
  tenantId: string;
  companyName: string;
  subdomain: string;
  isActive: boolean;
}

interface OperationConfig {
  configId: string;
  operationCode: string;
  creditCost: number;
  unit: string;
  unitMultiplier: number;
  freeAllowance: number;
  freeAllowancePeriod: string;
  volumeTiers: Array<{
    minVolume: number;
    maxVolume: number | null;
    creditCost: number;
    discountPercentage: number;
  }>;
  allowOverage: boolean;
  overageLimit: number | null;
  overagePeriod: string;
  overageCost: number | null;
  scope: string;
  isActive: boolean;
  isCustomized: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

interface ModuleConfig {
  moduleConfigId: string;
  moduleCode: string;
  appCode: string;
  defaultCreditCost: number;
  defaultUnit: string;
  maxOperationsPerPeriod: number | null;
  periodType: string;
  creditBudget: number | null;
  operationOverrides: Record<string, any>;
  isActive: boolean;
  isCustomized: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AppConfig {
  appConfigId: string;
  appCode: string;
  billingModel: string;
  defaultCreditCost: number;
  defaultUnit: string;
  maxDailyOperations: number | null;
  maxMonthlyOperations: number | null;
  creditBudget: number | null;
  premiumFeatures: Record<string, any>;
  moduleDefaults: Record<string, any>;
  isActive: boolean;
  isCustomized: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TenantConfigurations {
  tenantId: string;
  configurations: {
    operations: OperationConfig[];
    modules: ModuleConfig[];
    apps: AppConfig[];
  };
  globalConfigs: {
    operations: OperationConfig[];
    modules: ModuleConfig[];
    apps: AppConfig[];
  };
}

const CreditConfigurationScreen: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [configurations, setConfigurations] = useState<TenantConfigurations | null>(null);
  const [applicationAllocations, setApplicationAllocations] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('operations');
  const [selectedOperation, setSelectedOperation] = useState<OperationConfig | null>(null);

  // Load tenants
  const loadTenants = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/tenants');
      setTenants(response.data.data || []);
    } catch (error) {
      console.error('Error loading tenants:', error);
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load tenant configurations
  const loadTenantConfigurations = useCallback(async (tenantId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/credit-configurations/${tenantId}`);
      setConfigurations(response.data);
    } catch (error) {
      console.error('Error loading tenant configurations:', error);
      toast.error('Failed to load tenant configurations');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load tenant application allocations
  const loadTenantApplicationAllocations = useCallback(async (tenantId: string) => {
    try {
      // Get all application allocations for this tenant
      const response = await api.get('/admin/credits/application-allocations');
      if (response.data.success) {
        // Filter allocations for this specific tenant
        const tenantAllocations = response.data.data.allocations.filter(
          (allocation: any) => allocation.tenantId === tenantId
        );

        // Group by application and calculate totals
        const allocationsByApplication: Record<string, any> = {};
        let totalAllocations = 0;
        let totalAllocatedCredits = 0;
        let totalUsedCredits = 0;
        let totalAvailableCredits = 0;

        tenantAllocations.forEach((allocation: any) => {
          totalAllocations++;
          totalAllocatedCredits += parseFloat(allocation.allocatedCredits || 0);
          totalUsedCredits += parseFloat(allocation.usedCredits || 0);
          totalAvailableCredits += parseFloat(allocation.availableCredits || 0);

          const appKey = allocation.targetApplication;
          if (!allocationsByApplication[appKey]) {
            allocationsByApplication[appKey] = {
              application: appKey,
              allocationCount: 0,
              totalAllocated: 0,
              totalUsed: 0,
              totalAvailable: 0,
              allocations: []
            };
          }
          allocationsByApplication[appKey].allocationCount++;
          allocationsByApplication[appKey].totalAllocated += parseFloat(allocation.allocatedCredits || 0);
          allocationsByApplication[appKey].totalUsed += parseFloat(allocation.usedCredits || 0);
          allocationsByApplication[appKey].totalAvailable += parseFloat(allocation.availableCredits || 0);
          allocationsByApplication[appKey].allocations.push(allocation);
        });

        setApplicationAllocations({
          tenantId,
          allocations: tenantAllocations,
          summary: {
            totalAllocations,
            totalAllocatedCredits,
            totalUsedCredits,
            totalAvailableCredits,
            allocationsByApplication: Object.values(allocationsByApplication)
          }
        });
      }
    } catch (error) {
      console.error('Error loading tenant application allocations:', error);
      setApplicationAllocations(null);
    }
  }, []);

  // Handle tenant selection
  const handleTenantSelect = useCallback((tenant: Tenant) => {
    setSelectedTenant(tenant);
    setSelectedOperation(null); // Reset selected operation when changing tenant
    loadTenantConfigurations(tenant.tenantId);
    loadTenantApplicationAllocations(tenant.tenantId);
  }, [loadTenantConfigurations, loadTenantApplicationAllocations]);

  // Handle operation configuration save
  const handleOperationSave = useCallback(async (config: OperationConfig) => {
    if (!selectedTenant) return;

    await api.put(`/admin/credit-configurations/${selectedTenant.tenantId}/operation/${config.operationCode}`, config);
    await loadTenantConfigurations(selectedTenant.tenantId);
  }, [selectedTenant, loadTenantConfigurations]);

  // Handle operation configuration reset
  const handleOperationReset = useCallback(async () => {
    if (!selectedTenant || !selectedOperation) return;

    await api.delete(`/admin/credit-configurations/${selectedTenant.tenantId}/operation/${selectedOperation.operationCode}`);
    setSelectedOperation(null);
    await loadTenantConfigurations(selectedTenant.tenantId);
  }, [selectedTenant, selectedOperation, loadTenantConfigurations]);

  // Handle configuration changes
  const handleConfigChange = useCallback(() => {
    if (selectedTenant) {
      loadTenantConfigurations(selectedTenant.tenantId);
    }
  }, [selectedTenant, loadTenantConfigurations]);

  // Filter tenants based on search
  const filteredTenants = tenants.filter(tenant =>
    tenant.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.subdomain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Load initial data
  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  // Configuration stats
  const getConfigStats = () => {
    if (!configurations) return { operations: 0, modules: 0, apps: 0, customized: 0 };

    const operations = configurations.configurations.operations.length;
    const modules = configurations.configurations.modules.length;
    const apps = configurations.configurations.apps.length;
    const customized = [
      ...configurations.configurations.operations,
      ...configurations.configurations.modules,
      ...configurations.configurations.apps
    ].filter(config => config.isCustomized).length;

    return { operations, modules, apps, customized };
  };

  const stats = getConfigStats();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Credit Configuration Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure credit costs and billing settings for tenants
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Configs
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tenant Selector Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select Tenant
              </CardTitle>
              <CardDescription>
                Choose a tenant to configure credit settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Tenant List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  filteredTenants.map((tenant) => (
                    <div
                      key={tenant.tenantId}
                      onClick={() => handleTenantSelect(tenant)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedTenant?.tenantId === tenant.tenantId
                          ? 'border-primary bg-primary/5'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {tenant.companyName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {tenant.subdomain}
                          </p>
                        </div>
                        <Badge variant={tenant.isActive ? 'default' : 'secondary'} className="ml-2">
                          {tenant.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Panel */}
        <div className="lg:col-span-3">
          {!selectedTenant ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a Tenant</h3>
                <p className="text-muted-foreground text-center">
                  Choose a tenant from the sidebar to view and manage their credit configurations
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Tenant Header */}
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {selectedTenant.companyName}
                      </CardTitle>
                      <CardDescription>
                        {selectedTenant.subdomain} • Tenant ID: {selectedTenant.tenantId}
                      </CardDescription>
                    </div>
                    <Badge variant={selectedTenant.isActive ? 'default' : 'secondary'}>
                      {selectedTenant.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{stats.operations}</div>
                      <div className="text-sm text-muted-foreground">Operations</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{stats.modules}</div>
                      <div className="text-sm text-muted-foreground">Modules</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{stats.apps}</div>
                      <div className="text-sm text-muted-foreground">Apps</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{stats.customized}</div>
                      <div className="text-sm text-muted-foreground">Customized</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Configuration Tabs */}
              {configurations && (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="operations" className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Operations
                    </TabsTrigger>
                    <TabsTrigger value="modules" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Modules
                    </TabsTrigger>
                    <TabsTrigger value="apps" className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Apps
                    </TabsTrigger>
                    <TabsTrigger value="allocations" className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Allocations
                    </TabsTrigger>
                    <TabsTrigger value="templates" className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Templates
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="operations" className="space-y-4">
                    {!selectedOperation ? (
                      <Card>
                        <CardHeader>
                          <CardTitle>Operation Configurations</CardTitle>
                          <CardDescription>
                            Configure credit costs for individual operations
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {/* Show tenant-specific operations */}
                              {configurations?.configurations.operations.map((operation) => (
                                <Card
                                  key={operation.operationCode}
                                  className="cursor-pointer hover:shadow-md transition-shadow"
                                  onClick={() => setSelectedOperation(operation)}
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <h4 className="font-medium text-sm">{operation.operationCode}</h4>
                                        <p className="text-xs text-muted-foreground">
                                          {operation.creditCost} credits • {operation.unit}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {operation.isCustomized && (
                                          <Badge variant="secondary" className="text-xs">Custom</Badge>
                                        )}
                                        {operation.isActive ? (
                                          <Badge variant="default" className="text-xs">Active</Badge>
                                        ) : (
                                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}

                              {/* Show global operations that aren't customized */}
                              {configurations?.globalConfigs.operations
                                .filter(globalOp =>
                                  !configurations.configurations.operations.some(tenantOp =>
                                    tenantOp.operationCode === globalOp.operationCode
                                  )
                                )
                                .map((operation) => (
                                  <Card
                                    key={operation.operationCode}
                                    className="cursor-pointer hover:shadow-md transition-shadow opacity-75"
                                    onClick={() => setSelectedOperation(operation)}
                                  >
                                    <CardContent className="p-4">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <h4 className="font-medium text-sm">{operation.operationCode}</h4>
                                          <p className="text-xs text-muted-foreground">
                                            {operation.creditCost} credits • {operation.unit}
                                          </p>
                                        </div>
                                        <Badge variant="outline" className="text-xs">Global</Badge>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                            </div>

                            {(!configurations?.configurations.operations.length &&
                              !configurations?.globalConfigs.operations.length) && (
                              <div className="text-center py-8 text-muted-foreground">
                                No operations available for configuration
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <OperationConfigEditor
                        tenantId={selectedTenant.tenantId}
                        operationCode={selectedOperation.operationCode}
                        currentConfig={configurations?.configurations.operations.find(
                          op => op.operationCode === selectedOperation.operationCode
                        ) || null}
                        globalConfig={configurations?.globalConfigs.operations.find(
                          op => op.operationCode === selectedOperation.operationCode
                        ) || null}
                        onSave={handleOperationSave}
                        onReset={handleOperationReset}
                        onConfigChange={handleConfigChange}
                        onBack={() => setSelectedOperation(null)}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="modules" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Module Configurations</CardTitle>
                        <CardDescription>
                          Configure credit costs for entire modules
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-8 text-muted-foreground">
                          Module configuration editor will be implemented here
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="apps" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Application Configurations</CardTitle>
                        <CardDescription>
                          Configure credit costs for entire applications
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-8 text-muted-foreground">
                          Application configuration editor will be implemented here
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="allocations" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Application Credit Allocations</CardTitle>
                        <CardDescription>
                          View and manage credit allocations for applications assigned to this tenant
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {applicationAllocations ? (
                          <>
                            {/* Summary Stats */}
                            {applicationAllocations.summary.totalAllocations > 0 && (
                              <div className="grid gap-4 md:grid-cols-4 mb-6">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-blue-600">
                                    {applicationAllocations.summary.totalAllocations}
                                  </div>
                                  <div className="text-sm text-gray-600">Active Allocations</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-purple-600">
                                    {applicationAllocations.summary.totalAllocatedCredits.toFixed(2)}
                                  </div>
                                  <div className="text-sm text-gray-600">Total Allocated</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-red-600">
                                    {applicationAllocations.summary.totalUsedCredits.toFixed(2)}
                                  </div>
                                  <div className="text-sm text-gray-600">Total Used</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-green-600">
                                    {applicationAllocations.summary.totalAvailableCredits.toFixed(2)}
                                  </div>
                                  <div className="text-sm text-gray-600">Available</div>
                                </div>
                              </div>
                            )}

                            {/* By Application */}
                            {applicationAllocations.summary.allocationsByApplication.length > 0 ? (
                              <div>
                                <h4 className="font-medium mb-3">By Application</h4>
                                <div className="grid gap-3">
                                  {applicationAllocations.summary.allocationsByApplication.map((app: any) => (
                                    <div key={app.application} className="flex items-center justify-between p-3 border rounded-lg">
                                      <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                        <div>
                                          <div className="font-medium capitalize">{app.application}</div>
                                          <div className="text-sm text-gray-500">
                                            {app.allocationCount} allocation{app.allocationCount !== 1 ? 's' : ''}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-medium">
                                          <span className="text-green-600">{app.totalAvailable.toFixed(2)}</span>
                                          <span className="text-gray-400"> / </span>
                                          <span className="text-purple-600">{app.totalAllocated.toFixed(2)}</span>
                                        </div>
                                        <div className="text-sm text-gray-500">
                                          {app.totalUsed.toFixed(2)} used
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <div className="text-sm text-muted-foreground">
                                  No application credit allocations found for this tenant
                                </div>
                              </div>
                            )}

                            {/* Detailed Allocations */}
                            {applicationAllocations.allocations.length > 0 && (
                              <div className="mt-6">
                                <h4 className="font-medium mb-3">Detailed Allocations</h4>
                                <div className="space-y-2">
                                  {applicationAllocations.allocations.map((allocation: any) => (
                                    <div key={allocation.allocationId} className="flex items-center justify-between py-2 border-b last:border-b-0">
                                      <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        <div>
                                          <div className="font-medium capitalize">{allocation.targetApplication}</div>
                                          <div className="text-sm text-gray-500">
                                            {allocation.allocationPurpose || 'No purpose specified'} •
                                            {new Date(allocation.allocatedAt).toLocaleDateString()}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-medium">
                                          <span className="text-green-600">{allocation.availableCredits.toFixed(2)}</span>
                                          <span className="text-gray-400"> / </span>
                                          <span className="text-purple-600">{allocation.allocatedCredits.toFixed(2)}</span>
                                        </div>
                                        <div className="text-sm text-gray-500">
                                          {allocation.usedCredits.toFixed(2)} used
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-8">
                            <div className="text-sm text-muted-foreground">
                              Loading application allocations...
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="templates" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Configuration Templates</CardTitle>
                        <CardDescription>
                          Apply pre-configured templates to tenants
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-8 text-muted-foreground">
                          Template management will be implemented here
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}

              {loading && (
                <Card>
                  <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Loading configurations...
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditConfigurationScreen;
