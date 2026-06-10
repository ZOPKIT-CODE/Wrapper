import React, { Suspense } from 'react';

const WorkflowVisualizer = React.lazy(() =>
  import('@/features/landing/components/WorkflowVisualizer').then((m) => ({
    default: m.WorkflowVisualizer,
  }))
);

export function LandingWorkflowDemo() {
  return (
    <section className="py-16 sm:py-20 bg-muted/20 border-b border-border overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <h2 className="font-['Bricolage_Grotesque'] text-2xl sm:text-3xl font-semibold tracking-[-0.02em]">
          Watch a workflow run in real time
        </h2>
      </div>
      <Suspense fallback={<div className="min-h-[360px]" />}>
        <WorkflowVisualizer />
      </Suspense>
    </section>
  );
}
