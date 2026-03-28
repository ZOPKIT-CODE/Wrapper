import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme/ThemeProvider';
import { toast } from 'sonner';
import { applicationAssignmentAPI } from '@/lib/api';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { runMutationWithFeedback } from '@/lib/mutation-feedback';

interface Application {
  appId: string;
  appCode: string;
  appName: string;
  description?: string;
  icon?: string;
  baseUrl?: string;
  isCore?: boolean;
  sortOrder?: number;
  subscriptionTier?: string;
  modules?: ApplicationModule[];
}

interface Permission {
  code: string;
  name: string;
  description: string;
}

interface ApplicationModule {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  description?: string;
  isCore: boolean;
  permissions?: Permission[];
}

interface Tenant {
  tenantId: string;
  companyName: string;
  subdomain: string;
  isActive: boolean;
  createdAt: string;
  assignmentCount: number;
  enabledCount: number;
  applications: TenantApplication[];
}

interface TenantApplication {
  id: string;
  appId: string;
  appCode: string;
  appName: string;
  isEnabled: boolean;
  subscriptionTier: string;
  enabledModules: string[];
  maxUsers?: number;
  createdAt: string;
  permissions?: string[];
  customPermissions?: Record<string, string[]>;
}

interface AssignmentOverview {
  totalApplications: number;
  totalAssignments: number;
  tenantStats: {
    withApps: number;
    withoutApps: number;
  };
  applicationStats: Array<{
    appId: string;
    appCode: string;
    appName: string;
    assignmentCount: number;
    enabledCount: number;
  }>;
}

const ApplicationAssignmentManager: React.FC = () => {
  const queryClient = useQueryClient();
  // Main state
  const [overview, setOverview] = useState<AssignmentOverview | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantApplications, setTenantApplications] = useState<Application[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('tenants');
  const [matrixSearchQuery, setMatrixSearchQuery] = useState('');

  // Matrix/Assignment Config State
  const [assignmentConfig, setAssignmentConfig] = useState({
    isEnabled: true,
    subscriptionTier: 'basic',
    enabledModules: [] as string[],
    selectedPermissions: {} as Record<string, string[]>,
  });

  // Track original state for visual diff and "Commit" logic
  const [originalPermissions, setOriginalPermissions] = useState<Record<string, string[]>>({});
  const [originalModules, setOriginalModules] = useState<string[]>([]);

  const { actualTheme, glassmorphismEnabled } = useTheme();
  const isDark = actualTheme === 'dark';
  const glass = glassmorphismEnabled;

  const analyzePermissionType = (permCode: string) => {
    const code = permCode.toLowerCase();
    if (code.includes('admin') || code.includes('manage') || code.includes('delete')) {
      return {
        risk: 'high',
        color: 'border-rose-100 bg-white hover:bg-rose-50/50 hover:border-rose-200 text-rose-700/70 dark:bg-slate-900 dark:border-rose-900/30 dark:text-rose-400/70',
        selectedColor: 'bg-rose-100 border-rose-400 text-rose-900 shadow-sm ring-1 ring-rose-300 dark:bg-rose-900/60 dark:border-rose-500 dark:text-rose-100 dark:ring-rose-700',
        icon: <Lock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
      };
    }
    if (code.includes('write') || code.includes('edit') || code.includes('create') || code.includes('update')) {
      return {
        risk: 'medium',
        color: 'border-amber-100 bg-white hover:bg-amber-50/50 hover:border-amber-200 text-amber-700/70 dark:bg-slate-900 dark:border-amber-900/30 dark:text-amber-400/70',
        selectedColor: 'bg-amber-100 border-amber-400 text-amber-900 shadow-sm ring-1 ring-amber-300 dark:bg-amber-900/60 dark:border-amber-500 dark:text-amber-100 dark:ring-amber-700',
        icon: <Edit className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
      };
    }
    return {
      risk: 'low',
      color: 'border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400',
      selectedColor: 'bg-emerald-100 border-emerald-400 text-emerald-900 shadow-sm ring-1 ring-emerald-300 dark:bg-emerald-900/60 dark:border-emerald-500 dark:text-emerald-100 dark:ring-emerald-700',
      icon: <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
    };
  };

  const getAppIcon = (appKey: string) => {
    const key = appKey.toLowerCase();
    const props = { className: "w-5 h-5" };
    if (key.includes('crm') || key.includes('sales')) return <Users {...props} className="text-blue-500" />;
    if (key.includes('inventory') || key.includes('product')) return <Package {...props} className="text-indigo-500" />;
    if (key.includes('admin') || key.includes('auth')) return <Shield {...props} className="text-rose-500" />;
    if (key.includes('hr') || key.includes('people')) return <Building2 {...props} className="text-emerald-500" />;
    if (key.includes('billing') || key.includes('finance')) return <Coins {...props} className="text-amber-500" />;
    if (key.includes('analytics') || key.includes('reporting')) return <Activity {...props} className="text-violet-500" />;
    return <Grid {...props} className="text-slate-400" />;
  };

  const filteredMatrixApps = useMemo(() => {
    if (!matrixSearchQuery.trim()) return tenantApplications;
    const query = matrixSearchQuery.toLowerCase();
    return tenantApplications.map((app: Application) => {
      const appMatches = app.appName.toLowerCase().includes(query) || app.appCode.toLowerCase().includes(query);
      const filteredModules = app.modules?.map((module: ApplicationModule) => {
        const moduleMatches = module.moduleName.toLowerCase().includes(query) || module.moduleCode.toLowerCase().includes(query);
        const filteredPermissions = module.permissions?.filter((perm: Permission) =>
          perm.name.toLowerCase().includes(query) || perm.code.toLowerCase().includes(query)
        );
        if (moduleMatches || (filteredPermissions && filteredPermissions.length > 0)) return module;
        return null;
      }).filter(Boolean) as ApplicationModule[];
      if (appMatches || (filteredModules && filteredModules.length > 0)) return app;
      return null;
    }).filter(Boolean) as Application[];
  }, [tenantApplications, matrixSearchQuery]);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const response = await applicationAssignmentAPI.getOverview();
      setOverview(response.data.data);
    } catch (error) {
      console.error('Error loading overview:', error);
      toast.error('Failed to load overview data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTenants = useCallback(async () => {
    try {
      setLoading(true);
      const response = await applicationAssignmentAPI.getTenants({ search: searchTerm, limit: 100 });
      setTenants(response.data.data.tenants || []);
    } catch (error) {
      console.error('Error loading tenants:', error);
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  const loadAllAvailableApplications = useCallback(async () => {
    try {
      await applicationAssignmentAPI.getApplications({ includeModules: true });
      // Removed unused state update if allAvailableApplications is not used anymore
    } catch (error) {
      console.error('Error loading available applications:', error);
    }
  }, []);

  // Tracking ref to prevent infinite loops during tenant synchronization
  const lastLoadedTenantId = React.useRef<string | null>(null);

  const loadTenantApplications = useCallback(async (tenant: Tenant) => {
    // Only reload if it's a different tenant — tracked via ref to avoid stale closure issues
    if (lastLoadedTenantId.current === tenant.tenantId) return;

    try {
      setLoading(true);
      // Fetch all master applications
      const appsResponse = await applicationAssignmentAPI.getApplications({ includeModules: true });
      const allApps = appsResponse.data.data?.applications || [];
      setTenantApplications(allApps);

      // Fetch detailed assignments for this specific tenant
      const tenantAppsResponse = await applicationAssignmentAPI.getTenantApplications(tenant.tenantId);
      const assignedApps = tenantAppsResponse.data.data?.applications || [];

      // Sync the selected tenant's applications list with the detailed data
      setSelectedTenant(prev => prev && prev.tenantId === tenant.tenantId
        ? { ...prev, applications: assignedApps }
        : prev
      );

      const perms: Record<string, string[]> = {};
      const modules: string[] = [];

      assignedApps.forEach((ta: TenantApplication) => {
        const enabledModulesArray = Array.isArray(ta.enabledModules) ? ta.enabledModules : [];
        enabledModulesArray.forEach((m: string) => modules.push(`${ta.appId}::${m}`));

        allApps.forEach((app: Application) => {
          if (app.appId === ta.appId) {
            app.modules?.forEach((mod: ApplicationModule) => {
              if (enabledModulesArray.includes(mod.moduleCode)) {
                const compositeKey = `${ta.appId}::${mod.moduleCode}`;
                const moduleCustomPerms = ta.customPermissions?.[mod.moduleCode];
                if (Array.isArray(moduleCustomPerms)) {
                  perms[compositeKey] = mod.permissions
                    ?.map((p: Permission) => p.code)
                    .filter((code: string) => moduleCustomPerms.includes(code)) || [];
                } else {
                  perms[compositeKey] = mod.permissions?.map((p: Permission) => p.code) || [];
                }
              }
            });
          }
        });
      });

      setAssignmentConfig(prev => ({
        ...prev,
        enabledModules: modules,
        selectedPermissions: perms
      }));
      setOriginalPermissions(perms);
      setOriginalModules(modules);

      lastLoadedTenantId.current = tenant.tenantId;
    } catch (error) {
      console.error('Error loading tenant applications:', error);
      toast.error('Failed to synchronize entity entitlements');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — guard uses ref, no stale closure risk

  // Run once on mount — these callbacks have empty deps so their references never change
  useEffect(() => { loadOverview(); loadAllAvailableApplications(); }, [loadOverview, loadAllAvailableApplications]);
  // Re-run only when searchTerm changes (loadTenants dep tracks it)
  useEffect(() => { loadTenants(); }, [loadTenants]);

  useEffect(() => {
    if (selectedTenant && activeTab === 'manage') {
      loadTenantApplications(selectedTenant);
    }
  }, [selectedTenant, activeTab, loadTenantApplications]);

  const handleRemoveAssignment = async (assignmentId: string, tenantName: string, appName: string) => {
    if (!window.confirm(`Decommission ${appName} from ${tenantName}?`)) return;
    try {
      setLoading(true);
      await runMutationWithFeedback({
        scope: 'decommission-application-assignment',
        idParts: [assignmentId],
        loadingMessage: `Decommissioning ${appName}...`,
        successMessage: `${appName} decommissioned successfully`,
        errorMessage: 'Decommissioning failed',
        execute: (idempotencyKey) => api.delete(`/admin/application-assignments/${assignmentId}`, {
          headers: {
            'X-Idempotency-Key': idempotencyKey
          }
        })
      });
      queryClient.invalidateQueries({ queryKey: ['tenantApps'] });
      queryClient.invalidateQueries({ queryKey: ['applicationAllocations'] });
      lastLoadedTenantId.current = null;
      loadTenants();
      if (selectedTenant) loadTenantApplications(selectedTenant);
    } catch (error) {
      console.error('Removal error:', error);
      toast.error('Decommissioning failed');
    } finally {
      setLoading(false);
    }
  };


  const handleCommitChanges = async () => {
    if (!selectedTenant) return;
    try {
      setLoading(true);

      // Identify which applications have changes in their modules or permissions
      // Uses composite keys (appId::moduleCode) to avoid cross-app contamination
      const appsWithChanges = tenantApplications.filter(app => {
        const appModuleKeys = app.modules?.map(m => `${app.appId}::${m.moduleCode}`) || [];

        const hasModuleChanges = appModuleKeys.some(mk =>
          assignmentConfig.enabledModules.includes(mk) !== originalModules.includes(mk)
        );

        const hasPermissionChanges = appModuleKeys.some(mk => {
          const current = assignmentConfig.selectedPermissions[mk] || [];
          const original = originalPermissions[mk] || [];
          return (
            current.length !== original.length ||
            current.some(p => !original.includes(p)) ||
            original.some(p => !current.includes(p))
          );
        });

        return hasModuleChanges || hasPermissionChanges;
      });

      if (appsWithChanges.length === 0) {
        toast.info('No modifications detected in staging area');
        return;
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
            const appModuleKeys = app.modules?.map(m => `${app.appId}::${m.moduleCode}`) || [];
            const appEnabledModules = appModuleKeys
              .filter(mk => assignmentConfig.enabledModules.includes(mk))
              .map(mk => mk.split('::')[1]);
            const appCustomPermissions: Record<string, string[]> = {};

            appModuleKeys.forEach(mk => {
              if (assignmentConfig.enabledModules.includes(mk)) {
                const moduleCode = mk.split('::')[1];
                appCustomPermissions[moduleCode] = assignmentConfig.selectedPermissions[mk] || [];
              }
            });

            await api.post('/admin/application-assignments/assign', {
              tenantId: selectedTenant.tenantId,
              appId: app.appId,
              enabledModules: appEnabledModules,
              customPermissions: appCustomPermissions,
              isEnabled: true
            }, {
              headers: {
                'X-Idempotency-Key': `${idempotencyKey}:${app.appId}`
              }
            });
          }
          return { committed: appsWithChanges.length };
        }
      });

      setOriginalPermissions({ ...assignmentConfig.selectedPermissions });
      setOriginalModules([...assignmentConfig.enabledModules]);

      queryClient.invalidateQueries({ queryKey: ['tenantApps'] });
      queryClient.invalidateQueries({ queryKey: ['applicationAllocations'] });
      lastLoadedTenantId.current = null;
      await loadTenants();
      const freshTenant = tenants.find(t => t.tenantId === selectedTenant.tenantId);
      if (freshTenant) await loadTenantApplications(freshTenant);
    } catch (error) {
      console.error('Serialization Error:', error);
      toast.error('Commit protocol failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignApplicationDirectly = async (app: Application) => {
    if (!selectedTenant) return;
    try {
      setLoading(true);
      const defaultModules = app.modules?.map(m => m.moduleCode) || [];
      await runMutationWithFeedback({
        scope: 'assign-application-directly',
        idParts: [selectedTenant.tenantId, app.appId],
        loadingMessage: `Deploying ${app.appName}...`,
        successMessage: `Domain ${app.appName} deployed to ${selectedTenant.companyName}`,
        errorMessage: 'Deployment failed',
        execute: (idempotencyKey) => api.post('/admin/application-assignments/assign', {
          tenantId: selectedTenant.tenantId,
          appId: app.appId,
          enabledModules: defaultModules
        }, {
          headers: {
            'X-Idempotency-Key': idempotencyKey
          }
        })
      });
      queryClient.invalidateQueries({ queryKey: ['tenantApps'] });
      queryClient.invalidateQueries({ queryKey: ['applicationAllocations'] });
      lastLoadedTenantId.current = null;
      loadTenants();
      if (selectedTenant) loadTenantApplications(selectedTenant);
    } catch (error) {
      console.error('Deployment failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const pendingChangesCount = useMemo(() => {
    let count = 0;
    Object.keys(assignmentConfig.selectedPermissions).forEach((moduleCode: string) => {
      const current = assignmentConfig.selectedPermissions[moduleCode] || [];
      const original = originalPermissions[moduleCode] || [];
      count += current.filter((p: string) => !original.includes(p)).length;
      count += original.filter((p: string) => !current.includes(p)).length;
    });
    const moduleDiff = assignmentConfig.enabledModules.filter((m: string) => !originalModules.includes(m)).length +
      originalModules.filter((m: string) => !assignmentConfig.enabledModules.includes(m)).length;
    return count + moduleDiff;
  }, [assignmentConfig.selectedPermissions, assignmentConfig.enabledModules, originalPermissions, originalModules]);

  const hasChanges = pendingChangesCount > 0;

  return (
    <div className={cn(
      "flex flex-col h-screen overflow-hidden relative",
      isDark ? "bg-slate-950 text-slate-200" : "bg-slate-50 text-slate-900",
      glass && "backdrop-blur-xl"
    )}>
      {/* Unified Executive Header - Ultra Slim & Integrated */}
      <header className={cn(
        "flex-none h-14 px-6 flex items-center justify-between border-b z-50 transition-all",
        isDark ? "bg-slate-900/80 border-slate-800" : "bg-white/90 border-slate-200"
      )}>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-[#1B2E5A] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
              Security Matrix
            </h1>
          </div>

          {selectedTenant && (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-slate-200 dark:border-slate-800">
              <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-[10px] text-blue-600">
                {selectedTenant.companyName.charAt(0)}
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white truncate max-w-[150px]">
                {selectedTenant.companyName}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          <TabsList className="bg-slate-100 dark:bg-slate-900 h-9 p-1 rounded-lg">
            <TabsTrigger onClick={() => setActiveTab('tenants')} value="tenants" className="h-7 px-4 rounded-md text-[10px] font-black uppercase tracking-widest transition-all">
              <Users className="w-3.5 h-3.5 mr-2" /> Overview
            </TabsTrigger>
            <TabsTrigger onClick={() => setActiveTab('manage')} value="manage" disabled={!selectedTenant} className="h-7 px-4 rounded-md text-[10px] font-black uppercase tracking-widest transition-all">
              <Shield className="w-3.5 h-3.5 mr-2" /> Matrix
            </TabsTrigger>
          </TabsList>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

          {hasChanges ? (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-right">
                <div className="text-[8px] font-black text-orange-500 uppercase tracking-widest leading-none mb-0.5">Staged Changes</div>
                <div className="text-[10px] font-black text-slate-400 tabular-nums leading-none">{pendingChangesCount} MODS</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setAssignmentConfig((prev: any) => ({ ...prev, selectedPermissions: { ...originalPermissions }, enabledModules: [...originalModules] })); }}
                className="h-8 px-3 rounded-lg text-slate-500 hover:text-rose-500 font-black text-[9px] uppercase tracking-widest"
              >
                Abort
              </Button>
              <Button
                size="sm"
                disabled={loading}
                onClick={handleCommitChanges}
                className="h-8 px-4 rounded-lg bg-[#1B2E5A] hover:bg-[#152449] text-white font-black text-[9px] uppercase tracking-widest shadow-lg shadow-blue-500/20 flex items-center gap-2 group/btn"
              >
                {loading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3 group-hover/btn:animate-spin" />
                )}
                Commit Protocol
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-end">
                <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Status</span>
                <span className="text-[9px] font-black text-emerald-500 uppercase flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Synchronized
                </span>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="absolute inset-x-0 bottom-0 top-14 bg-white/10 dark:bg-slate-950/20 backdrop-blur-[2px] z-[100] flex items-center justify-center animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-blue-500/20 animate-ping absolute" />
                <div className="w-12 h-12 rounded-full border-2 border-t-blue-600 animate-spin" />
              </div>
              <span className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] animate-pulse">Processing Protocol</span>
            </div>
          </div>
        )}
      </header>

      <Tabs value={activeTab} className="flex-1 flex flex-col min-h-0">
        <TabsContent value="tenants" className="flex-1 p-8 overflow-y-auto no-scrollbar outline-none m-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {overview && (
              <>
                <Card className="rounded-[32px] overflow-hidden border-none bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-500/20">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                        <Users className="w-6 h-6" />
                      </div>
                      <Badge className="bg-white/20 text-white border-white/30 font-black">ENTITIES</Badge>
                    </div>
                    <div className="text-4xl font-black mb-1 tabular-nums">{overview.totalAssignments}</div>
                    <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">Active Deployments</p>
                  </CardContent>
                </Card>
                <Card className="rounded-[32px] overflow-hidden border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl">
                        <Building2 className="w-6 h-6 text-emerald-500" />
                      </div>
                      <Badge variant="outline" className="text-emerald-500 border-emerald-100 uppercase font-black">CLIENTS</Badge>
                    </div>
                    <div className="text-4xl font-black mb-1 tabular-nums">{overview.tenantStats.withApps}</div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Onboarded Tenants</p>
                  </CardContent>
                </Card>
                <Card className="rounded-[32px] overflow-hidden border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl">
                        <LayoutGrid className="w-6 h-6 text-indigo-500" />
                      </div>
                      <Badge variant="outline" className="text-indigo-500 border-indigo-100 uppercase font-black">SOLUTIONS</Badge>
                    </div>
                    <div className="text-4xl font-black mb-1 tabular-nums">{overview.totalApplications}</div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Available Domains</p>
                  </CardContent>
                </Card>
                <Card className="rounded-[32px] overflow-hidden border-none bg-slate-900 dark:bg-slate-800 text-white shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-white/10 rounded-2xl">
                        <Zap className="w-6 h-6 text-amber-400" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-widest">System Operational</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Security Subsystem Active</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <h2 className="text-2xl font-black uppercase tracking-tight">Tenant Directory</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Select a primary entity to manage security entitlements</p>
            </div>
            <div className="relative w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Lookup Tenant ID or Name..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-sm font-bold placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tenants.map((tenant: Tenant) => (
              <Card
                key={tenant.tenantId}
                onClick={() => { setSelectedTenant(tenant); setActiveTab('manage'); }}
                className={cn(
                  "group cursor-pointer rounded-[32px] border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 overflow-hidden",
                  selectedTenant?.tenantId === tenant.tenantId && "ring-2 ring-blue-600 border-transparent shadow-2xl shadow-blue-500/10"
                )}
              >
                <CardContent className="p-0">
                  <div className="h-24 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center font-black text-blue-600 border border-slate-100 dark:border-slate-700">
                        {tenant.companyName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-black uppercase tracking-tight text-[#1B2E5A] dark:text-white leading-none mb-1">{tenant.companyName}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tenant.subdomain}.network</p>
                      </div>
                    </div>
                    <Badge className={cn(
                      "rounded-lg font-black uppercase tracking-widest",
                      tenant.isActive ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-slate-500/10 text-slate-600 border-slate-500/20"
                    )}>
                      {tenant.isActive ? 'Active' : 'Offline'}
                    </Badge>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      <span>Security Deployments</span>
                      <span className="text-slate-900 dark:text-white">{tenant.assignmentCount} Domains</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#1B2E5A] h-full rounded-full transition-all duration-1000"
                        style={{ width: `${(tenant.enabledCount / (tenant.assignmentCount || 1)) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex -space-x-2">
                        {tenant.applications?.slice(0, 4).map((app: TenantApplication) => (
                          <div key={app.id} title={app.appName} className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border-2 border-slate-50 dark:border-slate-900 flex items-center justify-center">
                            {getAppIcon(app.appCode)}
                          </div>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs font-black uppercase tracking-widest group-hover:bg-[#1B2E5A] group-hover:text-white transition-all">
                        Configure <ArrowRight className="w-3 h-3 ml-2" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="manage" className="flex-1 overflow-hidden flex flex-col outline-none m-0 data-[state=active]:flex min-h-0">
          <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-950 relative min-h-0">
            {selectedTenant && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Executive KPI Bar */}
                <div className={cn(
                  "flex-none px-8 py-2 border-b flex items-center justify-between transition-all",
                  isDark ? "bg-slate-900/40 border-slate-800" : "bg-slate-50/30 border-slate-100"
                )}>
                  <div className="flex items-center gap-8">
                    <div className="flex flex-col">
                      <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Active Domains</span>
                      <div className="flex items-center gap-2">
                        <Grid className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] font-black text-slate-900 dark:text-white tabular-nums">{selectedTenant.assignmentCount || 0}</span>
                      </div>
                    </div>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
                    <div className="flex flex-col">
                      <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Claims Serialized</span>
                      <div className="flex items-center gap-2">
                        <Shield className="w-3 h-3 text-blue-500" />
                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 tabular-nums">{Object.values(assignmentConfig.selectedPermissions).flat().length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <Input
                      placeholder="Search matrix capabilities..."
                      value={matrixSearchQuery}
                      onChange={(e) => setMatrixSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-[9px] rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar relative bg-slate-50/20 dark:bg-slate-950/40">
                  {filteredMatrixApps.length > 0 ? (
                    <Accordion type="single" collapsible className="space-y-6 pb-40">
                      {filteredMatrixApps.map((app: Application) => {
                        const tenantApp = selectedTenant.applications?.find((ta: TenantApplication) => ta.appId === app.appId);
                        const isAppAssigned = !!tenantApp;
                        const totalAppPerms = app.modules?.reduce((sum: number, m: ApplicationModule) => sum + (m.permissions?.length || 0), 0) || 0;
                        const selectedAppPerms = app.modules?.reduce((sum: number, m: ApplicationModule) => sum + (assignmentConfig.selectedPermissions[`${app.appId}::${m.moduleCode}`]?.length || 0), 0) || 0;

                        return (
                          <AccordionItem
                            key={app.appCode}
                            value={app.appCode}
                            className={cn(
                              "border rounded-[32px] overflow-hidden transition-all shadow-sm",
                              isAppAssigned
                                ? "border-blue-200/50 bg-blue-50/5 dark:border-blue-900/20 dark:bg-blue-900/5"
                                : "bg-white dark:bg-slate-900/30 border-slate-100 dark:border-slate-800"
                            )}
                          >
                            <div className="flex items-center">
                              <AccordionTrigger className="flex-1 px-8 py-6 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all [&[data-state=open]]:bg-[#1B2E5A]/5 group/trigger text-left">
                                <div className="flex items-center gap-6">
                                  <div className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all border relative shadow-sm",
                                    isAppAssigned ? "bg-white dark:bg-slate-800 border-blue-500 text-white shadow-blue-500/10" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-300"
                                  )}>
                                    {getAppIcon(app.appCode)}
                                    {isAppAssigned && <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />}
                                  </div>
                                  <div>
                                    <div className="text-[14px] font-black text-[#1B2E5A] dark:text-white uppercase flex items-center gap-3 leading-none tracking-tight">
                                      {app.appName}
                                      {isAppAssigned && <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[8px] font-black tracking-widest uppercase">Deployed</Badge>}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5 opacity-60">
                                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{app.modules?.length || 0} Modules</span>
                                      <div className="w-1 h-1 rounded-full bg-slate-300" />
                                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">{selectedAppPerms}/{totalAppPerms} Capabilities</span>
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
                                    onClick={() => handleAssignApplicationDirectly(app)}
                                    className="rounded-xl px-4 h-9 text-[9px] font-black uppercase tracking-widest border-blue-200 text-blue-600 hover:bg-[#1B2E5A] hover:text-white transition-all"
                                  >
                                    <Plus className="w-3.5 h-3.5 mr-2" /> Deploy Domain
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={loading}
                                    onClick={() => handleRemoveAssignment(tenantApp.id, selectedTenant.companyName, app.appName)}
                                    className="rounded-xl px-4 h-9 text-[9px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 hover:text-rose-600 border border-transparent hover:border-rose-100"
                                  >
                                    Decommission
                                  </Button>
                                )}
                              </div>
                            </div>
                            <AccordionContent className="p-0 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950/20">
                              <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {app.modules?.map((module: ApplicationModule) => {
                                  const mk = `${app.appId}::${module.moduleCode}`;
                                  const isModuleEnabled = assignmentConfig.enabledModules.includes(mk);
                                  const currentPerms = assignmentConfig.selectedPermissions[mk] || [];
                                  const originalPerms = originalPermissions[mk] || [];
                                  const isAllModuleSelected = currentPerms.length === (module.permissions?.length || 0) && (module.permissions?.length || 0) > 0;

                                  return (
                                    <div key={module.moduleCode} className={cn(
                                      "p-8 grid grid-cols-12 gap-10 items-start transition-all",
                                      isModuleEnabled ? "bg-blue-50/[0.03] dark:bg-blue-900/[0.02]" : "opacity-60 grayscale-[0.5] hover:bg-slate-50/50"
                                    )}>
                                      {/* Module Identity Column */}
                                      <div className="col-span-2 border-r border-slate-100 dark:border-slate-800 pr-8 pt-1 space-y-4">
                                        <div>
                                          <h4 className={cn(
                                            "text-[13px] font-black uppercase tracking-tight leading-tight mb-1",
                                            isModuleEnabled ? "text-[#1B2E5A] dark:text-white" : "text-slate-400"
                                          )}>
                                            {module.moduleName}
                                          </h4>
                                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{module.moduleCode}</div>
                                        </div>

                                        <div className="space-y-3 pt-2">
                                          <button
                                            disabled={!isAppAssigned}
                                            onClick={() => {
                                              const allCodes = module.permissions?.map((p: Permission) => p.code) || [];
                                              setAssignmentConfig((prev: any) => {
                                                const isCurrentlyEnabled = prev.enabledModules.includes(mk);
                                                let updatedModules = [...prev.enabledModules];
                                                let updatedPermissions = { ...prev.selectedPermissions };

                                                if (isAllModuleSelected) {
                                                  updatedModules = updatedModules.filter((m: string) => m !== mk);
                                                  updatedPermissions[mk] = [];
                                                } else {
                                                  if (!isCurrentlyEnabled) {
                                                    updatedModules.push(mk);
                                                  }
                                                  updatedPermissions[mk] = allCodes;
                                                }

                                                return {
                                                  ...prev,
                                                  enabledModules: updatedModules,
                                                  selectedPermissions: updatedPermissions
                                                };
                                              });
                                            }}
                                            className={cn(
                                              "w-full py-2 px-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border text-center shadow-sm active:scale-95 disabled:opacity-50",
                                              isAllModuleSelected
                                                ? "bg-[#1B2E5A] border-blue-500 text-white"
                                                : isModuleEnabled
                                                  ? "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
                                                  : "bg-slate-50 border-slate-200 text-slate-400"
                                            )}
                                          >
                                            {isAllModuleSelected ? 'FULL ACCESS' : isModuleEnabled ? 'PARTIAL' : 'INACTIVE'}
                                          </button>

                                          <div className="flex justify-between items-center px-1 opacity-60">
                                            <span className="text-[8px] font-black uppercase text-slate-400">Claims</span>
                                            <span className="text-[9px] font-black text-slate-700 dark:text-slate-300">{(module.permissions?.length || 0) * 2} Units/T</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Capability Matrix Column - Fixed Grid Alignment */}
                                      <div className="col-span-10">
                                        <div className="grid grid-cols-6 gap-3">
                                          {module.permissions?.map((perm: Permission) => {
                                            const isSelected = currentPerms.includes(perm.code);
                                            const isOriginal = originalPerms.includes(perm.code);
                                            const isDraft = isSelected !== isOriginal;
                                            const permUI = analyzePermissionType(perm.code);

                                            return (
                                              <button
                                                key={perm.code}
                                                disabled={!isAppAssigned}
                                                onClick={() => {
                                                  setAssignmentConfig((prev: any) => {
                                                    const current = prev.selectedPermissions[mk] || [];
                                                    const isNowSelected = !current.includes(perm.code);
                                                    const updated = isNowSelected
                                                      ? [...current, perm.code]
                                                      : current.filter((c: string) => c !== perm.code);

                                                    let updatedModules = [...prev.enabledModules];

                                                    if (isNowSelected && !updatedModules.includes(mk)) {
                                                      updatedModules.push(mk);
                                                    }
                                                    else if (!isNowSelected && updated.length === 0) {
                                                      updatedModules = updatedModules.filter((m: string) => m !== mk);
                                                    }

                                                    return {
                                                      ...prev,
                                                      enabledModules: updatedModules,
                                                      selectedPermissions: {
                                                        ...prev.selectedPermissions,
                                                        [mk]: updated
                                                      }
                                                    };
                                                  });
                                                }}
                                                className={cn(
                                                  "group/chip relative flex flex-col gap-3 p-4 rounded-2xl border transition-all text-left h-full select-none active:scale-95 disabled:cursor-not-allowed",
                                                  isSelected
                                                    ? permUI.risk === 'high' ? "bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-900/40 shadow-inner ring-1 ring-rose-200/50"
                                                      : permUI.risk === 'medium' ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/40 shadow-inner ring-1 ring-amber-200/50"
                                                        : "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-900/40 shadow-inner ring-1 ring-blue-200/50"
                                                    : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800/50",
                                                  isDraft && "ring-2 ring-orange-400 dark:ring-orange-500 shadow-lg shadow-orange-500/10"
                                                )}
                                              >
                                                <div className="flex items-start justify-between">
                                                  <div className={cn(
                                                    "p-1.5 rounded-lg transition-colors",
                                                    isSelected ? "bg-white dark:bg-slate-950 shadow-sm" : "opacity-30 group-hover/chip:opacity-60"
                                                  )}>
                                                    {permUI.icon}
                                                  </div>
                                                  <Badge variant="outline" className={cn(
                                                    "text-[7px] h-4 px-1.5 font-black leading-none uppercase border-none transition-all",
                                                    isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-300"
                                                  )}>
                                                    {isSelected ? 'ACTIVE' : 'READY'}
                                                  </Badge>
                                                </div>

                                                <div className="flex-1">
                                                  <div className={cn(
                                                    "text-[10px] font-black uppercase leading-tight tracking-tight mb-0.5",
                                                    isSelected ? "text-slate-900 dark:text-white" : "text-slate-400"
                                                  )}>
                                                    {perm.name}
                                                  </div>
                                                  <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter line-clamp-2 opacity-60">
                                                    {perm.code}
                                                  </div>
                                                </div>

                                                {isDraft && (
                                                  <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                                                )}
                                              </button>
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
                  ) : (
                    <div className="flex flex-col items-center justify-center py-32 bg-slate-50/50 dark:bg-slate-900/10 rounded-[48px] border-2 border-dashed border-slate-200 dark:border-slate-800">
                      <Search className="w-16 h-16 text-slate-300 mb-6" />
                      <h3 className="text-xl font-black text-[#1B2E5A] dark:text-white uppercase tracking-tight">Deployment Not Found</h3>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <style dangerouslySetInnerHTML={{
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
      `}} />
    </div >
  );
};

export default ApplicationAssignmentManager;
