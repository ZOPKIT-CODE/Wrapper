import React, { Suspense } from 'react';



const WorkflowVisualizer = React.lazy(() =>

  import('@/features/landing/components/WorkflowVisualizer').then((m) => ({

    default: m.WorkflowVisualizer,

  }))

);



export function LandingWorkflowBlock() {

  return (

    <section id="workflows" className="landing-section-muted bg-background border-b border-border overflow-x-hidden">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-6">

        <div className="max-w-3xl">

          <h2 className="landing-display text-3xl sm:text-4xl font-semibold text-foreground leading-[1.06] text-balance tracking-tight">

            Workflows that do not stop at department walls

          </h2>

          <p className="mt-4 text-muted-foreground leading-relaxed max-w-[65ch]">

            Lead-to-cash, hire-to-retire, and procure-to-pay run as connected sequences. The demo below is the same engine your team would configure in production.

          </p>

        </div>

      </div>

      <Suspense fallback={<div className="min-h-[380px] border-t border-border" />}>

        <WorkflowVisualizer />

      </Suspense>

    </section>

  );

}

