import { useId, useMemo, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { landingHeroMotion } from '../landing-hero-copy'
import { HeroProjectionParticles } from './HeroProjectionParticles'

/** Cone apex (puck emitter) → top (screen bottom). */
const APEX_Y = 100
const TOP_Y = 6
const APEX_X = 50
const RAY_COUNT = 17

function seeded(seed: number): number {
  const x = Math.sin(seed * 97.3 + 211.9) * 43758.5453
  return x - Math.floor(x)
}

type HeroProjectionBeamProps = {
  className?: string
  isMobile?: boolean
}

export function HeroProjectionBeam({
  className,
  isMobile = false,
}: HeroProjectionBeamProps) {
  const uid = useId().replace(/:/g, '')
  const m = landingHeroMotion

  const rays = useMemo(() => {
    const count = isMobile ? 11 : RAY_COUNT
    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1)
      const x = 16 + t * 68
      const wobble = (seeded(i + 3) - 0.5) * 1.8
      const opacity = 0.04 + seeded(i + 7) * 0.09
      const width = 0.35 + seeded(i + 13) * 0.55
      const delay = seeded(i + 19) * 4.5
      return { x: x + wobble, opacity, width, delay, i }
    })
  }, [isMobile])

  return (
    <motion.div
      className={`hero-projection-beam landing-hero-illust-cone${className ? ` ${className}` : ''}`}
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      transition={{
        duration: m.coneDur,
        delay: m.coneDelay,
        ease: [0.16, 1, 0.32, 1],
      }}
      style={{ transformOrigin: '50% 100%' }}
      aria-hidden="true"
    >
      <svg
        className="hero-projection-beam__cone"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={`${uid}-cone`}
            x1="50"
            y1={APEX_Y}
            x2="50"
            y2={TOP_Y}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="rgba(248, 254, 255, 0.68)" />
            <stop offset="8%" stopColor="rgba(200, 245, 255, 0.42)" />
            <stop offset="22%" stopColor="rgba(130, 215, 255, 0.22)" />
            <stop offset="50%" stopColor="rgba(94, 231, 255, 0.09)" />
            <stop offset="100%" stopColor="rgba(94, 231, 255, 0)" />
          </linearGradient>
          <linearGradient
            id={`${uid}-core`}
            x1="50"
            y1={APEX_Y}
            x2="50"
            y2={TOP_Y}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.72)" />
            <stop offset="12%" stopColor="rgba(220, 250, 255, 0.38)" />
            <stop offset="40%" stopColor="rgba(160, 230, 255, 0.12)" />
            <stop offset="100%" stopColor="rgba(94, 231, 255, 0)" />
          </linearGradient>
          <linearGradient
            id={`${uid}-ray`}
            x1={APEX_X}
            y1={APEX_Y}
            x2={APEX_X}
            y2={TOP_Y}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.55)" />
            <stop offset="15%" stopColor="rgba(180, 240, 255, 0.28)" />
            <stop offset="55%" stopColor="rgba(94, 231, 255, 0.08)" />
            <stop offset="100%" stopColor="rgba(94, 231, 255, 0)" />
          </linearGradient>
          <radialGradient id={`${uid}-hotspot`} cx="50%" cy="100%" r="55%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.5)" />
            <stop offset="35%" stopColor="rgba(160, 230, 255, 0.15)" />
            <stop offset="100%" stopColor="rgba(94, 231, 255, 0)" />
          </radialGradient>
          <filter
            id={`${uid}-beam-blur`}
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
          >
            <feGaussianBlur stdDeviation="0.8" />
          </filter>
        </defs>

        {/* Emitter hotspot bloom */}
        <ellipse
          cx={APEX_X}
          cy={APEX_Y - 1}
          rx="9"
          ry="4.5"
          fill={`url(#${uid}-hotspot)`}
          filter={`url(#${uid}-beam-blur)`}
        />

        {/* Volumetric ray fan */}
        <g
          className="hero-projection-beam__rays"
          filter={`url(#${uid}-beam-blur)`}
        >
          {rays.map(({ x, opacity, width, delay, i }) => (
            <line
              key={i}
              className="hero-projection-beam__ray"
              x1={APEX_X}
              y1={APEX_Y}
              x2={x}
              y2={TOP_Y}
              stroke={`url(#${uid}-ray)`}
              strokeWidth={width}
              strokeLinecap="round"
              style={
                {
                  animationDelay: `${delay}s`,
                  '--ray-o': opacity,
                } as CSSProperties
              }
            />
          ))}
        </g>

        {/* Main cone body */}
        <polygon
          className="hero-projection-beam__shape"
          points={`50,${APEX_Y} 16,${TOP_Y} 84,${TOP_Y}`}
          fill={`url(#${uid}-cone)`}
        />

        {/* Bright core column */}
        <polygon
          className="hero-projection-beam__core"
          points={`50,${APEX_Y} 46.5,${TOP_Y} 53.5,${TOP_Y}`}
          fill={`url(#${uid}-core)`}
        />
      </svg>
      <HeroProjectionParticles isMobile={isMobile} />
    </motion.div>
  )
}
