import React, { Suspense } from 'react'
import { LandingScrollReveal } from '@/features/landing/components/LandingScrollReveal'
import { LandingSectionIntro } from '@/features/landing/components/LandingSectionIntro'

const WorkflowVisualizer = React.lazy(() =>
  import('@/features/landing/components/WorkflowVisualizer').then((m) => ({
    default: m.WorkflowVisualizer,
  }))
)

export function LandingWorkflowBlock() {
  return (
    <section
      id="workflows"
      className="landing-section landing-section-muted border-border overflow-x-hidden border-b py-20 sm:py-24"
    >
      <div className="landing-section-inner pb-10 sm:pb-12">
        <LandingScrollReveal>
          <LandingSectionIntro
            eyebrow="Workflows"
            title="Workflows that do not stop at department walls"
            lead="Lead-to-cash, hire-to-retire, and procure-to-pay run as connected sequences. The demo below is the same engine your team would configure in production."
            animate={false}
          />
        </LandingScrollReveal>
      </div>

      <Suspense
        fallback={
          <div className="landing-section-inner border-border min-h-[380px] border-t pb-16 sm:pb-20" />
        }
      >
        <WorkflowVisualizer hideIntro />
      </Suspense>
    </section>
  )
}
