import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

type LandingScrollHeadlineProps = {
  children: string;
  className?: string;
};

/** Scroll-linked opacity lift on section headlines (MotionSites karaoke-lite). */
export function LandingScrollHeadline({ children, className }: LandingScrollHeadlineProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.85', 'start 0.45'],
  });
  const opacity = useTransform(scrollYProgress, [0, 1], [0.35, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [reduceMotion ? 0 : 18, 0]);

  return (
    <motion.h2
      ref={ref}
      style={reduceMotion ? undefined : { opacity, y }}
      className={className}
    >
      {children}
    </motion.h2>
  );
}
