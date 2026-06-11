import React, { Suspense } from 'react'
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
      className="landing-section landing-section-muted border-border bg-background overflow-x-hidden border-b"
    >
      <div className="landing-section-inner pt-20 pb-10 sm:pt-24">
        <LandingSectionIntro
          eyebrow="Workflows"
          title="Workflows that do not stop at department walls"
          lead="Lead-to-cash, hire-to-retire, and procure-to-pay run as connected sequences. The demo below is the same engine your team would configure in production."
        />
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
