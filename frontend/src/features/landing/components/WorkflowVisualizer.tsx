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

// Enhanced workflow definitions with business-friendly descriptions
const workflows = [
  {
    id: 'lead-to-cash',
    title: 'Lead to Cash',
    description: 'Automate your revenue cycle from prospect to payment.',
    color: 'blue',
    accent: 'from-[#1B2E5A] to-cyan-500',
    border: 'border-blue-200',
    text: 'text-[#1B2E5A]',
    bg: 'bg-[#1B2E5A]',
    lightBg: 'bg-blue-50',
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
    description: 'Streamline the entire employee lifecycle.',
    color: 'blue',
    accent: 'from-[#1B2E5A] to-blue-400',
    border: 'border-blue-200',
    text: 'text-[#1B2E5A]',
    bg: 'bg-[#1B2E5A]',
    lightBg: 'bg-blue-50',
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
    description: 'Optimize supply chain and vendor payments.',
    color: 'blue',
    accent: 'from-[#1B2E5A] to-blue-400',
    border: 'border-blue-200',
    text: 'text-[#1B2E5A]',
    bg: 'bg-[#1B2E5A]',
    lightBg: 'bg-blue-50',
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
]

// ── Design-system tokens (matches design file) ──────────────────────────────
const M = {
  bg: '#FFFFFF',
  bgSoft: '#F5F7FA',
  white: '#FFFFFF',
  ink: '#13204A',
  inkSoft: '#3A4674',
  muted: '#7C84A0',
  line: 'rgba(19,32,74,0.10)',
  green: '#4DC18A',
  blue: '#3D7AE8',
}

// ── Mobile workflow section (vertical timeline design) ───────────────────────
interface MobileWorkflowProps {
  workflows: typeof workflows
  activeWorkflowIndex: number
  activeStepIndex: number
  executionId: string
  logs: string[]
  onSelectWorkflow: (idx: number) => void
}

function MobileWorkflowSection({
  workflows: wfs,
  activeWorkflowIndex,
  activeStepIndex,
  executionId,
  logs,
  onSelectWorkflow,
}: MobileWorkflowProps) {
  const wf = wfs[activeWorkflowIndex]

  return (
    <div style={{ background: M.bg, padding: '28px 18px 40px' }}>
      {/* section eyebrow */}
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: M.muted,
          letterSpacing: '0.22em',
          textAlign: 'center',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        — Workflow Engine —
      </div>

      <h2
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif',
          fontWeight: 800,
          fontSize: 28,
          lineHeight: 1.1,
          color: M.ink,
          margin: 0,
          textAlign: 'center',
          letterSpacing: '-0.025em',
        }}
      >
        Intelligent Workflow
        <br />
        Orchestration
      </h2>

      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 13,
          color: M.inkSoft,
          margin: '10px 0 0',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        Automate complex business processes across your entire Zopkit ecosystem.
      </p>

      {/* card */}
      <div
        style={{
          marginTop: 20,
          background: M.white,
          border: `1px solid ${M.line}`,
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow:
            '0 1px 2px rgba(19,32,74,0.04), 0 18px 50px rgba(19,32,74,0.06)',
        }}
      >
        {/* Automation Hub header */}
        <div
          style={{
            padding: '18px 18px 16px',
            borderBottom: `1px solid ${M.line}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                overflow: 'hidden',
                border: `1px solid ${M.line}`,
                flexShrink: 0,
              }}
            >
              <img
                src="https://res.cloudinary.com/dr9vzaa7u/image/upload/v1765126845/Zopkit_Simple_Logo_glohfr.jpg"
                alt="Zopkit"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 700,
                  fontSize: 16,
                  color: M.ink,
                }}
              >
                Automation Hub
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(77,193,138,0.14)',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: '#2E9B6A',
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 99,
                      background: M.green,
                      display: 'inline-block',
                    }}
                  />
                  System Active
                </span>
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 10.5,
                    color: M.muted,
                  }}
                >
                  v3.1
                </span>
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              color: M.inkSoft,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14">
              <circle
                cx="7"
                cy="7"
                r="6"
                stroke={M.inkSoft}
                strokeWidth="1.2"
                fill="none"
              />
              <path
                d="M7 4v3.2l2 1.4"
                stroke={M.inkSoft}
                strokeWidth="1.2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            {(activeStepIndex * 0.5).toFixed(1)}s
          </div>
        </div>

        {/* workflow tabs (horizontal scroll) */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '14px 14px 4px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {wfs.map((w, idx) => {
            const isActive = activeWorkflowIndex === idx
            return (
              <button
                key={w.id}
                onClick={() => onSelectWorkflow(idx)}
                style={{
                  flex: '0 0 auto',
                  textAlign: 'left',
                  cursor: 'pointer',
                  padding: '12px 14px',
                  borderRadius: 12,
                  width: 200,
                  border: isActive
                    ? `1.5px solid ${M.ink}`
                    : `1px solid ${M.line}`,
                  background: isActive ? M.white : M.bgSoft,
                  boxShadow: isActive
                    ? '0 4px 14px rgba(19,32,74,0.08)'
                    : 'none',
                  outline: 'none',
                }}
              >
                <div
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: 13,
                    color: M.ink,
                  }}
                >
                  {w.title}
                </div>
                <div
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 11,
                    color: M.muted,
                    marginTop: 4,
                    lineHeight: 1.4,
                  }}
                >
                  {w.description}
                </div>
              </button>
            )
          })}
        </div>

        {/* vertical step timeline */}
        <div
          style={{
            margin: '14px 14px 0',
            padding: '16px 14px',
            background: M.bgSoft,
            border: `1px solid ${M.line}`,
            borderRadius: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 14,
                color: M.ink,
              }}
            >
              {wf.title}
            </span>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 999,
                background: M.bg,
                border: `1px solid ${M.line}`,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9.5,
                color: M.inkSoft,
              }}
            >
              ID: {executionId}
            </span>
          </div>

          {wf.steps.map((step, i) => {
            const isCompleted = i < activeStepIndex
            const isActiveStep = i === activeStepIndex
            const isPending = i > activeStepIndex
            const Icon = step.icon
            return (
              <div
                key={step.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '54px 1fr',
                  alignItems: 'flex-start',
                }}
              >
                {/* timeline rail + node */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 99,
                      position: 'relative',
                      zIndex: 1,
                      background: isCompleted ? M.ink : M.white,
                      border: isCompleted
                        ? `1.5px solid ${M.ink}`
                        : isActiveStep
                          ? `2px solid ${M.blue}`
                          : `1.5px solid ${M.line}`,
                      display: 'grid',
                      placeItems: 'center',
                      boxShadow: isActiveStep
                        ? `0 0 0 6px rgba(61,122,232,0.10)`
                        : 'none',
                      flex: '0 0 auto',
                    }}
                  >
                    <Icon
                      size={18}
                      color={
                        isCompleted ? '#fff' : isActiveStep ? M.ink : M.muted
                      }
                    />
                    {isCompleted && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: -2,
                          right: -2,
                          width: 14,
                          height: 14,
                          borderRadius: 99,
                          background: '#fff',
                          border: `1.5px solid ${M.green}`,
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8">
                          <path
                            d="M1.5 4l1.5 1.5L6.5 2"
                            stroke={M.green}
                            strokeWidth="1.3"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                  {i < wf.steps.length - 1 && (
                    <div
                      style={{
                        width: 2,
                        flex: 1,
                        minHeight: 26,
                        marginTop: 2,
                        background: isCompleted
                          ? M.ink
                          : isActiveStep
                            ? `linear-gradient(to bottom, ${M.blue}, ${M.line})`
                            : `repeating-linear-gradient(to bottom, ${M.line} 0 3px, transparent 3px 7px)`,
                      }}
                    />
                  )}
                </div>
                {/* step content */}
                <div
                  style={{ paddingLeft: 12, paddingTop: 6, paddingBottom: 18 }}
                >
                  <div
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 10,
                      color: M.muted,
                      letterSpacing: '0.1em',
                    }}
                  >
                    STEP {String(i + 1).padStart(2, '0')}
                  </div>
                  <div
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 700,
                      fontSize: 15,
                      color: isPending ? M.muted : M.ink,
                      marginTop: 2,
                    }}
                  >
                    {step.title}
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      marginTop: 6,
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: M.bg,
                      border: `1px solid ${M.line}`,
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 11,
                      color: M.inkSoft,
                      fontWeight: 500,
                    }}
                  >
                    {step.app}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* activity log */}
        <div
          style={{
            borderTop: `1px solid ${M.line}`,
            marginTop: 16,
            padding: '14px 18px 18px',
            background: M.bgSoft,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 14 14">
                <path
                  d="M1 7h2l1.5-3 2 6 1.5-3h5"
                  stroke={M.blue}
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 700,
                  fontSize: 13,
                  color: M.ink,
                }}
              >
                Activity
              </span>
            </div>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                color: M.muted,
              }}
            >
              Real-time
            </span>
          </div>
          <div style={{ borderTop: `1px solid ${M.line}`, paddingTop: 6 }}>
            {logs.slice(-6).map((log, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '24px 18px 1fr',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '5px 0',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10.5,
                  color: M.inkSoft,
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: M.muted }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ marginTop: 2 }}>
                  {log.includes('ACTION') && (
                    <span style={{ color: M.muted }}>›</span>
                  )}
                  {log.includes('COMPLETED') && (
                    <svg width="13" height="13" viewBox="0 0 14 14">
                      <circle
                        cx="7"
                        cy="7"
                        r="6"
                        stroke={M.green}
                        strokeWidth="1.3"
                        fill="none"
                      />
                      <path
                        d="M4.5 7.2l1.7 1.7L9.5 5.4"
                        stroke={M.green}
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  )}
                  {log.includes('STARTED') && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 7,
                        height: 7,
                        borderRadius: 99,
                        background: M.blue,
                      }}
                    />
                  )}
                  {log.includes('SUCCESSFULLY') && (
                    <svg width="13" height="13" viewBox="0 0 14 14">
                      <circle
                        cx="7"
                        cy="7"
                        r="6"
                        stroke={M.green}
                        strokeWidth="1.3"
                        fill="none"
                      />
                      <path
                        d="M4.5 7.2l1.7 1.7L9.5 5.4"
                        stroke={M.green}
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  )}
                </span>
                <span
                  style={{
                    color:
                      log.includes('COMPLETED') || log.includes('SUCCESSFULLY')
                        ? M.green
                        : log.includes('STARTED')
                          ? M.ink
                          : M.inkSoft,
                    wordBreak: 'break-word',
                  }}
                >
                  {log}
                </span>
              </div>
            ))}
            {logs.length === 0 && (
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10.5,
                  color: M.muted,
                  padding: '4px 0',
                }}
              >
                Waiting for workflow to start…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const WorkflowVisualizer = () => {
  const [activeWorkflowIndex, setActiveWorkflowIndex] = useState(0)
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [executionId, setExecutionId] = useState('SYS-001')
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout>
    const checkMobile = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => setIsMobile(window.innerWidth < 640), 150)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => {
      window.removeEventListener('resize', checkMobile)
      clearTimeout(resizeTimer)
    }
  }, [])

  const activeWorkflow = workflows[activeWorkflowIndex]

  // Auto-scroll logs logic
  useEffect(() => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current
      scrollContainerRef.current.scrollTop = scrollHeight - clientHeight
    }
  }, [logs])

  // Generate a random ID
  const generateId = () => Math.floor(1000 + Math.random() * 9000)

  const logsRef = useRef(logs)
  logsRef.current = logs

  // Workflow Cycle Logic
  useEffect(() => {
    let stepTimer: ReturnType<typeof setTimeout>
    let nextFlowTimer: ReturnType<typeof setTimeout>

    // New execution ID when starting a flow
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

      // Cap logs at 50 entries to prevent unbounded DOM growth
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
        }, 2000) // 2 second intervals
      } else {
        // Workflow complete
        setLogs((prev) => [
          ...prev,
          `[${timestamp}] WORKFLOW COMPLETED SUCCESSFULLY.`,
        ])

        nextFlowTimer = setTimeout(() => {
          setLogs([])
          setActiveStepIndex(0)
          setActiveWorkflowIndex((prev) => (prev + 1) % workflows.length)
        }, 4000) // Pause before next workflow
      }
    }

    const initialDelay = setTimeout(executeStep, 500)

    return () => {
      clearTimeout(stepTimer)
      clearTimeout(nextFlowTimer)
      clearTimeout(initialDelay)
    }
  }, [activeStepIndex, activeWorkflowIndex])

  if (isMobile) {
    return (
      <MobileWorkflowSection
        workflows={workflows}
        activeWorkflowIndex={activeWorkflowIndex}
        activeStepIndex={activeStepIndex}
        executionId={executionId}
        logs={logs}
        onSelectWorkflow={(idx) => {
          setActiveWorkflowIndex(idx)
          setActiveStepIndex(0)
          setLogs([])
        }}
      />
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-12 text-center sm:mb-16">
        <p className="mb-3 text-sm font-semibold tracking-wide text-slate-400">
          Workflow Engine
        </p>
        <h2 className="text-2xl leading-tight font-extrabold tracking-[-0.025em] text-[#1B2E5A] sm:text-3xl lg:text-4xl">
          Intelligent Workflow
          <br className="hidden sm:block" /> Orchestration
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
          Automate complex business processes across your entire Zopkit
          ecosystem. Connect apps, data, and teams seamlessly.
        </p>
      </div>

      <div className="flex h-auto flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:rounded-2xl sm:shadow-2xl lg:h-[600px] lg:flex-row xl:h-[700px]">
        {/* Sidebar / Control Panel */}
        <div className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-slate-50 lg:w-72 lg:border-r lg:border-b-0">
          <div className="border-b border-slate-200 bg-white p-4 sm:p-6">
            <div className="mb-1 flex items-center gap-3 text-slate-900">
              <img
                src={config.LOGO_URL}
                alt="Zopkit"
                className="h-10 w-10 overflow-hidden rounded-lg shadow-lg sm:h-12 sm:w-12 sm:rounded-xl"
              />
              <h3 className="text-sm font-bold tracking-tight sm:text-base">
                Automation Hub
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
                <span className="text-[11px] font-semibold text-emerald-700">
                  System Active
                </span>
              </div>
              <div className="ml-auto text-[11px] font-medium text-slate-400">
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
                  onClick={() => {
                    setActiveWorkflowIndex(idx)
                    setActiveStepIndex(0)
                    setLogs([])
                  }}
                  className={cn(
                    'group relative w-full overflow-hidden rounded-lg border p-3 text-left transition-all duration-300 sm:rounded-xl sm:p-4',
                    isActive
                      ? 'border-blue-200 bg-white shadow-lg shadow-blue-900/5'
                      : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-100'
                  )}
                >
                  {isActive && (
                    <div
                      className={cn(
                        'absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b',
                        wf.accent
                      )}
                    />
                  )}
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className={cn(
                        'text-sm font-bold transition-colors',
                        isActive ? 'text-slate-900' : 'text-slate-600'
                      )}
                    >
                      {wf.title}
                    </span>
                    {isActive && (
                      <Activity
                        className={cn('h-4 w-4 animate-pulse', wf.text)}
                      />
                    )}
                  </div>
                  <p className="text-xs leading-relaxed font-medium text-slate-500">
                    {wf.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Main Visualizer Stage */}
        <div className="relative flex flex-1 flex-col overflow-hidden bg-white">
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:40px_40px]"></div>

          {/* Header */}
          <div className="relative z-10 flex h-12 shrink-0 items-center justify-between border-b border-slate-100 bg-white/80 px-3 sm:h-16 sm:px-8">
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
              <h2 className="truncate text-sm font-bold text-[#1B2E5A] sm:text-xl">
                {activeWorkflow.title}
              </h2>
              <div className="hidden shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 sm:block">
                Workflow ID: {executionId}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 sm:gap-2 sm:text-sm">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{(activeStepIndex * 0.5).toFixed(1)}s</span>
            </div>
          </div>

          {/* Visualization Area */}
          <div className="relative flex flex-1 flex-col justify-center overflow-hidden px-2 sm:px-4 md:px-12">
            {/* Stepper Container */}
            <div className="relative w-full">
              {/* 1. Track Background */}
              <div className="absolute top-[18px] right-[8%] left-[8%] z-0 h-0.5 overflow-hidden rounded-full bg-slate-100 sm:top-6 sm:h-1 md:top-8 md:h-1.5 lg:top-10 lg:h-2">
                {/* Dashed pattern overlay */}
                <div
                  className="h-full w-full opacity-30"
                  style={{
                    backgroundImage:
                      'linear-gradient(90deg, transparent 50%, #cbd5e1 50%)',
                    backgroundSize: '10px 100%',
                  }}
                ></div>
              </div>

              {/* 2. Active Progress Line */}
              <div
                className="absolute top-[18px] left-[8%] z-0 h-0.5 rounded-full shadow-sm shadow-blue-200 transition-all duration-1000 ease-in-out sm:top-6 sm:h-1 md:top-8 md:h-1.5 lg:top-10 lg:h-2 lg:shadow-lg"
                style={{
                  width: `calc(${(activeStepIndex / (activeWorkflow.steps.length - 1)) * 100}% - ${isMobile ? '2rem' : '4rem'})`,
                  background: 'linear-gradient(to right, #1B2E5A, #3b82f6)',
                }}
              ></div>

              {/* 3. Steps Grid */}
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
                      {/* Node Circle */}
                      <div
                        className={cn(
                          'relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 bg-white transition-all duration-500 sm:h-12 sm:w-12 md:h-16 md:w-16 lg:h-20 lg:w-20 lg:border-[3px]',
                          isActive
                            ? 'scale-105 border-white shadow-md ring-1 ring-[#1B2E5A]/40 ring-offset-1 sm:scale-110 sm:shadow-lg sm:ring-2 lg:ring-4 lg:ring-offset-2'
                            : isCompleted
                              ? cn(
                                  'scale-100 border-white text-white shadow-sm sm:shadow-md',
                                  activeWorkflow.bg
                                )
                              : 'border-slate-100 text-slate-300 shadow-sm'
                        )}
                      >
                        {isActive && (
                          <div
                            className={cn(
                              'absolute inset-0 hidden animate-ping rounded-full opacity-20 lg:block',
                              activeWorkflow.bg
                            )}
                          ></div>
                        )}

                        <Icon
                          className={cn(
                            'h-3.5 w-3.5 transition-all duration-300 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-7 lg:w-7',
                            isActive && 'scale-110'
                          )}
                        />

                        {isCompleted && (
                          <div className="absolute -right-0.5 -bottom-0.5 rounded-full border border-slate-100 bg-white p-0.5 text-emerald-500 shadow">
                            <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          </div>
                        )}
                      </div>

                      {/* Text Labels */}
                      <div className="mt-1 w-full text-center sm:mt-2 md:mt-4">
                        <div className="mb-1 hidden text-[10px] font-bold tracking-wider text-slate-400 uppercase lg:block">
                          Step 0{idx + 1}
                        </div>
                        <div
                          className={cn(
                            'truncate text-[7px] leading-tight font-bold transition-all duration-300 sm:text-[9px] md:text-xs lg:text-sm',
                            isActive
                              ? 'text-slate-900'
                              : isCompleted
                                ? 'text-slate-700'
                                : 'text-slate-400'
                          )}
                        >
                          {step.title}
                        </div>
                        <div className="mt-0.5 hidden max-w-full truncate rounded-full border border-slate-100 bg-slate-50 px-1 py-0.5 text-[7px] font-medium text-slate-500 sm:inline-block sm:px-1.5 sm:text-[8px] md:text-[10px]">
                          {step.app}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Bottom Activity Panel */}
          <div className="relative z-20 flex h-28 shrink-0 flex-col border-t border-slate-200 bg-slate-50 sm:h-36 md:h-44 md:flex-row lg:h-52">
            {/* Live Logs */}
            <div className="flex flex-1 flex-col overflow-hidden p-0 font-mono text-[10px] sm:text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 bg-white px-3 py-2 sm:px-6 sm:py-3">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 sm:gap-2 sm:text-xs">
                  <Activity className="h-3.5 w-3.5 text-blue-500 sm:h-4 sm:w-4" />{' '}
                  Activity
                </span>
                <div className="hidden gap-2 text-[10px] text-slate-400 sm:flex">
                  <span>Real-time</span>
                </div>
              </div>

              <div
                ref={scrollContainerRef}
                className="custom-scrollbar flex-1 space-y-1.5 overflow-y-auto bg-slate-50 p-3 sm:space-y-2 sm:p-6"
              >
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className="animate-in fade-in slide-in-from-bottom-2 flex items-start gap-4 duration-300"
                  >
                    <span className="shrink-0 font-medium text-slate-300 select-none">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <div className="font-medium break-all text-slate-600">
                      {/* Simple log styling */}
                      {log.includes('STARTED') && (
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                          {log}
                        </span>
                      )}
                      {log.includes('ACTION') && (
                        <span className="flex items-center gap-2 pl-4">
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                          {log}
                        </span>
                      )}
                      {log.includes('COMPLETED') && (
                        <span className="flex items-center gap-2 pl-4 text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />
                          {log}
                        </span>
                      )}
                      {log.includes('SUCCESSFULLY') && (
                        <span className="mt-1 flex w-fit items-center gap-2 rounded border border-emerald-100 bg-emerald-50 px-2 py-1 font-bold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          {log}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {/* Blinking Cursor */}
                <div className="pt-1 pl-8">
                  <span className="block h-4 w-2 animate-pulse bg-slate-300"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
