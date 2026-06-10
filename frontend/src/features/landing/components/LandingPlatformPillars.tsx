import { motion, useReducedMotion } from 'framer-motion';
import { Layers, Shield, Workflow } from 'lucide-react';
import { LandingTiltCard } from '@/features/landing/components/LandingTiltCard';
import { LandingScrollHeadline } from '@/features/landing/components/LandingScrollHeadline';
import { landingEase } from '@/features/landing/components/landing-motion';

const PILLARS = [
  {
    icon: Layers,
    title: 'One data layer',
    body: 'Customer, employee, and financial records stay aligned across CRM, finance, HR, and operations without nightly sync jobs.',
    className: 'lg:col-span-7 lg:row-span-2',
    accent: 'from-primary/20 via-primary/5 to-transparent',
  },
  {
    icon: Workflow,
    title: 'Workflows that cross departments',
    body: 'Lead-to-cash and hire-to-retire run as single processes, not email chains between tools.',
    className: 'lg:col-span-5',
    accent: 'from-muted via-background to-transparent',
  },
  {
    icon: Shield,
    title: 'Enterprise controls',
    body: 'Role-based access, org hierarchy, and centralized billing for every app in the suite.',
    className: 'lg:col-span-5',
    accent: 'from-primary/10 via-transparent to-transparent',
  },
] as const;

export function LandingPlatformPillars() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="py-20 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-12 sm:mb-16">
          <LandingScrollHeadline className="text-3xl sm:text-4xl lg:text-[2.85rem] font-medium text-foreground tracking-[-0.03em] leading-[1.06]">
            Replace tool sprawl with a single operating layer
          </LandingScrollHeadline>
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, ease: landingEase }}
            className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-[65ch]"
          >
            Zopkit is the workspace where your teams run day-to-day work, with shared identity, permissions, and data across every app.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 auto-rows-min">
          {PILLARS.map((pillar, index) => (
            <LandingTiltCard key={pillar.title} className={pillar.className}>
              <motion.article
                initial={reduceMotion ? false : { opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, delay: index * 0.08, ease: landingEase }}
                className="group relative h-full rounded-2xl border border-border/80 bg-card/80 backdrop-blur-sm p-7 sm:p-8 flex flex-col min-h-[220px] overflow-hidden hover:border-primary/25 transition-colors duration-300"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${pillar.accent} opacity-80 pointer-events-none`}
                  aria-hidden="true"
                />
                <div className="relative z-[1]">
                  <div className="w-11 h-11 rounded-xl bg-background/90 border border-border flex items-center justify-center mb-6 shadow-sm group-hover:scale-105 transition-transform duration-300">
                    <pillar.icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-xl font-medium text-foreground tracking-tight">{pillar.title}</h3>
                  <p className="mt-3 text-sm sm:text-[15px] text-muted-foreground leading-relaxed flex-1 max-w-prose">
                    {pillar.body}
                  </p>
                </div>
              </motion.article>
            </LandingTiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
