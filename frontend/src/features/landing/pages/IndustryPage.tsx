import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { 
    ArrowRight, PlayCircle, ChevronRight, Star, Check, Zap,
    ShoppingCart, Package, Truck, FileCheck, DollarSign, Gift, 
    TrendingUp, Users, CheckCircle2, Activity, Clock, Globe, Lock,
    Briefcase, Award, Workflow, GraduationCap, Server, BarChart3,
    ShieldCheck, MousePointer2
} from 'lucide-react';
import { motion, AnimatePresence, useInView, useScroll, useTransform } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

import { industryPagesData, getIndustryBySlug, type IndustryProduct } from '@/data/industryPages';
import { cn } from '@/lib/utils';
import {
    Navbar,
    NavBody,
    MobileNav,
    NavbarLogo,
    NavbarButton,
    MobileNavHeader,
    MobileNavMenu,
} from "@/components/ui/resizable-navbar";
import { LandingFooter } from '@/components/layout/LandingFooter';

// --- Utility Components ---

const CountUpAnimation = ({ value, suffix = '', prefix = '' }: { value: string | number, suffix?: string, prefix?: string }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true });
    const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value;
    const isDecimal = value.toString().includes('.');
    
    // Fallback if parsing fails
    if (isNaN(numericValue)) return <span>{value}</span>;

    return (
        <span ref={ref} className="tabular-nums">
            {prefix}
            {isInView ? (
                <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <Counter from={0} to={numericValue} duration={2} isDecimal={isDecimal} />
                </motion.span>
            ) : (
                "0"
            )}
            {suffix}
        </span>
    );
};

const Counter = ({ from, to, duration, isDecimal }: { from: number, to: number, duration: number, isDecimal: boolean }) => {
    const [count, setCount] = useState(from);

    useEffect(() => {
        let startTime: number;
        let animationFrame: number;

        const update = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
            
            // Ease out quart
            const ease = 1 - Math.pow(1 - progress, 4);
            
            setCount(from + (to - from) * ease);

            if (progress < 1) {
                animationFrame = requestAnimationFrame(update);
            }
        };

        animationFrame = requestAnimationFrame(update);
        return () => cancelAnimationFrame(animationFrame);
    }, [from, to, duration]);

    return <>{isDecimal ? count.toFixed(1) : Math.round(count)}</>;
};

const FloatingElement = ({ children, delay = 0, duration = 4, yOffset = 8 }: { children: React.ReactNode, delay?: number, duration?: number, yOffset?: number }) => (
    <motion.div
        animate={{ y: [0, -yOffset, 0] }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
    >
        {children}
    </motion.div>
);

// --- Visualization Components ---

interface IndustryWorkflowVisualizerProps {
    workflows: Array<{
        title: string;
        description: string;
        steps: Array<{
            title: string;
            app: string;
            description: string;
        }>;
    }>;
    industryName: string;
}

const IndustryWorkflowVisualizer: React.FC<IndustryWorkflowVisualizerProps> = ({ workflows, industryName }) => {
    const [activeWorkflowIndex, setActiveWorkflowIndex] = useState(0);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);
    const [executionId, setExecutionId] = useState('SYS-001');
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Map workflow steps to visualizer format with icons and colors
    const workflowColors = [
        { color: 'orange', accent: 'from-orange-500 to-amber-500', border: 'border-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/10', glow: 'shadow-orange-500/50' },
        { color: 'purple', accent: 'from-purple-600 to-pink-500', border: 'border-purple-500', text: 'text-purple-400', bg: 'bg-purple-500/10', glow: 'shadow-purple-500/50' },
        { color: 'blue', accent: 'from-blue-600 to-cyan-500', border: 'border-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10', glow: 'shadow-blue-500/50' },
        { color: 'emerald', accent: 'from-emerald-600 to-teal-500', border: 'border-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10', glow: 'shadow-emerald-500/50' },
    ];

    const getAppIcon = (appName: string) => {
        const iconMap: { [key: string]: any } = {
            'Operations Management': Package,
            'Financial Accounting': DollarSign,
            'Affiliate Connect': Gift,
            'B2B CRM': Users,
            'Project Management': Briefcase,
            'HRMS': Users,
            'ESOP System': Award,
            'Flowtilla': Workflow,
            'Zopkit Academy': GraduationCap,
            'Zopkit ITSM': Server,
        };
        return iconMap[appName] || Activity;
    };

    const visualizerWorkflows = workflows.map((wf, idx) => ({
        id: wf.title.toLowerCase().replace(/\s+/g, '-'),
        title: wf.title,
        description: wf.description,
        ...workflowColors[idx % workflowColors.length],
        steps: wf.steps.map((step, stepIdx) => ({
            id: step.title.toLowerCase().replace(/\s+/g, '-'),
            title: step.title,
            app: step.app,
            icon: getAppIcon(step.app),
            action: step.description,
            status: stepIdx === wf.steps.length - 1 ? 'Completed' : 'In Progress',
        })),
    }));

    const activeWorkflow = visualizerWorkflows[activeWorkflowIndex];

    useEffect(() => {
        if (scrollContainerRef.current) {
            const { scrollHeight, clientHeight } = scrollContainerRef.current;
            scrollContainerRef.current.scrollTo({ top: scrollHeight - clientHeight, behavior: 'smooth' });
        }
    }, [logs]);

    const generateId = () => Math.floor(1000 + Math.random() * 9000);

    useEffect(() => {
        let stepTimer: ReturnType<typeof setTimeout>;
        let nextFlowTimer: ReturnType<typeof setTimeout>;

        if (activeStepIndex === 0 && logs.length === 0) {
            setExecutionId(`SYS-${generateId()}`);
        }

        const executeStep = () => {
            const step = activeWorkflow.steps[activeStepIndex];
            const now = new Date();
            const timestamp = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

            setLogs(prev => [
                ...prev,
                `[${timestamp}] EXEC: ${step.title}`,
                `[${timestamp}] > ${step.app} :: ${step.action}`,
                `[${timestamp}] OK.`,
            ]);

            if (activeStepIndex < activeWorkflow.steps.length - 1) {
                stepTimer = setTimeout(() => {
                    setActiveStepIndex(prev => prev + 1);
                }, 2500); // Slightly longer for better visual
            } else {
                setLogs(prev => [...prev, `[${timestamp}] WORKFLOW_COMPLETE: ${executionId}`]);

                nextFlowTimer = setTimeout(() => {
                    setLogs([]);
                    setActiveStepIndex(0);
                    setActiveWorkflowIndex(prev => (prev + 1) % visualizerWorkflows.length);
                }, 4000);
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
        <div className="w-full max-w-7xl mx-auto">
             <div className="text-center mb-12">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider mb-4"
                >
                    <Workflow size={14} />
                    Live Demonstration
                </motion.div>
                <motion.h2 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight"
                >
                    Intelligent Workflow Automation
                </motion.h2>
                <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed"
                >
                    Watch how our system orchestrates complex {industryName.toLowerCase()} processes in real-time.
                </motion.p>
            </div>

            <div className="bg-slate-950 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-slate-800/60 flex flex-col lg:flex-row h-auto lg:h-[650px]">
                {/* Sidebar */}
                <div className="w-full lg:w-80 bg-slate-900/50 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col shrink-0">
                    <div className="p-6 border-b border-slate-800">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-900/20">
                                <Zap className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-base text-slate-100 tracking-tight">Orchestrator</h3>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Online</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono ml-auto">V.4.2.0</div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                        {visualizerWorkflows.map((wf, idx) => {
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
                                        "w-full text-left p-3.5 rounded-lg transition-all duration-300 border relative overflow-hidden group",
                                        isActive
                                            ? "bg-slate-800 border-slate-700"
                                            : "bg-transparent border-transparent hover:bg-slate-800/50 hover:border-slate-800"
                                    )}
                                >
                                    {isActive && (
                                        <motion.div layoutId="active-indicator" className={cn("absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b", wf.accent)} />
                                    )}
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={cn("font-semibold text-sm transition-colors", isActive ? "text-slate-100" : "text-slate-400 group-hover:text-slate-300")}>
                                            {wf.title}
                                        </span>
                                        {isActive && (
                                            <Activity className={cn("w-3.5 h-3.5 animate-pulse", wf.text)} />
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium line-clamp-2">{wf.description}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Main Visualizer Stage */}
                <div className="flex-1 bg-slate-950 relative flex flex-col overflow-hidden">
                    {/* Background Grid */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:32px_32px] opacity-20"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>

                    {/* Header */}
                    <div className="relative z-10 h-16 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
                        <div className="flex items-center gap-4">
                            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                                <span className={cn("w-2 h-2 rounded-full", activeWorkflow.text.replace('text-', 'bg-'))}></span>
                                {activeWorkflow.title}
                            </h2>
                            <div className="px-2 py-0.5 rounded bg-slate-900 text-slate-500 text-[10px] font-mono border border-slate-800">
                                ID: {executionId}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium font-mono">
                            <Clock className="w-3 h-3" />
                            <span>T+{(activeStepIndex * 2.1).toFixed(2)}s</span>
                        </div>
                    </div>

                    {/* Visualization Area */}
                    <div className="flex-1 relative flex flex-col justify-center px-4 md:px-12 py-8 overflow-hidden">
                         <div className="relative w-full max-w-4xl mx-auto">
                            {/* Connecting Line Base */}
                            <div className="absolute top-12 left-0 right-0 h-0.5 bg-slate-800 rounded-full z-0" />

                            {/* Active Progress Line */}
                            <motion.div 
                                className={cn("absolute top-12 left-0 h-0.5 z-0 shadow-[0_0_12px_rgba(255,255,255,0.5)]", activeWorkflow.bg.replace('/10', ''))}
                                animate={{
                                    width: `${(activeStepIndex / (activeWorkflow.steps.length - 1)) * 100}%`
                                }}
                                transition={{ duration: 0.5, ease: "easeInOut" }}
                            />

                            {/* Data Packet moving between nodes */}
                            <AnimatePresence>
                                {activeStepIndex < activeWorkflow.steps.length - 1 && (
                                    <motion.div
                                        key={`packet-${activeStepIndex}`}
                                        className={cn("absolute top-12 -mt-1.5 w-3 h-3 rounded-full z-10 shadow-[0_0_10px_currentColor]", activeWorkflow.text.replace('text-', 'bg-'))}
                                        initial={{ 
                                            left: `${(activeStepIndex / (activeWorkflow.steps.length - 1)) * 100}%`,
                                            opacity: 0
                                        }}
                                        animate={{ 
                                            left: `${((activeStepIndex + 1) / (activeWorkflow.steps.length - 1)) * 100}%`,
                                            opacity: [0, 1, 1, 0] 
                                        }}
                                        transition={{ duration: 2.5, ease: "linear", times: [0, 0.1, 0.9, 1] }}
                                    />
                                )}
                            </AnimatePresence>

                            <div className="flex justify-between items-start relative z-10">
                                {activeWorkflow.steps.map((step, idx) => {
                                    const isActive = idx === activeStepIndex;
                                    const isCompleted = idx < activeStepIndex;
                                    const Icon = step.icon;

                                    return (
                                        <div key={step.id} className="flex flex-col items-center group relative w-24">
                                            {/* Node Circle */}
                                            <div className="relative">
                                                <motion.div 
                                                    className={cn(
                                                        "w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative bg-slate-900 z-20",
                                                        isActive
                                                            ? cn("border-transparent shadow-2xl scale-110", activeWorkflow.glow)
                                                            : isCompleted
                                                                ? cn("border-slate-700 text-emerald-400 scale-100")
                                                                : "border-slate-800 text-slate-600"
                                                    )}
                                                    animate={isActive ? { scale: [1.1, 1.15, 1.1] } : {}}
                                                    transition={{ duration: 2, repeat: Infinity }}
                                                >
                                                    {/* Active Glow Ring */}
                                                    {isActive && (
                                                        <>
                                                            <div className={cn("absolute inset-0 rounded-full animate-spin-slow border-2 border-dashed opacity-50", activeWorkflow.border)}></div>
                                                            <div className={cn("absolute -inset-4 rounded-full opacity-20 animate-ping", activeWorkflow.text.replace('text-', 'bg-'))}></div>
                                                        </>
                                                    )}
                                                    
                                                    <Icon className={cn("w-8 h-8 transition-all duration-300", isActive && activeWorkflow.text)} />
                                                    
                                                    {isCompleted && (
                                                        <motion.div 
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            className="absolute -right-1 -bottom-1 bg-emerald-500 text-slate-950 rounded-full p-1 shadow-lg border border-slate-900"
                                                        >
                                                            <Check className="w-3 h-3" strokeWidth={4} />
                                                        </motion.div>
                                                    )}
                                                </motion.div>
                                            </div>

                                            {/* Labels */}
                                            <div className="mt-6 text-center w-32">
                                                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                                    Step 0{idx + 1}
                                                </div>
                                                <div className={cn(
                                                    "text-xs font-bold transition-all duration-300 mb-1",
                                                    isActive ? "text-slate-100" : isCompleted ? "text-slate-400" : "text-slate-600"
                                                )}>
                                                    {step.title}
                                                </div>
                                                <div className={cn(
                                                    "text-[10px] font-mono px-2 py-0.5 rounded border inline-block transition-colors",
                                                    isActive ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-transparent text-slate-700 border-transparent"
                                                )}>
                                                    {step.app}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Console Panel */}
                    <div className="h-48 bg-slate-950 border-t border-slate-800 flex flex-col relative z-20">
                        <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                            <span className="text-slate-400 font-mono text-xs flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 
                                System Logs
                            </span>
                            <div className="flex gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></span>
                                <span className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></span>
                                <span className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></span>
                            </div>
                        </div>
                        <div
                            ref={scrollContainerRef}
                            className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar font-mono text-xs bg-black/20"
                        >
                            <AnimatePresence>
                                {logs.map((log, i) => (
                                    <motion.div 
                                        key={`${executionId}-${i}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex gap-3 items-start text-slate-400 border-l-2 border-transparent hover:border-slate-700 pl-2 transition-colors"
                                    >
                                        <span className="text-slate-600 shrink-0 select-none opacity-50">
                                            {(i + 1).toString().padStart(3, '0')}
                                        </span>
                                        <span className={cn(
                                            "break-all",
                                            log.includes('EXEC') ? "text-blue-400" : 
                                            log.includes('COMPLETE') ? "text-emerald-400 font-bold" :
                                            log.includes('OK') ? "text-emerald-500/70" : "text-slate-300"
                                        )}>
                                            {log}
                                        </span>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {logs.length === 0 && (
                                <div className="flex items-center gap-2 text-slate-700 italic">
                                    <span className="w-2 h-4 bg-slate-700 animate-pulse"></span>
                                    Waiting for execution stream...
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface ProductNodeProps {
    product: {
        id: string;
        name: string;
        priority: number;
        description: string;
    };
    navigate: ReturnType<typeof useNavigate>;
    priority: number;
    isEntryPoint?: boolean;
    isCore?: boolean;
    isSupport?: boolean;
    className?: string;
}

const ProductNode: React.FC<ProductNodeProps> = ({ product, navigate, priority, isEntryPoint, isCore, isSupport, className }) => {
    return (
        <motion.div 
            whileHover={{ y: -8, scale: 1.05 }}
            className={cn("relative group cursor-pointer", className)}
            onClick={() => navigate({ to: `/products/${product.id}` })}
        >
            <div className={cn(
                "bg-white/90 backdrop-blur-md rounded-xl border transition-all duration-300 p-4 w-[200px] relative z-10",
                "shadow-[0_4px_20px_-2px_rgba(0,0,0,0.1)] group-hover:shadow-[0_20px_40px_-4px_rgba(0,0,0,0.2)]",
                isCore 
                    ? "border-orange-200 ring-1 ring-orange-500/20" 
                    : isEntryPoint
                        ? "border-blue-200 ring-1 ring-blue-500/20"
                        : "border-slate-200"
            )}>
                {isCore && <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 to-transparent rounded-xl pointer-events-none" />}
                
                <div className="relative z-20">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex gap-0.5">
                            {[1, 2, 3].map((star) => (
                                <Star
                                    key={star}
                                    size={10}
                                    className={star <= priority ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}
                                />
                            ))}
                        </div>
                        {isCore && (
                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded border border-orange-200 font-bold shadow-sm">
                                Core
                            </span>
                        )}
                        {isEntryPoint && (
                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded border border-blue-200 font-bold shadow-sm">
                                Input
                            </span>
                        )}
                    </div>
                    <h3 className={cn(
                        "text-sm font-bold mb-1.5 transition-colors group-hover:text-blue-600 antialiased",
                        isCore ? "text-slate-900" : "text-slate-800"
                    )}>
                        {product.name}
                    </h3>
                    <p className="text-xs text-slate-600 mb-3 line-clamp-2 leading-relaxed min-h-[2.5rem] font-medium">
                        {product.description}
                    </p>
                    <div className={cn(
                        "w-full h-1 rounded-full overflow-hidden",
                        isCore ? "bg-orange-100" : "bg-slate-100"
                    )}>
                        <motion.div 
                            className={cn(
                                "h-full rounded-full",
                                isCore ? "bg-orange-500" : "bg-blue-500"
                            )} 
                            initial={{ width: "0%" }}
                            whileInView={{ width: "66%" }}
                            transition={{ duration: 1, delay: 0.2 }}
                        />
                    </div>
                </div>
            </div>
            
            {/* Hover Glow Effect */}
            <div className={cn(
                "absolute -inset-2 bg-gradient-to-r rounded-2xl blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500 -z-10",
                isCore ? "from-orange-400 to-amber-300" : "from-blue-400 to-cyan-300"
            )} />
        </motion.div>
    );
};

const SVGWorkflowDiagram: React.FC<{
    topRow: IndustryProduct[];
    centerRow: IndustryProduct[];
    bottomRow: IndustryProduct[];
    navigate: ReturnType<typeof useNavigate>;
}> = ({ topRow, centerRow, bottomRow, navigate }) => {
    const viewBox = { w: 920, h: 580 };
    const left = 180;
    const right = 740;
    const topY = 95;
    const midY = 290;
    const bottomY = 485;
    const cx = 460;

    const dataFlowPath1 = `M ${left} ${topY} C ${left + 80} ${topY + 60}, ${cx - 60} ${midY - 40}, ${cx} ${midY}`;
    const dataFlowPath2 = `M ${right} ${topY} C ${right - 80} ${topY + 60}, ${cx + 60} ${midY - 40}, ${cx} ${midY}`;
    const integrationPath1 = `M ${cx} ${midY} C ${cx - 80} ${midY + 60}, ${left + 60} ${bottomY - 40}, ${left} ${bottomY}`;
    const integrationPath2 = `M ${cx} ${midY} C ${cx + 80} ${midY + 60}, ${right - 60} ${bottomY - 40}, ${right} ${bottomY}`;

    return (
        <div
            className="relative w-full bg-slate-50/50 rounded-2xl border border-slate-200"
            style={{ aspectRatio: `${viewBox.w} / ${viewBox.h}`, minHeight: 420 }}
        >
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            
            <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-0"
                viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
                preserveAspectRatio="xMidYMid meet"
                fill="none"
                aria-hidden
            >
                <defs>
                    <linearGradient id="dataFlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1" />
                        <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0.1" />
                    </linearGradient>
                    <linearGradient id="integrationGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.1" />
                        <stop offset="50%" stopColor="#10b981" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#059669" stopOpacity="0.1" />
                    </linearGradient>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>

                {/* Animated Paths */}
                {[dataFlowPath1, dataFlowPath2].map((d, i) => (
                    <motion.path
                        key={`flow-${i}`}
                        d={d}
                        stroke="url(#dataFlowGrad)"
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray="10 20"
                        initial={{ strokeDashoffset: 100 }}
                        animate={{ strokeDashoffset: 0 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        filter="url(#glow)"
                    />
                ))}
                
                {[integrationPath1, integrationPath2].map((d, i) => (
                    <motion.path
                        key={`int-${i}`}
                        d={d}
                        stroke="url(#integrationGrad)"
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray="10 20"
                        initial={{ strokeDashoffset: 0 }}
                        animate={{ strokeDashoffset: -100 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        filter="url(#glow)"
                    />
                ))}

                {/* Labels - placed mid-path so they are not hidden behind nodes */}
                <text x={(left + cx) / 2} y={(topY + midY) / 2 - 8} textAnchor="middle" fill="#334155" fontSize="13" fontWeight="700" className="uppercase tracking-widest">Inflow</text>
                <text x={(right + cx) / 2} y={(topY + midY) / 2 - 8} textAnchor="middle" fill="#334155" fontSize="13" fontWeight="700" className="uppercase tracking-widest">Inflow</text>
                <text x={cx} y={(midY + bottomY) / 2 + 36} textAnchor="middle" fill="#047857" fontSize="13" fontWeight="700" className="uppercase tracking-widest">Distribution</text>
            </svg>

            {/* Nodes - z-10 so diagram labels stay visible in path gaps */}
            <div className="absolute inset-0 z-10 pointer-events-none">
                <div className="relative w-full h-full pointer-events-auto" style={{ minHeight: viewBox.h }}>
                    {topRow[0] && (
                        <div className="absolute" style={{ left: `${(left / viewBox.w) * 100}%`, top: `${(topY / viewBox.h) * 100}%`, transform: 'translate(-50%, -50%)' }}>
                            <FloatingElement delay={0}>
                                <ProductNode product={topRow[0]} navigate={navigate} priority={topRow[0].priority} isEntryPoint className="pointer-events-auto" />
                            </FloatingElement>
                        </div>
                    )}
                    {topRow[1] && (
                        <div className="absolute" style={{ left: `${(right / viewBox.w) * 100}%`, top: `${(topY / viewBox.h) * 100}%`, transform: 'translate(-50%, -50%)' }}>
                            <FloatingElement delay={0.5}>
                                <ProductNode product={topRow[1]} navigate={navigate} priority={topRow[1].priority} isEntryPoint className="pointer-events-auto" />
                            </FloatingElement>
                        </div>
                    )}
                    {centerRow[0] && (
                        <div className="absolute" style={{ left: '50%', top: `${(midY / viewBox.h) * 100}%`, transform: 'translate(-50%, -50%)' }}>
                            <FloatingElement delay={0.2} yOffset={5}>
                                <ProductNode product={centerRow[0]} navigate={navigate} priority={centerRow[0].priority} isCore className="pointer-events-auto scale-110" />
                            </FloatingElement>
                        </div>
                    )}
                    {bottomRow[0] && (
                        <div className="absolute" style={{ left: `${(left / viewBox.w) * 100}%`, top: `${(bottomY / viewBox.h) * 100}%`, transform: 'translate(-50%, -50%)' }}>
                             <FloatingElement delay={0.7}>
                                <ProductNode product={bottomRow[0]} navigate={navigate} priority={bottomRow[0].priority} isSupport={bottomRow[0].priority < 3} className="pointer-events-auto" />
                             </FloatingElement>
                        </div>
                    )}
                    {bottomRow[1] && (
                        <div className="absolute" style={{ left: `${(right / viewBox.w) * 100}%`, top: `${(bottomY / viewBox.h) * 100}%`, transform: 'translate(-50%, -50%)' }}>
                             <FloatingElement delay={0.9}>
                                <ProductNode product={bottomRow[1]} navigate={navigate} priority={bottomRow[1].priority} isSupport={bottomRow[1].priority < 3} className="pointer-events-auto" />
                             </FloatingElement>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Main Page Component ---

const IndustryPage: React.FC = () => {
    const { industrySlug } = useParams({ strict: false });
    const navigate = useNavigate();
    const { scrollY } = useScroll();
    const backgroundY = useTransform(scrollY, [0, 500], [0, 150]);

    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const [showProductsDropdown, setShowProductsDropdown] = React.useState(false);
    const [showIndustriesDropdown, setShowIndustriesDropdown] = React.useState(false);
    const productsDropdownTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const industriesDropdownTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [industrySlug]);

    const handleProductsMouseEnter = () => {
        if (productsDropdownTimeoutRef.current) clearTimeout(productsDropdownTimeoutRef.current);
        setShowProductsDropdown(true);
    };

    const handleProductsMouseLeave = () => {
        productsDropdownTimeoutRef.current = setTimeout(() => setShowProductsDropdown(false), 300);
    };

    const handleIndustriesMouseEnter = () => {
        if (industriesDropdownTimeoutRef.current) clearTimeout(industriesDropdownTimeoutRef.current);
        setShowIndustriesDropdown(true);
    };

    const handleIndustriesMouseLeave = () => {
        industriesDropdownTimeoutRef.current = setTimeout(() => setShowIndustriesDropdown(false), 300);
    };

    const allIndustries = [
        { slug: 'e-commerce', name: 'E-Commerce & Retail' },
        { slug: 'saas', name: 'SaaS & Technology' },
        { slug: 'manufacturing', name: 'Manufacturing' },
        { slug: 'professional-services', name: 'Professional Services' },
    ];

    const allProducts = [
        { id: 'operations-management', name: 'Operations Management' },
        { id: 'b2b-crm', name: 'B2B CRM' },
        { id: 'financial-accounting', name: 'Financial Accounting' },
        { id: 'project-management', name: 'Project Management' },
        { id: 'hrms', name: 'HRMS' },
        { id: 'esop-system', name: 'ESOP System' },
        { id: 'affiliate-connect', name: 'Affiliate Connect' },
        { id: 'flowtilla', name: 'Flowtilla' },
        { id: 'zopkit-academy', name: 'Zopkit Academy' },
        { id: 'zopkit-itsm', name: 'Zopkit ITSM' },
        { id: 'b2c-crm', name: 'B2C CRM' },
    ];

    const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        if (href.startsWith('/')) {
            e.preventDefault();
            navigate({ to: href });
            return;
        }
        e.preventDefault();
        const targetId = href.replace('#', '');
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            const navbarOffset = 100;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - navbarOffset;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
    };

    const data = industrySlug ? getIndustryBySlug(industrySlug) : undefined;

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-900 mb-4">Industry Not Found</h1>
                    <button onClick={() => navigate({ to: '/' })} className="text-blue-600 hover:text-blue-700 font-medium">Return to Home</button>
                </div>
            </div>
        );
    }

    const chartData = [
        { name: 'Q1', value: 40, label: 'Efficiency' },
        { name: 'Q2', value: 65, label: 'Efficiency' },
        { name: 'Q3', value: 55, label: 'Efficiency' },
        { name: 'Q4', value: 85, label: 'Efficiency' },
        { name: 'Q5', value: 95, label: 'Efficiency' },
    ];

    const navItems = [
        { name: "Pricing", link: "/pricing" },
        { name: "Workflows", link: "#workflows" },
        { name: "Contact Us", link: "/landing#pricing" },
    ];

    return (
        <div className="w-full bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
             <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(71, 85, 105, 0.3); border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(71, 85, 105, 0.5); }
            `}</style>
            
            {/* Navbar */}
            <Navbar>
                <NavBody>
                    <NavbarLogo />
                    <div className="flex-1 flex flex-row items-center justify-center space-x-1 text-sm font-medium text-slate-700 transition duration-200 px-4 min-w-0">
                         {/* Products Dropdown */}
                         <div
                            className="relative shrink-0"
                            onMouseEnter={handleProductsMouseEnter}
                            onMouseLeave={handleProductsMouseLeave}
                        >
                            <button
                                className="px-3 py-2 text-slate-700 hover:text-slate-900 font-medium flex items-center gap-1 whitespace-nowrap"
                            >
                                Products
                                <ChevronRight size={16} className={`transition-transform duration-200 ${showProductsDropdown ? 'rotate-90' : ''}`} />
                            </button>
                            <AnimatePresence>
                                {showProductsDropdown && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="absolute top-full left-0 mt-2 w-64 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 py-2 z-50 ring-1 ring-slate-900/5"
                                    >
                                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                            {allProducts.map((product) => (
                                                <button
                                                    key={product.id}
                                                    onClick={() => navigate({ to: `/products/${product.id}` })}
                                                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                                                >
                                                    {product.name}
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        {/* Industries Dropdown */}
                        <div
                            className="relative shrink-0"
                            onMouseEnter={handleIndustriesMouseEnter}
                            onMouseLeave={handleIndustriesMouseLeave}
                        >
                            <button
                                className="px-3 py-2 text-slate-700 hover:text-slate-900 font-medium flex items-center gap-1 whitespace-nowrap"
                            >
                                Industries
                                <ChevronRight size={16} className={`transition-transform duration-200 ${showIndustriesDropdown ? 'rotate-90' : ''}`} />
                            </button>
                            <AnimatePresence>
                                {showIndustriesDropdown && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="absolute top-full left-0 mt-2 w-64 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 py-2 z-50 ring-1 ring-slate-900/5"
                                    >
                                        {allIndustries.map((industry) => (
                                            <button
                                                key={industry.slug}
                                                onClick={() => navigate({ to: `/industries/${industry.slug}` })}
                                                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                                            >
                                                {industry.name}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        {navItems.map((item) => (
                            <a
                                key={item.name}
                                href={item.link}
                                onClick={(e) => handleAnchorClick(e, item.link)}
                                className="px-3 py-2 text-slate-700 hover:text-slate-900 font-medium transition cursor-pointer whitespace-nowrap shrink-0 hover:bg-slate-50 rounded-lg"
                            >
                                {item.name}
                            </a>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                         <NavbarButton variant="outline" onClick={() => navigate({ to: '/' })} as="button" className="rounded-xl px-5 py-2">
                            Home
                        </NavbarButton>
                        <NavbarButton variant="gradient" onClick={() => navigate({ to: '/onboarding' })} as="button" className="rounded-xl px-5 py-2 shadow-lg shadow-blue-500/20">
                            Start Free Trial
                        </NavbarButton>
                    </div>
                </NavBody>
                <MobileNav>
                    <MobileNavHeader><NavbarLogo /></MobileNavHeader>
                    <MobileNavMenu isOpen={true} onClose={() => {}}>
                         {/* Mobile menu content omitted for brevity, keeping same logic as original */}
                         <div className="flex w-full flex-col gap-3 mt-4">
                            <NavbarButton onClick={() => { setIsMobileMenuOpen(false); navigate({ to: '/onboarding' }); }} variant="gradient" className="w-full rounded-xl" as="button">
                                Start Free Trial
                            </NavbarButton>
                        </div>
                    </MobileNavMenu>
                </MobileNav>
            </Navbar>

            {/* Hero Section */}
            <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
                <div className="absolute inset-0 bg-slate-50 -z-20"></div>
                <motion.div 
                    style={{ y: backgroundY }}
                    className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] -z-10 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
                ></motion.div>
                
                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-8 border border-blue-100 shadow-sm"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        {data.name} Solutions
                    </motion.div>
                    
                    <motion.h1 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-8 text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600"
                    >
                        {data.hero.headline}
                    </motion.h1>
                    
                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="text-xl text-slate-600 mb-10 max-w-3xl mx-auto leading-relaxed"
                    >
                        {data.hero.subheadline}
                    </motion.p>
                    
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
                    >
                        <button
                            onClick={() => navigate({ to: '/onboarding' })}
                            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg transition shadow-xl shadow-blue-600/20 hover:shadow-blue-600/40 hover:-translate-y-1 flex items-center gap-2 group"
                        >
                            {data.hero.primaryCTA} <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-lg transition flex items-center gap-2 shadow-sm hover:shadow-md group">
                            <PlayCircle size={20} className="text-slate-400 group-hover:text-blue-500 transition-colors" /> {data.hero.secondaryCTA}
                        </button>
                    </motion.div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
                        {data.hero.stats.map((stat, i) => (
                            <motion.div 
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.4 + (i * 0.1) }}
                                whileHover={{ y: -5 }}
                                className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all duration-300"
                            >
                                <div className="text-3xl font-bold text-slate-900 mb-1">
                                    <CountUpAnimation value={stat.value} />
                                </div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pain Points Section */}
            <section id="challenges" className="py-24 px-4 sm:px-6 lg:px-8 bg-white relative">
                 <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-slate-900 mb-4">Common Challenges We Solve</h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                            Transforming obstacles into opportunities for {data.name} leaders.
                        </p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {data.painPoints.map((point, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="group bg-slate-50 hover:bg-white p-8 rounded-2xl border border-slate-200 hover:border-blue-200 transition-all duration-300 hover:shadow-xl hover:shadow-blue-900/5 hover:-translate-y-1"
                            >
                                <div className="w-12 h-12 rounded-xl bg-blue-100 group-hover:bg-blue-600 transition-colors flex items-center justify-center mb-6">
                                    <point.icon size={24} className="text-blue-600 group-hover:text-white transition-colors" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">{point.text}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    Our platform directly addresses this by streamlining operations and providing real-time visibility.
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Products Section - SVG Workflow Diagram */}
            <section id="integrated-solutions" className="pt-28 pb-24 px-4 sm:px-6 lg:px-8 bg-slate-50 border-y border-slate-200 scroll-mt-24">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-slate-900 mb-4">
                            Integrated Solutions Ecosystem
                        </h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                            See how data flows seamlessly between input channels, core processors, and supporting applications.
                        </p>
                    </div>
                    {(() => {
                        const priority3Products = data.products.filter(p => p.priority === 3);
                        const priority2Products = data.products.filter(p => p.priority === 2);
                        const priority1Products = data.products.filter(p => p.priority === 1);
                        const topRow = priority3Products.slice(0, 2);
                        const centerRow = priority3Products.length > 2 ? [priority3Products[2]] : (priority3Products.length === 1 ? priority3Products : []);
                        const bottomRow = [...priority3Products.slice(3), ...priority2Products, ...priority1Products].slice(0, 2);
                        const hasFlow = topRow.length > 0 || centerRow.length > 0 || bottomRow.length > 0;
                        return (
                             <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6 }}
                                className="bg-white rounded-3xl border border-slate-200 shadow-2xl shadow-slate-200/50 p-6 md:p-12 overflow-hidden"
                            >
                                {hasFlow ? (
                                    <SVGWorkflowDiagram
                                        topRow={topRow}
                                        centerRow={centerRow}
                                        bottomRow={bottomRow}
                                        navigate={navigate}
                                    />
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 py-8">
                                        {data.products.map((product) => (
                                            <ProductNode
                                                key={product.id}
                                                product={product}
                                                navigate={navigate}
                                                priority={product.priority}
                                            />
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        );
                    })()}
                </div>
            </section>

            {/* Interactive Visualizer */}
            <section id="workflows" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-100">
                <IndustryWorkflowVisualizer workflows={data.workflows} industryName={data.name} />
            </section>

            {/* ROI Metrics Section */}
            <section id="roi" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-slate-900 mb-4">Measurable Impact</h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                            Real results from real companies in the {data.name} sector.
                        </p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {data.roiMetrics.map((metric, i) => (
                            <motion.div 
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-slate-50 rounded-2xl p-8 border border-slate-100 relative overflow-hidden group hover:border-blue-200 transition-colors"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <BarChart3 size={64} className="text-blue-900" />
                                </div>
                                <div className="relative z-10">
                                    <div className="text-5xl font-extrabold text-blue-600 mb-2 tracking-tight">
                                        <CountUpAnimation value={metric.value} />
                                    </div>
                                    <div className="text-lg font-bold text-slate-900 mb-3">{metric.label}</div>
                                    <p className="text-slate-500 text-sm leading-relaxed mb-6">{metric.description || "Consistent improvement observed across all client deployments within the first quarter."}</p>
                                    
                                    {/* Mini Visualization */}
                                    <div className="h-16 w-full opacity-50">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData}>
                                                <defs>
                                                    <linearGradient id={`colorGradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill={`url(#colorGradient-${i})`} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Case Study Section */}
            <section id="case-study" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50">
                <div className="max-w-5xl mx-auto">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="bg-white rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/50 border border-slate-100"
                    >
                        <div className="grid md:grid-cols-2">
                            <div className="p-10 md:p-14 flex flex-col justify-center">
                                <div className="mb-8">
                                    <span className="text-blue-600 font-bold uppercase tracking-widest text-xs mb-2 block">Featured Success Story</span>
                                    <h2 className="text-3xl font-bold text-slate-900 mb-2">{data.caseStudy.company}</h2>
                                    <div className="text-slate-500 font-medium">{data.caseStudy.industry}</div>
                                </div>
                                <blockquote className="text-xl text-slate-700 italic leading-relaxed mb-8">
                                    "{data.caseStudy.quote}"
                                </blockquote>
                                <div className="mt-auto pt-6 border-t border-slate-100">
                                    <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                        <Award size={18} className="text-orange-500" /> Key Outcomes
                                    </h4>
                                    <ul className="space-y-3">
                                        {data.caseStudy.results.map((result, i) => (
                                            <li key={i} className="flex items-start gap-3 text-slate-600 text-sm">
                                                <div className="mt-0.5 min-w-[18px] h-[18px] rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                                    <Check size={12} strokeWidth={3} />
                                                </div>
                                                {result}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            <div className="bg-slate-900 p-10 md:p-14 text-white flex flex-col justify-center relative overflow-hidden group">
                                <motion.div 
                                    className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-800 to-slate-900 opacity-50"
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                ></motion.div>
                                <div className="relative z-10">
                                    <h3 className="text-2xl font-bold mb-6">Ready to achieve similar results?</h3>
                                    <p className="text-slate-300 mb-8 leading-relaxed">
                                        Join forward-thinking companies in the {data.name} industry who have transformed their operations.
                                    </p>
                                    <button 
                                        onClick={() => navigate({ to: '/onboarding' })}
                                        className="w-full py-4 bg-white text-slate-900 rounded-xl font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 group/btn"
                                    >
                                        Start Your Journey <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                                {/* Decorative elements */}
                                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-20 group-hover:opacity-30 transition-opacity"></div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Final CTA Section */}
            <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-full bg-blue-500/10 blur-[120px]"
                ></motion.div>
                
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white tracking-tight">
                        {data.finalCTA.headline}
                    </h2>
                    <p className="text-xl text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto">
                        {data.finalCTA.description}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <button
                            onClick={() => navigate({ to: '/onboarding' })}
                            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-semibold text-lg transition shadow-lg shadow-blue-500/25 hover:-translate-y-1 flex items-center gap-2 group"
                        >
                            {data.finalCTA.primaryCTA} <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                        {data.finalCTA.secondaryCTAs.map((cta, i) => (
                            <button
                                key={i}
                                className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-full font-medium transition"
                            >
                                {cta}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <LandingFooter />
        </div>
    );
};

export default IndustryPage;