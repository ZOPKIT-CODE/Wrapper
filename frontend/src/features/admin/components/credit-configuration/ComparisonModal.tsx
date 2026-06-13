import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ShieldCheck,
  ArrowRight,
  Database,
  Activity,
  Building2,
  Layers,
  ChevronRight,
  Sparkles,
  Info,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import { CostChanges, Application, OperationCost } from './types'
import { cn } from '@/lib/utils'

interface ComparisonModalProps {
  isOpen: boolean
  onClose: () => void
  onProceed: () => void
  costChanges: CostChanges
  applications: Application[]
  globalOperationCosts: OperationCost[]
  mode: 'global' | 'tenant'
  tenantCount?: number
  tenantName?: string
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({
  isOpen,
  onClose,
  onProceed,
  costChanges,
  applications,
  globalOperationCosts,
  mode,
  tenantCount = 1,
  tenantName,
}) => {
  const calculateSummary = () => {
    let operationsChanged = 0
    let modulesChanged = 0
    let appCostsChanged = 0

    Object.values(costChanges).forEach((appChanges) => {
      if (appChanges.operationCosts)
        operationsChanged += Object.keys(appChanges.operationCosts).length
      if (appChanges.moduleCosts)
        modulesChanged += Object.keys(appChanges.moduleCosts).length
      if (appChanges.appCost !== undefined) appCostsChanged += 1
    })

    return {
      appsModified: Object.keys(costChanges).length,
      operationsChanged,
      modulesChanged,
      appCostsChanged,
    }
  }

  const summary = calculateSummary()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex h-[90vh] flex-col overflow-hidden border-none bg-white p-0 shadow-2xl sm:max-w-5xl">
        <DialogHeader className="border-b bg-slate-50/80 p-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 flex items-center justify-center rounded-2xl p-3">
              <ShieldCheck className="text-primary h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-3 text-2xl font-black tracking-tight">
                Change Audit & Review
                <Badge className="bg-primary/10 text-primary border-none text-[10px] font-black uppercase">
                  {mode === 'global' ? 'System Standard' : 'Tenant Override'}
                </Badge>
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                Verify proposed credit architecture modifications for{' '}
                {mode === 'global' ? 'all tenants' : tenantName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="custom-scrollbar flex-1 space-y-8 overflow-y-auto p-6">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              {
                label: 'Apps Targeted',
                val: summary.appsModified,
                icon: Database,
                color: 'text-blue-500',
                bg: 'bg-blue-50',
              },
              {
                label: 'Module Updates',
                val: summary.modulesChanged,
                icon: Layers,
                color: 'text-purple-500',
                bg: 'bg-purple-50',
              },
              {
                label: 'Point Mutations',
                val: summary.operationsChanged,
                icon: Activity,
                color: 'text-emerald-500',
                bg: 'bg-emerald-50',
              },
              {
                label: 'System Impacts',
                val: mode === 'global' ? tenantCount : 1,
                icon: Building2,
                color: 'text-orange-500',
                bg: 'bg-orange-50',
              },
            ].map((stat, i) => (
              <div
                key={i}
                className={cn(
                  'flex flex-col items-center rounded-lg border p-4 text-center transition-colors',
                  stat.bg,
                  'border-border'
                )}
              >
                <stat.icon className={cn('mb-2 h-5 w-5', stat.color)} />
                <div className="text-primary text-2xl font-black">
                  {stat.val}
                </div>
                <div className="mt-1 text-[9px] leading-none font-black tracking-wider text-slate-500 uppercase">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Ledger */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-primary text-[12px] font-black tracking-widest uppercase">
                Detailed Change Ledger
              </h4>
              <Badge
                variant="outline"
                className="text-[9px] font-bold uppercase"
              >
                Chronological Order
              </Badge>
            </div>

            <div className="space-y-4">
              {Object.entries(costChanges).map(([appCode, changes]) => {
                const app = applications.find((a) => a.appCode === appCode)
                return (
                  <div
                    key={appCode}
                    className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50/50 p-6"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-primary flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-[10px] font-black shadow-sm">
                          {appCode}
                        </div>
                        <div>
                          <h5 className="text-primary text-[13px] leading-none font-black uppercase">
                            {app?.appName || appCode}
                          </h5>
                          <p className="mt-1 text-[9px] font-bold tracking-tighter text-slate-500 uppercase">
                            Application Domain Infrastructure
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-primary hover:bg-primary text-[9px] font-black text-white">
                        ACTIVE CHANGES
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {/* App Batch Override */}
                      {changes.appCost !== undefined && (
                        <div className="col-span-full border-b border-dashed pb-3">
                          <div className="mb-2 flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase">
                            <Sparkles className="text-primary h-3 w-3" />{' '}
                            Application Batch Sync
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border bg-white p-4 shadow-sm">
                            <span className="text-[11px] font-black text-slate-600 uppercase">
                              System Default Rate
                            </span>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-[8px] font-bold text-slate-400 uppercase">
                                  FROM
                                </p>
                                <p className="text-sm font-black tracking-tighter text-slate-400 line-through">
                                  VARIES
                                </p>
                              </div>
                              <ArrowRight className="h-4 w-4 text-slate-300" />
                              <div className="text-right">
                                <p className="text-primary text-[8px] font-bold uppercase">
                                  TO
                                </p>
                                <div className="flex items-center gap-2">
                                  <p className="text-primary text-lg font-black tracking-tighter">
                                    {changes.appCost}{' '}
                                    <span className="text-[10px]">CR</span>
                                  </p>
                                  <Badge className="bg-primary/20 text-primary h-5 border-none text-[8px] font-black">
                                    BATCH SYNC
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Module Overrides */}
                      {changes.moduleCosts &&
                        Object.entries(changes.moduleCosts).map(
                          ([moduleCode, newCost]) => {
                            const module = app?.modules?.find(
                              (m) => m.moduleCode === moduleCode
                            )
                            return (
                              <div
                                key={moduleCode}
                                className="group flex h-fit flex-col justify-between rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"
                              >
                                <div className="mb-3 flex items-start justify-between">
                                  <div>
                                    <h6 className="text-[11px] font-black tracking-tight text-blue-600 uppercase">
                                      {module?.moduleName || moduleCode}
                                    </h6>
                                    <p className="text-[8px] font-bold tracking-widest text-slate-400 uppercase">
                                      {moduleCode}
                                    </p>
                                  </div>
                                  <Layers className="h-4 w-4 text-blue-200" />
                                </div>
                                <div className="flex items-center justify-between border-t pt-3">
                                  <span className="text-[9px] font-black text-slate-500 uppercase">
                                    Module Flow
                                  </span>
                                  <div className="flex items-center gap-3">
                                    <span className="m-0 text-[11px] font-black text-slate-300 line-through">
                                      VAR
                                    </span>
                                    <ChevronRight className="h-3 w-3 text-slate-200" />
                                    <div className="flex flex-col items-end">
                                      <span className="text-[13px] font-black text-blue-600">
                                        {newCost}
                                        <span className="ml-0.5 text-[9px]">
                                          CR
                                        </span>
                                      </span>
                                      <Badge className="h-3 border-none bg-blue-500/10 px-1 text-[7px] font-black text-blue-600">
                                        MODULE OVERRIDE
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          }
                        )}

                      {/* Individual Operations */}
                      {changes.operationCosts &&
                        Object.entries(changes.operationCosts).map(
                          ([operationCode, newCost]) => {
                            const currentOp = globalOperationCosts.find(
                              (op) => op.operationCode === operationCode
                            )
                            const currentCost = currentOp?.creditCost
                            return (
                              <div
                                key={operationCode}
                                className="group flex h-fit flex-col justify-between rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"
                              >
                                <div className="mb-3 flex items-start justify-between">
                                  <div>
                                    <h6 className="text-primary text-[11px] font-black tracking-tight uppercase">
                                      {currentOp?.operationName ||
                                        operationCode.split('.').pop()}
                                    </h6>
                                    <p className="w-24 truncate text-[8px] font-bold tracking-widest text-slate-400 uppercase">
                                      {operationCode}
                                    </p>
                                  </div>
                                  <Activity className="h-4 w-4 text-emerald-200" />
                                </div>
                                <div className="flex items-center justify-between border-t pt-3">
                                  <span className="text-[9px] font-black text-slate-500 uppercase">
                                    Micro Point
                                  </span>
                                  <div className="flex items-center gap-3">
                                    <span className="m-0 text-[11px] font-black text-slate-300 line-through">
                                      {currentCost || '0'}
                                    </span>
                                    <ChevronRight className="h-3 w-3 text-slate-200" />
                                    <div className="flex flex-col items-end">
                                      <span className="text-[13px] font-black text-emerald-600">
                                        {newCost}
                                        <span className="ml-0.5 text-[9px]">
                                          CR
                                        </span>
                                      </span>
                                      {currentCost !== undefined && (
                                        <Badge
                                          className={cn(
                                            'h-3 border-none px-1 text-[7px] font-black',
                                            newCost - currentCost > 0
                                              ? 'bg-rose-500/10 text-rose-600'
                                              : 'bg-emerald-500/10 text-emerald-600'
                                          )}
                                        >
                                          {newCost - currentCost > 0 ? '+' : ''}
                                          {(newCost - currentCost).toFixed(1)} Δ
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          }
                        )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Impact Assessment Card */}
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 shadow-2xl">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <TrendingUp className="h-24 w-24 text-white" />
            </div>
            <div className="relative z-10 flex items-start gap-4">
              <div className="rounded-2xl bg-white/10 p-3">
                <Info className="text-primary h-6 w-6" />
              </div>
              <div className="space-y-3">
                <h4 className="text-xl font-black tracking-tight text-white uppercase">
                  Technical Impact Assessment
                </h4>
                <div className="mt-4 grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary h-1.5 w-1.5 rounded-full" />
                      <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                        Affects{' '}
                        <span className="text-white">
                          {mode === 'global' ? tenantCount : 1}
                        </span>{' '}
                        active environment(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-primary h-1.5 w-1.5 rounded-full" />
                      <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                        Configuration persistence:{' '}
                        <span className="text-white italic">Immediate</span>
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-2 flex items-center gap-2 text-rose-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-[10px] font-black tracking-widest uppercase">
                        Crucial Protocol
                      </span>
                    </div>
                    <p className="text-[10px] leading-relaxed font-medium text-slate-300">
                      New rates will bind to all future operation requests.
                      Legacy sessions and current pipeline calculations remain
                      unaffected until next cycle initialization.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between border-t bg-slate-50/50 p-6 backdrop-blur-md">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-xs font-black tracking-widest uppercase hover:bg-slate-100"
          >
            Cancel Review
          </Button>
          <div className="flex items-center gap-4">
            <div className="mr-4 hidden border-r border-slate-200 pr-6 text-right md:block">
              <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase">
                Total Modifications
              </p>
              <p className="text-primary text-xl font-black">
                {summary.operationsChanged +
                  summary.modulesChanged +
                  summary.appCostsChanged}{' '}
                Points
              </p>
            </div>
            <Button
              onClick={() => {
                onClose()
                onProceed()
              }}
              className="bg-primary hover:bg-primary/90 shadow-primary/20 rounded-2xl px-8 py-6 text-sm font-black tracking-widest text-white uppercase shadow-xl transition-all hover:scale-105 active:scale-95"
            >
              Execute Commitment Protocol <Sparkles className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
