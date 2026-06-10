import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  PlayCircle,
  Check,
  Zap,
  Package,
  DollarSign,
  Gift,
  Users,
  Activity,
  Clock,
  Briefcase,
  Award,
  Workflow,
  GraduationCap,
  Server,
} from 'lucide-react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { getIndustryBySlug } from '@/data/industryPages'
import {
  OrbitalEcosystem,
  WORKFLOW_ORBIT_APP_IDS,
} from '@/features/landing/components/OrbitalEcosystem'
import { cn } from '@/lib/utils'
import { LandingFooter } from '@/components/layout/LandingFooter'
import { MarketingNavbar } from '@/components/layout/MarketingNavbar'

// --- Visualization Components ---

interface IndustryWorkflowVisualizerProps {
  workflows: Array<{
    title: string
    description: string
    steps: Array<{
      title: string
      app: string
      description: string
    }>
  }>
  industryName: string
}

const IndustryWorkflowVisualizer: React.FC<IndustryWorkflowVisualizerProps> = ({
  workflows,
  industryName,
}) => {
  const [activeWorkflowIndex, setActiveWorkflowIndex] = useState(0)
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [executionId, setExecutionId] = useState('SYS-001')
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Map workflow steps to visualizer format with icons and colors
  const workflowColors = [
    {
      color: 'orange',
      accent: 'from-orange-500 to-amber-500',
      border: 'border-orange-500',
      text: 'text-orange-400',
      bg: 'bg-orange-500/10',
      glow: 'shadow-orange-500/50',
    },
    {
      color: 'purple',
      accent: 'from-purple-600 to-pink-500',
      border: 'border-purple-500',
      text: 'text-purple-400',
      bg: 'bg-purple-500/10',
      glow: 'shadow-purple-500/50',
    },
    {
      color: 'blue',
      accent: 'from-blue-600 to-cyan-500',
      border: 'border-blue-500',
      text: 'text-blue-400',
      bg: 'bg-blue-500/10',
      glow: 'shadow-blue-500/50',
    },
    {
      color: 'emerald',
      accent: 'from-emerald-600 to-teal-500',
      border: 'border-emerald-500',
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      glow: 'shadow-emerald-500/50',
    },
  ]

  const getAppIcon = (appName: string) => {
    const iconMap: { [key: string]: any } = {
      'Operations Management': Package,
      'Financial Accounting': DollarSign,
      'Affiliate Connect': Gift,
      'B2B CRM': Users,
      'Project Management': Briefcase,
      HRMS: Users,
      'ESOP System': Award,
      Flowtilla: Workflow,
      'Zopkit Academy': GraduationCap,
      'Zopkit ITSM': Server,
    }
    return iconMap[appName] || Activity
  }

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
  }))

  const activeWorkflow = visualizerWorkflows[activeWorkflowIndex]

  useEffect(() => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current
      scrollContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: 'smooth',
      })
    }
  }, [logs])

  const generateId = () => Math.floor(1000 + Math.random() * 9000)

  useEffect(() => {
    let stepTimer: ReturnType<typeof setTimeout>
    let nextFlowTimer: ReturnType<typeof setTimeout>

    if (activeStepIndex === 0 && logs.length === 0) {
      setExecutionId(`SYS-${generateId()}`)
    }

    const executeStep = () => {
      const step = activeWorkflow.steps[activeStepIndex]
      const now = new Date()
      const timestamp = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })

      setLogs((prev) => [
        ...prev,
        `[${timestamp}] EXEC: ${step.title}`,
        `[${timestamp}] > ${step.app} :: ${step.action}`,
        `[${timestamp}] OK.`,
      ])

      if (activeStepIndex < activeWorkflow.steps.length - 1) {
        stepTimer = setTimeout(() => {
          setActiveStepIndex((prev) => prev + 1)
        }, 2500) // Slightly longer for better visual
      } else {
        setLogs((prev) => [
          ...prev,
          `[${timestamp}] WORKFLOW_COMPLETE: ${executionId}`,
        ])

        nextFlowTimer = setTimeout(() => {
          setLogs([])
          setActiveStepIndex(0)
          setActiveWorkflowIndex(
            (prev) => (prev + 1) % visualizerWorkflows.length
          )
        }, 4000)
      }
    }

    const initialDelay = setTimeout(executeStep, 500)

    return () => {
      clearTimeout(stepTimer)
      clearTimeout(nextFlowTimer)
      clearTimeout(initialDelay)
    }
  }, [activeStepIndex, activeWorkflowIndex])

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold tracking-wider text-slate-600 uppercase"
        >
          <Workflow size={14} />
          Live Demonstration
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mb-4 text-4xl font-bold tracking-tight text-[#1B2E5A] md:text-5xl"
        >
          Intelligent Workflow Automation
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-500"
        >
          Watch how our system orchestrates complex {industryName.toLowerCase()}{' '}
          processes in real-time.
        </motion.p>
      </div>

      <div className="flex h-auto flex-col overflow-hidden rounded-2xl bg-slate-950 shadow-2xl ring-1 ring-slate-800/60 lg:h-[650px] lg:flex-row">
        {/* Sidebar */}
        <div className="flex w-full shrink-0 flex-col border-b border-slate-800 bg-slate-900/50 lg:w-80 lg:border-r lg:border-b-0">
          <div className="border-b border-slate-800 p-6">
            <div className="mb-1 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 font-bold text-white shadow-lg shadow-blue-900/20">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold tracking-tight text-slate-100">
                Orchestrator
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
                <span className="text-[10px] font-semibold tracking-wider text-emerald-400 uppercase">
                  Online
                </span>
              </div>
              <div className="ml-auto font-mono text-[10px] text-slate-500">
                V.4.2.0
              </div>
            </div>
          </div>

          <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto p-3">
            {visualizerWorkflows.map((wf, idx) => {
              const isActive = activeWorkflowIndex === idx
              return (
                <button
                  key={wf.id}
                  onClick={() => {
                    setActiveWorkflowIndex(idx)
                    setActiveStepIndex(0)
                    setLogs([])
                  }}
                  className={cn(
                    'group relative w-full overflow-hidden rounded-lg border p-3.5 text-left transition-all duration-300',
                    isActive
                      ? 'border-slate-700 bg-slate-800'
                      : 'border-transparent bg-transparent hover:border-slate-800 hover:bg-slate-800/50'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className={cn(
                        'absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b',
                        wf.accent
                      )}
                    />
                  )}
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        'text-sm font-semibold transition-colors',
                        isActive
                          ? 'text-slate-100'
                          : 'text-slate-400 group-hover:text-slate-300'
                      )}
                    >
                      {wf.title}
                    </span>
                    {isActive && (
                      <Activity
                        className={cn('h-3.5 w-3.5 animate-pulse', wf.text)}
                      />
                    )}
                  </div>
                  <p className="line-clamp-2 text-[11px] leading-relaxed font-medium text-slate-500">
                    {wf.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Main Visualizer Stage */}
        <div className="relative flex flex-1 flex-col overflow-hidden bg-slate-950">
          {/* Background Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:32px_32px] opacity-20"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>

          {/* Header */}
          <div className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/50 px-6 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    activeWorkflow.text.replace('text-', 'bg-')
                  )}
                ></span>
                {activeWorkflow.title}
              </h2>
              <div className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-500">
                ID: {executionId}
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs font-medium text-slate-500">
              <Clock className="h-3 w-3" />
              <span>T+{(activeStepIndex * 2.1).toFixed(2)}s</span>
            </div>
          </div>

          {/* Visualization Area */}
          <div className="relative flex flex-1 flex-col justify-center overflow-hidden px-4 py-8 md:px-12">
            <div className="relative mx-auto w-full max-w-4xl">
              {/* Connecting Line Base */}
              <div className="absolute top-12 right-0 left-0 z-0 h-0.5 rounded-full bg-slate-800" />

              {/* Active Progress Line */}
              <motion.div
                className={cn(
                  'absolute top-12 left-0 z-0 h-0.5 shadow-[0_0_12px_rgba(255,255,255,0.5)]',
                  activeWorkflow.bg.replace('/10', '')
                )}
                animate={{
                  width: `${(activeStepIndex / (activeWorkflow.steps.length - 1)) * 100}%`,
                }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              />

              {/* Data Packet moving between nodes */}
              <AnimatePresence>
                {activeStepIndex < activeWorkflow.steps.length - 1 && (
                  <motion.div
                    key={`packet-${activeStepIndex}`}
                    className={cn(
                      'absolute top-12 z-10 -mt-1.5 h-3 w-3 rounded-full shadow-[0_0_10px_currentColor]',
                      activeWorkflow.text.replace('text-', 'bg-')
                    )}
                    initial={{
                      left: `${(activeStepIndex / (activeWorkflow.steps.length - 1)) * 100}%`,
                      opacity: 0,
                    }}
                    animate={{
                      left: `${((activeStepIndex + 1) / (activeWorkflow.steps.length - 1)) * 100}%`,
                      opacity: [0, 1, 1, 0],
                    }}
                    transition={{
                      duration: 2.5,
                      ease: 'linear',
                      times: [0, 0.1, 0.9, 1],
                    }}
                  />
                )}
              </AnimatePresence>

              <div className="relative z-10 flex items-start justify-between">
                {activeWorkflow.steps.map((step, idx) => {
                  const isActive = idx === activeStepIndex
                  const isCompleted = idx < activeStepIndex
                  const Icon = step.icon

                  return (
                    <div
                      key={step.id}
                      className="group relative flex w-24 flex-col items-center"
                    >
                      {/* Node Circle */}
                      <div className="relative">
                        <motion.div
                          className={cn(
                            'relative z-20 flex h-24 w-24 items-center justify-center rounded-full border-2 bg-slate-900 transition-all duration-300',
                            isActive
                              ? cn(
                                  'scale-110 border-transparent shadow-2xl',
                                  activeWorkflow.glow
                                )
                              : isCompleted
                                ? cn(
                                    'scale-100 border-slate-700 text-emerald-400'
                                  )
                                : 'border-slate-800 text-slate-600'
                          )}
                          animate={isActive ? { scale: [1.1, 1.15, 1.1] } : {}}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          {/* Active Glow Ring */}
                          {isActive && (
                            <>
                              <div
                                className={cn(
                                  'animate-spin-slow absolute inset-0 rounded-full border-2 border-dashed opacity-50',
                                  activeWorkflow.border
                                )}
                              ></div>
                              <div
                                className={cn(
                                  'absolute -inset-4 animate-ping rounded-full opacity-20',
                                  activeWorkflow.text.replace('text-', 'bg-')
                                )}
                              ></div>
                            </>
                          )}

                          <Icon
                            className={cn(
                              'h-8 w-8 transition-all duration-300',
                              isActive && activeWorkflow.text
                            )}
                          />

                          {isCompleted && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -right-1 -bottom-1 rounded-full border border-slate-900 bg-emerald-500 p-1 text-slate-950 shadow-lg"
                            >
                              <Check className="h-3 w-3" strokeWidth={4} />
                            </motion.div>
                          )}
                        </motion.div>
                      </div>

                      {/* Labels */}
                      <div className="mt-6 w-32 text-center">
                        <div className="mb-1 text-[10px] font-bold tracking-wider text-slate-600 uppercase">
                          Step 0{idx + 1}
                        </div>
                        <div
                          className={cn(
                            'mb-1 text-xs font-bold transition-all duration-300',
                            isActive
                              ? 'text-slate-100'
                              : isCompleted
                                ? 'text-slate-400'
                                : 'text-slate-600'
                          )}
                        >
                          {step.title}
                        </div>
                        <div
                          className={cn(
                            'inline-block rounded border px-2 py-0.5 font-mono text-[10px] transition-colors',
                            isActive
                              ? 'border-slate-700 bg-slate-800 text-slate-300'
                              : 'border-transparent bg-transparent text-slate-700'
                          )}
                        >
                          {step.app}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Bottom Console Panel */}
          <div className="relative z-20 flex h-48 flex-col border-t border-slate-800 bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-4 py-2">
              <span className="flex items-center gap-2 font-mono text-xs text-slate-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
                System Logs
              </span>
              <div className="flex gap-2">
                <span className="h-3 w-3 rounded-full border border-red-500/50 bg-red-500/20"></span>
                <span className="h-3 w-3 rounded-full border border-yellow-500/50 bg-yellow-500/20"></span>
                <span className="h-3 w-3 rounded-full border border-green-500/50 bg-green-500/20"></span>
              </div>
            </div>
            <div
              ref={scrollContainerRef}
              className="custom-scrollbar flex-1 space-y-1.5 overflow-y-auto bg-black/20 p-4 font-mono text-xs"
            >
              <AnimatePresence>
                {logs.map((log, i) => (
                  <motion.div
                    key={`${executionId}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-3 border-l-2 border-transparent pl-2 text-slate-400 transition-colors hover:border-slate-700"
                  >
                    <span className="shrink-0 text-slate-600 opacity-50 select-none">
                      {(i + 1).toString().padStart(3, '0')}
                    </span>
                    <span
                      className={cn(
                        'break-all',
                        log.includes('EXEC')
                          ? 'text-blue-400'
                          : log.includes('COMPLETE')
                            ? 'font-bold text-emerald-400'
                            : log.includes('OK')
                              ? 'text-emerald-500/70'
                              : 'text-slate-300'
                      )}
                    >
                      {log}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {logs.length === 0 && (
                <div className="flex items-center gap-2 text-slate-700 italic">
                  <span className="h-4 w-2 animate-pulse bg-slate-700"></span>
                  Waiting for execution stream...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Main Page Component ---

const IndustryPage: React.FC = () => {
  const { industrySlug } = useParams({ strict: false })
  const navigate = useNavigate()
  const { scrollY } = useScroll()
  const backgroundY = useTransform(scrollY, [0, 500], [0, 150])

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [industrySlug])

  const data = industrySlug ? getIndustryBySlug(industrySlug) : undefined

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-[#1B2E5A]">
            Industry Not Found
          </h1>
          <button
            onClick={() => navigate({ to: '/' })}
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full bg-white font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(71, 85, 105, 0.3); border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(71, 85, 105, 0.5); }
            `}</style>

      <MarketingNavbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 pt-32 pb-24 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-20 bg-slate-50"></div>
        <motion.div
          style={{ y: backgroundY }}
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] bg-[size:24px_24px]"
        ></motion.div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-xs font-bold tracking-wider text-blue-700 uppercase shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
            </span>
            {data.name} Solutions
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8 bg-gradient-to-r from-[#1B2E5A] via-[#2D4A7B] to-[#4A6FA5] bg-clip-text text-5xl font-extrabold tracking-tight text-[#1B2E5A] text-transparent lg:text-7xl"
          >
            {data.hero.headline}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mb-10 max-w-3xl text-xl leading-relaxed text-slate-600"
          >
            {data.hero.subheadline}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <button
              onClick={() => navigate({ to: '/onboarding' })}
              className="group flex items-center gap-2 rounded-xl bg-[#1B2E5A] px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-blue-600/20 transition hover:-translate-y-1 hover:bg-[#162447] hover:shadow-blue-600/40"
            >
              {data.hero.primaryCTA}{' '}
              <ArrowRight
                size={20}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>
            <button className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-8 py-4 text-lg font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md">
              <PlayCircle
                size={20}
                className="text-slate-400 transition-colors group-hover:text-blue-500"
              />{' '}
              {data.hero.secondaryCTA}
            </button>
          </motion.div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section
        id="challenges"
        className="relative bg-white px-4 py-24 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-[#1B2E5A]">
              Common Challenges We Solve
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-slate-600">
              Transforming obstacles into opportunities for {data.name} leaders.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.painPoints.map((point, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[#162447] hover:bg-[#1B2E5A] hover:shadow-xl hover:shadow-[#0f172a]/25"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 transition-colors group-hover:bg-white/15">
                  <point.icon
                    size={24}
                    className="text-blue-600 transition-colors group-hover:text-white"
                  />
                </div>
                <h3 className="mb-2 text-lg font-bold text-[#1B2E5A] transition-colors group-hover:text-white">
                  {point.text}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500 transition-colors group-hover:text-slate-200">
                  Our platform directly addresses this by streamlining
                  operations and providing real-time visibility.
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrated solutions — orbital ecosystem (same interactive as home page) */}
      <section
        id="integrated-solutions"
        className="scroll-mt-24 border-y border-slate-200 bg-slate-50 px-4 pt-28 pb-24 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center sm:mb-16">
            <h2 className="mb-4 text-4xl font-bold text-[#1B2E5A]">
              Integrated Solutions Ecosystem
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-slate-600">
              Explore how every app connects around the Zopkit hub — tap the
              orbit to see dependencies, matching the home page experience.
            </p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex justify-center rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40 md:p-12"
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
      <section
        id="workflows"
        className="bg-slate-100 px-4 py-24 sm:px-6 lg:px-8"
      >
        <IndustryWorkflowVisualizer
          workflows={data.workflows}
          industryName={data.name}
        />
      </section>

      {/* Final CTA Section */}
      <section className="relative overflow-hidden bg-slate-900 px-4 py-24 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 left-1/2 h-full w-full max-w-4xl -translate-x-1/2 bg-blue-500/10 blur-[120px]"
        ></motion.div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-4xl font-bold tracking-tight text-white md:text-5xl">
            {data.finalCTA.headline}
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-xl leading-relaxed text-slate-400">
            {data.finalCTA.description}
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={() => navigate({ to: '/onboarding' })}
              className="group flex items-center gap-2 rounded-full bg-[#1B2E5A] px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:-translate-y-1 hover:bg-[#162447]"
            >
              {data.finalCTA.primaryCTA}{' '}
              <ArrowRight
                size={20}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>
            {data.finalCTA.secondaryCTAs.map((cta, i) => (
              <button
                key={i}
                className="rounded-full border border-slate-700 bg-slate-800 px-8 py-4 font-medium text-slate-200 transition hover:bg-slate-700"
              >
                {cta}
              </button>
            ))}
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}

export default IndustryPage
