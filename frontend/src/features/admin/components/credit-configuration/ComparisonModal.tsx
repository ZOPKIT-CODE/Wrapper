import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  AlertTriangle
} from 'lucide-react';
import { CostChanges, Application, OperationCost } from './types';
import { cn } from '@/lib/utils';

interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  costChanges: CostChanges;
  applications: Application[];
  globalOperationCosts: OperationCost[];
  mode: 'global' | 'tenant';
  tenantCount?: number;
  tenantName?: string;
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
  tenantName
}) => {
  const calculateSummary = () => {
    let operationsChanged = 0;
    let modulesChanged = 0;
    let appCostsChanged = 0;

    Object.values(costChanges).forEach(appChanges => {
      if (appChanges.operationCosts) operationsChanged += Object.keys(appChanges.operationCosts).length;
      if (appChanges.moduleCosts) modulesChanged += Object.keys(appChanges.moduleCosts).length;
      if (appChanges.appCost !== undefined) appCostsChanged += 1;
    });

    return { appsModified: Object.keys(costChanges).length, operationsChanged, modulesChanged, appCostsChanged };
  };

  const summary = calculateSummary();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden border-none bg-white shadow-2xl">
        <DialogHeader className="p-6 bg-slate-50/80 border-b backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                Change Audit & Review
                <Badge className="bg-primary/10 text-primary border-none text-[10px] uppercase font-black">
                  {mode === 'global' ? 'System Standard' : 'Tenant Override'}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">
                Verify proposed credit architecture modifications for {mode === 'global' ? 'all tenants' : tenantName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Apps Targeted', val: summary.appsModified, icon: Database, color: 'text-blue-500', bg: 'bg-blue-50' },
              { label: 'Module Updates', val: summary.modulesChanged, icon: Layers, color: 'text-purple-500', bg: 'bg-purple-50' },
              { label: 'Point Mutations', val: summary.operationsChanged, icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50' },
              { label: 'System Impacts', val: mode === 'global' ? tenantCount : 1, icon: Building2, color: 'text-orange-500', bg: 'bg-orange-50' },
            ].map((stat, i) => (
              <div key={i} className={cn("p-4 rounded-lg border flex flex-col items-center text-center transition-colors", stat.bg, "border-border")}>
                <stat.icon className={cn("h-5 w-5 mb-2", stat.color)} />
                <div className="text-2xl font-black text-primary">{stat.val}</div>
                <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider leading-none mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Detailed Ledger */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-[12px] font-black uppercase tracking-widest text-primary">Detailed Change Ledger</h4>
              <Badge variant="outline" className="text-[9px] font-bold uppercase">Chronological Order</Badge>
            </div>

            <div className="space-y-4">
              {Object.entries(costChanges).map(([appCode, changes]) => {
                const app = applications.find(a => a.appCode === appCode);
                return (
                  <div key={appCode} className="rounded-3xl border border-slate-100 bg-slate-50/50 p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white border shadow-sm flex items-center justify-center font-black text-[10px] text-primary">{appCode}</div>
                        <div>
                          <h5 className="text-[13px] font-black text-primary uppercase leading-none">{app?.appName || appCode}</h5>
                          <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-tighter">Application Domain Infrastructure</p>
                        </div>
                      </div>
                      <Badge className="bg-primary hover:bg-primary text-white text-[9px] font-black">ACTIVE CHANGES</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* App Batch Override */}
                      {changes.appCost !== undefined && (
                        <div className="col-span-full border-b pb-3 border-dashed">
                          <div className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-primary" /> Application Batch Sync
                          </div>
                          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border shadow-sm">
                            <span className="text-[11px] font-black text-slate-600 uppercase">System Default Rate</span>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-[8px] font-bold text-slate-400 uppercase">FROM</p>
                                <p className="text-sm font-black text-slate-400 line-through tracking-tighter">VARIES</p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-slate-300" />
                              <div className="text-right">
                                <p className="text-[8px] font-bold text-primary uppercase">TO</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-lg font-black text-primary tracking-tighter">{changes.appCost} <span className="text-[10px]">CR</span></p>
                                  <Badge className="bg-primary/20 text-primary border-none text-[8px] font-black h-5">BATCH SYNC</Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Module Overrides */}
                      {changes.moduleCosts && Object.entries(changes.moduleCosts).map(([moduleCode, newCost]) => {
                        const module = app?.modules?.find(m => m.moduleCode === moduleCode);
                        return (
                          <div key={moduleCode} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between group h-fit">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h6 className="text-[11px] font-black text-blue-600 uppercase tracking-tight">{module?.moduleName || moduleCode}</h6>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{moduleCode}</p>
                              </div>
                              <Layers className="w-4 h-4 text-blue-200" />
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t">
                              <span className="text-[9px] font-black text-slate-500 uppercase">Module Flow</span>
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] font-black text-slate-300 line-through m-0">VAR</span>
                                <ChevronRight className="w-3 h-3 text-slate-200" />
                                <div className="flex flex-col items-end">
                                  <span className="text-[13px] font-black text-blue-600">{newCost}<span className="text-[9px] ml-0.5">CR</span></span>
                                  <Badge className="text-[7px] h-3 px-1 bg-blue-500/10 text-blue-600 border-none font-black">MODULE OVERRIDE</Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Individual Operations */}
                      {changes.operationCosts && Object.entries(changes.operationCosts).map(([operationCode, newCost]) => {
                        const currentOp = globalOperationCosts.find(op => op.operationCode === operationCode);
                        const currentCost = currentOp?.creditCost;
                        return (
                          <div key={operationCode} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between group h-fit">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h6 className="text-[11px] font-black text-primary uppercase tracking-tight">{currentOp?.operationName || operationCode.split('.').pop()}</h6>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate w-24">{operationCode}</p>
                              </div>
                              <Activity className="w-4 h-4 text-emerald-200" />
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t">
                              <span className="text-[9px] font-black text-slate-500 uppercase">Micro Point</span>
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] font-black text-slate-300 line-through m-0">{currentCost || '0'}</span>
                                <ChevronRight className="w-3 h-3 text-slate-200" />
                                <div className="flex flex-col items-end">
                                  <span className="text-[13px] font-black text-emerald-600">{newCost}<span className="text-[9px] ml-0.5">CR</span></span>
                                  {currentCost !== undefined && (
                                    <Badge className={cn(
                                      "text-[7px] h-3 px-1 border-none font-black",
                                      (newCost - currentCost) > 0 ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600"
                                    )}>
                                      {(newCost - currentCost) > 0 ? '+' : ''}{(newCost - currentCost).toFixed(1)} Δ
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Impact Assessment Card */}
          <div className="bg-slate-900 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <TrendingUp className="w-24 h-24 text-white" />
            </div>
            <div className="flex items-start gap-4 relative z-10">
              <div className="p-3 bg-white/10 rounded-2xl">
                <Info className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-3">
                <h4 className="text-xl font-black text-white uppercase tracking-tight">Technical Impact Assessment</h4>
                <div className="grid grid-cols-2 gap-8 mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Affects <span className="text-white">{mode === 'global' ? tenantCount : 1}</span> active environment(s)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Configuration persistence: <span className="text-white italic">Immediate</span></p>
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-2 text-rose-400 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Crucial Protocol</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-relaxed font-medium">New rates will bind to all future operation requests. Legacy sessions and current pipeline calculations remain unaffected until next cycle initialization.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50/50 border-t flex items-center justify-between backdrop-blur-md">
          <Button variant="ghost" onClick={onClose} className="text-xs font-black uppercase tracking-widest hover:bg-slate-100">
            Cancel Review
          </Button>
          <div className="flex items-center gap-4">
            <div className="text-right mr-4 border-r pr-6 hidden md:block border-slate-200">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Modifications</p>
              <p className="text-xl font-black text-primary">{summary.operationsChanged + summary.modulesChanged + summary.appCostsChanged} Points</p>
            </div>
            <Button
              onClick={() => { onClose(); onProceed(); }}
              className="bg-primary hover:bg-primary/90 text-white font-black px-8 py-6 rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all text-sm uppercase tracking-widest"
            >
              Execute Commitment Protocol <Sparkles className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
