import { useMemo, useState, useEffect, type ElementType } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  Shield,
  LayoutGrid,
  Layers,
  Users,
  Search,
  Lock,
  Edit,
  Eye,
  Grid,
  Package,
  Building2,
  Coins,
  Activity,
  Hash,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/common/Page';
import { useRoles, useUsers } from '@/hooks/useSharedQueries';
import { useApplications } from '@/hooks/useApplications';
import { getPermissionSummary } from '@/features/roles/utils/permissionUtils';
import AnimatedLoader from '@/components/common/feedback/AnimatedLoader';
import { AlertCircle, Mail, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardPageHeader, DASHBOARD_PAGE_TITLE_CLASS } from '@/components/dashboard/DashboardPageHeader';
import { useBreadcrumbLabel } from '@/contexts/BreadcrumbLabelContext';
import { useRoleIdParam } from '@/hooks/useRoleRouteParams';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Normalize permissions - convert JSON strings to objects
const normalizePermissions = (permissions: any): Record<string, any> | string[] => {
  if (typeof permissions === 'string') {
    try {
      return JSON.parse(permissions);
    } catch (error) {
      console.error('Failed to parse permissions JSON string:', error);
      return {};
    }
  }
  return permissions;
};

// Parse role permissions into app → module → permissions structure
const parseRolePermissions = (permissions: Record<string, any> | string[]): Record<string, Record<string, string[]>> => {
  const normalized = normalizePermissions(permissions);
  const result: Record<string, Record<string, string[]>> = {};

  // Handle hierarchical permissions: { crm: { leads: ['read', 'create'] } }
  if (normalized && typeof normalized === 'object' && !Array.isArray(normalized)) {
    Object.entries(normalized).forEach(([appCode, modules]) => {
      if (appCode === 'metadata') return;
      if (modules && typeof modules === 'object') {
        result[appCode] = {};
        Object.entries(modules).forEach(([moduleCode, perms]) => {
          if (Array.isArray(perms)) {
            result[appCode][moduleCode] = perms;
          }
        });
      }
    });
  }
  // Handle flat array: ['crm.leads.read', 'crm.contacts.create']
  else if (Array.isArray(normalized)) {
    normalized.forEach((perm: string) => {
      const parts = perm.split('.');
      if (parts.length >= 3) {
        const appCode = parts[0];
        const moduleCode = parts[1];
        const permCode = parts.slice(2).join('.');
        
        if (!result[appCode]) result[appCode] = {};
        if (!result[appCode][moduleCode]) result[appCode][moduleCode] = [];
        result[appCode][moduleCode].push(permCode);
      }
    });
  }

  return result;
};

/** Case-insensitive lookup: role JSON keys may not match `/applications` appCode casing. */
function getRolePermCodes(
  rolePermissions: Record<string, Record<string, string[]>>,
  appCode: string,
  moduleCode: string
): string[] {
  const appKey = Object.keys(rolePermissions).find(
    (k) => k.toLowerCase() === appCode.toLowerCase()
  );
  if (!appKey) return [];
  const modMap = rolePermissions[appKey];
  if (!modMap) return [];
  const modKey = Object.keys(modMap).find(
    (k) => k.toLowerCase() === moduleCode.toLowerCase()
  );
  return modKey ? modMap[modKey] ?? [] : [];
}

function humanizePermCode(code: string): string {
  return code
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAppModuleTitle(code: string): string {
  return code.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Tenant `/applications` often returns enabledModules + enabledModulesPermissions only (no full `modules` + permission matrix).
 * Build module rows so we can still match role permissions to UI.
 */
function modulesFromEnabledFallback(app: any): any[] {
  const emp = app.enabledModulesPermissions;
  if (!emp || typeof emp !== 'object') return [];
  return Object.entries(emp).map(([moduleCode, raw]) => {
    const codes = Array.isArray(raw)
      ? raw.map((p: any) => (typeof p === 'string' ? p : p?.code || p?.name || '')).filter(Boolean)
      : [];
    return {
      moduleId: `${app.appCode}-${moduleCode}`,
      moduleName: formatAppModuleTitle(moduleCode),
      moduleCode,
      permissions: codes.map((code: string) => ({ code, name: humanizePermCode(code) })),
    };
  });
}

/**
 * When API apps have no matching module matrix, render directly from parsed role.permissions.
 */
function buildAppsFromRolePermissionsOnly(
  rolePermissions: Record<string, Record<string, string[]>>,
  applications: any[]
): any[] {
  const out: any[] = [];
  for (const [appCodeRaw, moduleMap] of Object.entries(rolePermissions)) {
    if (!moduleMap || typeof moduleMap !== 'object') continue;
    const appMeta = applications.find(
      (a: any) => (a.appCode || '').toLowerCase() === appCodeRaw.toLowerCase()
    );
    const appName = appMeta?.appName || formatAppModuleTitle(appCodeRaw);
    const modules = Object.entries(moduleMap)
      .filter(([, codes]) => Array.isArray(codes) && codes.length > 0)
      .map(([moduleCode, permCodes]) => {
        const perms = permCodes.map((code) => ({
          code,
          name: humanizePermCode(code),
        }));
        return {
          moduleId: `${appCodeRaw}-${moduleCode}`,
          moduleName: formatAppModuleTitle(moduleCode),
          moduleCode,
          permissions: perms,
          rolePermissions: perms,
          permissionCodes: permCodes,
        };
      });
    if (modules.length === 0) continue;
    out.push({
      appId: appMeta?.appId || appCodeRaw,
      appCode: appCodeRaw,
      appName,
      modules,
    });
  }
  return out;
}

/**
 * Permission chip styling — mirrors ApplicationModuleRoleBuilder `analyzePermissionType`
 * (card surface + risk tint when granted).
 */
const analyzePermissionType = (permCode: string) => {
  const code = permCode.toLowerCase();
  if (
    code.includes('admin') ||
    code.includes('manage') ||
    code.includes('delete') ||
    code.includes('approve') ||
    code.includes('assign')
  ) {
    return {
      risk: 'high' as const,
      color: 'border-rose-100 bg-white text-rose-700',
      selectedColor: 'border-rose-200 bg-rose-50 text-rose-800',
      icon: <Lock className="h-3.5 w-3.5" aria-hidden />,
    };
  }
  if (
    code.includes('write') ||
    code.includes('edit') ||
    code.includes('create') ||
    code.includes('update') ||
    code.includes('import')
  ) {
    return {
      risk: 'medium' as const,
      color: 'border-amber-100 bg-white text-amber-700',
      selectedColor: 'border-amber-200 bg-amber-50 text-amber-800',
      icon: <Edit className="h-3.5 w-3.5" aria-hidden />,
    };
  }
  return {
    risk: 'low' as const,
    color: 'border-slate-200 bg-white text-slate-600',
    selectedColor: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: <Eye className="h-3.5 w-3.5" aria-hidden />,
  };
};

const getAppIcon = (appCode: string) => {
  const key = appCode.toLowerCase();
  const props = { className: "h-5 w-5 text-primary" };
  if (key.includes('crm') || key.includes('sales')) return <Users {...props} />;
  if (key.includes('inventory') || key.includes('product')) return <Package {...props} />;
  if (key.includes('admin') || key.includes('auth')) return <Shield {...props} />;
  if (key.includes('hr') || key.includes('people')) return <Building2 {...props} />;
  if (key.includes('billing') || key.includes('finance')) return <Coins {...props} />;
  if (key.includes('analytics') || key.includes('reporting')) return <Activity {...props} />;
  return <Grid {...props} className="h-5 w-5 text-slate-500" />;
};

function RoleStatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ElementType;
}) {
  return (
    <article
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '18px 20px',
        background: 'var(--zk-paper)',
        border: '1px solid var(--zk-line)',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 8,
          background: 'var(--zk-navy)',
        }}
      >
        <Icon style={{ width: 20, height: 20, color: '#ffffff' }} />
      </div>
      <div>
        <p style={{ fontSize: 13, color: 'var(--zk-muted)', fontFamily: 'var(--zk-font)', margin: 0 }}>
          {label}
        </p>
        <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--zk-ink)', fontFamily: 'var(--zk-display)', margin: 0 }}>
          {value}
        </p>
      </div>
    </article>
  );
}

export function RoleDetailsPage() {
  const roleId = useRoleIdParam();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { setLastSegmentLabel } = useBreadcrumbLabel();
  
  // Fetch all roles and find the one we need
  const { data: rolesData = [], isLoading: rolesLoading } = useRoles({});
  
  // Fetch applications with modules for display
  const { applications, isLoading: appsLoading } = useApplications();
  
  // Fetch users to show who has this role
  const { data: usersData = [], isLoading: usersLoading } = useUsers();

  // Find role by ID
  const role = useMemo(() => {
    if (!rolesData || !roleId) return null;
    return rolesData.find((r: any) => r.roleId === roleId || r.id === roleId) || null;
  }, [rolesData, roleId]);

  // Set breadcrumb label when role is loaded, clear on unmount
  useEffect(() => {
    if (role?.roleName) {
      setLastSegmentLabel(role.roleName);
    }
    
    return () => {
      setLastSegmentLabel(null);
    };
  }, [role?.roleName, setLastSegmentLabel]);

  // Parse role permissions
  const rolePermissions = useMemo(() => {
    if (!role) return {};
    return parseRolePermissions(role.permissions);
  }, [role]);

  // Filter applications that have permissions in this role (API matrix, enabledModulesPermissions, or role-only fallback)
  const applicationsWithPermissions = useMemo(() => {
    if (!applications || !rolePermissions) return [];

    const fromApi = applications
      .map((app: any) => {
        const moduleRows =
          Array.isArray(app.modules) && app.modules.length > 0
            ? app.modules
            : modulesFromEnabledFallback(app);
        return { ...app, modules: moduleRows };
      })
      .filter((app: any) =>
        app.modules?.some((module: any) => {
          const rolePerms = getRolePermCodes(rolePermissions, app.appCode, module.moduleCode);
          return rolePerms.length > 0;
        })
      )
      .map((app: any) => {
        const modulesWithPerms =
          app.modules
            ?.filter((module: any) => {
              const rolePerms = getRolePermCodes(rolePermissions, app.appCode, module.moduleCode);
              return rolePerms.length > 0;
            })
            .map((module: any) => {
              const rolePerms = getRolePermCodes(rolePermissions, app.appCode, module.moduleCode);
              let matrix =
                module.permissions?.length > 0
                  ? module.permissions
                  : rolePerms.map((code) => ({ code, name: humanizePermCode(code) }));
              let matchedPermissions =
                matrix?.filter((perm: any) => {
                  const permCode = typeof perm === 'string' ? perm : perm.code;
                  return rolePerms.includes(permCode);
                }) || [];
              if (matchedPermissions.length === 0 && rolePerms.length > 0) {
                matrix = rolePerms.map((code) => ({ code, name: humanizePermCode(code) }));
                matchedPermissions = matrix;
              }

              return {
                ...module,
                permissions: matrix,
                rolePermissions: matchedPermissions,
                permissionCodes: rolePerms,
              };
            }) || [];

        return {
          ...app,
          modules: modulesWithPerms,
        };
      });

    if (fromApi.length > 0) return fromApi;

    return buildAppsFromRolePermissionsOnly(rolePermissions, applications);
  }, [applications, rolePermissions]);

  // Filter by search query
  const filteredApplications = useMemo(() => {
    if (!searchQuery.trim()) return applicationsWithPermissions;
    const query = searchQuery.toLowerCase();
    return applicationsWithPermissions.filter((app: any) => {
      const appMatches = app.appName.toLowerCase().includes(query) || app.appCode.toLowerCase().includes(query);
      const moduleMatches = app.modules?.some((module: any) => 
        module.moduleName.toLowerCase().includes(query) || module.moduleCode.toLowerCase().includes(query)
      );
      return appMatches || moduleMatches;
    });
  }, [applicationsWithPermissions, searchQuery]);

  /** Match ApplicationModuleRoleBuilder: single open panel; default to first app (and reset when filter changes). */
  const [openAccordionApp, setOpenAccordionApp] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (filteredApplications.length === 0) {
      setOpenAccordionApp(undefined);
      return;
    }
    setOpenAccordionApp((prev) => {
      if (prev && filteredApplications.some((a: any) => a.appCode === prev)) return prev;
      return filteredApplications[0].appCode;
    });
  }, [filteredApplications]);

  const permissionSummary = useMemo(() => {
    if (!role) return { total: 0, applicationCount: 0, moduleCount: 0 };
    return getPermissionSummary(normalizePermissions(role.permissions));
  }, [role]);

  // Filter users who have this role assigned
  const usersWithRole = useMemo(() => {
    if (!role || !usersData || !Array.isArray(usersData)) return [];
    
    const roleName = role.roleName || '';
    const roleId = role.roleId || role.id || '';
    
    return usersData.filter((user: any) => {
      // Primary check: user.role (string - role name) matches roleName
      if (user.role === roleName) return true;
      
      // Check user.roleId (direct roleId match)
      if (user.roleId === roleId) return true;
      
      // Check originalData.role object (from backend response structure)
      const originalRole = user.originalData?.role;
      if (originalRole) {
        if (originalRole.roleId === roleId) return true;
        if (originalRole.roleName === roleName) return true;
      }
      
      // Check user.roles array (if user has multiple roles)
      if (Array.isArray(user.roles)) {
        return user.roles.some((r: any) => {
          const rId = r.roleId || r.id || '';
          const rName = r.roleName || r.name || '';
          return rId === roleId || rName === roleName;
        });
      }
      
      // Check nested user.user.role (from API response structure)
      if (user.user?.role === roleName) return true;
      if (user.user?.roleId === roleId) return true;
      
      // Check originalData.user.roleId (for pending invitations)
      if (user.originalData?.user?.roleId === roleId) return true;
      
      return false;
    });
  }, [usersData, role]);

  const isLoading = rolesLoading || appsLoading || usersLoading;

  if (isLoading) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-[400px]">
          <AnimatedLoader size="md" />
        </div>
      </Container>
    );
  }

  if (!role) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <AlertCircle className="h-12 w-12 text-gray-400" />
          <h2 className="text-xl font-semibold">Role Not Found</h2>
          <p className="text-gray-600">The role you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate({ to: '/dashboard/roles' })} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Roles
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/dashboard/roles' })}
          className="gap-2 -ml-2 text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Roles
        </Button>
      </div>

      <DashboardPageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-sm font-semibold"
              style={{ backgroundColor: `${role.color}20`, color: role.color }}
            >
              {role.metadata?.icon || '👤'}
            </div>
            <span className={DASHBOARD_PAGE_TITLE_CLASS}>{role.roleName}</span>
          </span>
        }
        description="View detailed information about this role and its permissions."
      />

      {/* Stats — same grid + cards as Team Members */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RoleStatCard label="Total permissions" value={permissionSummary.total} icon={Shield} />
        <RoleStatCard label="Applications" value={permissionSummary.applicationCount} icon={LayoutGrid} />
        <RoleStatCard label="Modules" value={permissionSummary.moduleCount} icon={Layers} />
        <RoleStatCard label="Users" value={usersWithRole.length} icon={Users} />
      </div>

      {/* Search — same pattern as Team Members tab filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search apps and modules"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 rounded-lg border pl-9 text-sm placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Main content — rounded card shell like Team table / dashboard modules */}
      <div className="mt-6 rounded-lg border bg-white p-4 sm:p-6" style={{ borderColor: 'var(--zk-line)' }}>
        <div className="custom-scrollbar">
          {filteredApplications.length > 0 ? (
            <Accordion
              type="single"
              collapsible
              value={openAccordionApp ?? ''}
              onValueChange={(v) => setOpenAccordionApp(v || undefined)}
              className="space-y-4"
            >
              {filteredApplications.map((app: any) => {
                const totalAppPerms = app.modules?.reduce((sum: number, m: any) => sum + (m.rolePermissions?.length || 0), 0) || 0;
                const totalModulePerms = app.modules?.reduce((sum: number, m: any) => sum + (m.permissions?.length || 0), 0) || 0;

                return (
                  <AccordionItem
                    key={app.appCode}
                    value={app.appCode}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                  >
                    <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-slate-50/80 [&[data-state=open]]:bg-primary/[0.04]">
                      <div className="flex w-full items-center justify-between pr-4 text-left">
                        <div className="flex items-center gap-4">
                          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary bg-primary text-white [&_svg]:!text-white">
                            {getAppIcon(app.appCode)}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2 leading-tight sm:gap-3">
                              <span className="text-sm font-semibold text-primary">
                                {app.appName}
                              </span>
                              <Badge
                                variant="outline"
                                className="h-5 border-slate-200 px-2 text-[10px] font-medium"
                              >
                                {app.appCode}
                              </Badge>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-medium">
                                {app.modules?.length || 0} modules
                              </span>
                              <span aria-hidden className="text-slate-300">
                                ·
                              </span>
                              <span className="font-medium tabular-nums">
                                {totalAppPerms}/{totalModulePerms} permissions
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="border-t border-gray-100 bg-white p-0">
                      <div className="divide-y divide-slate-100">
                        {app.modules?.map((module: any) => {
                          const rolePerms = module.rolePermissions || [];
                          const isModuleActive = rolePerms.length > 0;
                          const isAllModuleSelected = rolePerms.length === (module.permissions?.length || 0) && (module.permissions?.length || 0) > 0;

                          return (
                            <div key={module.moduleCode} className={cn(
                              "grid grid-cols-12 items-start gap-6 p-6 transition-all",
                              isModuleActive ? "bg-slate-50/80" : "opacity-70 hover:bg-slate-50/50"
                            )}>
                              {/* Module header — left rail like Role builder / reference */}
                              <div className="col-span-12 space-y-4 border-b border-slate-200 pb-5 pr-0 sm:col-span-2 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-5">
                                <div className="space-y-2">
                                  <h4 className={cn('text-sm font-medium text-primary', !isModuleActive && 'opacity-80')}>
                                    {module.moduleName}
                                  </h4>
                                  <p className="text-[10px] text-slate-400">
                                    {module.moduleCode}
                                  </p>
                                </div>

                                <div
                                  className={cn(
                                    'w-full rounded-lg border px-3 py-2 text-center text-[10px] font-medium transition-colors',
                                    isAllModuleSelected
                                      ? 'border-primary bg-primary text-white'
                                      : isModuleActive
                                        ? 'border-slate-300 bg-slate-100 text-primary'
                                        : 'border-slate-200 bg-slate-50 text-slate-400',
                                  )}
                                >
                                  {isAllModuleSelected ? 'All' : isModuleActive ? 'Partial' : 'None'}
                                </div>
                              </div>

                              {/* Permission cards — Role builder matrix (square tiles, READY / ACTIVE) */}
                              <div className="col-span-12 min-w-0 sm:col-span-10">
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                                  {module.permissions?.map((perm: any) => {
                                    const permCode = typeof perm === 'string' ? perm : perm.code;
                                    const permName = typeof perm === 'string' ? perm : perm.name || perm.code;
                                    const isSelected = module.permissionCodes?.includes(permCode) || false;
                                    const permUI = analyzePermissionType(permCode);
                                    const title = permName.trim();

                                    return (
                                      <div
                                        key={permCode}
                                        className={cn(
                                          'group/chip relative flex min-h-[118px] select-none flex-col gap-2 rounded-lg border p-3 text-left',
                                          isSelected ? permUI.selectedColor : permUI.color,
                                        )}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div
                                            className={cn(
                                              'rounded-lg p-1',
                                              isSelected ? 'bg-white/60' : 'opacity-40',
                                            )}
                                          >
                                            {permUI.icon}
                                          </div>
                                          {isSelected && (
                                            <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                                          )}
                                        </div>

                                        <div className="flex flex-1 flex-col items-center justify-center px-0.5 text-center">
                                          <p
                                            className={cn(
                                              'line-clamp-3 break-words text-[10px] font-medium leading-tight',
                                              isSelected
                                                ? 'text-primary'
                                                : 'text-slate-500',
                                            )}
                                          >
                                            {title}
                                          </p>
                                        </div>

                                        <div className="flex items-center justify-center gap-1 text-[9px] text-slate-400">
                                          <Hash className="h-2 w-2 shrink-0" aria-hidden />
                                          <span className="truncate">{permCode}</span>
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
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 py-12">
              <Search className="mb-3 h-10 w-10 text-slate-300" />
              <h3 className="text-base font-medium text-primary">
                {searchQuery ? 'No matching applications found' : 'No permissions assigned'}
              </h3>
            </div>
          )}
        </div>
      </div>

        {/* Users with this Role */}
        {usersWithRole.length > 0 && (
          <div className="mt-6">
            <Card className="overflow-hidden rounded-lg border bg-white" style={{ borderColor: 'var(--zk-line)' }}>
              <CardHeader className="p-5 pb-3">
                <CardTitle className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--zk-ink)' }}>
                  <Users className="h-4 w-4 text-primary" />
                  Users with this role ({usersWithRole.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {usersWithRole.map((user: any) => {
                    const userName = user.firstName && user.lastName 
                      ? `${user.firstName} ${user.lastName}`
                      : user.name || user.email?.split('@')[0] || 'Unknown User';
                    const userInitial = (user.firstName?.[0] || user.email?.[0] || 'U').toUpperCase();
                    
                    return (
                      <div
                        key={user.userId || user.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors hover:bg-slate-100/80"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-white">
                            {userInitial}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-sm font-medium text-primary">
                              {userName}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="text-xs text-slate-500 truncate">
                                {user.email || 'No email'}
                              </span>
                            </div>
                          </div>
                          {user.isActive !== false && user.invitationStatus !== 'pending' && (
                            <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                              Active
                            </Badge>
                          )}
                          {user.invitationStatus === 'pending' && (
                            <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* No Users Message */}
        {usersWithRole.length === 0 && !usersLoading && (
          <div className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <UserIcon className="w-4 h-4" />
              <span className="text-sm font-medium">No users assigned to this role</span>
            </div>
          </div>
        )}

        {/* System Role Notice */}
        {role.isSystemRole && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="text-sm text-slate-700">
                This is a system role with predefined permissions.
              </span>
            </div>
          </div>
        )}

        <style dangerouslySetInnerHTML={{
          __html: `
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        `}} />
    </Container>
  );
}
