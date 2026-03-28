import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, LayoutGrid, Layers, Users, Lock, Edit, Eye } from 'lucide-react';
import { getPermissionSummary } from '../utils/permissionUtils';
import { useTheme } from '@/components/theme/ThemeProvider';
import { cn } from '@/lib/utils';

interface EnhancedPermissionSummaryProps {
  permissions: Record<string, any>;
  roleName: string;
  restrictions?: Record<string, any>;
  isSystemRole: boolean;
  userCount: number;
  className?: string;
}

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

export function EnhancedPermissionSummary({
  permissions,
  roleName,
  restrictions,
  isSystemRole,
  userCount,
  className,
}: EnhancedPermissionSummaryProps) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  
  // Normalize permissions before calculating summary
  const normalizedPermissions = normalizePermissions(permissions);
  const permissionSummary = getPermissionSummary(normalizedPermissions);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Permission Overview */}
      <Card className="rounded-[32px] overflow-hidden border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <CardHeader className="p-6">
          <CardTitle className="text-[14px] font-black uppercase tracking-tight text-[#1B2E5A] dark:text-white">Permission Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex flex-col items-start gap-3 min-w-0">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl shrink-0">
                <Shield className="w-6 h-6 text-blue-500" />
              </div>
              <span className="text-4xl font-black tabular-nums text-[#1B2E5A] dark:text-white leading-none">{permissionSummary.total}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Permissions</span>
            </div>
            <div className="flex flex-col items-start gap-3 min-w-0">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl shrink-0">
                <LayoutGrid className="w-6 h-6 text-[#1B2E5A]" />
              </div>
              <span className="text-4xl font-black tabular-nums text-[#1B2E5A] dark:text-white leading-none">{permissionSummary.applicationCount}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Applications</span>
            </div>
            <div className="flex flex-col items-start gap-3 min-w-0">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-2xl shrink-0">
                <Layers className="w-6 h-6 text-purple-500" />
              </div>
              <span className="text-4xl font-black tabular-nums text-[#1B2E5A] dark:text-white leading-none">{permissionSummary.moduleCount}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Modules</span>
            </div>
            <div className="flex flex-col items-start gap-3 min-w-0">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl shrink-0">
                <Users className="w-6 h-6 text-emerald-500" />
              </div>
              <span className="text-4xl font-black tabular-nums text-[#1B2E5A] dark:text-white leading-none">{userCount}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Users</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permission Breakdown */}
      <Card className="rounded-[32px] overflow-hidden border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <CardHeader className="p-6">
          <CardTitle className="text-[14px] font-black uppercase tracking-tight text-[#1B2E5A] dark:text-white">Permission Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span className="text-sm font-black uppercase tracking-tight text-[#1B2E5A] dark:text-white">Administrative Permissions</span>
              </div>
              <Badge className="bg-rose-100 border-rose-400 text-rose-900 shadow-sm ring-1 ring-rose-300 dark:bg-rose-900/60 dark:border-rose-500 dark:text-rose-100 dark:ring-rose-700 font-black">
                {permissionSummary.admin}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Edit className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-black uppercase tracking-tight text-[#1B2E5A] dark:text-white">Write Permissions</span>
              </div>
              <Badge className="bg-amber-100 border-amber-400 text-amber-900 shadow-sm ring-1 ring-amber-300 dark:bg-amber-900/60 dark:border-amber-500 dark:text-amber-100 dark:ring-amber-700 font-black">
                {permissionSummary.write}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-black uppercase tracking-tight text-[#1B2E5A] dark:text-white">Read Permissions</span>
              </div>
              <Badge className="bg-emerald-100 border-emerald-400 text-emerald-900 shadow-sm ring-1 ring-emerald-300 dark:bg-emerald-900/60 dark:border-emerald-500 dark:text-emerald-100 dark:ring-emerald-700 font-black">
                {permissionSummary.read}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Module Details */}
      {Object.keys(permissionSummary.moduleDetails).length > 0 && (
        <Card className="rounded-[32px] overflow-hidden border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardHeader className="p-6">
            <CardTitle className="text-[14px] font-black uppercase tracking-tight text-[#1B2E5A] dark:text-white">Module Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {Object.entries(permissionSummary.moduleDetails).map(([module, operations]) => (
                <div key={module} className="rounded-xl border border-slate-100 dark:border-slate-800 p-4">
                  <div className="font-black uppercase tracking-tight text-[#1B2E5A] dark:text-white mb-2">{module}</div>
                  <div className="flex flex-wrap gap-1">
                    {operations.map((operation, index) => (
                      <Badge key={index} variant="outline" className="text-xs border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                        {operation}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Restrictions */}
      {restrictions && Object.keys(restrictions).length > 0 && (
        <Card className="rounded-[32px] overflow-hidden border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardHeader className="p-6">
            <CardTitle className="text-[14px] font-black uppercase tracking-tight text-[#1B2E5A] dark:text-white">Restrictions</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-2">
              {Object.entries(restrictions).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">{key}:</span>
                  <span className="text-sm text-[#1B2E5A] dark:text-white font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Role Notice */}
      {isSystemRole && (
        <Card className="rounded-[32px] border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-950/30 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-black uppercase tracking-tight text-blue-900 dark:text-blue-100">
                This is a system role with predefined permissions
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
