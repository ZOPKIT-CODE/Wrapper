import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Briefcase, CheckCircle2, Box, Truck, FileCheck, DollarSign,
    UserPlus, Users, Monitor, GraduationCap, CreditCard, ShoppingCart,
    Activity, Zap, Server, Database, Globe, Clock,
    ChevronRight, BarChart3, Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { config } from '@/lib/config';

// Enhanced workflow definitions with business-friendly descriptions
const workflows = [
    {
        id: 'lead-to-cash',
        title: 'Lead to Cash',
        description: 'Automate your revenue cycle from prospect to payment.',
        color: 'blue',
        accent: 'from-blue-600 to-cyan-500',
        border: 'border-blue-200',
        text: 'text-blue-600',
        bg: 'bg-blue-600',
        lightBg: 'bg-blue-50',
        steps: [
            { id: 'lead', title: 'Lead Captured', app: 'B2B CRM', icon: Briefcase, action: 'Syncing prospect data', status: 'Success' },
            { id: 'opp', title: 'Deal Closed', app: 'B2B CRM', icon: CheckCircle2, action: 'Updating pipeline status', status: 'Approved' },
            { id: 'order', title: 'Order Created', app: 'Operations', icon: Box, action: 'Generating order #', status: 'Created' },
            { id: 'fulfill', title: 'Inv. Reserved', app: 'Operations', icon: Truck, action: 'Allocating stock', status: 'Reserved' },
            { id: 'invoice', title: 'Invoice Sent', app: 'Finance', icon: FileCheck, action: 'Emailing invoice PDF', status: 'Sent' },
            { id: 'payment', title: 'Payment Rec.', app: 'Finance', icon: DollarSign, action: 'Processing transaction', status: 'Verified' },
        ]
    },
    {
        id: 'hire-to-retire',
        title: 'Hire to Retire',
        description: 'Streamline the entire employee lifecycle.',
        color: 'purple',
        accent: 'from-purple-600 to-pink-500',
        border: 'border-purple-200',
        text: 'text-purple-600',
        bg: 'bg-purple-600',
        lightBg: 'bg-purple-50',
        steps: [
            { id: 'offer', title: 'Offer Signed', app: 'HRMS', icon: UserPlus, action: 'Verifying digital signature', status: 'Signed' },
            { id: 'onboard', title: 'Profile Created', app: 'HRMS', icon: Users, action: 'Creating employee record', status: 'Created' },
            { id: 'asset', title: 'Laptop Prov.', app: 'ITSM', icon: Monitor, action: 'Assigning hardware assets', status: 'Assigned' },
            { id: 'access', title: 'SSO Access', app: 'ITSM', icon: Server, action: 'Provisioning accounts', status: 'Active' },
            { id: 'training', title: 'LMS Enrollment', app: 'Academy', icon: GraduationCap, action: 'Assigning courses', status: 'Enrolled' },
            { id: 'payroll', title: 'Payroll Setup', app: 'Finance', icon: CreditCard, action: 'Configuring tax & salary', status: 'Ready' },
        ]
    },
    {
        id: 'procure-to-pay',
        title: 'Procure to Pay',
        description: 'Optimize supply chain and vendor payments.',
        color: 'orange',
        accent: 'from-orange-500 to-amber-500',
        border: 'border-orange-200',
        text: 'text-orange-600',
        bg: 'bg-orange-500',
        lightBg: 'bg-orange-50',
        steps: [
            { id: 'req', title: 'Requisition', app: 'Operations', icon: FileCheck, action: 'Submitting purchase req', status: 'Pending' },
            { id: 'po', title: 'PO Issued', app: 'Operations', icon: ShoppingCart, action: 'Generating PO document', status: 'Issued' },
            { id: 'receive', title: 'Goods Receipt', app: 'Operations', icon: Truck, action: 'Verifying shipment', status: 'Received' },
            { id: 'bill', title: 'Bill Created', app: 'Finance', icon: FileCheck, action: 'Logging vendor invoice', status: ' logged' },
            { id: 'match', title: '3-Way Match', app: 'Finance', icon: Database, action: 'Validating PO vs Inv', status: 'Matched' },
            { id: 'pay', title: 'Vendor Paid', app: 'Finance', icon: DollarSign, action: 'Initiating transfer', status: 'Paid' },
        ]
    }
];

export const WorkflowVisualizer = () => {
    const [activeWorkflowIndex, setActiveWorkflowIndex] = useState(0);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);
    const [executionId, setExecutionId] = useState('SYS-001');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        let resizeTimer: ReturnType<typeof setTimeout>;
        const checkMobile = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => setIsMobile(window.innerWidth < 640), 150);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => {
            window.removeEventListener('resize', checkMobile);
            clearTimeout(resizeTimer);
        };
    }, []);

    const activeWorkflow = workflows[activeWorkflowIndex];

    // Auto-scroll logs logic
    useEffect(() => {
        if (scrollContainerRef.current) {
            const { scrollHeight, clientHeight } = scrollContainerRef.current;
            scrollContainerRef.current.scrollTop = scrollHeight - clientHeight;
        }
    }, [logs]);

    // Generate a random ID
    const generateId = () => Math.floor(1000 + Math.random() * 9000);

    const logsRef = useRef(logs);
    logsRef.current = logs;

    // Workflow Cycle Logic
    useEffect(() => {
        let stepTimer: ReturnType<typeof setTimeout>;
        let nextFlowTimer: ReturnType<typeof setTimeout>;

        // New execution ID when starting a flow
        if (activeStepIndex === 0 && logsRef.current.length === 0) {
            setExecutionId(`SYS-${generateId()}`);
        }

        const executeStep = () => {
            const step = activeWorkflow.steps[activeStepIndex];
            const now = new Date();
            const timestamp = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

            // Cap logs at 50 entries to prevent unbounded DOM growth
            setLogs(prev => {
                const newLogs = [
                    ...prev,
                    `[${timestamp}] STARTED: ${step.title} (${step.app})`,
                    `[${timestamp}] ACTION: ${step.action}...`,
                    `[${timestamp}] COMPLETED: Status '${step.status}' verified.`
                ];
                return newLogs.length > 50 ? newLogs.slice(-50) : newLogs;
            });

            if (activeStepIndex < activeWorkflow.steps.length - 1) {
                stepTimer = setTimeout(() => {
                    setActiveStepIndex(prev => prev + 1);
                }, 2000); // 2 second intervals
            } else {
                // Workflow complete
                setLogs(prev => [...prev, `[${timestamp}] WORKFLOW COMPLETED SUCCESSFULLY.`]);

                nextFlowTimer = setTimeout(() => {
                    setLogs([]);
                    setActiveStepIndex(0);
                    setActiveWorkflowIndex(prev => (prev + 1) % workflows.length);
                }, 4000); // Pause before next workflow
            }
        };

        const initialDelay = setTimeout(executeStep, 500);

        return () => {
            clearTimeout(stepTimer);
            clearTimeout(nextFlowTimer);
            clearTimeout(initialDelay);
        };
    }, [activeStepIndex, activeWorkflowIndex]);

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 sm:mb-16">
                <p className="text-sm font-semibold text-slate-400 tracking-wide mb-3">Workflow Engine</p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-[-0.025em] leading-tight">
                    Intelligent Workflow<br className="hidden sm:block" /> Orchestration
                </h2>
                <p className="text-slate-500 text-base sm:text-lg max-w-xl mx-auto mt-4 leading-relaxed">
                    Automate complex business processes across your entire Zopkit ecosystem. Connect apps, data, and teams seamlessly.
                </p>
            </div>

            <div className="bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-slate-200 shadow-lg sm:shadow-2xl flex flex-col lg:flex-row h-auto lg:h-[700px]">

                {/* Sidebar / Control Panel */}
                <div className="w-full lg:w-72 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col shrink-0">
                    <div className="p-4 sm:p-6 border-b border-slate-200 bg-white">
                        <div className="flex items-center gap-3 text-slate-900 mb-1">
                            <img src={config.LOGO_URL} alt="Zopkit" className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl overflow-hidden shadow-lg" />
                            <h3 className="font-bold text-sm sm:text-base tracking-tight">Automation Hub</h3>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-200">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[11px] font-semibold text-emerald-700">System Active</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-medium ml-auto">v3.1</div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3 custom-scrollbar max-h-[200px] sm:max-h-[280px] lg:max-h-none">
                        {workflows.map((wf, idx) => {
                            const isActive = activeWorkflowIndex === idx;
                            return (
                                <button
                                    key={wf.id}
                                    onClick={() => {
                                        setActiveWorkflowIndex(idx);
                                        setActiveStepIndex(0);
                                        setLogs([]);
                                    }}
                                    className={cn(
                                        "w-full text-left p-4 rounded-xl transition-all duration-300 border relative overflow-hidden group",
                                        isActive
                                            ? "bg-white border-blue-200 shadow-lg shadow-blue-900/5"
                                            : "bg-transparent border-transparent hover:bg-slate-100 hover:border-slate-200"
                                    )}
                                >
                                    {isActive && (
                                        <div className={cn("absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b", wf.accent)} />
                                    )}
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className={cn("font-bold text-sm transition-colors", isActive ? "text-slate-900" : "text-slate-600")}>
                                            {wf.title}
                                        </span>
                                        {isActive && (
                                            <Activity className={cn("w-4 h-4 animate-pulse", wf.text)} />
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed font-medium">{wf.description}</p>
                                </button>
                            );
                        })}
                    </div>

                    <div className="hidden sm:block p-4 bg-slate-50 border-t border-slate-200">
                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                <Globe className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Server Region</div>
                                <div className="text-xs text-slate-700 font-semibold">US-East (N. Virginia)</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Visualizer Stage */}
                <div className="flex-1 bg-white relative flex flex-col overflow-hidden">
                    {/* Subtle Grid Background */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:40px_40px]"></div>

                    {/* Header */}
                    <div className="relative z-10 h-12 sm:h-16 border-b border-slate-100 bg-white/80 flex items-center justify-between px-3 sm:px-8 shrink-0">
                        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                            <h2 className="text-sm sm:text-xl font-bold text-slate-900 truncate">
                                {activeWorkflow.title}
                            </h2>
                            <div className="hidden sm:block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold border border-slate-200 shrink-0">
                                Workflow ID: {executionId}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-500 font-medium shrink-0">
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>{(activeStepIndex * 0.5).toFixed(1)}s</span>
                        </div>
                    </div>

                    {/* Visualization Area */}
                    <div className="flex-1 relative flex flex-col justify-center px-2 sm:px-4 md:px-12 overflow-hidden">

                        {/* Stepper Container */}
                        <div className="relative w-full">
                            {/* 1. Track Background */}
                            <div className="absolute top-6 sm:top-8 md:top-10 left-4 right-4 sm:left-8 sm:right-8 h-1.5 sm:h-2 bg-slate-100 rounded-full z-0 overflow-hidden">
                                {/* Dashed pattern overlay */}
                                <div className="w-full h-full opacity-30" style={{ backgroundImage: 'linear-gradient(90deg, transparent 50%, #cbd5e1 50%)', backgroundSize: '10px 100%' }}></div>
                            </div>

                            {/* 2. Active Progress Line */}
                            <div
                                className="absolute top-6 sm:top-8 md:top-10 left-4 sm:left-8 h-1.5 sm:h-2 rounded-full z-0 transition-all duration-1000 ease-in-out shadow-sm sm:shadow-lg shadow-blue-200"
                                style={{
                                    width: `calc(${(activeStepIndex / (activeWorkflow.steps.length - 1)) * 100}% - ${isMobile ? '2rem' : '4rem'})`,
                                    background: `linear-gradient(to right, ${activeWorkflowIndex === 0 ? '#2563eb' : activeWorkflowIndex === 1 ? '#9333ea' : '#ea580c'}, ${activeWorkflowIndex === 0 ? '#06b6d4' : activeWorkflowIndex === 1 ? '#db2777' : '#f59e0b'})`
                                }}
                            ></div>

                            {/* 3. Steps Grid */}
                            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-y-6 gap-x-2 md:gap-4 relative z-10 pb-4 md:pb-0">
                                {activeWorkflow.steps.map((step, idx) => {
                                    const isActive = idx === activeStepIndex;
                                    const isCompleted = idx < activeStepIndex;
                                    const Icon = step.icon;

                                    return (
                                        <div key={step.id} className="flex flex-col items-center group relative">

                                            {/* Node Circle */}
                                            <div className={cn(
                                                "w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center border-2 sm:border-[3px] transition-all duration-500 relative bg-white z-10",
                                                isActive
                                                    ? cn("border-white shadow-lg sm:shadow-xl scale-105 sm:scale-110 ring-2 sm:ring-4 ring-offset-1 sm:ring-offset-2 ring-opacity-50", activeWorkflow.text.replace('text-', 'ring-'))
                                                    : isCompleted
                                                        ? cn("border-white shadow-md text-white scale-100", activeWorkflow.bg)
                                                        : "border-slate-100 text-slate-300 shadow-sm"
                                            )}>
                                                {isActive && (
                                                    <div className={cn("absolute inset-0 rounded-full animate-ping opacity-20 hidden sm:block", activeWorkflow.bg)}></div>
                                                )}

                                                <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5 md:w-7 md:h-7 transition-all duration-300", isActive && "scale-110")} />

                                                {isCompleted && (
                                                    <div className="absolute -right-0.5 -bottom-0.5 sm:-right-1 sm:-bottom-1 bg-white text-emerald-500 rounded-full p-0.5 sm:p-1 shadow-md border border-slate-100">
                                                        <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Text Labels */}
                                            <div className="mt-2 sm:mt-5 text-center w-full px-0.5">
                                                <div className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 hidden sm:block">
                                                    Step 0{idx + 1}
                                                </div>
                                                <div className={cn(
                                                    "text-[10px] sm:text-xs md:text-sm font-bold transition-all duration-300 leading-tight",
                                                    isActive ? "text-slate-900" : isCompleted ? "text-slate-700" : "text-slate-400"
                                                )}>
                                                    {step.title}
                                                </div>
                                                <div className="text-[8px] sm:text-[10px] text-slate-500 mt-0.5 sm:mt-1 font-medium bg-slate-50 px-1.5 sm:px-2 py-0.5 rounded-full inline-block border border-slate-100">
                                                    {step.app}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Activity Panel */}
                    <div className="h-36 sm:h-44 md:h-52 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row shrink-0 relative z-20">

                        {/* Live Logs */}
                        <div className="flex-1 p-0 flex flex-col font-mono text-xs overflow-hidden">
                            <div className="bg-white px-6 py-3 border-b border-slate-100 flex justify-between items-center">
                                <span className="text-slate-700 font-bold flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-blue-500" /> Live System Activity
                                </span>
                                <div className="flex gap-2 text-[10px] text-slate-400">
                                    <span>Real-time</span>
                                    <span>Log Stream</span>
                                </div>
                            </div>

                            <div
                                ref={scrollContainerRef}
                                className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar bg-slate-50"
                            >
                                {logs.map((log, i) => (
                                    <div key={i} className="flex gap-4 items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <span className="text-slate-300 shrink-0 select-none font-medium">
                                            {(i + 1).toString().padStart(2, '0')}
                                        </span>
                                        <div className="break-all text-slate-600 font-medium">
                                            {/* Simple log styling */}
                                            {log.includes('STARTED') && (
                                                <span className="flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                    {log}
                                                </span>
                                            )}
                                            {log.includes('ACTION') && (
                                                <span className="flex items-center gap-2 pl-4">
                                                    <ChevronRight className="w-3 h-3 text-slate-400" />
                                                    {log}
                                                </span>
                                            )}
                                            {log.includes('COMPLETED') && (
                                                <span className="flex items-center gap-2 pl-4 text-emerald-600">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {log}
                                                </span>
                                            )}
                                            {log.includes('SUCCESSFULLY') && (
                                                <span className="flex items-center gap-2 font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 w-fit mt-1">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {log}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {/* Blinking Cursor */}
                                <div className="pl-8 pt-1">
                                    <span className="w-2 h-4 bg-slate-300 animate-pulse block"></span>
                                </div>
                            </div>
                        </div>

                        {/* Business Metrics Panel */}
                        <div className="w-72 border-l border-slate-200 bg-white p-6 hidden md:flex flex-col gap-6">

                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Avg. Process Time</div>
                                </div>
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-bold text-slate-900">1.2s</span>
                                    <span className="text-xs text-blue-600 mb-1 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">-15%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
                                    <div className="h-full bg-blue-500 w-[85%]"></div>
                                </div>
                            </div>
                            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
                                <Lock className="w-3 h-3" />
                                <span>End-to-End Encrypted</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
