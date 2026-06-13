import { motion } from 'framer-motion'
import { landingHeroMotion } from '../landing-hero-copy'

const BLUE = '#4dc8ff'

type ConnSpec = {
  id: string
  d: string
  pathDelay: number
  flowDelay: number
  start: { cx: number; cy: number; delay: number; opacity: number }
  end: { cx: number; cy: number; delay: number; opacity: number }
}

const CONNECTORS: ConnSpec[] = [
  {
    id: 'crm',
    d: 'M 175,190 C 230,190 258,220 279,220',
    pathDelay: landingHeroMotion.conn.crmPath,
    flowDelay: landingHeroMotion.conn.crmFlow,
    start: {
      cx: 175,
      cy: 190,
      delay: landingHeroMotion.conn.crmDot,
      opacity: 0.9,
    },
    end: {
      cx: 279,
      cy: 220,
      delay: landingHeroMotion.conn.crmEnd,
      opacity: 0.65,
    },
  },
  {
    id: 'fin',
    d: 'M 175,355 C 230,355 258,370 279,370',
    pathDelay: landingHeroMotion.conn.finPath,
    flowDelay: landingHeroMotion.conn.finFlow,
    start: {
      cx: 175,
      cy: 355,
      delay: landingHeroMotion.conn.finDot,
      opacity: 0.82,
    },
    end: {
      cx: 279,
      cy: 370,
      delay: landingHeroMotion.conn.finEnd,
      opacity: 0.58,
    },
  },
  {
    id: 'hrms',
    d: 'M 1039,220 C 1060,220 1090,190 1145,190',
    pathDelay: landingHeroMotion.conn.hrmsPath,
    flowDelay: landingHeroMotion.conn.hrmsFlow,
    start: {
      cx: 1145,
      cy: 190,
      delay: landingHeroMotion.conn.hrmsDot,
      opacity: 0.9,
    },
    end: {
      cx: 1039,
      cy: 220,
      delay: landingHeroMotion.conn.hrmsEnd,
      opacity: 0.65,
    },
  },
  {
    id: 'proj',
    d: 'M 1039,370 C 1060,370 1090,355 1145,355',
    pathDelay: landingHeroMotion.conn.projPath,
    flowDelay: landingHeroMotion.conn.projFlow,
    start: {
      cx: 1145,
      cy: 355,
      delay: landingHeroMotion.conn.projDot,
      opacity: 0.82,
    },
    end: {
      cx: 1039,
      cy: 370,
      delay: landingHeroMotion.conn.projEnd,
      opacity: 0.58,
    },
  },
]

function ConnectorPath({
  spec,
  compact,
}: {
  spec: ConnSpec
  compact: boolean
}) {
  const pathEase = [0.22, 1, 0.36, 1] as [number, number, number, number]

  return (
    <g className="landing-hero-conn-group">
      {!compact && (
        <motion.path
          className="landing-hero-conn-shadow"
          d={spec.d}
          stroke={BLUE}
          strokeWidth="5"
          fill="none"
          strokeOpacity="0.08"
          pathLength={1}
          strokeDasharray={1}
          initial={{ strokeDashoffset: 1 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 0.6, delay: spec.pathDelay, ease: pathEase }}
        />
      )}
      <motion.path
        className="landing-hero-conn-main"
        d={spec.d}
        stroke={BLUE}
        strokeWidth={compact ? 1.2 : 1.5}
        fill="none"
        strokeOpacity={compact ? 0.42 : 0.48}
        pathLength={1}
        strokeDasharray={1}
        initial={{ strokeDashoffset: 1 }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: 0.6, delay: spec.pathDelay, ease: pathEase }}
      />
      {!compact && (
        <motion.path
          className="landing-hero-conn-flow"
          d={spec.d}
          stroke={BLUE}
          strokeWidth="1"
          fill="none"
          strokeOpacity="0.30"
          strokeDasharray="4 8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.35 }}
          transition={{ duration: 0.1, delay: spec.flowDelay }}
        />
      )}
      <motion.circle
        cx={spec.start.cx}
        cy={spec.start.cy}
        r={compact ? 3.5 : 4.5}
        fill={BLUE}
        opacity={spec.start.opacity}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: spec.start.opacity }}
        transition={{
          duration: 0.3,
          delay: spec.start.delay,
          type: 'spring',
          stiffness: 300,
        }}
      />
      <motion.circle
        cx={spec.end.cx}
        cy={spec.end.cy}
        r={compact ? 2.5 : 3.5}
        fill={BLUE}
        opacity={spec.end.opacity}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: spec.end.opacity }}
        transition={{ duration: 0.3, delay: spec.end.delay }}
      />
    </g>
  )
}

type HeroStageConnectorsProps = {
  compact?: boolean
}

export function HeroStageConnectors({
  compact = false,
}: HeroStageConnectorsProps) {
  return (
    <motion.svg
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: landingHeroMotion.connectors }}
      className="landing-hero-illust-connectors"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 4,
        overflow: 'visible',
      }}
      viewBox="0 0 1320 720"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {CONNECTORS.map((spec) => (
        <ConnectorPath key={spec.id} spec={spec} compact={compact} />
      ))}
    </motion.svg>
  )
}
