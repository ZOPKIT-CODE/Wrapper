import React, { useState, useMemo } from 'react';
import {
  Shield,
  Eye,
  Edit,
  Settings,
  Users,
  Database,
  Package,
  Layers,
  Grid,
  Activity,
  Search,
  Lock,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PermissionSummaryProps {
  permissions: Record<string, any> | string[];
  roleName: string;
  restrictions?: Record<string, any>;
  isSystemRole?: boolean;
  userCount?: number;
  className?: string;
}

interface PermissionDetail {
  name: string;
  code: string;
  category: 'admin' | 'write' | 'read';
  risk: 'high' | 'medium' | 'low';
  description: string;
  icon: React.ReactNode;
  color: string;
}


/**
 * Enterprise-Grade Permission Summary Component
 * Displays granular permissions with advanced filtering, search, and high-end aesthetics.
 */
export function EnhancedPermissionSummary({
  permissions,
  roleName,
  isSystemRole = false,
  className = ""
}: PermissionSummaryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'admin' | 'write' | 'read'>('all');

  // Helper functions for display names and icons
  const getApplicationDisplayName = (appCode: string) => {
    const names: Record<string, string> = {
      'crm': 'CRM',
      'hr': 'HRMS',
      'affiliate': 'Affiliate',
      'system': 'System',
      'finance': 'Finance',
      'inventory': 'Inventory',
      'analytics': 'Analytics'
    };
    return names[appCode] || appCode.toUpperCase();
  };

  const getModuleDisplayName = (moduleCode: string) => {
    const names: Record<string, string> = {
      'leads': 'Leads',
      'accounts': 'Accounts',
      'contacts': 'Contacts',
      'opportunities': 'Opps',
      'quotations': 'Quotes',
      'dashboard': 'Dash',
      'employees': 'Staff',
      'payroll': 'Payroll',
      'leave': 'Leave',
      'partners': 'Partners',
      'commissions': 'Comms',
      'deals': 'Deals',
      'companies': 'Orgs',
      'attendance': 'Time',
      'recruitment': 'Hire',
      'users': 'Users',
      'settings': 'Config',
      'roles': 'Roles',
      'permissions': 'Perms',
      'reports': 'BI'
    };
    return names[moduleCode] || moduleCode.charAt(0).toUpperCase() + moduleCode.slice(1);
  };

  const getApplicationIcon = (appCode: string) => {
    const icons: Record<string, React.ReactNode> = {
      'crm': <Users className="w-3.5 h-3.5" />,
      'hr': <Users className="w-3.5 h-3.5" />,
      'affiliate': <Activity className="w-3.5 h-3.5" />,
      'system': <Settings className="w-3.5 h-3.5" />,
      'finance': <Database className="w-3.5 h-3.5" />,
      'inventory': <Package className="w-3.5 h-3.5" />,
      'analytics': <Grid className="w-3.5 h-3.5" />
    };
    return icons[appCode] || <Layers className="w-3.5 h-3.5" />;
  };

  const getPermissionDescription = (permission: string) => {
    const descriptions: Record<string, string> = {
      'read': 'View records',
      'read_all': 'View all org data',
      'create': 'Add entries',
      'update': 'Edit data',
      'delete': 'Remove records',
      'export': 'Download data',
      'import': 'Bulk upload',
      'assign': 'Task assignment',
      'approve': 'Approval power',
      'manage': 'Full control',
      'admin': 'System management'
    };
    return descriptions[permission.toLowerCase()] || `${permission.replace('_', ' ')} access`;
  };

  const analyzePermissionType = (action: string, appKey: string, moduleKey: string): PermissionDetail => {
    const perm = action.toLowerCase();
    const code = `${appKey}.${moduleKey}.${action}`;

    if (perm.includes('delete') || perm.includes('admin') || perm.includes('manage') ||
      perm.includes('approve') || perm.includes('assign') || perm.includes('calculate') ||
      perm.includes('pay') || perm.includes('reject') || perm.includes('cancel')) {
      return {
        name: action,
        code,
        category: 'admin',
        risk: 'high',
        description: getPermissionDescription(action),
        icon: <Shield className="w-3 h-3 text-rose-500" />,
        color: 'text-rose-600 bg-rose-50 border-rose-100'
      };
    }

    if (perm.includes('create') || perm.includes('update') || perm.includes('edit') ||
      perm.includes('import') || perm.includes('upload') || perm.includes('modify')) {
      return {
        name: action,
        code,
        category: 'write',
        risk: 'medium',
        description: getPermissionDescription(action),
        icon: <Edit className="w-3 h-3 text-amber-500" />,
        color: 'text-amber-600 bg-amber-50 border-amber-100'
      };
    }

    return {
      name: action,
      code,
      category: 'read',
      risk: 'low',
      description: getPermissionDescription(action),
      icon: <Eye className="w-3 h-3 text-emerald-500" />,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100'
    };
  };

  // Main permission analysis logic
  const analysis = useMemo(() => {
    let totalPermissions = 0;
    let adminCount = 0;
    let writeCount = 0;
    let readCount = 0;

    // Group records by App + Module
    const groupMap: Record<string, {
      app: string;
      appIcon: React.ReactNode;
      module: string;
      permissions: PermissionDetail[]
    }> = {};

    const processPermission = (appKey: string, moduleKey: string, action: string) => {
      const appName = getApplicationDisplayName(appKey);
      const moduleName = getModuleDisplayName(moduleKey);
      const groupKey = `${appKey}-${moduleKey}`;

      const detail = analyzePermissionType(action, appKey, moduleKey);

      // Filter based on search and type
      const searchTerms = searchQuery.toLowerCase();
      const matchesSearch =
        appName.toLowerCase().includes(searchTerms) ||
        moduleName.toLowerCase().includes(searchTerms) ||
        action.toLowerCase().includes(searchTerms) ||
        detail.code.toLowerCase().includes(searchTerms);

      const matchesFilter = filterType === 'all' || detail.category === filterType;

      if (matchesSearch && matchesFilter) {
        if (!groupMap[groupKey]) {
          groupMap[groupKey] = {
            app: appName,
            appIcon: getApplicationIcon(appKey),
            module: moduleName,
            permissions: []
          };
        }

        groupMap[groupKey].permissions.push(detail);

        if (detail.category === 'admin') adminCount++;
        else if (detail.category === 'write') writeCount++;
        else readCount++;

        totalPermissions++;
      }
    };

    if (permissions && typeof permissions === 'object' && !Array.isArray(permissions)) {
      Object.entries(permissions).forEach(([appKey, appPerms]) => {
        if (appKey === 'metadata') return;
        if (typeof appPerms === 'object' && appPerms !== null) {
          Object.entries(appPerms).forEach(([moduleKey, modulePerms]) => {
            if (Array.isArray(modulePerms)) {
              (modulePerms as string[]).forEach(perm => processPermission(appKey, moduleKey, perm));
            } else if (typeof modulePerms === 'object' && modulePerms !== null) {
              Object.entries(modulePerms).forEach(([action, allowed]) => {
                if (allowed === true || allowed === 'true') {
                  processPermission(appKey, moduleKey, action);
                }
              });
            }
          });
        }
      });
    } else if (Array.isArray(permissions)) {
      permissions.forEach(perm => {
        const parts = perm.split('.');
        if (parts.length >= 3) {
          processPermission(parts[0], parts[1], parts[2]);
        }
      });
    }

    return {
      totalPermissions,
      adminCount,
      writeCount,
      readCount,
      grouped: Object.values(groupMap)
    };
  }, [permissions, searchQuery, filterType]);

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Header & Controls - Compact */}
      <Card className="bg-white border-slate-200 shadow-xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 py-3 px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/5 rounded-lg border border-primary/20 shadow-sm">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-primary tracking-tight">
                  Permission Matrix
                </CardTitle>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  Role: <span className="text-primary">{roleName}</span>
                  {isSystemRole && <Lock className="w-2.5 h-2.5 ml-1 text-slate-400" />}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {[
                { label: 'Admin', count: analysis.adminCount, color: 'text-rose-600', bg: 'bg-rose-50' },
                { label: 'Write', count: analysis.writeCount, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Read', count: analysis.readCount, color: 'text-emerald-600', bg: 'bg-emerald-50' }
              ].map((stat, i) => (
                <div key={i} className={cn("px-2 py-1 rounded-md border border-slate-100 text-[10px] font-bold", stat.bg, stat.color)}>
                  {stat.count} {stat.label}
                </div>
              ))}
              <div className="px-2 py-1 bg-slate-50 border border-primary/20 rounded-md text-[10px] font-bold text-slate-700">
                Total: {analysis.totalPermissions}
              </div>
            </div>
          </div>

          {/* Compact Toolbar */}
          <div className="flex gap-2 mt-3 items-center">
            <div className="relative flex-1 group">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Table search..."
                className="pl-8 bg-slate-50 border-slate-200 h-8 text-[12px] rounded-lg focus:ring-1 focus:ring-blue-500/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 rounded-md transition-colors"
                >
                  <X className="w-3 h-3 text-slate-400" />
                </button>
              )}
            </div>

            <div className="flex bg-slate-50 border border-primary/20 rounded-lg p-0.5 h-8">
              {(['all', 'admin', 'write', 'read'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all capitalize",
                    filterType === type ? "bg-white text-primary shadow-sm border border-primary/20" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent max-h-[850px] overflow-y-auto">
          {analysis.grouped.length > 0 ? (
            <table className="w-full text-center border-collapse table-fixed">
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-50 border-b border-slate-200 shadow-sm">
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 w-[180px] border-r border-slate-200/50 text-center">Application</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 w-[160px] border-r border-slate-200/50 text-center">Module</th>
                  <th className="py-4 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Granted Permissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analysis.grouped.map((group: any, idx: number) => (
                  <tr
                    key={idx}
                    className="group hover:bg-primary/5"
                  >
                    <td className="p-0 border-r border-slate-100/50 w-[180px] align-middle bg-slate-50/20 group-hover:bg-slate-50/50">
                      <div className="flex flex-col items-center justify-center gap-3 p-4">
                        <div className="w-10 h-10 rounded-xl bg-white border border-primary/20 shadow-sm flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:border-primary/20">
                          {group.appIcon}
                        </div>
                        <span className="text-[13px] font-bold text-slate-800 tracking-tight leading-tight text-center">{group.app}</span>
                      </div>
                    </td>
                    <td className="p-0 border-r border-slate-100/50 w-[160px] align-middle bg-slate-50/10 group-hover:bg-slate-50/30">
                      <div className="p-4 flex flex-col items-center justify-center">
                        <span className="inline-block font-bold text-[12px] text-slate-600 tracking-tight group-hover:text-primary text-center">
                          {group.module}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 align-middle">
                      <div className="flex flex-wrap justify-center gap-2 max-w-full">
                        {group.permissions.map((perm: any, pIdx: number) => (
                          <div
                            key={pIdx}
                            className={cn(
                              "group/perm flex items-center gap-2 px-2.5 py-1.5 rounded-lg border shadow-sm min-w-[110px] max-w-[160px]",
                              perm.color,
                              "bg-white"
                            )}
                            title={`${perm.code}: ${perm.description}`}
                          >
                            <div className="shrink-0 scale-90">
                              {perm.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-bold text-slate-800 truncate leading-tight">
                                {perm.name}
                              </div>
                              <div className="text-[8px] font-mono text-slate-400 truncate opacity-70">
                                {perm.code.split('.').pop()}
                              </div>
                            </div>
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full shrink-0 shadow-sm",
                              perm.risk === 'high' ? "bg-rose-500" :
                                perm.risk === 'medium' ? "bg-amber-500" :
                                  "bg-emerald-500"
                            )} />
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-20 text-center">
              <div className="inline-flex p-5 bg-slate-50 rounded-3xl border border-slate-100 mb-4 shadow-inner">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">No matching records found</p>
              <p className="text-xs text-slate-400 mt-2">Try adjusting your filters or search query</p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
