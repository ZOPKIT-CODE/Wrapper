import { motion, useReducedMotion } from 'framer-motion';

export function LandingAmbientBg() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute -top-[20%] -right-[10%] w-[min(720px,90vw)] h-[min(720px,90vw)] rounded-full opacity-40"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklch, var(--primary) 22%, transparent) 0%, transparent 68%)',
        }}
        animate={reduceMotion ? undefined : { x: [0, 24, 0], y: [0, -18, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-[35%] -left-[15%] w-[min(560px,70vw)] h-[min(560px,70vw)] rounded-full opacity-30"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklch, var(--primary) 16%, transparent) 0%, transparent 70%)',
        }}
        animate={reduceMotion ? undefined : { x: [0, -20, 0], y: [0, 22, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <motion.div
        className="absolute bottom-[5%] right-[20%] w-[min(400px,50vw)] h-[min(400px,50vw)] rounded-full opacity-25"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklch, var(--primary) 12%, transparent) 0%, transparent 72%)',
        }}
        animate={reduceMotion ? undefined : { scale: [1, 1.06, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      />
    </div>
  );
}
