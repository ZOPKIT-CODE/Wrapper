import { useState, useEffect, useRef } from 'react'
import {
  Briefcase,
  CheckCircle2,
  Box,
  Truck,
  FileCheck,
  DollarSign,
  UserPlus,
  Users,
  Monitor,
  GraduationCap,
  CreditCard,
  ShoppingCart,
  Activity,
  Server,
  Database,
  ChevronRight,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { config } from '@/lib/config'

const workflows = [
  {
    id: 'lead-to-cash',
    title: 'Lead to Cash',
    description: 'Revenue cycle from prospect to payment.',
    steps: [
      {
        id: 'lead',
        title: 'Lead Captured',
        app: 'B2B CRM',
        icon: Briefcase,
        action: 'Syncing prospect data',
        status: 'Success',
      },
      {
        id: 'opp',
        title: 'Deal Closed',
        app: 'B2B CRM',
        icon: CheckCircle2,
        action: 'Updating pipeline status',
        status: 'Approved',
      },
      {
        id: 'order',
        title: 'Order Created',
        app: 'Operations',
        icon: Box,
        action: 'Generating order #',
        status: 'Created',
      },
      {
        id: 'fulfill',
        title: 'Inv. Reserved',
        app: 'Operations',
        icon: Truck,
        action: 'Allocating stock',
        status: 'Reserved',
      },
      {
        id: 'invoice',
        title: 'Invoice Sent',
        app: 'Finance',
        icon: FileCheck,
        action: 'Emailing invoice PDF',
        status: 'Sent',
      },
      {
        id: 'payment',
        title: 'Payment Rec.',
        app: 'Finance',
        icon: DollarSign,
        action: 'Processing transaction',
        status: 'Verified',
      },
    ],
  },
  {
    id: 'hire-to-retire',
    title: 'Hire to Retire',
    description: 'Employee lifecycle from offer to payroll.',
    steps: [
      {
        id: 'offer',
        title: 'Offer Signed',
        app: 'HRMS',
        icon: UserPlus,
        action: 'Verifying digital signature',
        status: 'Signed',
      },
      {
        id: 'onboard',
        title: 'Profile Created',
        app: 'HRMS',
        icon: Users,
        action: 'Creating employee record',
        status: 'Created',
      },
      {
        id: 'asset',
        title: 'Laptop Prov.',
        app: 'ITSM',
        icon: Monitor,
        action: 'Assigning hardware assets',
        status: 'Assigned',
      },
      {
        id: 'access',
        title: 'SSO Access',
        app: 'ITSM',
        icon: Server,
        action: 'Provisioning accounts',
        status: 'Active',
      },
      {
        id: 'training',
        title: 'LMS Enrollment',
        app: 'Academy',
        icon: GraduationCap,
        action: 'Assigning courses',
        status: 'Enrolled',
      },
      {
        id: 'payroll',
        title: 'Payroll Setup',
        app: 'Finance',
        icon: CreditCard,
        action: 'Configuring tax & salary',
        status: 'Ready',
      },
    ],
  },
  {
    id: 'procure-to-pay',
    title: 'Procure to Pay',
    description: 'Supply chain through vendor payment.',
    steps: [
      {
        id: 'req',
        title: 'Requisition',
        app: 'Operations',
        icon: FileCheck,
        action: 'Submitting purchase req',
        status: 'Pending',
      },
      {
        id: 'po',
        title: 'PO Issued',
        app: 'Operations',
        icon: ShoppingCart,
        action: 'Generating PO document',
        status: 'Issued',
      },
      {
        id: 'receive',
        title: 'Goods Receipt',
        app: 'Operations',
        icon: Truck,
        action: 'Verifying shipment',
        status: 'Received',
      },
      {
        id: 'bill',
        title: 'Bill Created',
        app: 'Finance',
        icon: FileCheck,
        action: 'Logging vendor invoice',
        status: ' logged',
      },
      {
        id: 'match',
        title: '3-Way Match',
        app: 'Finance',
        icon: Database,
        action: 'Validating PO vs Inv',
        status: 'Matched',
      },
      {
        id: 'pay',
        title: 'Vendor Paid',
        app: 'Finance',
        icon: DollarSign,
        action: 'Initiating transfer',
        status: 'Paid',
      },
    ],
  },
] as const

export const WorkflowVisualizer = ({
  hideIntro = false,
}: {
  hideIntro?: boolean
}) => {
  const [activeWorkflowIndex, setActiveWorkflowIndex] = useState(0)
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [executionId, setExecutionId] = useState('SYS-001')
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const minimal = hideIntro

  const activeWorkflow = workflows[activeWorkflowIndex]

  useEffect(() => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current
      scrollContainerRef.current.scrollTop = scrollHeight - clientHeight
    }
  }, [logs])

  const generateId = () => Math.floor(1000 + Math.random() * 9000)

  const logsRef = useRef(logs)
  logsRef.current = logs

  useEffect(() => {
    let stepTimer: ReturnType<typeof setTimeout>
    let nextFlowTimer: ReturnType<typeof setTimeout>

    if (activeStepIndex === 0 && logsRef.current.length === 0) {
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

      setLogs((prev) => {
        const newLogs = [
          ...prev,
          `[${timestamp}] STARTED: ${step.title} (${step.app})`,
          `[${timestamp}] ACTION: ${step.action}...`,
          `[${timestamp}] COMPLETED: Status '${step.status}' verified.`,
        ]
        return newLogs.length > 50 ? newLogs.slice(-50) : newLogs
      })

      if (activeStepIndex < activeWorkflow.steps.length - 1) {
        stepTimer = setTimeout(() => {
          setActiveStepIndex((prev) => prev + 1)
        }, 2000)
      } else {
        setLogs((prev) => [
          ...prev,
          `[${timestamp}] WORKFLOW COMPLETED SUCCESSFULLY.`,
        ])

        nextFlowTimer = setTimeout(() => {
          setLogs([])
          setActiveStepIndex(0)
          setActiveWorkflowIndex((prev) => (prev + 1) % workflows.length)
        }, 4000)
      }
    }

    const initialDelay = setTimeout(executeStep, 500)

    return () => {
      clearTimeout(stepTimer)
      clearTimeout(nextFlowTimer)
      clearTimeout(initialDelay)
    }
  }, [activeStepIndex, activeWorkflowIndex, activeWorkflow.steps])

  return (
    <div
      className={cn(
        'landing-workflow w-full pb-16 sm:pb-20',
        hideIntro
          ? 'landing-section-inner border-border border-t'
          : 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'
      )}
    >
      {!hideIntro && (
        <div className="mb-12 text-center sm:mb-16">
          <p className="landing-section-eyebrow mb-3">Workflow Engine</p>
          <h2 className="landing-display text-foreground text-2xl leading-[1.06] font-semibold text-balance sm:text-3xl lg:text-4xl">
            Intelligent Workflow
            <br className="hidden sm:block" /> Orchestration
          </h2>
          <p className="landing-lead mx-auto mt-4 max-w-xl text-base sm:text-lg">
            Connect apps, data, and teams in one flow across your Zopkit
            workspace.
          </p>
        </div>
      )}

      <div className="landing-workflow-demo border-border bg-background flex h-auto flex-col overflow-hidden rounded-lg border lg:h-[600px] lg:flex-row xl:h-[700px]">
        <div className="border-border bg-muted/30 flex w-full shrink-0 flex-col border-b lg:w-72 lg:border-r lg:border-b-0">
          <div className="border-border bg-background border-b p-4 sm:p-6">
            <div className="text-foreground mb-1 flex items-center gap-3">
              <img
                src={config.LOGO_URL}
                alt="Zopkit"
                className="border-border h-10 w-10 overflow-hidden rounded-lg border sm:h-12 sm:w-12 sm:rounded-xl"
              />
              <h3 className="landing-display text-sm font-semibold sm:text-base">
                Automation Hub
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="border-border bg-muted/50 flex items-center gap-1.5 rounded-full border px-2.5 py-1">
                <span className="bg-foreground/70 h-2 w-2 animate-pulse rounded-full" />
                <span className="landing-mono text-muted-foreground text-[11px] font-medium">
                  System Active
                </span>
              </div>
              <div className="landing-mono text-muted-foreground ml-auto text-[11px] font-medium">
                v3.1
              </div>
            </div>
          </div>

          <div className="no-scrollbar max-h-[120px] flex-1 space-y-1.5 overflow-x-auto overflow-y-auto p-2 sm:max-h-[200px] sm:space-y-3 sm:p-4 lg:max-h-none lg:overflow-x-hidden">
            {workflows.map((wf, idx) => {
              const isActive = activeWorkflowIndex === idx
              return (
                <button
                  key={wf.id}
                  type="button"
                  onClick={() => {
                    setActiveWorkflowIndex(idx)
                    setActiveStepIndex(0)
                    setLogs([])
                  }}
                  className={cn(
                    'group relative w-full overflow-hidden rounded-lg border p-3 text-left transition-all duration-300 sm:rounded-xl sm:p-4',
                    isActive
                      ? 'border-border bg-background shadow-sm'
                      : 'hover:border-border hover:bg-muted/40 border-transparent bg-transparent'
                  )}
                >
                  {isActive && (
                    <div
                      className={cn(
                        'absolute top-0 bottom-0 left-0 w-1',
                        minimal
                          ? 'bg-foreground/80'
                          : 'from-foreground/90 to-foreground/45 bg-gradient-to-b'
                      )}
                    />
                  )}
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className={cn(
                        'text-sm font-bold transition-colors',
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {wf.title}
                    </span>
                    {isActive && (
                      <Activity className="text-foreground h-4 w-4 animate-pulse" />
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed font-medium">
                    {wf.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="bg-background relative flex flex-1 flex-col overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--border)_60%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--border)_60%,transparent)_1px,transparent_1px)] bg-[size:40px_40px]" />

          <div className="border-border bg-background/90 relative z-10 flex h-12 shrink-0 items-center justify-between border-b px-3 sm:h-16 sm:px-8">
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
              <h2 className="landing-display text-foreground truncate text-sm font-semibold sm:text-xl">
                {activeWorkflow.title}
              </h2>
              <div className="landing-mono border-border bg-muted/40 text-muted-foreground hidden shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium sm:block">
                Workflow ID: {executionId}
              </div>
            </div>
            <div className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs font-medium sm:gap-2 sm:text-sm">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{(activeStepIndex * 0.5).toFixed(1)}s</span>
            </div>
          </div>

          <div className="relative flex flex-1 flex-col justify-center overflow-hidden px-2 sm:px-4 md:px-12">
            <div className="relative w-full">
              <div className="bg-muted absolute top-[18px] right-[8%] left-[8%] z-0 h-0.5 overflow-hidden rounded-full sm:top-6 sm:h-1 md:top-8 md:h-1.5 lg:top-10 lg:h-2">
                <div
                  className="h-full w-full opacity-30"
                  style={{
                    backgroundImage:
                      'linear-gradient(90deg, transparent 50%, color-mix(in srgb, var(--border) 80%, transparent) 50%)',
                    backgroundSize: '10px 100%',
                  }}
                />
              </div>

              <div
                className="bg-foreground absolute top-[18px] left-[8%] z-0 h-0.5 rounded-full transition-all duration-1000 ease-in-out sm:top-6 sm:h-1 md:top-8 md:h-1.5 lg:top-10 lg:h-2"
                style={{
                  width: `calc(${(activeStepIndex / (activeWorkflow.steps.length - 1)) * 100}% - clamp(2rem, 8vw, 4rem))`,
                  opacity: minimal ? 0.75 : 1,
                }}
              />

              <div className="relative z-10 grid grid-cols-6 gap-1 pb-2 sm:gap-2 md:gap-4 md:pb-0">
                {activeWorkflow.steps.map((step, idx) => {
                  const isActive = idx === activeStepIndex
                  const isCompleted = idx < activeStepIndex
                  const Icon = step.icon

                  return (
                    <div
                      key={step.id}
                      className="group relative flex flex-col items-center"
                    >
                      <div
                        className={cn(
                          'bg-background relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-500 sm:h-12 sm:w-12 md:h-16 md:w-16 lg:h-20 lg:w-20 lg:border-[3px]',
                          isActive
                            ? 'border-foreground/20 text-foreground ring-foreground/15 scale-105 ring-1 ring-offset-1 sm:scale-110 sm:ring-2 lg:ring-4 lg:ring-offset-2'
                            : isCompleted
                              ? 'border-foreground bg-foreground text-background scale-100'
                              : 'border-border text-muted-foreground/40'
                        )}
                      >
                        {isActive && (
                          <div className="bg-foreground/15 absolute inset-0 hidden animate-ping rounded-full lg:block" />
                        )}

                        <Icon
                          className={cn(
                            'h-3.5 w-3.5 transition-all duration-300 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-7 lg:w-7',
                            isActive && 'scale-110'
                          )}
                        />

                        {isCompleted && (
                          <div className="border-border bg-background text-foreground absolute -right-0.5 -bottom-0.5 rounded-full border p-0.5">
                            <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          </div>
                        )}
                      </div>

                      <div className="mt-1 w-full text-center sm:mt-2 md:mt-4">
                        <div className="text-muted-foreground mb-1 hidden text-[10px] font-bold tracking-wider uppercase lg:block">
                          Step 0{idx + 1}
                        </div>
                        <div
                          className={cn(
                            'truncate text-[7px] leading-tight font-bold transition-all duration-300 sm:text-[9px] md:text-xs lg:text-sm',
                            isActive
                              ? 'text-foreground'
                              : isCompleted
                                ? 'text-foreground/80'
                                : 'text-muted-foreground'
                          )}
                        >
                          {step.title}
                        </div>
                        <div className="border-border bg-muted/40 text-muted-foreground mt-0.5 hidden max-w-full truncate rounded-full border px-1 py-0.5 text-[7px] font-medium sm:inline-block sm:px-1.5 sm:text-[8px] md:text-[10px]">
                          {step.app}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="border-border bg-muted/30 relative z-20 flex h-28 shrink-0 flex-col border-t sm:h-36 md:h-44 md:flex-row lg:h-52">
            <div className="flex flex-1 flex-col overflow-hidden p-0 font-mono text-[10px] sm:text-xs">
              <div className="border-border bg-background flex items-center justify-between border-b px-3 py-2 sm:px-6 sm:py-3">
                <span className="text-foreground flex items-center gap-1.5 text-[11px] font-bold sm:gap-2 sm:text-xs">
                  <Activity className="text-foreground h-3.5 w-3.5 sm:h-4 sm:w-4" />{' '}
                  Activity
                </span>
                <div className="text-muted-foreground hidden gap-2 text-[10px] sm:flex">
                  <span>Real-time</span>
                </div>
              </div>

              <div
                ref={scrollContainerRef}
                className="custom-scrollbar bg-muted/20 flex-1 space-y-1.5 overflow-y-auto p-3 sm:space-y-2 sm:p-6"
              >
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className="animate-in fade-in slide-in-from-bottom-2 flex items-start gap-4 duration-300"
                  >
                    <span className="text-muted-foreground/50 shrink-0 font-medium select-none">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <div className="text-muted-foreground font-medium break-all">
                      {log.includes('STARTED') && (
                        <span className="flex items-center gap-2">
                          <span className="bg-foreground/70 h-1.5 w-1.5 rounded-full" />
                          {log}
                        </span>
                      )}
                      {log.includes('ACTION') && (
                        <span className="flex items-center gap-2 pl-4">
                          <ChevronRight className="text-muted-foreground h-3 w-3" />
                          {log}
                        </span>
                      )}
                      {log.includes('COMPLETED') && (
                        <span className="text-foreground flex items-center gap-2 pl-4">
                          <CheckCircle2 className="h-3 w-3" />
                          {log}
                        </span>
                      )}
                      {log.includes('SUCCESSFULLY') && (
                        <span className="border-border bg-muted/40 text-foreground mt-1 flex w-fit items-center gap-2 rounded border px-2 py-1 font-bold">
                          <CheckCircle2 className="h-3 w-3" />
                          {log}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="pt-1 pl-8">
                  <span className="bg-muted-foreground/30 block h-4 w-2 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
