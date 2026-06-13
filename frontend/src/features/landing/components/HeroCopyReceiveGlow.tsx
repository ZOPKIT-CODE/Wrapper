import { motion } from 'framer-motion'
import { landingHeroMotion } from '../landing-hero-copy'

/** Soft landing wash on copy block while ball projects upward. */
export function HeroCopyReceiveGlow() {
  const m = landingHeroMotion.ch2
  const total = m.copyBeamOff - m.copyBeamOn + m.copyBeamRetractDur

  return (
    <motion.div
      className="hero-copy-receive-glow"
      aria-hidden="true"
      initial={{ opacity: 0, scaleX: 0.32 }}
      animate={{
        opacity: [0, 0.58, 0.74, 0.88, 0.95, 0.95, 0],
        scaleX: [0.32, 0.5, 0.66, 0.82, 0.96, 1.06, 0.32],
      }}
      transition={{
        duration: total,
        delay: m.copyBeamOn,
        times: [
          0,
          (m.line2 - m.copyBeamOn) / total,
          (m.subtext - m.copyBeamOn) / total,
          (m.divider - m.copyBeamOn) / total,
          (m.cta - m.copyBeamOn) / total,
          (m.copyBeamOff - m.copyBeamOn) / total,
          1,
        ],
        ease: 'easeInOut',
      }}
    />
  )
}
