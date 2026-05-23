import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { 
    ArrowRight, PlayCircle, Check, Zap,
    ShoppingCart, Package, Truck, FileCheck, DollarSign, Gift, 
    TrendingUp, Users, CheckCircle2, Activity, Clock, Globe, Lock,
    Briefcase, Award, Workflow, GraduationCap, Server,
    ShieldCheck, MousePointer2
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { getIndustryBySlug } from '@/data/industryPages';
import { OrbitalEcosystem, WORKFLOW_ORBIT_APP_IDS } from '@/features/landing/components/OrbitalEcosystem';
import { cn } from '@/lib/utils';
import { LandingFooter } from '@/components/layout/LandingFooter';
import { MarketingNavbar } from '@/components/layout/MarketingNavbar';

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
                    className="text-4xl md:text-5xl font-bold text-[#1B2E5A] mb-4 tracking-tight"
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

// --- Main Page Component ---

const IndustryPage: React.FC = () => {
    const { industrySlug } = useParams({ strict: false });
    const navigate = useNavigate();
    const { scrollY } = useScroll();
    const backgroundY = useTransform(scrollY, [0, 500], [0, 150]);

    React.useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [industrySlug]);

    const data = industrySlug ? getIndustryBySlug(industrySlug) : undefined;

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-[#1B2E5A] mb-4">Industry Not Found</h1>
                    <button onClick={() => navigate({ to: '/' })} className="text-blue-600 hover:text-blue-700 font-medium">Return to Home</button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
             <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(71, 85, 105, 0.3); border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(71, 85, 105, 0.5); }
            `}</style>
            
            <MarketingNavbar />

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
                        className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-8 text-[#1B2E5A] bg-clip-text text-transparent bg-gradient-to-r from-[#1B2E5A] via-[#2D4A7B] to-[#4A6FA5]"
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
                        className="flex flex-col sm:flex-row gap-4 justify-center items-center"
                    >
                        <button
                            onClick={() => navigate({ to: '/onboarding' })}
                            className="px-8 py-4 bg-[#1B2E5A] hover:bg-[#162447] text-white rounded-xl font-semibold text-lg transition shadow-xl shadow-blue-600/20 hover:shadow-blue-600/40 hover:-translate-y-1 flex items-center gap-2 group"
                        >
                            {data.hero.primaryCTA} <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-lg transition flex items-center gap-2 shadow-sm hover:shadow-md group">
                            <PlayCircle size={20} className="text-slate-400 group-hover:text-blue-500 transition-colors" /> {data.hero.secondaryCTA}
                        </button>
                    </motion.div>
                </div>
            </section>

            {/* Pain Points Section */}
            <section id="challenges" className="py-24 px-4 sm:px-6 lg:px-8 bg-white relative">
                 <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-[#1B2E5A] mb-4">Common Challenges We Solve</h2>
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
                                className="group bg-slate-50 hover:bg-[#1B2E5A] p-8 rounded-2xl border border-slate-200 hover:border-[#162447] transition-all duration-300 hover:shadow-xl hover:shadow-[#0f172a]/25 hover:-translate-y-1"
                            >
                                <div className="w-12 h-12 rounded-xl bg-blue-100 group-hover:bg-white/15 transition-colors flex items-center justify-center mb-6">
                                    <point.icon size={24} className="text-blue-600 group-hover:text-white transition-colors" />
                                </div>
                                <h3 className="text-lg font-bold text-[#1B2E5A] group-hover:text-white mb-2 transition-colors">{point.text}</h3>
                                <p className="text-slate-500 group-hover:text-slate-200 text-sm leading-relaxed transition-colors">
                                    Our platform directly addresses this by streamlining operations and providing real-time visibility.
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Integrated solutions — orbital ecosystem (same interactive as home page) */}
            <section id="integrated-solutions" className="pt-28 pb-24 px-4 sm:px-6 lg:px-8 bg-slate-50 border-y border-slate-200 scroll-mt-24">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-12 sm:mb-16">
                        <h2 className="text-4xl font-bold text-[#1B2E5A] mb-4">
                            Integrated Solutions Ecosystem
                        </h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                            Explore how every app connects around the Zopkit hub — tap the orbit to see dependencies, matching the home page experience.
                        </p>
                    </div>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 p-8 md:p-12 flex justify-center"
                    >
                        <OrbitalEcosystem
                            layout="stack"
                            appIds={WORKFLOW_ORBIT_APP_IDS}
                            motionClassName="mx-auto w-full max-w-[420px] lg:max-w-[520px]"
                        />
                    </motion.div>
                </div>
            </section>

            {/* Interactive Visualizer */}
            <section id="workflows" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-100">
                <IndustryWorkflowVisualizer workflows={data.workflows} industryName={data.name} />
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
                            className="px-8 py-4 bg-[#1B2E5A] hover:bg-[#162447] text-white rounded-full font-semibold text-lg transition shadow-lg shadow-blue-500/25 hover:-translate-y-1 flex items-center gap-2 group"
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