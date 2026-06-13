import { motion } from 'framer-motion'
import { landingHeroMotion } from '../landing-hero-copy'

type HeroScanFlashProps = {
  isMobile?: boolean
}

/** Horizontal light sweep when the robo-ball lands at stage center. */
export function HeroScanFlash({ isMobile = false }: HeroScanFlashProps) {
  const m = landingHeroMotion

  return (
    <motion.div
      className="hero-scan-flash"
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{
        delay: m.scanFlashDelay,
        duration: m.scanFlashDur,
        times: [0, 0.12, 0.78, 1],
        ease: 'easeOut',
      }}
      style={{
        top: isMobile ? '36%' : '40%',
      }}
    >
      <motion.div
        className="hero-scan-flash__beam"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: [0, 1.05, 1.05], opacity: [0, 1, 0] }}
        transition={{
          delay: m.scanFlashDelay,
          duration: m.scanFlashDur * 0.92,
          times: [0, 0.35, 1],
          ease: [0.16, 1, 0.32, 1],
        }}
      />
      <motion.div
        className="hero-scan-flash__core"
        initial={{ left: '-8%', opacity: 0 }}
        animate={{ left: ['-8%', '108%'], opacity: [0, 1, 1, 0] }}
        transition={{
          delay: m.scanFlashDelay + 0.04,
          duration: m.scanFlashDur * 0.85,
          times: [0, 0.08, 0.72, 1],
          ease: [0.22, 0.08, 0.12, 1],
        }}
      />
    </motion.div>
  )
}
