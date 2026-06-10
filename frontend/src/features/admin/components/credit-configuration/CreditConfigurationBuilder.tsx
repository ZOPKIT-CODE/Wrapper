import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
import { Application, OperationCost, CostChanges, TenantApplication } from './types';
import { ModuleConfiguration } from './ModuleConfiguration';

interface CreditConfigurationBuilderProps {
  applications: Application[];
  globalOperationCosts: OperationCost[];
  mode: 'global' | 'tenant';
  selectedTenant?: {
    tenantId: string;
    companyName: string;
    applications: TenantApplication[];
  } | null;
  tenantConfigurations?: any;
  costChanges: CostChanges;
  onCostChange: (appCode: string, moduleCode: string, operationCode: string, cost: number) => void;
  onAppCostChange: (appCode: string, cost: number) => void;
  onModuleCostChange: (appCode: string, moduleCode: string, cost: number) => void;
  onPreview: () => void;
  onSave: () => void;
}

export const CreditConfigurationBuilder: React.FC<CreditConfigurationBuilderProps> = ({
  applications,
  globalOperationCosts,
  mode,
  selectedTenant,
  tenantConfigurations,
  costChanges,
  onCostChange,
  onAppCostChange,
  onModuleCostChange,
  onPreview,
  onSave
}) => {

  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const [selectedModules, setSelectedModules] = useState<Record<string, Set<string>>>({});
  const [selectedOperations, setSelectedOperations] = useState<Record<string, Set<string>>>({});
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedOperations, setExpandedOperations] = useState<Set<string>>(new Set());

  const toggleAppSelection = useCallback((appCode: string) => {
    setSelectedApps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(appCode)) {
        newSet.delete(appCode);
        const newModules = { ...selectedModules };
        const newOperations = { ...selectedOperations };
        delete newModules[appCode];
        Object.keys(newOperations).forEach(key => {
          if (key.startsWith(`${appCode}.`)) {
            delete newOperations[key];
          }
        });
        setSelectedModules(newModules);
        setSelectedOperations(newOperations);
      } else {
        newSet.add(appCode);
        setExpandedApps(prevExpanded => new Set(prevExpanded).add(appCode));
      }
      return newSet;
    });
  }, [selectedModules, selectedOperations]);

  const toggleModuleSelection = useCallback((appCode: string, moduleCode: string) => {
    setSelectedModules(prev => {
      const newModules = { ...prev };
      if (!newModules[appCode]) {
        newModules[appCode] = new Set();
      }

      const moduleKey = `${appCode}.${moduleCode}`;
      if (newModules[appCode].has(moduleCode)) {
        newModules[appCode].delete(moduleCode);
        const newOperations = { ...selectedOperations };
        delete newOperations[moduleKey];
        setSelectedOperations(newOperations);
      } else {
        newModules[appCode].add(moduleCode);
        setExpandedModules(prevExpanded => new Set(prevExpanded).add(moduleKey));
      }
      return newModules;
    });
  }, [selectedOperations]);

  const toggleOperationSelection = useCallback((appCode: string, moduleCode: string, operationCode: string) => {
    const moduleKey = `${appCode}.${moduleCode}`;
    setSelectedOperations(prev => {
      const newOperations = { ...prev };
      if (!newOperations[moduleKey]) {
        newOperations[moduleKey] = new Set();
      }

      if (newOperations[moduleKey].has(operationCode)) {
        newOperations[moduleKey].delete(operationCode);
      } else {
        newOperations[moduleKey].add(operationCode);
        setExpandedOperations(prevExpanded => new Set(prevExpanded).add(`${moduleKey}.${operationCode}`));
      }
      return newOperations;
    });
  }, []);

  const handleOperationCostChange = useCallback((appCode: string, moduleCode: string, operationCode: string, newCost: number) => {
    onCostChange(appCode, moduleCode, operationCode, newCost);
  }, [onCostChange]);

  const handleAppCostChange = useCallback((appCode: string, newCost: number) => {
    onAppCostChange(appCode, newCost);
  }, [onAppCostChange]);

  const handleModuleCostChange = useCallback((appCode: string, moduleCode: string, newCost: number) => {
    onModuleCostChange(appCode, moduleCode, newCost);
  }, [onModuleCostChange]);

  const applicationsToShow = mode === 'tenant' && selectedTenant
    ? applications.filter(app =>
        selectedTenant.applications?.some(tenantApp => tenantApp.appId === app.appId)
      )
    : applications;

  const summary = {
    totalApps: applicationsToShow.length,
    totalModules: applicationsToShow.reduce((total, app) => total + (app.modules?.length || 0), 0),
    totalOperations: applicationsToShow.reduce((total, app) =>
      total + (app.modules?.reduce((moduleTotal, module) =>
        moduleTotal + globalOperationCosts.filter(op =>
          op.operationCode.startsWith(`${app.appCode}.${module.moduleCode}.`)
        ).length, 0) || 0), 0),
    totalPermissions: applicationsToShow.reduce((total, app) =>
      total + (app.modules?.reduce((moduleTotal, module) =>
        moduleTotal + (module.permissions?.length || 0), 0) || 0), 0)
  };

  return (
    <div className="space-y-6">
      {/* Filter Status Info */}
      <div className={`p-4 rounded-lg border-l-4 ${mode === 'global' ? 'border-l-blue-500 bg-blue-50' : 'border-l-green-500 bg-green-50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="text-sm font-medium">
              {mode === 'global' ? '🌍 Global Configuration' : `🏢 ${selectedTenant?.companyName || 'Tenant'} Configuration`}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {mode === 'global'
                ? `Showing all ${applications.length} available applications in the system. Changes here will affect all tenants globally.`
                : `Showing ${applicationsToShow.length} applications assigned to ${selectedTenant?.companyName || 'this tenant'}. Only tenant-assigned applications are displayed.`
              }
            </div>
            {mode === 'tenant' && selectedTenant && (
              <div className="mt-2 space-y-2">
                <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  💡 <strong>How it works:</strong> When no tenant-specific cost exists, the global default is used. Use "Create Override" buttons to set custom costs for this tenant only.
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>Tenant Override</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span>Global Default</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className={`text-lg font-bold ${mode === 'global' ? 'text-blue-600' : 'text-green-600'}`}>
              {applicationsToShow.length} apps
            </div>
            <div className="text-xs text-muted-foreground">
              {mode === 'global' ? 'available' : 'assigned'}
            </div>
          </div>
        </div>
      </div>

      {/* Show message if no applications available */}
      {applicationsToShow.length === 0 && mode === 'tenant' && selectedTenant && (
        <div className="text-center py-8">
          <div className="text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No Applications Assigned</p>
            <p className="text-sm">
              {selectedTenant.companyName} doesn't have any applications assigned yet.
            </p>
            <p className="text-xs mt-2 text-blue-600">
              Assign applications to this tenant in the application assignment settings.
            </p>
          </div>
        </div>
      )}

      {/* Applications List */}
      {applicationsToShow.map((app) => {
        const isAppSelected = selectedApps.has(app.appCode);
        const isExpanded = expandedApps.has(app.appCode);
        const selectedModulesForApp = selectedModules[app.appCode] || new Set();

        return (
          <Card
            key={app.appId}
            className={`border-2 rounded-xl transition-all duration-200 ${
              isAppSelected
                ? 'border-purple-300 bg-purple-50 shadow-lg'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
            }`}
          >
            {/* Application Header */}
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <Checkbox
                    checked={isAppSelected}
                    onCheckedChange={() => toggleAppSelection(app.appCode)}
                    className={isAppSelected ? 'border-purple-500 bg-purple-500' : ''}
                  />

                  <div className="flex-1">
                          <h4 className="text-xl font-bold text-primary flex items-center gap-3 mb-2">
                            <Package className="w-6 h-6 text-purple-600" />
                            {app.appName}
                            {mode === 'tenant' && (() => {
                              const hasOverrides = tenantConfigurations?.configurations.operations.some(
                                (op: any) => op.operationCode.startsWith(`${app.appCode}.`)
                              ) || tenantConfigurations?.configurations.modules.some(
                                (mod: any) => mod.moduleCode.startsWith(`${app.appCode}.`)
                              ) || costChanges[app.appCode]?.appCost !== undefined;

                              return hasOverrides ? (
                                <Badge className="text-xs bg-green-100 text-green-700 border-green-300">
                                  🏢 Has Tenant Overrides
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                                  🌍 Using Global Defaults
                                </Badge>
                              );
                            })()}
                          </h4>
                    <p className="text-gray-600 mb-3">{app.description}</p>
                    <div className="flex items-center gap-4">
                      <span className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-medium">
                        {app.modules?.length || 0} modules
                      </span>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const appOperations = globalOperationCosts.filter(op => op.operationCode.startsWith(`${app.appCode}.`));
                          const configuredOps = appOperations.length;
                          const totalModules = app.modules?.length || 0;
                          return (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {configuredOps} operations configured across {totalModules} modules
                            </span>
                          );
                        })()}
                      </div>
                      {isAppSelected && (
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">App Default:</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={costChanges[app.appCode]?.appCost?.toString() || ""}
                            className={`w-20 h-8 text-sm ${
                              costChanges[app.appCode]?.appCost !== undefined
                                ? 'border-orange-500 bg-orange-50'
                                : ''
                            }`}
                            onChange={(e) => {
                              const newCost = parseFloat(e.target.value) || 0;
                              handleAppCostChange(app.appCode, newCost);
                            }}
                          />
                          <span className="text-sm text-muted-foreground">credits</span>
                          {mode === 'tenant' && costChanges[app.appCode]?.appCost === undefined && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-300"
                              onClick={() => {
                                // Pre-fill with a default application cost
                                handleAppCostChange(app.appCode, 10.0);
                              }}
                            >
                              Create Override
                            </Button>
                          )}
                        </div>
                      )}
                      {mode === 'tenant' && isAppSelected && costChanges[app.appCode]?.appCost === undefined && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Using global application configuration • Click "Create Override" to set tenant-specific cost
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {isAppSelected && (
                    <div className="text-right">
                      <div className="text-lg font-bold text-purple-600">
                        {selectedModulesForApp.size}/{app.modules?.length || 0}
                      </div>
                      <div className="text-sm text-purple-600 font-medium">modules selected</div>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedApps(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(app.appCode)) {
                        newSet.delete(app.appCode);
                      } else {
                        newSet.add(app.appCode);
                      }
                      return newSet;
                    })}
                    className={`p-3 rounded-xl transition-colors ${
                      isExpanded ? 'bg-gray-100 text-gray-700' : 'hover:bg-gray-100 text-gray-500'
                    }`}
                  >
                    {isExpanded ? '−' : '+'}
                  </Button>
                </div>
              </div>

              {/* Modules and Operations */}
              {isExpanded && isAppSelected && (
                <div className="border-t border-purple-200 bg-white/70 p-6">
                  <div className="mb-6">
                    <h5 className="text-lg font-semibold text-primary mb-2">
                      {mode === 'global' ? 'Available Modules' : 'Enabled Modules'}
                    </h5>
                    <p className="text-sm text-gray-600">
                      {mode === 'global'
                        ? `Select modules and configure credit costs for operations within ${app.appName}`
                        : `Select from ${selectedTenant?.companyName || 'tenant'}-enabled modules in ${app.appName} to configure costs`
                      }
                    </p>
                  </div>

                  <ModuleConfiguration
                    app={app}
                    globalOperationCosts={globalOperationCosts}
                    mode={mode}
                    selectedTenant={selectedTenant}
                    tenantConfigurations={tenantConfigurations}
                    selectedModules={selectedModulesForApp}
                    selectedOperations={selectedOperations}
                    expandedModules={expandedModules}
                    expandedOperations={expandedOperations}
                    costChanges={costChanges}
                    onToggleModule={(moduleCode) => toggleModuleSelection(app.appCode, moduleCode)}
                    onToggleOperation={(moduleCode, operationCode) => toggleOperationSelection(app.appCode, moduleCode, operationCode)}
                    onModuleCostChange={(moduleCode, cost) => handleModuleCostChange(app.appCode, moduleCode, cost)}
                    onOperationCostChange={(moduleCode, operationCode, cost) => {
                      const fullOperationCode = `${app.appCode}.${moduleCode}.${operationCode}`;
                      handleOperationCostChange(app.appCode, moduleCode, fullOperationCode, cost);
                    }}
                    onToggleModuleExpansion={(moduleKey) => setExpandedModules(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(moduleKey)) {
                        newSet.delete(moduleKey);
                      } else {
                        newSet.add(moduleKey);
                      }
                      return newSet;
                    })}
                    onToggleOperationExpansion={(operationKey) => setExpandedOperations(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(operationKey)) {
                        newSet.delete(operationKey);
                      } else {
                        newSet.add(operationKey);
                      }
                      return newSet;
                    })}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Configuration includes {summary.totalApps} applications, {summary.totalModules} modules, {summary.totalOperations} operations, and {summary.totalPermissions} permissions
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onPreview}
                disabled={Object.keys(costChanges).length === 0}
              >
                👁️ Preview Changes
                {Object.keys(costChanges).length > 0 && (
                  <span className="ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
                    {Object.keys(costChanges).length} apps modified
                  </span>
                )}
              </Button>
              <Button
                onClick={onSave}
                disabled={Object.keys(costChanges).length === 0}
                className={Object.keys(costChanges).length > 0 ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                💾 Save Changes
                {Object.keys(costChanges).length > 0 && (
                  <span className="ml-2">
                    ({Object.keys(costChanges).length} apps)
                  </span>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
