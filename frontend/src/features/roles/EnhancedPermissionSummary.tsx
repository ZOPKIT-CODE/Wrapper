import React, { useState, useMemo, useCallback } from 'react'
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
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface PermissionSummaryProps {
  permissions: Record<string, any> | string[]
  roleName: string
  restrictions?: Record<string, any>
  isSystemRole?: boolean
  userCount?: number
  className?: string
}

interface PermissionDetail {
  name: string
  code: string
  category: 'admin' | 'write' | 'read'
  risk: 'high' | 'medium' | 'low'
  description: string
  icon: React.ReactNode
  color: string
}

/**
 * Enterprise-Grade Permission Summary Component
 * Displays granular permissions with advanced filtering, search, and high-end aesthetics.
 */
export function EnhancedPermissionSummary({
  permissions,
  roleName,
  isSystemRole = false,
  className = '',
}: PermissionSummaryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<
    'all' | 'admin' | 'write' | 'read'
  >('all')

  // Helper functions for display names and icons
  const getApplicationDisplayName = (appCode: string) => {
    const names: Record<string, string> = {
      crm: 'CRM',
      hr: 'HRMS',
      affiliate: 'Affiliate',
      system: 'System',
      finance: 'Finance',
      inventory: 'Inventory',
      analytics: 'Analytics',
    }
    return names[appCode] || appCode.toUpperCase()
  }

  const getModuleDisplayName = (moduleCode: string) => {
    const names: Record<string, string> = {
      leads: 'Leads',
      accounts: 'Accounts',
      contacts: 'Contacts',
      opportunities: 'Opps',
      quotations: 'Quotes',
      dashboard: 'Dash',
      employees: 'Staff',
      payroll: 'Payroll',
      leave: 'Leave',
      partners: 'Partners',
      commissions: 'Comms',
      deals: 'Deals',
      companies: 'Orgs',
      attendance: 'Time',
      recruitment: 'Hire',
      users: 'Users',
      settings: 'Config',
      roles: 'Roles',
      permissions: 'Perms',
      reports: 'BI',
    }
    return (
      names[moduleCode] ||
      moduleCode.charAt(0).toUpperCase() + moduleCode.slice(1)
    )
  }

  const getApplicationIcon = (appCode: string) => {
    const icons: Record<string, React.ReactNode> = {
      crm: <Users className="h-3.5 w-3.5" />,
      hr: <Users className="h-3.5 w-3.5" />,
      affiliate: <Activity className="h-3.5 w-3.5" />,
      system: <Settings className="h-3.5 w-3.5" />,
      finance: <Database className="h-3.5 w-3.5" />,
      inventory: <Package className="h-3.5 w-3.5" />,
      analytics: <Grid className="h-3.5 w-3.5" />,
    }
    return icons[appCode] || <Layers className="h-3.5 w-3.5" />
  }

  const getPermissionDescription = (permission: string) => {
    const descriptions: Record<string, string> = {
      read: 'View records',
      read_all: 'View all org data',
      create: 'Add entries',
      update: 'Edit data',
      delete: 'Remove records',
      export: 'Download data',
      import: 'Bulk upload',
      assign: 'Task assignment',
      approve: 'Approval power',
      manage: 'Full control',
      admin: 'System management',
    }
    return (
      descriptions[permission.toLowerCase()] ||
      `${permission.replace('_', ' ')} access`
    )
  }

  const analyzePermissionType = useCallback(
    (action: string, appKey: string, moduleKey: string): PermissionDetail => {
      const perm = action.toLowerCase()
      const code = `${appKey}.${moduleKey}.${action}`

      if (
        perm.includes('delete') ||
        perm.includes('admin') ||
        perm.includes('manage') ||
        perm.includes('approve') ||
        perm.includes('assign') ||
        perm.includes('calculate') ||
        perm.includes('pay') ||
        perm.includes('reject') ||
        perm.includes('cancel')
      ) {
        return {
          name: action,
          code,
          category: 'admin',
          risk: 'high',
          description: getPermissionDescription(action),
          icon: <Shield className="h-3 w-3 text-rose-500" />,
          color: 'text-rose-600 bg-rose-50 border-rose-100',
        }
      }

      if (
        perm.includes('create') ||
        perm.includes('update') ||
        perm.includes('edit') ||
        perm.includes('import') ||
        perm.includes('upload') ||
        perm.includes('modify')
      ) {
        return {
          name: action,
          code,
          category: 'write',
          risk: 'medium',
          description: getPermissionDescription(action),
          icon: <Edit className="h-3 w-3 text-amber-500" />,
          color: 'text-amber-600 bg-amber-50 border-amber-100',
        }
      }

      return {
        name: action,
        code,
        category: 'read',
        risk: 'low',
        description: getPermissionDescription(action),
        icon: <Eye className="h-3 w-3 text-emerald-500" />,
        color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      }
    },
    []
  )

  // Main permission analysis logic
  const analysis = useMemo(() => {
    let totalPermissions = 0
    let adminCount = 0
    let writeCount = 0
    let readCount = 0

    // Group records by App + Module
    const groupMap: Record<
      string,
      {
        app: string
        appIcon: React.ReactNode
        module: string
        permissions: PermissionDetail[]
      }
    > = {}

    const processPermission = (
      appKey: string,
      moduleKey: string,
      action: string
    ) => {
      const appName = getApplicationDisplayName(appKey)
      const moduleName = getModuleDisplayName(moduleKey)
      const groupKey = `${appKey}-${moduleKey}`

      const detail = analyzePermissionType(action, appKey, moduleKey)

      // Filter based on search and type
      const searchTerms = searchQuery.toLowerCase()
      const matchesSearch =
        appName.toLowerCase().includes(searchTerms) ||
        moduleName.toLowerCase().includes(searchTerms) ||
        action.toLowerCase().includes(searchTerms) ||
        detail.code.toLowerCase().includes(searchTerms)

      const matchesFilter =
        filterType === 'all' || detail.category === filterType

      if (matchesSearch && matchesFilter) {
        if (!groupMap[groupKey]) {
          groupMap[groupKey] = {
            app: appName,
            appIcon: getApplicationIcon(appKey),
            module: moduleName,
            permissions: [],
          }
        }

        groupMap[groupKey].permissions.push(detail)

        if (detail.category === 'admin') adminCount++
        else if (detail.category === 'write') writeCount++
        else readCount++

        totalPermissions++
      }
    }

    if (
      permissions &&
      typeof permissions === 'object' &&
      !Array.isArray(permissions)
    ) {
      Object.entries(permissions).forEach(([appKey, appPerms]) => {
        if (appKey === 'metadata') return
        if (typeof appPerms === 'object' && appPerms !== null) {
          Object.entries(appPerms).forEach(([moduleKey, modulePerms]) => {
            if (Array.isArray(modulePerms)) {
              ;(modulePerms as string[]).forEach((perm) =>
                processPermission(appKey, moduleKey, perm)
              )
            } else if (
              typeof modulePerms === 'object' &&
              modulePerms !== null
            ) {
              Object.entries(modulePerms).forEach(([action, allowed]) => {
                if (allowed === true || allowed === 'true') {
                  processPermission(appKey, moduleKey, action)
                }
              })
            }
          })
        }
      })
    } else if (Array.isArray(permissions)) {
      permissions.forEach((perm) => {
        const parts = perm.split('.')
        if (parts.length >= 3) {
          processPermission(parts[0], parts[1], parts[2])
        }
      })
    }

    return {
      totalPermissions,
      adminCount,
      writeCount,
      readCount,
      grouped: Object.values(groupMap),
    }
  }, [permissions, searchQuery, filterType, analyzePermissionType])

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Header & Controls - Compact */}
      <Card className="overflow-hidden border-slate-200 bg-white shadow-xl">
        <CardHeader className="border-b border-slate-100 px-4 py-3">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-2.5">
              <div className="bg-primary/5 border-primary/20 rounded-lg border p-1.5 shadow-sm">
                <Shield className="text-primary h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-primary text-lg font-bold tracking-tight">
                  Permission Matrix
                </CardTitle>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  Role: <span className="text-primary">{roleName}</span>
                  {isSystemRole && (
                    <Lock className="ml-1 h-2.5 w-2.5 text-slate-400" />
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {[
                {
                  label: 'Admin',
                  count: analysis.adminCount,
                  color: 'text-rose-600',
                  bg: 'bg-rose-50',
                },
                {
                  label: 'Write',
                  count: analysis.writeCount,
                  color: 'text-amber-600',
                  bg: 'bg-amber-50',
                },
                {
                  label: 'Read',
                  count: analysis.readCount,
                  color: 'text-emerald-600',
                  bg: 'bg-emerald-50',
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-md border border-slate-100 px-2 py-1 text-[10px] font-bold',
                    stat.bg,
                    stat.color
                  )}
                >
                  {stat.count} {stat.label}
                </div>
              ))}
              <div className="border-primary/20 rounded-md border bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-700">
                Total: {analysis.totalPermissions}
              </div>
            </div>
          </div>

          {/* Compact Toolbar */}
          <div className="mt-3 flex items-center gap-2">
            <div className="group relative flex-1">
              <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Table search..."
                className="h-8 rounded-lg border-slate-200 bg-slate-50 pl-8 text-[12px] focus:ring-1 focus:ring-blue-500/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-0.5 transition-colors hover:bg-slate-200"
                >
                  <X className="h-3 w-3 text-slate-400" />
                </button>
              )}
            </div>

            <div className="border-primary/20 flex h-8 rounded-lg border bg-slate-50 p-0.5">
              {(['all', 'admin', 'write', 'read'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[10px] font-bold capitalize transition-all',
                    filterType === type
                      ? 'text-primary border-primary/20 border bg-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent max-h-[850px] overflow-y-auto p-0">
          {analysis.grouped.length > 0 ? (
            <table className="w-full table-fixed border-collapse text-center">
              <thead className="sticky top-0 z-20">
                <tr className="border-b border-slate-200 bg-slate-50 shadow-sm">
                  <th className="w-[180px] border-r border-slate-200/50 px-6 py-4 text-center text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">
                    Application
                  </th>
                  <th className="w-[160px] border-r border-slate-200/50 px-6 py-4 text-center text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">
                    Module
                  </th>
                  <th className="px-6 py-4 text-center text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">
                    Granted Permissions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analysis.grouped.map((group: any, idx: number) => (
                  <tr key={idx} className="group hover:bg-primary/5">
                    <td className="w-[180px] border-r border-slate-100/50 bg-slate-50/20 p-0 align-middle group-hover:bg-slate-50/50">
                      <div className="flex flex-col items-center justify-center gap-3 p-4">
                        <div className="border-primary/20 group-hover:text-primary group-hover:border-primary/20 flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-slate-400 shadow-sm">
                          {group.appIcon}
                        </div>
                        <span className="text-center text-[13px] leading-tight font-bold tracking-tight text-slate-800">
                          {group.app}
                        </span>
                      </div>
                    </td>
                    <td className="w-[160px] border-r border-slate-100/50 bg-slate-50/10 p-0 align-middle group-hover:bg-slate-50/30">
                      <div className="flex flex-col items-center justify-center p-4">
                        <span className="group-hover:text-primary inline-block text-center text-[12px] font-bold tracking-tight text-slate-600">
                          {group.module}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="flex max-w-full flex-wrap justify-center gap-2">
                        {group.permissions.map((perm: any, pIdx: number) => (
                          <div
                            key={pIdx}
                            className={cn(
                              'group/perm flex max-w-[160px] min-w-[110px] items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-sm',
                              perm.color,
                              'bg-white'
                            )}
                            title={`${perm.code}: ${perm.description}`}
                          >
                            <div className="shrink-0 scale-90">{perm.icon}</div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[10px] leading-tight font-bold text-slate-800">
                                {perm.name}
                              </div>
                              <div className="truncate font-mono text-[8px] text-slate-400 opacity-70">
                                {perm.code.split('.').pop()}
                              </div>
                            </div>
                            <div
                              className={cn(
                                'h-1.5 w-1.5 shrink-0 rounded-full shadow-sm',
                                perm.risk === 'high'
                                  ? 'bg-rose-500'
                                  : perm.risk === 'medium'
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                              )}
                            />
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
              <div className="mb-4 inline-flex rounded-3xl border border-slate-100 bg-slate-50 p-5 shadow-inner">
                <Search className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-[13px] font-bold tracking-widest text-slate-500 uppercase">
                No matching records found
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Try adjusting your filters or search query
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
