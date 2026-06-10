import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { 
    ArrowRight, PlayCircle, Check, Zap,
    Package, DollarSign, Gift, 
    Users, Activity, Clock,
    Briefcase, Award, Workflow, GraduationCap, Server
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getIndustryBySlug } from '@/data/industryPages';
import { OrbitalEcosystem, WORKFLOW_ORBIT_APP_IDS } from '@/features/landing/components/OrbitalEcosystem';
import { cn } from '@/lib/utils';
import { LandingFooter } from '@/components/layout/LandingFooter';
import { MarketingNavbar } from '@/components/layout/MarketingNavbar';
import { MarketingPageShell } from '@/components/layout/MarketingPageShell';

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
        { color: 'navy', accent: 'from-primary to-primary', border: 'border-primary', text: 'text-primary', bg: 'bg-primary/10', glow: 'shadow-primary/20' },
        { color: 'navy', accent: 'from-primary to-primary', border: 'border-primary', text: 'text-primary', bg: 'bg-primary/10', glow: 'shadow-primary/20' },
        { color: 'navy', accent: 'from-primary to-primary', border: 'border-primary', text: 'text-primary', bg: 'bg-primary/10', glow: 'shadow-primary/20' },
        { color: 'navy', accent: 'from-primary to-primary', border: 'border-primary', text: 'text-primary', bg: 'bg-primary/10', glow: 'shadow-primary/20' },
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
                    className="text-4xl md:text-5xl font-medium text-foreground mb-4 tracking-tight"
                >
                    Connected workflows
                </motion.h2>
                <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed"
                >
                    See how Zopkit links {industryName.toLowerCase()} processes across CRM, finance, and operations.
                </motion.p>
            </div>

            <div className="bg-card rounded-md overflow-hidden border border-border flex flex-col lg:flex-row h-auto lg:h-[650px]">
                {/* Sidebar */}
                <div className="w-full lg:w-80 bg-secondary border-b lg:border-b-0 lg:border-r border-border flex flex-col shrink-0">
                    <div className="p-6 border-b border-border">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-medium">
                                <Zap className="w-5 h-5" />
                            </div>
                            <h3 className="font-medium text-base text-foreground tracking-tight">Workflow hub</h3>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[10px] font-medium text-emerald-700">Active</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono ml-auto">v4.2.0</div>
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
                                        "w-full text-left p-3.5 rounded-md transition-colors duration-200 border relative overflow-hidden group",
                                        isActive
                                            ? "bg-background border-border"
                                            : "bg-transparent border-transparent hover:bg-background/80 hover:border-border"
                                    )}
                                >
                                    {isActive && (
                                        <motion.div layoutId="active-indicator" className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                                    )}
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={cn("font-medium text-sm transition-colors", isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                                            {wf.title}
                                        </span>
                                        {isActive && (
                                            <Activity className={cn("w-3.5 h-3.5 animate-pulse text-primary")} />
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{wf.description}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Main Visualizer Stage */}
                <div className="flex-1 bg-background relative flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="relative z-10 h-16 border-b border-border bg-background flex items-center justify-between px-6 shrink-0">
                        <div className="flex items-center gap-4">
                            <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary"></span>
                                {activeWorkflow.title}
                            </h2>
                            <div className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10px] font-mono border border-border">
                                ID: {executionId}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium font-mono">
                            <Clock className="w-3 h-3" />
                            <span>T+{(activeStepIndex * 2.1).toFixed(2)}s</span>
                        </div>
                    </div>

                    {/* Visualization Area */}
                    <div className="flex-1 relative flex flex-col justify-center px-4 md:px-12 py-8 overflow-hidden">
                         <div className="relative w-full max-w-4xl mx-auto">
                            {/* Connecting Line Base */}
                            <div className="absolute top-12 left-0 right-0 h-0.5 bg-border rounded-full z-0" />

                            {/* Active Progress Line */}
                            <motion.div 
                                className="absolute top-12 left-0 h-0.5 z-0 bg-primary"
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
                                        className={cn("absolute top-12 -mt-1.5 w-3 h-3 rounded-full z-10 bg-primary")}
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
                                                        "w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative bg-card z-20",
                                                        isActive
                                                            ? "border-primary shadow-sm scale-110"
                                                            : isCompleted
                                                                ? "border-border text-primary scale-100"
                                                                : "border-border text-muted-foreground"
                                                    )}
                                                    animate={isActive ? { scale: [1.1, 1.15, 1.1] } : {}}
                                                    transition={{ duration: 2, repeat: Infinity }}
                                                >
                                                    {/* Active Glow Ring */}
                                                    {isActive && (
                                                        <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/40 opacity-50"></div>
                                                    )}
                                                    
                                                    <Icon className={cn("w-8 h-8 transition-all duration-300", isActive && "text-primary")} />
                                                    
                                                    {isCompleted && (
                                                        <motion.div 
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            className="absolute -right-1 -bottom-1 bg-primary text-primary-foreground rounded-full p-1 border border-background"
                                                        >
                                                            <Check className="w-3 h-3" strokeWidth={4} />
                                                        </motion.div>
                                                    )}
                                                </motion.div>
                                            </div>

                                            {/* Labels */}
                                            <div className="mt-6 text-center w-32">
                                                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                                                    Step 0{idx + 1}
                                                </div>
                                                <div className={cn(
                                                    "text-xs font-medium transition-all duration-300 mb-1",
                                                    isActive ? "text-foreground" : isCompleted ? "text-muted-foreground" : "text-muted-foreground/70"
                                                )}>
                                                    {step.title}
                                                </div>
                                                <div className={cn(
                                                    "text-[10px] font-mono px-2 py-0.5 rounded-md border inline-block transition-colors",
                                                    isActive ? "bg-secondary text-foreground border-border" : "bg-transparent text-muted-foreground border-transparent"
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
                    <div className="h-48 bg-secondary border-t border-border flex flex-col relative z-20">
                        <div className="px-4 py-2 border-b border-border bg-background flex justify-between items-center">
                            <span className="text-muted-foreground font-mono text-xs flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 
                                Activity log
                            </span>
                        </div>
                        <div
                            ref={scrollContainerRef}
                            className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar font-mono text-xs bg-background"
                        >
                            <AnimatePresence>
                                {logs.map((log, i) => (
                                    <motion.div 
                                        key={`${executionId}-${i}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex gap-3 items-start text-muted-foreground border-l-2 border-transparent hover:border-border pl-2 transition-colors"
                                    >
                                        <span className="text-muted-foreground/50 shrink-0 select-none">
                                            {(i + 1).toString().padStart(3, '0')}
                                        </span>
                                        <span className={cn(
                                            "break-all",
                                            log.includes('EXEC') ? "text-primary" : 
                                            log.includes('COMPLETE') ? "text-emerald-700 font-medium" :
                                            log.includes('OK') ? "text-emerald-600/80" : "text-foreground"
                                        )}>
                                            {log}
                                        </span>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {logs.length === 0 && (
                                <div className="flex items-center gap-2 text-muted-foreground italic">
                                    <span className="w-2 h-4 bg-muted animate-pulse"></span>
                                    Waiting for activity…
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

    React.useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [industrySlug]);

    const data = industrySlug ? getIndustryBySlug(industrySlug) : undefined;

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <h1 className="text-2xl font-semibold text-foreground mb-4">Industry Not Found</h1>
                    <button onClick={() => navigate({ to: '/' })} className="text-muted-foreground hover:text-foreground font-medium transition-colors">Return to Home</button>
                </div>
            </div>
        );
    }

    return (
        <MarketingPageShell>
            <MarketingNavbar minimal />

            {/* Hero Section */}
            <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden border-b border-border">
                <div className="max-w-5xl mx-auto text-center">
                    <p className="landing-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-6">
                        {data.name}
                    </p>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="landing-display text-4xl lg:text-6xl font-semibold tracking-tight mb-8 text-foreground text-balance"
                    >
                        {data.hero.headline}
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="text-lg text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed"
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
                            className="landing-btn-primary px-8 py-3.5 rounded-full font-medium text-base transition flex items-center gap-2 group"
                        >
                            {data.hero.primaryCTA}
                            <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                        <button className="px-8 py-3.5 text-foreground border border-border rounded-full font-medium text-base transition flex items-center gap-2 group hover:bg-muted/30">
                            <PlayCircle size={18} className="text-muted-foreground" />
                            {data.hero.secondaryCTA}
                        </button>
                    </motion.div>
                </div>
            </section>

            {/* Pain Points Section */}
            <section id="challenges" className="py-24 px-4 sm:px-6 lg:px-8 border-b border-border">
                 <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="landing-display text-3xl sm:text-4xl font-semibold text-foreground mb-4">Common challenges we solve</h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            Transforming obstacles into opportunities for {data.name} leaders.
                        </p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border">
                        {data.painPoints.map((point, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="group bg-background p-8 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-sm border border-border flex items-center justify-center mb-6 text-muted-foreground">
                                    <point.icon size={20} />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground mb-2">{point.text}</h3>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    Our platform directly addresses this by streamlining operations and providing real-time visibility.
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Integrated solutions */}
            <section id="integrated-solutions" className="pt-28 pb-24 px-4 sm:px-6 lg:px-8 border-b border-border scroll-mt-24">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-12 sm:mb-16">
                        <h2 className="landing-display text-3xl sm:text-4xl font-semibold text-foreground mb-4">
                            Connected app ecosystem
                        </h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            See how each app links back to your Zopkit workspace.
                        </p>
                    </div>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="border border-border p-8 md:p-12 flex justify-center"
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
            <section id="workflows" className="py-24 px-4 sm:px-6 lg:px-8 border-b border-border">
                <IndustryWorkflowVisualizer workflows={data.workflows} industryName={data.name} />
            </section>

            {/* Final CTA Section */}
            <section className="py-24 px-4 sm:px-6 lg:px-8 border-b border-border">
                <div className="max-w-3xl mx-auto text-center px-4">
                    <h2 className="landing-display text-3xl md:text-4xl font-semibold mb-4 text-foreground tracking-tight">
                        {data.finalCTA.headline}
                    </h2>
                    <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-xl mx-auto">
                        {data.finalCTA.description}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                        <button
                            onClick={() => navigate({ to: '/onboarding' })}
                            className="landing-btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium text-base transition-colors group"
                        >
                            {data.finalCTA.primaryCTA}
                            <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                        {data.finalCTA.secondaryCTAs.map((cta, i) => (
                            <button
                                key={i}
                                className="px-6 py-3 text-foreground border border-border rounded-full font-medium text-base hover:bg-muted/30 transition-colors"
                            >
                                {cta}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <LandingFooter marketing />
        </MarketingPageShell>
    );
};

export default IndustryPage;