/** Shared motion tokens for landing (MotionSites-inspired easing). */
export const landingEase = [0.16, 1, 0.3, 1] as const;

export const landingSpring = { type: 'spring' as const, stiffness: 120, damping: 22 };

export const revealUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay, ease: landingEase },
  }),
};
