import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { DynamicIcon } from '@/features/landing/components/Icons';
import { LandingTiltCard } from '@/features/landing/components/LandingTiltCard';
import { LandingScrollHeadline } from '@/features/landing/components/LandingScrollHeadline';
import { landingEase } from '@/features/landing/components/landing-motion';

const SUITE_APPS = [
  {
    id: 'b2b-crm',
    name: 'B2B CRM',
    icon: 'Briefcase',
    tagline: 'Pipeline to invoice in one system',
    span: 'lg:col-span-7 lg:row-span-2',
    image: 'https://picsum.photos/seed/zopkit-crm-pipeline/900/700',
  },
  {
    id: 'financial-accounting',
    name: 'Financial Accounting',
    icon: 'Landmark',
    tagline: 'Ledger, AP/AR, and compliance',
    span: 'lg:col-span-5',
    image: null,
  },
  {
    id: 'operations-management',
    name: 'Operations',
    icon: 'Box',
    tagline: 'Inventory through fulfillment',
    span: 'lg:col-span-4',
    image: null,
  },
  {
    id: 'hrms',
    name: 'HRMS',
    icon: 'UserCheck',
    tagline: 'Hire to retire',
    span: 'lg:col-span-4',
    image: null,
  },
  {
    id: 'project-management',
    name: 'Projects',
    icon: 'ClipboardList',
    tagline: 'Delivery tied to finance and HR',
    span: 'lg:col-span-4',
    image: null,
  },
] as const;

export function LandingProductSuite() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  return (
    <section id="platform" className="py-20 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-8 border-y border-border/80 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 0%, color-mix(in oklch, var(--primary) 6%, transparent), transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto relative z-[1]">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12 sm:mb-14">
          <div className="max-w-2xl">
            <LandingScrollHeadline className="text-3xl sm:text-4xl lg:text-[2.85rem] font-medium text-foreground tracking-[-0.03em] leading-[1.06]">
              Every function. One platform.
            </LandingScrollHeadline>
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, ease: landingEase }}
              className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed"
            >
              Start with the apps you need today. Add modules as your teams grow without renegotiating access or data contracts.
            </motion.p>
          </div>
          <motion.button
            type="button"
            whileHover={reduceMotion ? undefined : { x: 2 }}
            onClick={() => navigate({ to: '/pricing' })}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover transition-colors cursor-pointer shrink-0"
          >
            Compare plans
            <ArrowUpRight className="w-4 h-4" />
          </motion.button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 auto-rows-fr">
          {SUITE_APPS.map((app, index) => (
            <LandingTiltCard key={app.id} className={app.span}>
              <motion.button
                type="button"
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.55, delay: index * 0.05, ease: landingEase }}
                onClick={() => navigate({ to: `/products/${app.id}` })}
                className="group relative w-full h-full min-h-[200px] text-left rounded-2xl border border-border/80 bg-card/90 backdrop-blur-sm overflow-hidden hover:border-primary/30 transition-colors duration-300 cursor-pointer flex flex-col"
              >
                {app.image ? (
                  <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                    <img
                      src={app.image}
                      alt=""
                      className="w-full h-full object-cover opacity-[0.2] group-hover:opacity-[0.28] group-hover:scale-105 transition-all duration-700"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/94 to-card/75" />
                  </div>
                ) : (
                  <div
                    className="absolute inset-0 pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity duration-300"
                    aria-hidden="true"
                    style={{
                      background:
                        index % 2 === 0
                          ? 'radial-gradient(ellipse at 100% 0%, color-mix(in oklch, var(--primary) 12%, transparent), transparent 52%)'
                          : 'radial-gradient(ellipse at 0% 100%, color-mix(in oklch, var(--primary) 10%, transparent), transparent 55%)',
                    }}
                  />
                )}

                <div className="relative z-[1] p-6 sm:p-7 flex flex-col h-full">
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div className="w-11 h-11 rounded-xl bg-background/90 border border-white/20 flex items-center justify-center shadow-sm backdrop-blur-sm group-hover:scale-105 transition-transform duration-300">
                      <DynamicIcon name={app.icon} className="w-5 h-5 text-primary" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shrink-0" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-medium text-foreground tracking-tight">
                    {app.name}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                    {app.tagline}
                  </p>
                </div>
              </motion.button>
            </LandingTiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
