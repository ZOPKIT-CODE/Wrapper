import React, { useState } from 'react'
import { Check, AlertCircle, ChevronRight } from 'lucide-react'
import { StepConfig } from '../config/flowConfigs'

interface StepIndicatorProps {
  stepsConfig: StepConfig[]
  currentStep: number
  getStepStatus: (
    stepNumber: number
  ) => 'completed' | 'active' | 'error' | 'upcoming'
  onStepClick?: (stepNumber: number) => void
  className?: string
  /** Deep blue sidebar: light text / frosted chips */
  darkSidebar?: boolean
  /** Real filled/total counts per step number derived from form values */
  fieldCounts?: Record<number, { current: number; total: number }>
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  stepsConfig,
  currentStep: _currentStep,
  getStepStatus,
  onStepClick,
  className = '',
  darkSidebar = false,
  fieldCounts,
}) => {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null)

  if (!stepsConfig || stepsConfig.length === 0) return null

  const getStepStats = (step: StepConfig, status: string) => {
    if (fieldCounts?.[step.number]) {
      return fieldCounts[step.number]
    }
    // Fallback: deterministic fake count
    const totalFields = 3 + (step.title.length % 3)
    let completedFields = 0
    if (status === 'completed') {
      completedFields = totalFields
    } else if (status === 'active' || status === 'error') {
      completedFields = Math.max(1, Math.floor(totalFields * 0.4))
    }
    return { current: completedFields, total: totalFields }
  }

  const hasError = stepsConfig.some((s) => getStepStatus(s.number) === 'error')

  return (
    <div
      className={`flex flex-col font-sans ${darkSidebar ? 'gap-2' : 'gap-1.5'} ${className}`}
    >
      {stepsConfig.map((step) => {
        const status = getStepStatus(step.number)
        const isActive = status === 'active'
        const isCompleted = status === 'completed'
        const isError = status === 'error'
        const isUpcoming = status === 'upcoming'

        // Allow clicking if completed, active, or error
        const isClickable = onStepClick && (isCompleted || isActive || isError)
        const isHovered = hoveredStep === step.number

        const { current, total } = getStepStats(step, status)
        const progressPercent = (current / total) * 100

        let styles = {
          card: darkSidebar
            ? 'border-white/[0.14] bg-card/[0.08] opacity-95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] backdrop-blur-sm'
            : 'border-border/80 bg-card/70 opacity-80',
          iconBg: darkSidebar
            ? 'border border-white/30 bg-card/[0.12] text-blue-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18)]'
            : 'border border-border bg-card text-muted-foreground',
          title: darkSidebar ? 'text-white' : 'text-muted-foreground',
          subtext: darkSidebar ? 'text-blue-100/55' : 'text-muted-foreground',
          barBg: darkSidebar ? 'bg-card/15' : 'bg-muted',
          barFill: darkSidebar ? 'bg-card/45' : 'bg-border',
          shadow: '',
        }

        if (isCompleted) {
          styles = darkSidebar
            ? {
                card: 'border-white/25 bg-gradient-to-br from-white/[0.16] to-white/[0.06] hover:from-white/[0.2] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]',
                iconBg:
                  'border-0 bg-card text-blue-950 shadow-md shadow-black/25',
                title: 'text-white',
                subtext: 'text-blue-100/75',
                barBg: 'bg-card/25',
                barFill: 'bg-card',
                shadow: '',
              }
            : {
                card: 'border-blue-100 bg-card hover:bg-primary/5/50',
                iconBg: 'border-0 bg-blue-950 text-white',
                title: 'text-blue-950',
                subtext: 'text-muted-foreground',
                barBg: 'bg-blue-100',
                barFill: 'bg-blue-700',
                shadow: '',
              }
        } else if (isError) {
          styles = darkSidebar
            ? {
                card: 'border-red-400/40 bg-red-950/40',
                iconBg: 'border-0 bg-red-500 text-white',
                title: 'text-red-100',
                subtext: 'text-red-200/90',
                barBg: 'bg-red-950/50',
                barFill: 'bg-red-400',
                shadow: '',
              }
            : {
                card: 'border-red-200 bg-red-50/80',
                iconBg: 'border-0 bg-red-600 text-white',
                title: 'text-red-900',
                subtext: 'text-red-700',
                barBg: 'bg-red-100',
                barFill: 'bg-red-600',
                shadow: '',
              }
        } else if (isActive) {
          styles = darkSidebar
            ? {
                card: 'border-white/35 bg-gradient-to-br from-white/20 via-white/[0.12] to-blue-950/50 shadow-[0_8px_28px_-6px_rgba(0,0,0,0.45)] ring-1 ring-white/30',
                iconBg:
                  'border-0 bg-card text-blue-950 shadow-md shadow-black/25',
                title: 'text-white',
                subtext: 'text-blue-100/80',
                barBg: 'bg-card/25',
                barFill: 'bg-gradient-to-r from-white to-blue-100',
                shadow: '',
              }
            : {
                card: 'border-blue-200 bg-card shadow-sm ring-1 ring-blue-100/60',
                iconBg: 'border-0 bg-blue-950 text-white',
                title: 'text-blue-950',
                subtext: 'text-muted-foreground',
                barBg: 'bg-blue-100',
                barFill: 'bg-blue-800',
                shadow: '',
              }
        } else if (isUpcoming) {
          styles.card = darkSidebar
            ? 'border-white/[0.08] bg-blue-950/50 opacity-75 hover:border-white/15 hover:opacity-100'
            : 'border-border bg-muted/50 opacity-75 hover:opacity-100'
        }

        return (
          <div
            key={step.id}
            onClick={() => isClickable && onStepClick?.(step.number)}
            onMouseEnter={() => setHoveredStep(step.number)}
            onMouseLeave={() => setHoveredStep(null)}
            className={`relative flex items-center gap-3 border p-2.5 transition-all duration-200 ease-out ${darkSidebar ? 'rounded-xl' : 'rounded-lg'} ${styles.card} ${styles.shadow} ${isClickable ? 'cursor-pointer' : 'cursor-default'} `}
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center text-xs font-semibold tabular-nums ${darkSidebar ? 'rounded-lg' : 'rounded-md'} ${styles.iconBg} `}
            >
              {isCompleted ? (
                <Check className="h-4 w-4" strokeWidth={2.5} />
              ) : isError ? (
                <AlertCircle className="h-4 w-4" strokeWidth={2.5} />
              ) : (
                <span>{step.number}</span>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <h4
                  className={`truncate text-[11px] font-semibold tracking-wide uppercase ${styles.title}`}
                >
                  {step.title}
                </h4>
                {isCompleted && (
                  <Check
                    className={`h-3 w-3 shrink-0 ${darkSidebar ? 'text-white' : 'text-primary'}`}
                    strokeWidth={2.5}
                  />
                )}
                {isError && (
                  <AlertCircle
                    className={`h-3 w-3 shrink-0 ${darkSidebar ? 'text-red-300' : 'text-red-600'}`}
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-medium tabular-nums ${styles.subtext}`}
                >
                  {current}/{total} fields
                </span>
                <div
                  className={`h-1 max-w-[72px] flex-1 overflow-hidden rounded-full ${styles.barBg} shadow-inner`}
                >
                  <div
                    className={`h-full rounded-full ${styles.barFill}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* RIGHT ARROW */}
            {isClickable && (
              <div className="pl-1">
                <ChevronRight
                  className={`h-4 w-4 ${isHovered ? 'translate-x-0.5 opacity-100' : 'opacity-40'} ${styles.title} `}
                />
              </div>
            )}

            {/* Active Indicator Line (Left Edge) */}
            {isActive && (
              <div
                className={`absolute top-2 bottom-2 left-0 w-0.5 rounded-full ${darkSidebar ? 'bg-card' : 'bg-blue-800'}`}
              />
            )}
          </div>
        )
      })}

      {/* ERROR BANNER - Matches the reference image's "Please fix errors" block */}
      {hasError && (
        <div
          className={`mx-1 mt-2 flex items-center gap-3 rounded-lg border p-3 ${
            darkSidebar
              ? 'border-red-400/35 bg-red-950/50'
              : 'border-red-200 bg-red-50/90'
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
              darkSidebar
                ? 'border-red-400/30 bg-red-950/60'
                : 'bg-card border-red-100'
            }`}
          >
            <AlertCircle
              className={`h-4 w-4 ${darkSidebar ? 'text-red-300' : 'text-red-600'}`}
            />
          </div>
          <div>
            <p
              className={`text-xs font-semibold ${darkSidebar ? 'text-red-100' : 'text-red-900'}`}
            >
              Action required
            </p>
            <p
              className={`text-[10px] font-medium ${darkSidebar ? 'text-red-200/90' : 'text-red-700'}`}
            >
              Resolve the highlighted fields to continue.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
