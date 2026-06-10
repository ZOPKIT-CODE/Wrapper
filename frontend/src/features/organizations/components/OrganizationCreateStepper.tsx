import { Fragment } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export const ORGANIZATION_CREATE_STEPS = [
  { title: 'Basic Information', description: 'Name and type' },
  { title: 'Location & Currency', description: 'Country, currency, and fiscal year' },
  { title: 'Legal & Compliance', description: 'Tax ID and registration details' },
  { title: 'Contact & Additional', description: 'Contact details and notes' },
] as const

export type OrganizationCreateStepMeta = (typeof ORGANIZATION_CREATE_STEPS)[number]

/** Segment `i` connects step `i` and step `i + 1`. Filled when the user has moved past step `i`. */
function segmentProgress(currentStep: number, segmentIndex: number): boolean {
  return currentStep > segmentIndex
}

export function OrganizationCreateStepper({
  currentStep,
  className,
}: {
  currentStep: number
  className?: string
}) {
  const n = ORGANIZATION_CREATE_STEPS.length

  return (
    <div className={cn('w-full space-y-3 pt-1', className)}>
      {/* Circles + connecting path (aligned on one row) */}
      <div className="flex w-full items-center">
        {ORGANIZATION_CREATE_STEPS.map((step, index) => (
          <Fragment key={step.title}>
            <div className="flex shrink-0 flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  index === currentStep
                    ? 'bg-primary text-white shadow-sm'
                    : index < currentStep
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-500',
                )}
              >
                {index < currentStep ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
              </div>
            </div>
            {index < n - 1 && (
              <div
                className="relative mx-1.5 min-h-[2rem] min-w-0 flex-1 self-center px-0.5"
                aria-hidden
              >
                {/* Track */}
                <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-slate-200" />
                {/* Filled path — deep blue when this segment is completed */}
                <div
                  className={cn(
                    'absolute left-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-primary transition-[width] duration-300 ease-out',
                    segmentProgress(currentStep, index) ? 'w-full' : 'w-0',
                  )}
                />
              </div>
            )}
          </Fragment>
        ))}
      </div>

      {/* Step labels */}
      <div className="grid grid-cols-4 gap-2">
        {ORGANIZATION_CREATE_STEPS.map((step, index) => (
          <span
            key={step.title}
            className={cn(
              'text-center text-[11px] leading-tight sm:text-xs',
              index === currentStep
                ? 'font-medium text-primary'
                : index < currentStep
                  ? 'text-primary/90'
                  : 'text-slate-400',
            )}
          >
            {step.title}
          </span>
        ))}
      </div>
    </div>
  )
}
