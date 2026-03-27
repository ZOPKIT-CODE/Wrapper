import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Shield, LayoutGrid, Layers, Users, Search, Lock, Edit, Eye, Grid, Package, Building2, Coins, Activity } from 'lucide-react';
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
import { useTheme } from '@/components/theme/ThemeProvider';
import { useBreadcrumbLabel } from '@/contexts/BreadcrumbLabelContext';
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

const analyzePermissionType = (permCode: string) => {
  const code = permCode.toLowerCase();
  if (code.includes('admin') || code.includes('manage') || code.includes('delete') || code.includes('approve') || code.includes('assign')) {
    return {
      risk: 'high' as const,
      color: 'bg-rose-50 border-rose-200 text-rose-900 shadow-sm ring-1 ring-rose-300 dark:bg-rose-900/60 dark:border-rose-500 dark:text-rose-100 dark:ring-rose-700',
      icon: <Lock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
    };
  }
  if (code.includes('write') || code.includes('edit') || code.includes('create') || code.includes('update') || code.includes('import')) {
    return {
      risk: 'medium' as const,
      color: 'bg-amber-50 border-amber-200 text-amber-900 shadow-sm ring-1 ring-amber-300 dark:bg-amber-900/60 dark:border-amber-500 dark:text-amber-100 dark:ring-amber-700',
      icon: <Edit className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
    };
  }
  return {
    risk: 'low' as const,
    color: 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm ring-1 ring-emerald-300 dark:bg-emerald-900/60 dark:border-emerald-500 dark:text-emerald-100 dark:ring-emerald-700',
    icon: <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
  };
};

const getAppIcon = (appCode: string) => {
  const key = appCode.toLowerCase();
  const props = { className: "w-5 h-5" };
  if (key.includes('crm') || key.includes('sales')) return <Users {...props} className="text-blue-500" />;
  if (key.includes('inventory') || key.includes('product')) return <Package {...props} className="text-indigo-500" />;
  if (key.includes('admin') || key.includes('auth')) return <Shield {...props} className="text-rose-500" />;
  if (key.includes('hr') || key.includes('people')) return <Building2 {...props} className="text-emerald-500" />;
  if (key.includes('billing') || key.includes('finance')) return <Coins {...props} className="text-amber-500" />;
  if (key.includes('analytics') || key.includes('reporting')) return <Activity {...props} className="text-violet-500" />;
  return <Grid {...props} className="text-slate-400" />;
};

export function RoleDetailsPage() {
  const { roleId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { actualTheme } = useTheme();
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

  // Filter applications that have permissions in this role
  const applicationsWithPermissions = useMemo(() => {
    if (!applications || !rolePermissions) return [];
    
    return applications
      .filter((app: any) => {
        // Show app if it has any modules with permissions in the role
        return app.modules?.some((module: any) => {
          const rolePerms = rolePermissions[app.appCode]?.[module.moduleCode] || [];
          return rolePerms.length > 0;
        });
      })
      .map((app: any) => {
        // Filter modules to only those with permissions
        const modulesWithPerms = app.modules?.filter((module: any) => {
          const rolePerms = rolePermissions[app.appCode]?.[module.moduleCode] || [];
          return rolePerms.length > 0;
        }).map((module: any) => {
          const rolePerms = rolePermissions[app.appCode]?.[module.moduleCode] || [];
          // Match role permissions with module permissions to get full permission objects
          const matchedPermissions = module.permissions?.filter((perm: any) => {
            const permCode = typeof perm === 'string' ? perm : perm.code;
            return rolePerms.includes(permCode);
          }) || [];
          
          return {
            ...module,
            rolePermissions: matchedPermissions,
            permissionCodes: rolePerms
          };
        }) || [];
        
        return {
          ...app,
          modules: modulesWithPerms
        };
      });
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
  const isDark = actualTheme === 'dark';

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
    <Container className="space-y-0">
      <div className="flex flex-col min-h-0 bg-white dark:bg-slate-950 relative">
        {/* Header */}
        <div className="flex items-center gap-4 mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/dashboard/roles' })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Roles
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-semibold border border-slate-100 dark:border-slate-800 shadow-sm"
                style={{ backgroundColor: `${role.color}20`, color: role.color }}
              >
                {role.metadata?.icon || '👤'}
              </div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-[#1B2E5A] dark:text-white">
                {role.roleName}
              </h1>
            </div>
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-1">
              View detailed information about this role and its permissions
            </p>
          </div>
        </div>

        {/* Executive KPI Bar */}
        <div className={cn(
          "flex-none px-8 py-2 border-b flex items-center justify-between transition-all",
          isDark ? "bg-slate-900/40 border-slate-800" : "bg-slate-50/30 border-slate-100"
        )}>
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Total Permissions</span>
              <div className="flex items-center gap-2">
                <Shield className="w-3 h-3 text-blue-500" />
                <span className="text-[10px] font-black text-[#1B2E5A] dark:text-white tabular-nums">{permissionSummary.total}</span>
              </div>
            </div>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
            <div className="flex flex-col">
              <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Applications</span>
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-3 h-3 text-indigo-500" />
                <span className="text-[10px] font-black text-[#1B2E5A] dark:text-white tabular-nums">{permissionSummary.applicationCount}</span>
              </div>
            </div>
            <div className="w-px h-6 bg-slate-200 dark:border-slate-800" />
            <div className="flex flex-col">
              <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Modules</span>
              <div className="flex items-center gap-2">
                <Layers className="w-3 h-3 text-purple-500" />
                <span className="text-[10px] font-black text-[#1B2E5A] dark:text-white tabular-nums">{permissionSummary.moduleCount}</span>
              </div>
            </div>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
            <div className="flex flex-col">
              <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Users</span>
              <div className="flex items-center gap-2">
                <Users className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] font-black text-[#1B2E5A] dark:text-white tabular-nums">{usersWithRole.length}</span>
              </div>
            </div>
          </div>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <Input
              placeholder="Search applications and modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-[9px] rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Applications Accordion */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative bg-slate-50/20 dark:bg-slate-950/40 min-h-0">
          {filteredApplications.length > 0 ? (
            <Accordion type="multiple" defaultValue={filteredApplications.map((app: any) => app.appCode)} className="space-y-3">
              {filteredApplications.map((app: any) => {
                const totalAppPerms = app.modules?.reduce((sum: number, m: any) => sum + (m.rolePermissions?.length || 0), 0) || 0;
                const totalModulePerms = app.modules?.reduce((sum: number, m: any) => sum + (m.permissions?.length || 0), 0) || 0;

                return (
                  <AccordionItem
                    key={app.appCode}
                    value={app.appCode}
                    className={cn(
                      "border rounded-[32px] overflow-hidden transition-all shadow-sm",
                      "border-blue-200/50 bg-blue-50/5 dark:border-blue-900/20 dark:bg-blue-900/5"
                    )}
                  >
                    <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all [&[data-state=open]]:bg-[#1B2E5A]/5 group/trigger">
                      <div className="flex items-center justify-between w-full pr-6 text-left">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all border relative shadow-sm bg-white dark:bg-slate-800 border-blue-500 text-white shadow-blue-500/10">
                            {getAppIcon(app.appCode)}
                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                          </div>
                          <div>
                            <div className="text-[13px] font-black text-[#1B2E5A] dark:text-white uppercase flex items-center gap-2 leading-none tracking-tight">
                              {app.appName}
                              <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5">Active</Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1 opacity-60">
                              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{app.modules?.length || 0} Modules</span>
                              <div className="w-1 h-1 rounded-full bg-slate-300" />
                              <span className="text-[9px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">{totalAppPerms}/{totalModulePerms} Permissions</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950/20">
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {app.modules?.map((module: any) => {
                          const rolePerms = module.rolePermissions || [];
                          const isModuleActive = rolePerms.length > 0;
                          const isAllModuleSelected = rolePerms.length === (module.permissions?.length || 0) && (module.permissions?.length || 0) > 0;

                          return (
                            <div key={module.moduleCode} className={cn(
                              "p-4 grid grid-cols-12 gap-6 items-start transition-all",
                              isModuleActive ? "bg-blue-50/[0.03] dark:bg-blue-900/[0.02]" : "opacity-60 grayscale-[0.5] hover:bg-slate-50/50"
                            )}>
                              {/* Module Identity Column */}
                              <div className="col-span-2 border-r border-slate-100 dark:border-slate-800 pr-4 pt-1 space-y-2">
                                <div>
                                  <h4 className={cn(
                                    "text-[13px] font-black uppercase tracking-tight leading-tight mb-1",
                                    isModuleActive ? "text-[#1B2E5A] dark:text-white" : "text-slate-400"
                                  )}>
                                    {module.moduleName}
                                  </h4>
                                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{module.moduleCode}</div>
                                </div>

                                <div className="space-y-2 pt-1">
                                  <div className={cn(
                                    "w-full py-1.5 px-2 rounded-xl text-[8px] font-black uppercase tracking-widest text-center shadow-sm border",
                                    isAllModuleSelected
                                      ? "bg-[#1B2E5A] border-blue-500 text-white"
                                      : isModuleActive
                                        ? "bg-blue-50 border-blue-200 text-blue-600"
                                        : "bg-slate-50 border-slate-200 text-slate-400"
                                  )}>
                                    {isAllModuleSelected ? 'FULL ACCESS' : isModuleActive ? 'PARTIAL' : 'INACTIVE'}
                                  </div>

                                  <div className="flex justify-between items-center px-1 opacity-60">
                                    <span className="text-[8px] font-black uppercase text-slate-400">Permissions</span>
                                    <span className="text-[9px] font-black text-slate-700 dark:text-slate-300">{rolePerms.length}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Permission Matrix Column */}
                              <div className="col-span-10">
                                <div className="grid grid-cols-6 gap-2.5">
                                  {module.permissions?.map((perm: any) => {
                                    const permCode = typeof perm === 'string' ? perm : perm.code;
                                    const permName = typeof perm === 'string' ? perm : perm.name || perm.code;
                                    const isSelected = module.permissionCodes?.includes(permCode) || false;
                                    const permUI = analyzePermissionType(permCode);

                                    return (
                                      <div
                                        key={permCode}
                                        className={cn(
                                          "group/chip relative flex flex-col gap-2 p-3 rounded-xl border transition-all text-left h-full select-none",
                                          isSelected
                                            ? permUI.risk === 'high' 
                                              ? "bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-900/40 shadow-inner ring-1 ring-rose-200/50"
                                              : permUI.risk === 'medium' 
                                                ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/40 shadow-inner ring-1 ring-amber-200/50"
                                                : "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900/40 shadow-inner ring-1 ring-emerald-200/50"
                                            : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                                        )}
                                      >
                                        <div className="flex items-start justify-between">
                                          <div className={cn(
                                            "p-1 rounded-lg transition-colors",
                                            isSelected ? "bg-white dark:bg-slate-950 shadow-sm" : "opacity-30 group-hover/chip:opacity-60"
                                          )}>
                                            {permUI.icon}
                                          </div>
                                          <Badge variant="outline" className={cn(
                                            "text-[7px] h-3.5 px-1 font-black leading-none uppercase border-none transition-all",
                                            isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-300"
                                          )}>
                                            {isSelected ? 'ACTIVE' : 'READY'}
                                          </Badge>
                                        </div>

                                        <div className="flex-1">
                                          <div className={cn(
                                            "text-[10px] font-black uppercase leading-tight tracking-tight mb-0.5",
                                            isSelected ? "text-[#1B2E5A] dark:text-white" : "text-slate-400"
                                          )}>
                                            {permName}
                                          </div>
                                          <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter line-clamp-2 opacity-60">
                                            {permCode}
                                          </div>
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
            <div className="flex flex-col items-center justify-center py-12 bg-slate-50/50 dark:bg-slate-900/10 rounded-[24px] border-2 border-dashed border-slate-200 dark:border-slate-800">
              <Search className="w-10 h-10 text-slate-300 mb-3" />
              <h3 className="text-base font-black text-[#1B2E5A] dark:text-white uppercase tracking-tight">
                {searchQuery ? 'No matching applications found' : 'No permissions assigned'}
              </h3>
            </div>
          )}
        </div>

        {/* Users with this Role */}
        {usersWithRole.length > 0 && (
          <div className="mt-4">
            <Card className="rounded-[24px] overflow-hidden border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-[13px] font-black uppercase tracking-tight text-[#1B2E5A] dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-500" />
                  Users with this Role ({usersWithRole.length})
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
                        className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-xs shrink-0">
                            {userInitial}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-black text-[#1B2E5A] dark:text-white truncate">
                              {userName}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {user.email || 'No email'}
                              </span>
                            </div>
                          </div>
                          {user.isActive !== false && user.invitationStatus !== 'pending' && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 shrink-0">
                              Active
                            </Badge>
                          )}
                          {user.invitationStatus === 'pending' && (
                            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 shrink-0">
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
          <div className="mt-4 p-4 rounded-[20px] border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <UserIcon className="w-4 h-4" />
              <span className="text-sm font-medium">No users assigned to this role</span>
            </div>
          </div>
        )}

        {/* System Role Notice */}
        {role.isSystemRole && (
          <div className="mt-3 p-3 rounded-[20px] border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-950/30">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-black uppercase tracking-tight text-blue-900 dark:text-blue-100">
                This is a system role with predefined permissions
              </span>
            </div>
          </div>
        )}

        <style dangerouslySetInnerHTML={{
          __html: `
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); }
        `}} />
      </div>
    </Container>
  );
}
