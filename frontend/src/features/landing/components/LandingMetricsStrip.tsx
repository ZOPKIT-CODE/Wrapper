import { motion, useReducedMotion } from 'framer-motion';
import { landingEase } from '@/features/landing/components/landing-motion';

const METRICS = [
  { value: '11+', label: 'Integrated business apps' },
  { value: '1', label: 'Login for every team' },
  { value: '3', label: 'Core workflow automations' },
  { value: '24h', label: 'Typical sales response' },
] as const;

export function LandingMetricsStrip() {
  const reduceMotion = useReducedMotion();

  return (
    <section aria-label="Platform scale" className="border-b border-border/80 bg-background/70 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-11 sm:py-12">
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {METRICS.map((item, index) => (
            <motion.li
              key={item.label}
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.55, delay: index * 0.07, ease: landingEase }}
              className="text-center lg:text-left lg:pl-6 lg:first:pl-0 lg:border-l lg:border-border/80 lg:first:border-l-0"
            >
              <p className="text-3xl sm:text-[2.5rem] font-medium text-foreground tracking-[-0.03em] tabular-nums">
                {item.value}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground leading-snug max-w-[14ch] mx-auto lg:mx-0">
                {item.label}
              </p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
