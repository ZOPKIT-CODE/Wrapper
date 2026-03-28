import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme/ThemeProvider';
import { api } from '@/lib/api';
import { operationCostAPI, creditConfigurationAPI, applicationAssignmentAPI } from '@/lib/api';
import { runMutationWithFeedback } from '@/lib/mutation-feedback';
import {
  Application,
  OperationCost,
  Tenant,
  CostChanges,
  ChangeImpact
} from './credit-configuration/types';
import {
  WarningModal,
  ComparisonModal
} from './credit-configuration/components';

const CreditManagement: React.FC = () => {
  // Core State
  const [operationCosts, setOperationCosts] = useState<OperationCost[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [allAvailableApplications, setAllAvailableApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantConfigurations, setTenantConfigurations] = useState<any>(null);

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [matrixSearchQuery, setMatrixSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('global');
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  // Changes State
  const [costChanges, setCostChanges] = useState<CostChanges>({});

  // Modals State
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [changeImpact, setChangeImpact] = useState<ChangeImpact | null>(null);

  // Computed Stats
  const changeCount = useMemo(() => {
    return Object.values(costChanges).reduce((total, appChanges) => {
      let count = 0;
      if (appChanges.operationCosts) count += Object.keys(appChanges.operationCosts).length;
      if (appChanges.moduleCosts) count += Object.keys(appChanges.moduleCosts).length;
      if (appChanges.appCost !== undefined) count += 1;
      return total + count;
    }, 0);
  }, [costChanges]);

  // Helper: Analyze permission type
  const analyzePermissionType = (permCode: string) => {
    const code = permCode.toLowerCase();
    if (code.includes('admin') || code.includes('manage') || code.includes('delete')) {
      return { risk: 'high', icon: <Lock className="w-3 h-3 text-rose-600 dark:text-rose-400" /> };
    }
    if (code.includes('write') || code.includes('edit') || code.includes('create') || code.includes('update')) {
      return { risk: 'medium', icon: <Edit className="w-3 h-3 text-amber-600 dark:text-amber-400" /> };
    }
    return { risk: 'low', icon: <Eye className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> };
  };

  const getAppIcon = (appKey: string) => {
    const key = appKey.toLowerCase();
    const props = { className: "w-4 h-4" };
    if (key.includes('crm')) return <Activity {...props} className="text-blue-500" />;
    if (key.includes('hr')) return <Building2 {...props} className="text-emerald-500" />;
    if (key.includes('finance')) return <Coins {...props} className="text-amber-500" />;
    return <Package {...props} className="text-slate-400" />;
  };

  // Data Loading
  const loadInitialData = useCallback(async (manageLoadingState = true) => {
    if (manageLoadingState) setLoading(true);
    try {
      const [opsRes, tenantsRes, appsRes] = await Promise.all([
        operationCostAPI.getGlobalOperationCosts({ includeUsage: true }),
        applicationAssignmentAPI.getTenants(),
        applicationAssignmentAPI.getApplications({ includeModules: true })
      ]);
      setOperationCosts(opsRes.data?.data?.operations || []);
      setTenants(tenantsRes.data.data.tenants || []);
      setAllAvailableApplications(appsRes.data.data.applications || []);
    } catch (error) {
      toast.error('Failed to load initial data');
    } finally {
      if (manageLoadingState) setLoading(false);
    }
  }, []);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);

  const loadTenantConfigurations = useCallback(async (tenantId: string, manageLoadingState = true) => {
    try {
      if (manageLoadingState) setLoading(true);
      const response = await creditConfigurationAPI.getTenantConfigurations(tenantId);
      setTenantConfigurations(response.data);
    } catch (error) {
      toast.error('Failed to load tenant configurations');
    } finally {
      if (manageLoadingState) setLoading(false);
    }
  }, []);

  // Filter Logic
  const filteredTenants = useMemo(() => {
    return tenants.filter(t => t.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || t.subdomain.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [tenants, searchTerm]);

  const filteredApps = useMemo(() => {
    const appsSource = activeTab === 'tenants' && selectedTenant
      ? allAvailableApplications.filter(app => selectedTenant.applications?.some(ta => ta.appId === app.appId))
      : allAvailableApplications;
    if (!matrixSearchQuery.trim()) return appsSource;
    const query = matrixSearchQuery.toLowerCase();
    return appsSource.map(app => {
      const appMatches = app.appName.toLowerCase().includes(query) || app.appCode.toLowerCase().includes(query);
      const filteredModules = app.modules?.filter(m => m.moduleName.toLowerCase().includes(query) || m.moduleCode.toLowerCase().includes(query) || m.permissions?.some(p => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query)));
      return (appMatches || (filteredModules && filteredModules.length > 0)) ? { ...app, modules: filteredModules } : null;
    }).filter(Boolean) as Application[];
  }, [allAvailableApplications, matrixSearchQuery, activeTab, selectedTenant]);

  // Status Helpers
  const getPermissionStatus = (appCode: string, moduleCode: string, permCode: string) => {
    const opCode = `${appCode}.${moduleCode}.${permCode}`;
    let existingCost = 0;
    let source: 'global' | 'tenant' | 'none' = 'none';
    if (activeTab === 'tenants' && tenantConfigurations) {
      const override = tenantConfigurations.configurations?.operations?.find((op: any) => op.operationCode === opCode);
      if (override) { existingCost = override.creditCost; source = 'tenant'; }
      else {
        const globalDefault = operationCosts.find(op => op.operationCode === opCode);
        if (globalDefault) { existingCost = globalDefault.creditCost; source = 'global'; }
      }
    } else {
      const globalDefault = operationCosts.find(op => op.operationCode === opCode);
      if (globalDefault) { existingCost = globalDefault.creditCost; source = 'global'; }
    }
    const pendingCost = costChanges[appCode]?.operationCosts?.[opCode];
    const isChanged = pendingCost !== undefined;
    return { existingCost, pendingCost: isChanged ? pendingCost : existingCost, isChanged, source };
  };

  const getModuleStats = (appCode: string, moduleCode: string) => {
    const prefix = `${appCode}.${moduleCode}.`;
    let total = 0, count = 0;
    if (activeTab === 'tenants' && tenantConfigurations) {
      tenantConfigurations.configurations?.operations?.forEach((op: any) => {
        if (op.operationCode.startsWith(prefix)) { total += op.creditCost; count++; }
      });
    }
    operationCosts.forEach(op => {
      if (op.operationCode.startsWith(prefix)) {
        const hasOverride = activeTab === 'tenants' && tenantConfigurations?.configurations?.operations?.some((c: any) => c.operationCode === op.operationCode);
        if (!hasOverride) { total += op.creditCost; count++; }
      }
    });
    return { avg: count > 0 ? (total / count).toFixed(1) : '0', total, count, pending: costChanges[appCode]?.moduleCosts?.[moduleCode] };
  };

  const getAppStats = (appCode: string) => {
    const appOps = operationCosts.filter(op => op.category === appCode.toUpperCase());
    const total = appOps.reduce((sum, op) => sum + op.creditCost, 0);
    return { total, count: appOps.length, pending: costChanges[appCode]?.appCost };
  };

  // Handlers
  const handlePermissionChange = (appCode: string, opCode: string, val: string) => {
    const cost = parseFloat(val) || 0;
    setCostChanges(prev => ({
      ...prev,
      [appCode]: { ...prev[appCode], operationCosts: { ...prev[appCode]?.operationCosts, [opCode]: cost } }
    }));
  };

  const handleModuleChange = (appCode: string, modCode: string, val: string) => {
    const cost = parseFloat(val) || 0;
    setCostChanges(prev => ({
      ...prev,
      [appCode]: { ...prev[appCode], moduleCosts: { ...prev[appCode]?.moduleCosts, [modCode]: cost } }
    }));
  };

  const handleAppChange = (appCode: string, val: string) => {
    const cost = parseFloat(val) || 0;
    setCostChanges(prev => ({
      ...prev,
      [appCode]: { ...prev[appCode], appCost: cost }
    }));
  };

  const handleSave = () => {
    if (Object.keys(costChanges).length === 0) return;
    setChangeImpact({ affectedOperations: changeCount, affectedTenants: activeTab === 'global' ? tenants.length : 1, estimatedImpact: `Syncing ${changeCount} cost changes.` });
    setShowComparisonModal(true);
  };

  const handleConfirmChanges = async () => {
    // Prevent double-submit if a save is already in progress
    if (loading) return;
    try {
      setLoading(true);
      await runMutationWithFeedback({
        scope: 'credit-config-save',
        idParts: [activeTab, selectedTenant?.tenantId, Object.keys(costChanges).length],
        loadingMessage: 'Saving configuration...',
        successMessage: 'Configuration saved',
        errorMessage: 'Save failed',
        execute: async (idempotencyKey) => {
          const savePromises = [];
          const pendingUpdates = new Map<string, number>();

          for (const [appCode, appChanges] of Object.entries(costChanges)) {
            const app = allAvailableApplications.find(a => a.appCode === appCode);
            if (!app) continue;
            app.modules?.forEach(mod => {
              mod.permissions?.forEach(perm => {
                const opCode = `${appCode}.${mod.moduleCode}.${perm.code}`;
                let cost: number | null = null;
                if (appChanges.operationCosts?.[opCode] !== undefined) cost = appChanges.operationCosts[opCode];
                else if (appChanges.moduleCosts?.[mod.moduleCode] !== undefined) cost = appChanges.moduleCosts[mod.moduleCode];
                else if (appChanges.appCost !== undefined) cost = appChanges.appCost;
                if (cost !== null) pendingUpdates.set(opCode, cost);
              });
            });
          }

          for (const [opCode, cost] of pendingUpdates.entries()) {
            const appCode = opCode.split('.')[0];
            if (activeTab === 'global') {
              savePromises.push(api.post('/admin/operation-costs', {
                operationCode: opCode,
                operationName: opCode.split('.').pop() || '',
                creditCost: cost,
                unit: 'operation',
                unitMultiplier: 1,
                category: appCode.toUpperCase(),
                isActive: true,
                priority: 100
              }, {
                headers: {
                  'X-Idempotency-Key': `${idempotencyKey}:${opCode}`
                }
              }));
            } else if (selectedTenant) {
              savePromises.push(api.put(`/admin/credit-configurations/${selectedTenant.tenantId}/operation/${opCode}`, {
                creditCost: cost,
                unit: 'operation',
                unitMultiplier: 1,
                scope: 'tenant',
                isActive: true
              }, {
                headers: {
                  'X-Idempotency-Key': `${idempotencyKey}:${opCode}`
                }
              }));
            }
          }

          await Promise.all(savePromises);
          return { saved: savePromises.length };
        }
      });

      setCostChanges({});
      setShowWarningModal(false);
      // Pass false so the inner functions don't fight over the loading state;
      // the outer finally block owns the single loading=false at the end.
      await loadInitialData(false);
      if (selectedTenant) await loadTenantConfigurations(selectedTenant.tenantId, false);
    } catch (error) {
      // Toast is handled by mutation helper.
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4 relative pb-10">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl flex items-center justify-center shadow-inner"><Coins className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">Credit Console <Badge variant="outline" className="text-[9px] font-bold uppercase py-0 border-primary/20">{activeTab}</Badge></h1>
          <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider opacity-60">High-Density Matrix Management</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 p-1 bg-slate-100 dark:bg-slate-900 h-10">
          <TabsTrigger value="global" className="flex items-center gap-2 text-[11px] font-black uppercase data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800"><LayoutGrid className="h-3.5 w-3.5" /> Global Standards</TabsTrigger>
          <TabsTrigger value="tenants" className="flex items-center gap-2 text-[11px] font-black uppercase data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800"><Building2 className="h-3.5 w-3.5" /> Tenant Overrides</TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="m-0 space-y-4">
          <CompactMatrix apps={filteredApps} activeTab="global" loading={loading} isDark={isDark} glass={glass} matrixSearchQuery={matrixSearchQuery} setMatrixSearchQuery={setMatrixSearchQuery} getPermissionStatus={getPermissionStatus} getModuleStats={getModuleStats} getAppStats={getAppStats} handlePermissionChange={handlePermissionChange} handleModuleChange={handleModuleChange} handleAppChange={handleAppChange} getAppIcon={getAppIcon} analyzePermissionType={analyzePermissionType} changeCount={changeCount} onSave={handleSave} onDiscard={() => setCostChanges({})} onPreview={() => setShowComparisonModal(true)} />
        </TabsContent>

        <TabsContent value="tenants" className="m-0 pt-2">
          <div className="flex gap-6 items-start h-[750px]">
            {/* Sidebar: Ultra-Compact Tenant Selector */}
            <div className="w-[200px] flex-none">
              <Card className="border-slate-200 dark:border-slate-800 h-full flex flex-col overflow-hidden shadow-sm rounded-3xl bg-slate-50/50 dark:bg-slate-900/50">
                <CardHeader className="p-3 border-b bg-white dark:bg-slate-950">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input placeholder="Filter..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 h-8 text-[10px] font-black bg-slate-50 dark:bg-slate-900 border-none shadow-inner" />
                  </div>
                </CardHeader>
                <CardContent className="p-2 overflow-y-auto flex-1 custom-scrollbar">
                  {filteredTenants.map((t) => (
                    <button
                      key={t.tenantId}
                      onClick={() => { setSelectedTenant(t); loadTenantConfigurations(t.tenantId); }}
                      className={cn(
                        "w-full px-3 py-2.5 rounded-2xl text-left transition-all mb-1 group relative",
                        selectedTenant?.tenantId === t.tenantId
                          ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]"
                          : "hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                      )}
                    >
                      <p className="font-black text-[10px] truncate leading-tight uppercase tracking-tight">{t.companyName}</p>
                      <p className={cn("text-[7px] uppercase font-black tracking-widest mt-0.5", selectedTenant?.tenantId === t.tenantId ? "text-white/60" : "text-slate-400 opacity-60")}>{t.subdomain}</p>
                      {selectedTenant?.tenantId === t.tenantId && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1 h-3 bg-white/40 rounded-full" />
                      )}
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Matrix: High-Expansion Panel */}
            <div className="flex-1 min-w-0 h-full">
              {selectedTenant ? (
                <CompactMatrix apps={filteredApps} activeTab="tenants" loading={loading} isDark={isDark} glass={glass} matrixSearchQuery={matrixSearchQuery} setMatrixSearchQuery={setMatrixSearchQuery} getPermissionStatus={getPermissionStatus} getModuleStats={getModuleStats} getAppStats={getAppStats} handlePermissionChange={handlePermissionChange} handleModuleChange={handleModuleChange} handleAppChange={handleAppChange} getAppIcon={getAppIcon} analyzePermissionType={analyzePermissionType} tenantName={selectedTenant.companyName} changeCount={changeCount} onSave={handleSave} onDiscard={() => setCostChanges({})} />
              ) : (
                <div className="h-full flex items-center justify-center border-2 border-dashed rounded-[40px] bg-slate-50/20 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl border border-slate-100 dark:border-slate-800"><Building2 className="h-8 w-8 text-primary/40" /></div>
                    <h3 className="text-[12px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-[0.2em]">Select Infrastructure</h3>
                    <p className="text-slate-400 text-[9px] font-bold mt-2 uppercase tracking-widest opacity-60">Tenant isolation protocol pending</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <WarningModal isOpen={showWarningModal} onClose={() => setShowWarningModal(false)} onConfirm={handleConfirmChanges} changeImpact={changeImpact} />
      <ComparisonModal
        isOpen={showComparisonModal}
        onClose={() => setShowComparisonModal(false)}
        onProceed={() => { setShowComparisonModal(false); setShowWarningModal(true); }}
        costChanges={costChanges}
        applications={allAvailableApplications}
        globalOperationCosts={operationCosts}
        mode={activeTab as 'global' | 'tenant'}
        tenantCount={tenants.length}
        tenantName={selectedTenant?.companyName}
      />
    </div>
  );
};

const CompactMatrix = ({ apps, activeTab, loading, isDark, glass, matrixSearchQuery, setMatrixSearchQuery, getPermissionStatus, getModuleStats, getAppStats, handlePermissionChange, handleModuleChange, handleAppChange, getAppIcon, analyzePermissionType, tenantName, changeCount, onSave, onDiscard }: any) => {
  return (
    <div className={cn("flex flex-col border rounded-3xl overflow-hidden shadow-2xl relative transition-all bg-white dark:bg-slate-950", isDark ? "border-slate-800" : "border-slate-200", glass && "backdrop-blur-xl")}>
      {/* Top Loader */}
      <div className={cn("absolute top-0 left-0 right-0 h-0.5 z-50 overflow-hidden transition-opacity", loading ? "opacity-100" : "opacity-0")}>
        <div className="w-full h-full bg-primary/20"><div className="h-full bg-primary animate-progress-indeterminate" /></div>
      </div>

      {/* Header Toolbar */}
      <div className={cn("p-4 border-b flex items-center justify-between gap-4", isDark ? "bg-slate-950/90" : "bg-slate-50/90")}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shadow-inner"><Database className="w-4 h-4" /></div>
          <div>
            <h2 className="text-[14px] font-black text-[#1B2E5A] dark:text-slate-100 tracking-tight">{activeTab === 'global' ? 'System Infrastructure' : `${tenantName}`}</h2>
            <div className="flex items-center gap-2 opacity-60">
              <span className="text-[9px] uppercase font-black text-slate-500">Architecture Matrix</span>
              <div className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="text-[9px] uppercase font-black text-primary">{apps.length} Apps Active</span>
            </div>
          </div>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input placeholder="Search matrix..." value={matrixSearchQuery} onChange={(e) => setMatrixSearchQuery(e.target.value)} className={cn("w-full pl-9 pr-3 py-2 rounded-xl text-[11px] font-black outline-none border transition-all", isDark ? "bg-slate-900 border-slate-800 focus:border-primary" : "bg-white border-slate-200 focus:border-primary")} />
        </div>

        {/* Change Indicator (Integrated) */}
        {changeCount > 0 && (
          <div className="flex items-center gap-2 pl-4 border-l">
            <button
              onClick={onSave}
              className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-primary/5 transition-all group"
              title="Audit detailed changes"
            >
              <Badge className="bg-primary bg-primary text-white border-none text-[9px] px-2 h-6 animate-pulse uppercase font-black cursor-pointer">
                {changeCount} Modifications
              </Badge>
              <span className="text-[10px] font-black uppercase text-primary opacity-0 group-hover:opacity-100 transition-opacity">Audit Details</span>
            </button>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg hover:bg-rose-500/10 text-rose-500" onClick={onDiscard}><RotateCcw className="w-3.5 h-3.5" /></Button>
              <Button size="sm" className="h-7 px-3 text-[9px] font-black uppercase shadow-lg shadow-primary/20" onClick={onSave}>Commit Changes</Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Accordion Flow */}
      <div className="overflow-y-auto max-h-[700px] custom-scrollbar p-3">
        <Accordion type="single" collapsible className="space-y-2">
          {apps.map((app: any) => {
            const appStats = getAppStats(app.appCode);
            const isAppChanged = appStats.pending !== undefined;

            return (
              <AccordionItem key={app.appCode} value={app.appCode} className={cn("border rounded-2xl overflow-hidden transition-all", isAppChanged ? "border-orange-200 bg-orange-50/10 dark:border-orange-900/30 dark:bg-orange-900/5" : "bg-slate-50/30 dark:bg-slate-900/30")}>
                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-slate-100 dark:hover:bg-slate-800 transition-all [&[data-state=open]]:bg-primary/5 active:bg-primary/10">
                  <div className="flex items-center justify-between w-full pr-4 text-left">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border relative">
                        {getAppIcon(app.appCode)}
                        {isAppChanged && <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse border-2 border-white dark:border-slate-800" />}
                      </div>
                      <div>
                        <div className="text-[13px] font-black text-[#1B2E5A] dark:text-white uppercase flex items-center gap-2 leading-none">
                          {app.appName}
                          <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-bold border-slate-300 dark:border-slate-700">{app.appCode}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{app.modules?.length} Systems</span>
                          <div className="w-1 h-1 rounded-full bg-slate-300" />
                          <span className="text-[9px] text-primary/60 font-black uppercase tracking-wider">Avg: {(appStats.total / (appStats.count || 1)).toFixed(1)} CR</span>
                          {isAppChanged && (
                            <span className="flex items-center gap-1 text-[8px] font-black text-orange-600 dark:text-orange-400 uppercase animate-pulse">
                              <AlertCircle className="w-2.5 h-2.5" /> Save to Commit
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
                      <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700" />
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-3">
                          <p className="text-[9px] font-black text-slate-400 uppercase leading-none text-right">Batch Domain<br />Override</p>
                          <div className="relative w-24">
                            <Input type="number" step="0.5" className={cn("h-8 text-[11px] font-black pl-2 pr-6 bg-white dark:bg-slate-950 focus:ring-1 focus:ring-primary", isAppChanged ? "border-orange-300 dark:border-orange-800" : "border-slate-200")} value={appStats.pending || ''} onChange={(e) => handleAppChange(app.appCode, e.target.value)} placeholder="0.0" />
                            <Edit className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-primary opacity-30" />
                          </div>
                          <Badge className="bg-primary/10 text-primary border-none text-[8px] h-5">APP</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-0 border-t bg-white dark:bg-slate-950">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {app.modules?.map((module: any) => {
                      const stats = getModuleStats(app.appCode, module.moduleCode);
                      const isModuleChanged = stats.pending !== undefined;

                      return (
                        <div key={module.moduleCode} className={cn("p-4 grid grid-cols-12 gap-6 items-start transition-colors", isModuleChanged ? "bg-orange-50/5 dark:bg-orange-900/5" : "hover:bg-slate-50/50 dark:hover:bg-slate-900/50")}>
                          {/* Module Column */}
                          <div className="col-span-2 border-r pr-4 space-y-4">
                            <div>
                              <div className="text-[12px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight">{module.moduleName}</div>
                              <div className="text-[9px] text-slate-400 font-bold uppercase">{module.moduleCode}</div>
                            </div>
                            <div className="space-y-2 pt-2 border-t">
                              <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase">
                                <span>Current Avg</span>
                                <span className="text-slate-900 dark:text-white">{stats.avg} CR</span>
                              </div>
                              <div className="relative">
                                <Input type="number" step="0.5" className={cn("h-7 text-[10px] font-black pl-2 pr-7 bg-slate-50/50 dark:bg-slate-900/50", isModuleChanged ? "border-orange-300 dark:border-orange-800" : "border-slate-200")} value={stats.pending || ''} onChange={(e) => handleModuleChange(app.appCode, module.moduleCode, e.target.value)} placeholder="0.0" />
                                <Package className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-400 opacity-30" />
                              </div>
                              {isModuleChanged && (
                                <div className="flex items-center gap-1 text-[8px] font-black text-orange-600 dark:text-orange-400 uppercase animate-pulse">
                                  <AlertCircle className="w-2.5 h-2.5" /> Save to Commit
                                </div>
                              )}
                              <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-none text-[8px] h-4 w-fit uppercase font-black">Sync Module</Badge>
                            </div>
                          </div>

                          {/* Permissions Chip Grid (Fixed 6-Column Layout) */}
                          <div className="col-span-10">
                            <div className="grid grid-cols-6 gap-2 w-full">
                              {module.permissions?.map((p: any) => {
                                const s = getPermissionStatus(app.appCode, module.moduleCode, p.code);
                                const { icon } = analyzePermissionType(p.code);
                                return (
                                  <div key={p.code} className={cn(
                                    "group/chip relative flex flex-col gap-1.5 p-2 rounded-xl border transition-all hover:shadow-lg h-full",
                                    s.isChanged ? "bg-orange-50/50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-800 shadow-orange-500/5" :
                                      s.source === 'tenant' ? "bg-blue-50/50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-800 shadow-blue-500/5" :
                                        "bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 shadow-sm"
                                  )}>
                                    <div className="flex items-start justify-between">
                                      <div className="opacity-60">{icon}</div>
                                      <Badge variant="outline" className={cn("text-[7px] h-3.5 px-1 font-black leading-none", s.isChanged ? "border-orange-200 text-orange-600" : "border-slate-200 text-slate-400")}>
                                        {s.isChanged ? 'PENDING' : s.source.toUpperCase()}
                                      </Badge>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="text-[9.5px] font-black text-slate-900 dark:text-slate-100 truncate uppercase leading-tight" title={p.name}>{p.name}</div>
                                      <div className="text-[8px] font-bold text-slate-400 flex items-center gap-1 mt-0.5 uppercase tracking-tighter">
                                        <Hash className="w-2 h-2" /> {p.code}
                                      </div>
                                    </div>

                                    <div className="relative mt-auto pt-2 border-t border-slate-50 dark:border-slate-900">
                                      <input
                                        className={cn(
                                          "w-full h-7 px-2 text-[11px] font-black text-right rounded-lg bg-slate-100/30 dark:bg-slate-900/30 border transition-all outline-none",
                                          s.isChanged ? "border-orange-200 focus:ring-1 focus:ring-orange-400" : "border-transparent focus:ring-1 focus:ring-primary"
                                        )}
                                        type="number"
                                        step="0.1"
                                        value={s.pendingCost}
                                        onChange={(e) => handlePermissionChange(app.appCode, `${app.appCode}.${module.moduleCode}.${p.code}`, e.target.value)}
                                      />
                                      <span className="absolute left-2 top-[13px] text-[8px] font-black text-slate-300">CR</span>
                                      {s.isChanged && <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse border-2 border-white dark:border-slate-900" />}
                                    </div>

                                    <div className="flex items-center justify-between text-[7.5px] font-bold text-slate-400 mt-1 uppercase opacity-60">
                                      <span>Current: {s.existingCost}</span>
                                      {s.isChanged && <span className="text-orange-500 animate-pulse">Save</span>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
};

export { CreditManagement };
