import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { landingEase } from '@/features/landing/components/landing-motion';

export function LandingEnterpriseCta() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-20 sm:py-24 lg:py-28">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.65, ease: landingEase }}
        className="relative max-w-7xl mx-auto p-[1px] rounded-[1.65rem] overflow-hidden"
      >
        {!reduceMotion && (
          <div
            className="landing-cta-border-spin absolute inset-[-50%] opacity-70"
            style={{
              background: 'conic-gradient(from 0deg, transparent, color-mix(in oklch, white 40%, transparent), transparent 30%)',
            }}
            aria-hidden="true"
          />
        )}

        <div className="relative overflow-hidden rounded-[1.6rem] border border-primary/25 bg-primary px-6 sm:px-10 lg:px-14 py-14 sm:py-16 lg:py-20">
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
            style={{
              background:
                'radial-gradient(ellipse 70% 80% at 100% 0%, color-mix(in oklch, white 14%, transparent), transparent 55%), radial-gradient(ellipse 50% 60% at 0% 100%, color-mix(in oklch, white 8%, transparent), transparent 50%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            aria-hidden="true"
            style={{
              backgroundImage:
                'linear-gradient(color-mix(in oklch, white 50%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklch, white 50%, transparent) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />

          <div className="relative z-[1] grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] leading-[1.06] text-white">
                Ready to consolidate your stack?
              </h2>
              <p className="mt-4 text-base sm:text-lg text-white/75 leading-relaxed max-w-md">
                See how teams run CRM, finance, HR, and operations from one workspace. Review our security posture before you roll out.
              </p>
            </div>

            <div className="flex lg:justify-end">
              <Button
                size="lg"
                onClick={() => navigate({ to: '/security' })}
                className="rounded-full h-12 px-8 text-[15px] font-semibold bg-white text-primary hover:bg-white/92 border-0 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)]"
              >
                Security overview
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
