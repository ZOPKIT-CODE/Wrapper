import { useRef, useState } from 'react';
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  AnimatePresence,
} from 'framer-motion';
import { landingEase } from '@/features/landing/components/landing-motion';

const WORKFLOWS = [
  {
    id: 'lead-to-cash',
    title: 'Lead to cash',
    summary: 'A closed deal should not mean three spreadsheets and a Slack thread.',
    body: 'When CRM marks a deal won, operations reserves inventory and finance issues the invoice. Payment posts back to the same customer record.',
    apps: ['B2B CRM', 'Operations', 'Finance'],
  },
  {
    id: 'hire-to-retire',
    title: 'Hire to retire',
    summary: 'Onboarding should not stall between HR, IT, and payroll.',
    body: 'A signed offer creates the employee profile, provisions access, enrolls training, and sets up payroll without re-keying the same name four times.',
    apps: ['HRMS', 'ITSM', 'Academy', 'Finance'],
  },
  {
    id: 'procure-to-pay',
    title: 'Procure to pay',
    summary: 'Purchase orders and vendor bills should match without a Friday afternoon audit.',
    body: 'Requisitions become POs, goods receipt updates stock, and finance runs a three-way match before releasing payment.',
    apps: ['Operations', 'Finance'],
  },
] as const;

export function LandingStickyWorkflow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    if (reduceMotion) return;
    const next = Math.min(
      WORKFLOWS.length - 1,
      Math.max(0, Math.floor(value * WORKFLOWS.length))
    );
    setActive(next);
  });

  const step = WORKFLOWS[active];

  return (
    <section
      id="workflows"
      ref={containerRef}
      className="relative border-b border-border"
      style={{ height: reduceMotion ? 'auto' : '280vh' }}
    >
      <div
        className={
          reduceMotion
            ? 'py-20 sm:py-24 px-4 sm:px-6 lg:px-8'
            : 'sticky top-[64px] min-h-[calc(100dvh-64px)] flex items-center py-16 sm:py-20 px-4 sm:px-6 lg:px-8'
        }
      >
        <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-28">
            <h2 className="font-['Bricolage_Grotesque'] text-3xl sm:text-4xl font-semibold text-foreground tracking-[-0.03em] leading-[1.06] text-balance">
              Handoffs are a design flaw. We removed them.
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-md">
              Pick a workflow. Scroll to see how departments stay in sync inside Zopkit.
            </p>

            <ol className="mt-10 space-y-0 border-t border-border">
              {WORKFLOWS.map((wf, index) => {
                const isActive = index === active;
                return (
                  <li key={wf.id} className="border-b border-border">
                    <button
                      type="button"
                      onClick={() => setActive(index)}
                      className={`w-full text-left py-4 transition-colors cursor-pointer ${
                        isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground/80 font-normal'
                      }`}
                    >
                      <span className="text-base">{wf.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              <motion.article
                key={step.id}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: landingEase }}
                className="pt-2 lg:pt-8"
              >
                <h3 className="font-['Bricolage_Grotesque'] text-2xl sm:text-3xl font-semibold tracking-[-0.02em] text-foreground">
                  {step.title}
                </h3>
                <p className="mt-3 text-lg text-foreground/90 leading-snug max-w-prose">
                  {step.summary}
                </p>
                <p className="mt-5 text-muted-foreground leading-relaxed max-w-prose">
                  {step.body}
                </p>

                <ul className="mt-8 flex flex-wrap gap-2">
                  {step.apps.map((app) => (
                    <li
                      key={app}
                      className="font-['JetBrains_Mono'] text-[11px] px-2.5 py-1 rounded-md bg-muted text-foreground/80"
                    >
                      {app}
                    </li>
                  ))}
                </ul>
              </motion.article>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {reduceMotion && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-16">
          {WORKFLOWS.slice(1).map((wf) => (
            <article key={wf.id} className="border-t border-border pt-10">
              <h3 className="font-['Bricolage_Grotesque'] text-2xl font-semibold">{wf.title}</h3>
              <p className="mt-3 text-muted-foreground max-w-prose">{wf.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
