import { useId } from 'react'
import { motion } from 'framer-motion'
import { landingHeroMotion } from '../landing-hero-copy'

const APEX_Y = 100
const TOP_Y = 18
type HeroCopyProjectionBeamProps = {
  isMobile?: boolean
}

/** Short upward cone from robo-ball lens — copy projection phase only. */
export function HeroCopyProjectionBeam({
  isMobile = false,
}: HeroCopyProjectionBeamProps) {
  const uid = useId().replace(/:/g, '')
  const m = landingHeroMotion.ch2
  const beamHeight = isMobile ? 220 : 380
  const beamWidth = isMobile ? 280 : 680
  const total = m.copyBeamOff - m.copyBeamOn + m.copyBeamRetractDur
  const beat = (t: number) =>
    Math.max(0, Math.min(1, (t - m.copyBeamOn) / total))

  return (
    <motion.div
      className="hero-copy-projection-beam"
      aria-hidden="true"
      initial={{ opacity: 0, scaleY: 0, scaleX: 0.28 }}
      animate={{
        opacity: [0, 1, 1, 1, 1, 1, 1, 0],
        scaleY: [0, 1, 1, 1, 1, 1, 1, 0],
        scaleX: [0.28, 0.46, 0.62, 0.78, 0.92, 1.06, 1.06, 0.28],
      }}
      transition={{
        duration: total,
        delay: m.copyBeamOn,
        times: [
          0,
          beat(m.copyBeamOn + m.copyBeamGrowDur),
          beat(m.line2),
          beat(m.subtext),
          beat(m.divider),
          beat(m.cta),
          beat(m.copyBeamOff),
          1,
        ],
        ease: [
          [0.16, 1, 0.32, 1],
          [0.22, 1, 0.36, 1],
          [0.22, 1, 0.36, 1],
          [0.22, 1, 0.36, 1],
          [0.22, 1, 0.36, 1],
          [0.22, 1, 0.36, 1],
          'linear',
          [0.42, 0, 0.58, 1],
        ],
      }}
      style={{
        position: 'absolute',
        left: '50%',
        bottom: '52%',
        width: beamWidth,
        height: beamHeight,
        marginLeft: -beamWidth / 2,
        transformOrigin: '50% 100%',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    >
      <svg
        className="hero-copy-projection-beam__svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={`${uid}-copy-cone`}
            x1="50"
            y1={APEX_Y}
            x2="50"
            y2={TOP_Y}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="rgba(248, 254, 255, 0.55)" />
            <stop offset="12%" stopColor="rgba(200, 245, 255, 0.32)" />
            <stop offset="40%" stopColor="rgba(130, 215, 255, 0.14)" />
            <stop offset="100%" stopColor="rgba(94, 231, 255, 0)" />
          </linearGradient>
          <linearGradient
            id={`${uid}-copy-core`}
            x1="50"
            y1={APEX_Y}
            x2="50"
            y2={TOP_Y}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.62)" />
            <stop offset="25%" stopColor="rgba(200, 245, 255, 0.22)" />
            <stop offset="100%" stopColor="rgba(94, 231, 255, 0)" />
          </linearGradient>
        </defs>
        <polygon
          className="hero-copy-projection-beam__shape"
          points={`50,${APEX_Y} 4,${TOP_Y} 96,${TOP_Y}`}
          fill={`url(#${uid}-copy-cone)`}
        />
        <polygon
          className="hero-copy-projection-beam__core"
          points={`50,${APEX_Y} 40,${TOP_Y} 60,${TOP_Y}`}
          fill={`url(#${uid}-copy-core)`}
        />
      </svg>
    </motion.div>
  )
}
