import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
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
  ArrowLeft
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import api from '@/lib/api';
import { PearlButton } from '@/components/ui/pearl-button';
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader';
import { cn } from '@/lib/utils';

interface Application {
  appId: string;
  appCode: string;
  appName: string;
  description: string;
  subscriptionTier: string;
  modules: Module[];
}

interface Module {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  description: string;
  isCore: boolean;
  permissions: Permission[];
}

interface Permission {
  code: string;
  name: string;
  description?: string;
  fullCode?: string;
  creditCost?: {
    cost: number;
    unit: string;
    isGlobal: boolean;
  };
  cost?: number;
  unitMultiplier?: number;
  unit?: string;
}

interface RoleBuilderData {
  roleName: string;
  description: string;
  selectedApps: string[];
  selectedModules: Record<string, string[]>;
  selectedPermissions: Record<string, string[]>;
  restrictions: {
    timeRestrictions?: Record<string, any>;
    ipRestrictions?: Record<string, any>;
    dataRestrictions?: Record<string, any>;
    featureRestrictions?: Record<string, any>;
  };
}

interface ApplicationModuleRoleBuilderProps {
  onSave?: (role: any) => void;
  onCancel?: () => void;
  initialRole?: any;
}

export function ApplicationModuleRoleBuilder({
  onSave,
  onCancel,
  initialRole
}: ApplicationModuleRoleBuilderProps) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [builderSearchQuery, setBuilderSearchQuery] = useState('');
  const [currentStep, setCurrentStep] = useState<1 | 2>(() =>
    initialRole?.roleName || initialRole?.name ? 2 : 1
  );

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
          featureRestrictions: {}
        }
      };
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
        featureRestrictions: {}
      }
    };
  });

  // Load applications and modules from backend
  useEffect(() => {
    const loadRoleBuilderOptions = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.get('/custom-roles/builder-options');

        if (response.data.success) {
          const { applications: apps } = response.data.data;
          setApplications(apps);

          if (initialRole) {
            const permissions = initialRole.permissions || [];
            const parsedSelections = parseExistingPermissions(permissions);
            setRoleData(prev => ({
              ...prev,
              ...parsedSelections
            }));
          }

        } else {
          setError('Failed to load applications and modules');
        }

      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { code?: string; error?: string }; status?: number }; message?: string };
        const code = axiosErr?.response?.data?.code;
        if (code === 'TENANT_APPS_NOT_PROVISIONED') {
          setError('TENANT_APPS_NOT_PROVISIONED');
        } else if (axiosErr?.response?.status != null && axiosErr.response.status >= 500) {
          setError("Couldn't reach the server. Try again.");
        } else {
          setError('Failed to load applications and modules');
        }
      } finally {
        setLoading(false);
      }
    };

    loadRoleBuilderOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRole]);

  // Parse existing role permissions into selection format
  const parseExistingPermissions = (permissions: string[] | Record<string, any>) => {
    const selectedApps: string[] = [];
    const selectedModules: Record<string, string[]> = {};
    const selectedPermissions: Record<string, string[]> = {};

    if (Array.isArray(permissions)) {
      permissions.forEach(permission => {
        const parts = permission.split('.');
        if (parts.length >= 3) {
          const [appCode, moduleCode, permCode] = parts;
          if (!selectedApps.includes(appCode)) selectedApps.push(appCode);
          if (!selectedModules[appCode]) selectedModules[appCode] = [];
          if (!selectedModules[appCode].includes(moduleCode)) selectedModules[appCode].push(moduleCode);
          const moduleKey = `${appCode}.${moduleCode}`;
          if (!selectedPermissions[moduleKey]) selectedPermissions[moduleKey] = [];
          selectedPermissions[moduleKey].push(permCode);
        }
      });
    } else if (typeof permissions === 'object' && permissions !== null) {
      Object.entries(permissions).forEach(([appCode, appPermissions]) => {
        if (typeof appPermissions === 'object' && appPermissions !== null) {
          if (!selectedApps.includes(appCode)) selectedApps.push(appCode);
          Object.entries(appPermissions).forEach(([moduleCode, modulePerms]) => {
            if (Array.isArray(modulePerms)) {
              if (!selectedModules[appCode]) selectedModules[appCode] = [];
              if (!selectedModules[appCode].includes(moduleCode)) selectedModules[appCode].push(moduleCode);
              const moduleKey = `${appCode}.${moduleCode}`;
              if (!selectedPermissions[moduleKey]) selectedPermissions[moduleKey] = [];
              selectedPermissions[moduleKey] = [...modulePerms];
            }
          });
        }
      });
    }
    return { selectedApps, selectedModules, selectedPermissions };
  };

  // Toggle permission selection
  const togglePermissionSelection = (appCode: string, moduleCode: string, permissionCode: string) => {
    const moduleKey = `${appCode}.${moduleCode}`;

    setRoleData(prev => {
      const modulePermissions = prev.selectedPermissions[moduleKey] || [];
      const isSelecting = !modulePermissions.includes(permissionCode);

      let newSelectedApps = [...prev.selectedApps];
      const newSelectedModules = { ...prev.selectedModules };

      if (isSelecting) {
        if (!newSelectedApps.includes(appCode)) newSelectedApps.push(appCode);
        if (!newSelectedModules[appCode]) newSelectedModules[appCode] = [];
        if (!newSelectedModules[appCode].includes(moduleCode)) newSelectedModules[appCode].push(moduleCode);
      }

      const newModulePermissions = isSelecting
        ? [...modulePermissions, permissionCode]
        : modulePermissions.filter(code => code !== permissionCode);

      return {
        ...prev,
        selectedApps: newSelectedApps,
        selectedModules: newSelectedModules,
        selectedPermissions: {
          ...prev.selectedPermissions,
          [moduleKey]: newModulePermissions
        }
      };
    });
  };

  // Select all permissions for a module
  const selectAllModulePermissions = (appCode: string, moduleCode: string, shouldSelect: boolean = true) => {
    const app = applications.find(a => a.appCode === appCode);
    const module = app?.modules.find(m => m.moduleCode === moduleCode);

    if (module) {
      setRoleData(prev => {
        const newSelectedPermissions = { ...prev.selectedPermissions };
        const moduleKey = `${appCode}.${moduleCode}`;
        let newSelectedApps = [...prev.selectedApps];
        let newSelectedModules = { ...prev.selectedModules };

        if (shouldSelect) {
          newSelectedPermissions[moduleKey] = module.permissions.map(p => p.code);
          if (!newSelectedApps.includes(appCode)) newSelectedApps.push(appCode);
          if (!newSelectedModules[appCode]) newSelectedModules[appCode] = [];
          if (!newSelectedModules[appCode].includes(moduleCode)) newSelectedModules[appCode].push(moduleCode);
        } else {
          delete newSelectedPermissions[moduleKey];
          if (newSelectedModules[appCode]) {
            newSelectedModules[appCode] = newSelectedModules[appCode].filter(m => m !== moduleCode);
          }
        }

        return {
          ...prev,
          selectedApps: newSelectedApps,
          selectedModules: newSelectedModules,
          selectedPermissions: newSelectedPermissions
        };
      });
    }
  };

  // Select all modules and permissions for an app
  const selectAllAppPermissions = (appCode: string, shouldSelect: boolean = true) => {
    const app = applications.find(a => a.appCode === appCode);
    if (!app) return;

    setRoleData(prev => {
      let newSelectedApps = shouldSelect
        ? (prev.selectedApps.includes(appCode) ? prev.selectedApps : [...prev.selectedApps, appCode])
        : prev.selectedApps.filter(code => code !== appCode);

      const newSelectedModules = { ...prev.selectedModules };
      const newSelectedPermissions = { ...prev.selectedPermissions };

      if (shouldSelect) {
        newSelectedModules[appCode] = app.modules.map(m => m.moduleCode);
        app.modules.forEach(m => {
          newSelectedPermissions[`${appCode}.${m.moduleCode}`] = m.permissions.map(p => p.code);
        });
      } else {
        delete newSelectedModules[appCode];
        Object.keys(newSelectedPermissions).forEach(key => {
          if (key.startsWith(`${appCode}.`)) delete newSelectedPermissions[key];
        });
      }

      return {
        ...prev,
        selectedApps: newSelectedApps,
        selectedModules: newSelectedModules,
        selectedPermissions: newSelectedPermissions
      };
    });
  };

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalApps = roleData.selectedApps.length;
    const totalModules = Object.values(roleData.selectedModules).reduce((sum, modules) => sum + modules.length, 0);
    const totalPermissions = Object.values(roleData.selectedPermissions).reduce((sum, perms) => sum + perms.length, 0);

    let estimatedCredits = 0;
    const selectedPermDetails: Array<{ code: string; cost: number; unit: string; isGlobal: boolean }> = [];

    roleData.selectedApps.forEach(appCode => {
      const app = applications.find(a => a.appCode === appCode);
      if (app) {
        const selectedModules = roleData.selectedModules[appCode] || [];
        selectedModules.forEach(moduleCode => {
          const module = app.modules.find(m => m.moduleCode === moduleCode);
          if (module) {
            const selectedPerms = roleData.selectedPermissions[`${appCode}.${moduleCode}`] || [];
            selectedPerms.forEach(permCode => {
              const permission = module.permissions.find(p => p.code === permCode);
              if (
                typeof permission?.creditCost === 'object' &&
                permission.creditCost !== null &&
                typeof permission.cost === 'number' &&
                typeof permission.unitMultiplier === 'number' &&
                typeof permission.unit === 'string'
              ) {
                const cost = permission.cost * permission.unitMultiplier;
                estimatedCredits += cost;
                selectedPermDetails.push({
                  code: `${appCode}.${moduleCode}.${permCode}`,
                  cost: permission.creditCost.cost,
                  unit: permission.creditCost.unit,
                  isGlobal: permission.creditCost.isGlobal
                });
              }
            });
          }
        });
      }
    });

    return { totalApps, totalModules, totalPermissions, estimatedCredits, selectedPermDetails };
  }, [roleData, applications]);

  // Helper function to analyze permission type/risk for styling
  const analyzePermissionType = (permCode: string) => {
    const code = permCode.toLowerCase();

    if (code.includes('admin') || code.includes('manage') || code.includes('delete')) {
      return {
        risk: 'high',
        color: 'border-rose-100 bg-white hover:border-rose-200 text-rose-700',
        selectedColor: 'border-rose-200 bg-rose-50 text-rose-800',
        icon: <Lock className="w-3.5 h-3.5" />
      };
    }

    if (code.includes('write') || code.includes('edit') || code.includes('create') || code.includes('update')) {
      return {
        risk: 'medium',
        color: 'border-amber-100 bg-white hover:border-amber-200 text-amber-700',
        selectedColor: 'border-amber-200 bg-amber-50 text-amber-800',
        icon: <Edit className="w-3.5 h-3.5" />
      };
    }

    return {
      risk: 'low',
      color: 'border-slate-200 bg-white hover:border-slate-300 text-slate-600',
      selectedColor: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      icon: <Eye className="w-3.5 h-3.5" />
    };
  };

  const getAppIcon = (appKey: string) => {
    const key = appKey.toLowerCase();
    const props = { className: "w-5 h-5 text-primary" };
    if (key.includes('crm') || key.includes('sales')) return <Users {...props} />;
    if (key.includes('inventory') || key.includes('product')) return <Package {...props} />;
    if (key.includes('admin') || key.includes('auth')) return <Shield {...props} />;
    if (key.includes('hr') || key.includes('people')) return <Building {...props} />;
    if (key.includes('billing') || key.includes('finance') || key.includes('payments')) return <Coins {...props} />;
    if (key.includes('analytics') || key.includes('reporting')) return <Activity {...props} />;
    if (key.includes('database') || key.includes('storage')) return <Database {...props} />;
    if (key.includes('settings') || key.includes('config')) return <Settings {...props} />;
    return <Grid {...props} className="w-5 h-5 text-slate-500" />;
  };

  const filteredApps = useMemo(() => {
    if (!builderSearchQuery.trim()) return applications;

    const query = builderSearchQuery.toLowerCase();
    return applications.map(app => {
      const appMatches = app.appName.toLowerCase().includes(query) ||
        app.appCode.toLowerCase().includes(query) ||
        app.description.toLowerCase().includes(query);

      const filteredModules = app.modules.map(module => {
        const moduleMatches = module.moduleName.toLowerCase().includes(query) ||
          module.moduleCode.toLowerCase().includes(query) ||
          module.description.toLowerCase().includes(query);

        const filteredPermissions = module.permissions.filter(perm =>
          perm.name.toLowerCase().includes(query) ||
          perm.code.toLowerCase().includes(query) ||
          (perm.description?.toLowerCase().includes(query))
        );

        if (moduleMatches || filteredPermissions.length > 0) {
          return { ...module, permissions: filteredPermissions.length > 0 ? module.permissions : module.permissions };
        }
        return null;
      }).filter(Boolean) as Module[];

      if (appMatches || filteredModules.length > 0) {
        return { ...app, modules: filteredModules.length > 0 ? filteredModules : app.modules };
      }
      return null;
    }).filter(Boolean) as Application[];
  }, [applications, builderSearchQuery]);

  const handleSave = async () => {
    if (!roleData.roleName.trim()) {
      toast.error('Please enter a role name');
      return;
    }

    if (summary.totalPermissions === 0) {
      toast.error('Please select at least one permission');
      return;
    }

    try {
      setSaving(true);
      const isEditing = initialRole?.roleId;

      if (isEditing) {
        const response = await api.put(`/custom-roles/update-from-builder/${initialRole.roleId}`, {
          roleName: roleData.roleName,
          description: roleData.description,
          selectedApps: roleData.selectedApps,
          selectedModules: roleData.selectedModules,
          selectedPermissions: roleData.selectedPermissions,
          restrictions: roleData.restrictions
        });

        if (response.data.success) {
          toast.success(`Role "${roleData.roleName}" updated successfully!`);
          onSave?.(response.data.data);
        } else {
          toast.error('Failed to update role: ' + response.data.error);
        }

      } else {
        const response = await api.post('/custom-roles/create-from-builder', {
          roleName: roleData.roleName,
          description: roleData.description,
          selectedApps: roleData.selectedApps,
          selectedModules: roleData.selectedModules,
          selectedPermissions: roleData.selectedPermissions,
          restrictions: roleData.restrictions
        });

        if (response.data.success) {
          toast.success(`Role "${roleData.roleName}" created successfully!`);
          onSave?.(response.data.data);
        } else {
          toast.error('Failed to create role: ' + response.data.error);
        }
      }

    } catch (error) {
      console.error('❌ Error saving role:', error);
      const isEditing = initialRole?.roleId;
      toast.error(isEditing ? 'Failed to update role' : 'Failed to create role');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <ZopkitRoundLoader size="xl" />
          <p className="text-sm font-medium text-slate-500 animate-pulse">Initializing Builder...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center">
          {error === 'TENANT_APPS_NOT_PROVISIONED' ? (
            <div className="text-center p-8">
              <h3 className="text-lg font-semibold mb-2">Applications Not Provisioned</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your workspace is missing application access. Click Sync now to fix.
              </p>
              <button
                onClick={async () => {
                  try {
                    await api.post('/api/admin/tenant-applications/reconcile', { tenantId: undefined });
                    window.location.reload();
                  } catch {
                    /* ignore, user can retry */
                  }
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Sync now
              </button>
            </div>
          ) : error?.includes('server') ? (
            <div className="text-center p-8">
              <h3 className="text-lg font-semibold mb-2">Connection Error</h3>
              <p className="text-sm text-muted-foreground">Couldn&apos;t reach the server. Try again.</p>
            </div>
          ) : (
            <>
              <div className="mx-auto h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-primary mb-2">Connection Error</h3>
              <p className="text-slate-500 mb-6">{error}</p>
              <PearlButton onClick={() => window.location.reload()}>
                Retry Connection
              </PearlButton>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "h-full min-h-0 flex flex-col overflow-hidden bg-slate-50 font-sans text-primary selection:bg-primary/15"
    )}>
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
      <div className={cn(
        "flex-none flex items-center justify-between px-6 py-4 border-b z-20 transition-all",
        "border-slate-200 bg-white"
      )}>
        <div className="flex items-center gap-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {initialRole?.roleId ? 'Edit Custom Role' : 'Role Builder'}
            </h1>
            <p className="text-xs font-medium text-slate-500 hidden sm:block">
              {initialRole?.roleId ? 'Modify role permissions' : 'Create new role scope'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex gap-4">
            <div className="text-right hidden md:block">
              <span className="block text-xs text-slate-500">Total apps</span>
              <span className="block text-lg font-semibold leading-none">{applications.length}</span>
            </div>
            <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
            <div className="text-right hidden md:block">
              <span className="block text-xs text-slate-500">Est. cost</span>
              <span className="block text-lg font-semibold text-primary leading-none">{summary.estimatedCredits.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Step 1 only or Step 2 (Matrix) */}
      <div className="flex-1 flex overflow-hidden">

        {currentStep === 1 ? (
          /* Step 1: Role Name & Purpose - Full width centered form */
          <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
            <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-8">
              <div className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-6 text-primary">
                <Settings className="h-5 w-5 opacity-70" />
                <h3 className="text-sm font-medium">Step 1 — Role name & purpose</h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Role name *
                  </label>
                  <input
                    type="text"
                    value={roleData.roleName}
                    onChange={(e) => setRoleData(prev => ({ ...prev, roleName: e.target.value }))}
                    placeholder="e.g. HR_MANAGER, PROJECT_LEAD"
                    className={cn(
                      "w-full px-4 py-3 rounded-lg text-sm font-medium transition-all outline-none border focus:ring-2",
                      "bg-slate-50 border-slate-200 text-primary placeholder-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-ring/10"
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Purpose (optional)
                  </label>
                  <textarea
                    rows={4}
                    value={roleData.description}
                    onChange={(e) => setRoleData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this role's purpose and responsibilities..."
                    className={cn(
                      "w-full px-4 py-3 rounded-lg text-sm font-medium transition-all outline-none border focus:ring-2 resize-none",
                      "bg-slate-50 border-slate-200 text-primary placeholder-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-ring/10"
                    )}
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <PearlButton
                    variant="outline"
                    onClick={onCancel}
                    className="text-slate-500 hover:text-primary"
                  >
                    Cancel
                  </PearlButton>
                  <PearlButton
                    variant="primary"
                    onClick={() => {
                      if (!roleData.roleName.trim() || roleData.roleName.trim().length < 2) {
                        toast.error('Please enter a role name (at least 2 characters)');
                        return;
                      }
                      setCurrentStep(2);
                    }}
                    disabled={!roleData.roleName.trim() || roleData.roleName.trim().length < 2}
                    className="gap-2 min-w-[180px]"
                  >
                    Continue to Step 2
                    <ChevronRight className="w-4 h-4" />
                  </PearlButton>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Step 2: Permission Matrix - Full width (name & purpose already filled in Step 1) */
        <div className={cn(
          "flex-1 flex flex-col min-w-0 bg-slate-50/50",
          ""
        )}>
          {/* Matrix Toolbar - Step 2 */}
          <div className={cn(
            "flex-none p-4 border-b flex items-center justify-between gap-4 z-20",
            "bg-white border-slate-200"
          )}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-2 text-slate-500 hover:text-primary text-xs font-medium"
                title="Edit role name and purpose"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Edit Step 1</span>
              </button>
              <div className="w-px h-5 bg-slate-200" />
              <div className="rounded-md bg-primary p-1.5 text-white">
                <Grid className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-primary">Step 2 — Permission matrix</span>
            </div>

            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filter permissions..."
                value={builderSearchQuery}
                onChange={(e) => setBuilderSearchQuery(e.target.value)}
                className={cn(
                  "w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none border transition-all",
                  "bg-slate-50 border-slate-200 text-primary placeholder-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-ring/10"
                )}
              />
            </div>
          </div>

          {/* Main Matrix Flow */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {filteredApps.length > 0 ? (
              <Accordion type="single" collapsible className="space-y-4">
                {filteredApps.map((app) => {
                  const isAppSelected = roleData.selectedApps.includes(app.appCode);
                  const totalAppPerms = app.modules.reduce((sum, m) => sum + m.permissions.length, 0);
                  const selectedAppPerms = app.modules.reduce((sum, m) => sum + (roleData.selectedPermissions[`${app.appCode}.${m.moduleCode}`]?.length || 0), 0);
                  const isAllAppSelected = selectedAppPerms === totalAppPerms && totalAppPerms > 0;

                  return (
                    <AccordionItem
                      key={app.appCode}
                      value={app.appCode}
                      className={cn(
                        "overflow-hidden rounded-lg border transition-colors",
                        isAppSelected
                          ? "border-slate-300 bg-slate-50/50"
                          : "border-slate-200 bg-white"
                      )}
                    >
                      <AccordionTrigger className="px-6 py-5 hover:no-underline hover:bg-slate-50 transition-all [&[data-state=open]]:bg-primary/5 group/trigger">
                        <div className="flex items-center justify-between w-full pr-6 text-left">
                          <div className="flex items-center gap-5">
                            <div className={cn(
                              "relative flex h-10 w-10 items-center justify-center rounded-lg border transition-colors",
                              isAppSelected ? "border-primary bg-primary text-white [&_svg]:text-white" : "border-slate-200 bg-white text-slate-500"
                            )}>
                              {getAppIcon(app.appCode)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                {app.appName}
                                <Badge variant="outline" className="h-5 border-slate-200 px-2 text-[10px] font-medium">{app.appCode}</Badge>
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                <span>{app.modules.length} modules</span>
                                <span className="text-slate-300">·</span>
                                <span className="tabular-nums text-primary">{selectedAppPerms}/{totalAppPerms} permissions</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="flex flex-col items-end gap-1.5 pt-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); selectAllAppPermissions(app.appCode, !isAllAppSelected); }}
                                className={cn(
                                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                                  isAllAppSelected
                                    ? "border-primary bg-primary text-white"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-primary"
                                )}
                              >
                                {isAllAppSelected ? 'All selected' : 'Select all'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0 border-t border-slate-100 bg-white">
                        <div className="divide-y divide-slate-100">
                          {app.modules.map((module) => {
                            const moduleKey = `${app.appCode}.${module.moduleCode}`;
                            const selectedPerms = roleData.selectedPermissions[moduleKey] || [];
                            const isAllModuleSelected = selectedPerms.length === module.permissions.length && module.permissions.length > 0;
                            const isModuleActive = selectedPerms.length > 0;

                            return (
                              <div key={module.moduleCode} className={cn(
                                "p-6 grid grid-cols-12 gap-6 items-start transition-all",
                                isModuleActive ? "bg-slate-50/80" : "hover:bg-slate-50/50"
                              )}>
                                {/* Module Identity Column - narrower to give more width to permissions */}
                                <div className="col-span-1 xl:col-span-2 border-r border-slate-100 pr-4 xl:pr-6 space-y-4 pt-1 min-w-0">
                                  <div>
                                    <h4 className="mb-1 text-sm font-medium leading-4 text-primary">
                                      {module.moduleName}
                                    </h4>
                                    <div className="text-[10px] text-slate-400">{module.moduleCode}</div>
                                  </div>

                                  <div className="space-y-3 pt-3">
                                    <button
                                      onClick={() => selectAllModulePermissions(app.appCode, module.moduleCode, !isAllModuleSelected)}
                                      className={cn(
                                        "w-full rounded-lg border px-3 py-1.5 text-center text-[10px] font-medium transition-colors",
                                        isAllModuleSelected
                                          ? "border-primary bg-primary text-white"
                                          : isModuleActive
                                            ? "border-slate-300 bg-slate-100 text-primary"
                                            : "border-slate-200 bg-slate-50 text-slate-400 hover:bg-white"
                                      )}
                                    >
                                      {isAllModuleSelected ? 'All' : isModuleActive ? 'Partial' : 'None'}
                                    </button>
                                  </div>
                                </div>

                                {/* Capability Matrix Grid - wider area for permissions */}
                                <div className="col-span-11 xl:col-span-10 min-w-0">
                                  <TooltipProvider delayDuration={300}>
                                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3">
                                    {module.permissions.map((perm) => {
                                      const isPermSelected = selectedPerms.includes(perm.code);
                                      const { icon, risk } = analyzePermissionType(perm.code);
                                      const tooltipText = [perm.name, perm.description].filter(Boolean).join(' — ') || perm.code || 'Permission';

                                      return (
                                        <Tooltip key={perm.code}>
                                          <TooltipTrigger asChild>
                                        <button
                                          onClick={() => togglePermissionSelection(app.appCode, module.moduleCode, perm.code)}
                                          className={cn(
                                            "group/chip relative flex h-full select-none flex-col gap-2 rounded-lg border p-3 text-left transition-colors",
                                            isPermSelected
                                              ? risk === 'high' ? "border-rose-200 bg-rose-50"
                                                : risk === 'medium' ? "border-amber-200 bg-amber-50"
                                                  : "border-emerald-200 bg-emerald-50"
                                              : "border-slate-200 bg-white hover:border-slate-300"
                                          )}
                                        >
                                          <div className="flex items-start justify-between">
                                            <div className={cn(
                                              "p-1 rounded-lg",
                                              isPermSelected ? "bg-white/50" : "opacity-40"
                                            )}>
                                              {icon}
                                            </div>
                                            {isPermSelected && (
                                              <Check className="h-3 w-3 text-primary" />
                                            )}
                                          </div>

                                          <div className="flex-1 min-w-0">
                                            <div className={cn(
                                              "mb-0.5 line-clamp-2 break-words text-[10px] font-medium leading-tight",
                                              isPermSelected ? "text-primary" : "text-slate-500"
                                            )}>
                                              {perm.name}
                                            </div>
                                            <div className="flex items-center gap-1 text-[9px] text-slate-400">
                                              <Hash className="h-2 w-2" /> {perm.code}
                                            </div>
                                          </div>
                                        </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-xs border-slate-200 bg-primary text-xs text-white">
                                            {tooltipText}
                                          </TooltipContent>
                                        </Tooltip>
                                      );
                                    })}
                                  </div>
                                  </TooltipProvider>
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
              <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-60">
                <Filter className="w-16 h-16 text-slate-200 mb-6" />
                <h4 className="text-lg font-medium text-primary">No applications found</h4>
                <p className="mt-2 text-sm text-slate-500">Try adjusting your search filter.</p>
              </div>
            )}
          </div>

          {/* Footer Action Bar - Fixed at bottom of matrix */}
          <div className={cn(
            "flex-none p-4 border-t z-20 flex items-center justify-between gap-4",
            "bg-white border-slate-200"
          )}>
            <div className="flex items-center gap-4 text-sm">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors",
                summary.totalPermissions > 0
                  ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                  : "bg-slate-50 border-slate-200 text-slate-500"
              )}>
                {summary.totalPermissions > 0 ? <Check className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                <span className="text-xs font-medium">
                  {summary.totalPermissions > 0 ? 'Ready to save' : 'Select permissions to continue'}
                </span>
              </div>
              {summary.totalPermissions > 0 && (
                <span className="text-slate-500 hidden sm:inline">
                  <strong className="text-primary">{summary.totalPermissions}</strong> permissions selected
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <PearlButton
                variant="outline"
                onClick={onCancel}
                className="text-slate-500 hover:text-primary"
              >
                Cancel
              </PearlButton>
              <PearlButton
                variant="primary"
                onClick={handleSave}
                disabled={saving || !roleData.roleName.trim() || summary.totalPermissions === 0}
                className="min-w-[140px]"
              >
                {saving ? 'Processing...' : (initialRole?.roleId ? 'Update Role' : 'Create Role')}
              </PearlButton>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}